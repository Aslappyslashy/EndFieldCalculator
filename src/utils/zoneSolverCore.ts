import Solver, { type Model } from 'javascript-lp-solver';
import type {
  Item,
  Recipe,
  ZoneAssignment,
  CalculatorInput,
  CalculatorResult,
  ZoneResult,
  ItemFlow,
  OptimizerEvent,
  OptimizerStage,
} from '../types';

// Calculate production rate per minute for a recipe (per machine)
export function getRecipeRatePerMinute(recipe: Recipe): number {
  const cyclesPerMinute = 60 / recipe.craftingTime;
  return recipe.outputAmount * cyclesPerMinute;
}

// Calculate input consumption rate per minute for a recipe (per machine)
export function getInputRatePerMinute(recipe: Recipe, inputItemId: string): number {
  const input = recipe.inputs.find(i => i.itemId === inputItemId);
  if (!input) return 0;
  const cyclesPerMinute = 60 / recipe.craftingTime;
  return input.amount * cyclesPerMinute;
}

type CoreData = {
  items: Item[];
  recipes: Recipe[];
  rawResources: Item[];
  machineAreaById?: Map<string, number | undefined>;
};

// Detect cycles in the recipe graph (e.g., seed -> plant -> more seeds)
// Returns warnings for any detected amplification loops
function detectRecipeCycles(recipes: Recipe[], items: Item[]): string[] {
  const warnings: string[] = [];
  const itemNameById = new Map(items.map(i => [i.id, i.name]));
  const getItemName = (id: string) => itemNameById.get(id) || id;

  // Build a graph: itemId -> recipes that produce it
  const producersByItem = new Map<string, Recipe[]>();
  for (const recipe of recipes) {
    const list = producersByItem.get(recipe.outputItemId) || [];
    list.push(recipe);
    producersByItem.set(recipe.outputItemId, list);
  }

  // Build item -> items it can produce (through recipes)
  const itemGraph = new Map<string, Set<string>>();
  for (const recipe of recipes) {
    for (const input of recipe.inputs) {
      const reachable = itemGraph.get(input.itemId) || new Set();
      reachable.add(recipe.outputItemId);
      itemGraph.set(input.itemId, reachable);
    }
  }

  // DFS to detect cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycleItems: string[] = [];

  function dfs(itemId: string, path: string[]): boolean {
    if (recursionStack.has(itemId)) {
      // Found cycle - extract the cycle path and convert to names
      const cycleStart = path.indexOf(itemId);
      const cyclePath = path.slice(cycleStart).concat(itemId);
      const cycleNames = cyclePath.map(getItemName);
      cycleItems.push(cycleNames.join(' → '));
      return true;
    }
    if (visited.has(itemId)) return false;

    visited.add(itemId);
    recursionStack.add(itemId);
    path.push(itemId);

    const neighbors = itemGraph.get(itemId);
    if (neighbors) {
      for (const neighbor of neighbors) {
        dfs(neighbor, [...path]);
      }
    }

    recursionStack.delete(itemId);
    return false;
  }

  for (const itemId of itemGraph.keys()) {
    if (!visited.has(itemId)) {
      dfs(itemId, []);
    }
  }

  // Check for amplification (cycle where output > input for same item)
  for (const recipe of recipes) {
    const selfInput = recipe.inputs.find(i => i.itemId === recipe.outputItemId);
    if (selfInput) {
      const inputRate = selfInput.amount / recipe.craftingTime;
      const outputRate = recipe.outputAmount / recipe.craftingTime;
      if (outputRate > inputRate) {
        warnings.push(`Self-amplifying recipe: ${recipe.name} (output ${outputRate.toFixed(2)}/s > input ${inputRate.toFixed(2)}/s)`);
      }
    }
  }

  if (cycleItems.length > 0) {
    warnings.push(`Recipe cycles detected: ${cycleItems.slice(0, 3).join('; ')}${cycleItems.length > 3 ? ` (+${cycleItems.length - 3} more)` : ''}`);
  }

  return warnings;
}

