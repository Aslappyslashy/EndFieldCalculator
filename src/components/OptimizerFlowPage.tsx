import React, { useMemo, useEffect, useRef } from 'react';
import {
  Activity,
  Terminal,
  CheckCircle2,
  Clock,
  Cpu,
  TrendingUp,
  ShieldCheck,
  Zap,
  Layout,
  ArrowRight,
  Scale
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import type { OptimizerEvent, OptimizerStage, Item, Recipe, Zone } from '../types';

interface OptimizerFlowPageProps {
  events: OptimizerEvent[];
  isCalculating: boolean;
  items: Item[];
  recipes: Recipe[];
  zones: Zone[];
}

export function OptimizerFlowPage({ events, isCalculating, items, recipes, zones }: OptimizerFlowPageProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const lastEvent = events[events.length - 1];

  // Translation Dictionaries
  const itemNameById = useMemo(() => new Map(items.map(i => [i.id, i.name])), [items]);
  const recipeNameById = useMemo(() => new Map(recipes.map(r => [r.id, r.name])), [recipes]);
  const zoneNameById = useMemo(() => new Map(zones.map(z => [z.id, z.name])), [zones]);

  const translateId = (id: string) => itemNameById.get(id) || recipeNameById.get(id) || zoneNameById.get(id) || id;

  const parseVarName = (name: string): string => {
    if (!name) return '';
    const trimmed = name.trim();

    // r_RecipeID_z_ZoneID
    if (trimmed.startsWith('r_')) {
      const parts = trimmed.split('_z_');
      if (parts.length === 2) {
        const recipeId = parts[0].substring(2);
        const zoneId = parts[1];
        return `[配方] ${recipeNameById.get(recipeId) || recipeId} @ ${zoneNameById.get(zoneId) || zoneId}`;
      }
    }

    // transfer_ItemID_to_ZoneID
    if (trimmed.startsWith('transfer_')) {
      const parts = trimmed.split('_to_');
      if (parts.length === 2) {
        const itemId = parts[0].substring(9);
        const zoneId = parts[1];
        return `[转入] ${itemNameById.get(itemId) || itemId} -> ${zoneNameById.get(zoneId) || zoneId}`;
      }
    }

    // send_ItemID_from_ZoneID
    if (trimmed.startsWith('send_')) {
      const parts = trimmed.split('_from_');
      if (parts.length === 2) {
        const itemId = parts[0].substring(5);
        const zoneId = parts[1];
        return `[产出] ${itemNameById.get(itemId) || itemId} <- ${zoneNameById.get(zoneId) || zoneId}`;
      }
    }

    // lines_out_ItemID_ZoneID
    if (trimmed.startsWith('lines_out_')) {
      const parts = trimmed.split('_');
      // lines_out_itemid_zoneid
      return `[出口线路] ${translateId(parts[2])} @ ${translateId(parts[parts.length - 1])}`;
    }

    // lines_in_ItemID_ZoneID
    if (trimmed.startsWith('lines_in_')) {
      const parts = trimmed.split('_');
      return `[入口线路] ${translateId(parts[2])} @ ${translateId(parts[parts.length - 1])}`;
    }

    // surplus_ItemID
    if (trimmed.startsWith('surplus_')) return `[盈余] ${translateId(trimmed.substring(8))}`;

    // Target
    if (trimmed.startsWith('target_')) return `[目标产额] ${translateId(trimmed.substring(7))}`;

    // machines_${zone.id}
    if (trimmed.startsWith('machines_')) return `[机器位占用] ${translateId(trimmed.substring(9))}`;

    // area_${zone.id}
    if (trimmed.startsWith('area_')) return `[面积占用] ${translateId(trimmed.substring(5))}`;

    return translateId(trimmed);
  };

  // Convert events to chart data
  const chartData = useMemo(() => {
    return events
      .filter(e => e.metrics)
      .map((e, idx) => ({
        step: idx,
        income: e.metrics?.income || 0,
        machines: e.metrics?.machines || 0,
        stage: e.stage,
      }));
  }, [events]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [events]);

  const stageStats = useMemo(() => {
    const stats: Record<OptimizerStage, { count: number, lastMsg: string, duration?: number }> = {
      INIT: { count: 0, lastMsg: '' },
      STAGE_A: { count: 0, lastMsg: '' },
      SPACE_VALIDATION: { count: 0, lastMsg: '' },
      STAGE_B: { count: 0, lastMsg: '' },
      FALLBACK: { count: 0, lastMsg: '' },
      DEROUNDING: { count: 0, lastMsg: '' },
      CONSOLIDATION: { count: 0, lastMsg: '' },
      STAGE_B2: { count: 0, lastMsg: '' },
      SHRINK: { count: 0, lastMsg: '' },
      FINAL: { count: 0, lastMsg: '' },
    };

    events.forEach(e => {
      if (stats[e.stage]) {
        stats[e.stage].count++;
        stats[e.stage].lastMsg = e.message;
      }
    });

    return stats;
  }, [events]);

  const stages: { id: OptimizerStage; label: string; icon: React.ReactNode }[] = [
    { id: 'INIT', label: '初始化 / INIT', icon: <Cpu size={16} /> },
    { id: 'STAGE_A', label: '线性松弛 / LP RELAX', icon: <TrendingUp size={16} /> },
    { id: 'STAGE_B', label: '整数映射 / INTEGER', icon: <Layout size={16} /> },
    { id: 'FALLBACK', label: '回退方案 / FALLBACK', icon: <Zap size={16} /> },
    { id: 'DEROUNDING', label: '去舍入 / FILTER', icon: <ArrowRight size={16} /> },
    { id: 'CONSOLIDATION', label: '产线聚合 / MERGE', icon: <ShieldCheck size={16} /> },
    { id: 'STAGE_B2', label: '精益化 / LEAN', icon: <CheckCircle2 size={16} /> },
    { id: 'FINAL', label: '方案输出 / FINAL', icon: <CheckCircle2 size={16} /> },
  ];

  return (
    <div className="optimizer-flow-page">
      <div className="flow-header">
        <div className="flex items-center gap-3">
          <Activity className={isCalculating ? 'text-accent animate-pulse' : 'text-accent'} size={24} />
          <div>
            <h1>优化引擎执行分析 / ENGINE ANALYSIS</h1>
            <p className="subtitle">实时监控多级 MILP 启发式算法的收敛路径与变量变更</p>
          </div>
        </div>
        {isCalculating && (
          <div className="calc-badge">
            <span className="pulse-dot"></span>
            引擎运行中 // CORE ACTIVE
          </div>
        )}
      </div>

      <div className="flow-grid">
        <aside className="flow-timeline">
          <div className="section-title">
            <Clock size={16} />
            <span>执行流水线 / PIPELINE</span>
          </div>
          <div className="timeline-steps">
            {stages.map((s, idx) => {
              const stat = stageStats[s.id];
              const isActive = lastEvent?.stage === s.id;
              const isCompleted = events.some(e => {
                const sIdx = stages.findIndex(st => st.id === e.stage);
                return sIdx > idx;
              }) || (s.id === 'FINAL' && events.some(e => e.stage === 'FINAL'));

              return (
                <div key={s.id} className={`timeline-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                  <div className="step-icon">
                    {isCompleted ? <CheckCircle2 size={14} /> : s.icon}
                  </div>
                  <div className="step-content">
                    <span className="step-label">{s.label}</span>
                    <span className="step-status">{stat.lastMsg || (isCompleted ? 'Done' : 'Pending')}</span>
                  </div>
                  {stat.count > 1 && <span className="step-count">{stat.count}</span>}
                </div>
              );
            })}
          </div>
        </aside>

        <main className="flow-main">
          <div className="main-top-row">
            <section className="terminal-container">
              <div className="terminal-header">
                <div className="flex items-center gap-2">
                  <Terminal size={14} />
                  <span>调试控制台 / CONSOLE</span>
                </div>
                <div className="terminal-actions">
                  <span className="opacity-50">#LOG_BUFFER: {events.length}</span>
                </div>
              </div>
              <div className="terminal-body" ref={terminalRef}>
                {events.length === 0 ? (
                  <div className="empty-log">... WAITING FOR ENGINE START ...</div>
                ) : (
                  events.map((e, i) => (
                    <div key={i} className={`log-entry stage-${e.stage.toLowerCase()}`}>
                      <span className="log-time">[{new Date(e.timestamp).toLocaleTimeString([], { hour12: false })}]</span>
                      <span className="log-stage">{e.stage.slice(0, 10).padEnd(10)}</span>
                      <span className="log-message">
                        {e.message}
                        {e.change && (
                          <span className={`log-change type-${e.change.type}`}>
                            {' -> '} {parseVarName(e.change.description)}
                          </span>
                        )}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="convergence-graph">
              <div className="graph-header">
                <TrendingUp size={14} />
                <span>收敛路径可视化 / CONVERGENCE</span>
              </div>
              <div className="graph-body">
                {chartData.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--c-accent)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--c-accent)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorMach" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="step" hide />
                      <YAxis yAxisId="left" orientation="left" stroke="var(--c-accent)" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="right" orientation="right" stroke="#8884d8" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#161b22', border: '1px solid #30363d', fontSize: '12px' }}
                        labelStyle={{ color: '#8b949e' }}
                      />
                      <Area yAxisId="left" type="monotone" dataKey="income" name="预估收入" stroke="var(--c-accent)" fillOpacity={1} fill="url(#colorIncome)" />
                      <Area yAxisId="right" type="monotone" dataKey="machines" name="机器数量" stroke="#8884d8" fillOpacity={1} fill="url(#colorMach)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="graph-placeholder">正在采集收敛数据...</div>
                )}
              </div>
            </section>
          </div>

          <section className="metrics-dashboard">
            <div className="metric-card">
              <div className="metric-header">
                <Scale size={14} className="text-accent" />
                <div className="metric-label">预估产值 / EST INCOME</div>
              </div>
              <div className="metric-value highlight">
                ${lastEvent?.metrics?.income.toFixed(2) || '0.00'}
                <span className="metric-unit">/min</span>
              </div>
              <div className="metric-trend">
                {chartData.length > 2 && chartData[chartData.length - 1].income > chartData[0].income ? '▲ Improving' : '― Stable'}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-header">
                <Layout size={14} className="text-accent" />
                <div className="metric-label">机器单位 / MACHINE UNITS</div>
              </div>
              <div className="metric-value">
                {lastEvent?.metrics?.machines || 0}
                <span className="metric-unit">SETS</span>
              </div>
              <div className="metric-trend">
                Total load across all zones
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-header">
                <ShieldCheck size={14} className={lastEvent?.metrics?.feasible ? 'text-success' : 'text-error'} />
                <div className="metric-label">LP可行性 / LP FEASIBILITY</div>
              </div>
              <div className={`metric-value ${lastEvent?.metrics?.feasible ? 'text-success' : 'text-error'}`}>
                {lastEvent?.metrics?.feasible ? 'PASS' : (lastEvent ? 'FAIL' : '-')}
              </div>
              <div className="metric-trend">
                {lastEvent?.metrics?.feasible ? 'LP constraints satisfied' : 'Optimization in progress'}
              </div>
            </div>
          </section>
        </main>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .optimizer-flow-page {
          display: flex;
          flex-direction: column;
          gap: 15px;
          height: calc(100vh - 120px);
          animation: fade-in 0.4s ease-out;
          color: #e6edf3;
        }

        .flow-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 5px;
        }

        .flow-header h1 {
          font-size: 1.1rem;
          margin: 0;
          color: var(--c-text-bright);
          letter-spacing: 0.1em;
          font-weight: 800;
        }

        .flow-header .subtitle {
          font-size: 0.7rem;
          color: var(--c-text-dim);
          margin: 2px 0 0 0;
        }

        .calc-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(230, 194, 0, 0.1);
          color: var(--c-accent);
          padding: 6px 12px;
          border: 1px solid var(--c-accent);
          font-size: 0.65rem;
          font-weight: 800;
          font-family: var(--font-mono);
        }

        .pulse-dot {
          width: 6px;
          height: 6px;
          background: var(--c-accent);
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        }

        .flow-grid {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 15px;
          flex: 1;
          min-height: 0;
        }

        .flow-timeline {
          background: rgba(20, 20, 20, 0.4);
          border: 1px solid var(--c-border);
          padding: 15px;
          overflow-y: auto;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.7rem;
          font-weight: 800;
          color: var(--c-text-dim);
          margin-bottom: 15px;
          text-transform: uppercase;
        }

        .timeline-steps {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .timeline-item {
          display: flex;
          gap: 10px;
          padding: 10px;
          background: rgba(255,255,255,0.02);
          border: 1px solid transparent;
          transition: all 0.2s;
          position: relative;
        }

        .timeline-item.active {
          background: rgba(230, 194, 0, 0.1);
          border-color: var(--c-accent);
        }

        .timeline-item.completed {
          opacity: 0.6;
        }

        .step-icon {
          width: 24px;
          height: 24px;
          background: rgba(255,255,255,0.05);
          color: var(--c-text-dim);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .timeline-item.active .step-icon {
          background: var(--c-accent);
          color: #000;
        }

        .step-content {
          display: flex;
          flex-direction: column;
          min-width: 0;
          justify-content: center;
        }

        .step-label {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--c-text-bright);
        }

        .step-status {
          font-size: 0.6rem;
          color: var(--c-text-dim);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .step-count {
          position: absolute;
          right: 5px;
          top: 5px;
          font-size: 0.6rem;
          color: var(--c-accent);
          font-family: var(--font-mono);
          font-weight: 800;
        }

        .flow-main {
          display: flex;
          flex-direction: column;
          gap: 15px;
          min-width: 0;
        }

        .main-top-row {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 15px;
          flex: 1;
          min-height: 0;
        }

        .terminal-container {
          background: #050505;
          display: flex;
          flex-direction: column;
          border: 1px solid #30363d;
          min-height: 0;
        }

        .terminal-header {
          padding: 6px 12px;
          background: #0d1117;
          border-bottom: 1px solid #30363d;
          display: flex;
          justify-content: space-between;
          font-size: 0.6rem;
          color: #8b949e;
          font-weight: 800;
          font-family: var(--font-mono);
        }

        .terminal-body {
          flex: 1;
          padding: 12px;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          overflow-y: auto;
          line-height: 1.4;
        }

        .log-entry {
          margin-bottom: 4px;
          display: flex;
          gap: 8px;
        }

        .log-time { color: #484f58; flex-shrink: 0; }
        .log-stage { color: #58a6ff; flex-shrink: 0; font-weight: 800; }
        .log-message { color: #c9d1d9; flex: 1; }
        .log-change { color: var(--c-accent); font-weight: 800; }
        
        .log-entry.stage-derounding .log-message { color: #ffa657; }
        .log-entry.stage-consolidation .log-message { color: #d2a8ff; }
        .log-entry.stage-final .log-message { color: #3fb950; font-weight: 800; }

        .convergence-graph {
          background: rgba(10, 10, 10, 0.6);
          border: 1px solid var(--c-border);
          display: flex;
          flex-direction: column;
        }

        .graph-header {
          padding: 8px 12px;
          border-bottom: 1px solid var(--c-border);
          font-size: 0.65rem;
          font-weight: 800;
          color: var(--c-text-dim);
          display: flex;
          align-items: center;
          gap: 8px;
          text-transform: uppercase;
        }

        .graph-body {
          flex: 1;
          padding: 10px;
          min-height: 0;
        }

        .graph-placeholder {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--c-text-dim);
          font-size: 0.8rem;
          font-style: italic;
        }

        .metrics-dashboard {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          flex-shrink: 0;
        }

        .metric-card {
          background: rgba(20, 20, 20, 0.8);
          padding: 15px;
          border: 1px solid var(--c-border);
          position: relative;
        }

        .metric-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .metric-label {
          font-size: 0.6rem;
          color: var(--c-text-dim);
          text-transform: uppercase;
          font-weight: 800;
          letter-spacing: 0.1em;
        }

        .metric-value {
          font-size: 1.4rem;
          font-weight: 900;
          font-family: var(--font-mono);
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .metric-value.highlight {
          color: var(--c-accent);
        }

        .metric-unit {
          font-size: 0.7rem;
          color: var(--c-text-dim);
        }

        .metric-trend {
          font-size: 0.6rem;
          color: var(--c-text-dim);
          margin-top: 5px;
          opacity: 0.6;
        }

        .empty-log {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #21262d;
          font-size: 1rem;
          font-weight: 900;
          letter-spacing: 0.2em;
        }

        @keyframes pulse {
          0% { opacity: 0.3; }
          50% { opacity: 1; }
          100% { opacity: 0.3; }
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      ` }} />
    </div>
  );
}
