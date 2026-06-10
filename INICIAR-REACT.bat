@echo off
chcp 65001 >nul
title Bienes y Patrimoniales - React
cd /d "%~dp0"
echo.
echo Iniciando app React (Vite + Electron)...
echo.
npm run dev
pause
