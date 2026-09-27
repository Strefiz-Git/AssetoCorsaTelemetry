"""
Teste do leitor de adversarios (acpmf_actelemetry_v1) sem o AC a correr.

A pagina e' escrita pela NOSSA app, que corre dentro do jogo
(python_app/actelemetry.py). Antes era a app do SimHub.

AVISO IMPORTANTE (Regra n.o 1 do AGENTS.md): esta pagina e' mantida
mapeada pela app MESMO com o jogo fechado. Se um teste criar uma pagina
com o nome real, o CreateFileMappingW devolve o objeto JA EXISTENTE e
TODAS as escritas vao parar a memoria de uma sessao real. Por isso o
teste cria "ac_test_actelemetry" e passa-o ao construtor.

O que este teste cobre, e o que nao cobre:
  - COBRE: o tamanho e a ordem dos campos de acsVehicleInfo, a conversao
    de m/s para km/h, os tempos em ms, o filtro de carros sem nome.
  - NAO COBRE: se a app e o acshm.py falam a mesma linguagem. Isso e' o
    tests/test_contrato.py, que compara as DUAS structs campo a campo --
    porque este teste so' compara o acshm.py CONTRA SI PROPRIO, o que a
    Regra n.o 4 avisa que nao prova nada sobre o mundo.
  - NAO COBRE: se os offsets batem certo com o AC. Isso so' se prova com
    o jogo a correr (Regra n.o 4).
"""
import ctypes
import os
import sys
import time
from ctypes import wintypes

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import acshm

FICTICIA = "ac_test_actelemetry"


# ---- guarda: se o AC estiver VIVO, abortar antes de tocar em nada ----
def ac_esta_vivo():
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
    return ctypes.c_int32.from_address(a).value != pid


if ac_esta_vivo():
    print("ABORTADO: o Assetto Corsa esta a correr neste momento.")
    sys.exit(2)

# ---- tamanhos esperados, calculados a MAO a partir da lista de campos ----
# Nao se copia o sizeof() para aqui: isso so provaria o ctypes consigo
# mesmo. Somar os campos um a um e independente do motor de layout, e
# apanha um _pack_ errado ou um campo novo esquecido no meio.
# A primeira versao deste teste somou a mao e errou por 4 bytes, por isso
# a conta fica escrita e legivel.
def tamanho_esperado(struct):
    total = 0
    for nome, campo in struct._fields_:
        total += ctypes.sizeof(campo)
        # _pack_ = 4 nao mete padding porque todos os campos aqui sao
        # de 4 bytes. Se algum dia aparecer um de 8, esta conta tem de
        # ser revista - e o teste avisa.
        if ctypes.sizeof(campo) % 4:
            raise SystemExit("campo %s tem %d bytes: a soma manual "
                             "assume multiplos de 4" % (nome, ctypes.sizeof(campo)))
    return total

# Constantes FIXAS, medidas uma vez contra a app Python do SimHub. Sao
# estas que apanham um campo novo a ser acrescentado: a soma acima
# recalcula-se a partir da propria lista de campos, portanto dava
# qualquer coisa se essa lista mudar. Duas verificacoes que nunca
# coincidem: a soma e o numero congelado.
# 280 = 4+64+64+4+4+4+4+4+4+12+4+4+4+4+4+4        (ate' isConnected)
#       + 16+4+4+4+4+16                             (tyreCoreTemp, turbo,
#                                                    kersCharge, drs x2,
#                                                    tyreSurfaceTemp)
#       + 32+4                                    (splits)
#       + 4                                       (gearApi)
# Antes eram 228. A diferenca de 48 bytes nao e' um campo novo: e' o
# mesmo espaco, com os tres campos que nunca eram preenchidos
# (suspensionDamage, engineLifeLeft, tyreInflation) trocados por dados
# que a API do AC devolve mesmo. Ver python_app/actelemetry_shm.py.
#
# O gearApi sao' os 4 bytes a mais: e' a caixa pela API, ao lado da
# caixa da pagina de fisica, para se poderem comparar no mesmo instante
# (ver caixa.md). Foi posto no FIM de proposito -- acrescentar no fim
# nao move nenhum offset, e o test_contrato falha se um dos lados o
# puser no meio.
VEHICLE_FIXO = 280
# 37040 = cabecalho (4+4+512 + 280*128 + 512 + 4 + 32) + 4 + 128
# os dois ultimos sao o errorCount e o lastError, acrescentados no fim do
# cabecalho para a app poder publicar as falhas em vez de as esconder
# (foi assim que a leaderboard ficou vazia sem ninguem saber porquê)
PAGINA_FIXA = 4 + 4 + 512 + 280 * 128 + 512 + 4 + 32 + 4 + 128   # 37040

