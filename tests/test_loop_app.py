# -*- coding: utf-8 -*-
r"""tests\test_loop_app.py  --  a lista de adversarios nao pode esvaziar
so' porque uma leitura rebentou.

O BUG
-----
O loop que escreve os carros terminava assim:

    if str(_seguro(lambda: ac.getCarName(carId), '-1')) == '-1':
        break

O valor de "a leitura falhou" era o mesmo que o valor de "nao ha' carro
neste slot". Portanto QUALQUER excepcao -- a API renomeada, um argumento
errado, uma thread emDifficulty -- punha a app a concluir que a pista
estava vazia, e a break no primeiro carro, todas as vezes, sem dar erro.

Medido com o jogo a correr: numVehicles chegava a 11 e os 128 carros
ficavam a zero durante toda a corrida. O dashboard mostrava "a aguardar
os dados dos adversarios" e mandava ligar a app no Content Manager --
instrucao errada, porque a app estava ligada e a escrever.

Porque e' um bug tao dificil de ver
-----------------------------------
O _seguro existe para uma coisa boa: uma leitura que levanta excepcao
nao pode matar o fio. Cumpriu o seu papel tao bem que escondeu a falha
completamente. Nao ha' excepcao, nao ha' log, nao ha' numero nenhum que
diga o que aconteceu -- a unica coisa que se ve e' uma lista vazia.

Este teste existe para isso nao voltar. Ele NAO corre dentro do jogo:
simula o `ac` com um getCarName que rebenta, e confirma que os carros
continuam a ser escritos.

Como corre:  python tests\test_loop_app.py
"""
import io
import os
import re
import sys
import types

sys.stdout.reconfigure(encoding="utf-8")

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(RAIZ, "python_app", "actelemetry_strefiz")

sys.path.insert(0, APP)
import actelemetry_shm as shm          # noqa: E402  (precisa do caminho antes)
vec3 = shm.vec3

problemas = []


# O enum CS, com os mesmos numeros do acsys.py do jogo. Nao interessa
# o valor, so' que o duplo saiba que tipo devolver para cada um.
class CS:                              # noqa: E701
    SpeedMS = 0
    BestLap = 1
    LapInvalidated = 2
    LapTime = 3
    LastLap = 4
    LapCount = 6
    WorldPosition = 7
    NormalizedSplinePosition = 8
    DrsAvailable = 9
    DrsEnabled = 10
    CurrentTyresCoreTemp = 11
    LastTyresTemp = 12
    TurboBoost = 13
    KersCharge = 14
    Gear = 15

# O WHEELS do acsys e' uma CLASSE e nao se percorre -- e' o bug que este
# ficheiro apareceu para apanhar. Aqui reproduz-se a classe tal e qual,
# para que um teste que volte a usa-la como lista rebente.
class WHEELS:                          # noqa: E701
    FL, FR, RL, RR = range(4)


