import pulp
import collections

# ==========================================
# 1. 数据录入 
# ==========================================

# 原料上限 (items/min)
raw_limits = {
    "原矿": 240,
    "紫水晶": 120,
    "蓝铁矿": 100,
    # 假设未列出的原料上限为0 (必须通过生产或循环获得)
}

# 物品售价 (未列出的默认为0)
prices = {
    "晶体外壳": 1,
    "优质荞愈胶囊": 27,
    "中容谷地电池": 30,
    "荞愈胶囊": 10,
    "柑实罐头": 10,
    "紫晶制瓶": 2,
    "紫晶零件": 1,
}

# 机器属性 (Area)
machine_specs = {
    "精炼炉": {"area": 9},  # 3x3
    "粉碎机": {"area": 9},
    "配件机": {"area": 9},
    "塑性机": {"area": 9},
    "种植机": {"area": 25}, # 5x5
    "种采机": {"area": 25},
    "装备原件机器": {"area": 24}, # 6x4
    "灌装机": {"area": 24},
    "封装机": {"area": 24},
    "研磨机": {"area": 24},
}

# 配方数据
# 格式: (machine_type, duration_sec, inputs{item:count}, outputs{item:count})
# 自动换算为 per minute rate: 60/duration * count
raw_recipes = [
    # 精炼炉
    ("精炼炉", 2, {"蓝铁矿":1}, {"蓝铁块":1}),
    ("精炼炉", 2, {"紫水晶":1}, {"紫晶纤维":1}),
    ("精炼炉", 2, {"原矿":1}, {"晶体外壳":1}),
    ("精炼炉", 2, {"致密晶体粉末":1}, {"致密晶体":1}),
    ("精炼炉", 2, {"致密蓝铁粉末":1}, {"钢块":1}),
    ("精炼炉", 2, {"高精粉末":1}, {"高精纤维":1}),
    ("精炼炉", 2, {"致密碳粉末":1}, {"稳定碳块":1}),
    ("精炼炉", 2, {"致密原石粉末":1}, {"致密晶体粉末":1}),
    ("精炼炉", 2, {"荞花":1}, {"碳块":1}),
    # 粉碎机
    ("粉碎机", 2, {"蓝铁块":1}, {"蓝铁粉末":1}),
    ("粉碎机", 2, {"紫晶纤维":1}, {"紫晶粉末":1}),
    ("粉碎机", 2, {"原矿":1}, {"原石粉末":1}),
    ("粉碎机", 2, {"碳块":1}, {"碳粉末":1}),
    ("粉碎机", 2, {"晶体外壳":1}, {"晶体外壳粉末":1}),
    ("粉碎机", 2, {"荞花":1}, {"荞花粉末":2}),
    ("粉碎机", 2, {"柑实":1}, {"柑实粉末":2}),
    ("粉碎机", 2, {"酮化灌木":1}, {"酮化灌木粉末":2}),
    ("粉碎机", 2, {"砂叶":1}, {"砂叶粉末":3}),
    # 配件机
    ("配件机", 2, {"蓝铁块":1}, {"铁质零件":1}),
    ("配件机", 2, {"紫晶纤维":1}, {"紫晶零件":1}),
    ("配件机", 2, {"钢块":1}, {"钢制零件":1}),
    ("配件机", 2, {"高精纤维":1}, {"高精零件":1}),
    # 塑性机
    ("塑性机", 2, {"蓝铁块":1}, {"蓝铁瓶":1}),
    ("塑性机", 2, {"紫晶纤维":1}, {"紫晶制瓶":1}),
    ("塑性机", 2, {"钢块":1}, {"钢制瓶":1}),
    ("塑性机", 2, {"高精纤维":1}, {"高精制瓶":1}),
    # 种植机
    ("种植机", 2, {"荞花种子":1}, {"荞花":1}),
    ("种植机", 2, {"柑实种子":1}, {"柑实":1}),
    ("种植机", 2, {"砂叶种子":1}, {"砂叶":1}),
    ("种植机", 2, {"酮化树种":1}, {"酮化灌木":1}),
    # 种采机 (产出循环源头)
    ("种采机", 2, {"荞花":1}, {"荞花种子":2}),
    ("种采机", 2, {"柑实":1}, {"柑实种子":2}),
    ("种采机", 2, {"砂叶":1}, {"砂叶种子":2}),
    ("种采机", 2, {"酮化灌木":1}, {"酮化树种":2}),
    ("种采机", 2, {"灰芦麦":1}, {"灰芦麦种子":2}),
    # 装备原件机器
    ("装备原件机器", 10, {"晶体外壳":5, "紫晶纤维":5}, {"紫晶装备原件":1}),
    ("装备原件机器", 10, {"晶体外壳":5, "蓝铁块":5}, {"蓝铁装备原件":1}),
    ("装备原件机器", 10, {"致密晶体":5, "高精纤维":5}, {"高精装备原件":1}),
    # 灌装机
    ("灌装机", 10, {"紫晶制瓶":5, "柑实粉末":5}, {"柑实罐头":1}),
    ("灌装机", 10, {"紫晶制瓶":5, "荞花粉末":5}, {"荞愈胶囊":1}),
    ("灌装机", 10, {"蓝铁瓶":10, "柑实粉末":10}, {"优质柑实罐头":1}),
    ("灌装机", 10, {"钢制瓶":10, "细磨柑实粉末":10}, {"精选柑实罐头":1}),
    ("灌装机", 10, {"蓝铁瓶":10, "荞花粉末":10}, {"优质荞愈胶囊":1}),
    ("灌装机", 10, {"钢制瓶":10, "细磨荞花粉末":10}, {"精选荞愈胶囊":1}),
    # 封装机
    ("封装机", 10, {"紫晶零件":5, "酮化灌木粉末":1}, {"工业爆炸物":1}),
    ("封装机", 10, {"紫晶零件":5, "原石粉末":10}, {"低容谷地电池":1}),
    ("封装机", 10, {"铁质零件":10, "原石粉末":15}, {"中容谷地电池":1}),
    ("封装机", 10, {"钢制零件":10, "致密原石粉末":15}, {"高容谷地电池":1}),
    # 研磨机
    ("研磨机", 2, {"蓝铁粉末":2, "砂叶粉末":1}, {"致密蓝铁粉末":1}),
    ("研磨机", 2, {"紫晶粉末":2, "砂叶粉末":1}, {"高精粉末":1}),
    ("研磨机", 2, {"原石粉末":2, "砂叶粉末":1}, {"致密原石粉末":1}),
    ("研磨机", 2, {"碳粉末":2, "砂叶粉末":1}, {"致密碳粉末":1}),
    ("研磨机", 2, {"晶体外壳粉末":2, "砂叶粉末":1}, {"致密晶体粉末":1}),
    ("研磨机", 2, {"荞花粉末":2, "砂叶粉末":1}, {"细磨荞花粉末":1}),
    ("研磨机", 2, {"柑实粉末":2, "砂叶粉末":1}, {"细磨柑实粉末":1}),
]

