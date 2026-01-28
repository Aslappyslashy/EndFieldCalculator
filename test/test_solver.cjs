
const Solver = require('javascript-lp-solver');

const model = {
    optimize: "profit",
    opType: "max",
    constraints: {
        "output_capacity_rate": { max: 20 }, // 2 ports * 10 throughput
        "demand_A": { min: 2 },
        "demand_B": { min: 8 },
        "demand_C": { min: 2 },
    },
    variables: {
        "transfer_A": { "profit": 0, "output_capacity_rate": 1, "demand_A": 1 },
        "transfer_B": { "profit": 0, "output_capacity_rate": 1, "demand_B": 1 },
        "transfer_C": { "profit": 0, "output_capacity_rate": 1, "demand_C": 1 },
    }
};

console.log("--- Continuous LP (Flawed) ---");
const resultLP = Solver.Solve(model);
console.log(resultLP);
console.log("Expected: Feasible (Total rate 12 <= 20)");

// MILP Formulation
const milpModel = {
    optimize: "profit",
    opType: "max",
    constraints: {
        "port_limit_count": { max: 2 }, // 2 physical ports
        "demand_A": { min: 2 },
        "demand_B": { min: 8 },
        "demand_C": { min: 2 },
        // Link constraints: transfer <= lines * 10  => transfer - 10*lines <= 0
        "link_A": { max: 0 },
        "link_B": { max: 0 },
        "link_C": { max: 0 },
    },
    variables: {
        "transfer_A": { "profit": 0, "demand_A": 1, "link_A": 1 },
        "transfer_B": { "profit": 0, "demand_B": 1, "link_B": 1 },
        "transfer_C": { "profit": 0, "demand_C": 1, "link_C": 1 },
        
        "lines_A": { "port_limit_count": 1, "link_A": -10 },
        "lines_B": { "port_limit_count": 1, "link_B": -10 },
        "lines_C": { "port_limit_count": 1, "link_C": -10 },
    },
    ints: { "lines_A": 1, "lines_B": 1, "lines_C": 1 }
};

console.log("\n--- MILP (Corrected) ---");
const resultMILP = Solver.Solve(milpModel);
console.log(resultMILP);
console.log("Expected: Infeasible (Requires 3 ports)");
