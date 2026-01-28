import type { Item, Machine, Recipe } from '../types';

const API_BASE = 'http://localhost:8000';

export interface GameData {
  items: Item[];
  machines: Machine[];
  recipes: Recipe[];
}

export const dataService = {
  async getGameData(): Promise<GameData> {
    const res = await fetch(`${API_BASE}/game-data`);
    if (!res.ok) throw new Error('Failed to fetch game data');
    return res.json();
  },

  async saveGameData(data: GameData): Promise<void> {
    const res = await fetch(`${API_BASE}/game-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to save game data');
    }
  },
};
