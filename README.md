<div align="center">
  <img src="img/logo.svg" alt="Endfield Industrial Calculator" width="100%" />
</div>

<div align="center">

# 终末地工业计算器
### Endfield Industrial Calculator

[**English (README_EN.md)**](README_EN.md)

</div>

---

### 项目简介
本项目是一个针对《终末地》工业系统的可视化规划与优化工具。通过直观的节点拖拽与连接，您可以设计(其实不能)复杂的工厂布局，并通过内置的算法引擎计算最优的资源配置方案。

### 核心功能
- **可视化蓝图设计**：支持拖拽式节点编辑（拖拽√ 编辑×），所见即所得的工厂布局设计。
- **智能产线优化**：基于全局资源限制，自动计算最大化收益的生产配比。

### 算法核心逻辑
本项目使用 **混合整数线性规划 (MILP)** 进行全局优化。
*详细数学模型请参考 [PLAN.md](PLAN.md)*

1.  **全局资源限制**：根据玩家设定的原矿采集上限，规划最佳产出。
2.  **区域物流平衡**：自动计算每个地块 (Zone) 的输入输出，并确保跨区物流守恒（发出的货物必须等于收到的货物）。
3.  **端口离散化**：准确模拟游戏机制，每个物品占用独立的输入/输出端口（使用整数变量约束）。
4.  **空间与电力约束**：（电力还没做）
    *   **面积限制**：机器占地 + 传送带估算面积 $\le$ 地块最大面积。
    *   **机器数量**：受限于地块的插槽上限。
5.  **目标函数**：
    *   最大化 **净利润** (卖出价值 - 运输成本)。
    *   包含 **配方激活惩罚** (鼓励产线专一化) 和 **机器数量惩罚** (鼓励使用更少的高效机器)。

### 界面预览
<div align="center">
  <img src="img/demo1.png" alt="Dashboard Showcase" width="100%" style="border-radius: 8px; border: 1px solid #333;" />
</div>
<div align="center"><p style="font-size:9px; color:gray">Gemini 做的真好看</p></div>

---

### 快速开始

#### 1. 环境准备
请确保您的系统已安装以下基础环境：
- **Node.js:** v18+ [下载](https://nodejs.org/)
- **Python:** v3.13+ [下载](https://www.python.org/)

#### 2. 安装依赖
运行项目根目录下的安装脚本，自动配置 Python 虚拟环境及依赖库。

*   **Windows:**
    ```cmd
    install.bat
    ```
*   **Linux / macOS:**
    ```bash
    chmod +x *.sh
    ./install.sh
    ```

#### 3. 编译前端
将 React 前端代码编译为静态资源：
*   **Windows:** `setup.bat`
*   **Linux / macOS:** `./setup.sh`

#### 4. 启动应用
本项目采用前后端分离架构，需**同时**启动两个服务。

**步骤 A: 启动后端求解器**
```bash
# Windows
venv\Scripts\activate
python main.py

# Linux / macOS
source venv/bin/activate
python main.py
```
*(后端服务端口: 8000)*

**步骤 B: 启动前端界面**
在新的终端窗口中运行：
```bash
npm run dev
```
*(访问地址: http://localhost:5173)*

---

### 使用指南
1.  浏览器访问 `http://localhost:5173`。
2. 自己试试就懂了

