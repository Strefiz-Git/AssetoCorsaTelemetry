@echo off
REM Arranca o servidor de telemetria EM SEGUNDO PLANO e abre o browser.
REM Serve o Assetto Corsa e o F1 25; o jogo e' escolhido no ecra.
REM
REM Pode fechar esta janela logo que a abra: o servidor continua. Para o
REM parar, corra PARAR.bat.
REM
REM   INICIAR.bat                    porta 8765, jogo o que estiver guardado
REM   INICIAR.bat 9000               outra porta
REM   INICIAR.bat 8765 f125          forca o F1 25 (nao grava a escolha)
REM   INICIAR.bat 8765 ac            forca o Assetto Corsa
REM
REM A logica esta em arrancar.ps1. O servidor e' lancado com o
REM Start-Process do PowerShell, que cria um processo independente e sem
REM janela. O "start /b" do batch nao serve: o filho fica preso a consola
REM do pai e um Ctrl+C leva-o abaixo.

setlocal
cd /d "%~dp0"

REM O terceiro argumento e' o jogo, e vai vazio quando nao foi pedido.
REM Passar "-Jogo ''" ao PowerShell com um argumento vazio da problema, por
# isso so' se passa a flag quando existe mesmo um segundo argumento.
if "%~1"=="" (
  if "%~2"=="" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "arrancar.ps1" -Porta 8765
  ) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "arrancar.ps1" -Porta 8765 -Jogo %2
  )
) else (
  if "%~2"=="" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "arrancar.ps1" -Porta %1
  ) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "arrancar.ps1" -Porta %1 -Jogo %2
  )
)

REM Se o script falhou, fica aqui para se ler. Se teve sucesso, a janela
REM fecha-se sozinha, que e' o que se quer.
if errorlevel 1 pause
endlocal