# ---------------------------------------------------------------------------
# Um 'ac' falso, com o mesmo formato, para correr a app fora do jogo.
# ---------------------------------------------------------------------------
def fazer_ac(acoes):
    """acoes: {'getCarName': 'rebenta'|'normal', 'nomes': [...]}"""
    mod = types.ModuleType("ac")

    def getCarsCount():
        return acoes.get("n", 3)

    def getFocusedCar():
        return 0

    def getCarName(carId):
        if acoes.get("getCarName") == "rebenta":
            raise RuntimeError("a API mudou de nome")
        if carId < len(acoes.get("nomes", [])):
            return acoes["nomes"][carId]
        return "-1"

    def getDriverName(carId):
        return "Piloto %d" % carId

    def getServerName():
        return None            # isto acontece em sessao offline

    def getCarState(carId, estado, roda=None):
        # "rebentaEm": um estado (ou lista) em que a leitura falha, para
        # provar que falhar NAO esvazia a lista nem mata o ciclo
        alvo = acoes.get("rebentaEm")
        if alvo is not None:
            alvos = alvo if isinstance(alvo, (list, tuple, set)) else [alvo]
            if estado in alvos:
                raise RuntimeError("este campo nao existe nesta versao")
        # O jogo NAO devolve um numero para todos os campos. Para as
        # temperaturas dos pneus e para o turbo/ERS devolve uma
        # SEQUENCIA -- medido em 1 001 704 chamadas que rebentaram com
        # "float() argument must be a string or a number", e os quatro
        # campos a zero sem nada dizer.
        #
        # 'seqEm' diz para que estados isso acontece, e 'seqN' se a
        # sequencia tem 4 (um valor por pneu) ou 1. As duas leituras
        # dao sinais diferentes e o codigo tem de sobreviver as duas.
        if acoes.get("seqEm") is not None:
            alvos = acoes["seqEm"]
            alvos = alvos if isinstance(alvos, (list, tuple, set)) else [alvos]
            if estado in alvos:
                n = acoes.get("seqN", 4)
                return [float(10 + estado + i) for i in range(n)]

        # O tipo devolvido tem de bater certo com o campo da struct, como
        # o jogo faz. ctypes recusa um float num c_int32, e recusa um int
        # num vec3 -- dois erros que aqui seriam do DUPLO, nao do
        # codigo, e que por isso o duplo devolve o tipo certo.
        if estado == CS.WorldPosition:
            return vec3(float(carId) * 10.0, 1.5, float(carId) * -3.0)
        if estado in (CS.BestLap, CS.LapCount, CS.LapInvalidated,
                      CS.LapTime, CS.LastLap, CS.DrsAvailable,
                      CS.DrsEnabled, CS.Gear):
            return 3          # campos c_int32
        return 0.5            # campos c_float

    def isCarInPit(carId):
        return 0

    def isCarInPitline(carId):
        return 0

    def isConnected(carId):
        return 1

    def getCarLeaderboardPosition(carId):
        return carId + 1

    def getCarRealTimeLeaderboardPosition(carId):
        return carId + 1

    def isCarInPitlane(carId):
        return 0

    def getLastSplits(carId):
        return None

    mod.getCarsCount = getCarsCount
    mod.getFocusedCar = getFocusedCar
    mod.getCarName = getCarName
    mod.getDriverName = getDriverName
    mod.getServerName = getServerName
    mod.getCarState = getCarState
    mod.isCarInPit = isCarInPit
    mod.isCarInPitline = isCarInPitline
    mod.isConnected = isConnected
    mod.getCarLeaderboardPosition = getCarLeaderboardPosition
    mod.getCarRealTimeLeaderboardPosition = getCarRealTimeLeaderboardPosition
    mod.getLastSplits = getLastSplits
    mod.log = lambda m: None

    # --- o clima, se o teste pedir ---
    csp = acoes.get('csp', True)
    if csp:
        def ext_rainParams():
            return [float(acoes.get("rain", 0.0)), 0.0]
        def ext_weatherFxActive():
            return bool(acoes.get("rain", 0.0) > 0.0)
        def ext_weatherDebugText():
            return "current day: 2026-09-27 12:00:00"
        def ext_getWeatherTimeMult():
            return 1.0
        def ext_patchVersionCode():
            return 4123
        mod.ext_rainParams = ext_rainParams
        mod.ext_weatherFxActive = ext_weatherFxActive
        mod.ext_weatherDebugText = ext_weatherDebugText
        mod.ext_getWeatherTimeMult = ext_getWeatherTimeMult
        mod.ext_patchVersionCode = ext_patchVersionCode

    # o vento e' do JOGO BASE, nao do CSP: tem de existir nos dois
    # cenarios. E' o que prova que a sondagem nao esta' a inventar
    # ausencias.
    mod.getWindSpeed = lambda: float(acoes.get("wind", 0.0))
    mod.getWindDirection = lambda: float(acoes.get("windDir", 0.0))
    mod.console = lambda m: None
    mod.newApp = lambda nome: "janela"
    mod.setTitle = lambda *a: None
    mod.setSize = lambda *a: None
    return mod


