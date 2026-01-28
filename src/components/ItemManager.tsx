import { useState } from 'react';
import { useItems, useMachines, useRecipes } from '../hooks/useDatabase';
import { getGameItems, getGameMachines, getGameRecipes } from '../data/gameData';
import * as db from '../db/database';

export function ItemManager() {
  const { items, refresh: refreshItems } = useItems();
  const { refresh: refreshMachines } = useMachines();
  const { refresh: refreshRecipes } = useRecipes();
  const [loading, setLoading] = useState(false);

  const handleLoadData = async () => {
    if (items.length > 0) {
      if (!confirm('此操作将覆盖当前所有物品协议数据。确认继续？')) return;
    }
    setLoading(true);
    try {
      // Clear existing data
      db.clearAllData();
      
      // Load game data
      const gameItems = getGameItems();
      const gameMachines = getGameMachines();
      const gameRecipes = getGameRecipes();
      
      db.bulkInsertItems(gameItems);
      db.bulkInsertMachines(gameMachines);
      db.bulkInsertRecipes(gameRecipes);
      
      // Save to IndexedDB
      await db.saveDatabase();
      
      // Refresh all hooks
      refreshItems();
      refreshMachines();
      refreshRecipes();
      
      alert('协议数据加载完成。');
    } catch (err) {
      console.error(err);
      alert('加载失败: ' + err);
    } finally {
      setLoading(false);
    }
  };

  const rawResources = items.filter(i => i.isRawResource);
  const craftedItems = items.filter(i => !i.isRawResource);
  const sellableItems = items.filter(i => i.price > 0);

  return (
    <div className="item-manager">
      <div className="view-header">
        <h2>物品协议清单</h2>
        <div className="header-actions">
          <button 
            onClick={handleLoadData} 
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? '同步中...' : '同步内置协议数据'}
          </button>
        </div>
      </div>

      <div className="stats-bar">
        <span>原始资源协议: {rawResources.length}</span>
        <span>加工产物协议: {craftedItems.length}</span>
        <span>可出售产物: {sellableItems.length}</span>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>物品名称</th>
              <th>单价 (基础)</th>
              <th>源类型</th>
              <th>基础产率 (/min)</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty-state">
                  暂无物品协议。点击上方按钮同步终末地工业数据。
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className={item.price > 0 ? 'sellable' : ''}>
                  <td>{item.name}</td>
                  <td>{item.price > 0 ? `$${item.price.toFixed(0)}` : '--'}</td>
                  <td>{item.isRawResource ? '原始资源' : '加工产物'}</td>
                  <td>{item.baseProductionRate ? `${item.baseProductionRate}/min` : '--'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
