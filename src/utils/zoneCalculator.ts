import type { CalculatorInput, CalculatorResult, Recipe } from '../types';
import { getAllItems, getAllMachines, getAllRecipes, getRawResources } from '../db/database';
import {
  calculateTheoreticalMaxCore,
  calculateZoneOptimalProductionCore,
  getInputRatePerMinute,
  getRecipeRatePerMinute,
} from './zoneSolverCore';

export { getInputRatePerMinute, getRecipeRatePerMinute };

// Thin wrapper around the core solver that pulls data from DB.
export function calculateZoneOptimalProduction(input: CalculatorInput): CalculatorResult {
  const items = getAllItems();
  const machines = getAllMachines();
  const recipes = getAllRecipes();
  const rawResources = getRawResources();
  const machineAreaById = new Map(machines.map(m => [m.id, m.area] as const));

  return calculateZoneOptimalProductionCore({
    data: { items, recipes, machines, rawResources, machineAreaById },
    input,
  });
}

export function calculateTheoreticalMax(input: CalculatorInput): number {
  const items = getAllItems();
  const recipes = getAllRecipes();
  const machines = getAllMachines();
  const rawResources = getRawResources();
  return calculateTheoreticalMaxCore({ data: { items, recipes, machines, rawResources }, input });
}

// Legacy re-export compatibility (some code imports Recipe type locally)
export type { Recipe };