# ---------------------------------------------------------------------------
# Nao se importa a app toda (ela faz sys.path e chama o jogo na
# importacao). Extrai-se so' as duas funcoes que interessam.
# ---------------------------------------------------------------------------
def extrair_funcao(nome):
    """Pega noSource de uma funcao do ficheiro, para a correr isolada."""
    src = io.open(os.path.join(APP, "actelemetry_strefiz.py"),
                  encoding="utf-8").read()
    m = re.search(r"^def %s\(.*?(?=^\S)" % nome, src, re.S | re.M)
    if not m:
        raise SystemExit("nao encontrei a funcao %s no plugin" % nome)
    return src, m.group(0)


def correr_loop(acoes):
    """Corre o loop da app contra um 'ac' falso. Devolve (n, campos_preenchidos, erros)."""
    sys.path.insert(0, APP)
    sys.modules["ac"] = fazer_ac(acoes)

    acsys = types.ModuleType("acsys")
    acsys.CS = CS
    acsys.WHEELS = WHEELS
    sys.modules["acsys"] = acsys

    src = io.open(os.path.join(APP, "actelemetry_strefiz.py"),
                  encoding="utf-8").read()

    # Um dicionario onde a app vai escrever a "pagina", para se poder
    # espreitar o que ficou escrito.
    import ctypes

    class Page(ctypes.Structure):
        _pack_ = 4
        _fields_ = [
            ("numVehicles", ctypes.c_int32),
            ("focusVehicle", ctypes.c_int32),
            ("serverName", ctypes.c_char * 512),
            ("carInfo", shm.CarInfo * 128),
            ("acInstallPath", ctypes.c_char * 512),
            ("isInternalMemoryModuleLoaded", ctypes.c_int32),
            ("pluginVersion", ctypes.c_char * 32),
            ("errorCount", ctypes.c_int32),
            ("lastError", ctypes.c_char * 128),
        ]

    page = Page()
    inst = types.SimpleNamespace(get=lambda: page)

    # Executa o codigo da app com as dependencias ja postas no sitio.
    ambiente = {
        "__name__": "loop_teste",
        "ac": sys.modules["ac"],
        "acsys": acsys,
        "c_float": ctypes.c_float,
        "c_int32": ctypes.c_int32,
        "MAX_SECTORS": shm.MAX_SECTORS,
        "vec3": shm.vec3,
        "shared": inst,
        "erros": 0,
    }
    # As tres funcoes de que o loop precisa, mais os apoio.
    for nome in ("_leClima", "_sondaClima", "_seguro", "_tentar", "_anotaErro", "_texto", "_num",
                 "_tempPorPneu", "escreverCarro", "_publicaErros",
                 "actualizar"):
        bloco = re.search(r"^def %s\(.*?(?=^\S|\Z)" % nome, src, re.S | re.M)
        if bloco:
            ambiente[nome] = bloco.group(0)

    # o 'erros' e' global no codigo copiado: mete-se no ambiente e le-se
    # de la
    corpo = "".join(ambiente.pop(n) for n in
                    ("_leClima", "_sondaClima", "_seguro", "_tentar", "_anotaErro", "_texto", "_num",
                     "_tempPorPneu", "escreverCarro", "_publicaErros",
                     "actualizar"))
    ambiente["erros"] = 0
    ambiente["_ultimoErro"] = ''
    # _EXT e' uma global do MODULO, nao uma funcao -- a extracao so'
    # traz funcoes, portanto semeia-se aqui. E' o dicionario onde a
    # sondagem guarda as funcoes de clima, e sem ele a _leClima rebenta
    # com um NameError que nao diz nada sobre o codigo.
    ambiente["_EXT"] = {}
    exec(compile(corpo, "app_loop", "exec"), ambiente)
    # a sondagem corre no arranque da app, uma vez. Aqui corre uma vez
    # porcenario de teste, que e o que se quer.
    ambiente["_sondaClima"]()
    # Varios ciclos, porque o jogo chama isto a cada frame e uma falha
    # num ciclo nao pode contaminar o seguinte
    for _ in range(acoes.get("ciclos", 1)):
        ambiente["actualizar"]()

    escritos = 0
    for i in range(128):
        c = page.carInfo[i]
        if c.carId == i and (c.carLeaderboardPosition > 0 or c.lapCount >= 0) \
                and (c.driverName != b"" or c.carModel != b""):
            escritos += 1
    return page.numVehicles, escritos, ambiente.get("erros", 0), page



