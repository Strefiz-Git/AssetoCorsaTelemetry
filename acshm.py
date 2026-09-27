"""
Leitura directa da shared memory do Assetto Corsa.

Nao passa pelo SimHub. O AC expoe tres paginas de shared memory com nome
(Windows):

    acpmf_physics   - fisica do carro, alta frequencia
    acpmf_graphics  - estado da sessao, tempos, bandeira, penalidade
    acpmf_static    - dados fixos do carro/pista (maxRpm, ERS, DRS...)

O layout abaixo foi tirado da documentacao oficial de shared memory do
Assetto Corsa. O Python embutido no AC nao serve para isto: nao tem
extensoes C (0 ficheiros .pyd), logo `import socket` falha e nao ha forma
de fazer rede de dentro do jogo. Por isso este processo corre FORA do AC
em Python normal do Windows.
"""

import ctypes
import time
from ctypes import wintypes

# ---------------------------------------------------------------- enums
AC_OFF, AC_REPLAY, AC_LIVE, AC_PAUSE = 0, 1, 2, 3

SESSION_NAMES = {
    -1: "DESCONHECIDA", 0: "TREINO", 1: "QUALIFICACAO", 2: "CORRIDA",
    3: "HOTLAP", 4: "TIME ATTACK", 5: "DRIFT", 6: "DRAG",
}

FLAG_NAMES = {
    0: "LIMPA", 1: "AZUL", 2: "AMARELA", 3: "PRETA",
    4: "BRANCA", 5: "XADREZ", 6: "PENALIDADE",
}

# codigos de penalidade do AC (ACC_PENALTY_TYPE)
PENALTY_NAMES = {
    0: "", 1: "DT", 7: "DT", 19: "DT",
    2: "SG10", 8: "SG10",
    3: "SG20", 9: "SG20",
    4: "SG30", 10: "SG30",
    5: "DSQ", 11: "DSQ", 13: "DSQ", 15: "DSQ", 16: "DSQ",
    17: "DSQ", 18: "DSQ", 20: "DSQ", 21: "DSQ",
    6: "DEL", 12: "DEL",
    14: "TEMPO",
}

c_int32, c_float, c_wchar = ctypes.c_int32, ctypes.c_float, ctypes.c_wchar
c_char = ctypes.c_char


# ---------------------------------------------------------------- structs
class SPageFilePhysics(ctypes.Structure):
    _pack_ = 4
    _fields_ = [
        ("packetId", c_int32),
        ("gas", c_float), ("brake", c_float), ("fuel", c_float),
        ("gear", c_int32), ("rpms", c_int32),
        ("steerAngle", c_float), ("speedKmh", c_float),
        ("velocity", c_float * 3), ("accG", c_float * 3),
        ("wheelSlip", c_float * 4), ("wheelLoad", c_float * 4),
        ("wheelsPressure", c_float * 4), ("wheelAngularSpeed", c_float * 4),
        ("tyreWear", c_float * 4), ("tyreDirtyLevel", c_float * 4),
        ("tyreCoreTemperature", c_float * 4),
        ("camberRAD", c_float * 4), ("suspensionTravel", c_float * 4),
        ("drs", c_float), ("tc", c_float),
        ("heading", c_float), ("pitch", c_float), ("roll", c_float),
        ("cgHeight", c_float), ("carDamage", c_float * 5),
        ("numberOfTyresOut", c_int32), ("pitLimiterOn", c_int32),
        ("abs", c_float),
        ("kersCharge", c_float), ("kersInput", c_float),
        ("autoShifterOn", c_int32), ("rideHeight", c_float * 2),
        ("turboBoost", c_float), ("ballast", c_float),
        ("airDensity", c_float), ("airTemp", c_float), ("roadTemp", c_float),
        ("localAngularVel", c_float * 3), ("finalFF", c_float),

        # ATENCAO: estes 9 campos (36 bytes) EXISTEM na memoria do AC, mesmo
        # que a documentacao os marque como "deprecados" e varias referencias
        # em Python os tragam comentados. Sem eles, tudo o que vem a seguir
        # fica 36 bytes deslocado: era o que fazia brakeTemp dar 0 e
        # tyreTempI dar 375 C. Confirmado contra dados reais do jogo.
        ("performanceMeter", c_float),
        ("engineBrake", c_int32),
        ("ersRecoveryLevel", c_int32),
        ("ersPowerLevel", c_int32),
        ("ersHeatCharging", c_int32),
        ("ersIsCharging", c_int32),
        ("kersCurrentKJ", c_float),
        ("drsAvailable", c_int32),
        ("drsEnabled", c_int32),

        ("brakeTemp", c_float * 4),
        ("clutch", c_float),
        ("tyreTempI", c_float * 4), ("tyreTempM", c_float * 4), ("tyreTempO", c_float * 4),
        ("isAIControlled", c_int32),
        # em ctypes 'c_float * 3 * 4' = 4 linhas de 3 (4 pneus x 3 eixos).
        # 'c_float * 4 * 3' daria 3 linhas de 4 - tamanho igual, ordem errada.
        ("tyreContactPoint", c_float * 3 * 4),
        ("tyreContactNormal", c_float * 3 * 4),
        ("tyreContactHeading", c_float * 3 * 4),
        ("brakeBias", c_float), ("localVelocity", c_float * 3),
    ]


