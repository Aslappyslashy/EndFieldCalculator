// Legacy calculator utilities - kept for backward compatibility
// The main zone-aware calculator is in zoneCalculator.ts

import type { Recipe } from '../types';

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

// Calculate ports needed for a given rate
export function portsNeededForRate(rate: number, portThroughput: number): number {
  return Math.ceil(rate / portThroughput);
}

// Default port config (legacy)
export const DEFAULT_PORT_CONFIG = {
  maxPorts: 20,
  portThroughput: 30,
};

// Re-export zone calculator as the main calculator
export { calculateZoneOptimalProduction as calculateOptimalProduction } from './zoneCalculator';
