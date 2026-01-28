<div align="center">
  <img src="img/logo.svg" alt="Endfield Industrial Calculator" width="100%" />
</div>

<div align="center">

# Endfield Industrial Calculator
### Industrial Optimization Protocol

[**中文 (README.md)**](README.md)

</div>

---

### Introduction
A specialized visual planning and optimization tool for the Endfield industrial system. Design complex factory layouts with drag-and-drop nodes and optimize resource allocation using our advanced algorithmic engine.

### Key Features
- **Visual Blueprint Designer:** Drag-and-drop nodes to create and manage your factory layout intuitively.
- **Intelligent Optimization:** Automatically calculate the most profitable production ratios based on global resource constraints.
- **Cross-Platform:** Fully compatible with Windows, macOS, and Linux.

### Algorithm Logic
This project uses **Mixed-Integer Linear Programming (MILP)** for global optimization.
*For detailed mathematical models, see [PLAN.md](PLAN.md)*

1.  **Global Resource Constraints**: Optimizes output based on raw material mining limits set by the user.
2.  **Zone Logistics Balance**: Automatically calculates input/output for each zone and ensures cross-zone logistics conservation (Total Export $\ge$ Total Import).
3.  **Discrete Ports**: Accurately simulates game mechanics where each item type occupies a dedicated Input/Output port (using Integer constraints).
4.  **Space & Power Constraints**:
    *   **Area Limit**: Machine Area + Estimated Belt Area $\le$ Zone Max Area.
    *   **Machine Slots**: Limited by the zone's max slot capacity.
5.  **Objective Function**:
    *   Maximize **Net Profit** (Sales Value - Transport Cost).
    *   Includes **Recipe Activation Penalty** (encourages specialization) and **Machine Count Penalty** (encourages efficiency).

### Interface Showcase
<div align="center">
  <img src="img/demo1.png" alt="Dashboard Showcase" width="100%" style="border-radius: 8px; border: 1px solid #333;" />
</div>

---

### Quick Start

#### 1. Prerequisites
Ensure you have the following installed:
- **Node.js:** v18+ [Download](https://nodejs.org/)
- **Python:** v3.13+ [Download](https://www.python.org/)

#### 2. Installation
Run the install script to download dependencies and set up the Python virtual environment.

*   **Windows:**
    ```cmd
    install.bat
    ```
*   **Linux / macOS:**
    ```bash
    chmod +x *.sh
    ./install.sh
    ```

#### 3. Build Frontend
Compile the React application into static assets:

*   **Windows:** `setup.bat`
*   **Linux / macOS:** `./setup.sh`

#### 4. Run Application
The application requires both the Backend and Frontend to be running.

**Step A: Start Backend Solver**
```bash
# Windows
venv\Scripts\activate
python main.py

# Linux / macOS
source venv/bin/activate
python main.py
```
*(Backend runs on port 8000)*

**Step B: Start Frontend**
In a new terminal:
```bash
npm run dev
```
*(Access at: http://localhost:5173)*

---
### Usage
1.  Open your browser to `http://localhost:5173`.
2.  Click the **Settings (⚙️)** icon.
3.  **Select Solver**:
    *   `Built-in (WASM)`: Lightweight, for basic calculations (No backend required).
    *   `Python (FastAPI)`: Recommended for complex multi-zone optimization (Requires backend).

### Tech Stack
- **Frontend:** React, Vite (SWC/Babel), TypeScript
- **Backend:** Python, FastAPI, PuLP (Optimization)
- **UI Theme:** Industrial Sci-Fi (Dark Mode)
