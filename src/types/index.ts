// Core data types for the Endfield Calculator

export interface Item {
  id: string;
  name: string;
  price: number; // Selling price per unit
  isRawResource: boolean; // True if this is a natural resource
  baseProductionRate?: number; // For raw resources: units per minute (game limit)
}

export interface Machine {
  id: string;
  name: string;
  description: string;
  area?: number; // Optional footprint area (e.g. 6x4 => 24)
}

export interface Recipe {
  id: string;
  machineId: string;
  name: string;
  outputItemId: string;
  outputAmount: number; // Units produced per cycle
  craftingTime: number; // Seconds per cycle
  inputs: RecipeInput[];
}

export interface RecipeInput {
  itemId: string;
  amount: number; // Units consumed per cycle
}

// ============================================
// ZONE SYSTEM
// ============================================

export interface Zone {
  id: string;
  name: string;
  outputPorts: number;        // LIMITED - ports to extract FROM global pool (default ~6)
  inputPorts: number;         // PLENTY - ports to send TO global pool (default ~32)
  portThroughput: number;     // Items per minute per port (default 30 = 0.5/sec)
  machineSlots?: number;      // Optional space limit (total machines allowed)
  areaLimit?: number;         // Optional area limit (sum(machineCount * machine.area))
}

// Which recipes are assigned to which zone, with how many machines
export interface ZoneAssignment {
  zoneId: string;
  recipeId: string;
  machineCount: number;       // Integer number of machines
  utilization: number;        // Effective machines running (0..machineCount)
  requiredRate: number;       // The rate we actually need (from LP solution)
  actualRate: number;         // The rate we actually get (from integer machines)
  excessRate: number;         // actualRate - requiredRate (can be negative with throttling)
  locked?: boolean;           // If true, optimizer won't move this assignment
}

// Tracks item flow between zones/global pool
export interface ItemFlow {
  itemId: string;
  fromZoneId: string | null;  // null = global pool (raw materials)
  toZoneId: string | null;    // null = global pool (sending to storage)
  rate: number;               // Items per minute
}

// ============================================
// CALCULATOR TYPES
// ============================================

export interface ProductionTarget {
  itemId: string;
  targetRate: number; // Units per minute desired
}

export interface ResourceConstraint {
  itemId: string;
  maxRate: number; // Maximum units per minute available (global limit)
}

export interface CalculatorInput {
  targets: ProductionTarget[];
  resourceConstraints: ResourceConstraint[];
  zones: Zone[];
  lockedAssignments?: ZoneAssignment[];  // User-locked assignments optimizer must respect
  optimizationMode: 'maxIncome' | 'minTransfers' | 'balanced';
  transferPenalty?: number;  // For 'balanced' mode: how much to penalize transfers (0-1)
  consolidationWeight?: number; // Penalty for activating a recipe in a zone (0-1)
  machineWeight?: number; // Penalty per machine in Stage A (0-1)
}

export interface ZoneResult {
  zone: Zone;
  assignments: ZoneAssignment[];
  outputPortsUsed: number;    // How many output ports consumed (the bottleneck)
  inputPortsUsed: number;     // How many input ports consumed
  totalMachines: number;
  itemsFromPool: { itemId: string; rate: number }[];  // What this zone extracts
  itemsToPool: { itemId: string; rate: number }[];    // What this zone sends out
  itemsSold: { itemId: string; rate: number }[];      // What this zone sells (sent to pool; consumes input ports)
  areaUsed?: number;          // Sum(machineCount * machine.area) if available
}

export interface CalculatorResult {
  feasible: boolean;
  // Raw LP solver feasibility (ignores unmetTargets check)
  solverFeasible?: boolean;
  // Best-effort explanation when feasible=false
  infeasibleReason?: 'solver_infeasible' | 'unmet_targets' | 'unknown';
  zoneResults: ZoneResult[];
  totalIncome: number;        // Per minute
  totalOutputPortsUsed: number;
  globalResourceUsage: { itemId: string; rate: number }[];  // Raw material consumption
  itemFlows: ItemFlow[];      // All inter-zone flows for visualization
  unmetTargets: { itemId: string; shortfall: number }[];
  warnings: string[];

  // Comparison metrics
  theoreticalMaxIncome?: number;  // Income if zones were ignored
  transferOverhead: number;       // Extra port usage due to inter-zone transfers

  // Debugging & Flow
  telemetry?: OptimizerTelemetry;
}

export type OptimizerStage =
  | 'INIT'
  | 'STAGE_A'           // Continuous LP
  | 'SPACE_VALIDATION'
  | 'STAGE_B'           // Integer LP
  | 'FALLBACK'          // Zone-swap fallback
  | 'DEROUNDING'        // Greedy de-rounding
  | 'CONSOLIDATION'     // Merging recipes
  | 'STAGE_B2'          // Min waste
  | 'SHRINK'            // Post-process shrink
  | 'FINAL';

export interface OptimizerEvent {
  stage: OptimizerStage;
  timestamp: number;
  message: string;
  metrics?: {
    income: number;
    profit?: number;
    waste?: number;
    machines: number;
    transfers: number;
    feasible: boolean;
  };
  change?: {
    type: 'add' | 'remove' | 'update' | 'check';
    description: string;
  };
  snapshot?: CalculatorResult;
}

export interface OptimizerTelemetry {
  startTime: number;
  endTime: number;
  totalDuration: number;
  events: OptimizerEvent[];
  stageDurations: Record<OptimizerStage, number>;
}

// ============================================
// LEGACY TYPES (for backward compatibility)
// ============================================

export interface PortConfig {
  maxPorts: number;
  portThroughput: number;
}

export interface MachineAllocation {
  machineId: string;
  recipeId: string;
  count: number;
  actualRate: number;
}

export interface ResourceUsage {
  itemId: string;
  rate: number;
  portsNeeded: number;
}

export type OptimizationMode = 'maxIncome' | 'minTransfers' | 'balanced';

export interface ScenarioData {
  targets: ProductionTarget[];
  constraints: ResourceConstraint[];
  optimizationMode: OptimizationMode;
  transferPenalty: number;
  consolidationWeight?: number;
  machineWeight?: number;
  nodePositions?: Record<string, { x: number; y: number }>;
}

export interface Scenario {
  id: string;
  name: string;
  lastModified: number;
  data: ScenarioData;
}