# --- 区域配置 (假设有两个区域) ---
# Output Ports: Pool -> Zone (原料/中间品进入)
# Input Ports: Zone -> Pool (成品卖出/中间品流转)
zones_conf = {
    "Zone_A": {"max_op": 12, "max_ip": 32, "area": 700}, # 小区域
    "Zone_B": {"max_op": 16, "max_ip": 32, "area": 2000}, # 大区域
}

PORT_CAPACITY = 30.0 # items per minute
BELT_AREA_FACTOR = 0.15 

# --- 数据预处理 (Preprocessing) ---

# 1. 提取所有物品集合
all_items = set()
for _, _, inputs, outputs in raw_recipes:
    all_items.update(inputs.keys())
    all_items.update(outputs.keys())
all_items.update(raw_limits.keys())
all_items.update(prices.keys())
all_items = sorted(list(all_items)) # 排序保证一致性

# 2. 转换配方速率 (Normalized to per minute)
# 结构: recipes[r_idx] = { 'machine': str, 'in': {item: rate}, 'out': {item: rate}, 'area': int }
recipes = []
for idx, (m_name, time_sec, inputs, outputs) in enumerate(raw_recipes):
    factor = 60.0 / time_sec # 每分钟执行次数
    r_data = {
        "id": idx,
        "name": f"R{idx}_{m_name}", # 唯一标识
        "machine": m_name,
        "area": machine_specs.get(m_name, {"area":0})["area"],
        "in": {k: v * factor for k, v in inputs.items()},
        "out": {k: v * factor for k, v in outputs.items()}
    }
    recipes.append(r_data)

