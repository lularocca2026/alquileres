@echo off
chcp 65001 > nul
cls
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   APP DE ALQUILERES — Configuración inicial  ║
echo  ╚══════════════════════════════════════════════╝
echo.
echo  Este asistente configura la app en esta computadora.
echo  Solo hay que hacerlo UNA VEZ.
echo.
pause

:: ── PASO 1: Verificar Node.js ────────────────────────────────────────────────
cls
echo.
echo  PASO 1 DE 3 — Instalar Node.js
echo  ───────────────────────────────
node --version > nul 2>&1
if errorlevel 1 (
    echo.
    echo  Node.js NO esta instalado.
    echo.
    echo  Vamos a abrir la pagina de descarga en el navegador.
    echo  Instala la version que dice "LTS" y volvé a correr este archivo.
    echo.
    pause
    start "" "https://nodejs.org/en/download/"
    exit /b
) else (
    for /f %%i in ('node --version') do set NODE_VER=%%i
    echo  [OK] Node.js %NODE_VER% ya instalado.
)

:: ── PASO 2: Verificar Python ─────────────────────────────────────────────────
cls
echo.
echo  PASO 2 DE 3 — Instalar Python
echo  ───────────────────────────────
python --version > nul 2>&1
if errorlevel 1 (
    echo.
    echo  Python NO esta instalado.
    echo.
    echo  Vamos a abrir la pagina de descarga en el navegador.
    echo  IMPORTANTE: Marcar "Add Python to PATH" al instalar.
    echo  Luego volvé a correr este archivo.
    echo.
    pause
    start "" "https://www.python.org/downloads/"
    exit /b
) else (
    for /f %%i in ('python --version') do set PY_VER=%%i
    echo  [OK] %PY_VER% ya instalado.
)

:: ── PASO 3: Carpeta de WhatsApp ──────────────────────────────────────────────
cls
echo.
echo  PASO 3 DE 3 — Carpeta para los archivos de WhatsApp
echo  ──────────────────────────────────────────────────────
echo.
echo  Los archivos que se importen desde WhatsApp (fotos, audios, etc.)
echo  se van a guardar en una carpeta de tu Dropbox.
echo.
echo  Opciones:
echo.
echo    1. Carpeta por defecto:
echo       %USERPROFILE%\Dropbox\WhatsApp Lucre
echo.
echo    2. Elegir otra ubicacion
echo.
set /p OPCION="  Elegí una opcion (1 o 2): "

if "%OPCION%"=="2" (
    echo.
    echo  Escribí la ruta completa de la carpeta (por ejemplo):
    echo  C:\Users\Lucre\Dropbox\MisArchivos
    echo.
    set /p WA_FOLDER="  Ruta: "
) else (
    set "WA_FOLDER=%USERPROFILE%\Dropbox\WhatsApp Lucre"
)

:: Crear la carpeta si no existe
if not exist "%WA_FOLDER%" mkdir "%WA_FOLDER%"

:: Escribir config.json
set "CONFIG_FILE=%~dp0config.json"
(
echo {
echo   "whatsapp_carpeta": "%WA_FOLDER:\=\\%",
echo   "notas": "Generado automaticamente por CONFIGURAR.bat"
echo }
) > "%CONFIG_FILE%"

echo.
echo  [OK] Carpeta configurada: %WA_FOLDER%

:: ── INSTALAR DEPENDENCIAS ────────────────────────────────────────────────────
cls
echo.
echo  Instalando dependencias (puede tardar unos minutos)...
echo.

cd /d "%~dp0"

echo  [1/2] Instalando dependencias web...
call npm install
if errorlevel 1 (
    echo  [!] Error en npm install. Intentá de nuevo.
    pause
    exit /b 1
)

echo.
echo  [2/2] Instalando dependencias Python...
pip install fastapi uvicorn anthropic python-multipart pillow openai-whisper xlsxwriter python-dotenv --quiet

:: ── LISTO ────────────────────────────────────────────────────────────────────
cls
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║          ¡Configuración completada!          ║
echo  ╚══════════════════════════════════════════════╝
echo.
echo  Para usar la app:
echo    → Doble clic en INICIAR.bat
echo.
echo  Desde el celular (misma red WiFi):
echo    → Abrí el navegador y entrá a:
echo       http://%COMPUTERNAME%:5174
echo.
set /p ABRIR="  ¿Abrir la app ahora? (S/N): "
if /i "%ABRIR%"=="S" call "%~dp0INICIAR.bat"

pause
