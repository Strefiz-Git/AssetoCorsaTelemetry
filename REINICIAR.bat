@echo off
REM Para o servidor de telemetria e arranca outro, em segundo plano.
REM
REM E' este que se usa depois de mexer no acshm.py ou no server.py: o
REM servidor le o codigo uma vez so, no arranque. Nos ficheiros de
REM static/ nao e' preciso - o browser vai busca-los de cada vez.
REM
REM   REINICIAR.bat          porta 8765
REM   REINICIAR.bat 9000     outra porta
REM
REM Pode fechar esta janela: o servidor continua a correr. Para o parar,
REM corra PARAR.bat.

setlocal
cd /d "%~dp0"

if "%~1"=="" (set "PORTA=8765") else (set "PORTA=%~1")

powershell -NoProfile -ExecutionPolicy Bypass -File "parar.ps1" -Porta %PORTA%

powershell -NoProfile -ExecutionPolicy Bypass -File "arrancar.ps1" -Porta %PORTA%

if errorlevel 1 pause
endlocal
