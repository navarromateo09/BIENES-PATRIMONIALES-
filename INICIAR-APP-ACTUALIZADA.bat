@echo off
chcp 65001 >nul
title Bienes y Patrimoniales - React
cd /d "%~dp0"
echo.
echo Iniciando app con interfaz React...
echo (Si no compilaste antes, usa INICIAR-REACT.bat para desarrollo)
echo.
if not exist "renderer\dist\index.html" (
  echo Compilando React por primera vez...
  call npm run build:renderer
)
npm start
pause
