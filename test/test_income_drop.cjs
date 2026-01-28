
const { calculateZoneOptimalProductionCore, getRecipeRatePerMinute } = require('./dist/utils/zoneSolverCore.js');

// Mock data
const items = [
    { id: 'iron', name: 'Iron', price: 10, isRawResource: false },
    { id: 'ore', name: 'Ore', price: 0, isRawResource: true, baseProductionRate: 1000 }
];

const recipes = [
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

const zones = [
    { id: 'z1', name: 'Zone 1', outputPorts: 10, inputPorts: 10, portThroughput: 100 },
    { id: 'z2', name: 'Zone 2', outputPorts: 10, inputPorts: 10, portThroughput: 100 }
];

const input = {
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
        console.log(`[${e.stage}] ${e.message} | Income: $${e.metrics?.income} | Mach: ${e.metrics?.machines}`);
    }
});

console.log("FINAL RESULT:");
console.log("Total Income:", result.totalIncome);
console.log("Feasible:", result.feasible);