ESPERADO_VEHICLE = tamanho_esperado(acshm.acsVehicleInfo)
ESPERADO_PAGINA = tamanho_esperado(acshm.SPageFileSimHub)
# a pagina e' numVehicles + focusVehicle + serverName + 128 veiculos
#             + acInstallPath + isInternalMemoryModuleLoaded + version
#             + errorCount + lastError
# Os dois ultimos sao as falhas publicadas pela app. Se esta' formula
# ficar errada, o aviso e' o do proprio teste: e' a unica verificacao
# que diz que o _fields_ ainda fecha com o que o codigo espera.
assert ESPERADO_PAGINA == (4 + 4 + 512 + ESPERADO_VEHICLE * 128
                          + 512 + 4 + 32 + 4 + 128), \
    "a pagina nao e' a soma dos seus campos - reve o _fields_"
assert ESPERADO_VEHICLE == VEHICLE_FIXO, \
    "acsVehicleInfo mudou de tamanho: %d, e o _fields_ diz %d. " \
    "Se foi de proposito, actualiza a constante E documenta o novo campo." \
    % (VEHICLE_FIXO, ESPERADO_VEHICLE)
assert ESPERADO_PAGINA == PAGINA_FIXA, \
    "SPageFileSimHub mudou de tamanho: %d, e o _fields_ diz %d." \
    % (PAGINA_FIXA, ESPERADO_PAGINA)

k32 = ctypes.WinDLL("kernel32", use_last_error=True)
k32.CreateFileMappingW.restype = wintypes.HANDLE
k32.CreateFileMappingW.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.DWORD,
                                   wintypes.DWORD, wintypes.DWORD, wintypes.LPCWSTR]

erros = []

# 1) tamanhos: e' aqui que um campo novo a meio se denuncia
v_real = ctypes.sizeof(acshm.acsVehicleInfo)
p_real = ctypes.sizeof(acshm.SPageFileSimHub)
print("sizeof acsVehicleInfo : %d (esperado %d)" % (v_real, ESPERADO_VEHICLE))
print("sizeof SPageFileSimHub: %d (esperado %d)" % (p_real, ESPERADO_PAGINA))
if v_real != ESPERADO_VEHICLE:
    erros.append("  acsVehicleInfo tem %d bytes, esperava %d" % (v_real, ESPERADO_VEHICLE))
if p_real != ESPERADO_PAGINA:
    erros.append("  SPageFileSimHub tem %d bytes, esperava %d" % (p_real, ESPERADO_PAGINA))
print()

# 2) criar a pagina FICTICIA e escrever carros conhecidos
h = k32.CreateFileMappingW(None, None, acshm.PAGE_READWRITE, 0,
                            ctypes.sizeof(acshm.SPageFileSimHub), FICTICIA)
assert h, "nao criei " + FICTICIA
addr = acshm.k32.MapViewOfFile(h, acshm.FILE_MAP_ALL_ACCESS, 0, 0,
                               ctypes.sizeof(acshm.SPageFileSimHub))
assert addr, "nao mapeei " + FICTICIA
ctypes.memset(addr, 0, ctypes.sizeof(acshm.SPageFileSimHub))
pg = acshm.SPageFileSimHub.from_address(addr)

pg.numVehicles = 5
pg.focusVehicle = 0
pg.pluginVersion = b"1.0.1"
pg.serverName = b"Test Server"
pg.acInstallPath = b"C:\\AC"

def carro(i, nome, modelo, ms, best, lap, pos, live, x, y, z, pit=False, ligado=1):
    v = pg.vehicleInfo[i]
    v.carId = i
    v.driverName = nome.encode("utf-8")
    v.carModel = modelo.encode("utf-8")
    v.speedMS = ms
    v.bestLapMS = best
    v.lapCount = lap
    v.lastLapTimeMS = best + 1500
    v.currentLapTimeMS = 45000 + i * 1000
    v.carLeaderboardPosition = pos
    v.carRealTimeLeaderboardPosition = live
    v.worldPosition.x = x
    v.worldPosition.y = y
    v.worldPosition.z = z
    v.isCarInPit = 1 if pit else 0
    v.isConnected = ligado

carro(0, "Strefiz",  "red_bull_rb21",    61.1, 108188, 12, 1,  1,  309.78,   2.97, -163.75)
carro(1, "Perez",    "f1_redbull_2024",  77.3, 108188, 12, 2,  2,    9.03, -15.65,  421.90)
carro(2, "Re",       "ks_ferrari_f138",  71.0, 113043, 11, 3,  8,  188.55,  -3.20,  347.32, pit=True)
carro(3, "Albon",    "williams_fw47",    75.9, 114997, 12, 4,  4,  236.72,   0.28,  368.57)
# carro 4: sem nome. Tem de ser ignorado, porque na app Python e' o lugar
# onde fica o registo quando um carro sai da sessao. numVehicles = 5 e' de
# proposito: o leitor vai ate ao indice 4 e tem de o descartar a ele.
pg.vehicleInfo[4].carId = 99
pg.vehicleInfo[4].driverName = b""

