import { useState } from 'react';
import { Plus, Trash2, Edit2, Save, Download, AlertCircle, Package } from 'lucide-react';
import { useItems, useMachines, useRecipes } from '../hooks/useDatabase';
import { dataService, type GameData } from '../services/dataService';
import type { Item, Machine, Recipe, RecipeInput } from '../types';
import * as db from '../db/database';

type Tab = 'items' | 'machines' | 'recipes';

export function ItemManager() {
  const [activeTab, setActiveTab] = useState<Tab>('items');
  const { items, refresh: refreshItems } = useItems();
  const { machines, refresh: refreshMachines } = useMachines();
  const { recipes, refresh: refreshRecipes } = useRecipes();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<Partial<Item>>({ name: '', price: 0, isRawResource: false, baseProductionRate: 0 });
  const [machineForm, setMachineForm] = useState<Partial<Machine>>({ name: '', description: '', area: 0, electricity: 0 });
  const [recipeForm, setRecipeForm] = useState<Partial<Recipe>>({ name: '', machineId: '', outputItemId: '', outputAmount: 1, craftingTime: 2, inputs: [] });

  const handleSyncFromBackend = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await dataService.getGameData();
      db.clearAllData();
      db.bulkInsertItems(data.items);
      db.bulkInsertMachines(data.machines);
      db.bulkInsertRecipes(data.recipes);
      await db.saveDatabase();
      refreshItems();
      refreshMachines();
      refreshRecipes();
      alert('已从磁盘同步协议数据。');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToBackend = async () => {
    if (!confirm('确认将当前所有修改保存到本地 JSON 文件？这会覆盖磁盘上的数据。')) return;
    setLoading(true);
    setError(null);
    try {
      const data: GameData = {
        items: db.getAllItems(),
        machines: db.getAllMachines(),
        recipes: db.getAllRecipes()
      };
      await dataService.saveGameData(data);
      alert('保存成功！数据已更新至 src/data/gameData.json');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name) return;
    const id = editingId || `item_${Math.random().toString(36).substr(2, 9)}`;
    const newItem: Item = { ...itemForm as Item, id };
    if (editingId) db.updateItem(newItem);
    else db.createItem(newItem);
    await db.saveDatabase();
    refreshItems();
    setItemForm({ name: '', price: 0, isRawResource: false, baseProductionRate: 0 });
    setEditingId(null);
  };

  const deleteItem = (id: string) => {
    if (!confirm('确定删除此物品？相关配方也会被删除。')) return;
    db.deleteItem(id);
    db.saveDatabase().then(() => {
      refreshItems();
      refreshRecipes();
    });
  };

  const handleMachineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineForm.name) return;
    const id = editingId || `machine_${Math.random().toString(36).substr(2, 9)}`;
    const newMachine: Machine = { ...machineForm as Machine, id };
    if (editingId) db.updateMachine(newMachine);
    else db.createMachine(newMachine);
    await db.saveDatabase();
    refreshMachines();
    setMachineForm({ name: '', description: '', area: 0 });
    setEditingId(null);
  };

  const deleteMachine = (id: string) => {
    if (!confirm('确定删除此机器？相关配方也会被删除。')) return;
    db.deleteMachine(id);
    db.saveDatabase().then(() => {
      refreshMachines();
      refreshRecipes();
    });
  };

  const handleRecipeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeForm.name || !recipeForm.machineId || !recipeForm.outputItemId) return;
    const id = editingId || `recipe_${Math.random().toString(36).substr(2, 9)}`;
    const newRecipe: Recipe = { ...recipeForm as Recipe, id };
    if (editingId) db.updateRecipe(newRecipe);
    else db.createRecipe(newRecipe);
    await db.saveDatabase();
    refreshRecipes();
    setRecipeForm({ name: '', machineId: '', outputItemId: '', outputAmount: 1, craftingTime: 2, inputs: [] });
    setEditingId(null);
  };

  const addRecipeInput = () => {
    setRecipeForm(prev => ({
      ...prev,
      inputs: [...(prev.inputs || []), { itemId: '', amount: 1 }]
    }));
  };

  const removeRecipeInput = (index: number) => {
    setRecipeForm(prev => ({
      ...prev,
      inputs: prev.inputs?.filter((_, i) => i !== index)
    }));
  };

  const updateRecipeInput = (index: number, field: keyof RecipeInput, value: any) => {
    setRecipeForm(prev => ({
      ...prev,
      inputs: prev.inputs?.map((inp, i) => i === index ? { ...inp, [field]: value } : inp)
    }));
  };

  const deleteRecipe = (id: string) => {
    if (!confirm('确定删除此配方？')) return;
    db.deleteRecipe(id);
    db.saveDatabase().then(() => {
      refreshRecipes();
    });
  };

  return (
    <div className="item-manager h-full flex flex-col overflow-hidden">
      <div className="view-header flex justify-between items-center p-4 bg-sidebar border-b border-border">
        <h2 className="text-xl font-bold text-accent">工业协议中心</h2>
        <div className="flex gap-2">
          <button onClick={handleSyncFromBackend} className="btn btn-secondary flex items-center gap-2" disabled={loading}>
            <Download size={16} /> 从磁盘同步
          </button>
          <button onClick={handleSaveToBackend} className="btn btn-primary flex items-center gap-2" disabled={loading}>
            <Save size={16} /> 保存到磁盘
          </button>
        </div>
      </div>

      {error && (
        <div className="m-4 p-3 bg-error/20 border border-error text-error rounded flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="w-48 bg-sidebar border-r border-border flex flex-col">
          <button onClick={() => {setActiveTab('items'); setEditingId(null);}} className={`p-4 text-left hover:bg-white/5 ${activeTab === 'items' ? 'text-accent border-r-2 border-accent bg-accent/10' : ''}`}>物品协议</button>
          <button onClick={() => {setActiveTab('machines'); setEditingId(null);}} className={`p-4 text-left hover:bg-white/5 ${activeTab === 'machines' ? 'text-accent border-r-2 border-accent bg-accent/10' : ''}`}>机器设备</button>
          <button onClick={() => {setActiveTab('recipes'); setEditingId(null);}} className={`p-4 text-left hover:bg-white/5 ${activeTab === 'recipes' ? 'text-accent border-r-2 border-accent bg-accent/10' : ''}`}>加工配方</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-main">
          {activeTab === 'items' && (
            <div className="space-y-6">
              <form onSubmit={handleItemSubmit} className="form elevated">
                <div className="form-row">
                  <div className="form-group">
                    <label>物品名称</label>
                    <input value={itemForm.name || ''} onChange={e => setItemForm({...itemForm, name: e.target.value})} placeholder="例如: 蓝铁块" />
                  </div>
                  <div className="form-group">
                    <label>回收价格 ($)</label>
                    <input type="number" value={itemForm.price || 0} onChange={e => setItemForm({...itemForm, price: parseFloat(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label>源类型</label>
                    <select value={itemForm.isRawResource ? 'yes' : 'no'} onChange={e => setItemForm({...itemForm, isRawResource: e.target.value === 'yes'})}>
                      <option value="no">加工产物</option>
                      <option value="yes">原始资源</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  {editingId && <button type="button" onClick={() => {setEditingId(null); setItemForm({name:'', price:0, isRawResource:false});}} className="btn btn-secondary">取消</button>}
                  <button type="submit" className="btn btn-primary flex items-center gap-2">
                    {editingId ? <><Edit2 size={16}/> 更新物品</> : <><Plus size={16}/> 添加物品</>}
                  </button>
                </div>
              </form>

              {items.length > 0 ? (
                <div className="table-container">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-dim border-b border-border">
                        <th className="p-2">名称</th>
                        <th className="p-2">价格</th>
                        <th className="p-2">类型</th>
                        <th className="p-2 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item.id} className="hover:bg-white/5 group">
                          <td className="p-2 font-bold">{item.name}</td>
                          <td className="p-2 text-success" style={{color: 'var(--c-success)', opacity: 1}}>{item.price > 0 ? `$${item.price}` : '--'}</td>
                          <td className="p-2">{item.isRawResource ? <span className="text-accent">原始资源</span> : '加工产物'}</td>
                          <td className="p-2 flex justify-end gap-2 opacity-0 group-hover-visible transition-opacity">
                            <button onClick={() => { setEditingId(item.id); setItemForm(item); }} className="p-1 hover:text-accent"><Edit2 size={16}/></button>
                            <button onClick={() => deleteItem(item.id)} className="p-1 hover:text-error"><Trash2 size={16}/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state p-12 text-center border border-dashed border-border rounded">
                  <Package size={48} className="mx-auto mb-4 opacity-20" style={{display: 'block', margin: '0 auto 1rem'}} />
                  <p className="text-dim">暂无物品协议。请使用上方表单添加或从磁盘同步。</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'machines' && (
            <div className="space-y-6">
              <form onSubmit={handleMachineSubmit} className="form elevated">
                <div className="form-row">
                  <div className="form-group">
                    <label>机器名称</label>
                    <input value={machineForm.name || ''} onChange={e => setMachineForm({...machineForm, name: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>占地面积 (m²)</label>
                    <input type="number" value={machineForm.area || 0} onChange={e => setMachineForm({...machineForm, area: parseInt(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label>耗电量 (/min)</label>
                    <input type="number" value={machineForm.electricity || 0} onChange={e => setMachineForm({...machineForm, electricity: parseFloat(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label>描述</label>
                    <input value={machineForm.description || ''} onChange={e => setMachineForm({...machineForm, description: e.target.value})} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  {editingId && <button type="button" onClick={() => {setEditingId(null); setMachineForm({name:'', area:0, description:'', electricity:0});}} className="btn btn-secondary">取消</button>}
                  <button type="submit" className="btn btn-primary flex items-center gap-2">
                    {editingId ? <><Edit2 size={16}/> 更新机器</> : <><Plus size={16}/> 添加机器</>}
                  </button>
                </div>
              </form>

              <div className="grid grid-cols-2 gap-4">
                {machines.map(m => (
                  <div key={m.id} className="bg-sidebar p-4 rounded border border-border flex justify-between items-center group">
                    <div>
                      <h3 className="font-bold text-accent">{m.name}</h3>
                      <p className="text-xs text-dim">{m.area} m² | {m.electricity || 0} E/min - {m.description}</p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover-visible transition-opacity">
                      <button onClick={() => { setEditingId(m.id); setMachineForm(m); }} className="p-1 hover:text-accent"><Edit2 size={16}/></button>
                      <button onClick={() => deleteMachine(m.id)} className="p-1 hover:text-error"><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'recipes' && (
            <div className="space-y-6">
              <form onSubmit={handleRecipeSubmit} className="form elevated">
                <div className="form-row">
                  <div className="form-group">
                    <label>配方名称</label>
                    <input value={recipeForm.name || ''} onChange={e => setRecipeForm({...recipeForm, name: e.target.value})} placeholder="例如: 蓝铁矿炼制" />
                  </div>
                  <div className="form-group">
                    <label>生产机器</label>
                    <select value={recipeForm.machineId || ''} onChange={e => setRecipeForm({...recipeForm, machineId: e.target.value})}>
                      <option value="">选择机器...</option>
                      {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>产出物品</label>
                    <select value={recipeForm.outputItemId || ''} onChange={e => setRecipeForm({...recipeForm, outputItemId: e.target.value})}>
                      <option value="">选择物品...</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>产出数量</label>
                    <input type="number" value={recipeForm.outputAmount || 0} onChange={e => setRecipeForm({...recipeForm, outputAmount: parseFloat(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label>耗时 (秒)</label>
                    <input type="number" value={recipeForm.craftingTime || 0} onChange={e => setRecipeForm({...recipeForm, craftingTime: parseFloat(e.target.value)})} />
                  </div>
                </div>

                <div className="space-y-2 mt-4" style={{borderTop: '1px solid var(--c-border)', paddingTop: '1rem'}}>
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-accent font-bold uppercase tracking-wider">原料消耗</label>
                    <button type="button" onClick={addRecipeInput} className="text-xs text-accent flex items-center gap-1 hover:underline"><Plus size={12}/> 添加原料</button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {recipeForm.inputs?.map((inp, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-input p-1 rounded border border-border/30">
                        <select value={inp.itemId} onChange={e => updateRecipeInput(idx, 'itemId', e.target.value)} className="flex-1 text-sm bg-transparent border-none">
                          <option value="">选择原料...</option>
                          {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                        <input type="number" value={inp.amount} onChange={e => updateRecipeInput(idx, 'amount', parseFloat(e.target.value))} className="w-24 text-sm bg-transparent border-none text-right" placeholder="数量" />
                        <button type="button" onClick={() => removeRecipeInput(idx)} className="text-error p-2 hover:bg-error/10 rounded transition-colors"><Trash2 size={14}/></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-6">
                  <button type="submit" className="btn btn-primary flex-1">
                    {editingId ? <><Edit2 size={16}/> 更新配方</> : <><Plus size={16}/> 添加配方协议</>}
                  </button>
                  {editingId && <button type="button" onClick={() => {setEditingId(null); setRecipeForm({ name: '', machineId: '', outputItemId: '', outputAmount: 1, craftingTime: 2, inputs: [] });}} className="btn btn-secondary">取消</button>}
                </div>
              </form>

              <div className="space-y-2">
                {recipes.map(r => (
                  <div key={r.id} className="bg-sidebar p-3 rounded border border-border flex justify-between items-center group">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{r.name}</span>
                        <span className="text-xs bg-white/5 px-1 rounded text-dim uppercase">{machines.find(m => m.id === r.machineId)?.name}</span>
                      </div>
                      <div className="text-xs text-dim mt-1">
                        产出: <span className="text-success" style={{color: 'var(--c-success)', opacity: 1}}>{items.find(i => i.id === r.outputItemId)?.name} x{r.outputAmount}</span> ({r.craftingTime}s)
                        {' | '} 原料: {r.inputs.map(inp => `${items.find(i => i.id === inp.itemId)?.name} x${inp.amount}`).join(', ') || '无'}
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover-visible transition-opacity">
                      <button onClick={() => { setEditingId(r.id); setRecipeForm(r); }} className="p-1 hover:text-accent"><Edit2 size={16}/></button>
                      <button onClick={() => deleteRecipe(r.id)} className="p-1 hover:text-error"><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
