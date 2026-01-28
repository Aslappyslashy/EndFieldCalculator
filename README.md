<div align="center">
  <img src="img/logo.svg" alt="Endfield Industrial Calculator" width="400" />
  <br/>
  <img src="img/demo1.png" alt="Dashboard Showcase" width="800" />
</div>

# 终末地工业计算器 (Endfield Industrial Calculator)

[中文](#中文指南) | [English](#english-guide)

---

<a name="中文指南"></a>
## 🇨🇳 中文指南

### 功能特性
- **可视化生产流程：** 拖拽节点设计工厂布局，直观管理生产线。
- **全局资源管理：** 设定原料限制，通过算法优化实现最大利润。
- **多平台支持：** 完全兼容 Windows, macOS, 和 Linux 系统。

### 安装说明

#### 前置要求
1.  **Node.js:** (v18 或更高版本) [点击下载](https://nodejs.org/)
2.  **Python:** (v3.13 或更高版本) [点击下载](https://www.python.org/)
3.  **Git:** (可选) 用于克隆仓库。

#### 1. 安装
运行对应操作系统的安装脚本以下载依赖并创建 Python 虚拟环境。

*   **Windows:**
    ```cmd
    install.bat
    ```
*   **Linux / macOS:**
    ```bash
    chmod +x *.sh
    ./install.sh
    ```

#### 2. 构建前端
将 React 应用编译为优化后的静态文件以供部署：

*   **Windows:**
    ```cmd
    setup.bat
    ```
*   **Linux / macOS:**
    ```bash
    ./setup.sh
    ```

#### 3. 运行应用
您需要同时运行 **后端 (Backend)** (用于高级求解器) 和 **前端 (Frontend)**。

**1. 启动后端求解器：**
*   **Windows:**
    ```cmd
    venv\Scripts\activate
    python main.py
    ```
*   **Linux / macOS:**
    ```bash
    source venv/bin/activate
    python main.py
    ```
*(后端将运行在 `http://localhost:8000`)，可在 main.py 中配置*

**2. 启动前端：**
打开一个新的终端窗口并运行：
```bash
npm run dev
```
*(前端将运行在 `http://localhost:5173`)*

#### 4. 浏览器中使用
1.  打开浏览器访问前端地址。
2.  点击 **设置 (Settings)** (齿轮图标)。
3.  在 **求解器类型 (Solver Type)** 下选择：
    *   `Built-in (WASM)`：用于无需后端的基础计算，但可能无法求解复杂情况。
    *   `Python (FastAPI)`：用于复杂的多区域优化 (需要后端运行)。

---

<a name="english-guide"></a>
## 🇺🇸 English Guide

### Features
- **Visual Production Flow:** Drag-and-drop nodes to design your factory layout.
- **Global Resource Management:** Set limits on raw resources and optimize for maximum profit.
- **Multi-Platform:** Fully compatible with Windows, macOS, and Linux.

### Setup Instructions

#### Prerequisites
1.  **Node.js:** (v18 or higher) [Download here](https://nodejs.org/)
2.  **Python:** (v3.13 or higher) [Download here](https://www.python.org/)
3.  **Git:** (Optional) To clone the repository.

#### 1. Installation
Run the install script for your specific operating system to download dependencies and create a Python virtual environment.

*   **Windows:**
    ```cmd
    install.bat
    ```
*   **Linux / macOS:**
    ```bash
    chmod +x *.sh
    ./install.sh
    ```

#### 2. Building the Frontend
To compile the React application into optimized static files for deployment:

*   **Windows:**
    ```cmd
    setup.bat
    ```
*   **Linux / macOS:**
    ```bash
    ./setup.sh
    ```

#### 3. Running the Application
You need to run both the **Backend** (for the advanced solver) and the **Frontend**.

**1. Start the Backend Solver:**
*   **Windows:**
    ```cmd
    venv\Scripts\activate
    python main.py
    ```
*   **Linux / macOS:**
    ```bash
    source venv/bin/activate
    python main.py
    ```
*(The backend will run on `http://localhost:8000`) configurable in main.py* 

**2. Start the Frontend:**
Open a new terminal and run:
```bash
npm run dev
```
*(The frontend will be available at `http://localhost:5173`)*

#### 4. Usage in Browser
1.  Open your browser to the frontend URL.
2.  Go to **Settings** (Gear icon).
3.  Under **Solver Type**, select:
    *   `Built-in (WASM)` for basic calculations without the backend, but often fail to solve.
    *   `Python (FastAPI)` for complex multi-zone optimization (requires backend to be running).

---

