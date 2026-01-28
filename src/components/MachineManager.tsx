import { useMachines, useRecipes } from '../hooks/useDatabase';

export function MachineManager() {
  const { machines } = useMachines();
  const { recipes } = useRecipes();

  const getRecipeCount = (machineId: string) => {
    return recipes.filter(r => r.machineId === machineId).length;
  };

  return (
    <div className="machine-manager">
      <div className="view-header">
        <h2>工业设备库</h2>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>设备名称</th>
              <th>功能描述</th>
              <th>关联配方数</th>
            </tr>
          </thead>
          <tbody>
            {machines.length === 0 ? (
              <tr>
                <td colSpan={3} className="empty-state">
                  暂无设备数据。请先在物品管理页面加载协议。
                </td>
              </tr>
            ) : (
              machines.map((machine) => (
                <tr key={machine.id}>
                  <td>{machine.name}</td>
                  <td>{machine.description || '--'}</td>
                  <td>{getRecipeCount(machine.id)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