class SPageFileGraphic(ctypes.Structure):
    _pack_ = 4
    _fields_ = [
        ("packetId", c_int32),
        ("status", c_int32), ("session", c_int32),
        ("currentTime", c_wchar * 15),
        ("lastTime", c_wchar * 15),
        ("bestTime", c_wchar * 15),
        ("split", c_wchar * 15),
        ("completedLaps", c_int32), ("position", c_int32),
        ("iCurrentTime", c_int32), ("iLastTime", c_int32), ("iBestTime", c_int32),
        ("sessionTimeLeft", c_float), ("distanceTraveled", c_float),
        ("isInPit", c_int32), ("currentSectorIndex", c_int32),
        ("lastSectorTime", c_int32), ("numberOfLaps", c_int32),
        ("tyreCompound", c_wchar * 33),
        ("replayTimeMultiplier", c_float),
        ("normalizedCarPosition", c_float),
        ("carCoordinates", c_float * 3),
        ("penaltyTime", c_float),
        ("flag", c_int32),
        ("idealLineOn", c_int32), ("isInPitLane", c_int32),
        ("surfaceGrip", c_float), ("mandatoryPitDone", c_int32),
        ("windSpeed", c_float), ("windDirection", c_float),
    ]


class SPageFileStatic(ctypes.Structure):
    _pack_ = 4
    _fields_ = [
        ("_smVersion", c_wchar * 15), ("_acVersion", c_wchar * 15),
        ("numberOfSessions", c_int32), ("numCars", c_int32),
        ("carModel", c_wchar * 33), ("track", c_wchar * 33),
        ("playerName", c_wchar * 33), ("playerSurname", c_wchar * 33),
        ("playerNick", c_wchar * 33),
        ("sectorCount", c_int32),
        ("maxTorque", c_float), ("maxPower", c_float), ("maxRpm", c_int32),
        ("maxFuel", c_float),
        ("suspensionMaxTravel", c_float * 4), ("tyreRadius", c_float * 4),
        ("maxTurboBoost", c_float),
        ("deprecated_1", c_float), ("deprecated_2", c_float),
        ("penaltiesEnabled", c_int32),
        ("aidFuelRate", c_float), ("aidTireRate", c_float),
        ("aidMechanicalDamage", c_float), ("aidAllowTyreBlankets", c_int32),
        ("aidStability", c_float), ("aidAutoClutch", c_int32),
        ("aidAutoBlip", c_int32),
        ("hasDRS", c_int32), ("hasERS", c_int32), ("hasKERS", c_int32),
        ("kersMaxJ", c_float),
        ("engineBrakeSettingsCount", c_int32),
        ("ersPowerControllerCount", c_int32),
        ("trackSPlineLength", c_float),
        ("trackConfiguration", c_wchar * 33),
        ("ersMaxJ", c_float),
        ("isTimedRace", c_int32), ("hasExtraLap", c_int32),
        ("carSkin", c_wchar * 33),
        ("reversedGridPositions", c_int32),
        ("PitWindowStart", c_int32), ("PitWindowEnd", c_int32),
    ]


# ------------------------------------------------- adversarios (opponents)
# So o AC nao poe os outros carros nas suas paginas. Quem o faz e' a NOSSA
# app, em python_app/actelemetry.py, que corre DENTRO do jogo e escreve
# esta pagina com os 128 carros. Nao e' uma ligacao de rede: e' mais uma
# pagina de memoria partilhada, que se le tal e qual as outras.
#
# A app e' a NOSSA: a que existia antes era a do SimHub, e o que publish
# e' dela esta' agora em python_app/. Instalar e' copiar a pasta
# actelemetry para assettocorsa/apps/python/ e ligar em Content Manager
# (Settings -> Python Apps -> "AssettoCorsaTelemetry"). Confirma-se pelo
# log do AC: "AssettoCorsaTelemetry <versao> a escrever na pagina".

# maximo de setores por volta guardados por carro (tem de ser O MESMO
# numero dos dois lados -- e' o que define o tamanho da struct)
MAX_SECTORS = 8


class vec3(ctypes.Structure):
    _pack_ = 4
    _fields_ = [("x", c_float), ("y", c_float), ("z", c_float)]


