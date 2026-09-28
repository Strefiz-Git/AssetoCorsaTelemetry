# Para o servidor, em segundo plano, e espera que a porta responda.
#
#   powershell -File arrancar.ps1                  # porta 8765, jogo guardado
#   powershell -File arrancar.ps1 -Porta 9000      # outra porta
#   powershell -File arrancar.ps1 -Jogo f125       # o F1 25
#   powershell -File arrancar.ps1 -Jogo ac         # o Assetto Corsa
#
# O JOGO E' OPCIONAL de proposito. Sem ele, o servidor usa o que esta
# gravado nas definicoes -- que e' o que se escolheu no ecra. Passa-lo
# aqui e' para o caso de se querer forcar sem ir ao browser, e NAO grava:
# o `--jogo` da linha de comando tem precedencia sobre as definicoes, e
# quem o escreve esta' a ver o que faz.
#
# E porque e' que o jogo nao e' um argumento obrigatorio: escolher o jogo
# e' uma coisa de utilization, nao de arranque. Obrigar a decidir na
# linha de comandos seria obrigar a abrir uma consola para usar o painel.
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
    [switch]$SemBrowser,
    # Vazio = usa o que esta nas definicoes. Os valores validos sao os ids
    # que o registo de jogos conhece, e sao lidos de la (ver passo 1).
    [string]$Jogo = ''
)

$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $raiz
$log = Join-Path $raiz "servidor.log"

# --- esperar por uma porta, sem chamar o Windows 30 vezes -------------
# Esta funcao substitui um `Get-NetTCPConnection` dentro do ciclo de
# espera. Medido nesta maquina: o `Get-NetTCPConnection` leva 2 SEGUNDOS
# numa porta sem nada, e o ciclo tinha 30 tentativas -- 69 segundos, a
# dizer "o servidor NAO arrancou em 9 segundos". Um `.bat` com um jogo
# escrito errado ficava um minuto em silencio, e a unica coisa que
# aparecia no fim era um tempo que nao era o tempo.
#
# O que se quer saber e' "responde alguem?", e um TcpClient responde a
# isso em sub-milissegundo quando a porta esta fechada, e em milissegundos
# quando esta aberta. E' tambem a pergunta certa: o `Get-NetTCPConnection`
# diz se a porta esta em LISTEN, que e' diferente de haver quem responda,
# e o que interessa ao utilizador e' a segunda.
function Porta-Aberta([int]$p, [int]$ms = 300) {
    $c = New-Object System.Net.Sockets.TcpClient
    try {
        $a = $c.BeginConnect('127.0.0.1', $p, $null, $null)
        if (-not $a.AsyncWaitHandle.WaitOne($ms, $false)) { return $false }
        $c.EndConnect($a)
        return $true
    } catch {
        return $false
    } finally {
        $c.Close()
    }
}

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
if ($py -eq 'py') { $pyArgs = @('-3', 'server.py', '--porta', $Porta) }
else { $pyArgs = @('server.py', '--porta', $Porta) }

# --- 1b) o jogo pedido existe? --------------------------------------
# Confirma-se AQUI, e nao se deixa o argparse do servidor dizer que nao.
# A razao e' o tempo: o arranque errado chega a ser o erro mais provavel
# de quem acaba de instalar o painel -- `INICIAR.bat 8765 f1251` com um
# caracter a mais -- e o argparse so' fala 69 segundos depois, quando o
# ciclo da porta acaba, num `server.log.err` que ninguem vai abrir. Aqui
# a resposta e' imediata e diz o que escrever.
#
# A lista de ids NAO e' escrita aqui: e' pedida ao registo de jogos, que
# e' o unico sitio onde se sabe. Uma lista escrita no .ps1 seria um
# segundo sítio a saber os jogos, e divergia em silencio no dia em que se
# acrescentasse um terceiro.
if ($Jogo) {
    $ids = $null
    try {
        $ids = (& $py -c "from actelemetry.jogos import ORDEM; print(' '.join(ORDEM))" 2>$null)
        if ($LASTEXITCODE -ne 0) { $ids = $null }
    } catch { $ids = $null }
    $ids = @("$ids" -split '\s+' | Where-Object { $_ })

    if ($ids.Count -gt 0 -and ($ids -notcontains $Jogo)) {
        Write-Host ''
        Write-Host "  Jogo desconhecido: '$Jogo'." -ForegroundColor Red
        Write-Host ''
        Write-Host "  Os jogos que existem sao: $($ids -join ', ')"
        Write-Host ''
        Write-Host "  Para o F1 25:        INICIAR.bat $Porta f125"
        Write-Host "  Para o Assetto Corsa: INICIAR.bat $Porta ac"
        Write-Host ''
        Write-Host '  Sem o segundo argumento, usa-se o jogo que ficou gravado no ecra.'
        Write-Host ''
        exit 1
    }
}

# O `--jogo` so' vai quando foi pedido. Sem ele nao se passa a flag, para
# o servidor nao gravar a escolha: quem arranca pelo .bat sem dizer nada
# nao deve trocar o jogo guardado.
if ($Jogo) { $pyArgs += @('--jogo', $Jogo) }

# --- 2) arrancar, independente e sem janela -------------------------
Write-Host ''
Write-Host "  A arrancar o servidor na porta $Porta ..."
if ($Jogo) { Write-Host "  Jogo pedido: $Jogo" }

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
# 30 tentativas de 300 ms: sao 9 segundos, e e' o que a mensagem diz.
# O `Porta-Aberta` e' rapido, portanto o tempo e' mesmo o do `Start-Sleep`
# e nao o de um cmdlet do Windows a cada tentativa.
$respondeu = $false
foreach ($tenta in 1..30) {
    Start-Sleep -Milliseconds 300
    if (Porta-Aberta $Porta) {
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
# (uma chamada so, e so' depois de a porta responder: 2 segundos aqui
#  ja nao custam nada a ninguem, porque o servidor esta' de pe)

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
