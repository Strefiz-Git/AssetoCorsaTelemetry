# Para o servidor, em segundo plano, e espera que a porta responda.
#
#   powershell -File arrancar.ps1              # porta 8765
#   powershell -File arrancar.ps1 -Porta 9000
#
# O que este script resolve: o servidor tem de ficar a correr MESMO
# depois de fechar a janela do INICIAR.bat. Por isso e' lancado com o
# Start-Process do PowerShell, que cria um processo independente, sem
# janela, e que nao morre com o pai. O "start /b" do batch nao serve:
# o filho fica preso a consola do pai e um Ctrl+C ou um fecho de janela
# leva-o abaixo.
#
# A espera pela porta e' o que faz a diferenca entre funcionar e dar
# erro ao utilizador: abrir o browser antes de haver quem responda da
# um erro de ligacao.

param(
    [int]$Porta = 8765,
    [switch]$SemBrowser
)

$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $raiz
$log = Join-Path $raiz "servidor.log"

# --- 0) ja esta a correr? -------------------------------------------
$emCurso = Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue
if ($emCurso) {
    $pidServ = ($emCurso | Select-Object -First 1).OwningProcess
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$pidServ" -ErrorAction SilentlyContinue
    if ($proc -and $proc.CommandLine -match 'server\.py') {
        Write-Host ''
        Write-Host "  O servidor ja esta a correr (processo $pidServ, porta $Porta)." -ForegroundColor Yellow
        Write-Host '  Para o voltar a arrancar, usa REINICIAR.bat (ou PARAR.bat primeiro).'
        Write-Host ''
        if (-not $SemBrowser) { Start-Process "http://localhost:$Porta/" }
        Write-Host '  A abrir o browser...'
        Write-Host ''
        exit 0
    }
}

# --- 1) o python certo ----------------------------------------------
$py = $null
if (Get-Command python -ErrorAction SilentlyContinue) { $py = 'python' }
elseif (Get-Command py -ErrorAction SilentlyContinue) { $py = 'py' }

if (-not $py) {
    Write-Host ''
    Write-Host '  Python nao encontrado.' -ForegroundColor Red
    Write-Host '  Instala o Python 3 e confirma numa consola que "python --version" funciona.'
    Write-Host ''
    exit 1
}
if ($py -eq 'py') { $pyArgs = @('-3', 'server.py', '--port', $Porta) }
else { $pyArgs = @('server.py', '--port', $Porta) }

# --- 2) arrancar, independente e sem janela -------------------------
Write-Host ''
Write-Host "  A arrancar o servidor na porta $Porta ..."

# -RedirectStandardError/-Output num ficheiro: um servidor sem janela
# nao tem onde mostrar um erro. Com o log, se algo correr mal ha
# alguma coisa para se ler.
Start-Process -FilePath $py `
    -ArgumentList $pyArgs `
    -WorkingDirectory $raiz `
    -WindowStyle Hidden `
    -RedirectStandardOutput $log `
    -RedirectStandardError "$log.err" | Out-Null

# --- 3) esperar que a porta responda -------------------------------
$respondeu = $false
foreach ($tenta in 1..30) {
    Start-Sleep -Milliseconds 300
    if (Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue) {
        $respondeu = $true
        break
    }
}

if (-not $respondeu) {
    Write-Host ''
    Write-Host "  O servidor NAO arrancou em 9 segundos." -ForegroundColor Red
    Write-Host ''
    Write-Host '  A razao deve estar em servidor.log e servidor.log.err:'
    if (Test-Path "$log.err") {
        Get-Content "$log.err" -Tail 15 | ForEach-Object { Write-Host "    $_" }
    }
    if (Test-Path $log) {
        Get-Content $log -Tail 10 | ForEach-Object { Write-Host "    $_" }
    }
    Write-Host ''
    exit 1
}

$pidServ = (Get-NetTCPConnection -LocalPort $Porta -State Listen |
            Select-Object -First 1).OwningProcess

$ip = 'localhost'
try {
    $lan = (Invoke-WebRequest "http://localhost:$Porta/api/lan" -UseBasicParsing -TimeoutSec 3).Content | ConvertFrom-Json
    if ($lan.ip) { $ip = $lan.ip }
} catch { }

Write-Host ''
Write-Host "  A correr. Processo $pidServ." -ForegroundColor Green
Write-Host "    Neste PC : http://localhost:$Porta/"
if ($ip -ne 'localhost') { Write-Host "    Rede     : http://$ip`:$Porta/" }
Write-Host ''
Write-Host '  Pode fechar esta janela: o servidor continua a correr.' -ForegroundColor Cyan
Write-Host '  Para o parar, corra PARAR.bat.' -ForegroundColor DarkGray
Write-Host ''

if (-not $SemBrowser) {
    Start-Sleep -Milliseconds 300
    Start-Process "http://localhost:$Porta/"
}

exit 0
