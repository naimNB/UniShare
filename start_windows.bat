@echo off
REM ==============================================================================
REM UniShare — Windows Quick Launch Script
REM ==============================================================================
title UniShare Demo Launcher
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ========================================================================
echo           UniShare University Academic Resource Sharing Demo
echo ========================================================================
echo Starting local demo setup on Windows...
echo.

REM 1. Check prerequisites
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is required but not found in PATH.
    echo Please install Python 3.10+ from https://www.python.org/
    pause
    exit /b 1
)

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is required but not found in PATH.
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

echo [INFO] Python and Node.js detected.

REM 2. Setup backend virtual environment (Windows-native)
if not exist "backend\venv\" (
    echo [INFO] Creating Python virtual environment in backend\venv...
    python -m venv backend\venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo [INFO] Installing backend dependencies...
    backend\venv\Scripts\python.exe -m pip install --upgrade pip
    backend\venv\Scripts\pip.exe install -r backend\requirements.txt
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install backend dependencies.
        pause
        exit /b 1
    )
) else (
    echo [INFO] Backend virtual environment found.
)

REM 3. Setup frontend dependencies
if not exist "frontend\node_modules\" (
    echo [INFO] Installing frontend dependencies (npm install)...
    cd frontend
    call npm install
    cd ..
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install frontend dependencies.
        pause
        exit /b 1
    )
) else (
    echo [INFO] Frontend node_modules found.
)

REM 4. Verify / seed local SQLite database & demo storage
if not exist "backend\storage\uploads\" mkdir "backend\storage\uploads"
if not exist "backend\storage\submissions\" mkdir "backend\storage\submissions"

if not exist "backend\unishare.db" (
    echo [INFO] Initializing demo SQLite database and sample academic PDFs...
    backend\venv\Scripts\python.exe backend\scripts\seed.py
) else (
    echo [INFO] Existing local database found.
)

echo.
echo [INFO] Launching FastAPI Backend on http://127.0.0.1:8000...
start "UniShare Backend Service" cmd /k "backend\venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000"

echo [INFO] Opening UniShare in default web browser...
timeout /t 2 /nobreak >nul
start http://localhost:5173

echo.
echo ========================================================================
echo   UniShare is starting!
echo   - Web App:      http://localhost:5173
echo   - API Docs:     http://127.0.0.1:8000/docs
echo   - Storage:      Local Filesystem (backend\storage\uploads)
echo   - Database:     Local SQLite (backend\unishare.db)
echo ========================================================================
echo.

cd frontend
call npm run dev -- --host 127.0.0.1 --port 5173

pause
