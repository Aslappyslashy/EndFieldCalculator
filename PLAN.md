# 多区域生产与物流优化模型 (Multi-Zone Production Model)

## 1. 集合定义 (Sets)

*   $Z$: **区域集合 (Zones)**。例如 $\{z_1, z_2, ...\}$，代表独立的生产车间或星球。
*   $I$: **物品集合 (Items)**。
    *   $I_{raw} \subset I$: **原材料** (受全局开采上限限制)。
    *   $I_{sell} \subset I$: **最终产品** (可出售获利)。
*   $R$: **配方集合 (Recipes)**。每种配方对应一种生产机器。

---

## 2. 参数设置 (Parameters)

### 2.1 全局设置 (Global)
*   $Cap_{port}$: **端口吞吐量** (30 items/min)。每个物流口每分钟能传输的物品数。
*   $Limit_{i}$: 原材料 $i$ 的**全局供应上限**。
*   $Target_{i}$: 物品 $i$ 的**目标净产出量**。
*   $Price_{i}$: 物品 $i$ 的**单位售价**。
*   $BeltAreaFactor$: **传送带占地系数** (0.15)。用于估算物流设施占用的额外面积。

### 2.2 区域属性 ($z \in Z$)
*   $MaxOP_{z}$: **最大输入端口数** (Pool $\to$ Zone)。允许从总线/资源池拉取资源的最大接口数。
*   $MaxIP_{z}$: **最大输出端口数** (Zone $\to$ Pool)。允许向总线/资源池输送资源的最大接口数。
*   $MaxArea_{z}$: 该区域的**最大可用面积**。
*   $MaxSlots_{z}$: 该区域的**最大机器数量上限**。

### 2.3 配方与机器属性 ($r \in R$)
*   $Rate_r$: **标准产能** (items/min)。机器满载运行时的标准速率。
*   $In_{i,r}$: 生产单位产物所需的**输入物品 $i$ 数量**。
*   $Out_{i,r}$: **输出物品 $i$ 数量** (通常为1)。
*   $Area_{r}$: 单台机器的**占地面积**。
*   $Elec_{r}$: 单台机器的**耗电量**。

---

## 3. 决策变量 (Decision Variables)

模型需要求解以下变量的最优值：

### A. 生产决策 (Production)
*   $x_{r,z} \in \mathbb{Z}_{\ge 0}$: **机器数量** (整数)。在区域 $z$ 建造多少台配方 $r$ 的机器。
*   $y_{r,z} \ge 0$: **实际生产速率** (连续值)。考虑到原料可能不足，机器不一定满负荷运转。
*   $active_{r,z} \in \{0, 1\}$: **是否启用配方** (0/1变量)。该区域是否引入了该种配方。

### B. 物流决策 (Logistics)
*   $f^{in}_{i,z} \ge 0$: **流入量** (Pool $\to$ Zone)。从外界运入区域 $z$ 的物品 $i$ 数量。
*   $f^{out}_{i,z} \ge 0$: **流出量** (Zone $\to$ Pool)。从区域 $z$ 运出到外界的物品 $i$ 数量。

### C. 基础设施 (Infrastructure)
*   $p^{in}_{i,z} \in \mathbb{Z}_{\ge 0}$: 分配的**输入端口数量**。
*   $p^{out}_{i,z} \in \mathbb{Z}_{\ge 0}$: 分配的**输出端口数量**。

---

## 4. 约束条件 (Constraints)

### (1) 产能与启用逻辑
> **逻辑**：机器跑得再快也不能超过理论极限；且如果未“启用”该配方，则机器数量必须为0。

$$
y_{r,z} \le x_{r,z} \cdot Rate_{r}
$$
$$
x_{r,z} \le M \cdot active_{r,z}
$$
*   注：$M$ 为大数 (Big-M)。当 $active=0$ 时，强制 $x=0$。

### (2) 区域内物料平衡 (Material Balance)
> **逻辑**：在一个区域内，**产出的 + 运进来的 = 消耗的 + 运出去的**。所有的物品必须守恒，不能凭空消失或产生。

$$
\sum_{r} y_{r,z} \cdot \mathbb{I}(out=i) + f^{in}_{i,z} = \sum_{r} y_{r,z} \cdot \frac{In_{i,r}}{Rate_r} + f^{out}_{i,z}
$$
*   $\mathbb{I}(out=i)$: 指示函数，仅当配方 $r$ 产出物品 $i$ 时为 1。
*   $\frac{In_{i,r}}{Rate_r}$: 单位产出所需的原料消耗比率。

### (3) 全局物流守恒
> **逻辑**：对于中间产物，所有区域的**总出口量**必须能够覆盖所有区域的**总进口量**。

$$
\sum_{z} f^{out}_{i,z} \ge \sum_{z} f^{in}_{i,z}
$$

### (4) 端口容量限制
> **逻辑**：要想运输物品，必须分配相应的端口。没有端口就没有流量。

$$
f^{in}_{i,z} \le p^{in}_{i,z} \cdot Cap_{port}
$$
$$
\sum_{i} p^{in}_{i,z} \le MaxOP_{z}
$$
*   注：输出流量 $f^{out}$ 同理受 $MaxIP_z$ 限制。

### (5) 物理空间限制 (面积与数量)
> **逻辑**：机器本身占地，连接机器的传送带（物流）也占地。两者之和不能超过区域面积。

$$
\text{MachineArea} = \sum_{r} x_{r,z} \cdot Area_{r}
$$
$$
\text{BeltArea} = \sum_{r} x_{r,z} \cdot (\text{TotalInput} + \text{Output}) \cdot BeltAreaFactor
$$
$$
\text{MachineArea} + \text{BeltArea} \le MaxArea_{z}
$$

**机器总数限制：**
$$
\sum_{r} x_{r,z} \le MaxSlots_{z}
$$

---

## 5. 目标函数 (Objective Function)

我们希望**最大化**总利润：

$$
\textbf{Maximize: } \text{Total Income} - \text{Total Penalties}
$$

### 1. 收入 (Income)
卖出物品带来的收益。
$$
\sum_{i \in I_{sell}} Price_{i} \cdot \max(0, \text{NetExport}_{i} - Target_{i})
$$

### 2. 惩罚成本 (Penalties)
为了引导模型产生“漂亮”的布局，我们需要扣除以下虚拟成本：

1.  **产量缺口惩罚 (Shortfall)**: 未达到 $Target_i$ 时施加巨额惩罚 (保证优先满足目标)。
2.  **运输拥堵成本 (Transfer)**: $\lambda \cdot \text{Flow}$。减少不必要的跨区域搬运。
3.  **机器维护成本 (Machine)**: 每台机器的微小成本。鼓励用更少的机器做更多的事。
4.  **产线碎片化惩罚 (Activation)**: 只要启用了某种配方就扣分。鼓励将同类加工集中在同一个区域，而不是分散在各地。
5.  **端口闲置惩罚 (Port Usage)**: 防止模型分配了端口却不使用。