class acsVehicleInfo(ctypes.Structure):
    _pack_ = 4
    _fields_ = [
        ("carId", c_int32),
        ("driverName", c_char * 64),
        ("carModel", c_char * 64),
        ("speedMS", c_float),
        ("bestLapMS", c_int32),
        ("lapCount", c_int32),
        ("currentLapInvalid", c_int32),
        ("currentLapTimeMS", c_int32),
        ("lastLapTimeMS", c_int32),
        ("worldPosition", vec3),
        ("isCarInPitline", c_int32),
        ("isCarInPit", c_int32),
        ("carLeaderboardPosition", c_int32),
        ("carRealTimeLeaderboardPosition", c_int32),
        ("spLineLength", c_float),
        ("isConnected", c_int32),
        # Antes aqui havia tres campos que NUNCA eram preenchidos e ficavam
        # sempre a zero: suspensionDamage (c_float*4), engineLifeLeft
        # (c_float) e tyreInflation (c_float*4) -- 36 bytes por carro,
        # 4,6 KB na pagina, todos os dias, a zeros. Nenhum deles existe no
        # enum CS do acsys.py, que e' o que o ac.getCarState() aceita,
        # portanto na' e' a app que falhava: era' impossible escrever aquilo.
        # Ver a Regra no 18 -- a HUD em Lua le-os pela API do objecto
        # carro, que e' outra interface.
        #
        # No lugar deles, o que o CS tem mesmo e interessa a um adversario.
        ("tyreCoreTemp", c_float * 4),      # Celsius, por pneu
        ("turboBoost", c_float),            # fraccao 0..1
        ("kersCharge", c_float),            # fraccao 0..1
        ("drsAvailable", c_int32),          # a zona existe
        ("drsEnabled", c_int32),            # e o DRS esta' ligado
        ("tyreSurfaceTemp", c_float * 4),   # Celsius, banda
        # Tempos de setor (ms) da ultima volta completa de cada carro,
        # vindos de ac.getLastSplits() dentro da nossa app. So' fazem
        # sentido os primeiros 'lastSplitsCount' valores -- ver snapshot().
        ("lastSplitsMS", c_int32 * MAX_SECTORS),
        ("lastSplitsCount", c_int32),
        # CAIXA, pela API do jogo -- e' a MESMA coisa que o HUD do Content
        # Manager mostra no ecra, lida de outra interface (Regra no 18).
        # Existe para comparar com o 'gear' da pagina de fisica, que e'
        # outro campo com o mesmo nome. Ha' um bug em que a caixa aparece
        # com +1; a unica forma de o decidir e' ter os dois valores no
        # MESMO instante, e nenhum humano le as duas coisas ao mesmo
        # tempo. Ver caixa.md.
        ("gearApi", c_int32),
    ]


class SPageFileSimHub(ctypes.Structure):
    _pack_ = 4
    _fields_ = [
        ("numVehicles", c_int32),
        ("focusVehicle", c_int32),
        ("serverName", c_char * 512),
        ("vehicleInfo", acsVehicleInfo * 128),
        ("acInstallPath", c_char * 512),
        ("isInternalMemoryModuleLoaded", c_int32),
        ("pluginVersion", c_char * 32),
        # As falhas da app, publicadas. Acrescentados no fim do cabecalho
        # para nao mexer em nenhum offset do que ja existia. Ver o
        # comentario em python_app/actelemetry_strefiz/actelemetry_shm.py.
        ("errorCount", c_int32),
        ("lastError", c_char * 128),
        # O clima, no cabecalho: e' da sessao, nao de cada carro. Todos a
        # -1 quando nao se sabe, que e' diferente de zero. Ver chuva.md.
        ("rainAmount", c_float),
        ("rainFxActive", c_int32),
        # O vento pela API, para comparar com o da pagina de graficos.
        ("windSpeedApi", c_float),
        ("windDirApi", c_float),
        ("weatherTimeMult", c_float),
        ("cspVersionCode", c_int32),
        ("weatherDebug", c_char * 128),
    ]


def _ao_vivo(v):
    """A posicao ao vivo do AC, convertida de base zero para base um.

    O AC publica DUAS posicoes e elas nao usam a mesma base. Medido com
    11 carros, 4 leituras:

        carRealTimeLeaderboardPosition   0 a 10
        carLeaderboardPosition           1 a 11

    Nao e' um valor invalido a 0: 0 e' a posicao ao vivo do lider, e
    leader. Por isso um `int(live) or int(oficial)` -- que parece uma
    proteccao -- faz o lider cair no oficial, e o segundo carro fica
    com o 1 do ao vivo. Dois P1.

    Devolve None quando o valor nao e' utilizavel, e quem chama usa a
    oficial. Menos zero e' o unico "nao vem" que o AC usa para uma
    posicao; 0 nao e'. """
    try:
        i = int(v)
    except Exception:
        return None
    if i < 0:
        return None
    return i + 1


def _b(v):
    """c_char array -> str limpo; '' se estiver vazio."""
    if not v:
        return ""
    if isinstance(v, bytes):
        return v.split(b"\x00", 1)[0].decode("utf-8", "ignore").strip()
    return str(v).split("\x00", 1)[0].strip()


