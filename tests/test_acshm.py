"""
Teste do acshm sem o Assetto Corsa a correr.

IMPORTANTE: criamos paginas de shared memory com nomes FICTICIOS
("ac_test_*"). Nao podemos usar os nomes reais - o SimHub mantem
"acpmf_*" mapeadas mesmo com o jogo fechado, por isso criar paginas com
esses nomes devolveria o objeto JA EXISTENTE e as escritas do teste
iriam para dentro do jogo a correr. Foi o que aconteceu da primeira vez.
"""
import ctypes
import json
import os
import sys
import time
from ctypes import wintypes

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import acshm

# ---- guarda: se o AC estiver VIVO, abortar antes de tocar em nada ----
def ac_esta_vivo():
    """Le packetId duas vezes da pagina real. Se avancar, o AC esta a correr."""
    k = ctypes.WinDLL("kernel32", use_last_error=True)
    k.OpenFileMappingW.restype = wintypes.HANDLE
    k.OpenFileMappingW.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.LPCWSTR]
    k.MapViewOfFile.restype = ctypes.c_void_p
    k.MapViewOfFile.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.DWORD,
                                wintypes.DWORD, ctypes.c_size_t]
    h = k.OpenFileMappingW(0x0004, False, "acpmf_physics")
    if not h:
        return False
    a = k.MapViewOfFile(h, 0x0004, 0, 0, 2048)
    if not a:
        return False
    pid = ctypes.c_int32.from_address(a).value      # packetId e' o 1o campo
    time.sleep(0.35)
    pid2 = ctypes.c_int32.from_address(a).value
    return pid2 != pid


if ac_esta_vivo():
    print("ABORTADO: o Assetto Corsa esta a correr neste momento.")
    print("Este teste nunca deve escrever nas paginas reais - fecha o jogo e corre de novo.")
    sys.exit(2)

# cria paginas FALSAS, com nomes proprios
NAMES = ("ac_test_physics", "ac_test_graphics", "ac_test_static")
kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
kernel32.CreateFileMappingW.restype = wintypes.HANDLE
kernel32.CreateFileMappingW.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.DWORD,
                                        wintypes.DWORD, wintypes.DWORD, wintypes.LPCWSTR]

handles = []
for name, struct in zip(NAMES, (acshm.SPageFilePhysics,
                                 acshm.SPageFileGraphic,
                                 acshm.SPageFileStatic)):
    h = kernel32.CreateFileMappingW(None, None, acshm.PAGE_READWRITE, 0,
                                    ctypes.sizeof(struct), name)
    assert h, f"nao criei {name}"
    handles.append(h)
    addr = acshm.k32.MapViewOfFile(h, acshm.FILE_MAP_ALL_ACCESS, 0, 0,
                                   ctypes.sizeof(struct))
    assert addr, f"nao mapeei {name}"
    ctypes.memset(addr, 0, ctypes.sizeof(struct))
    obj = struct.from_address(addr)
    if name == NAMES[0]:
        obj.speedKmh = 246.75; obj.rpms = 11250; obj.gear = 5
        obj.gas = 0.8; obj.brake = 0.0; obj.fuel = 42.5
        obj.kersCharge = 0.95; obj.drs = 1.0; obj.pitLimiterOn = 0
        obj.kersCurrentKJ = 250.0                     # kJ (nao J), por volta
        obj.drsAvailable = 1; obj.drsEnabled = 1
        for i in range(4):
            obj.tyreTempI[i] = 90 + i; obj.tyreTempM[i] = 95 + i; obj.tyreTempO[i] = 99 + i
            obj.brakeTemp[i] = 300 + i * 7
            obj.tyreWear[i] = 99.75 - i * 5      # 0..100, 100 = novo
            obj.wheelsPressure[i] = 27.0 + i
    elif name == NAMES[1]:
        obj.status = 2; obj.session = 0; obj.currentSectorIndex = 1
        obj.iCurrentTime = 83456; obj.iLastTime = 91234; obj.iBestTime = 88999
        obj.completedLaps = 7; obj.numberOfLaps = 20; obj.position = 3
        obj.flag = 2; obj.penaltyTime = 5.0
        obj.carCoordinates[0] = 123.45; obj.carCoordinates[1] = -678.9
        obj.normalizedCarPosition = 0.4213
        obj.tyreCompound = "dry_compound"
    else:
        obj._acVersion = "1.16.2"; obj.carModel = "ferrari_488"; obj.track = "monza"
        obj.maxRpm = 12000; obj.maxFuel = 100.0; obj.numCars = 20
        obj.hasDRS = 1; obj.hasERS = 1; obj.hasKERS = 1
        obj.ersMaxJ = 4000000.0; obj.kersMaxJ = 0.0   # 4 MJ, em joules
        obj.sectorCount = 3; obj.penaltiesEnabled = 1

