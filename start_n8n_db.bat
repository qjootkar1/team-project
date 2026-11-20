@echo off
title AccountScope - n8n & Database Starter
cls

echo ========================================================
echo   AccountScope - n8n Automation & Database Starter
echo ========================================================
echo.

where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not running.
    echo Please install Docker Desktop from https://www.docker.com
    echo and ensure it is started, then run this file again.
    echo.
    pause
    exit /b 1
)

echo [1/3] Starting PostgreSQL Database and n8n Service...
docker compose up -d

if %errorlevel% neq 0 (
    echo [ERROR] Failed to start Docker Compose services.
    echo Please check Docker Desktop engine status.
    echo.
    pause
    exit /b 1
)

echo [2/3] Services started successfully!
echo       - PostgreSQL Database : localhost:5432 (DB: accountscope)
echo       - n8n Automation      : localhost:5678
echo.
echo [3/3] Opening n8n dashboard in your default browser...
start http://localhost:5678

echo.
echo ========================================================
echo [Setup Instructions]
echo 1. In n8n (http://localhost:5678), click "Add Workflow"
echo 2. Click "..." at top-right, choose "Import from File"
echo 3. Select "n8n_accounting_ai_workflow.json"
echo 4. Set your OpenAI/Gemini API key in the LLM node credential
echo 5. Click "Save" and toggle the workflow to "Active"
echo ========================================================
echo.
pause