class Opponents:
    """Leitor da pagina que a NOSSA app Python preenche."""

    # O NOME DA PAGINA e' o contrato com python_app/actelemetry_shm.py.
    # Tem de ser igual nos dois lados, e tests\test_contrato.py falha se
    # algum mudar sozinho. E' um nome que nunca existiu, de proposito: se
    # a app nao estiver instalada ou nao arrancar, esta pagina nao existe
    # e open() da "available: False" -- em vez de abrir um mapeamento
    # antigo, com a struct errada, e ler lixo a seguir ao fim.
    NAME = "acpmf_actelemetry_v2"
    # v2 porque a struct GANHOU o bloco do clima e passou de 37040 para
    # 37192 bytes. Com a v1 a correr, o leitor novo ia buscar 152 bytes a
    # SEGUIR ao fim real da pagina -- e dava zeros. Zeros e' pior do que
    # um erro: rainAmount=0 le-se como "nao chove", que e' um numero
    # plausivel e falso.
    #
    # A regra e' a da Regra no 19: a struct mudou de tamanho, logo o nome
    # muda. Nao para ser cuidadoso -- para que a app antiga NAO crie a
    # pagina e o dashboard diga a verdade em vez de mostrar numeros
    # plausiveis.

    def __init__(self, name=None):
        self._h = None
        self._addr = None
        self._view = None
        self.available = False
        self.pluginVersion = ""
        # 'name' existe para os testes poderem usar uma pagina FICTICIA.
        # Nunca criar a pagina real num teste: a app mantem-na mapeada
        # mesmo com o jogo fechado, por isso o CreateFileMapping devolveria
        # o objeto JA EXISTENTE e as escritas do teste iriam parar a
        # memoria de uma sessao real (Regra no 1).
        self.name = name or self.NAME
        self.open()

    def open(self):
        self.close()
        h = k32.OpenFileMappingW(FILE_MAP_READ, False, self.name)
        if not h:
            return False
        addr = k32.MapViewOfFile(h, FILE_MAP_READ, 0, 0,
                                 ctypes.sizeof(SPageFileSimHub))
        if not addr:
            k32.CloseHandle(h)
            return False
        self._h, self._addr = h, addr
        self._view = SPageFileSimHub.from_address(addr)
        self.available = True
        try:
            self.pluginVersion = _b(self._view.pluginVersion)
        except Exception:
            self.pluginVersion = ""
        return True

    def close(self):
        if self._addr:
            try:
                k32.UnmapViewOfFile(ctypes.c_void_p(self._addr))
            except Exception:
                pass
        if self._h:
            try:
                k32.CloseHandle(self._h)
            except Exception:
                pass
        self._h = self._addr = self._view = None
        self.available = False

    def snapshot(self):
        if not self.available and not self.open():
            return {"available": False, "cars": []}
        try:
            v = self._view
            n = min(int(v.numVehicles), 128)
            if n <= 0:
                return {"available": True, "pluginVersion": self.pluginVersion,
                        "focus": int(v.focusVehicle), "count": 0, "cars": [],
                        "errorCount": int(v.errorCount),
                        "lastError": _b(v.lastError)}
            cars = []
            for i in range(n):
                c = v.vehicleInfo[i]
                name = _b(c.driverName)
                if not name:
                    continue
                cars.append({
                    "id": int(c.carId),
                    "name": name,
                    "car": _b(c.carModel),
                    # A posicao mostrada e' a AO VIVO, e nao a oficial.
                    #
                    # As duas existem no AC e discordam. Medido nesta
                    # corrida, no mesmo instante, para o mesmo carro:
                    # pos=11 e livePos=5. A oficial conta voltas
                    # completas, e no primeiro tempo de uma corrida nao
                    # te promove por teres passado mais depressa alguem
                    # que ainda nao fechou a volta.
                    #
                    # O cabecalho do dashboard ja' usava a ao vivo. Com a
                    # lista a usar a oficial, as duas metades do ecra
                    # diziam coisas diferentes -- subias de posicao e a
                    # lista nao se mexia. Para quem conduz, o que
                    # interessa e' onde se esta' agora, por isso a
                    # posicao oficial passa a `posOficial` e fica no
                    # title da linha, para se poder conferir.
                    # +1, E SEM 'or'. Medido com 11 carros: o campo ao
                    # vivo vai de 0 a 10 e o oficial de 1 a 11 -- o ao
                    # vivo e' base zero. Com um 'or' a proteger o caso
                    # de "nao vir", o 0 do lider caia no oficial e
                    # dava dois P1 na lista.
                    #
                    # So' um NEGATIVO e' "nao disponivel", porque e' o
                    # unico valor que o AC nao usa para uma posicao.
                    "pos": (_ao_vivo(c.carRealTimeLeaderboardPosition)
                            or int(c.carLeaderboardPosition)),
                    "posOficial": int(c.carLeaderboardPosition),
                    # Como vem do jogo, em base zero. Exposto para
                    # conferir, nunca para mostrar.
                    "livePos": int(c.carRealTimeLeaderboardPosition),
                    "lap": int(c.lapCount),
                    "speed": round(c.speedMS * 3.6, 1),      # m/s -> km/h
                    "best": _ms(c.bestLapMS),
                    "last": _ms(c.lastLapTimeMS),
                    "cur": _ms(c.currentLapTimeMS),
                    "invalid": bool(c.currentLapInvalid),
                    "pct": round(c.spLineLength, 4),
                    "x": round(c.worldPosition.x, 2),
                    "y": round(c.worldPosition.y, 2),
                    "z": round(c.worldPosition.z, 2),
                    "inPit": bool(c.isCarInPit),
                    "inPitLane": bool(c.isCarInPitline),
                    "connected": bool(c.isConnected),
                    # Temperatura do nucleo dos 4 pneus, em Celsius, na
                    # ordem FL, FR, RL, RR -- igual a todos os outros
                    # arrays de 4 deste interface.
                    #
                    # CUIDADO com isto: a app passa o indice da roda ao
                    # ac.getCarState(). A documentacao do acsys.py so'
                    # exige o indice para ContactPoint/Normal/Heading/
                    # RightVector, e nao para as temperaturas -- e nao ha'
                    # como descobrir qual das duas coisas e' a certa sem
                    # o jogo a correr. COMO SABER: se as quatro vierem
                    # sempre iguais, o indice esta' a ser ignorado e o AC
                    # esta' a devolver sempre a roda da frente. Le-se em
                    # segundos, no ecra.
                    "tyreCore": [round(float(x), 1) for x in c.tyreCoreTemp],
                    "tyreSurface": [round(float(x), 1)
                                    for x in c.tyreSurfaceTemp],
                    # fraccoes 0..1, como as do carro do jogador
                    "turbo": round(max(0.0, min(1.0, float(c.turboBoost))), 3),
                    "ers": round(max(0.0, min(1.0, float(c.kersCharge))), 3),
                    # 1 = a zona existe / o DRS esta' ligado
                    "drsAvailable": int(c.drsAvailable),
                    "drsEnabled": int(c.drsEnabled),
                    # tempos de setor da ultima volta completa, formatados
                    # como os outros tempos ("M:SS.mmm"/"--:--.---") para o
                    # cliente poder usar toSec() sem precisar de um caso
                    # especial. So' os primeiros 'lastSplitsCount' contam --
                    # o resto do array e' lixo (nunca escrito nesta volta).
                    "splits": [_ms(c.lastSplitsMS[i])
                               for i in range(min(int(c.lastSplitsCount), MAX_SECTORS))],
                })
            # Ordena pelo MESMO numero que e' mostrado. Ordenar por um e
            # mostrar outro e' como se produz uma lista que parece
            # saltada sem nenhum dos numeros estar errado.
                        # a posicao ja vem em base um (ver _ao_vivo), portanto o
            # sort nao tem nada a converter
            cars.sort(key=lambda d: (d["pos"] if d["pos"] > 0 else 999, d["name"]))
            return {"available": True, "pluginVersion": self.pluginVersion,
                    "focus": int(v.focusVehicle), "count": len(cars),
                    "cars": cars,
                    # O que a app esta' a evitar dizer em voz alta. A app
                    # engole excepcoes de proposito, para nao morrer a
                    # meio de escrever -- mas se tambem nao as publica,
                    # uma falha em qualquer sitio vira uma lista vazia
                    # sem explicacao, e o unico texto que o dashboard
                    # mostra e' "liga a app no Content Manager", que e' a
                    # instrucao errada. Ver python_app/actelemetry_strefiz.
                    "errorCount": int(v.errorCount),
                    "lastError": _b(v.lastError),
                    # O clima. O -1 significa "a app nao conseguiu ler",
                    # que e' diferente de zero. O cliente tem de pintar
                    # isso a neutro -- nunca "nao chove". Ver chuva.md.
                    "rainAmount": float(v.rainAmount),
                    "rainFxActive": int(v.rainFxActive),
                    "windSpeedApi": float(v.windSpeedApi),
                    "windDirApi": float(v.windDirApi),
                    "weatherTimeMult": float(v.weatherTimeMult),
                    "cspVersionCode": int(v.cspVersionCode),
                    "weatherDebug": _b(v.weatherDebug)}
        except Exception as e:
            self.close()
            return {"available": False, "cars": [], "error": str(e)}