t = acshm.ACTelemetry(names=NAMES)
assert t.connected, "FAIL: nao consegui abrir as paginas de teste"
s = t.snapshot()

checks = [
    ("connected", True), ("acVersion", "1.16.2"), ("car", "ferrari_488"),
    ("track", "monza"), ("session", "TREINO"), ("status", "LIVE"),
    ("speed", 246.8), ("rpm", 11250), ("gear", "5"), ("maxRpm", 12000),
    ("throttle", 80.0), ("fuelL", 42.5), ("fuelPct", 42.5),
    ("ersPct", 95.0), ("ersMaxJ", 4000000.0), ("ersMaxMJ", 4.0),
    ("ersUsedThisLapKJ", 250.0), ("drs", 1.0), ("hasDRS", True),
    ("flag", "AMARELA"), ("flagId", 2), ("penaltyTime", 5.0), ("penaltyFlag", False),
    ("position", 3), ("lap", 7), ("totalLaps", 20),
    # 83456 ms = 1 min 23.456 s ; 91234 = 1:31.234 ; 88999 = 1:28.999
    ("currentTime", "01:23.456"), ("lastTime", "01:31.234"),
    ("bestTime", "01:28.999"), ("lastSectorTime", "--:--.---"),
    ("x", 123.45), ("y", -678.9), ("trackPct", 0.4213),
    ("tyreTempI", [90, 91, 92, 93]), ("tyreTempM", [95, 96, 97, 98]),
    ("tyreTempO", [99, 100, 101, 102]), ("brakeTemp", [300, 307, 314, 321]),
    # 'tyreWear' e' 0..100 arredondado a 1 casa; 'tyreWearUsed' e' o
    # desgaste em %, com 2 casas (os valores sao pequenos e 0.25% conta)
    ("tyreWear", [99.8, 94.8, 89.8, 84.8]),
    ("tyreWearUsed", [0.25, 5.25, 10.25, 15.25]),
    ("tyrePressure", [27.0, 28.0, 29.0, 30.0]),
    ("compound", "dry_compound"), ("sector", 1), ("sectorCount", 3),
    ("numCars", 20), ("airTemp", 0.0), ("surfaceGrip", 0.0),
]
bad = []
for k, want in checks:
    got = s.get(k)
    if got != want:
        bad.append(f"  {k}: esperava {want!r}, obtive {got!r}")

print("ligado:", s["connected"], "| AC", s["acVersion"])
print()
if bad:
    print("!!! %d FALHA(S) !!!" % len(bad))
    print("\n".join(bad))
    sys.exit(1)
print("OK: %d/%d valores batem certo com o que foi escrito na memoria." % (len(checks), len(checks)))
print()
print("amostra:", json.dumps({k: s[k] for k in
      ("speed","rpm","gear","ersPct","drs","flag","penaltyTime",
       "currentTime","bestTime","tyreTempM")}, ensure_ascii=False))

