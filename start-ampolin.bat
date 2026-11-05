@echo off
title Ampolin AI Studio
echo ========================================================
echo   Starting Ampolin AI Studio Engine
echo   Groq + Gemini + n8n + Ollama Hybrid
echo   Opening: http://localhost:3005
echo   Press Ctrl+C in this window anytime to stop.
echo ========================================================
echo.
timeout /t 2 /nobreak >nul
start http://localhost:3005
node server.js
pause