function buildZoneModel(params: {
  data: CoreData;
  input: CalculatorInput;
  fixedMachines?: Map<string, number>; // varName -> fixed value
  objectiveMode?: 'profit' | 'minWaste';
  minObjective?: number;
}): { model: Model; warnings: string[]; rawResourceIds: Set<string> } {
  const { data, input, fixedMachines, objectiveMode = 'profit', minObjective } = params;
  const { items, recipes, rawResources } = data;
  const zones = input.zones;

  const warnings: string[] = [];

  const model: Model = {
    optimize: objectiveMode === 'minWaste' ? 'waste' : 'objective',
    opType: objectiveMode === 'minWaste' ? 'min' : 'max',
    constraints: {},
    variables: {},
  };

  const rawResourceIds = new Set(rawResources.map(r => r.id));

  // Calculate average item price for scaling transfer penalty
  const sellableItems = items.filter(i => i.price > 0);
  const avgPrice = sellableItems.length > 0
    ? sellableItems.reduce((sum, i) => sum + i.price, 0) / sellableItems.length
    : 10;

  // Parameters exposed for tuning integer tendency
  const consolidationWeight = input.consolidationWeight ?? 0.05; // Default: 5% of avg price
  const machineWeight = input.machineWeight ?? 0.01; // Default: 1% of avg price

  const recipeActivationPenalty = consolidationWeight * avgPrice;
  const perMachinePenalty = (machineWeight * avgPrice) / 10; // Fraction of price, scaled

  let transferPenalty = 0;
  switch (input.optimizationMode) {
    case 'minTransfers':
      transferPenalty = avgPrice * 100;
      break;
    case 'balanced':
      transferPenalty = (input.transferPenalty ?? 0.5) * avgPrice * 2;
      break;
    case 'maxIncome':
    default:
      transferPenalty = 0;
      break;
  }

  // Recipe vars
  for (const recipe of recipes) {
    for (const zone of zones) {
      const varName = `r_${recipe.id}_z_${zone.id}`;
      const ratePerMachine = getRecipeRatePerMinute(recipe);

      const variable: Record<string, number> = {
        objective: 0,
      };

      if (!fixedMachines) {
        variable[`machines_${zone.id}`] = 1;
        variable.objective -= perMachinePenalty;
        variable.objective -= recipeActivationPenalty / 100;
      }

      const a = data.machineAreaById?.get(recipe.machineId);
      if (typeof a === 'number' && a > 0) {
        if (!fixedMachines) {
          variable[`area_${zone.id}`] = a;
        }
      }

      variable[`item_${recipe.outputItemId}_zone_${zone.id}_produced`] = ratePerMachine;

      for (const inputDef of recipe.inputs) {
        const inputRate = getInputRatePerMinute(recipe, inputDef.itemId);
        variable[`item_${inputDef.itemId}_zone_${zone.id}_needed`] = inputRate;
      }

      model.variables[varName] = variable;

      const fixed = fixedMachines?.get(varName);
      if (typeof fixed === 'number') {
        const cName = `cap_${varName}`;
        model.constraints[cName] = { max: fixed };
        model.variables[varName][cName] = 1;
      }

      if (objectiveMode === 'minWaste') {
        model.variables[varName].waste = 1 + 0.05;
      }
    }
  }

  const useIntegerPorts = true;
  if (useIntegerPorts) {
    model.ints = model.ints || {};
  }

  // Transfer vars (pool -> zone)
  for (const item of items) {
    for (const zone of zones) {
      const varName = `transfer_${item.id}_to_${zone.id}`;
      const opportunityCost = item.price > 0 ? item.price : 0;
      const transferCost = rawResourceIds.has(item.id) ? 0 : (transferPenalty + opportunityCost);
      const variable: Record<string, number> = {
        objective: -transferCost,
        waste: 0,
        [`item_${item.id}_zone_${zone.id}_available`]: 1,
      };

      if (!useIntegerPorts) {
        variable[`outputcap_${zone.id}`] = 1;
      } else {
        const linesVarName = `lines_out_${item.id}_${zone.id}`;
        const linkName = `link_out_${item.id}_${zone.id}`;
        model.constraints[linkName] = { max: 0 };
        variable[linkName] = 1;

        const linesVariable: Record<string, number> = {
          objective: 0,
          waste: 0,
          [`output_lines_${zone.id}`]: 1,
          [linkName]: -zone.portThroughput
        };

        model.variables[linesVarName] = linesVariable;
        if (model.ints) model.ints[linesVarName] = 1;
      }

      if (objectiveMode === 'minWaste') {
        variable.waste = rawResourceIds.has(item.id) ? 0 : 1;
      }

      if (rawResourceIds.has(item.id)) {
        variable[`rawresource_${item.id}`] = 1;
      } else {
        variable[`global_pool_${item.id}`] = 1;
      }
      model.variables[varName] = variable;
    }
  }

  // Send vars (zone -> pool)
  for (const item of items) {
    if (rawResourceIds.has(item.id)) continue;
    for (const zone of zones) {
      const varName = `send_${item.id}_from_${zone.id}`;
      const income = item.price > 0 ? item.price : 0;
      const variable: Record<string, number> = {
        objective: income,
        waste: 0,
        [`item_${item.id}_zone_${zone.id}_produced`]: -1,
        [`global_pool_${item.id}`]: -1,
      };

      const target = input.targets.find(t => t.itemId === item.id);
      if (target && income > 0) {
        variable[`surplus_${item.id}`] = 1;
      }

      if (!useIntegerPorts) {
        variable[`inputcap_${zone.id}`] = 1;
      } else {
        const linesVarName = `lines_in_${item.id}_${zone.id}`;
        const linkName = `link_in_${item.id}_${zone.id}`;
        model.constraints[linkName] = { max: 0 };
        variable[linkName] = 1;

        const linesVariable: Record<string, number> = {
          objective: 0,
          waste: 0,
          [`input_lines_${zone.id}`]: 1,
          [linkName]: -zone.portThroughput
        };

        model.variables[linesVarName] = linesVariable;
        if (model.ints) model.ints[linesVarName] = 1;
      }

      if (objectiveMode === 'minWaste') {
        variable.waste = item.price > 0 ? 0 : 1;
      }
      model.variables[varName] = variable;
    }
  }

  // Transfers offset surplus
  for (const item of items) {
    if (rawResourceIds.has(item.id)) continue;
    const target = input.targets.find(t => t.itemId === item.id);
    const income = item.price > 0 ? item.price : 0;
    if (target && income > 0) {
      for (const zone of zones) {
        const transferVar = `transfer_${item.id}_to_${zone.id}`;
        if (model.variables[transferVar]) {
          model.variables[transferVar][`surplus_${item.id}`] = -1;
        }
      }
    }
  }

  // Target consumption
  for (const target of input.targets) {
    if (rawResourceIds.has(target.itemId)) continue;
    const item = items.find(i => i.id === target.itemId);
    if (!item || item.price <= 0) continue;

    const consumeVar = `target_consume_${target.itemId}`;
    model.variables[consumeVar] = {
      objective: -item.price,
      waste: 0,
      [`surplus_${target.itemId}`]: -1,
    };
    const capName = `target_cap_${target.itemId}`;
    model.constraints[capName] = { max: target.targetRate };
    model.variables[consumeVar][capName] = 1;
  }

  // Basic Constraints
  for (const zone of zones) {
    if (!useIntegerPorts) {
      model.constraints[`outputcap_${zone.id}`] = { max: zone.outputPorts * zone.portThroughput };
      model.constraints[`inputcap_${zone.id}`] = { max: zone.inputPorts * zone.portThroughput };
    } else {
      model.constraints[`output_lines_${zone.id}`] = { max: zone.outputPorts };
      model.constraints[`input_lines_${zone.id}`] = { max: zone.inputPorts };
    }
    if (zone.machineSlots) model.constraints[`machines_${zone.id}`] = { max: zone.machineSlots };
    if (zone.areaLimit) model.constraints[`area_${zone.id}`] = { max: zone.areaLimit };
  }

  if (objectiveMode === 'minWaste' && typeof minObjective === 'number') {
    const cName = 'obj_floor';
    model.constraints[cName] = { min: minObjective };
    for (const v of Object.values(model.variables)) {
      const profitCoef = typeof v.objective === 'number' ? (v.objective as number) : 0;
      v[cName] = profitCoef;
    }
  }

  for (const item of items) {
    for (const zone of zones) {
      const c = `balance_${item.id}_${zone.id}`;
      model.constraints[c] = { min: 0 };
      for (const recipe of recipes) {
        const rv = `r_${recipe.id}_z_${zone.id}`;
        if (!model.variables[rv]) continue;
        if (recipe.outputItemId === item.id) {
          model.variables[rv][c] = (model.variables[rv][c] || 0) + getRecipeRatePerMinute(recipe);
        }
        const inputDef = recipe.inputs.find(i => i.itemId === item.id);
        if (inputDef) {
          model.variables[rv][c] = (model.variables[rv][c] || 0) - getInputRatePerMinute(recipe, item.id);
        }
      }
      const tv = `transfer_${item.id}_to_${zone.id}`;
      if (model.variables[tv]) model.variables[tv][c] = 1;
      const sv = `send_${item.id}_from_${zone.id}`;
      if (model.variables[sv]) model.variables[sv][c] = -1;
    }
  }

  for (const item of items) {
    if (rawResourceIds.has(item.id)) continue;
    model.constraints[`global_pool_${item.id}`] = { max: 0 };
  }

  for (const resource of rawResources) {
    const constraint = input.resourceConstraints.find(c => c.itemId === resource.id);
    const maxRate = constraint?.maxRate ?? resource.baseProductionRate ?? Infinity;
    model.constraints[`rawresource_${resource.id}`] = { max: maxRate };
  }

  const shortfallPenalty = 1e9;
  for (const target of input.targets) {
    if (rawResourceIds.has(target.itemId)) {
      warnings.push(`Target '${target.itemId}' is a raw resource; ignoring.`);
      continue;
    }
    model.constraints[`target_${target.itemId}`] = { min: target.targetRate };
    const slackVarName = `slack_target_${target.itemId}`;
    model.variables[slackVarName] = {
      [`target_${target.itemId}`]: 1,
      objective: -shortfallPenalty,
      waste: 0,
    };
    for (const zone of zones) {
      const sendVarName = `send_${target.itemId}_from_${zone.id}`;
      if (model.variables[sendVarName]) model.variables[sendVarName][`target_${target.itemId}`] = 1;
      const transferVarName = `transfer_${target.itemId}_to_${zone.id}`;
      if (model.variables[transferVarName]) model.variables[transferVarName][`target_${target.itemId}`] = -1;
    }
  }

  if (input.lockedAssignments && input.lockedAssignments.length > 0) {
    for (const lock of input.lockedAssignments) {
      const varName = `r_${lock.recipeId}_z_${lock.zoneId}`;
      if (!model.variables[varName]) continue;
      const cName = `lock_${lock.recipeId}_${lock.zoneId}`;
      model.constraints[cName] = { min: lock.machineCount, max: lock.machineCount };
      model.variables[varName][cName] = 1;
    }
  }

  return { model, warnings, rawResourceIds };
}

