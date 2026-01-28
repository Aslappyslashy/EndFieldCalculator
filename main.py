from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import pulp
import traceback
import time
import json
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GAMEDATA_PATH = os.path.join("src", "data", "gameData.json")


# Data Models
class RecipeInput(BaseModel):
    itemId: str
    amount: float


class Recipe(BaseModel):
    id: str
    machineId: str
    name: str
    outputItemId: str
    outputAmount: float
    craftingTime: float
    inputs: List[RecipeInput]


class Item(BaseModel):
    id: str
    name: str
    price: float
    isRawResource: bool
    baseProductionRate: Optional[float] = None


class Machine(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    area: Optional[int] = None
    electricity: Optional[float] = 0


class GameData(BaseModel):
    items: List[Item]
    machines: List[Machine]
    recipes: List[Recipe]


# Data Management Endpoints
@app.get("/game-data")
async def get_game_data():
    try:
        if not os.path.exists(GAMEDATA_PATH):
            return {"items": [], "machines": [], "recipes": []}
        with open(GAMEDATA_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/game-data")
async def save_game_data(data: GameData):
    try:
        os.makedirs(os.path.dirname(GAMEDATA_PATH), exist_ok=True)
        with open(GAMEDATA_PATH, "w", encoding="utf-8") as f:
            json.dump(data.dict(), f, indent=2, ensure_ascii=False)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Solver Models
class Zone(BaseModel):
    id: str
    name: str
    outputPorts: int
    inputPorts: int
    portThroughput: float
    machineSlots: Optional[int] = None
    areaLimit: Optional[float] = None


class ProductionTarget(BaseModel):
    itemId: str
    targetRate: float


class ResourceConstraint(BaseModel):
    itemId: str
    maxRate: float


class ZoneAssignment(BaseModel):
    zoneId: str
    recipeId: str
    machineCount: int
    utilization: float
    requiredRate: float
    actualRate: float
    excessRate: float
    locked: Optional[bool] = None


class CalculatorInput(BaseModel):
    targets: List[ProductionTarget]
    resourceConstraints: List[ResourceConstraint]
    zones: List[Zone]
    lockedAssignments: Optional[List[ZoneAssignment]] = None
    optimizationMode: str
    transferPenalty: Optional[float] = 0.5
    consolidationWeight: Optional[float] = 0.05
    machineWeight: Optional[float] = 0.01
    timeLimit: Optional[float] = 30


class SolveRequest(BaseModel):
    input: CalculatorInput
    items: List[Item]
    recipes: List[Recipe]
    machines: List[Machine]


@app.post("/solve")
async def solve(request: SolveRequest):
    start_time = time.time()
    print(
        f"\n[SOLVER] Received request: {len(request.input.targets)} targets, {len(request.input.zones)} zones."
    )
    try:
        result = run_solver(request)
        duration = time.time() - start_time
        status = "Optimal" if result.get("solverFeasible") else "Infeasible/Error"
        print(f"[SOLVER] Processed in {duration:.2f}s. Status: {status}")
        return result
    except Exception as e:
        print(f"[SOLVER] CRITICAL ERROR: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def run_solver(request: SolveRequest):
    print("[SOLVER] Initializing MILP model...")

    input_data = request.input
    items = request.items
    recipes_data = request.recipes
    machine_data_map = {m.id: m for m in request.machines}

    item_by_id = {i.id: i for i in items}
    recipe_by_id = {r.id: r for r in recipes_data}
    raw_resource_ids = {i.id for i in items if i.isRawResource}
    intermediate_item_ids = {i.id for i in items if not i.isRawResource}
    all_item_ids = [i.id for i in items]
    zones = input_data.zones

    # Scaling Factors
    sellable_items = [i for i in items if i.price > 0]
    avg_price = (
        sum(i.price for i in sellable_items) / len(sellable_items)
        if sellable_items
        else 10
    )

    # Penalties
    consolidation_weight = input_data.consolidationWeight or 0.05
    machine_weight = input_data.machineWeight or 0.01
    transfer_penalty_val = input_data.transferPenalty or 0.5
    time_limit = input_data.timeLimit or 15

    recipe_activation_penalty = consolidation_weight * avg_price
    per_machine_penalty = (machine_weight * avg_price) / 10

    transfer_cost_base = 0
    if input_data.optimizationMode == "minTransfers":
        transfer_cost_base = avg_price * 100
    elif input_data.optimizationMode == "balanced":
        transfer_cost_base = transfer_penalty_val * avg_price * 2

    processed_recipes = []
    for r in recipes_data:
        factor = 60.0 / r.craftingTime
        m_info = machine_data_map.get(r.machineId)
        processed_recipes.append(
            {
                "id": r.id,
                "machine": r.machineId,
                "area": m_info.area if m_info else 0,
                "electricity": m_info.electricity if m_info else 0,
                "output_item_id": r.outputItemId,
                "rate": r.outputAmount * factor,
                "in": {inp.itemId: inp.amount * factor for inp in r.inputs},
            }
        )

    model = pulp.LpProblem("Factory_Optimization", pulp.LpMaximize)

    # Variables
    x = {
        z.id: {
            r["id"]: pulp.LpVariable(f"Num_{z.id}_{r['id']}", lowBound=0, cat="Integer")
            for r in processed_recipes
        }
        for z in zones
    }
    is_active = {
        z.id: {
            r["id"]: pulp.LpVariable(f"Active_{z.id}_{r['id']}", cat="Binary")
            for r in processed_recipes
        }
        for z in zones
    }
    y = {
        z.id: {
            r["id"]: pulp.LpVariable(f"Prod_{z.id}_{r['id']}", lowBound=0)
            for r in processed_recipes
        }
        for z in zones
    }
    f_in = {
        z.id: {
            i_id: pulp.LpVariable(f"FlowIn_{z.id}_{i_id}", lowBound=0)
            for i_id in all_item_ids
        }
        for z in zones
    }
    f_out = {
        z.id: {
            i_id: pulp.LpVariable(f"FlowOut_{z.id}_{i_id}", lowBound=0)
            for i_id in all_item_ids
        }
        for z in zones
    }
    p_in = {
        z.id: {
            i_id: pulp.LpVariable(f"PortIn_{z.id}_{i_id}", lowBound=0, cat="Integer")
            for i_id in all_item_ids
        }
        for z in zones
    }
    p_out = {
        z.id: {
            i_id: pulp.LpVariable(f"PortOut_{z.id}_{i_id}", lowBound=0, cat="Integer")
            for i_id in all_item_ids
        }
        for z in zones
    }
    slack_target = {
        t.itemId: pulp.LpVariable(f"Slack_Target_{t.itemId}", lowBound=0)
        for t in input_data.targets
    }

    # Constraints
    for z in zones:
        for r in processed_recipes:
            model += y[z.id][r["id"]] <= x[z.id][r["id"]] * r["rate"]
            model += x[z.id][r["id"]] <= 500 * is_active[z.id][r["id"]]
        for i_id in all_item_ids:
            produced = pulp.lpSum(
                [
                    y[z.id][r["id"]]
                    for r in processed_recipes
                    if r["output_item_id"] == i_id
                ]
            )
            consumed = pulp.lpSum(
                [
                    y[z.id][r["id"]] * (r["in"].get(i_id, 0) / r["rate"])
                    for r in processed_recipes
                    if i_id in r["in"]
                ]
            )
            model += produced + f_in[z.id][i_id] == consumed + f_out[z.id][i_id]

    for i_id in intermediate_item_ids:
        model += pulp.lpSum([f_out[z.id][i_id] for z in zones]) >= pulp.lpSum(
            [f_in[z.id][i_id] for z in zones]
        )

    resource_limits = {c.itemId: c.maxRate for c in input_data.resourceConstraints}
    for i_id in raw_resource_ids:
        limit = resource_limits.get(i_id, item_by_id[i_id].baseProductionRate or 0)
        model += pulp.lpSum([f_in[z.id][i_id] for z in zones]) <= limit

    for z in zones:
        for i_id in all_item_ids:
            model += f_in[z.id][i_id] <= p_in[z.id][i_id] * z.portThroughput
            model += f_out[z.id][i_id] <= p_out[z.id][i_id] * z.portThroughput
        model += (
            pulp.lpSum([p_in[z.id][i_id] for i_id in all_item_ids]) <= z.outputPorts
        )
        model += (
            pulp.lpSum([p_out[z.id][i_id] for i_id in all_item_ids]) <= z.inputPorts
        )
        if z.areaLimit:
            BELT_AREA_FACTOR = 0.15
            mach_area = pulp.lpSum(
                [x[z.id][r["id"]] * r["area"] for r in processed_recipes]
            )
            # Thr area based on y (actual production) to be more accurate, or x for worst-case.
            # JS solver uses m (x).
            thr_area = pulp.lpSum(
                [
                    x[z.id][r["id"]] * (sum(r["in"].values()) + r["rate"])
                    for r in processed_recipes
                ]
            )
            model += mach_area + thr_area * BELT_AREA_FACTOR <= z.areaLimit
        if z.machineSlots:
            model += (
                pulp.lpSum([x[z.id][r["id"]] for r in processed_recipes])
                <= z.machineSlots
            )

    for t in input_data.targets:
        if t.itemId in all_item_ids:
            model += (
                pulp.lpSum(
                    [f_out[z.id][t.itemId] - f_in[z.id][t.itemId] for z in zones]
                )
                + slack_target[t.itemId]
                >= t.targetRate
            )

    # Objective
    profit_terms = []
    prices = {i.id: i.price for i in items if i.price > 0}
    for i_id, price in prices.items():
        net = pulp.lpSum([f_out[z.id][i_id] - f_in[z.id][i_id] for z in zones])
        target_rate = next(
            (t.targetRate for t in input_data.targets if t.itemId == i_id), 0
        )
        profit_terms.append(price * (net - target_rate))

    shortfall_penalty = 1e6
    for t_id, slack_var in slack_target.items():
        profit_terms.append(-shortfall_penalty * slack_var)

    penalty_terms = []
    for z in zones:
        for r_id in x[z.id]:
            penalty_terms.append(x[z.id][r_id] * per_machine_penalty)
            penalty_terms.append(is_active[z.id][r_id] * recipe_activation_penalty)
        for i_id in all_item_ids:
            penalty_terms.append(p_in[z.id][i_id] * 0.0001 * avg_price)
            penalty_terms.append(p_out[z.id][i_id] * 0.0001 * avg_price)
            if i_id not in raw_resource_ids:
                profit_terms.append(-transfer_cost_base * f_in[z.id][i_id])

    model += pulp.lpSum(profit_terms) - pulp.lpSum(penalty_terms)

    # Solve using HiGHS
    print(
        f"[SOLVER] Model built with {len(model.constraints)} constraints and {len(model.variables())} variables."
    )
    try:
        print(f"[SOLVER] Calling HiGHS solver (timeLimit={time_limit}s)...")
        # PuLP supports HiGHS via the HiGHS_CMD interface
        model.solve(pulp.HiGHS_CMD(msg=False, timeLimit=time_limit))
    except Exception as e:
        print(f"[SOLVER] HiGHS solve failed, falling back to CBC: {e}")
        try:
            model.solve(pulp.PULP_CBC_CMD(msg=False, timeLimit=time_limit))
        except Exception as e2:
            print(f"[SOLVER] CRITICAL SOLVER CRASH: {e2}")
            return {
                "feasible": False,
                "solverFeasible": False,
                "warnings": [f"Solver crashed: {str(e2)}"],
            }

    status = pulp.LpStatus[model.status]
    solver_feasible = status in ["Optimal", "Not Solved"]
    unmet = [
        {"itemId": t.itemId, "shortfall": pulp.value(slack_target[t.itemId]) or 0}
        for t in input_data.targets
        if (pulp.value(slack_target[t.itemId]) or 0) > 0.001
    ]

    zone_results = []
    item_flows = []
    global_usage = []
    income = 0
    global_total_electricity = 0

    if solver_feasible:
        for z in zones:
            assigns = []
            zone_electricity = 0
            for r in processed_recipes:
                cnt = int(pulp.value(x[z.id][r["id"]]) or 0)
                prod = pulp.value(y[z.id][r["id"]]) or 0
                if cnt > 0 or prod > 0.001:
                    if cnt == 0:
                        cnt = 1
                    util = prod / r["rate"]
                    assigns.append(
                        {
                            "zoneId": z.id,
                            "recipeId": r["id"],
                            "machineCount": cnt,
                            "utilization": util,
                            "requiredRate": prod,
                            "actualRate": cnt * r["rate"],
                            "excessRate": cnt * r["rate"] - prod,
                        }
                    )
                    # Electricity cost per minute = machine count * electricity_per_machine
                    # (Note: Electricity usually is constant per machine, not per utilization,
                    # but if it was per utilization we'd use util * cnt. Let's assume per active machine.)
                    zone_electricity += cnt * r["electricity"]

            f_pool, t_pool, sold = [], [], []
            for i_id in all_item_ids:
                fi, fo = (
                    pulp.value(f_in[z.id][i_id]) or 0,
                    pulp.value(f_out[z.id][i_id]) or 0,
                )
                if fi > 0.001:
                    f_pool.append({"itemId": i_id, "rate": fi})
                    if i_id in raw_resource_ids:
                        item_flows.append(
                            {
                                "itemId": i_id,
                                "fromZoneId": None,
                                "toZoneId": z.id,
                                "rate": fi,
                            }
                        )
                if fo > 0.001:
                    if i_id in prices:
                        sold.append({"itemId": i_id, "rate": fo})
                    else:
                        t_pool.append({"itemId": i_id, "rate": fo})

            zone_results.append(
                {
                    "zone": z.dict(),
                    "assignments": assigns,
                    "outputPortsUsed": int(
                        sum(pulp.value(p_in[z.id][i_id]) or 0 for i_id in all_item_ids)
                    ),
                    "inputPortsUsed": int(
                        sum(pulp.value(p_out[z.id][i_id]) or 0 for i_id in all_item_ids)
                    ),
                    "totalMachines": sum(a["machineCount"] for a in assigns),
                    "totalElectricity": zone_electricity,
                    "itemsFromPool": f_pool,
                    "itemsToPool": t_pool,
                    "itemsSold": sold,
                    "areaUsed": sum(
                        a["machineCount"] * r["area"]
                        for a in assigns
                        for r in processed_recipes
                        if r["id"] == a["recipeId"]
                    ),
                }
            )
            global_total_electricity += zone_electricity

        for i_id in intermediate_item_ids:
            sups = [
                {"z": zone.id, "r": pulp.value(f_out[zone.id][i_id]) or 0}
                for zone in zones
                if (pulp.value(f_out[zone.id][i_id]) or 0) > 0.001
            ]
            cons = [
                {"z": zone.id, "r": pulp.value(f_in[zone.id][i_id]) or 0}
                for zone in zones
                if (pulp.value(f_in[zone.id][i_id]) or 0) > 0.001
            ]
            for s in sups:
                for c in cons:
                    if s["r"] <= 0.001 or c["r"] <= 0.001:
                        continue
                    flow = min(s["r"], c["r"])
                    item_flows.append(
                        {
                            "itemId": i_id,
                            "fromZoneId": s["z"],
                            "toZoneId": c["z"],
                            "rate": flow,
                        }
                    )
                    s["r"] -= flow
                    c["r"] -= flow

        for i_id in raw_resource_ids:
            u = sum(pulp.value(f_in[z.id][i_id]) or 0 for z in zones)
            if u > 0.001:
                global_usage.append({"itemId": i_id, "rate": u})

        for i_id, price in prices.items():
            net = sum(
                pulp.value(f_out[z.id][i_id] - f_in[z.id][i_id]) or 0 for z in zones
            )
            t_rate = next(
                (t.targetRate for t in input_data.targets if t.itemId == i_id), 0
            )
            income += max(0, net - t_rate) * price

    return {
        "feasible": solver_feasible and len(unmet) == 0,
        "solverFeasible": solver_feasible,
        "zoneResults": zone_results,
        "totalIncome": income,
        "totalElectricity": global_total_electricity,
        "totalOutputPortsUsed": sum(zr["outputPortsUsed"] for zr in zone_results),
        "globalResourceUsage": global_usage,
        "itemFlows": item_flows,
        "unmetTargets": unmet,
        "warnings": [],
        "transferOverhead": 0,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
