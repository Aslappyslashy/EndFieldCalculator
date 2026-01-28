Calculator for EndField Industial system.

Given rate of output of raw natrual resourse.

Allow user to create machines, and each machine have multiple recipies.

Each item have  a price tag.

Given user want a certain number of output for certain items, and maximum income.

The calculator should give suggestions and deduction on how much machines the user should set to achieve a similar goal.

There is different zones each zones with limiting amount of output ports, the output port have a speed of 0.5 items per sec, it connects to the global pool, which is shared between zones.
The raw material can only be taken out from the output ports, they cannot be made in the zone.
The most ideal case is to to extract only raw material and route the entire lines and produce, so we can maximize our output port use, but due to limited space, this is impossible.

Each kind of item have its price, our goal cam be varius, but mostly: while producing a set of {items:rate,...} maximize profit.

---

## Model / Terminology

- Time unit: all rates are per minute.
- Zones: each zone is a production area with two types of ports connecting to a shared global pool.
  - Output ports (scarce): pulling items OUT of the global pool INTO a zone. This is the main bottleneck.
  - Input ports (abundant): pushing items FROM a zone INTO the global pool.
  - Port throughput: default 0.5 items/sec = 30 items/min per port line.
- Global pool: shared buffer between zones.
  - Raw resources come from the pool only (cannot be produced by recipes).
  - Intermediate items can be sent into the pool by one zone and pulled out by another.
- Selling: selling an item means putting it into the global pool (uses INPUT ports). There is no "free direct sell".

## User Inputs

- A set of target outputs: { itemId -> rate/min }.
  - Raw resources are not targetable outputs.
  - Targets represent *net* output to the global pool (not "just pull from pool").
- Global raw resource constraints: { rawItemId -> maxRate/min }.
  - If not specified, defaults to the game limit.
- Zone constraints:
  - outputPorts, inputPorts, portThroughput
  - optional machineSlots limit (count of machines)
  - optional areaLimit (sum of machine footprints).

## Optimization Objective

- Primary objective: maximize profit per minute under the contrictions given by the user since user need a list of nesesaties. Beside making these, the other resources should all be used on optimzing profit
  - Profit is computed from sellable items (items with price > 0).
  - Profit is realized when sellable items are sent into the global pool (consumes input ports).

## Constraints (What Makes a Plan Valid)

### 1) In-zone material balance (per item, per zone)

For each item X in zone Z:

- Produced locally by recipes in  Z
- Plus pulled from pool into Z
- Must cover:
  - consumption by recipes in Z
  - sent from Z to pool

This ensures no recipe can consume an item unless it is produced locally or pulled from the pool.

### 2) Global pool conservation for intermediate items

For each non-raw item X:

- total sent to pool across all zones >= total pulled from pool across all zones

This prevents the "free item" loophole (you cannot pull an intermediate item unless someone produces/sends it).

### 3) Raw resource limits

For each raw resource R:

- total pulled from pool across all zones <= maxRate(R)

This enforces the game’s natural production caps.

### 4) Port capacity per zone

Ports are line-based and discrete in the game.

each zone have a fixed amount of port (output, lgobal->zone), each delivering at 0.5items/s 

each machine also have ports and belts also 0.5 item/s

### 5) Zone size limits

- areaLimit : sum(machineCount * machineArea) <= areaLimit

### 6) Loop Concideration

one machine in the game produce X from Y
and another mathince creates 2Y from X

## Targets (Net Output, Not "Just Pull One")

For each target item T (non-raw):

- netExport(T) >= targetRate(T)

Where:

- netExport(T) = sum_z send_T_from_z - sum_z transfer_T_to_z

This prevents degenerate solutions like "pull battery from pool and call it produced".
