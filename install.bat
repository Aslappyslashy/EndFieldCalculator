@echo off
setlocal enabledelayedexpansion

echo Installing Node.js dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo npm install failed
    exit /b %ERRORLEVEL%
)

echo Setting up Python virtual environment...
python -m venv venv
if %ERRORLEVEL% neq 0 (
    echo Python venv creation failed
    exit /b %ERRORLEVEL%
)

echo Activating virtual environment and installing Python dependencies...
call venv\Scripts\activate
python -m pip install --upgrade pip
pip install fastapi uvicorn pulp highspy pydantic
if %ERRORLEVEL% neq 0 (
    echo Python dependencies installation failed
    exit /b %ERRORLEVEL%
)

echo Installation complete!
pause
