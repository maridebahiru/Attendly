@echo off
cd /d "%~dp0"
title Attendance System Biometric Bridge

echo =======================================================
echo     ATTENDANCE SYSTEM BIOMETRIC BRIDGE (LOCAL TO CLOUD)
echo =======================================================
echo.
echo This bridge will pull punches from your local reader
echo and save them directly into your Render Postgres database.
echo.

:: IMPORTANT: Replace the database URL below with your actual Render Postgres URL
set DATABASE_URL=postgresql://user:password@host/database

:: Check if virtual environment exists
if not exist "venv\Scripts\activate.bat" (
    echo [ERROR] Python Virtual Environment (venv) was not found in this folder.
    echo Please ensure you copy the entire 'backend' folder including 'venv'
    echo to the computer and run this script.
    echo.
    pause
    exit /b
)

echo Starting connection and sync loop...
call venv\Scripts\activate
python -m uvicorn main:app --port 8080

pause
