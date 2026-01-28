## Endfield Industrial Calculator

### Solvers
- **Built-in (WASM):** Runs directly in your browser using `javascript-lp-solver`. No setup required.
- **Python (FastAPI):** Uses a MILP model with `PuLP` and `CBC`. Requires a Python environment.

To use the Python solver:
1. Run the install script for your platform:
   - Windows: `install.bat`
   - Linux/macOS: `bash install.sh`
2. Start the backend: `npm run backend` (or `python main.py`)
3. Select "Python (FastAPI)" in the calculator settings.

### Deployment & Setup
- **Install:** Installs all Node.js and Python dependencies.
  - `install.bat` (Windows)
  - `install.sh` (Linux/macOS)
- **Setup:** Ensures dependencies are installed and builds the frontend.
  - `setup.bat` (Windows)
  - `setup.sh` (Linux/macOS)
- **Deploy:** Performs a full installation and production build.
  - `deploy.bat` (Windows)
  - `deploy.sh` (Linux/macOS)
