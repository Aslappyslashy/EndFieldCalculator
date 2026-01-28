import initSqlJs, { type Database } from 'sql.js';
import type { Item, Machine, Recipe, RecipeInput, Zone, ZoneAssignment } from '../types';

const DB_NAME = 'endfield_calc_db';
// NOTE: IndexedDB requires monotonically increasing versions.
// If the user already has a newer DB in the browser, opening with a smaller
// version throws "requested version is less than existing".
const DB_VERSION = 3;

let db: Database | null = null;

// IndexedDB helpers for persistence
async function saveToIndexedDB(data: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onupgradeneeded = () => {
      const idb = request.result;
      if (!idb.objectStoreNames.contains('database')) {
        idb.createObjectStore('database');
      }
    };
    
    request.onsuccess = () => {
      const idb = request.result;
      const tx = idb.transaction('database', 'readwrite');
      const store = tx.objectStore('database');
      store.put(data, 'sqlite_data');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

async function loadFromIndexedDB(): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onupgradeneeded = () => {
      const idb = request.result;
      if (!idb.objectStoreNames.contains('database')) {
        idb.createObjectStore('database');
      }
    };
    
    request.onsuccess = () => {
      const idb = request.result;
      const tx = idb.transaction('database', 'readonly');
      const store = tx.objectStore('database');
      const getRequest = store.get('sqlite_data');
      
      getRequest.onsuccess = () => {
        resolve(getRequest.result || null);
      };
      getRequest.onerror = () => reject(getRequest.error);
    };
  });
}

// Initialize database
export async function initDatabase(): Promise<Database> {
  console.log('=== initDatabase called ===');
  if (db) {
    console.log('Database already initialized, returning existing instance');
    return db;
  }
  
  console.log('Loading sql.js...');
  const SQL = await initSqlJs({
    locateFile: (file) => {
      console.log('Locating file:', file);
      // We copied sql-wasm.wasm to the public folder, so we can load it from the root
      return `/${file}`;
    }
  });
  console.log('sql.js loaded successfully');
  
  // Try to load existing data
  console.log('Loading from IndexedDB...');
  const savedData = await loadFromIndexedDB();
  
  if (savedData) {
    console.log('Found saved data, restoring database');
    db = new SQL.Database(savedData);
    ensureSchema(db);
  } else {
    console.log('No saved data, creating new database');
    db = new SQL.Database();
    createTables(db);
  }
  console.log('Database initialization complete');
  
  return db;
}

// Save database to IndexedDB
export async function saveDatabase(): Promise<void> {
  if (!db) return;
  const data = db.export();
  await saveToIndexedDB(data);
}

