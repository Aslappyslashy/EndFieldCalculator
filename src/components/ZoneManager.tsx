import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Zone } from '../types';
import { useZones, useZoneAssignments } from '../hooks/useDatabase';
import { Plus, Edit2, Trash2, Info } from 'lucide-react';

interface ZoneFormData {
  name: string;
  outputPorts: string;
  inputPorts: string;
  portThroughput: string;
  machineSlots: string;
  areaLimit: string;
}

const defaultForm: ZoneFormData = {
  name: '',
  outputPorts: '6',
  inputPorts: '32',
  portThroughput: '30',
  machineSlots: '',
  areaLimit: '',
};

export function ZoneManager() {
  const { zones, createZone, updateZone, deleteZone } = useZones();
  const { assignments, clearZone } = useZoneAssignments();
  const [form, setForm] = useState<ZoneFormData>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const zone: Zone = {
      id: editingId || uuidv4(),
      name: form.name.trim(),
      outputPorts: parseInt(form.outputPorts) || 6,
      inputPorts: parseInt(form.inputPorts) || 32,
      portThroughput: parseFloat(form.portThroughput) || 30,
      machineSlots: form.machineSlots ? parseInt(form.machineSlots) : undefined,
      areaLimit: form.areaLimit ? parseInt(form.areaLimit) : undefined,
    };

    if (editingId) {
      await updateZone(zone);
    } else {
      await createZone(zone);
    }

    setForm(defaultForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (zone: Zone) => {
    setForm({
      name: zone.name,
      outputPorts: zone.outputPorts.toString(),
      inputPorts: zone.inputPorts.toString(),
      portThroughput: zone.portThroughput.toString(),
      machineSlots: zone.machineSlots?.toString() || '',
      areaLimit: zone.areaLimit?.toString() || '',
    });
    setEditingId(zone.id);
    setShowForm(true);
  };

  const handleDelete = async (zone: Zone) => {
    const zoneAssignments = assignments.filter(a => a.zoneId === zone.id);
    if (zoneAssignments.length > 0) {
      if (!confirm(`区域 "${zone.name}" 包含 ${zoneAssignments.length} 个设备配置。确定要移除吗？`)) {
        return;
      }
      await clearZone(zone.id);
    }
    await deleteZone(zone.id);
  };

  const handleCancel = () => {
    setForm(defaultForm);
    setEditingId(null);
    setShowForm(false);
  };

  const getZoneStats = (zoneId: string) => {
    const zoneAssignments = assignments.filter(a => a.zoneId === zoneId);
    const totalMachines = zoneAssignments.reduce((sum, a) => sum + a.machineCount, 0);
    return {
      recipeCount: zoneAssignments.length,
      totalMachines: totalMachines,
    };
  };

  return (
    <div className="zone-manager">
      <div className="view-header">
        <h2>地块区域管理</h2>
        <div className="header-actions">
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2">
              <Plus size={18} /> 建立新区域
            </button>
          )}
        </div>
      </div>

      <div className="zone-info-box">
        <h4 className="flex items-center gap-2"><Info size={18} className="text-accent" /> 区域协议说明</h4>
        <p>
          工业地块是生产的基本单位。核心瓶颈在于 <strong>[出口端口]</strong>。
        </p>
        <div className="info-grid">
          <div className="info-item">
            <strong>出口端口 (Output Ports)</strong>
            <span>将物品从地块 提取 到全局资源池。受限端口。</span>
          </div>
          <div className="info-item">
            <strong>入口端口 (Input Ports)</strong>
            <span>将产物从地块 注入 到全局资源池。通常资源充足。</span>
          </div>
          <div className="info-item">
            <strong>地块内循环 (Intra-zone)</strong>
            <span>在同一地块内产出并消耗的物品 不占用 端口配额。</span>
          </div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="form elevated">
          <div className="form-group">
            <label>地块名称</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例如：熔炼中心-A, 自动化组装线"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>出口端口数量</label>
              <input
                type="number"
                value={form.outputPorts}
                onChange={(e) => setForm({ ...form, outputPorts: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>端口单体吞吐量</label>
              <input
                type="number"
                step="0.1"
                value={form.portThroughput}
                onChange={(e) => setForm({ ...form, portThroughput: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>设备位上限 (可选)</label>
            <input
              type="number"
              value={form.machineSlots}
              onChange={(e) => setForm({ ...form, machineSlots: e.target.value })}
              placeholder="留空表示无限制"
            />
          </div>

          <div className="form-group">
            <label>面积上限 (可选)</label>
            <input
              type="number"
              value={form.areaLimit}
              onChange={(e) => setForm({ ...form, areaLimit: e.target.value })}
              placeholder="留空表示无限制"
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">{editingId ? '更新协议' : '确认建立'}</button>
            <button type="button" onClick={handleCancel} className="btn btn-secondary">取消</button>
          </div>
        </form>
      )}

      <div className="zone-grid">
        {zones.map((zone) => {
          const stats = getZoneStats(zone.id);
          return (
            <div key={zone.id} className="zone-card">
              <div className="zone-card-header">
                <h3>{zone.name}</h3>
                <div className="actions flex gap-2">
                  <button onClick={() => handleEdit(zone)} className="btn btn-icon" title="编辑"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(zone)} className="btn btn-icon btn-danger" title="移除"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="zone-stats">
                <div className="stat-line">
                  <span className="label">物流出口上限</span>
                  <span className="value accent">{(zone.outputPorts * zone.portThroughput).toFixed(0)} /min</span>
                </div>
                <div className="stat-line">
                  <span className="label">当前配置设备</span>
                  <span className="value">{stats.totalMachines.toFixed(1)} 台</span>
                </div>
                <div className="stat-line">
                  <span className="label">包含配方协议</span>
                  <span className="value">{stats.recipeCount} 项</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
