
import { calculateZoneOptimalProductionCore } from './src/utils/zoneSolverCore';
import { Item, Recipe, Zone, CalculatorInput } from './src/types';

// Mock data
const items: Item[] = [
    { id: 'iron', name: 'Iron', price: 10, isRawResource: false },
    { id: 'ore', name: 'Ore', price: 0, isRawResource: true, baseProductionRate: 1000 }
];

const recipes: Recipe[] = [
    {
        id: 'recipe_iron',
        name: 'Iron Recipe',
        machineId: 'm1',
        outputItemId: 'iron',
        outputAmount: 1,
        craftingTime: 1, // 60 iron/min
        inputs: [{ itemId: 'ore', amount: 1 }]
    }
];

const zones: Zone[] = [
    { id: 'z1', name: 'Zone 1', outputPorts: 10, inputPorts: 10, portThroughput: 100 },
    { id: 'z2', name: 'Zone 2', outputPorts: 10, inputPorts: 10, portThroughput: 100 }
];

const input: CalculatorInput = {
    targets: [{ itemId: 'iron', targetRate: 10 }],
    resourceConstraints: [],
    zones: zones,
    optimizationMode: 'maxIncome'
};

const data = {
    items,
    recipes,
    rawResources: items.filter(i => i.isRawResource),
    machineAreaById: new Map([['m1', 1]])
};

console.log("Running optimizer...");
const result = calculateZoneOptimalProductionCore({
    data,
    input,
    onProgress: (e) => {
        console.log(`[${e.stage}] ${e.message} | Income: $${e.metrics?.income?.toFixed(2)} | Mach: ${e.metrics?.machines}`);
    }
});

console.log("\nFINAL RESULT:");
console.log("Total Income:", result.totalIncome);
console.log("Feasible:", result.feasible);
console.log("Warnings:", result.warnings);
