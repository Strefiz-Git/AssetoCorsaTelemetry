# Para o servidor de telemetria do Assetto Corsa.
#
# Mata pelo PORTO e nao por "todos os python": o python do Content
# Manager, do SimHub e de outras coisas tambem se chama python.exe, e
# matar tudo seria uma asneira. A porta 8765 e' nossa.
#
# Antes de matar, confirma que o processo e' mesmo o servidor, pela
# linha de comando. Se outra coisa tivesse a mesma porta, nao a toca.
#
#   powershell -File parar.ps1            # porta 8765
#   powershell -File parar.ps1 -Porta 9000

param([int]$Porta = 8765)

$ErrorActionPreference = 'Continue'

function Tem-Escrita([string]$s) { $s -and $s.Trim().Length -gt 0 }

Write-Host ''
Write-Host "  A parar o servidor da porta $Porta ..."

# --- 1) quem tem a porta? -------------------------------------------
$conexoes = Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue
if (-not $conexoes) {
    # Get-NetTCPConnection pode nao existir em versoes antigas
    $conexoes = @()
    foreach ($linha in (netstat -ano)) {
        if ($linha -match "LISTENING" -and $linha -match ":$Porta\s") {
            $partes = ($linha -split '\s+') | Where-Object { $_ }
            $conexoes += [pscustomobject]@{ OwningProcess = [int]$partes[-1] }
        }
    }
}

if (-not $conexoes) {
    Write-Host "    nao ha nada a escutar na porta $Porta." -ForegroundColor DarkGray
    Write-Host '    O servidor ja estava parado.'
    exit 0
}

$pids = $conexoes | Select-Object -ExpandProperty OwningProcess -Unique
$parados = 0

foreach ($procId in $pids) {
    if ($procId -le 4) { continue }   # 0-4 sao o sistema, nunca os

    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$procId" -ErrorAction SilentlyContinue
    if (-not $proc) { continue }

    $cmd = ''
    if (Tem-Escrita $proc.CommandLine) { $cmd = $proc.CommandLine }
    Write-Host "    processo $procId  ($($proc.Name))"
    Write-Host "      $cmd"

    # so mata se a linha de comando for a do nosso servidor
    if ($cmd -notmatch 'server\.py') {
        Write-Host '      IGNORADO: nao e o servidor de telemetria.' -ForegroundColor Yellow
        Write-Host '      E outra coisa na mesma porta; nao se mexe nela.'
        continue
    }

    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    # O Stop-Process e' rapido mas nao instantaneo: logo a seguir ainda
    # devolve o processo, e o script dizia "nao foi possivel parar"
    # quando na verdade tinha parado. Espera-se e confirma-se.
    $morreu = $false
    foreach ($tenta in 1..20) {
        Start-Sleep -Milliseconds 100
        if (-not (Get-Process -Id $procId -ErrorAction SilentlyContinue)) { $morreu = $true; break }
    }
    if ($morreu) {
        Write-Host '      parado.' -ForegroundColor Green
        $parados++
    } else {
        Write-Host '      NAO FOI POSSIVEL parar.' -ForegroundColor Red
    }
}

Start-Sleep -Milliseconds 700

# --- 2) confirmacao -------------------------------------------------
$ainda = Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue
if (-not $ainda) {
    Write-Host ''
    if ($parados -gt 0) {
        Write-Host "  Parado. A porta $Porta esta livre." -ForegroundColor Green
    } else {
        Write-Host "  A porta $Porta esta livre (nunca chegou a estar ocupada por este servidor)." -ForegroundColor DarkGray
    }
    Write-Host ''
} else {
    Write-Host ''
    Write-Host "  A porta $Porta continua ocupada." -ForegroundColor Yellow
    Write-Host '  Se nao foi o nosso servidor, fecha a janela onde ele corre.'
    Write-Host ''
}

exit 0