// Create tables
function createTables(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      is_raw_resource INTEGER NOT NULL DEFAULT 0,
      base_production_rate REAL
    );
    
    CREATE TABLE IF NOT EXISTS machines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      area INTEGER
    );
    
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      machine_id TEXT NOT NULL,
      name TEXT NOT NULL,
      output_item_id TEXT NOT NULL,
      output_amount REAL NOT NULL,
      crafting_time REAL NOT NULL,
      FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
      FOREIGN KEY (output_item_id) REFERENCES items(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS recipe_inputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS zones (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      output_ports INTEGER NOT NULL DEFAULT 6,
      input_ports INTEGER NOT NULL DEFAULT 32,
      port_throughput REAL NOT NULL DEFAULT 30,
      machine_slots INTEGER,
      area_limit INTEGER
    );
    
    CREATE TABLE IF NOT EXISTS zone_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      zone_id TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      machine_count REAL NOT NULL DEFAULT 0,
      locked INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      UNIQUE(zone_id, recipe_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_recipes_machine ON recipes(machine_id);
    CREATE INDEX IF NOT EXISTS idx_recipes_output ON recipes(output_item_id);
    CREATE INDEX IF NOT EXISTS idx_recipe_inputs_recipe ON recipe_inputs(recipe_id);
    CREATE INDEX IF NOT EXISTS idx_zone_assignments_zone ON zone_assignments(zone_id);
  `);
}

function ensureSchema(database: Database): void {
  // machines.area
  const mInfo = database.exec(`PRAGMA table_info(machines);`);
  const mCols = new Set((mInfo[0]?.values || []).map((r) => r[1] as string));
  if (!mCols.has('area')) {
    database.run(`ALTER TABLE machines ADD COLUMN area INTEGER;`);
  }

  // zones.area_limit
  const zInfo = database.exec(`PRAGMA table_info(zones);`);
  const zCols = new Set((zInfo[0]?.values || []).map((r) => r[1] as string));
  if (!zCols.has('area_limit')) {
    database.run(`ALTER TABLE zones ADD COLUMN area_limit INTEGER;`);
  }
}

// Get database instance
export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// Item CRUD operations
export function getAllItems(): Item[] {
  const database = getDatabase();
  const results = database.exec(`SELECT * FROM items ORDER BY name`);
  
  if (results.length === 0) return [];
  
  return results[0].values.map((row) => ({
    id: row[0] as string,
    name: row[1] as string,
    price: row[2] as number,
    isRawResource: row[3] === 1,
    baseProductionRate: row[4] as number | undefined,
  }));
}

export function getItemById(id: string): Item | null {
  const database = getDatabase();
  const stmt = database.prepare(`SELECT * FROM items WHERE id = ?`);
  stmt.bind([id]);
  
  if (stmt.step()) {
    const row = stmt.get();
    stmt.free();
    return {
      id: row[0] as string,
      name: row[1] as string,
      price: row[2] as number,
      isRawResource: row[3] === 1,
      baseProductionRate: row[4] as number | undefined,
    };
  }
  
  stmt.free();
  return null;
}

export function createItem(item: Item): void {
  const database = getDatabase();
  database.run(
    `INSERT INTO items (id, name, price, is_raw_resource, base_production_rate) VALUES (?, ?, ?, ?, ?)`,
    [item.id, item.name, item.price, item.isRawResource ? 1 : 0, item.baseProductionRate ?? null]
  );
}

export function updateItem(item: Item): void {
  const database = getDatabase();
  database.run(
    `UPDATE items SET name = ?, price = ?, is_raw_resource = ?, base_production_rate = ? WHERE id = ?`,
    [item.name, item.price, item.isRawResource ? 1 : 0, item.baseProductionRate ?? null, item.id]
  );
}

export function deleteItem(id: string): void {
  const database = getDatabase();
  database.run(`DELETE FROM items WHERE id = ?`, [id]);
}

// Machine CRUD operations
export function getAllMachines(): Machine[] {
  const database = getDatabase();
  const results = database.exec(`SELECT * FROM machines ORDER BY name`);
  
  if (results.length === 0) return [];
  
  return results[0].values.map((row) => ({
    id: row[0] as string,
    name: row[1] as string,
    description: row[2] as string,
    area: row[3] as number | undefined,
  }));
}

export function getMachineById(id: string): Machine | null {
  const database = getDatabase();
  const stmt = database.prepare(`SELECT * FROM machines WHERE id = ?`);
  stmt.bind([id]);
  
  if (stmt.step()) {
    const row = stmt.get();
    stmt.free();
    return {
      id: row[0] as string,
      name: row[1] as string,
      description: row[2] as string,
      area: row[3] as number | undefined,
    };
  }
  
  stmt.free();
  return null;
}

export function createMachine(machine: Machine): void {
  const database = getDatabase();
  database.run(
    `INSERT INTO machines (id, name, description, area) VALUES (?, ?, ?, ?)`,
    [machine.id, machine.name, machine.description, machine.area ?? null]
  );
}

export function updateMachine(machine: Machine): void {
  const database = getDatabase();
  database.run(
    `UPDATE machines SET name = ?, description = ?, area = ? WHERE id = ?`,
    [machine.name, machine.description, machine.area ?? null, machine.id]
  );
}

export function deleteMachine(id: string): void {
  const database = getDatabase();
  database.run(`DELETE FROM machines WHERE id = ?`, [id]);
}

// Recipe CRUD operations
export function getAllRecipes(): Recipe[] {
  const database = getDatabase();
  const results = database.exec(`SELECT * FROM recipes ORDER BY name`);
  
  if (results.length === 0) return [];
  
  return results[0].values.map((row) => {
    const recipeId = row[0] as string;
    return {
      id: recipeId,
      machineId: row[1] as string,
      name: row[2] as string,
      outputItemId: row[3] as string,
      outputAmount: row[4] as number,
      craftingTime: row[5] as number,
      inputs: getRecipeInputs(recipeId),
    };
  });
}

export function getRecipeById(id: string): Recipe | null {
  const database = getDatabase();
  const stmt = database.prepare(`SELECT * FROM recipes WHERE id = ?`);
  stmt.bind([id]);
  
  if (stmt.step()) {
    const row = stmt.get();
    stmt.free();
    return {
      id: row[0] as string,
      machineId: row[1] as string,
      name: row[2] as string,
      outputItemId: row[3] as string,
      outputAmount: row[4] as number,
      craftingTime: row[5] as number,
      inputs: getRecipeInputs(row[0] as string),
    };
  }
  
  stmt.free();
  return null;
}

export function getRecipesByMachine(machineId: string): Recipe[] {
  const database = getDatabase();
  const stmt = database.prepare(`SELECT * FROM recipes WHERE machine_id = ? ORDER BY name`);
  stmt.bind([machineId]);
  
  const recipes: Recipe[] = [];
  while (stmt.step()) {
    const row = stmt.get();
    recipes.push({
      id: row[0] as string,
      machineId: row[1] as string,
      name: row[2] as string,
      outputItemId: row[3] as string,
      outputAmount: row[4] as number,
      craftingTime: row[5] as number,
      inputs: getRecipeInputs(row[0] as string),
    });
  }
  
  stmt.free();
  return recipes;
}

export function getRecipesByOutputItem(itemId: string): Recipe[] {
  const database = getDatabase();
  const stmt = database.prepare(`SELECT * FROM recipes WHERE output_item_id = ? ORDER BY name`);
  stmt.bind([itemId]);
  
  const recipes: Recipe[] = [];
  while (stmt.step()) {
    const row = stmt.get();
    recipes.push({
      id: row[0] as string,
      machineId: row[1] as string,
      name: row[2] as string,
      outputItemId: row[3] as string,
      outputAmount: row[4] as number,
      craftingTime: row[5] as number,
      inputs: getRecipeInputs(row[0] as string),
    });
  }
  
  stmt.free();
  return recipes;
}

function getRecipeInputs(recipeId: string): RecipeInput[] {
  const database = getDatabase();
  const stmt = database.prepare(`SELECT item_id, amount FROM recipe_inputs WHERE recipe_id = ?`);
  stmt.bind([recipeId]);
  
  const inputs: RecipeInput[] = [];
  while (stmt.step()) {
    const row = stmt.get();
    inputs.push({
      itemId: row[0] as string,
      amount: row[1] as number,
    });
  }
  
  stmt.free();
  return inputs;
}

export function createRecipe(recipe: Recipe): void {
  const database = getDatabase();
  database.run(
    `INSERT INTO recipes (id, machine_id, name, output_item_id, output_amount, crafting_time) VALUES (?, ?, ?, ?, ?, ?)`,
    [recipe.id, recipe.machineId, recipe.name, recipe.outputItemId, recipe.outputAmount, recipe.craftingTime]
  );
  
  // Insert inputs
  for (const input of recipe.inputs) {
    database.run(
      `INSERT INTO recipe_inputs (recipe_id, item_id, amount) VALUES (?, ?, ?)`,
      [recipe.id, input.itemId, input.amount]
    );
  }
}

export function updateRecipe(recipe: Recipe): void {
  const database = getDatabase();
  database.run(
    `UPDATE recipes SET machine_id = ?, name = ?, output_item_id = ?, output_amount = ?, crafting_time = ? WHERE id = ?`,
    [recipe.machineId, recipe.name, recipe.outputItemId, recipe.outputAmount, recipe.craftingTime, recipe.id]
  );
  
  // Delete existing inputs and re-insert
  database.run(`DELETE FROM recipe_inputs WHERE recipe_id = ?`, [recipe.id]);
  
  for (const input of recipe.inputs) {
    database.run(
      `INSERT INTO recipe_inputs (recipe_id, item_id, amount) VALUES (?, ?, ?)`,
      [recipe.id, input.itemId, input.amount]
    );
  }
}

export function deleteRecipe(id: string): void {
  const database = getDatabase();
  database.run(`DELETE FROM recipes WHERE id = ?`, [id]);
}

// Utility function to get raw resources
export function getRawResources(): Item[] {
  const database = getDatabase();
  const results = database.exec(`SELECT * FROM items WHERE is_raw_resource = 1 ORDER BY name`);
  
  if (results.length === 0) return [];
  
  return results[0].values.map((row) => ({
    id: row[0] as string,
    name: row[1] as string,
    price: row[2] as number,
    isRawResource: true,
    baseProductionRate: row[4] as number | undefined,
  }));
}

// Clear all data
export function clearAllData(): void {
  const database = getDatabase();
  database.run(`DELETE FROM recipe_inputs`);
  database.run(`DELETE FROM recipes`);
  database.run(`DELETE FROM machines`);
  database.run(`DELETE FROM items`);
}

// Bulk insert functions for game data loading
export function bulkInsertItems(items: Item[]): void {
  const database = getDatabase();
  for (const item of items) {
    database.run(
      `INSERT OR REPLACE INTO items (id, name, price, is_raw_resource, base_production_rate) VALUES (?, ?, ?, ?, ?)`,
      [item.id, item.name, item.price, item.isRawResource ? 1 : 0, item.baseProductionRate ?? null]
    );
  }
}

export function bulkInsertMachines(machines: Machine[]): void {
  const database = getDatabase();
  for (const machine of machines) {
    database.run(
      `INSERT OR REPLACE INTO machines (id, name, description, area) VALUES (?, ?, ?, ?)`,
      [machine.id, machine.name, machine.description, machine.area ?? null]
    );
  }
}

export function bulkInsertRecipes(recipes: Recipe[]): void {
  const database = getDatabase();
  for (const recipe of recipes) {
    database.run(
      `INSERT OR REPLACE INTO recipes (id, machine_id, name, output_item_id, output_amount, crafting_time) VALUES (?, ?, ?, ?, ?, ?)`,
      [recipe.id, recipe.machineId, recipe.name, recipe.outputItemId, recipe.outputAmount, recipe.craftingTime]
    );
    
    // Delete existing inputs first
    database.run(`DELETE FROM recipe_inputs WHERE recipe_id = ?`, [recipe.id]);
    
    // Insert inputs
    for (const input of recipe.inputs) {
      database.run(
        `INSERT INTO recipe_inputs (recipe_id, item_id, amount) VALUES (?, ?, ?)`,
        [recipe.id, input.itemId, input.amount]
      );
    }
  }
}

// Check if database has any data
export function hasData(): boolean {
  const database = getDatabase();
  const results = database.exec(`SELECT COUNT(*) FROM items`);
  if (results.length === 0) return false;
  return (results[0].values[0][0] as number) > 0;
}

// Update item price
export function updateItemPrice(id: string, price: number): void {
  const database = getDatabase();
  database.run(`UPDATE items SET price = ? WHERE id = ?`, [price, id]);
}

// Update raw resource limit
export function updateResourceLimit(id: string, limit: number): void {
  const database = getDatabase();
  database.run(`UPDATE items SET base_production_rate = ? WHERE id = ?`, [limit, id]);
}

// ============================================
// ZONE CRUD OPERATIONS
// ============================================

export function getAllZones(): Zone[] {
  const database = getDatabase();
  const results = database.exec(`SELECT * FROM zones ORDER BY name`);
  
  if (results.length === 0) return [];
  
  return results[0].values.map((row) => ({
    id: row[0] as string,
    name: row[1] as string,
    outputPorts: row[2] as number,
    inputPorts: row[3] as number,
    portThroughput: row[4] as number,
    machineSlots: row[5] as number | undefined,
    areaLimit: row[6] as number | undefined,
  }));
}

export function getZoneById(id: string): Zone | null {
  const database = getDatabase();
  const stmt = database.prepare(`SELECT * FROM zones WHERE id = ?`);
  stmt.bind([id]);
  
  if (stmt.step()) {
    const row = stmt.get();
    stmt.free();
    return {
      id: row[0] as string,
      name: row[1] as string,
      outputPorts: row[2] as number,
      inputPorts: row[3] as number,
      portThroughput: row[4] as number,
      machineSlots: row[5] as number | undefined,
      areaLimit: row[6] as number | undefined,
    };
  }
  
  stmt.free();
  return null;
}

export function createZone(zone: Zone): void {
  const database = getDatabase();
  database.run(
    `INSERT INTO zones (id, name, output_ports, input_ports, port_throughput, machine_slots, area_limit) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [zone.id, zone.name, zone.outputPorts, zone.inputPorts, zone.portThroughput, zone.machineSlots ?? null, zone.areaLimit ?? null]
  );
}

