@echo off
chcp 65001 >nul
title Generar instalador React - Bienes y Patrimoniales
cd /d "%~dp0"

echo.
echo ====================================================
echo  GENERAR .exe con interfaz React (v1.9+)
echo ====================================================
echo.
echo 1) CERRA por completo "Bienes y Patrimoniales" si esta abierto.
echo 2) Se compilara React + empaquetara con electron-builder.
echo    Puede tardar varios minutos.
echo.
pause

echo.
echo [1/2] Compilando React...
call npm run build:renderer
if errorlevel 1 (
  echo ERROR al compilar React.
  pause
  exit /b 1
)

echo.
echo [2/2] Generando instalador Windows...
call npm run dist:win
if errorlevel 1 (
  echo ERROR al generar instalador.
  pause
  exit /b 1
)

echo.
echo ====================================================
echo  LISTO
echo ====================================================
echo.
echo Instalador:
echo   release\Bienes.y.Patrimoniales.Setup.1.9.5.exe
echo.
echo O ejecutar sin instalar:
echo   release\win-unpacked\Bienes y Patrimoniales.exe
echo.
pause
