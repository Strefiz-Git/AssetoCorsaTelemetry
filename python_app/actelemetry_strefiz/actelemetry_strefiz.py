"""
AssettoCorsaTelemetry -- app Python para o Assetto Corsa.

Corre DENTRO do jogo, em
assettocorsa/apps/python/actelemetry_strefiz/.
Escreve a pagina de memoria partilhada "acpmf_actelemetry_v1", que e'
depois lida pelo acshm.py do outro lado, no dashboard. Sem SimHub, sem
Content Manager: e' esta app que escreve, e o acshm.py que le.

O que esta app pubLICA, e o unico sitio onde se pode acrescentar dados
dos adversarios. As tres paginas que o proprio AC escreve
(acpmf_physics, acpmf_graphics, acpmf_static) sao so' do carro de quem
esta' a conduzir -- para os outros carros e' preciso uma app, que e'
esta.

Se esta app nao arrancar, o dashboard nao da' erro: simplesmente nao ha'
adversarios. Ver o ac.log e o console do AC para saber o que aconteceu.
"""
import os
import os.path
import platform
import sys
import threading

# O AC traz o Python dele. Antes de mais nada tem de estar no caminho o
# stdlib DAQUELE Python, e nao o do sistema -- se entrar o do sistema, o
# ctypes que carrega e' o errado e a struct fica com o tamanho errado.
if platform.architecture()[0] == "64bit":
    sysdir = os.path.dirname(__file__) + '/stdlib64'
else:
    sysdir = os.path.dirname(__file__) + '/stdlib'
sys.path.insert(0, sysdir)
os.environ['PATH'] = os.environ['PATH'] + ";."

import ctypes
import ac
import acsys
from ctypes import c_float, c_int32

from actelemetry_shm import Shared, MAX_SECTORS, vec3

shared = Shared()

VERSION = "1.0.0"

timer = 0
event = threading.Event()
stop_thread = False

# Quantas leiturasaram exception. Um contador e' melhor que nada: se o
# AC mudar a API um dia, o numero sobe e da para ver, em vez de a app
# falhar em silencio.
erros = 0


def _seguro(ler, alt=0.0):
    """Le um valor do AC sem deixar uma excepcao matar a thread.

    A versao anterior nao tinha isto. Uma unica leitura que levantasse
    excepcao matava o thread, e o dashboard ficava congelado no ultimo
    estado sem explicar nada -- o pior defeito possivel, porque parece
    que o jogo parou. Ler e' sempre melhor do que morrer.
    """
    global erros
    try:
        return ler()
    except Exception:
        erros += 1
        return alt


def _tempPorPneu(carro, estado):
    """Temperatura dos 4 pneus, na ordem FL, FR, RL, RR.

    PASSA-SE o indice da roda de proposito. A documentacao do acsys.py
    so' diz que e' obrigatorio para TyreContactPoint, TyreContactNormal,
    TyreHeadingVector e TyreRightVector, e nao para as temperaturas -- mas
    a HUD em Lua le-as por roda, e passar o indice nao pode fazer mal:
    no pior dos casos o AC ignora-o.

    COMO SABER SE ESTA CERTO: se um dia vir as quatro temperaturas
    sempre iguais, e' porque o indice esta' a ser ignorado e o AC esta' a
    devolver sempre a roda da frente. Nesse caso tira-se o terceiro
    argumento. E' um teste de um minuto, e o resultado vale a pena ficar
    escrito porque nao ha' como probar isto fora do jogo.
    """
    return [_seguro(lambda: float(ac.getCarState(carro, estado, roda)))
            for roda in acsys.WHEELS]


