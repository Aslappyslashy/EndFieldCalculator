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
                setScenarios(JSON.parse(stored));
            }
            if (active) {
                setActiveId(active);
            }
        } catch (e) {
            console.error('Failed to load scenarios', e);
        }
    }, []);

    const saveToStorage = useCallback((list: Scenario[], active: string | null) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        if (active) localStorage.setItem(ACTIVE_KEY, active);
        else localStorage.removeItem(ACTIVE_KEY);
    }, []);

    const createScenario = useCallback((name: string, data: ScenarioData) => {
        const newScenario: Scenario = {
            id: crypto.randomUUID(),
            name,
            lastModified: Date.now(),
            data,
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
        activeScenario: scenarios.find(s => s.id === activeId),
        createScenario,
        updateScenario,
        deleteScenario,
        bulkDeleteScenarios,
        loadScenario,
        exportScenarios,
        importScenarios,
    };
}