def leClima(page):
    """O clima, tal e qual a pagina o publica. Para os testes do clima."""
    return {
        "rainAmount": round(float(page.rainAmount), 4),
        "rainFxActive": int(page.rainFxActive),
        "windSpeedApi": round(float(page.windSpeedApi), 4),
        "windDirApi": round(float(page.windDirApi), 4),
        "weatherTimeMult": round(float(page.weatherTimeMult), 4),
        "cspVersionCode": int(page.cspVersionCode),
        "weatherDebug": page.weatherDebug,
    }

# ---------------------------------------------------------------------------
print("=== 1. com tudo a funcionar ===")
n, esc, err, page = correr_loop({"getCarName": "normal",
                                 "nomes": ["ts040", "kTM", "csr"]})
print("  numVehicles=%r  carros escritos=%d  erros=%d" % (n, esc, err))
if esc < 3:
    problemas.append("com a API a funcionar so' se escreveram %d carros "
                      "de 3" % esc)
if n != 3:
    problemas.append("numVehicles devia ser 3, veio %r" % (n,))
# ZERO erros quando tudo funciona. Se isto der != 0, ha' uma leitura a
# rebentar em silencio -- que e' exactamente o defeito que este ficheiro
# foi escrito para apanhar, e nao se pode deixar passar por "detalhe".
if err != 0:
    problemas.append(
        "com a API toda a funcionar houve %d erros. Nao devia haver "
        "nenhum: cada um e' uma leitura a rebentar em silencio, e o "
        "contador tem de servir para isso." % err)

print()
print("=== 2. o jogo devolve uma SEQUENCIA, nao um numero ===")
# Este e' o bug encontrado a conduzir: 1 001 704 chamadas com
# "float() argument must be a string or a number", e os quatro campos a
# zero sem nada dizer. A sequencia e' o que o jogo devolve mesmo para
# as temperaturas dos pneus e para o turbo/ERS.
for tam in (4, 1):
    n, esc, err, page = correr_loop({
        "getCarName": "normal", "nomes": ["ts040"],
        "seqEm": [CS.CurrentTyresCoreTemp, CS.LastTyresTemp,
                  CS.TurboBoost, CS.KersCharge],
        "seqN": tam
    })
    print("  sequencia de %d:  carros=%d  erros=%d" % (tam, esc, err))
    if err != 0:
        problemas.append(
            "com uma sequencia de %d, %d erros. O _num devia aceitar as "
            "duas formas sem falhar." % (tam, err))
    c = page.carInfo[0]
    temps = [round(float(t), 1) for t in c.tyreCoreTemp]
    if tam == 4:
        # as 4 temperaturas tem de ser DIFERENTES. Se sairem as quatro
        # iguais, o indice da roda esta' a ser ignorado -- que e'
        # exactamente o sintoma que a docstring de _tempPorPneu
        # descreve, e que aqui seria a leitura errada e nao o jogo.
        if len(set(temps)) == 1:
            problemas.append(
                "as 4 temperaturas do nucleo ficaram iguais (%r). Com uma "
                "sequencia de 4 e' preciso tirar o elemento da roda "
                "pedida, senao le-se sempre o primeiro." % temps)
        else:
            print("     as 4 temperaturas: %r (diferentes, como deve ser)"
                  % temps)
    if float(c.turboBoost) == 0.0:
        problemas.append("o turboBoost ficou a zero com a sequencia")
    if float(c.kersCharge) == 0.0:
        problemas.append("o kersCharge ficou a zero com a sequencia")

