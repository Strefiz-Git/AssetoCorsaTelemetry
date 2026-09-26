@echo off
REM Arranca o servidor de telemetria do Assetto Corsa EM SEGUNDO PLANO
REM e abre o browser.
REM
REM Pode fechar esta janela logo que a abra: o servidor continua. Para o
REM parar, corra PARAR.bat.
REM
REM   INICIAR.bat          porta 8765
REM   INICIAR.bat 9000     outra porta
REM
REM A logica esta em arrancar.ps1. O servidor e' lancado com o
REM Start-Process do PowerShell, que cria um processo independente e sem
REM janela. O "start /b" do batch nao serve: o filho fica preso a consola
REM do pai e um Ctrl+C leva-o abaixo.

setlocal
cd /d "%~dp0"

if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "arrancar.ps1" -Porta 8765
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "arrancar.ps1" -Porta %1
)

REM Se o script falhou, fica aqui para se ler. Se teve sucesso, a janela
REM fecha-se sozinha, que e' o que se quer.
if errorlevel 1 pause
endlocal
