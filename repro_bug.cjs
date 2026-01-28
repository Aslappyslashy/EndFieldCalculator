
const Solver = require('javascript-lp-solver');

// Mimic the logic in zoneSolverCore.ts

const zone = {
    id: "z1",
    inputPorts: 10,
    outputPorts: 0, // No output ports
    portThroughput: 10
};

const model = {
    optimize: "profit",
    opType: "max",
    constraints: {
        // Correct constraints (physically):
        // Import -> Input Port
        // Export -> Output Port
        
        // BUT mimicking the BUGGY logic:
        // transfer_to_zone uses output_lines (constrained by outputPorts)
        [`output_lines_${zone.id}`]: { max: zone.outputPorts }, 
        [`input_lines_${zone.id}`]: { max: zone.inputPorts },
    },
    variables: {
        // "transfer_to_z1": Import item
        [`transfer_item_to_${zone.id}`]: {
            profit: 10,
            [`link_in_item_${zone.id}`]: 1 
        },
        
        // Lines variable for import (BUGGY: uses output_lines)
        [`lines_in_item_${zone.id}`]: {
            [`output_lines_${zone.id}`]: 1, // <--- THE BUG
            [`link_in_item_${zone.id}`]: -zone.portThroughput
        }
    },
    ints: {
        [`lines_in_item_${zone.id}`]: 1
    }
};

// Add link constraint
model.constraints[`link_in_item_${zone.id}`] = { max: 0 };

console.log("Solving model with OutputPorts=0, InputPorts=10.");
console.log("We are trying to IMPORT (Transfer To Zone).");
console.log("If logic is correct, it should succeed (uses Input Ports).");
console.log("If logic is swapped (buggy), it should fail (uses Output Ports which are 0).");

const result = Solver.Solve(model);
console.log("Result:", result);

if (result.feasible && result.profit > 0) {
    console.log("SUCCESS: Solver found a solution.");
} else {
    console.log("FAILURE: Solver could not import.");
}
