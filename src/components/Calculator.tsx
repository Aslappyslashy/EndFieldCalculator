import { useState } from 'react';
import {
  Settings2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useItems, useRecipes, useMachines, useZones, useZoneAssignments } from '../hooks/useDatabase';
import type {
  CalculatorInput,
  CalculatorResult,
  ProductionTarget,
  ResourceConstraint,
  OptimizationMode,
  OptimizerEvent
} from '../types';
import { ZoneStatisticsPanel } from './ZoneStatisticsPanel';
import { ScenarioManager } from './ScenarioManager';
import { ScenarioToolbar } from './calculator/ScenarioToolbar';
import { ConfigurationPanel } from './calculator/ConfigurationPanel';
import { ZoneNavigator } from './calculator/ZoneNavigator';
import { ZoneReportView } from './calculator/ZoneReportView';

interface CalculatorProps {
  // Config State
  targets: ProductionTarget[];
  setTargets: (t: ProductionTarget[]) => void;
  constraints: ResourceConstraint[];
  setConstraints: (c: ResourceConstraint[]) => void;
  optimizationMode: OptimizationMode;
  setOptimizationMode: (m: OptimizationMode) => void;
  transferPenalty: number;
  setTransferPenalty: (p: number) => void;
  consolidationWeight: number;
  setConsolidationWeight: (w: number) => void;
  machineWeight: number;
  setMachineWeight: (w: number) => void;
  nodePositions: Record<string, { x: number; y: number }>;
  setNodePositions: (p: Record<string, { x: number; y: number }> | ((prev: Record<string, { x: number; y: number }>) => Record<string, { x: number; y: number }>)) => void;

  // Result State
  result: CalculatorResult | null;
  setResult: (r: CalculatorResult | null) => void;

  // Scenario Hook
  scenarioHook: any;

  onStartCalculation?: () => void;
  onCalculationProgress?: (event: OptimizerEvent) => void;
  onCalculationComplete?: (result: CalculatorResult) => void;
}

