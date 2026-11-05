@echo off
title Ampolin - n8n Workflow Automation (Cloud Tunnel 24/7)
echo ========================================================
echo   Starting n8n with Free Cloud Webhook Tunnel
echo   Local Dashboard: http://localhost:5678
echo   External Tunnel: (Printed below in console)
echo   Press Ctrl+C in this window anytime to stop n8n.
echo ========================================================
echo.
timeout /t 3 /nobreak >nul
start http://localhost:5678
n8n start --tunnel
pause
