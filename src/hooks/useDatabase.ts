import { useState, useEffect, useCallback } from 'react';
import type { Item, Machine, Recipe, Zone, ZoneAssignment } from '../types';
import * as db from '../db/database';

export function useDatabase() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        console.log('Initializing database...');
        await db.initDatabase();
        console.log('Database initialized successfully');
        setIsInitialized(true);
      } catch (err) {
        console.error('Database initialization failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize database');
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const save = useCallback(async () => {
    await db.saveDatabase();
  }, []);

  return { isLoading, error, isInitialized, save };
}

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      const data = db.getAllItems();
      setItems(data);
    } catch (err) {
      console.error('Failed to load items:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createItem = useCallback(async (item: Item) => {
    db.createItem(item);
    await db.saveDatabase();
    refresh();
  }, [refresh]);

  const updateItem = useCallback(async (item: Item) => {
    db.updateItem(item);
    await db.saveDatabase();
    refresh();
  }, [refresh]);

  const deleteItem = useCallback(async (id: string) => {
    db.deleteItem(id);
    await db.saveDatabase();
    refresh();
  }, [refresh]);

  const getById = useCallback((id: string) => {
    return db.getItemById(id);
  }, []);

  return { items, isLoading, refresh, createItem, updateItem, deleteItem, getById };
}

export function useMachines() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      const data = db.getAllMachines();
      setMachines(data);
    } catch (err) {
      console.error('Failed to load machines:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createMachine = useCallback(async (machine: Machine) => {
    db.createMachine(machine);
    await db.saveDatabase();
    refresh();
  }, [refresh]);

  const updateMachine = useCallback(async (machine: Machine) => {
    db.updateMachine(machine);
    await db.saveDatabase();
    refresh();
  }, [refresh]);

  const deleteMachine = useCallback(async (id: string) => {
    db.deleteMachine(id);
    await db.saveDatabase();
    refresh();
  }, [refresh]);

  const getById = useCallback((id: string) => {
    return db.getMachineById(id);
  }, []);

  return { machines, isLoading, refresh, createMachine, updateMachine, deleteMachine, getById };
}

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      const data = db.getAllRecipes();
      setRecipes(data);
    } catch (err) {
      console.error('Failed to load recipes:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createRecipe = useCallback(async (recipe: Recipe) => {
    db.createRecipe(recipe);
    await db.saveDatabase();
    refresh();
  }, [refresh]);

  const updateRecipe = useCallback(async (recipe: Recipe) => {
    db.updateRecipe(recipe);
    await db.saveDatabase();
    refresh();
  }, [refresh]);

  const deleteRecipe = useCallback(async (id: string) => {
    db.deleteRecipe(id);
    await db.saveDatabase();
    refresh();
  }, [refresh]);

  const getById = useCallback((id: string) => {
    return db.getRecipeById(id);
  }, []);

  const getByMachine = useCallback((machineId: string) => {
    return db.getRecipesByMachine(machineId);
  }, []);

  return { recipes, isLoading, refresh, createRecipe, updateRecipe, deleteRecipe, getById, getByMachine };
}

export function useZones() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      const data = db.getAllZones();
      setZones(data);
    } catch (err) {
      console.error('Failed to load zones:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createZone = useCallback(async (zone: Zone) => {
    db.createZone(zone);
    await db.saveDatabase();
    refresh();
  }, [refresh]);

  const updateZone = useCallback(async (zone: Zone) => {
    db.updateZone(zone);
    await db.saveDatabase();
    refresh();
  }, [refresh]);

  const deleteZone = useCallback(async (id: string) => {
    db.deleteZone(id);
    await db.saveDatabase();
    refresh();
  }, [refresh]);

  const getById = useCallback((id: string) => {
    return db.getZoneById(id);
  }, []);

  return { zones, isLoading, refresh, createZone, updateZone, deleteZone, getById };
}

export function useZoneAssignments() {
  const [assignments, setAssignments] = useState<ZoneAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      const data = db.getAllZoneAssignments();
      setAssignments(data);
    } catch (err) {
      console.error('Failed to load zone assignments:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setAssignment = useCallback(async (assignment: ZoneAssignment) => {
    db.setZoneAssignment(assignment);
    await db.saveDatabase();
    refresh();
  }, [refresh]);

  const deleteAssignment = useCallback(async (zoneId: string, recipeId: string) => {
    db.deleteZoneAssignment(zoneId, recipeId);
    await db.saveDatabase();
    refresh();
  }, [refresh]);

  const clearZone = useCallback(async (zoneId: string) => {
    db.clearZoneAssignments(zoneId);
    await db.saveDatabase();
    refresh();
  }, [refresh]);

  const clearAll = useCallback(async () => {
    db.clearAllZoneAssignments();
    await db.saveDatabase();
    refresh();
  }, [refresh]);

  const bulkSet = useCallback(async (newAssignments: ZoneAssignment[]) => {
    db.bulkSetZoneAssignments(newAssignments);
    await db.saveDatabase();
    refresh();
  }, [refresh]);

  const getByZone = useCallback((zoneId: string) => {
    return db.getZoneAssignments(zoneId);
  }, []);

  return { 
    assignments, 
    isLoading, 
    refresh, 
    setAssignment, 
    deleteAssignment, 
    clearZone, 
    clearAll, 
    bulkSet,
    getByZone 
  };
}