export function updateZone(zone: Zone): void {
  const database = getDatabase();
  database.run(
    `UPDATE zones SET name = ?, output_ports = ?, input_ports = ?, port_throughput = ?, machine_slots = ?, area_limit = ? WHERE id = ?`,
    [zone.name, zone.outputPorts, zone.inputPorts, zone.portThroughput, zone.machineSlots ?? null, zone.areaLimit ?? null, zone.id]
  );
}

export function deleteZone(id: string): void {
  const database = getDatabase();
  database.run(`DELETE FROM zones WHERE id = ?`, [id]);
}

// ============================================
// ZONE ASSIGNMENT OPERATIONS
// ============================================

export function getZoneAssignments(zoneId: string): ZoneAssignment[] {
  const database = getDatabase();
  const stmt = database.prepare(`SELECT zone_id, recipe_id, machine_count, locked FROM zone_assignments WHERE zone_id = ?`);
  stmt.bind([zoneId]);
  
  const assignments: ZoneAssignment[] = [];
  while (stmt.step()) {
    const row = stmt.get();
    assignments.push({
      zoneId: row[0] as string,
      recipeId: row[1] as string,
      machineCount: row[2] as number,
      utilization: 0,
      requiredRate: 0, // Will be recalculated
      actualRate: 0,
      excessRate: 0,
      locked: row[3] === 1,
    });
  }
  
  stmt.free();
  return assignments;
}

