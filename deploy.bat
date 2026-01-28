@echo off
setlocal enabledelayedexpansion

echo Deploying Endfield Industrial Calculator...

echo 1. Installing/Updating dependencies...
call install.bat

echo 2. Building frontend...
call npm run build

echo 3. Production build ready in 'dist' directory.
echo    To run the backend, use: venv\Scripts\activate && python main.py
echo    To serve the frontend, use: npm run preview

echo Deployment preparation complete!
pause
