@echo off
cd /d "%~dp0"
title App de Alquileres - NO CERRAR (deja la app andando)

if not exist "config.json" (
    echo Primero ejecuta CONFIGURAR.bat
    pause
    exit /b
)

if not exist "node_modules" (
    echo Instalando dependencias por primera vez...
    call npm install
)

REM Cerrar instancias previas en los puertos
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8000 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5174 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1

REM Backend como proceso hijo de esta ventana (muere al cerrarla)
start /b python "%~dp0backend\server.py"

REM Abrir navegador
timeout /t 3 /nobreak >nul
start "" "http://localhost:5174"

echo.
echo  ==================================================
echo   App corriendo - para CERRAR cerra esta ventana
echo  ==================================================
echo   PC:   http://localhost:5174
echo   Celu: http://%%COMPUTERNAME%%:5174
echo  ==================================================
echo.

REM Vite en primer plano: mantiene la ventana. Al cerrarla, muere todo.
call npm run dev

REM Si Vite termina por su cuenta, limpiar el backend
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8000 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1