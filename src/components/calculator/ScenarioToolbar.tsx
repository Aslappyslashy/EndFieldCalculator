import { useRef } from 'react';
import { Plus, Download, Save, Settings2, Upload, Edit2, Trash2 } from 'lucide-react';

interface ScenarioToolbarProps {
  scenarios: any[];
  activeId: string | null;
  activeScenario: any;
  hasUnsavedChanges: boolean;
  onNew: (name: string) => void;
  onSave: () => void;
  onLoad: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onOpenManager: () => void;
}

export function ScenarioToolbar({
  scenarios,
  activeId,
  activeScenario,
  hasUnsavedChanges,
  onNew,
  onSave,
  onLoad,
  onRename,
  onDelete,
  onExport,
  onImport,
  onOpenManager
}: ScenarioToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="calculator-section mb-4">
      <div className="flex justify-between items-center mb-2">
        <h3>方案管理 / SCENARIOS</h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const name = prompt('Scenario Name:', `Scenario ${scenarios.length + 1}`);
              if (name) onNew(name);
            }}
            className="btn btn-small btn-primary flex items-center gap-1"
          >
            <Plus size={14} /> 新建方案
          </button>
          <button onClick={onExport} className="btn btn-small flex items-center gap-1">
            <Download size={14} /> 导出
          </button>
          <button
            onClick={onSave}
            className={`btn btn-small btn-success flex items-center gap-1 ${
              hasUnsavedChanges ? 'ring-2 ring-success ring-offset-2 ring-offset-[#1a1c1e]' : ''
            }`}
          >
            <Save size={14} /> 保存当前 {hasUnsavedChanges && "*"}
          </button>
          <button onClick={onOpenManager} className="btn btn-small flex items-center gap-1">
            <Settings2 size={14} /> 方案管理
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="btn btn-small flex items-center gap-1">
            <Upload size={14} /> 导入
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".json"
            onChange={(e) => {
              if (e.target.files?.[0]) onImport(e.target.files[0]);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <select
          value={activeId || ''}
          onChange={(e) => onLoad(e.target.value)}
          className="flex-1"
        >
          {scenarios.map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.name} ({(new Date(s.lastModified)).toLocaleDateString()})
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            const newName = prompt('New Name:', activeScenario?.name);
            if (newName && activeId) onRename(activeId, newName);
          }}
          className="btn btn-icon"
          title="Rename"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={() => {
            if (confirm('Delete current scenario?') && activeId) {
              onDelete(activeId);
            }
          }}
          className="btn btn-icon btn-danger"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
