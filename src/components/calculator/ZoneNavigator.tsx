import type { CalculatorResult, Item } from '../../types';

interface ZoneNavigatorProps {
  selectedZoneId: string;
  onSelectZone: (id: string) => void;
  result: CalculatorResult | null;
  items: Item[];
  effectiveConstraints: any[];
}

export function ZoneNavigator({
  selectedZoneId,
  onSelectZone,
  result,
  items,
  effectiveConstraints
}: ZoneNavigatorProps) {
  const getItemName = (id: string) => items.find(i => i.id === id)?.name || '未知物品';

  return (
    <aside className="result-zone-list">
      <nav className="zone-nav">
        <button
          className={`zone-nav-item ${selectedZoneId === 'config' ? 'active' : ''}`}
          onClick={() => onSelectZone('config')}
        >
          <span className="nav-dot"></span>
          <div className="nav-info">
            <span className="zone-name">全局配置 / CONFIG</span>
            <span className="zone-meta">优化策略与产出目标</span>
          </div>
        </button>

        {result && result.zoneResults.map(zr => (
          <button
            key={zr.zone.id}
            className={`zone-nav-item ${selectedZoneId === zr.zone.id ? 'active' : ''}`}
            onClick={() => onSelectZone(zr.zone.id)}
          >
            <span className="nav-dot"></span>
            <div className="nav-info">
              <span className="zone-name">{zr.zone.name}</span>
              <div className="zone-meta flex flex-col gap-0.5">
                <span>出口: {zr.outputPortsUsed.toFixed(0)}/{zr.zone.outputPorts}</span>
                {zr.zone.areaLimit && (
                  <span className={zr.areaUsed && zr.areaUsed > zr.zone.areaLimit ? 'text-error' : ''}>
                    面积: {zr.areaUsed?.toFixed(0)}/{zr.zone.areaLimit}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </nav>

      {result && (
        <div className="summary-mini-card">
          <div className="summary-item">
            <span className="label">总预期产值</span>
            <span className="value highlight">${result.totalIncome.toFixed(2)} /min</span>
          </div>
          {result.globalResourceUsage.length > 0 && (
            <div className="summary-item">
              <span className="label">资源用量</span>
              <div className="resource-usage-list">
                {result.globalResourceUsage.map((u, i) => {
                  const constraint = effectiveConstraints.find(c => c.itemId === u.itemId);
                  const max = constraint?.maxRate || 100;
                  const pct = (u.rate / max) * 100;
                  return (
                    <div key={i} className="resource-usage-item">
                      <span>{getItemName(u.itemId)}</span>
                      <span className={pct > 95 ? 'warning' : ''}>{u.rate.toFixed(1)}/{max} ({pct.toFixed(0)}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {result.warnings.length > 0 && (
            <div className="summary-item warnings">
              <span className="label">警告</span>
              <div className="warning-list">
                {result.warnings.slice(0, 5).map((w, i) => (
                  <div key={i} className="warning-item">{w}</div>
                ))}
                {result.warnings.length > 5 && (
                  <div className="warning-item">...还有 {result.warnings.length - 5} 条警告</div>
                )}
              </div>
            </div>
          )}

          {!result.feasible && result.unmetTargets.length > 0 && (
            <div className="summary-item warnings">
              <span className="label">未达成目标</span>
              <div className="warning-list">
                {result.unmetTargets.slice(0, 5).map((t, i) => (
                  <div key={i} className="warning-item">
                    {getItemName(t.itemId)}: 缺口 {t.shortfall.toFixed(3)} /min
                  </div>
                ))}
                {result.unmetTargets.length > 5 && (
                  <div className="warning-item">...还有 {result.unmetTargets.length - 5} 项未显示</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