# 识别原料 (Raw) 和 中间品/成品
raw_items = set(raw_limits.keys())
intermediate_items = [i for i in all_items if i not in raw_items]

# ==========================================
# 2. 建立模型 (MILP Model)
# ==========================================

model = pulp.LpProblem("Factory_Optimization", pulp.LpMaximize)

# --- 变量定义 ---

# x[zone][recipe_id]: 机器数量 (Integer)
x = {} 
# f_in[zone][item], f_out[zone][item]: 流量 (Continuous)
f_in = {}
f_out = {}
# p_in[zone][item], p_out[zone][item]: 端口占用数 (Integer)
p_in = {}
p_out = {}

for z in zones_conf:
    x[z] = {}
    f_in[z] = {}
    f_out[z] = {}
    p_in[z] = {}
    p_out[z] = {}
    
    # 机器数量变量
    for r in recipes:
        x[z][r['id']] = pulp.LpVariable(f"Num_{z}_{r['name']}", lowBound=0, cat='Integer')
        
    for i in all_items:
        # 流量变量
        f_in[z][i] = pulp.LpVariable(f"FlowIn_{z}_{i}", lowBound=0)
        f_out[z][i] = pulp.LpVariable(f"FlowOut_{z}_{i}", lowBound=0)
        
        # 端口数量变量 (离散!)
        p_in[z][i] = pulp.LpVariable(f"PortIn_{z}_{i}", lowBound=0, cat='Integer')
        p_out[z][i] = pulp.LpVariable(f"PortOut_{z}_{i}", lowBound=0, cat='Integer')

# --- 约束条件 ---

# 1. 区域内物质平衡 (In-zone Material Balance)
# 生产 + 拉取 = 消耗 + 推送
for z in zones_conf:
    for i in all_items:
        produced = pulp.lpSum([x[z][r['id']] * r['out'].get(i, 0) for r in recipes])
        consumed = pulp.lpSum([x[z][r['id']] * r['in'].get(i, 0) for r in recipes])
        
        model += (produced + f_in[z][i] == consumed + f_out[z][i]), f"Balance_{z}_{i}"

# 2. 全局中间品守恒 (Global Conservation)
# 对于非原料：总推送 >= 总拉取 (不能凭空产生)
for i in intermediate_items:
    total_in = pulp.lpSum([f_in[z][i] for z in zones_conf])
    total_out = pulp.lpSum([f_out[z][i] for z in zones_conf])
    model += (total_out >= total_in), f"Global_Conserv_{i}"

# 3. 原料上限 (Raw Limits)
for i in raw_items:
    total_raw_pull = pulp.lpSum([f_in[z][i] for z in zones_conf])
    model += (total_raw_pull <= raw_limits[i]), f"Raw_Limit_{i}"

# 4. 端口容量绑定 (Linking Flow to Ports)
# Flow <= PortCount * 30
for z in zones_conf:
    for i in all_items:
        model += (f_in[z][i] <= p_in[z][i] * PORT_CAPACITY), f"Link_In_{z}_{i}"
        model += (f_out[z][i] <= p_out[z][i] * PORT_CAPACITY), f"Link_Out_{z}_{i}"

# 5. 区域端口总量限制 (Zone Port Limits)
for z, conf in zones_conf.items():
    model += pulp.lpSum([p_in[z][i] for i in all_items]) <= conf['max_op'], f"Max_OP_{z}"
    model += pulp.lpSum([p_out[z][i] for i in all_items]) <= conf['max_ip'], f"Max_IP_{z}"

# 6. 区域面积限制 (Zone Area Limits)
for z, conf in zones_conf.items():
    used_area = pulp.lpSum([x[z][r['id']] * r['area'] for r in recipes])
    model += (used_area <= conf['area']), f"Max_Area_{z}"
    
