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


def _ms(v):
    """milissegundos -> 00:00.000 (o AC devolve os tempos em ms)"""
    if v is None or v <= 0:
        return "--:--.---"
    ms = int(v)
    m, rem = divmod(ms, 60000)
    s, msec = divmod(rem, 1000)
    return f"{m:02d}:{s:02d}.{msec:03d}"


def _ms_plain(v):
    if v is None or v <= 0:
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

    def __init__(self, names=None):
        self._views = {}       # nome -> (handle, endereco, struct)
        self.connected = False
        self.live = False      # o AC esta actively a escrever?
        self.ac_version = ""
        self._names = tuple(names) if names else self.REAL_NAMES
        self._last_packet = None
        self._static_packet = None
        self._still_since = 0.0
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
            "sessionLeft": _ms_plain(int(gr.sessionTimeLeft * 1000)) if gr.sessionTimeLeft > 0 else None,

            "x": round(gr.carCoordinates[0], 2),
            "y": round(gr.carCoordinates[1], 2),
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
            "airTemp": round(ph.airTemp, 1),
            "roadTemp": round(ph.roadTemp, 1),
            "surfaceGrip": round(gr.surfaceGrip, 2),
        }


if __name__ == "__main__":
    t = ACTelemetry()
    if not t.connected:
        print("Assetto Corsa nao esta a correr (ou nao ha shared memory).")
    else:
        import json
        s = t.snapshot()
        print(json.dumps(s, ensure_ascii=False, indent=2))