# 3) ler
op = acshm.Opponents(name=FICTICIA)
if not op.available:
    print("!!! nao consegui abrir a pagina ficticia")
    sys.exit(1)
s = op.snapshot()
op.close()

print("available=%s  pluginVersion=%r  focus=%d  count=%d"
      % (s["available"], s["pluginVersion"], s["focus"], s["count"]))
print("slots lidos: 5 (numVehicles)  |  carros com nome: %d  |  "
      "descartados por nao ter nome: %d" % (len(s["cars"]), 5 - len(s["cars"])))
print()

def chk(k, got, want):
    if got != want:
        erros.append("  %s: esperava %r, obtive %r" % (k, want, got))

chk("available", s["available"], True)
chk("pluginVersion", s["pluginVersion"], "1.0.1")
chk("focus", s["focus"], 0)
# 4 carros com nome (indices 0..3). O slot 4 esta vazio e tem de cair.
chk("count", s["count"], 4)
chk("num_carros", len(s["cars"]), 4)
# o filtro e' o que impede um carro que saiu da sessao de ficar na lista
chk("slot_vazio_foi_descartado",
    [c["id"] for c in s["cars"] if c["id"] == 99], [])

if len(s["cars"]) == 4:
    #procura por nome, e nao por indice. A lista e' ORDENADA pela posicao
    # mostrada, e a posicao mostrada e' a ao vivo. Com o 'Re' em 3.o
    # oficial e 8.o ao vivo, a ordem muda -- e um teste que ver por
    # indice acusaria a implementacao de estar errada quando o que
    # mudou foi, precisamente, a ordem.
    porNome = dict((c["name"], c) for c in s["cars"])
    a = porNome["Strefiz"]
    b = porNome["Perez"]
    c = porNome["Re"]
    dd = porNome["Albon"]

    # A ordem da lista tem de ser a ordem dos numeros que a lista
    # mostra. Ordenar por um e mostrar outro e' como se produz uma
    # lista que parece saltada sem nenhum dos numeros estar errado.
    chk("ordem_pela_posicao_mostrada",
        [x["pos"] for x in s["cars"]],
        sorted(x["pos"] for x in s["cars"]))
    chk("as_duas_posicoes_por_carro",
        [(x["posOficial"], x["pos"], x["livePos"]) for x in s["cars"]],
        [(1, 1, 1), (2, 2, 2), (4, 4, 4), (3, 8, 8)])

    chk("0.nome", a["name"], "Strefiz")
    chk("0.carro", a["car"], "red_bull_rb21")
    chk("0.velocidade_kmh", a["speed"], 220.0)     # 61.1 m/s * 3.6 = 219.96 -> 220.0
    chk("0.melhor", a["best"], "01:48.188")       # 108188 ms
    chk("0.volta", a["lap"], 12)
    chk("0.pos", a["pos"], 1)
    chk("0.pos_oficial", a["posOficial"], 1)
    chk("0.pos_ao_vivo", a["livePos"], 1)
    chk("0.pct", a["pct"], 0.0)
    chk("0.x", a["x"], 309.78)
    chk("0.y", a["y"], 2.97)
    chk("0.z", a["z"], -163.75)
    chk("0.box", a["inPit"], False)
    chk("0.ligado", a["connected"], True)

    chk("1.nome", b["name"], "Perez")
    chk("1.pos_ao_vivo_diferente", b["livePos"], 2)

    # O 'Re' e' o caso que motivou a mudanca: 3.o oficial, 8.o ao vivo.
    # A lista mostra o ao vivo, e a oficial fica na dica. Este carro
    # estava no box e com uma volta a menos, que e' exactamente o caso
    # em que o oficial atrasa.
    chk("2.nome", c["name"], "Re")
    chk("2.pos_mostrada_e_a_ao_vivo", c["pos"], 8)
    chk("2.pos_oficial_guardada", c["posOficial"], 3)
    chk("2.pos_ao_vivo", c["livePos"], 8)
    chk("2.box", c["inPit"], True)
    chk("2.melhor", c["best"], "01:53.043")        # 113043 ms

    # 'y' e' a ALTITUDE (Regra n.10). Nao se pode trocar por 'z' no mapa.
    chk("2.coordenadas_completas", (c["x"], c["y"], c["z"]), (188.55, -3.2, 347.32))

    chk("3.nome", dd["name"], "Albon")
    chk("3.melhor", dd["best"], "01:54.997")        # 114997 ms

if erros:
    print("!!! %d FALHA(S) !!!" % len(erros))
    print("\n".join(erros))
    sys.exit(1)

print("OK: struct, conversoes e filtro de carros vazios estao certos.")
print()
print("Nota: isto prova a ORDEM dos campos, nao os offsets contra a app")
print("Python do SimHub. Isso so se prova com o jogo a correr (Regra n.4).")