export function calculateZoneOptimalProductionCore(params: {
  data: CoreData;
  input: CalculatorInput;
  onProgress?: (event: OptimizerEvent) => void;
}): CalculatorResult {
  const { data, input, onProgress } = params;
  const { items, recipes, rawResources } = data;
  const zones = input.zones;

  const startTime = Date.now();
  const events: OptimizerEvent[] = [];

  const emit = (stage: OptimizerStage, message: string, metrics?: OptimizerEvent['metrics'], change?: OptimizerEvent['change']) => {
    const event: OptimizerEvent = { stage, timestamp: Date.now(), message, metrics, change };
    events.push(event);
    if (onProgress) onProgress(event);
  };

  const getMetrics = (sol: any, fm: Map<string, number>, model?: Model): OptimizerEvent['metrics'] => {
    let totalMachines = 0;
    for (const m of fm.values()) totalMachines += m;

    // Calculate actual gross income from items sold
    let income = 0;
    for (const item of items) {
      if (item.price <= 0) continue;
      for (const zone of zones) {
        const sV = sol[`send_${item.id}_from_${zone.id}`];
        if (typeof sV === 'number') income += sV * item.price;
      }
    }

    // Profit is the objective value when in profit mode
    let profit = (sol && typeof sol.result === 'number') ? sol.result : income;

    // Waste is the objective value when in minWaste mode
    let waste = (model?.optimize === 'waste' && typeof sol?.result === 'number') ? sol.result : undefined;

    return { income, profit, waste, machines: totalMachines, transfers: 0, feasible: sol ? sol.feasible !== false : false };
  };

  emit('INIT', 'Initializing optimizer...', { income: 0, machines: 0, transfers: 0, feasible: true });
  const warnings: string[] = [];
  warnings.push(...detectRecipeCycles(recipes, items));

  if (zones.length === 0) {
    return {
      feasible: false, zoneResults: [], totalIncome: 0, totalOutputPortsUsed: 0, globalResourceUsage: [], itemFlows: [],
      unmetTargets: input.targets.map(t => ({ itemId: t.itemId, shortfall: t.targetRate })),
      warnings: ['No zones defined.'], transferOverhead: 0,
    };
  }

  // Stage A
  const stageA = buildZoneModel({ data, input });
  warnings.push(...stageA.warnings);
  const solA = Solver.Solve(stageA.model);
  emit('STAGE_A', 'Continuous LP solved', getMetrics(solA, new Map()));

  let fixedMachines = new Map<string, number>();
  for (const recipe of recipes) {
    for (const zone of zones) {
      const varName = `r_${recipe.id}_z_${zone.id}`;
      const v = solA[varName];
      if (typeof v === 'number' && v > 0.0001) fixedMachines.set(varName, Math.ceil(v - 0.000001));
      else fixedMachines.set(varName, 0);
    }
  }

  const solveProfitWithFixed = (fm: Map<string, number>) => {
    const st = buildZoneModel({ data, input, fixedMachines: fm, objectiveMode: 'profit' });
    return { model: st.model, warnings: st.warnings, rawResourceIds: st.rawResourceIds, sol: Solver.Solve(st.model) };
  };
  const solveMinWasteWithFixed = (fm: Map<string, number>, minObj: number) => {
    const st = buildZoneModel({ data, input, fixedMachines: fm, objectiveMode: 'minWaste', minObjective: minObj });
    return { model: st.model, warnings: st.warnings, rawResourceIds: st.rawResourceIds, sol: Solver.Solve(st.model) };
  };

  let stageBProfit = solveProfitWithFixed(fixedMachines);
  emit('STAGE_B', 'Initial integer LP solved', getMetrics(stageBProfit.sol, fixedMachines));

  const calcZoneSpaceUsed = (fm: Map<string, number>, zoneId: string) => {
    let machines = 0; let area = 0;
    for (const recipe of recipes) {
      const vn = `r_${recipe.id}_z_${zoneId}`;
      const m = fm.get(vn) || 0;
      if (m <= 0) continue;
      machines += m;
      const a = data.machineAreaById?.get(recipe.machineId);
      if (typeof a === 'number' && a > 0) area += m * a;
    }
    return { machines, area };
  };

  const hasAnySpaceViolation = (fm: Map<string, number>) => {
    for (const z of zones) {
      const used = calcZoneSpaceUsed(fm, z.id);
      if (z.machineSlots && used.machines > z.machineSlots + 1e-9) return true;
      if (z.areaLimit && used.area > z.areaLimit + 1e-9) return true;
    }
    return false;
  };

  const targetsSatisfied = (sol: any, rawIds: Set<string>) => {
    for (const t of input.targets) {
      if (rawIds.has(t.itemId)) continue;
      let net = 0;
      for (const z of zones) {
        const sendV = sol[`send_${t.itemId}_from_${z.id}`];
        const takeV = sol[`transfer_${t.itemId}_to_${z.id}`];
        if (typeof sendV === 'number') net += sendV;
        if (typeof takeV === 'number') net -= takeV;
      }
      if (net < t.targetRate - 0.000001) return false;
    }
    return true;
  };

  const tryZoneSwapFallback = (base: Map<string, number>): Map<string, number> | null => {
    if (zones.length < 2) return null;
    let best: Map<string, number> | null = null;
    let bestObj = -Infinity;
    for (let i = 0; i < zones.length; i++) {
      for (let j = i + 1; j < zones.length; j++) {
        const zi = zones[i].id; const zj = zones[j].id;
        const candFm = new Map(base);
        for (const recipe of recipes) {
          const a = `r_${recipe.id}_z_${zi}`; const b = `r_${recipe.id}_z_${zj}`;
          const va = candFm.get(a) || 0; const vb = candFm.get(b) || 0;
          candFm.set(a, vb); candFm.set(b, va);
        }
        const cand = solveProfitWithFixed(candFm);
        if (cand.sol.feasible === false) continue;
        if (!targetsSatisfied(cand.sol, cand.rawResourceIds)) continue;
        const obj = typeof cand.sol.result === 'number' ? cand.sol.result : 0;
        if (!best || obj > bestObj) { best = candFm; bestObj = obj; }
      }
    }
    return best;
  };

  const hasSpaceViol = hasAnySpaceViolation(fixedMachines);
  if (hasSpaceViol) emit('SPACE_VALIDATION', 'Space violations detected', getMetrics(stageBProfit.sol, fixedMachines));

  if (stageBProfit.sol.feasible === false || hasSpaceViol) {
    const swapped = tryZoneSwapFallback(fixedMachines);
    if (swapped) {
      fixedMachines = swapped;
      stageBProfit = solveProfitWithFixed(fixedMachines);
      emit('FALLBACK', 'Applied zone-swap fallback', getMetrics(stageBProfit.sol, fixedMachines));
    }
  }

  // De-rounding
  const varNames = Array.from(fixedMachines.keys()).sort();
  for (const vn of varNames) {
    const cur = fixedMachines.get(vn) || 0;
    if (cur <= 0) continue;
    const util = stageBProfit.sol[vn];
    if (typeof util === 'number' && util > cur - 1 + 0.0001) continue;

    fixedMachines.set(vn, cur - 1);
    const cand = solveProfitWithFixed(fixedMachines);
    let ok = (cand.sol.feasible !== false) && targetsSatisfied(cand.sol, cand.rawResourceIds);
    if (ok) {
      stageBProfit = cand;
      emit('DEROUNDING', `Decreasing capacity`, getMetrics(stageBProfit.sol, fixedMachines), { type: 'remove', description: vn });
    } else {
      fixedMachines.set(vn, cur);
    }
  }
  emit('DEROUNDING', 'Greedy de-rounding completed', getMetrics(stageBProfit.sol, fixedMachines));

  // Consolidation
  for (const recipe of recipes) {
    const list = zones.map(z => ({ zoneId: z.id, varName: `r_${recipe.id}_z_${z.id}` }))
      .filter(x => (fixedMachines.get(x.varName) || 0) > 0);
    if (list.length <= 1) continue;
    list.sort((a, b) => ((stageBProfit.sol[a.varName] as number) || 0) - ((stageBProfit.sol[b.varName] as number) || 0));

    for (let i = 0; i < list.length - 1; i++) {
      const source = list[i]; const donorMachines = fixedMachines.get(source.varName) || 0;
      for (let j = i + 1; j < list.length; j++) {
        const target = list[j]; const targetMachines = fixedMachines.get(target.varName) || 0;
        fixedMachines.set(source.varName, 0);
        fixedMachines.set(target.varName, targetMachines + donorMachines);
        if (hasAnySpaceViolation(fixedMachines)) {
          fixedMachines.set(source.varName, donorMachines); fixedMachines.set(target.varName, targetMachines);
          continue;
        }
        const cand = solveProfitWithFixed(fixedMachines);
        if (cand.sol.feasible !== false && targetsSatisfied(cand.sol, cand.rawResourceIds)) {
          stageBProfit = cand;
          emit('CONSOLIDATION', `Merging redundant lines`, getMetrics(stageBProfit.sol, fixedMachines), { type: 'update', description: `r_${recipe.id}_z_${target.zoneId}` });
          break;
        } else {
          fixedMachines.set(source.varName, donorMachines); fixedMachines.set(target.varName, targetMachines);
        }
      }
    }
  }
  emit('CONSOLIDATION', 'Consolidation pass completed', getMetrics(stageBProfit.sol, fixedMachines));

  const bestObjective = typeof stageBProfit.sol.result === 'number' ? stageBProfit.sol.result : 0;
  const stageBWaste = stageBProfit.sol.feasible !== false ? solveMinWasteWithFixed(fixedMachines, bestObjective - 1e-6) : stageBProfit;
  emit('STAGE_B2', 'Min-waste optimization completed', getMetrics(stageBWaste.sol, fixedMachines));

  const shrinkToUtilization = (fm: Map<string, number>, sol: any) => {
    const out = new Map(fm);
    for (const [vn, cur] of fm.entries()) {
      if (cur <= 0) continue;
      const util = typeof sol[vn] === 'number' ? (sol[vn] as number) : 0;
      const need = util > 1e-6 ? Math.ceil(util - 1e-6) : 0;
      out.set(vn, Math.min(cur, need));
    }
    return out;
  };
  fixedMachines = shrinkToUtilization(fixedMachines, stageBWaste.sol);
  emit('SHRINK', 'Shrink completed', getMetrics(stageBWaste.sol, fixedMachines));

  const rawResourceIds = stageBWaste.rawResourceIds;
  const solB = stageBWaste.sol;
  const itemFlows: ItemFlow[] = [];
  const zoneResults: ZoneResult[] = [];
  let totalOutputPortsUsed = 0;
  let transferOverhead = 0;

  for (const zone of zones) {
    const assignments: ZoneAssignment[] = [];
    const itemsFromPool: { itemId: string; rate: number }[] = [];
    const itemsToPool: { itemId: string; rate: number }[] = [];
    const itemsSold: { itemId: string; rate: number }[] = [];
    let totalMachines = 0; let areaUsed = 0;

    for (const recipe of recipes) {
      const varName = `r_${recipe.id}_z_${zone.id}`;
      const m = fixedMachines.get(varName) || 0;
      if (m <= 0) continue;
      const ratePerMachine = getRecipeRatePerMinute(recipe);
      const requiredRate = (typeof solA[varName] === 'number' ? solA[varName] : 0) * ratePerMachine;
      const util = typeof solB[varName] === 'number' ? solB[varName] : 0;
      const actualRate = util * ratePerMachine;
      assignments.push({ zoneId: zone.id, recipeId: recipe.id, machineCount: m, utilization: util, requiredRate, actualRate, excessRate: actualRate - requiredRate });
      totalMachines += m;
      const a = data.machineAreaById?.get(recipe.machineId);
      if (typeof a === 'number' && a > 0) areaUsed += m * a;
    }

    for (const item of items) {
      const tName = `transfer_${item.id}_to_${zone.id}`;
      const t = solB[tName];
      if (typeof t === 'number' && t > 0.001) {
        itemsFromPool.push({ itemId: item.id, rate: t });
        if (rawResourceIds.has(item.id)) itemFlows.push({ itemId: item.id, fromZoneId: null, toZoneId: zone.id, rate: t });
        else transferOverhead += Math.ceil(t / zone.portThroughput);
      }
      if (!rawResourceIds.has(item.id)) {
        const sName = `send_${item.id}_from_${zone.id}`;
        const s = solB[sName];
        if (typeof s === 'number' && s > 0.001) {
          if (item.price > 0) itemsSold.push({ itemId: item.id, rate: s });
          else itemsToPool.push({ itemId: item.id, rate: s });
        }
      }
    }

    const hasIntegerPorts = Object.keys(solB).some(k => k.startsWith('lines_in_') || k.startsWith('lines_out_'));
    let outputLinesUsed = 0;
    if (hasIntegerPorts) {
      for (const item of items) {
        const val = solB[`lines_out_${item.id}_${zone.id}`];
        if (typeof val === 'number') outputLinesUsed += val;
      }
    } else {
      outputLinesUsed = itemsSold.reduce((sum, f) => sum + Math.ceil(f.rate / zone.portThroughput), 0) + itemsToPool.reduce((sum, f) => sum + Math.ceil(f.rate / zone.portThroughput), 0);
    }
    let inputLinesUsed = 0;
    if (hasIntegerPorts) {
      for (const item of items) {
        const val = solB[`lines_in_${item.id}_${zone.id}`];
        if (typeof val === 'number') inputLinesUsed += val;
      }
    } else {
      inputLinesUsed = itemsFromPool.reduce((sum, f) => sum + Math.ceil(f.rate / zone.portThroughput), 0);
    }
    totalOutputPortsUsed += outputLinesUsed;
    zoneResults.push({ zone, assignments, outputPortsUsed: outputLinesUsed, inputPortsUsed: inputLinesUsed, totalMachines, itemsFromPool, itemsToPool, itemsSold, areaUsed: zone.areaLimit ? areaUsed : undefined });
  }

  for (const item of items) {
    if (rawResourceIds.has(item.id)) continue;
    const suppliers: { zoneId: string; remaining: number }[] = [];
    const consumers: { zoneId: string; remaining: number }[] = [];
    for (const zone of zones) {
      const sV = solB[`send_${item.id}_from_${zone.id}`]; const tV = solB[`transfer_${item.id}_to_${zone.id}`];
      if (typeof sV === 'number' && sV > 0.001) suppliers.push({ zoneId: zone.id, remaining: sV });
      if (typeof tV === 'number' && tV > 0.001) consumers.push({ zoneId: zone.id, remaining: tV });
    }
    for (const s of suppliers) {
      for (const c of consumers) {
        if (s.remaining <= 0.001) break; if (c.remaining <= 0.001 || s.zoneId === c.zoneId) continue;
        const flow = Math.min(s.remaining, c.remaining);
        if (flow > 0.001) { itemFlows.push({ itemId: item.id, fromZoneId: s.zoneId, toZoneId: c.zoneId, rate: flow }); s.remaining -= flow; c.remaining -= flow; }
      }
    }
  }

  const globalResourceUsage: { itemId: string; rate: number }[] = [];
  for (const resource of rawResources) {
    let usage = 0; for (const z of zones) { const v = solB[`transfer_${resource.id}_to_${z.id}`]; if (typeof v === 'number') usage += v; }
    if (usage > 0.001) globalResourceUsage.push({ itemId: resource.id, rate: usage });
  }

  const itemNetExports = new Map<string, number>();
  for (const item of items) {
    if (rawResourceIds.has(item.id)) continue;
    let net = 0;
    for (const z of zones) {
      const sV = solB[`send_${item.id}_from_${z.id}`]; const tV = solB[`transfer_${item.id}_to_${z.id}`];
      if (typeof sV === 'number') net += sV; if (typeof tV === 'number') net -= tV;
    }
    itemNetExports.set(item.id, net);
  }

  const unmetTargets: { itemId: string; shortfall: number }[] = [];
  for (const target of input.targets) {
    if (rawResourceIds.has(target.itemId)) continue;
    const net = itemNetExports.get(target.itemId) || 0;
    if (net < target.targetRate - 0.001) unmetTargets.push({ itemId: target.itemId, shortfall: target.targetRate - net });
  }

  let totalIncome = 0;
  for (const item of items) {
    if (item.price <= 0) continue;
    const net = itemNetExports.get(item.id) || 0;
    if (net <= 0.001) continue;
    const target = input.targets.find(t => t.itemId === item.id);
    const needed = target ? target.targetRate : 0;
    totalIncome += Math.max(0, net - needed) * item.price;
  }

  for (const zr of zoneResults) {
    if (zr.outputPortsUsed > zr.zone.outputPorts) warnings.push(`${zr.zone.name}: Output lines exceeded (${zr.outputPortsUsed} > ${zr.zone.outputPorts})`);
    if (zr.inputPortsUsed > zr.zone.inputPorts) warnings.push(`${zr.zone.name}: Input lines exceeded (${zr.inputPortsUsed} > ${zr.zone.inputPorts})`);
    if (zr.zone.machineSlots && zr.totalMachines > zr.zone.machineSlots) warnings.push(`${zr.zone.name}: Machine slots exceeded (${zr.totalMachines.toFixed(0)} > ${zr.zone.machineSlots})`);
    if (zr.zone.areaLimit && typeof zr.areaUsed === 'number' && zr.areaUsed > zr.zone.areaLimit) warnings.push(`${zr.zone.name}: Area exceeded (${zr.areaUsed.toFixed(0)} > ${zr.zone.areaLimit})`);
  }

  emit('FINAL', 'Optimization completed', getMetrics(solB, fixedMachines));

  const solverFeasible = solB.feasible !== false;
  const feasible = solverFeasible && unmetTargets.length === 0;

  return {
    feasible,
    solverFeasible,
    infeasibleReason: feasible ? undefined : (solverFeasible ? 'unmet_targets' : 'solver_infeasible'),
    zoneResults, totalIncome, totalOutputPortsUsed, globalResourceUsage, itemFlows, unmetTargets, warnings, transferOverhead,
    telemetry: {
      startTime, endTime: Date.now(), totalDuration: Date.now() - startTime, events, stageDurations: {} as any
    }
  };
}

