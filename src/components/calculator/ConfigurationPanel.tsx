import { TrendingUp, Scale, Zap, Plus, X } from 'lucide-react';
import type { ProductionTarget, ResourceConstraint, OptimizationMode, Item } from '../../types';

interface ConfigurationPanelProps {
  optimizationMode: OptimizationMode;
  onOptimizationModeChange: (mode: OptimizationMode) => void;
  transferPenalty: number;
  onTransferPenaltyChange: (val: number) => void;
  consolidationWeight: number;
  onConsolidationWeightChange: (val: number) => void;
  machineWeight: number;
  onMachineWeightChange: (val: number) => void;
  targets: ProductionTarget[];
  onAddTarget: () => void;
  onUpdateTarget: (index: number, field: keyof ProductionTarget, value: string) => void;
  onRemoveTarget: (index: number) => void;
  effectiveConstraints: ResourceConstraint[];
  onUpdateConstraint: (index: number, value: string) => void;
  sellableItems: Item[];
  craftedItems: Item[];
  rawResources: Item[];
  onCalculate: () => void;
  error: string | null;
}

export function ConfigurationPanel({
  optimizationMode,
  onOptimizationModeChange,
  transferPenalty,
  onTransferPenaltyChange,
  consolidationWeight,
  onConsolidationWeightChange,
  machineWeight,
  onMachineWeightChange,
  targets,
  onAddTarget,
  onUpdateTarget,
  onRemoveTarget,
  effectiveConstraints,
  onUpdateConstraint,
  sellableItems,
  craftedItems,
  rawResources,
  onCalculate,
  error
}: ConfigurationPanelProps) {
  return (
    <div className="calculator-config-details">
      <div className="config-grid-v2">
        <section className="calculator-section">
          <h3>优化策略模式</h3>
          <div className="radio-group vertical">
            <label className={optimizationMode === 'maxIncome' ? 'selected' : ''}>
              <input
                type="radio"
                checked={optimizationMode === 'maxIncome'}
                onChange={() => onOptimizationModeChange('maxIncome')}
              />
              <div className="option-content">
                <TrendingUp size={16} className="text-accent" />
                <span className="radio-label">产值最大化 (Ignore Port Pressure)</span>
              </div>
            </label>
            <label className={optimizationMode === 'balanced' ? 'selected' : ''}>
              <input
                type="radio"
                checked={optimizationMode === 'balanced'}
                onChange={() => onOptimizationModeChange('balanced')}
              />
              <div className="option-content">
                <Scale size={16} className="text-accent" />
                <span className="radio-label">平衡模式 (Balanced)</span>
              </div>
            </label>
            <label className={optimizationMode === 'minTransfers' ? 'selected' : ''}>
              <input
                type="radio"
                checked={optimizationMode === 'minTransfers'}
                onChange={() => onOptimizationModeChange('minTransfers')}
              />
              <div className="option-content">
                <Zap size={16} className="text-accent" />
                <span className="radio-label">链路精简 (Min Logistics)</span>
              </div>
            </label>
          </div>

          {optimizationMode === 'balanced' && (
            <div className="penalty-control-v2">
              <label>传输惩罚系数: {transferPenalty.toFixed(2)}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={transferPenalty}
                onChange={(e) => onTransferPenaltyChange(parseFloat(e.target.value))}
              />
            </div>
          )}

          <div className="penalty-control-v2 mt-2">
            <label title="加强此系数可以减少同种机器分散在多个地块的情况">
              产线聚合权重: {consolidationWeight.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={consolidationWeight}
              onChange={(e) => onConsolidationWeightChange(parseFloat(e.target.value))}
            />
          </div>

          <div className="penalty-control-v2 mt-2">
            <label title="加强此系数可以尽可能减少总机器数量（倾向于跑满已有的机器）">
              整数倾向权重: {machineWeight.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.005"
              value={machineWeight}
              onChange={(e) => onMachineWeightChange(parseFloat(e.target.value))}
            />
          </div>
        </section>

        <section className="calculator-section">
          <h3>预期产出目标</h3>
          <div className="target-list">
            {targets.map((target, index) => (
              <div key={index} className="input-row compact">
                <select
                  value={target.itemId}
                  onChange={(e) => onUpdateTarget(index, 'itemId', e.target.value)}
                >
                  <optgroup label="可出售产物">
                    {sellableItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="中间产物">
                    {craftedItems
                      .filter((i) => i.price === 0)
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                  </optgroup>
                </select>
                <input
                  type="number"
                  step="0.1"
                  value={target.targetRate}
                  onChange={(e) => onUpdateTarget(index, 'targetRate', e.target.value)}
                />
                <span className="unit">/min</span>
                <button
                  onClick={() => onRemoveTarget(index)}
                  className="btn btn-icon btn-danger"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={onAddTarget}
              className="btn btn-small btn-all btn-primary flex items-center justify-center gap-1"
            >
              <Plus size={14} /> 添加目标产物
            </button>
          </div>
        </section>

        <section className="calculator-section">
          <h3>全局资源限制</h3>
          <div className="resource-constraints-v2">
            {effectiveConstraints.map((constraint, index) => {
              const resource = rawResources.find((r) => r.id === constraint.itemId);
              return (
                <div key={constraint.itemId} className="resource-field">
                  <label>{resource?.name}</label>
                  <div className="input-group">
                    <input
                      type="number"
                      value={constraint.maxRate}
                      onChange={(e) => onUpdateConstraint(index, e.target.value)}
                    />
                    <span>/min</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="action-bar-v2">
        <button
          onClick={onCalculate}
          className="btn btn-primary btn-large btn-full flex items-center justify-center gap-2"
        >
          <TrendingUp size={20} /> {/* Using TrendingUp as a generic action icon */}
          <span>生成工业布局方案</span>
        </button>
        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  );
}
