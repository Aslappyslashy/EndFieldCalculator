import { useState, useEffect } from 'react';
import {
  BarChart3,
  Layers,
  Package,
  Cpu,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Wifi,
  Activity
} from 'lucide-react';
import { useDatabase } from './hooks/useDatabase';
import { useScenarios } from './hooks/useScenarios';
import { ItemManager } from './components/ItemManager';
import { MachineManager } from './components/MachineManager';
import { RecipeManager } from './components/RecipeManager';
import { ZoneManager } from './components/ZoneManager';
import { useItems, useRecipes, useZones } from './hooks/useDatabase';
import { Calculator } from './components/Calculator';
import { OptimizerFlowPage } from './components/OptimizerFlowPage';
import { AdvancedBackground } from './components/AdvancedBackground';
import type {
  OptimizerEvent,
  CalculatorResult,
  ProductionTarget,
  ResourceConstraint,
  OptimizationMode
} from './types';
import './App.css';

type Tab = 'calculator' | 'zones' | 'items' | 'machines' | 'recipes' | 'optimizer';

function App() {
  const { isLoading, error, isInitialized } = useDatabase();
  const { items } = useItems();
  const { recipes } = useRecipes();
  const { zones } = useZones();
  const [activeTab, setActiveTab] = useState<Tab>('calculator');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Lifted Calculator state
  const scenarioHook = useScenarios();
  const { activeScenario } = scenarioHook;

  const [targets, setTargets] = useState<ProductionTarget[]>([]);
  const [constraints, setConstraints] = useState<ResourceConstraint[]>([]);
  const [optimizationMode, setOptimizationMode] = useState<OptimizationMode>('balanced');
  const [transferPenalty, setTransferPenalty] = useState(0.5);
  const [consolidationWeight, setConsolidationWeight] = useState(0.05);
  const [machineWeight, setMachineWeight] = useState(0.01);
  const [timeLimit, setTimeLimit] = useState(30);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});

  const [calculatorResult, setCalculatorResult] = useState<CalculatorResult | null>(null);
  const [optimizerEvents, setOptimizerEvents] = useState<OptimizerEvent[]>([]);
  const [isOptimizerCalculating, setIsOptimizerCalculating] = useState(false);
  const [solverType, setSolverType] = useState<'current' | 'python'>('current');

  // Sync state from active scenario (lifted from Calculator)
  useEffect(() => {
    if (activeScenario) {
      setTargets(activeScenario.data.targets);
      setConstraints(activeScenario.data.constraints);
      setOptimizationMode(activeScenario.data.optimizationMode || 'balanced');
      setTransferPenalty(activeScenario.data.transferPenalty ?? 0.5);
      setConsolidationWeight(activeScenario.data.consolidationWeight ?? 0.05);
      setMachineWeight(activeScenario.data.machineWeight ?? 0.01);
      setTimeLimit(activeScenario.data.timeLimit ?? 30);
      setNodePositions(activeScenario.data.nodePositions || {});
    }
  }, [activeScenario]);

  if (isLoading) {
    return (
      <div className="app loading">
        <AdvancedBackground />
        <div className="loading-content">
          <div className="loading-spinner">正在初始化协议数据库...</div>
          <div className="loading-bar"><div className="loading-bar-fill"></div></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app error">
        <AdvancedBackground />
        <div className="error-panel">
          <h2>数据库同步异常</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="btn">重新连接</button>
        </div>
      </div>
    );
  }

  if (!isInitialized) return null;

  return (
    <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <AdvancedBackground />

      <div className="app-container">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="logo">{sidebarCollapsed ? 'EF' : 'ENDFIELD'}</div>
            {!sidebarCollapsed && <div className="sub-logo">终末地集成工业优化设计</div>}
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          <nav className="nav-menu">
            <button
              className={`nav-item ${activeTab === 'calculator' ? 'active' : ''}`}
              onClick={() => setActiveTab('calculator')}
              title="生产优化方案"
            >
              <BarChart3 size={20} className="nav-icon" />
              {!sidebarCollapsed && <span className="nav-text">生产优化方案</span>}
              {!sidebarCollapsed && <span className="nav-dot"></span>}
            </button>
            <button
              className={`nav-item ${activeTab === 'zones' ? 'active' : ''}`}
              onClick={() => setActiveTab('zones')}
              title="地块区域管理"
            >
              <Layers size={20} className="nav-icon" />
              {!sidebarCollapsed && <span className="nav-text">地块区域管理</span>}
              {!sidebarCollapsed && <span className="nav-dot"></span>}
            </button>
              <button
                className={`nav-item ${activeTab === 'items' ? 'active' : ''}`}
                onClick={() => setActiveTab('items')}
                title="工业协议管理"
              >
                <Package size={20} className="nav-icon" />
                {!sidebarCollapsed && <span className="nav-text">工业协议管理</span>}
                {!sidebarCollapsed && <span className="nav-dot"></span>}
              </button>

            <button
              className={`nav-item ${activeTab === 'machines' ? 'active' : ''}`}
              onClick={() => setActiveTab('machines')}
              title="工业设备库"
            >
              <Cpu size={20} className="nav-icon" />
              {!sidebarCollapsed && <span className="nav-text">工业设备库</span>}
              {!sidebarCollapsed && <span className="nav-dot"></span>}
            </button>
            <button
              className={`nav-item ${activeTab === 'recipes' ? 'active' : ''}`}
              onClick={() => setActiveTab('recipes')}
              title="加工配方库"
            >
              <BookOpen size={20} className="nav-icon" />
              {!sidebarCollapsed && <span className="nav-text">加工配方库</span>}
              {!sidebarCollapsed && <span className="nav-dot"></span>}
            </button>
              <button
                className={`nav-item ${activeTab === 'optimizer' ? 'active' : ''}`}
                onClick={() => setActiveTab('optimizer')}
                title="DEBUG"
              >
                <Activity size={20} className={`nav-icon ${isOptimizerCalculating ? 'text-accent animate-pulse' : ''}`} />
                {!sidebarCollapsed && <span className="nav-text">DEBUG</span>}
                {isOptimizerCalculating && !sidebarCollapsed && (
                   <span className="ml-auto text-[10px] bg-accent/20 text-accent px-1 rounded animate-pulse">RUNNING</span>
                )}
                {!sidebarCollapsed && !isOptimizerCalculating && <span className="nav-dot"></span>}
              </button>

          </nav>

          <div className="sidebar-footer">
            <div className="status-indicator">
              <Wifi size={sidebarCollapsed ? 18 : 14} color="var(--c-success)" />
              {!sidebarCollapsed && <span>终端连接正常</span>}
            </div>
          </div>
        </aside>

        <main className="content-area">
          <header className="content-header">
            <div className="protocol-status">
              <span className="accent">SYSTEM // </span>
              <span>{activeTab.toUpperCase()}</span>
            </div>
          </header>

          <div className={`tab-content tab-${activeTab}`}>
            {activeTab === 'calculator' && (
              <Calculator
                // Config State
                targets={targets}
                setTargets={setTargets}
                constraints={constraints}
                setConstraints={setConstraints}
                optimizationMode={optimizationMode}
                setOptimizationMode={setOptimizationMode}
                transferPenalty={transferPenalty}
                setTransferPenalty={setTransferPenalty}
                consolidationWeight={consolidationWeight}
                setConsolidationWeight={setConsolidationWeight}
                 machineWeight={machineWeight}
                 setMachineWeight={setMachineWeight}
                 timeLimit={timeLimit}
                 setTimeLimit={setTimeLimit}
                 nodePositions={nodePositions}

                setNodePositions={setNodePositions}
                solverType={solverType}
                setSolverType={setSolverType}

                // Result State
                result={calculatorResult}
                setResult={setCalculatorResult}

                // Scenario Hook
                scenarioHook={scenarioHook}

                isCalculating={isOptimizerCalculating}
                onStartCalculation={() => {
                  setOptimizerEvents([]);
                  setIsOptimizerCalculating(true);
                }}
                onCalculationProgress={(event: OptimizerEvent) => {
                  setOptimizerEvents(prev => [...prev, event]);
                }}
                onCalculationComplete={() => {
                  setIsOptimizerCalculating(false);
                }}
              />
            )}
            {activeTab === 'zones' && <ZoneManager />}
            {activeTab === 'items' && <ItemManager />}
            {activeTab === 'machines' && <MachineManager />}
            {activeTab === 'recipes' && <RecipeManager />}
            {activeTab === 'optimizer' && (
              <OptimizerFlowPage
                events={optimizerEvents}
                isCalculating={isOptimizerCalculating}
                items={items}
                recipes={recipes}
                zones={zones}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
