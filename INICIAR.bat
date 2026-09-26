@echo off
REM Arranca o servidor de telemetria do Assetto Corsa.
REM Abrir o browser automaticamente.
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python nao encontrado. Instala o Python 3 e volta a tentar.
  pause
  exit /b 1
)

start "" http://localhost:8765/
python server.py --port 8765

endlocal