export function getAllZoneAssignments(): ZoneAssignment[] {
  const database = getDatabase();
  const results = database.exec(`SELECT zone_id, recipe_id, machine_count, locked FROM zone_assignments`);
  
  if (results.length === 0) return [];
  
  return results[0].values.map((row) => ({
    zoneId: row[0] as string,
    recipeId: row[1] as string,
    machineCount: row[2] as number,
    utilization: 0,
    requiredRate: 0,
    actualRate: 0,
    excessRate: 0,
    locked: row[3] === 1,
  }));
}

export function setZoneAssignment(assignment: ZoneAssignment): void {
  const database = getDatabase();
  database.run(
    `INSERT OR REPLACE INTO zone_assignments (zone_id, recipe_id, machine_count, locked) VALUES (?, ?, ?, ?)`,
    [assignment.zoneId, assignment.recipeId, assignment.machineCount, assignment.locked ? 1 : 0]
  );
}

export function deleteZoneAssignment(zoneId: string, recipeId: string): void {
  const database = getDatabase();
  database.run(`DELETE FROM zone_assignments WHERE zone_id = ? AND recipe_id = ?`, [zoneId, recipeId]);
}

export function clearZoneAssignments(zoneId: string): void {
  const database = getDatabase();
  database.run(`DELETE FROM zone_assignments WHERE zone_id = ?`, [zoneId]);
}

export function clearAllZoneAssignments(): void {
  const database = getDatabase();
  database.run(`DELETE FROM zone_assignments`);
}

// Bulk update zone assignments (used by optimizer)
export function bulkSetZoneAssignments(assignments: ZoneAssignment[]): void {
  const database = getDatabase();
  
  for (const assignment of assignments) {
    if (assignment.machineCount > 0) {
      database.run(
        `INSERT OR REPLACE INTO zone_assignments (zone_id, recipe_id, machine_count, locked) VALUES (?, ?, ?, ?)`,
        [assignment.zoneId, assignment.recipeId, assignment.machineCount, assignment.locked ? 1 : 0]
      );
    } else {
      // Remove assignment if machine count is 0
      database.run(
        `DELETE FROM zone_assignments WHERE zone_id = ? AND recipe_id = ?`,
        [assignment.zoneId, assignment.recipeId]
      );
    }
  }
}