def escreverCarro(carId, info, tempNuclear, tempBanda):
    info.carId = carId
    info.driverName = _seguro(lambda: ac.getDriverName(carId).encode('utf-8'), b'')
    info.carModel = _seguro(lambda: ac.getCarName(carId).encode('utf-8'), b'')
    info.speedMS = _seguro(lambda: ac.getCarState(carId, acsys.CS.SpeedMS))
    info.bestLapMS = _seguro(lambda: ac.getCarState(carId, acsys.CS.BestLap), -1)
    info.lapCount = _seguro(lambda: ac.getCarState(carId, acsys.CS.LapCount))
    info.currentLapInvalid = _seguro(
        lambda: ac.getCarState(carId, acsys.CS.LapInvalidated))
    info.currentLapTimeMS = _seguro(lambda: ac.getCarState(carId, acsys.CS.LapTime))
    info.lastLapTimeMS = _seguro(lambda: ac.getCarState(carId, acsys.CS.LastLap), -1)
    info.worldPosition = _seguro(
        lambda: ac.getCarState(carId, acsys.CS.WorldPosition), vec3(0.0, 0.0, 0.0))
    info.isCarInPitline = _seguro(lambda: int(ac.isCarInPitline(carId)))
    info.isCarInPit = _seguro(lambda: int(ac.isCarInPit(carId)))
    info.carLeaderboardPosition = _seguro(
        lambda: ac.getCarLeaderboardPosition(carId))
    info.carRealTimeLeaderboardPosition = _seguro(
        lambda: ac.getCarRealTimeLeaderboardPosition(carId))
    info.spLineLength = _seguro(
        lambda: ac.getCarState(carId, acsys.CS.NormalizedSplinePosition))
    info.isConnected = _seguro(lambda: int(ac.isConnected(carId)))

    # --- o que substitui os tres campos que nunca eram preenchidos -----
    for i in range(4):
        info.tyreCoreTemp[i] = tempNuclear[i]
        info.tyreSurfaceTemp[i] = tempBanda[i]
    info.turboBoost = _seguro(
        lambda: float(ac.getCarState(carId, acsys.CS.TurboBoost)))
    info.kersCharge = _seguro(
        lambda: float(ac.getCarState(carId, acsys.CS.KersCharge)))
    info.drsAvailable = _seguro(
        lambda: int(ac.getCarState(carId, acsys.CS.DrsAvailable)))
    info.drsEnabled = _seguro(
        lambda: int(ac.getCarState(carId, acsys.CS.DrsEnabled)))
    # A caixa pela API. O HUD do Content Manager tira a caixa daqui, e
    # nos tiramos do 'gear' da pagina de fisica -- campos com o mesmo
    # nome em interfaces diferentes (Regra no 18). Ha' um bug em que
    # aparece +1, e a unica forma de o decidir e' ter os dois valores no
    # mesmo instante.
    #
    # A sentinela e' -99 e NAO -1, porque -1 e' o reveso: um valor que
    # e' valido seria lido como "caixa invalida", que e' exactamente o
    # bug que se quer ver. Nenhuma caixa chega a -99.
    info.gearApi = _seguro(lambda: int(ac.getCarState(carId, acsys.CS.Gear)), -99)

    # --- tempos de setor da ultima volta completa ------------------------
    # A documentacao oficial diz "returns -1 on failure", portanto nao e'
    # sempre uma lista (ex.: um carro que ainda nao completou volta
    # nenhuma). Da' o isinstance() -- sem ele, isto rebenta a thread
    # assim que o primeiro adversario ainda na' fez uma volta.
    splits = _seguro(lambda: ac.getLastSplits(carId), None)
    if isinstance(splits, (list, tuple)) and len(splits) > 0:
        n = min(len(splits), MAX_SECTORS)
        for i in range(n):
            try:
                info.lastSplitsMS[i] = int(splits[i])
            except Exception:
                info.lastSplitsMS[i] = 0
        info.lastSplitsCount = n
    else:
        info.lastSplitsCount = 0


def actualizar():
    page = shared.get()

    page.numVehicles = _seguro(ac.getCarsCount)
    page.focusVehicle = _seguro(ac.getFocusedCar)

    for carId in range(0, min(page.numVehicles, 128)):
        # O AC devolve '-1' a partir do primeiro carro livre. E' assim
        # que se sabe onde acaba a lista.
        if str(_seguro(lambda: ac.getCarName(carId), '-1')) == '-1':
            break
        escreverCarro(carId, page.carInfo[carId],
                      _tempPorPneu(carId, acsys.CS.CurrentTyresCoreTemp),
                      _tempPorPneu(carId, acsys.CS.LastTyresTemp))


def _loop():
    global erros
    while not stop_thread:
        event.wait()
        event.clear()
        try:
            actualizar()
        except Exception as e:
            global erros
            erros += 1
            ac.log("AssetoCorsaTelemetry: erro a escrever: %s" % e)


def acMain(ac_version):
    global appWindow
    appWindow = ac.newApp("AssettoCorsaTelemetry")
    ac.setTitle(appWindow, "Assetto Corsa Telemetry")
    ac.setSize(appWindow, 320, 44)

    ac.log("AssettoCorsaTelemetry %s a escrever na pagina partilhada." % VERSION)
    ac.console("AssetoCorsaTelemetry %s" % VERSION)

    page = shared.get()
    page.serverName = _seguro(lambda: ac.getServerName().encode('utf-8'), b'')
    page.acInstallPath = _seguro(lambda: os.path.abspath(os.curdir).encode('utf-8'), b'')
    page.isInternalMemoryModuleLoaded = 0
    page.pluginVersion = VERSION.encode('utf-8')

    t = threading.Thread(target=_loop)
    t.daemon = True
    t.start()

    return "AssetoCorsaTelemetry"


def acShutdown():
    global stop_thread
    stop_thread = True
    event.set()


def acUpdate(deltaT):
    global timer
    timer += deltaT
    # 25 ms = 40 escritas por segundo. A pagina tem 128 carros e o AC
    # chama isto a cada frame; escrever mais vezes nao acrescenta nada e
    # gasta thread.
    if timer > 0.025:
        event.set()
        timer = 0
