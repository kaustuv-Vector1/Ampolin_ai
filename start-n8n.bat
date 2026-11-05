@echo off
title Ampolin - n8n Workflow Automation (Local)
echo ========================================================
echo   Starting n8n Local Workflow Engine for Ampolin
echo   Opening: http://localhost:5678
echo   Press Ctrl+C in this window anytime to stop n8n.
echo ========================================================
echo.
timeout /t 3 /nobreak >nul
start http://localhost:5678
n8n start
pause
