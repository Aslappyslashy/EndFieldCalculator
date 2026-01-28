import type { CalculatorResult, Recipe } from '../types';
import { getInputRatePerMinute } from './zoneSolverCore';

export type FlowNodeType = 'pool' | 'recipe' | 'sold' | 'zoneIn' | 'zoneOut';

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  zoneId: string | null;
  label: string;
  sublabel?: string;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  itemId: string;
  itemName: string;
  rate: number; // /min
  kind: 'local' | 'fromPool' | 'toPool' | 'sold' | 'interzone';
  explain: string;
  lanes: number;
}

export interface ZoneFlowGraph {
  zoneId: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  notes: string[];
}

function stableId(parts: Array<string | number>): string {
  return parts.join('::');
}

export function buildZoneFlowGraphForZone(params: {
  result: CalculatorResult;
  zoneId: string;
  recipes: Recipe[];
  itemNameById: Map<string, string>;
  recipeNameById: Map<string, string>;
  machineNameById: Map<string, string>;
}): ZoneFlowGraph | null {
  const { result, zoneId, recipes, itemNameById, recipeNameById, machineNameById } = params;

  const zr = result.zoneResults.find(z => z.zone.id === zoneId);
  if (!zr) return null;

  const recipeById = new Map(recipes.map(r => [r.id, r]));
  const getItemName = (id: string) => itemNameById.get(id) || id;
  const getRecipeName = (id: string) => recipeNameById.get(id) || id;
  const getMachineName = (id: string) => machineNameById.get(id) || 'Unknown Machine';

  const notes: string[] = [
    'Flow map is a transparent decomposition, not a hidden simulation.',
    'Algorithm: satisfy same-zone demands from same-zone producers first; remaining demand is fed from pool (limited by the solver transfer rate); remaining surplus is sent to pool or sold.',
  ];

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  const poolSourceId = 'poolSource';
  const poolSinkId = 'poolSink';
  const soldId = stableId(['sold', zr.zone.id]);
  const zoneInId = stableId(['zoneIn', zr.zone.id]);
  const zoneOutId = stableId(['zoneOut', zr.zone.id]);

  const hasImports = zr.itemsFromPool.length > 0;
  const hasExports = zr.itemsToPool.length > 0;
  const hasSales = zr.itemsSold.length > 0;

  if (hasImports) {
    nodes.push({ id: poolSourceId, type: 'pool', zoneId: null, label: 'GLOBAL POOL', sublabel: 'Supply' });
    nodes.push({
      id: zoneInId,
      type: 'zoneIn',
      zoneId: zr.zone.id,
      label: 'ZONE IMPORTS',
      sublabel: `${zr.outputPortsUsed.toFixed(0)}/${zr.zone.outputPorts} Output Ports`
    });
  }

  if (hasExports) {
    nodes.push({ id: poolSinkId, type: 'pool', zoneId: null, label: 'GLOBAL POOL', sublabel: 'Demand' });
    nodes.push({
      id: zoneOutId,
      type: 'zoneOut',
      zoneId: zr.zone.id,
      label: 'ZONE EXPORTS',
      sublabel: `${zr.inputPortsUsed.toFixed(0)}/${zr.zone.inputPorts} Input Ports (Storage)`
    });
  }

  if (hasSales) {
    nodes.push({ id: soldId, type: 'sold', zoneId: zr.zone.id, label: 'SALES', sublabel: 'Revenue Sink' });
  }

  // Recipe nodes
  // ... (recipes logic unchanged, assumed to be part of flow)
  const zoneAssignments = zr.assignments
    .map(a => ({ a, recipe: recipeById.get(a.recipeId) }))
    .filter(x => !!x.recipe);

  for (const { a, recipe } of zoneAssignments) {
    const id = stableId(['recipe', zr.zone.id, a.recipeId]);
    nodes.push({
      id,
      type: 'recipe',
      zoneId: zr.zone.id,
      label: `${getMachineName(recipe!.machineId)} x${a.machineCount}`,
      sublabel: `${getRecipeName(a.recipeId)} (${a.actualRate.toFixed(1)}/m) | util ${a.utilization.toFixed(2)}/${a.machineCount}`,
    });
  }

  // Build per-assignment supply/demand maps
  type Producer = { nodeId: string; remaining: number };
  type Consumer = { nodeId: string; remaining: number };

  const supplyByItem = new Map<string, Producer[]>();
  const demandByItem = new Map<string, Consumer[]>();

  for (const { a, recipe } of zoneAssignments) {
    const nodeId = stableId(['recipe', zr.zone.id, a.recipeId]);
    const outItem = recipe!.outputItemId;

    const outRate = a.actualRate;
    if (outRate > 0.0001) {
      const arr = supplyByItem.get(outItem) || [];
      arr.push({ nodeId, remaining: outRate });
      supplyByItem.set(outItem, arr);
    }

    for (const inp of recipe!.inputs) {
      // IMPORTANT: consumption should follow actual utilization, not installed machine count.
      // Otherwise the flow graph will exaggerate internal demand and can make cycles look wrong.
      const rate = a.utilization * getInputRatePerMinute(recipe!, inp.itemId);
      if (rate <= 0.0001) continue;
      const arr = demandByItem.get(inp.itemId) || [];
      arr.push({ nodeId, remaining: rate });
      demandByItem.set(inp.itemId, arr);
    }
  }

  // Pool supply/demand (from solver results)
  const poolSupply = new Map<string, number>();
  for (const f of zr.itemsFromPool) {
    poolSupply.set(f.itemId, (poolSupply.get(f.itemId) || 0) + f.rate);
  }

  const poolDemand = new Map<string, number>();
  for (const f of zr.itemsToPool) {
    poolDemand.set(f.itemId, (poolDemand.get(f.itemId) || 0) + f.rate);
  }

  const soldDemand = new Map<string, number>();
  for (const s of zr.itemsSold) {
    soldDemand.set(s.itemId, (soldDemand.get(s.itemId) || 0) + s.rate);
  }

  const allItems = new Set<string>([
    ...Array.from(supplyByItem.keys()),
    ...Array.from(demandByItem.keys()),
    ...Array.from(poolSupply.keys()),
    ...Array.from(poolDemand.keys()),
    ...Array.from(soldDemand.keys()),
  ]);

  const sortNodeId = (x: { nodeId: string }) => x.nodeId;

  for (const itemId of Array.from(allItems).sort()) {
    const itemName = getItemName(itemId);
    const producers = (supplyByItem.get(itemId) || []).slice().sort((a, b) => sortNodeId(a).localeCompare(sortNodeId(b)));
    const consumers = (demandByItem.get(itemId) || []).slice().sort((a, b) => sortNodeId(a).localeCompare(sortNodeId(b)));

    // 1) Local producer -> local consumer
    let pi = 0;
    for (const c of consumers) {
      while (c.remaining > 0.0001 && pi < producers.length) {
        const p = producers[pi];
        if (p.remaining <= 0.0001) {
          pi++;
          continue;
        }
        const flow = Math.min(c.remaining, p.remaining);
        edges.push({
          id: stableId(['edge', 'local', zr.zone.id, itemId, p.nodeId, c.nodeId, edges.length]),
          from: p.nodeId,
          to: c.nodeId,
          itemId,
          itemName: `${itemName} x${(flow / 30).toFixed(1)}`,
          rate: flow,
          lanes: flow / 30, // Internal belt capacity is usually 30/min
          kind: 'local',
          explain: 'Local flow: produced and consumed within the same zone.',
        });
        p.remaining -= flow;
        c.remaining -= flow;
      }
    }

    // 2) Pool -> local consumer
    // Only process if we have imports enabled (hasImports)
    let poolAvail = poolSupply.get(itemId) || 0;
    if (hasImports && poolAvail > 0.0001) {
      edges.push({
        id: stableId(['edge', 'fromPool', zr.zone.id, itemId, poolSourceId, zoneInId, edges.length]),
        from: poolSourceId,
        to: zoneInId,
        itemId,
        itemName: `${itemName} x${(poolAvail / zr.zone.portThroughput).toFixed(1)}`,
        rate: poolAvail,
        lanes: poolAvail / zr.zone.portThroughput,
        kind: 'fromPool',
        explain: 'From pool: items entering this zone.',
      });

      for (const c of consumers) {
        if (c.remaining <= 0.0001) continue;
        const flow = Math.min(c.remaining, poolAvail);
        if (flow > 0.0001) {
          edges.push({
            id: stableId(['edge', 'fromPoolToRecipe', zr.zone.id, itemId, zoneInId, c.nodeId, edges.length]),
            from: zoneInId,
            to: c.nodeId,
            itemId,
            itemName: `${itemName} x${(flow / zr.zone.portThroughput).toFixed(1)}`,
            rate: flow,
            lanes: flow / zr.zone.portThroughput,
            kind: 'fromPool',
            explain: 'Pool supply allocated to recipe.',
          });
          poolAvail -= flow;
          c.remaining -= flow;
        }
      }
    }

    // 3) Producer surplus -> sold
    const soldNeed = soldDemand.get(itemId) || 0;
    if (hasSales && soldNeed > 0.0001) {
      const soldAggId = stableId(['soldAgg', zr.zone.id, itemId]);
      nodes.push({ id: soldAggId, type: 'zoneOut', zoneId: zr.zone.id, label: `SELL: ${itemName}`, sublabel: 'allocator' });

      let remainingSell = soldNeed;
      for (const p of producers) {
        if (remainingSell <= 0.0001) break;
        if (p.remaining <= 0.0001) continue;
        const flow = Math.min(p.remaining, remainingSell);
        edges.push({
          id: stableId(['edge', 'toSold', zr.zone.id, itemId, p.nodeId, soldAggId, edges.length]),
          from: p.nodeId,
          to: soldAggId,
          itemId,
          itemName: `${itemName} x${(flow / zr.zone.portThroughput).toFixed(1)}`,
          rate: flow,
          lanes: flow / zr.zone.portThroughput,
          kind: 'sold',
          explain: 'Surplus allocated to sales.',
        });
        p.remaining -= flow;
        remainingSell -= flow;
      }

      edges.push({
        id: stableId(['edge', 'soldToSink', zr.zone.id, itemId, soldAggId, soldId, edges.length]),
        from: soldAggId,
        to: soldId,
        itemId,
        itemName: `${itemName} x${(soldNeed / zr.zone.portThroughput).toFixed(1)}`,
        rate: soldNeed,
        lanes: soldNeed / zr.zone.portThroughput,
        kind: 'sold',
        explain: 'Items sold.',
      });
    }

    // 4) Producer surplus -> pool
    const toPool = poolDemand.get(itemId) || 0;
    if (hasExports && toPool > 0.0001) {
      let remainingSend = toPool;
      for (const p of producers) {
        if (remainingSend <= 0.0001) break;
        if (p.remaining <= 0.0001) continue;
        const flow = Math.min(p.remaining, remainingSend);
        edges.push({
          id: stableId(['edge', 'producerToZoneOut', zr.zone.id, itemId, p.nodeId, zoneOutId, edges.length]),
          from: p.nodeId,
          to: zoneOutId,
          itemId,
          itemName: `${itemName} x${(flow / zr.zone.portThroughput).toFixed(1)}`,
          rate: flow,
          lanes: flow / zr.zone.portThroughput,
          kind: 'toPool',
          explain: 'Surplus sent to global pool.',
        });
        p.remaining -= flow;
        remainingSend -= flow;
      }

      edges.push({
        id: stableId(['edge', 'toPoolAgg', zr.zone.id, itemId, zoneOutId, poolSinkId, edges.length]),
        from: zoneOutId,
        to: poolSinkId,
        itemId,
        itemName: `${itemName} x${(toPool / zr.zone.portThroughput).toFixed(1)}`,
        rate: toPool,
        lanes: toPool / zr.zone.portThroughput,
        kind: 'toPool',
        explain: 'Items leaving this zone to pool.',
      });
    }

    // Diagnostics
    const unmet = consumers.reduce((s, c) => s + (c.remaining > 0 ? c.remaining : 0), 0);
    if (unmet > 0.01) {
      notes.push(`Unmet in-zone demand for ${itemName}: ${unmet.toFixed(2)}/min.`);
    }
  }

  return {
    zoneId: zr.zone.id,
    nodes,
    edges,
    notes,
  };
}
