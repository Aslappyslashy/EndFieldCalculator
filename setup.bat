@echo off
setlocal enabledelayedexpansion

echo Starting setup...

if not exist "node_modules" (
    echo node_modules missing. Running install.bat...
    call install.bat
) else if not exist "venv" (
    echo Python venv missing. Running install.bat...
    call install.bat
) else (
    echo Dependencies already installed.
)

echo Building project...
call npm run build

echo Setup complete!
pause