print()
print("=== 3. com o getCarName a REBENTAR ===")
n, esc, err, page = correr_loop({"getCarName": "rebenta", "n": 3})
print("  numVehicles=%r  carros escritos=%d  erros=%d" % (n, esc, err))
print("  lastError publicado = %r" % page.lastError)
# ISTO E' A PROVA. Na versao antiga, 'rebenta' fazia break no primeiro
# carro e escribia-se ZERO, sem erro nenhum. Agora escreve-se a lista
# toda (sem nomes) e a falha fica publicada.
if esc < 3:
    problemas.append(
        "COM O getCarName A REBENTAR so' se escreveram %d carros de 3. "
        "Era este o bug: a falha esvaziava a leaderboard em silencio."
        % esc)
if err < 1:
    problemas.append("a excepcao nao foi contada: o erro continua escondido")
if not page.lastError:
    problemas.append("o lastError ficou vazio -- a falha ainda nao e' visivel")

print()
print("=== 4. com o jogo a dizer mesmo que o slot esta' livre ===")
n, esc, err, page = correr_loop({"getCarName": "normal",
                                 "nomes": ["ts040"], "n": 1})
print("  numVehicles=%r  carros escritos=%d" % (n, esc))
if esc > 1:
    problemas.append("escreveu %d carros quando o jogo disse que so' ha' 1"
                      % esc)

print()
print("=== 5. com uma leitura de um campo INTEIRO a falhar ===")
# Este e' o caso que esconde o outro bug. O _seguro devolvia 0.0 por
# omissao, e 0.0 num campo c_int32 levanta TypeError na ATRIBUICAO --
# ou seja, a excepcao reaparecia depois do _seguro, na mesma linha, e
# matava o ciclo todo. Como o ciclo morre, nao ha' nem lista nem erro
# publicado: a leaderboard fica vazia em silencio.
#
# O estado e' o LapCount e nao o BestLap de proposito: o bestLapMS passa
# um -1 explicito, portanto nunca usa o valor por omissao. E o lapCount
# que depende do 0 -- e portanto e' o unico sitio onde o bug morava.
n, esc, err, page = correr_loop({"getCarName": "normal",
                                 "nomes": ["ts040", "kTM", "csr"],
                                 "rebentaEm": CS.LapCount})
print("  numVehicles=%r  carros escritos=%d  erros=%d" % (n, esc, err))
print("  lastError publicado = %r" % page.lastError)
if esc < 3:
    problemas.append(
        "com UMA leitura inteira a falhar so' se escreveram %d carros de 3. "
        "O _seguro estava a devolver 0.0, que o ctypes recusa num c_int32, "
        "e a excepcao morria o ciclo sem deixar rasto." % esc)
if err < 1:
    problemas.append("a leitura que falhou nao foi contada")
if not page.lastError:
    problemas.append("o lastError ficou vazio nesta falha tambem")

# E o ciclo tem de ser REPETIVEL: se uma falha ATRAS o loop, o segundo
# ciclo nao escreve nada. Foi assim que o cabecalho mostrava 11 carros
# e a lista ficava vazia durante toda a corrida.
print()
print("=== 6. um ciclo que falha a meio, no seguinte ===")
n1, e1, _, _ = correr_loop({"getCarName": "normal",
                            "nomes": ["ts040", "kTM", "csr"],
                            "rebentaEm": CS.LapCount, "ciclos": 2})
print("  depois de 2 ciclos: numVehicles=%r  carros escritos=%d" % (n1, e1))
if e1 < 3:
    problemas.append(
        "no segundo ciclo so' ficaram %d carros. Uma falha no primeiro "
        "cycle contaminou o seguinte -- e era por isso que a pagina "
        "mostrava o cabecalho certo e a lista vazia." % e1)

