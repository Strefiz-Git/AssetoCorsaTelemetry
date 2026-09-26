@echo off
REM Arranca o servidor de telemetria do Assetto Corsa e abre o browser.
REM
REM O python corre em primeiro plano nesta consola, por isso fechar a
REM janela para o servidor. O browser e' aberto pelo proprio servidor
REM (--abrir), que e' o unico que sabe quando a porta ja aceita
REM ligacoes - adivinhar o tempo de arranque daqui dava corrida: ou o
REM browser pedia a pagina cedo demais e aparecia um erro de ligacao, ou
REM esperava-se sem necessidade.

setlocal
cd /d "%~dp0"

REM ---- Python: tentar "python", depois o launcher "py -3" --------------
set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY (
  where py >nul 2>nul && set "PY=py -3"
)
if not defined PY (
  echo.
  echo   Python nao encontrado.
  echo.
  echo   Instala o Python 3 e confirma que numa consola escreveste
  echo   "python --version". Se tiveres so o launcher, instala o Python
  echo   com a opcao "py launcher" marcada.
  echo.
  pause
  exit /b 1
)

echo.
echo   A arrancar o servidor de telemetria...
echo   Para parar, fecha esta janela (ou Ctrl+C).
echo.

%PY% server.py --port 8765 --abrir

echo.
echo   Servidor parado.
pause