# ---------------------------------------------------------------- mapeamento
# Constantes do Windows. Cuidado: em MapViewOfFile o segundo parametro e'
# dwDesiredAccess (valores FILE_MAP_*), nao a proteccao de pagina (PAGE_*).
# Sao familias de constantes diferentes e fáciles de confundir.
FILE_MAP_WRITE  = 0x0002
FILE_MAP_READ   = 0x0004
FILE_MAP_ALL_ACCESS = 0x000F
PAGE_READONLY   = 0x02
PAGE_READWRITE  = 0x04

k32 = ctypes.WinDLL("kernel32", use_last_error=True)

# Sem estes protótipos o handle de 64 bits e' truncado para 32 e o
# MapViewOfFile recebe um handle invalido.
k32.OpenFileMappingW.restype = wintypes.HANDLE
k32.OpenFileMappingW.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.LPCWSTR]
k32.MapViewOfFile.restype = ctypes.c_void_p
k32.MapViewOfFile.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.DWORD,
                              wintypes.DWORD, ctypes.c_size_t]
k32.UnmapViewOfFile.argtypes = [ctypes.c_void_p]
k32.UnmapViewOfFile.restype = wintypes.BOOL
k32.CloseHandle.argtypes = [wintypes.HANDLE]
k32.CloseHandle.restype = wintypes.BOOL


def _finito(v):
    """True se v e' um numero que se pode converter para int.

    O AC publica INFINITO em varios campos quando a sessao nao tem
    limite de tempo: medido, o sessionTimeLeft de um treino sem cronometro
    vem a inf. Com isso, 'inf > 0' e' verdadeiro e 'int(inf * 1000)' levanta
    OverflowError -- que rebenta o snapshot() INTEIRO, e o /api/state passa
    a devolver erro. O painel fica cego numa sessao sem tempo, que e'
    precisamente quando se treina.
    """
    try:
        f = float(v)
    except (TypeError, ValueError):
        return False
    # math.isfinite diz o que e' mesmo; o try/except apanha o resto
    return f == f and f not in (float("inf"), float("-inf"))


