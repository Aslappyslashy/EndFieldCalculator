import { useRecipes, useItems, useMachines } from '../hooks/useDatabase';

export function RecipeManager() {
  const { recipes } = useRecipes();
  const { items } = useItems();
  const { machines } = useMachines();

  const getItemName = (id: string) => items.find(i => i.id === id)?.name || '未知物品';
  const getMachineName = (id: string) => machines.find(m => m.id === id)?.name || '未知设备';

  return (
    <div className="recipe-manager">
      <div className="view-header">
        <h2>加工配方库</h2>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>配方名称</th>
              <th>生产设备</th>
              <th>产出物</th>
              <th>耗时</th>
              <th>消耗原料</th>
            </tr>
          </thead>
          <tbody>
            {recipes.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-state">
                  暂无配方数据。请先在物品管理页面加载协议。
                </td>
              </tr>
            ) : (
              recipes.map((recipe) => (
                <tr key={recipe.id}>
                  <td>{recipe.name}</td>
                  <td>{getMachineName(recipe.machineId)}</td>
                  <td>
                    {recipe.outputAmount}x {getItemName(recipe.outputItemId)}
                  </td>
                  <td>{recipe.craftingTime}s</td>
                  <td>
                    {recipe.inputs.length === 0 ? '-' : (
                      <ul className="input-list">
                        {recipe.inputs.map((input, i) => (
                          <li key={i}>
                            {input.amount}x {getItemName(input.itemId)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
