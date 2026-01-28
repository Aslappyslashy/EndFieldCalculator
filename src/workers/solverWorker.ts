import type { CalculatorInput, Item, Recipe } from '../types';
import { calculateTheoreticalMaxCore, calculateZoneOptimalProductionCore } from '../utils/zoneSolverCore';

type WorkerRequest = {
  type: 'solveAll';
  payload: {
    input: CalculatorInput;
    items: Item[];
    recipes: Recipe[];
    rawResources: Item[];
    machineAreas?: Array<{ machineId: string; area: number }>;
  };
};

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;

  try {
    if (msg.type === 'solveAll') {
      const { input, items, recipes, rawResources, machineAreas } = msg.payload;
      const machineAreaById = machineAreas
        ? new Map(machineAreas.map(x => [x.machineId, x.area] as const))
        : undefined;

      const result = calculateZoneOptimalProductionCore({
        data: { items, recipes, rawResources, machineAreaById },
        input,
        onProgress: (event) => {
          (self as unknown as Worker).postMessage({ type: 'solveProgress', payload: event });
        }
      });
      const theoreticalMax = calculateTheoreticalMaxCore({ data: { items, recipes, rawResources }, input });
      (self as unknown as Worker).postMessage({ type: 'solveAllResult', payload: { result, theoreticalMax } });
      return;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    (self as unknown as Worker).postMessage({ type: 'error', payload: message });
  }
};