# 7. Belt面积惩罚，基于物品总传输率

for z, conf in zones_conf.items():
    # 1. 机器面积
    machine_area = pulp.lpSum([x[z][r['id']] * r['area'] for r in recipes])
    
    # 2. 传送带面积估算
    # 逻辑：对于每种物品，(总消耗 - 从外部拉取的) = 必须在内部传输的量
    # 注意：为了简化，这里也可以直接用 (总产出 + 总消耗) * 系数，看你觉得哪个更准
    internal_flow_area = []
    for i in all_items:
        consumed = pulp.lpSum([x[z][r['id']] * r['in'].get(i, 0) for r in recipes])
        # 内部流量 = 消耗 - 外部输入 (注意：f_in 是变量)
        # 但这里有个数学坑：如果 f_in > consumed (为了存buffer)，上面的减法可能不准。
        # 更简单的估算是：所有 Input 和 Output 接口都得连传送带，机器之间也得连。
        # 简单粗暴版：直接基于机器数量给一个 Buffer
        pass 

    # 所有的配方输入和输出加起来，就是总吞吐量
    total_throughput = pulp.lpSum(
        [x[z][r['id']] * (sum(r['in'].values()) + sum(r['out'].values())) for r in recipes]
    )
    belt_area = total_throughput * BELT_AREA_FACTOR
    
    model += (machine_area + belt_area <= conf['area']), f"Total_Area_With_Belts_{z}"

# --- 目标函数 (Objective) ---
# 最大化净利润：Sum(Price * (Net_Export))
# Net_Export = Total_Out - Total_In
# 只有当 Net_Export > 0 时才算真正卖钱，防止倒买倒卖
# (数学上，只要 Price > 0，求解器会自动最大化 Net Export，不会做无意义的倒买倒卖)

profit_terms = []
for i, price in prices.items():
    total_export = pulp.lpSum([f_out[z][i] for z in zones_conf])
    total_import = pulp.lpSum([f_in[z][i] for z in zones_conf])
    profit_terms.append(price * (total_export - total_import))

model += pulp.lpSum(profit_terms), "Total_Profit"

# ==========================================
# 3. 求解与输出 (Solve & Output)
# ==========================================

print("正在启动求解器...")
# 使用 CBC 求解器 (PuLP自带)
# msg=True 会显示求解日志
model.solve(pulp.PULP_CBC_CMD(msg=False)) 

print(f"求解状态: {pulp.LpStatus[model.status]}")
print(f"最大总利润: {pulp.value(model.objective):.2f}/min")
print("-" * 30)

for z in zones_conf:
    print(f"=== {z} 方案 ===")
    
    # 1. 机器建造情况
    print("  [机器配置]")
    has_machine = False
    for r in recipes:
        val = x[z][r['id']].varValue
        if val and val > 0:
            has_machine = True
            print(f"    - {r['machine']} (配方: {r['name']}): {int(val)} 台")
    if not has_machine:
        print("    (无机器)")

    # 2. 端口与物流情况
    print("  [物流端口]")
    # 输入口 (从 Pool 拉货)
    for i in all_items:
        p_val = p_in[z][i].varValue
        f_val = f_in[z][i].varValue
        if p_val and p_val > 0:
            print(f"    <- 拉取 {i}: {f_val:.1f}/min (占用 {int(p_val)} 端口)")
            
    # 输出口 (向 Pool 供货)
    for i in all_items:
        p_val = p_out[z][i].varValue
        f_val = f_out[z][i].varValue
        if p_val and p_val > 0:
            # 判断是卖出还是中间品流转
            is_sold = i in prices
            tag = "(卖出)" if is_sold else "(中间品)"
            print(f"    -> 推送 {i}: {f_val:.1f}/min (占用 {int(p_val)} 端口) {tag}")
            
    # 资源检查
    total_op = sum(p_in[z][i].varValue for i in all_items)
    total_ip = sum(p_out[z][i].varValue for i in all_items)
    print(f"  [统计] 输入口: {int(total_op)}/{zones_conf[z]['max_op']}, 输出口: {int(total_ip)}/{zones_conf[z]['max_ip']}")
    print("-" * 20)