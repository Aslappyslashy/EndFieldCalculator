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
  solverType: 'current' | 'python';
  onSolverTypeChange: (val: 'current' | 'python') => void;
  timeLimit: number;
  onTimeLimitChange: (val: number) => void;
  pythonSolverAvailable: boolean | null;
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
  solverType,
  onSolverTypeChange,
  timeLimit,
  onTimeLimitChange,
  pythonSolverAvailable,
  isCalculating,
  elapsedTime,
  error
}: ConfigurationPanelProps & { isCalculating?: boolean; elapsedTime?: number }) {


  return (
    <div className="calculator-config-details">
      
      {/* 1. Top Control Bar: Mode & Solver */}
      <div className="config-top-bar">
        <div className="mode-selector-group">
          <label className="section-label">优化目标</label>
          <div className="mode-tabs">
            <button
              className={`mode-tab ${optimizationMode === 'maxIncome' ? 'active' : ''}`}
              onClick={() => onOptimizationModeChange('maxIncome')}
              title="忽略端口压力，追求理论最大产值"
            >
              <TrendingUp size={14} />
              <span>产值最大化</span>
            </button>
            <button
              className={`mode-tab ${optimizationMode === 'balanced' ? 'active' : ''}`}
              onClick={() => onOptimizationModeChange('balanced')}
              title="平衡产值与物流复杂度"
            >
              <Scale size={14} />
              <span>平衡模式</span>
            </button>
            <button
              className={`mode-tab ${optimizationMode === 'minTransfers' ? 'active' : ''}`}
              onClick={() => onOptimizationModeChange('minTransfers')}
              title="最少跨区传输，简化物流"
            >
              <Zap size={14} />
              <span>链路精简</span>
            </button>
          </div>
        </div>

        <div className="solver-selector-group">
          <label className="section-label">
            <span>求解核心</span>
            {solverType === 'python' && (
              <span className={`status-dot ${pythonSolverAvailable === true ? 'online' : 'offline'}`} />
            )}
          </label>
          <div className="solver-tabs">
            <button
              className={`solver-tab ${solverType === 'current' ? 'active' : ''}`}
              onClick={() => onSolverTypeChange('current')}
            >
              WASM
            </button>
            <button
              className={`solver-tab ${solverType === 'python' ? 'active' : ''}`}
              onClick={() => onSolverTypeChange('python')}
            >
              Python
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Config Grid: Targets vs Parameters */}
      <div className="config-main-layout">
        
        {/* Left Column: Targets (Primary Input) */}
        <section className="calculator-section section-targets">
          <div className="section-header">
            <h3>预期产出目标</h3>
            <button
              onClick={onAddTarget}
              className="btn-icon-text text-accent"
            >
              <Plus size={14} /> 添加
            </button>
          </div>
          
          <div className="target-list-scroll">
            {targets.length === 0 && (
              <div className="empty-placeholder">暂无目标，请添加产物</div>
            )}
            {targets.map((target, index) => (
              <div key={index} className="target-row">
                <select
                  value={target.itemId}
                  onChange={(e) => onUpdateTarget(index, 'itemId', e.target.value)}
                  className="item-select"
                >
                  <optgroup label="可出售产物">
                    {sellableItems.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </optgroup>
                  <optgroup label="中间产物">
                    {craftedItems.filter((i) => i.price === 0).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </optgroup>
                </select>
                <div className="rate-input-wrapper">
                  <input
                    type="number"
                    step="0.1"
                    value={target.targetRate}
                    onChange={(e) => onUpdateTarget(index, 'targetRate', e.target.value)}
                  />
                  <span className="unit">/min</span>
                </div>
                <button
                  onClick={() => onRemoveTarget(index)}
                  className="btn-remove"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Right Column: Constraints & Advanced Params */}
        <div className="config-right-col">
          
          {/* Advanced Parameters (Compact) */}
          <section className="calculator-section section-params">
            <h3>算法参数微调</h3>
            <div className="params-grid">
              
              {optimizationMode === 'balanced' && (
                <div className="param-item">
                  <label>传输惩罚: {transferPenalty.toFixed(2)}</label>
                  <input
                    type="range" min="0" max="1" step="0.05"
                    value={transferPenalty}
                    onChange={(e) => onTransferPenaltyChange(parseFloat(e.target.value))}
                  />
                </div>
              )}

              <div className="param-item">
                <label>产线聚合: {consolidationWeight.toFixed(2)}</label>
                <input
                  type="range" min="0" max="1" step="0.01"
                  value={consolidationWeight}
                  onChange={(e) => onConsolidationWeightChange(parseFloat(e.target.value))}
                />
              </div>

              <div className="param-item">
                <label>整数倾向: {machineWeight.toFixed(2)}</label>
                <input
                  type="range" min="0" max="1" step="0.005"
                  value={machineWeight}
                  onChange={(e) => onMachineWeightChange(parseFloat(e.target.value))}
                />
              </div>

              <div className="param-item">
                <label>求解时限: {timeLimit}s</label>
                <input
                  type="range" min="5" max="120" step="5"
                  value={timeLimit}
                  onChange={(e) => onTimeLimitChange(parseInt(e.target.value))}
                />
              </div>
            </div>
          </section>

          {/* Resource Constraints (Grid) */}
          <section className="calculator-section section-constraints">
            <h3>全局资源限制</h3>
            <div className="constraints-grid">
              {effectiveConstraints.map((constraint, index) => {
                const resource = rawResources.find((r) => r.id === constraint.itemId);
                return (
                  <div key={constraint.itemId} className="constraint-item">
                    <label>{resource?.name}</label>
                    <input
                      type="number"
                      value={constraint.maxRate}
                      onChange={(e) => onUpdateConstraint(index, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          </section>

        </div>
      </div>

      {/* 3. Action Bar (Sticky Bottom) */}
      <div className="action-bar-compact">
        <button
          onClick={onCalculate}
          disabled={isCalculating}
          className={`btn-calculate ${isCalculating ? 'calculating' : ''}`}
        >
          {isCalculating ? (
            <>
              <div className="spinner-sm"></div>
              <span>计算中 ({elapsedTime?.toFixed(1)}s)</span>
            </>
          ) : (
            <>
              <TrendingUp size={18} />
              <span>生成方案</span>
            </>
          )}
        </button>
        {error && <div className="error-toast">{error}</div>}
      </div>

    </div>
  );
}