def _ms(v):
    """milissegundos -> 00:00.000 (o AC devolve os tempos em ms)"""
    if not _finito(v) or v <= 0:
        return "--:--.---"
    ms = int(v)
    m, rem = divmod(ms, 60000)
    s, msec = divmod(rem, 1000)
    return f"{m:02d}:{s:02d}.{msec:03d}"


def _ms_plain(v):
    if not _finito(v) or v <= 0:
        return None
    ms = int(v)
    m, rem = divmod(ms, 60000)
    s, msec = divmod(rem, 1000)
    return f"{m}:{s:02d}.{msec:03d}"


def _gear(g):
    if g == 0:
        return "N"
    if g < 0:
        return "R"
    return str(g)


class ACTelemetry:
    """Mantem as tres paginas mapeadas e lê um snapshot de telemetria.

    ATENCAO: isto so LE. Nunca escrever nestas paginas - o AC esta a usar
    o mesmo objeto de memoria. Para testar, passe 'names' com nomes
    ficticios: assim nunca se toca na memoria do jogo a correr.
    """

    # nomes reais, usados quando o AC esta a correr
    REAL_NAMES = ("acpmf_physics", "acpmf_graphics", "acpmf_static")
    STRUCTS = (SPageFilePhysics, SPageFileGraphic, SPageFileStatic)

    def __init__(self, names=None, app_name=None):
        self._views = {}       # nome -> (handle, endereco, struct)
        self.connected = False
        self.live = False      # o AC esta actively a escrever?
        self.ac_version = ""
        self._names = tuple(names) if names else self.REAL_NAMES
        self._last_packet = None
        self._static_packet = None
        self._still_since = 0.0
        # A PAGINA DA APP, so' para o clima. Sao tres paginas do AC e uma
        # nossa, e o clima vivia so' na nossa -- que e' publicada em
        # `/api/opponents` e nunca chegava ao `/api/state`, que e' o que o
        # painel consome. O campo do tempo mostrava "nao sei", e a razao
        # nao era a app nao conseguir ler: era um campo que nao viajava.
        self._app = Opponents(name=app_name)
        self._open()

    # -- ciclo de vida do mapeamento ------------------------------------
    def _open(self):
        for name, struct in zip(self._names, self.STRUCTS):
            h = k32.OpenFileMappingW(FILE_MAP_READ, False, name)
            if not h:
                self._close()
                return False
            addr = k32.MapViewOfFile(h, FILE_MAP_READ, 0, 0, ctypes.sizeof(struct))
            if not addr:
                k32.CloseHandle(h)
                self._close()
                return False
            self._views[name] = (h, addr, struct.from_address(addr))
        self.connected = True
        self._last_packet = None
        try:
            self.ac_version = self._views[self._names[2]][2]._acVersion
        except Exception:
            self.ac_version = ""
        return True

    def _close(self):
        for h, addr, _ in self._views.values():
            try:
                k32.UnmapViewOfFile(ctypes.c_void_p(addr))
            except Exception:
                pass
            try:
                k32.CloseHandle(h)
            except Exception:
                pass
        self._views.clear()
        self.connected = False

    def _clima(self):
        """O bloco do clima da pagina da app, ou tudo a -1 se nao houver.

        A -1 e' a resposta tanto para "a app nao existe" como para "a app
        existe e nao consegue ler o tempo". Sao situacoes diferentes, e o
        painel nao precisa de as distinguir: nos dois casos nao se sabe, e
        "nao se sabe" nunca se escreve "seco". Publicar -1 e' o que a app
        publica, e o que o painel sabe pintar a neutro.
        """
        if not self._app.open():
            return {"climaAvailable": False, "rainAmount": -1.0,
                    "rainFxActive": 0, "windSpeedApi": -1.0,
                    "windDirApi": -1.0, "weatherTimeMult": -1.0,
                    "cspVersionCode": -1, "weatherDebug": ""}
        v = self._app._view
        return {"climaAvailable": True, "rainAmount": float(v.rainAmount),
                "rainFxActive": int(v.rainFxActive),
                "windSpeedApi": float(v.windSpeedApi),
                "windDirApi": float(v.windDirApi),
                "weatherTimeMult": float(v.weatherTimeMult),
                "cspVersionCode": int(v.cspVersionCode),
                "weatherDebug": _b(v.weatherDebug)}

    def _ensure(self):
        """Se o AC fechou, volta a tentar abrir; se abriu, reabre."""
        if self.connected:
            # confirma que a ligacao continua viva
            try:
                st = self._views["acpmf_static"][2]
                st._acVersion                       # toca na memoria
                return True
            except Exception:
                self.connected = False
                self._views.clear()
        return self._open()

    # -- leitura --------------------------------------------------------
    def _check_live(self, ph):
        """O SimHub mantem estas paginas mapeadas mesmo com o jogo fechado,
        por isso a pagina existir NAO significa que o AC esteja a correr.
        O sinal de dados a chegar e' o packetId da fisica, que o AC
        incrementa a cada frame.

        Cuidado: em PAUSA ou no menu o packetId tambem para. Por isso
        devolvemos ha quanto tempo nao mexem, para o interface distinguir
        "em pausa" de "jogo encerrado" em vez de esconder tudo."""
        now = time.time()
        pk = ph.packetId
        if self._last_packet is None:
            self._last_packet = pk
            self._still_since = now
        elif pk != self._last_packet:
            self._last_packet = pk
            self._still_since = now
        self.live = (now - self._still_since) < 2.0
        self.since_packet = now - self._still_since
        return self.live

    def snapshot(self):
        if not self._ensure():
            return {"connected": False, "live": False, "sincePacket": 0}

        ph = self._views[self._names[0]][2]
        gr = self._views[self._names[1]][2]
        st = self._views[self._names[2]][2]

        live = self._check_live(ph)
        # O CLIMA vem da pagina da APP, e nao desta. Sao coisas
        # diferentes: o `windSpeed` mais abaixo e' o que o AC publica na
        # pagina de graficos, e o `windSpeedApi` e' o que a NOSSA app leu
        # da API do Custom Shaders Patch. Publicam-se os dois de
        # proposito: se baterem, prova-se que a API do Python le o mesmo
        # mundo que a memoria partilhada.
        clima = self._clima()
        # Escalas confirmadas contra o AC real (RB21 em Spa):
        #   kersCharge  -> fraccao 0..1
        #   tyreWear    -> ja e' 0..100 (100 = pneu novo), NAO e' fraccao
        #   drsAvailable / drsEnabled -> inteiros 0/1 (o campo 'drs' e' um float)
        ers_max = st.ersMaxJ or st.kersMaxJ or 0.0
        ers_pct = round(ph.kersCharge * 100.0, 0)
        drs_avail = 1 if (ph.drsAvailable or ph.drs >= 0.5) else 0
        drs_on = 1 if (ph.drsEnabled or ph.drs >= 0.5) else 0
        # No AC base a pagina de graficos so traz penaltyTime (segundos) e
        # a bandeira AC_PENALTY_FLAG. O enum de TIPO de penalidade (DT/SG10)
        # e' do ACC e nao existe aqui - por isso mostramos o tempo.
        pen_s = round(gr.penaltyTime, 1) if gr.penaltyTime and gr.penaltyTime > 0 else 0.0

        return {
            "connected": True,
            "live": live,
            "sincePacket": round(self.since_packet, 1),
            "packetId": ph.packetId,
            "acVersion": st._acVersion,
            "car": st.carModel,
            "track": st.track,
            "trackConfig": st.trackConfiguration,
            "compound": gr.tyreCompound,
            "session": SESSION_NAMES.get(gr.session, str(gr.session)),
            "status": {0: "OFF", 1: "REPLAY", 2: "LIVE", 3: "PAUSE"}.get(gr.status, "?"),
            "position": gr.position,
            "numCars": st.numCars,
            "flag": FLAG_NAMES.get(gr.flag, str(gr.flag)),
            "flagId": gr.flag,
            "isInPit": bool(gr.isInPit),
            "isInPitLane": bool(gr.isInPitLane),
            "pitLimiter": bool(ph.pitLimiterOn),
            "penaltyTime": pen_s,
            "penaltyFlag": gr.flag == 6,
            "penaltiesEnabled": bool(st.penaltiesEnabled),

            "speed": round(ph.speedKmh, 1),
            "rpm": ph.rpms,
            "maxRpm": st.maxRpm,
            "gear": _gear(ph.gear),
            "throttle": round(ph.gas * 100, 0),
            "brake": round(ph.brake * 100, 0),
            "steer": round(ph.steerAngle, 3),
            "clutch": round(ph.clutch * 100, 0),
            "tc": ph.tc,
            "abs": ph.abs,
            "turbo": round(ph.turboBoost, 3),

            "drs": ph.drs,
            "drsAvailable": drs_avail,
            "drsEnabled": drs_on,
            "hasDRS": bool(st.hasDRS),
            "hasERS": bool(st.hasERS),
            "hasKERS": bool(st.hasKERS),
            # NOTA sobre unidades: 'ersMaxJ'/'kersMaxJ' vem em JOULES
            # (num F1 dá ~4 500 000 = 4,5 MJ), apesar do nome dizer J.
            # 'kersCurrentKJ' vem em KILOJOULES (centenas por volta).
            # Confundir os dois é erro de factor 1000.
            "ersPct": ers_pct,
            "ersMaxJ": round(ers_max, 0),
            "ersMaxMJ": round(ers_max / 1e6, 2),
            "ersUsedThisLapKJ": round(ph.kersCurrentKJ, 0),
            "ersCharging": bool(ph.ersIsCharging),

            "fuelL": round(ph.fuel, 2),
            "maxFuelL": round(st.maxFuel, 1),
            "fuelPct": round(ph.fuel / st.maxFuel * 100, 1) if st.maxFuel else 0.0,

            "lap": gr.completedLaps,
            "totalLaps": gr.numberOfLaps,
            "currentTime": _ms(gr.iCurrentTime),
            "lastTime": _ms(gr.iLastTime),
            "bestTime": _ms(gr.iBestTime),
            # inf quando a sessao nao tem limite de tempo -- ver _finito()
        "sessionLeft": (_ms_plain(int(gr.sessionTimeLeft * 1000))
                        if _finito(gr.sessionTimeLeft) and gr.sessionTimeLeft > 0
                        else None),

            # Mundo do AC: X-Z e' o plano da pista, Y e' a ALTITUDE.
            # Medido em Spa com 19 adversarios: X 997 m, Y 88 m, Z 2012 m.
            # Como o desnivel de Spa e' ~100 m, os 88 m de Y sao a
            # altura. Desenhar o mapa com X contra Y da um rabico
            # achatado que nao e' a pista.
            "x": round(gr.carCoordinates[0], 2),
            "y": round(gr.carCoordinates[1], 2),   # altitude
            "z": round(gr.carCoordinates[2], 2),
            "trackPct": round(gr.normalizedCarPosition, 4),
            "sector": gr.currentSectorIndex,
            "sectorCount": st.sectorCount,
            "lastSectorTime": _ms(gr.lastSectorTime),

            "tyreTempI": [round(v) for v in ph.tyreTempI],
            "tyreTempM": [round(v) for v in ph.tyreTempM],
            "tyreTempO": [round(v) for v in ph.tyreTempO],
            "tyreCore": [round(v) for v in ph.tyreCoreTemperature],
            # 0..100 onde 100 = novo. 'gasto' e' o que se ja perdeu.
            "tyreWear": [round(v, 1) for v in ph.tyreWear],
            "tyreWearUsed": [round(100.0 - v, 2) for v in ph.tyreWear],
            "tyrePressure": [round(v, 1) for v in ph.wheelsPressure],
            "brakeTemp": [round(v) for v in ph.brakeTemp],
            "wheelSlip": [round(v, 3) for v in ph.wheelSlip],
            "clutchRaw": round(ph.clutch, 3),
            "carDamage": [round(v, 3) for v in ph.carDamage],
            # brakeBias: fracao 0..1, medida 0.58 num Toyota TS040 sem nada
            # mexido. O HUD do Content Manager le o campo com o mesmo nome e
            # mostra-o x100, e ajusta-o de 0,5 em 0,5 -- ver Regra nº 18.
            "brakeBias": round(ph.brakeBias, 4),
            "airTemp": round(ph.airTemp, 1),
            "roadTemp": round(ph.roadTemp, 1),
            # A aderencia so' e' zero quando o jogo NAO esta a simular o
            # carro -- no menu, ou numa pagina que ninguem escreve. A
            # aderencia real nunca e' exactamente 0: molhado desce, mas
            # nao a zero.
            #
            # E o 0 e' o pior resultado possivel, porque e' plausivel: o
            # 'pintarGrip' pinta a vermelho abaixo de 0,85, e um '0.00'
            # a vermelho diz ao piloto que o carro esta' sobre gelo. Medido
            # numa sessao parada: 'surfaceGrip 0' com o carro no
            # Nordschleife, a tracado, com os pneus a 39-42 graus. Nao era
            # gelo -- era o jogo parado.
            #
            # E' a mesma regra da posicao, acima: so' um NEGATIVO e' "nao
            # disponivel". Ver Regra nº 19, "os zeros sao piores do que o
            # erro".
            "surfaceGrip": (round(gr.surfaceGrip, 2)
                            if gr.surfaceGrip > 0 else -1),

            # Clima. O AC NAO publica chuva nem estado do tempo em
            # nenhuma das tres paginas - nao ha campo para isso. O que ha
            # e' o efeito: a aderencia da pista desce quando esta molhado,
            # e por isso e' o 'surfaceGrip' que diz mais sobre a chuva do
            # que um flag que nao existe. Verificado a andar com o carro.
            "airDensity": round(ph.airDensity, 4),      # kg/m3 (1.225 ao nivel do mar)
            # m/s, e NAO km/h: a documentacao oficial (ACC v1.8.12) diz
        # "Wind speed in m/s". O comentario dizia km/h e o painel
        # mostrava km/h -- o numero certo com a unidade errada, um
        # factor de 3,6. Ninguem da por isso porque 10 m/s escreve-se
        # 10, qualquer que seja a unidade: e' a unidade que mente.
        #
        # E o `windDirection` sao RADIANOS, nao graus. Nao ha'
        # ninguem a mostrar a direccao, e e' isso que mantem o erro
        # quieto: um campo que ninguem le nao se repara.
            "windSpeed": round(gr.windSpeed, 2),        # m/s
            "windDirection": round(gr.windDirection, 1),

            # O bloco do clima, da pagina da app. `-1` quer dizer "a app
            # nao consegue ler o tempo", que e' diferente de zero: zero
            # no `rainAmount` diria "nao chove", e nao chove nao e' o
            # mesmo que nao se saber. Regra nº 19, e o ver chuva.md.
            "climaAvailable": clima["climaAvailable"],
            "rainAmount": clima["rainAmount"],
            "rainFxActive": clima["rainFxActive"],
            "windSpeedApi": clima["windSpeedApi"],
            "windDirApi": clima["windDirApi"],
            "weatherTimeMult": clima["weatherTimeMult"],
            "cspVersionCode": clima["cspVersionCode"],
            "weatherDebug": clima["weatherDebug"],
            "trackLength": round(st.trackSPlineLength, 1),   # metros
        }


if __name__ == "__main__":
    t = ACTelemetry()
    if not t.connected:
        print("Assetto Corsa nao esta a correr (ou nao ha shared memory).")
    else:
        import json
        s = t.snapshot()
        print(json.dumps(s, ensure_ascii=False, indent=2))
