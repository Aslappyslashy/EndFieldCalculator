import { useState, useEffect, useCallback } from 'react';
import type { Scenario, ScenarioData } from '../types';

const STORAGE_KEY = 'endfield_scenarios';
const ACTIVE_KEY = 'endfield_active_scenario';

export function useScenarios() {
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);

    // Load from storage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            const active = localStorage.getItem(ACTIVE_KEY);
            if (stored) {
                try {
                    setScenarios(JSON.parse(stored));
                } catch (parseError) {
                    console.error('Corrupted scenarios data, clearing:', parseError);
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
            if (active) {
                setActiveId(active);
            }
        } catch (e) {
            console.error('Failed to load scenarios', e);
            try {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(ACTIVE_KEY);
            } catch {}
        }
    }, []);

    const saveToStorage = useCallback((list: Scenario[], active: string | null) => {
        try {
            const json = JSON.stringify(list);
            if (json.length > 4 * 1024 * 1024) {
                console.warn('Scenarios data exceeds 4MB, localStorage may fail');
            }
            localStorage.setItem(STORAGE_KEY, json);
            if (active) localStorage.setItem(ACTIVE_KEY, active);
            else localStorage.removeItem(ACTIVE_KEY);
        } catch (e) {
            console.error('Failed to save scenarios:', e);
            alert('Storage quota exceeded! Try deleting some scenarios.');
        }
    }, []);

    const createScenario = useCallback((name: string, data?: Partial<ScenarioData>) => {
        const newScenario: Scenario = {
            id: crypto.randomUUID(),
            name,
            lastModified: Date.now(),
            data: {
                targets: data?.targets || [],
                constraints: data?.constraints || [],
                optimizationMode: data?.optimizationMode || 'balanced',
                transferPenalty: data?.transferPenalty ?? 0.5,
                consolidationWeight: data?.consolidationWeight ?? 0.05,
                machineWeight: data?.machineWeight ?? 0.01,
                timeLimit: data?.timeLimit ?? 30,
                nodePositions: data?.nodePositions || {},
            },
        };
        setScenarios(prev => {
            const next = [...prev, newScenario];
            saveToStorage(next, newScenario.id);
            return next;
        });
        setActiveId(newScenario.id);
        return newScenario.id;
    }, [saveToStorage]);

    const updateScenario = useCallback((id: string, data: Partial<ScenarioData>, name?: string) => {
        setScenarios(prev => {
            const index = prev.findIndex(s => s.id === id);
            if (index === -1) return prev;

            const next = [...prev];
            next[index] = {
                ...next[index],
                name: name !== undefined ? name : next[index].name,
                lastModified: Date.now(),
                data: { ...next[index].data, ...data },
            };
            saveToStorage(next, activeId);
            return next;
        });
    }, [saveToStorage, activeId]);

    const deleteScenario = useCallback((id: string) => {
        setScenarios(prev => {
            const next = prev.filter(s => s.id !== id);
            let newActive = activeId;
            if (activeId === id) {
                newActive = next.length > 0 ? next[0].id : null;
                if (newActive) localStorage.setItem(ACTIVE_KEY, newActive);
                else localStorage.removeItem(ACTIVE_KEY);
                setActiveId(newActive);
            }
            saveToStorage(next, newActive);
            return next;
        });
    }, [activeId, saveToStorage]);

    const loadScenario = useCallback((id: string) => {
        setActiveId(id);
        localStorage.setItem(ACTIVE_KEY, id);
    }, []);

    const exportScenarios = useCallback(() => {
        const json = JSON.stringify(scenarios, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `endfield_scenarios_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [scenarios]);

    const importScenarios = useCallback((file: File) => {
        return new Promise<void>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target?.result as string;
                    const imported = JSON.parse(content) as Scenario[];
                    if (!Array.isArray(imported)) throw new Error('Invalid format');

                    // Merge strategy: Keep existing, append imported with (Imported) suffix if ID conflicts
                    // Actually simplest is just to generate new IDs or keep logic simple
                    setScenarios(prev => {
                        const next = [...prev];
                        imported.forEach(s => {
                            // Ensure unique ID
                            if (next.some(x => x.id === s.id)) {
                                s.id = crypto.randomUUID();
                                s.name = `${s.name} (Imported)`;
                            }
                            next.push(s);
                        });
                        saveToStorage(next, activeId);
                        return next;
                    });
                    resolve();
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsText(file);
        });
    }, [saveToStorage, activeId]);

    const bulkDeleteScenarios = useCallback((ids: string[]) => {
        setScenarios(prev => {
            const next = prev.filter(s => !ids.includes(s.id));
            let newActive = activeId;
            if (activeId && ids.includes(activeId)) {
                newActive = next.length > 0 ? next[0].id : null;
                if (newActive) localStorage.setItem(ACTIVE_KEY, newActive);
                else localStorage.removeItem(ACTIVE_KEY);
                setActiveId(newActive);
            }
            saveToStorage(next, newActive);
            return next;
        });
    }, [activeId, saveToStorage]);

    return {
        scenarios,
        activeId,
        activeScenario: scenarios.find(s => s.id === activeId) || null,
        createScenario,
        updateScenario,
        deleteScenario,
        bulkDeleteScenarios,
        loadScenario,
        exportScenarios,
        importScenarios,
    };
}
