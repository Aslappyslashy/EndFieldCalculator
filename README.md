## Endfield Industrial Calculator

### Features
- **Visual Production Flow:** Drag-and-drop nodes to design your factory layout.
- **Global Resource Management:** Set limits on raw resources and optimize for maximum profit.
- **Multi-Platform:** Fully compatible with Windows, macOS, and Linux.

---

###  Setup Instructions

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

###  Solvers Details

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

