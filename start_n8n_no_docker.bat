@echo off
title AccountScope - n8n (No Docker)
cls

echo ========================================================
echo   AccountScope - n8n Direct Starter (No Docker Needed)
echo ========================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found.
    echo Please install Node.js or run Docker Desktop.
    pause
    exit /b 1
)

echo [1/2] Starting n8n server directly via npx...
echo       (No Docker Desktop required! Fast and lightweight)
echo.
echo Webhook URL: http://localhost:5678/webhook/generate-ai-summary
echo Keep this window OPEN while testing workflows!
echo.

start http://localhost:5678
npx n8n
pause
