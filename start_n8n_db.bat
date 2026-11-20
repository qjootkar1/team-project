@echo off
title AccountScope - n8n and Database Starter
cls

echo ========================================================
echo   AccountScope - n8n Automation and Database Starter
echo ========================================================
echo.

where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH.
    echo If you do not want to use Docker, simply double-click:
    echo     start_n8n_no_docker.bat
    echo.
    pause
    exit /b 1
)

echo [1/3] Checking Docker daemon status...
docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker Desktop application is NOT RUNNING!
    echo Please open Docker Desktop from your Windows Start Menu first.
    echo Wait until the whale icon turns green (Engine running),
    echo OR simply double-click "start_n8n_no_docker.bat" (no Docker needed!)
    echo.
    pause
    exit /b 1
)

echo [2/3] Starting PostgreSQL Database and n8n Service...
docker compose up -d

if %errorlevel% neq 0 (
    echo [ERROR] Failed to start Docker Compose services.
    pause
    exit /b 1
)

echo [3/3] Services started successfully!
echo       - PostgreSQL Database : localhost:5432 (DB: accountscope)
echo       - n8n Automation      : http://localhost:5678
echo.
echo Opening n8n dashboard in your default browser...
start http://localhost:5678
echo.
pause
