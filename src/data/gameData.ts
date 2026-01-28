import type { Item, Machine, Recipe } from '../types';
import gameData from './gameData.json';

const { items, machines, recipes } = gameData as { items: Item[]; machines: Machine[]; recipes: Recipe[] };

export function getGameItems(): Item[] {
  return items;
}

export function getGameMachines(): Machine[] {
  return machines;
}

export function getGameRecipes(): Recipe[] {
  return recipes;
}

export function getItemIdByName(name: string): string {
  const item = items.find(i => i.name === name);
  return item ? item.id : 'unknown';
}

export function getAllItemNames(): string[] {
  return items.map(i => i.name).sort();
}

export interface ResourceLimit {
  itemId: string;
  itemName: string;
  limit: number; // per minute
}

export function getDefaultResourceLimits(): ResourceLimit[] {
  return items
    .filter(i => i.isRawResource)
    .map(r => ({
      itemId: r.id,
      itemName: r.name,
      limit: r.baseProductionRate || 100,
    }));
}
