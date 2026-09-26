@echo off
REM Para o servidor de telemetria do Assetto Corsa.
REM
REM   PARAR.bat          para o servidor da porta 8765
REM   PARAR.bat 9000     para o da porta 9000
REM
REM A logica esta em parar.ps1, porque em batch nao da' para ler a
REM linha de comando de um processo - e sem essa confirmacao o script
REM podia matar o python do Content Manager, que tambem se chama
REM python.exe.

setlocal
cd /d "%~dp0"

if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "parar.ps1" -Porta 8765
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "parar.ps1" -Porta %1
)

echo.
pause
endlocal