print()
print()
print("=== 7. o clima: com e sem Custom Shaders Patch ===")
# O caso que deu 1 001 704 de erros da ultima vez foi um float() sobre
# um valor que nao era numero. A versao nova do mesmo modo de falha
# seria CHAMAR ac.ext_rainParams() a cada ciclo sem o Custom Shaders
# Patch a expor: 40 erros por segundo por funcao, 160 com quatro.
#
# E' por isso que a sondagem existe: um getattr no arranque, e a partir
# dai ou a funcao esta' na mao ou vale None.


def climaComCsp():
    """O clima quando o CSP expoe as funcoes."""
    n, esc, err, page = correr_loop({"getCarName": "normal",
                                     "nomes": ["ts040"], "csp": True,
                                     "rain": 0.4, "ciclos": 5})
    print("  com CSP, 5 ciclos:  erros=%d" % err)
    if err != 0:
        problemas.append("com o CSP presente houve %d erros" % err)
    c = leClima(page)
    print("     rainAmount=%r  rainFxActive=%r  cspVersionCode=%r"
          % (c["rainAmount"], c["rainFxActive"], c["cspVersionCode"]))
    if abs(c["rainAmount"] - 0.4) > 0.001:
        problemas.append("a chuva nao chegou ao cabecalho: %r"
                         % c["rainAmount"])
    if c["rainFxActive"] != 1:
        problemas.append("com chuva, rainFxActive devia ser 1, veio %r"
                         % c["rainFxActive"])
    if c["cspVersionCode"] <= 0:
        problemas.append("a versao do CSP devia ser > 0, veio %r"
                         % c["cspVersionCode"])


def climaSemCsp():
    """O clima quando o CSP NAO expoe as funcoes. E' o caso que nao
    pode gerar um unico erro -- e o -1 em vez de 0."""
    n, esc, err, page = correr_loop({"getCarName": "normal",
                                     "nomes": ["ts040"], "csp": False,
                                     "ciclos": 5, "wind": 3.5})
    print("  SEM CSP, 5 ciclos:  erros=%d" % err)
    if err != 0:
        problemas.append(
            "SEM o CSP houve %d erros em 5 ciclos. Cada ciclo a perguntar por "
            "uma funcao que nao existe e' um erro por ciclo -- e a 40 por "
            "segundo dava 160. A sondagem tem de responder ANTES." % err)
    c = leClima(page)
    print("     rainAmount=%r  rainFxActive=%r  cspVersionCode=%r"
          % (c["rainAmount"], c["rainFxActive"], c["cspVersionCode"]))
    print("     o vento da API, sem CSP: %r" % c["windSpeedApi"])
    if c["rainAmount"] != -1.0:
        problemas.append(
            "sem CSP, a chuva devia ser -1 (nao se sabe) e nao %r. Zero "
            "seria mentira: diria que nao chove quando nao sabemos."
            % c["rainAmount"])
    if c["rainFxActive"] != -1:
        problemas.append("sem CSP, rainFxActive devia ser -1, veio %r"
                         % c["rainFxActive"])
    if c["cspVersionCode"] != -1:
        problemas.append("sem CSP, cspVersionCode devia ser -1, veio %r"
                         % c["cspVersionCode"])
    # ac.getWindSpeed e' do JOGO BASE. Se tambem der -1, a sondagem esta'
    # a inventar ausencias.
    if c["windSpeedApi"] == -1.0:
        problemas.append(
            "o vento da API devia estar disponivel SEM o CSP: "
            "ac.getWindSpeed e' do jogo base. Se der -1, a sondagem "
            "esta' a marcar como ausente o que existe.")
    elif abs(c["windSpeedApi"] - 3.5) > 0.001:
        problemas.append("o vento da API nao chegou certo: %r em vez de 3.5"
                         % c["windSpeedApi"])


climaComCsp()
climaSemCsp()

print()
print("=" * 60)
if problemas:
    print("!!! %d PROBLEMA(S) !!!" % len(problemas))
    for p in problemas:
        print("  " + p)
    sys.exit(1)
print("ok: uma leitura que rebenta nao esvazia mais a lista,")
print("    e a falha fica publicada em vez de ser engolida.")