export function calculateTheoreticalMaxCore(params: {
  data: CoreData;
  input: CalculatorInput;
}): number {
  const { data, input } = params;
  const { items, recipes, rawResources } = data;
  const model: Model = { optimize: 'income', opType: 'max', constraints: {}, variables: {}, };
  const rawResourceIds = new Set(rawResources.map(r => r.id));
  for (const recipe of recipes) {
    const rate = getRecipeRatePerMinute(recipe);
    const v: Record<string, number> = { income: 0, [`item_${recipe.outputItemId}`]: rate };
    for (const inp of recipe.inputs) v[`item_${inp.itemId}`] = (v[`item_${inp.itemId}`] || 0) - getInputRatePerMinute(recipe, inp.itemId);
    model.variables[`recipe_${recipe.id}`] = v;
  }
  for (const item of items) {
    if (item.price <= 0) continue;
    for (const recipe of recipes) {
      if (recipe.outputItemId !== item.id) continue;
      const vn = `recipe_${recipe.id}`; if (model.variables[vn]) model.variables[vn].income = item.price * getRecipeRatePerMinute(recipe);
    }
  }
  for (const res of rawResources) {
    const c = input.resourceConstraints.find(x => x.itemId === res.id);
    const max = c?.maxRate ?? res.baseProductionRate ?? Infinity;
    model.constraints[`item_${res.id}`] = { min: -max };
  }
  for (const item of items) {
    if (rawResourceIds.has(item.id)) continue;
    const t = input.targets.find(x => x.itemId === item.id);
    model.constraints[`item_${item.id}`] = { min: t ? t.targetRate : 0 };
  }
  const sol = Solver.Solve(model);
  return typeof sol.result === 'number' ? sol.result : 0;
}
