import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import type { ZoneResult, Recipe, Item, CalculatorResult } from '../types';
import { ArrowUpRight, DollarSign, AlertTriangle, GripHorizontal, Globe, MapPin, TrendingUp, Zap } from 'lucide-react';
import { getInputRatePerMinute } from '../utils/zoneCalculator';

interface ZoneStatisticsPanelProps {
    zoneResult: ZoneResult | null;
    fullResult: CalculatorResult | null;
    recipes: Recipe[];
    items: Item[];
}

export function ZoneStatisticsPanel({ zoneResult, fullResult, recipes, items }: ZoneStatisticsPanelProps) {
    // Mode: local (current zone) or global (all zones combined)
    const [viewMode, setViewMode] = useState<'local' | 'global'>('local');

    // Draggable & Resizable State
    const [width, setWidth] = useState(480);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0, startWidth: 0 });

    const handleDragStart = (e: React.MouseEvent) => {
        // Only drag from header, ignore if clicking buttons inside (though none yet)
        setIsDragging(true);
        dragStartRef.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            posX: pos.x,
            posY: pos.y,
            startWidth: width
        };
    };

    const handleResizeStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsResizing(true);
        dragStartRef.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            posX: pos.x,
            posY: pos.y,
            startWidth: width
        };
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging) {
            const dx = e.clientX - dragStartRef.current.mouseX;
            const dy = e.clientY - dragStartRef.current.mouseY;
            setPos({
                x: dragStartRef.current.posX + dx,
                y: dragStartRef.current.posY + dy
            });
        }
        if (isResizing) {
            const dx = dragStartRef.current.mouseX - e.clientX; // Drag left to increase width
            const newWidth = Math.max(300, Math.min(1000, dragStartRef.current.startWidth + dx));
            setWidth(newWidth);
        }
    }, [isDragging, isResizing]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setIsResizing(false);
    }, []);

    useEffect(() => {
        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

    const stats = useMemo(() => {
        const balanceMap = new Map<string, {
            produced: number;
            consumed: number;
            imported: number;
            exported: number;
            sold: number;
        }>();

        const getStats = (id: string) => {
            if (!balanceMap.has(id)) {
                balanceMap.set(id, { produced: 0, consumed: 0, imported: 0, exported: 0, sold: 0 });
            }
            return balanceMap.get(id)!;
        };

        const targetZones = (viewMode === 'global' && fullResult) 
            ? fullResult.zoneResults 
            : (zoneResult ? [zoneResult] : []);

        targetZones.forEach(zr => {
            // 1. Production & Consumption from Assignments
            zr.assignments.forEach(a => {
                const recipe = recipes.find(r => r.id === a.recipeId);
                if (!recipe) return;

                // Produced
                const outStats = getStats(recipe.outputItemId);
                outStats.produced += a.actualRate;

                // Consumed
                recipe.inputs.forEach(inp => {
                    const inStats = getStats(inp.itemId);
                    const ratePerMachine = getInputRatePerMinute(recipe, inp.itemId);
                    inStats.consumed += a.utilization * ratePerMachine;
                });
            });

            // 2. Imports (from Pool)
            zr.itemsFromPool.forEach(i => {
                getStats(i.itemId).imported += i.rate;
            });

            // 3. Exports (to Pool) & Sales
            zr.itemsToPool.forEach(i => {
                getStats(i.itemId).exported += i.rate;
            });
            zr.itemsSold.forEach(i => {
                getStats(i.itemId).sold += i.rate;
            });
        });

        // Convert to array
        return Array.from(balanceMap.keys()).map(itemId => {
            const item = items.find(i => i.id === itemId);
            const s = balanceMap.get(itemId)!;
            // For global mode, net is total produced - total consumed - total sold
            // Actually, net should always represent "excess" in the system
            const net = (s.produced + s.imported) - (s.consumed + s.exported + s.sold);
            return {
                itemId,
                item,
                ...s,
                net
            };
        }).filter(s =>
            s.produced > 0.001 ||
            s.consumed > 0.001 ||
            s.imported > 0.001 ||
            s.exported > 0.001 ||
            s.sold > 0.001
        );
    }, [zoneResult, fullResult, viewMode, recipes, items]);

    // Sort: Raw Resources -> Intermediates -> Products
    const sortedStats = useMemo(() => {
        return [...stats].sort((a, b) => {
            const typeScore = (item?: Item) => {
                if (!item) return 10;
                if (item.isRawResource) return 0;
                if (item.price > 0) return 2;
                return 1;
            };
            const sa = typeScore(a.item);
            const sb = typeScore(b.item);
            if (sa !== sb) return sa - sb;
            return (a.item?.name || '').localeCompare(b.item?.name || '');
        });
    }, [stats]);

    const totalMachines = useMemo(() => {
        if (viewMode === 'global' && fullResult) {
            return fullResult.zoneResults.reduce((sum, zr) => sum + zr.totalMachines, 0);
        }
        return zoneResult?.totalMachines || 0;
    }, [viewMode, fullResult, zoneResult]);

    const activeTitle = viewMode === 'global' ? '全局统计' : (zoneResult?.zone.name || '未知地块');

    return (
        <div
            className="zone-statistics-panel"
            style={{
                width: `${width}px`,
                transform: `translate(${pos.x}px, ${pos.y}px)`,
                userSelect: isDragging || isResizing ? 'none' : 'auto'
            }}
        >
            <div className="resize-handle-left" onMouseDown={handleResizeStart} />

            <div className="panel-header-row" onMouseDown={handleDragStart}>
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                        <GripHorizontal size={14} className="text-dim" />
                        <h3 className="m-0">{activeTitle} // {viewMode === 'global' ? 'GLOBAL' : 'LOCAL'}</h3>
                    </div>
                    
                    <div className="mode-toggle-group">
                        <button 
                            className={`mode-btn ${viewMode === 'local' ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setViewMode('local'); }}
                            title="地块视图"
                        >
                            <MapPin size={12} />
                        </button>
                        <button 
                            className={`mode-btn ${viewMode === 'global' ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setViewMode('global'); }}
                            title="全局视图"
                        >
                            <Globe size={12} />
                        </button>
                    </div>
                </div>

                <div className="zone-meta-tags mt-2">
                    <span className="tag">
                        Machines: {totalMachines}
                    </span>
                    {viewMode === 'local' && zoneResult && (
                        <span className="tag">
                            Outlet: {zoneResult.outputPortsUsed.toFixed(1)} / {zoneResult.zone.outputPorts}
                        </span>
                    )}
                    {viewMode === 'global' && fullResult && (
                        <span className="tag highlight">
                            Profit: ${fullResult.totalIncome.toFixed(1)}/min
                        </span>
                    )}
                </div>
            </div>

            <div className="stats-section">
                <div className="flex justify-between items-center mb-2">
                    <h4>物料平衡表 / MATERIAL BALANCE</h4>
                </div>

                {viewMode === 'global' && (
                    <>
                        <div className="global-summary-cards mb-4">
                            <div className="summary-mini-item">
                                <TrendingUp size={14} className="text-success" />
                                <div className="flex flex-col">
                                    <span className="label">总产值</span>
                                    <span className="val">${fullResult?.totalIncome.toFixed(1)}</span>
                                </div>
                            </div>
                            <div className="summary-mini-item">
                                <Zap size={14} className="text-warning" />
                                <div className="flex flex-col">
                                    <span className="label">地块总数</span>
                                    <span className="val">{fullResult?.zoneResults.length || 0}</span>
                                </div>
                            </div>
                        </div>

                        {fullResult && fullResult.globalResourceUsage.length > 0 && (
                            <div className="raw-resource-summary mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap size={12} className="text-warning" />
                                    <span className="text-[10px] font-bold text-dim uppercase tracking-wider">Raw Material consumption</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {fullResult.globalResourceUsage.map(u => {
                                        const item = items.find(i => i.id === u.itemId);
                                        return (
                                            <div key={u.itemId} className="tag-v2">
                                                <span className="name">{item?.name}</span>
                                                <span className="val">{u.rate.toFixed(1)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}

                <div className="table-container">
                    <table className="stats-table">
                        <thead>
                            <tr>
                                <th>物品</th>
                                <th className="num-col">生产</th>
                                <th className="num-col">消耗</th>
                                <th className="num-col">出口/售卖</th>
                                <th className="num-col">盈余</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedStats.map(s => {
                                const isNetZero = Math.abs(s.net) < 0.001;
                                const isExcess = s.net > 0.001;
                                const isDeficit = s.net < -0.001;

                                // Barchart percentage
                                const maxVal = Math.max(s.produced + s.imported, s.consumed + s.exported + s.sold, 0.1);
                                const prodPct = ((s.produced + s.imported) / maxVal) * 100;
                                const consPct = ((s.consumed + s.exported + s.sold) / maxVal) * 100;

                                return (
                                    <tr key={s.itemId}>
                                        <td className="item-name-cell">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1">
                                                    <span className="item-name">{s.item?.name || s.itemId}</span>
                                                    {s.item?.price ? <span className="item-price">${s.item.price}</span> : null}
                                                </div>
                                                <div className="mini-barchart">
                                                    <div className="bar-bg">
                                                        <div className="bar-fill prod" style={{ width: `${prodPct}%` }}></div>
                                                        <div className="bar-fill cons" style={{ width: `${consPct}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={`num-col ${s.produced > 0 ? 'highlight-prod' : 'dim'}`}>
                                            {s.produced > 0 ? s.produced.toFixed(1) : '-'}
                                            {s.imported > 0 && <span className="sub-tag import">+{s.imported.toFixed(0)}</span>}
                                        </td>
                                        <td className={`num-col ${s.consumed > 0 ? 'highlight-consume' : 'dim'}`}>{s.consumed > 0 ? s.consumed.toFixed(1) : '-'}</td>
                                        <td className={`num-col ${s.exported + s.sold > 0 ? 'highlight-export' : 'dim'}`}>
                                            {s.exported > 0 && <span className="sub-val export">{s.exported.toFixed(1)} <ArrowUpRight size={10} /></span>}
                                            {s.sold > 0 && <span className="sub-val sale">{(s.sold * (s.item?.price || 0)).toFixed(1)} <DollarSign size={10} /></span>}
                                            {s.exported === 0 && s.sold === 0 && '-'}
                                        </td>
                                        <td className={`num-col net-col ${isExcess ? 'text-warning' : isDeficit ? 'text-error' : 'text-success'}`}>
                                            {isNetZero ? (
                                                <span className="net-zero">PASS</span>
                                            ) : (
                                                <div className="flex items-center justify-end gap-1">
                                                    {isDeficit && <AlertTriangle size={12} />}
                                                    <span>{s.net > 0 ? '+' : ''}{s.net.toFixed(1)}</span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {viewMode === 'local' && zoneResult && (
                <div className="stats-section">
                    <h4>设备配置 / CONFIGURATION</h4>
                    <table className="machine-table-v2">
                        <thead>
                            <tr>
                                <th>Machine</th>
                                <th>Recipe</th>
                                <th className="num-col">Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            {zoneResult.assignments.map((a, i) => {
                                const recipe = recipes.find(r => r.id === a.recipeId);
                                return (
                                    <tr key={i}>
                                        <td>{recipe?.machineId}</td>
                                        <td>{recipe?.name}</td>
                                        <td className="num-col">{a.machineCount}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            {viewMode === 'global' && fullResult && (
                <div className="stats-section">
                    <h4>区域详情 / ZONE BREAKDOWN</h4>
                    <table className="machine-table-v2">
                        <thead>
                            <tr>
                                <th>Zone</th>
                                <th className="num-col">Income</th>
                                <th className="num-col">Raw Usage</th>
                                <th className="num-col">Machines</th>
                                <th className="num-col">Ports</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fullResult.zoneResults.map(zr => {
                                const zoneIncome = zr.itemsSold.reduce((sum, s) => {
                                    const item = items.find(i => i.id === s.itemId);
                                    return sum + (s.rate * (item?.price || 0));
                                }, 0);
                                
                                const rawUsage = zr.itemsFromPool
                                    .filter(i => items.find(it => it.id === i.itemId)?.isRawResource)
                                    .map(i => {
                                        const item = items.find(it => it.id === i.itemId);
                                        return { name: item?.name || i.itemId, rate: i.rate };
                                    });

                                return (
                                    <tr key={zr.zone.id}>
                                        <td className="item-name">{zr.zone.name}</td>
                                        <td className="num-col text-success">${zoneIncome.toFixed(1)}</td>
                                        <td className="num-col">
                                            <div className="flex flex-col items-end gap-0.5">
                                                {rawUsage.length > 0 ? rawUsage.map((u, idx) => (
                                                    <span key={idx} className="text-[10px] text-dim">{u.name}: {u.rate.toFixed(0)}</span>
                                                )) : <span className="text-dim">-</span>}
                                            </div>
                                        </td>
                                        <td className="num-col">{zr.totalMachines}</td>
                                        <td className="num-col">{zr.outputPortsUsed.toFixed(0)}/{zr.zone.outputPorts}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
