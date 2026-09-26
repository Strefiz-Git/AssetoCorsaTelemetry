@echo off
REM Reinicia o servidor de telemetria: para o que estiver a correr e
REM arranca outro. E o que se usa depois de mexer no acshm.py ou no
REM server.py, porque o servidor le o codigo uma vez so no arranque.
REM
REM   REINICIAR.bat          porta 8765
REM   REINICIAR.bat 9000     outra porta

setlocal
cd /d "%~dp0"
set "PORTA=%~1"
if not defined PORTA set "PORTA=8765"

powershell -NoProfile -ExecutionPolicy Bypass -File "parar.ps1" -Porta %PORTA%

REM --- o python certo -------------------------------------------------
set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY where py >nul 2>nul && set "PY=py -3"
if not defined PY (
  echo.
  echo   Python nao encontrado. Instala o Python 3.
  echo.
  pause
  exit /b 1
)

echo   A arrancar de novo...
echo.
echo   O servidor corre nesta janela. Para o parar, fecha-a
echo   (ou corre PARAR.bat noutra janela).
echo.

%PY% server.py --port %PORTA% --abrir

echo.
echo   Servidor parado.
pause
