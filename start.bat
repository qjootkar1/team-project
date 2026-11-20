@echo off
title AccountScope Server
cd /d "%~dp0"

echo ======================================================
echo   Starting AccountScope Local Web Server...
echo ======================================================
echo.

python --version >nul 2>&1
if %errorlevel% equ 0 (
    python server.py
    goto :eof
)

py --version >nul 2>&1
if %errorlevel% equ 0 (
    py server.py
    goto :eof
)

node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Python not found. Starting with Node.js...
    start http://localhost:8000
    npx -y serve -p 8000 "%~dp0"
    goto :eof
)

echo Python or Node.js not detected.
echo Opening index.html directly in your default browser...
start index.html

:eof
