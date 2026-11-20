@echo off
title AccountScope Server
cd /d "%~dp0"

echo ======================================================
echo   Starting AccountScope Local Web Server...
echo ======================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% equ 0 goto USE_NODE

:: 2. Check Python (Avoid Windows Store Dummy)
python -c "import sys" >nul 2>nul
if %errorlevel% equ 0 goto USE_PYTHON

:: 3. Check Python Launcher
py -c "import sys" >nul 2>nul
if %errorlevel% equ 0 goto USE_PY

:: 4. Fallback to direct HTML
echo Neither Node.js nor Python was detected.
echo Opening index.html directly in browser...
start "" "%~dp0index.html"
goto :eof

:USE_NODE
echo [1/1] Node.js environment detected. Starting server...
node server.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server encountered an error.
    pause
)
goto :eof

:USE_PYTHON
echo [1/1] Python environment detected. Starting server...
python server.py
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server encountered an error.
    pause
)
goto :eof

:USE_PY
echo [1/1] Python Launcher detected. Starting server...
py server.py
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server encountered an error.
    pause
)
goto :eof
