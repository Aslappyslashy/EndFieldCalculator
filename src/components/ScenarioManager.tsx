import { useState } from 'react';
import { Trash2, X, CheckSquare, Square, AlertCircle } from 'lucide-react';
import type { Scenario } from '../types';

interface ScenarioManagerProps {
    scenarios: Scenario[];
    activeId: string | null;
    onClose: () => void;
    onDelete: (ids: string[]) => void;
    onLoad: (id: string) => void;
}

export function ScenarioManager({ scenarios, activeId, onClose, onDelete, onLoad }: ScenarioManagerProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === scenarios.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(scenarios.map(s => s.id)));
        }
    };

    const handleDelete = () => {
        if (selectedIds.size === 0) return;
        setIsConfirmingDelete(true);
    };

    const confirmDelete = () => {
        onDelete(Array.from(selectedIds));
        setSelectedIds(new Set());
        setIsConfirmingDelete(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-[#1a1c1e] border border-[#30363d] rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-[#30363d] flex justify-between items-center">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                        <Trash2 size={20} className="text-accent" />
                        方案管理 / SCENARIO MANAGER
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 bg-[#0d1117]/50 border-b border-[#30363d] flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleSelectAll}
                            className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
                        >
                            {selectedIds.size === scenarios.length && scenarios.length > 0 ? <CheckSquare size={18} className="text-accent" /> : <Square size={18} />}
                            全选
                        </button>
                        <span className="text-sm text-gray-400">已选择 {selectedIds.size} 项</span>
                    </div>

                    <button
                        onClick={handleDelete}
                        disabled={selectedIds.size === 0}
                        className="btn btn-small btn-danger flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Trash2 size={14} /> 批量删除
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {scenarios.length === 0 ? (
                        <div className="py-12 text-center text-gray-500">
                            暂无方案。
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {scenarios.map(scenario => (
                                <div
                                    key={scenario.id}
                                    onClick={() => toggleSelect(scenario.id)}
                                    className={`group flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${selectedIds.has(scenario.id)
                                            ? 'bg-accent/10 border-accent/30'
                                            : 'bg-white/5 border-transparent hover:border-white/10'
                                        }`}
                                >
                                    <div className={`transition-colors ${selectedIds.has(scenario.id) ? 'text-accent' : 'text-gray-500'}`}>
                                        {selectedIds.has(scenario.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-medium truncate">{scenario.name}</span>
                                            {activeId === scenario.id && (
                                                <span className="px-1.5 py-0.5 rounded bg-accent/20 text-accent text-[10px] font-bold uppercase tracking-wider">
                                                    Current
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                            最后修改: {new Date(scenario.lastModified).toLocaleString()}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onLoad(scenario.id);
                                        }}
                                        className="btn btn-small opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        切换至此
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {isConfirmingDelete && (
                    <div className="p-4 bg-error/10 border-t border-error/20 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-error text-sm">
                            <AlertCircle size={18} />
                            <span>确定要删除所选的 {selectedIds.size} 个方案吗？此操作无法撤销。</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setIsConfirmingDelete(false)} className="btn btn-small">取消</button>
                            <button onClick={confirmDelete} className="btn btn-small btn-danger">确定删除</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