export function Calculator(props: CalculatorProps) {
  const {
    targets, setTargets,
    constraints, setConstraints,
    optimizationMode, setOptimizationMode,
    transferPenalty, setTransferPenalty,
    consolidationWeight, setConsolidationWeight,
    machineWeight, setMachineWeight,
    nodePositions, setNodePositions,
    result, setResult,
    scenarioHook,
    onStartCalculation, onCalculationProgress, onCalculationComplete
  } = props;

  const { items } = useItems();
  const { recipes } = useRecipes();
  const { machines } = useMachines();
  const { zones } = useZones();
  const { bulkSet: bulkSetAssignments } = useZoneAssignments();

  const {
    scenarios,
    activeId,
    activeScenario,
    createScenario,
    updateScenario,
    loadScenario,
    deleteScenario,
    bulkDeleteScenarios,
    exportScenarios,
    importScenarios
  } = scenarioHook;

  const [isScenarioManagerOpen, setIsScenarioManagerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | 'config'>('config');

  // Helpers
  const lastSavedData = activeScenario ? JSON.stringify(activeScenario.data) : null;
  const currentDataStr = JSON.stringify({
    targets,
    constraints,
    optimizationMode,
    transferPenalty,
    consolidationWeight,
    machineWeight,
    nodePositions
  });
  const hasUnsavedChanges = activeScenario && lastSavedData !== currentDataStr;

  const rawResources = items.filter(i => i.isRawResource);
  const craftedItems = items.filter(i => !i.isRawResource);
  const sellableItems = items.filter(i => i.price > 0 && !i.isRawResource);

  const effectiveConstraints: ResourceConstraint[] =
    constraints.length > 0
      ? constraints
      : rawResources.map(r => ({
        itemId: r.id,
        maxRate: r.baseProductionRate || 100,
      }));

  const handleCalculate = async () => {
    setError(null);
    setResult(null);
    if (onStartCalculation) onStartCalculation();

    if (targets.length === 0 && optimizationMode !== 'maxIncome') {
      setError('常规模式下需添加目标产物。如需自动探索最大利润，请切换至【产值最大化】模式。');
      return;
    }

    if (recipes.length === 0) {
      setError('配方库为空。请先在物品管理页面加载协议数据。');
      return;
    }

    if (zones.length === 0) {
      setError('未定义地块。请先在区域管理页面创建至少一个地块。');
      return;
    }

    try {
      const input: CalculatorInput = {
        targets,
        resourceConstraints: effectiveConstraints,
        zones,
        optimizationMode,
        transferPenalty: optimizationMode === 'balanced' ? transferPenalty : undefined,
        consolidationWeight,
        machineWeight,
      };

      const rawResourcesForWorker = items.filter(i => i.isRawResource);
      const machineAreas = machines
        .filter(m => typeof m.area === 'number' && (m.area as number) > 0)
        .map(m => ({ machineId: m.id, area: m.area as number }));

      const worker = new Worker(new URL('../workers/solverWorker.ts', import.meta.url), { type: 'module' });

      const { result: calcResult } = await new Promise<{ result: CalculatorResult; theoreticalMax: number }>((resolve, reject) => {
        const onMessage = (e: MessageEvent) => {
          const msg = e.data;
          if (!msg || typeof msg.type !== 'string') return;
          if (msg.type === 'solveProgress' && onCalculationProgress) {
            onCalculationProgress(msg.payload as OptimizerEvent);
          }
          if (msg.type === 'solveAllResult') {
            worker.removeEventListener('message', onMessage);
            resolve(msg.payload as { result: CalculatorResult; theoreticalMax: number });
          }
          if (msg.type === 'error') {
            worker.removeEventListener('message', onMessage);
            reject(new Error(String(msg.payload)));
          }
        };
        worker.addEventListener('message', onMessage);
        worker.postMessage({
          type: 'solveAll',
          payload: {
            input,
            items,
            recipes,
            rawResources: rawResourcesForWorker,
            machineAreas,
          },
        });
      }).finally(() => worker.terminate());

      setResult(calcResult);
      if (onCalculationComplete) onCalculationComplete(calcResult);

      if (calcResult.feasible) {
        const allAssignments = calcResult.zoneResults.flatMap(zr => zr.assignments);
        await bulkSetAssignments(allAssignments);
      }
    } catch (err) {
      console.error('计算失败:', err);
      setError(err instanceof Error ? err.message : '方案计算失败，请检查参数设置。');
    }
  };

  const itemNameById = new Map(items.map(i => [i.id, i.name] as const));
  const recipeNameById = new Map(recipes.map(r => [r.id, r.name] as const));
  const machineNameById = new Map(machines.map(m => [m.id, m.name] as const));

  const canCalculate = recipes.length > 0 && craftedItems.length > 0;

  if (!canCalculate) {
    return (
      <div className="calculator-view">
        <div className="warning">
          <p>初始化必要条件：</p>
          <ol>
            <li>前往 <strong>物品协议清单</strong> 点击 "加载协议数据"</li>
            <li>前往 <strong>地块区域管理</strong> 创建初始生产区域</li>
          </ol>
        </div>
      </div>
    );
  }

  if (zones.length === 0) {
    return (
      <div className="calculator-view">
        <div className="warning">
          <p>当前无可用地块。请前往 <strong>地块区域管理</strong> 建立基地区域。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="calculator-view">
      {selectedZoneId === 'config' && (
        <div className="view-header">
          <div className="flex items-center gap-3">
            <Settings2 className="text-accent" size={28} />
            <div>
              <h2>生产优化方案</h2>
              <p>基于全局协议数据库的自动化链路布局与产值优化</p>
            </div>
          </div>
        </div>
      )}

        <div className="result-panel-v2">
          {result && (
            <div className={`status-banner ${result.feasible ? 'feasible' : 'infeasible'}`}>
              <div className="flex items-center gap-2">
                {result.feasible ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                <span>
                  {result.feasible
                    ? '>>> 方案可行性验证通过'
                    : (result.infeasibleReason === 'unmet_targets'
                      ? '>>> 产出目标未达成：方案不可行'
                      : '>>> 约束冲突（资源/端口/空间）：方案不可行')}
                </span>
              </div>
            </div>
          )}

        <div className="result-layout-main">
          <ZoneNavigator
            selectedZoneId={selectedZoneId}
            onSelectZone={setSelectedZoneId}
            result={result}
            items={items}
            effectiveConstraints={effectiveConstraints}
          />

          <main className="result-zone-details">
            {selectedZoneId === 'config' ? (
              <>
                <ScenarioToolbar
                  scenarios={scenarios}
                  activeId={activeId}
                  activeScenario={activeScenario}
                  hasUnsavedChanges={hasUnsavedChanges}
                  onNew={createScenario}
                  onSave={() => {
                    if (activeId) {
                      updateScenario(activeId, {
                        targets,
                        constraints,
                        optimizationMode,
                        transferPenalty,
                        consolidationWeight,
                        machineWeight,
                        nodePositions
                      });
                      alert('Scenario saved!');
                    }
                  }}
                  onLoad={loadScenario}
                  onRename={(id, name) => updateScenario(id, {}, name)}
                  onDelete={deleteScenario}
                  onExport={exportScenarios}
                  onImport={importScenarios}
                  onOpenManager={() => setIsScenarioManagerOpen(true)}
                />

                <ConfigurationPanel
                  optimizationMode={optimizationMode}
                  onOptimizationModeChange={setOptimizationMode}
                  transferPenalty={transferPenalty}
                  onTransferPenaltyChange={setTransferPenalty}
                  consolidationWeight={consolidationWeight}
                  onConsolidationWeightChange={setConsolidationWeight}
                  machineWeight={machineWeight}
                  onMachineWeightChange={setMachineWeight}
                  targets={targets}
                  onAddTarget={() => {
                    const defaultItem = sellableItems[0] || craftedItems[0];
                    if (defaultItem) setTargets([...targets, { itemId: defaultItem.id, targetRate: 1 }]);
                  }}
                  onUpdateTarget={(index, field, value) => {
                    const newTargets = [...targets];
                    if (field === 'targetRate') {
                      newTargets[index] = { ...newTargets[index], targetRate: parseFloat(value) || 0 };
                    } else {
                      newTargets[index] = { ...newTargets[index], itemId: value };
                    }
                    setTargets(newTargets);
                  }}
                  onRemoveTarget={(index) => setTargets(targets.filter((_, i) => i !== index))}
                  effectiveConstraints={effectiveConstraints}
                  onUpdateConstraint={(index, value) => {
                    const newConstraints = [...effectiveConstraints];
                    newConstraints[index] = { ...newConstraints[index], maxRate: parseFloat(value) || 0 };
                    setConstraints(newConstraints);
                  }}
                  sellableItems={sellableItems}
                  craftedItems={craftedItems}
                  rawResources={rawResources}
                  onCalculate={handleCalculate}
                  error={error}
                />
              </>
            ) : (() => {
              const zoneResult = result?.zoneResults.find(z => z.zone.id === selectedZoneId);
              if (!zoneResult) return <div className="empty-state">方案计算完成后可在此查看区域详情</div>;

              return (
                <ZoneReportView
                  zoneResult={zoneResult}
                  result={result!}
                  recipes={recipes}
                  itemNameById={itemNameById}
                  recipeNameById={recipeNameById}
                  machineNameById={machineNameById}
                  nodePositions={nodePositions}
                  onLayoutChange={(newPos) => {
                    if (Object.keys(newPos).length === 0) {
                      setNodePositions({});
                    } else {
                      setNodePositions(prev => ({ ...prev, ...newPos }));
                    }
                  }}
                />
              );
            })()}
          </main>
        </div>

        {result && (
          <div className="zone-statistics-wrapper">
            <ZoneStatisticsPanel
              zoneResult={result.zoneResults.find(zr => zr.zone.id === selectedZoneId) || null}
              fullResult={result}
              recipes={recipes}
              items={items}
            />
          </div>
        )}
      </div>

      {isScenarioManagerOpen && (
        <ScenarioManager
          scenarios={scenarios}
          activeId={activeId}
          onClose={() => setIsScenarioManagerOpen(false)}
          onDelete={(ids) => {
            bulkDeleteScenarios(ids);
            if (ids.length === scenarios.length) setIsScenarioManagerOpen(false);
          }}
          onLoad={(id) => {
            loadScenario(id);
            setIsScenarioManagerOpen(false);
          }}
        />
      )}
    </div>
  );
}
