# -*- coding: utf-8 -*-
"""
Os packets do F1 25 lidos byte a byte.

Estes testes NAO usam o jogo. Constroem-se os datagramas com ctypes, com
valores que se escolhem para se saber a resposta antes de correr, e
decodificam-se pelo mesmo caminho que o receptor usa. E' auto-consciente
(Regra no 4) e por isso nao prova nada sobre o jogo -- o que prova e' que
o receptor le OFFSETS E TIPOS como estao escritos, e que as regras
escritas na documentacao estao no codigo.

O que SO este teste apanha, e que nenhum outro apanha:
  - os quatro tipos que a EA mudou no Season Pack 2026, que deslocam
    todos os carros a seguir (a Regra no 3 outra vez)
  - a traducao da ordem das rodas, RL/RR/FL/FR para FL/FR/RL/RR
  - o truque dos tempos, em que a parte dos minutos e' um campo a parte
  - a divisao por 1000 das forcas G de 2026
  - o formato desconhecido a ser recusado em vez de adivinhado
"""
import ctypes as c
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8")

from actelemetry.jogos.f125 import protocolo as P
from actelemetry.jogos.f125.receptor import Leitor

FALHAS = []


def ok(cond, msg):
    if cond:
        print("  ok   %s" % msg)
    else:
        print("  FALHA %s" % msg)
        FALHAS.append(msg)


def igual(a, b, msg):
    ok(a == b, "%s  (%r, esperado %r)" % (msg, a, b))


# ------------------------------------------------------- construir pacotes
def cabecalho(formato, packet_id, frame=1, player=0, sessao=1.5):
    return P.Cabecalho(
        packetFormat=formato, gameYear=25, gameMajorVersion=1,
        gameMinorVersion=0, packetVersion=1, packetId=packet_id,
        sessionUID=12345, sessionTime=sessao, frameIdentifier=frame,
        overallFrameIdentifier=frame, playerCarIndex=player,
        secondaryPlayerCarIndex=255)


def bytes_de(st, campo=None):
    return bytes(memoryview(st).cast("B"))


def recibo(l, formato, pid, st, frame=1, player=0, sessao=1.5):
    """Mete um pacote no receptor como se viesse do socket.

    O cabecalho e' POSTO DENTRO da struct, e serializa-se a struct toda.
    Fazer o contrario -- montar o cabecalho a parte e cola-lo a frente --
    shifting de 29 bytes sem dar erro, e foi o que aconteceu da primeira
    vez que este teste foi corrido: os valores saiam todos errados e
    plausiveis ao mesmo tempo, que e' o pior resultado possivel. Pôr o
    cabecalho no sitio tambem prova que ele esta' no offset 0, o que e'
    uma coisa que a documentacao promete e o codigo tem de cumprir.
    """
    st.header = cabecalho(formato, pid, frame=frame, player=player,
                          sessao=sessao)
    bruto = bytes(memoryview(st).cast("B"))
    # O datagrama tem de ter o tamanho que a documentacao diz. Se nao
    # tivesse, o receptor rejeitava-o -- e o teste passava a testar outra
    # coisa.
    esperado = P.tamanho_esperado(pid, formato)
    assert esperado is None or len(bruto) == esperado, (
        "%s/%d: %d bytes, a documentacao diz %d"
        % (P.NOMES_PACKET.get(pid, pid), formato, len(bruto), esperado))
    l._tratar(bruto)


def telemetria(formato, player=0):
    """Um Car Telemetry com valores bem escolhidos para se verificar."""
    st = P.construir(formato)[P.PacketId.TELEMETRY]()
    car = st.cars[player]
    car.speed = 287                      # km/h
    car.throttle = 0.85
    car.steer = -0.42                    # a puxar para a esquerda
    car.brake = 0.0
    car.clutch = 100                     # 0 a 100, NAO 0.0 a 1.0
    car.gear = 4
    car.engineRPM = 11450
    car.drs = 1
    car.revLightsPercent = 72
    car.brakesTemperature[0] = 512       # RL
    car.brakesTemperature[1] = 498       # RR
    car.brakesTemperature[2] = 380       # FL
    car.brakesTemperature[3] = 365       # FR
    # As temperaturas dos pneus sao uint8, e este e' o teste de que o
    # tipo certo esta' a ser lido: 375 daria 119 truncado se fossem
    # lidas de um sitio deslocado.
    car.tyresSurfaceTemperature[0] = 96  # RL
    car.tyresSurfaceTemperature[1] = 94  # RR
    car.tyresSurfaceTemperature[2] = 88  # FL
    car.tyresSurfaceTemperature[3] = 86  # FR
    car.tyresInnerTemperature[0] = 104
    car.tyresInnerTemperature[1] = 102
    car.tyresInnerTemperature[2] = 95
    car.tyresInnerTemperature[3] = 93
    car.engineTemperature = 104
    # Os quatro valores de cada roda, com valores DIFERENTES em cada
    # canto. E' o que torna o teste capaz: se os quatro fossem iguais,
    # uma ordem errada e' indistinguivel de uma ordem certa, e o teste
    # passaria com o painel ao contrario.
    car.tyresPressure[0] = 28.7          # RL
    car.tyresPressure[1] = 28.9          # RR
    car.tyresPressure[2] = 29.4          # FL
    car.tyresPressure[3] = 29.2          # FR
    car.surfaceType[0] = 1               # berma, na RL
    car.surfaceType[1] = 0               # asfalto, na RR
    car.surfaceType[2] = 0               # asfalto, na FL
    car.surfaceType[3] = 7               # relva, na FR
    st.suggestedGear = 5
    return st


def estado(formato, player=0):
    st = P.construir(formato)[P.PacketId.STATUS]()
    car = st.cars[player]
    car.tractionControl = 2
    car.antiLockBrakes = 1
    car.fuelMix = 2
    car.frontBrakeBias = 58              # PERCENTAGEM
    car.pitLimiterStatus = 0
    car.fuelInTank = 42.5                # QUILOGRAMAS
    car.fuelCapacity = 110.0
    car.fuelRemainingLaps = 4.7
    car.maxRPM = 13000
    car.idleRPM = 3500
    car.maxGears = 8
    car.drsAllowed = 1
    car.drsActivationDistance = 340      # metros que faltam
    car.actualTyreCompound = 20          # C1
    car.visualTyreCompound = 16          # soft
    car.tyresAgeLaps = 6
    car.vehicleFIAFlags = 2              # azul
    car.enginePowerICE = 412000.0        # WATTS
    car.enginePowerMGUK = 120000.0
    car.ersStoreEnergy = 3100000.0       # JOULES
    car.ersDeployMode = 2
    car.ersHarvestedThisLapMGUK = 420000.0
    car.ersHarvestedThisLapMGUH = 180000.0
    if formato == 2026:
        car.ersHarvestLimitPerLap = 4000000.0
    car.ersDeployedThisLap = 950000.0
    return st


def voltas(formato, player=0):
    st = P.construir(formato)[P.PacketId.LAP]()
    v = st.cars[player]
    v.lastLapTimeInMS = 83456           # 1:23.456
    v.currentLapTimeInMS = 42110
    # O sector 2 com 1 minuto e 23 segundos: e' aqui que o truque conta.
    v.sector1TimeMSPart = 23456
    v.sector1TimeMinutesPart = 0
    v.sector2TimeMSPart = 33456
    v.sector2TimeMinutesPart = 1
    v.deltaToCarInFrontMSPart = 1234
    v.deltaToCarInFrontMinutesPart = 0
    v.deltaToRaceLeaderMSPart = 34567
    v.deltaToRaceLeaderMinutesPart = 0
    v.lapDistance = 5300.0              # METROS, de 0 a 5300
    v.totalDistance = 159000.0
    v.carPosition = 3
    v.currentLapNum = 12
    v.pitStatus = 0
    v.numPitStops = 1
    v.sector = 2
    v.currentLapInvalid = 0
    v.penalties = 5
    v.gridPosition = 4
    v.driverStatus = 4
    v.resultStatus = 2
    return st


def campo(alvo, nome, valor):
    """Escreve num campo, e confirma que o campo EXISTE.

    O ctypes deixa fazer `st.trackTemperature = 28` numa struct que tem
    `trackTemp`: cria um atributo novo em Python e nao toca na memoria.
    Nao da erro, nao avisa, e o teste continua a passar com o campo a
    zero. Foi o que aconteceu a primeira vez que este teste correu -- as
    temperaturas da pista e do ar davam 0 e o motivo era uma palavra
    trocada aqui dentro.

    E' a Regra no 14 pelo outro lado: uma propriedade que se escreve
    calada e' uma propriedade que nao existe. Este helper e' a defesa
    contra isso nos testes, porque nos testes nao ha' utilizador para
    estranhar o resultado.
    """
    if not hasattr(alvo, nome):
        raise AssertionError(
            "a struct nao tem o campo %r. O que tem perto: %s"
            % (nome, [f[0] for f in type(alvo)._fields_][:12]))
    setattr(alvo, nome, valor)
    return alvo


def sessao(formato):
    st = P.construir(formato)[P.PacketId.SESSION]()
    campo(st, "weather", 3)                      # chuva fraca
    campo(st, "trackTemp", 28)
    campo(st, "airTemp", 19)
    campo(st, "totalLaps", 53)
    campo(st, "trackLength", 5300)               # METROS
    campo(st, "sessionType", 15)                 # corrida
    campo(st, "trackId", 10)                     # Spa
    campo(st, "formula", 0)                      # F1 Modern
    campo(st, "timeLeft", 1830)
    campo(st, "pitSpeedLimit", 80)
    # Dois campos quase com o mesmo nome: o ESTADO do safety car e a
    # PREFERENCIA do jogador. Ver a nota em protocolo.py.
    campo(st, "safetyCarStatus", 0)
    campo(st, "safetyCar", 2)
    campo(st, "aiDifficulty", 78)
    campo(st, "numWeatherSamples", 2)
    for i, (offset, chuva) in enumerate(((0, 60), (30, 80))):
        amostra = st.weatherSamples[i]
        campo(amostra, "sessionType", 15)
        campo(amostra, "timeOffset", offset)
        campo(amostra, "weather", 3)
        campo(amostra, "rainPct", chuva)
        campo(amostra, "trackTemp", 28)
        campo(amostra, "airTemp", 19)
    if formato == 2026:
        campo(st, "numDRSZones", 2)
        campo(st.drsZones[0], "zoneStart", 0.12)
        campo(st.drsZones[0], "zoneEnd", 0.28)
        campo(st.drsZones[1], "zoneStart", 0.86)
        campo(st.drsZones[1], "zoneEnd", 0.99)
    return st


def dano(formato, player=0):
    st = P.construir(formato)[P.PacketId.DAMAGE]()
    d = st.cars[player]
    d.tyresWear[0] = 97.5       # RL
    d.tyresWear[1] = 97.0       # RR
    d.tyresWear[2] = 99.1       # FL
    d.tyresWear[3] = 98.8       # FR
    d.tyresDamage[0] = 4
    d.tyresDamage[2] = 1
    d.brakesDamage[0] = 12
    d.tyreBlisters[0] = 3
    d.frontLeftWingDamage = 22
    d.rearWingDamage = 7
    d.floorDamage = 3
    d.engineDamage = 5
    d.engineICEWear = 8
    d.engineMGUKWear = 2
    d.drsFault = 0
    return st


def conjuntos(formato):
    st = P.construir(formato)[P.PacketId.PNEUS]()
    st.fittedIdx = 0
    st.sets[0].actualTyreCompound = 20
    st.sets[0].visualTyreCompound = 16
    st.sets[0].wear = 3
    st.sets[0].lifeSpan = 14      # VOLTAS QUE FALTAM
    st.sets[0].usableLife = 22
    st.sets[0].fitted = 1
    return st


def motion(formato, player=0):
    st = P.construir(formato)[P.PacketId.MOTION]()
    v = st.cars[player]
    v.posX = 812.5
    v.posY = 44.25        # ALTITUDE
    v.posZ = -1204.75
    v.velX = 40.0
    if formato == 2026:
        v.gLat = 4210       # 4.21 G, quantizado
        v.gLong = -1870
        v.gVert = 990
    else:
        v.gLat = 4.21
        v.gLong = -1.87
        v.gVert = 0.99
    return st


def motion_ex(player=0):
    st = P.construir(2025)[P.PacketId.MOTION_EX]()
    st.wheelSlipRatio[0] = 0.031     # RL
    st.wheelSlipRatio[2] = 0.008     # FL
    st.wheelSlipAngle[0] = 0.44      # RL
    st.wheelLatForce[2] = 5400.0     # FL
    st.frontWheelsAngle = 0.2137
    st.wheelCamber[0] = -0.031
    st.chassisYaw = 0.012
    return st


def participantes(formato, n=3, restrito=False):
    st = P.construir(formato)[P.PacketId.PARTICIPANTS]()
    st.numActiveCars = n
    for i in range(n):
        nome = ("JOGADOR", "SEGUNDO", "TERCEIRO")[i % 3]
        st.cars[i].name = nome.encode()
        st.cars[i].raceNumber = 16 + i
        st.cars[i].yourTelemetry = 0 if restrito else 1
        st.cars[i].aiControlled = 1 if i else 0
    return st


def de(st):
    """Os bytes do pacote, ja sem o cabecalho (que se poe a parte)."""
    return bytes(memoryview(st).cast("B"))




def leitor_vazio():
    """Um leitor sem socket. `_tratar` e' o mesmo caminho do `_loop`."""
    return Leitor(porta=0)


# =========================================================== 1. OS TAMANHOS
print()
print("1. os tamanhos, nos dois formatos")
for fmt in (2025, 2026):
    st = P.construir(fmt)
    mau = []
    for pid, s in st.items():
        m = c.sizeof(s)
        d = P.tamanho_esperado(pid, fmt)
        if m != d:
            mau.append("%s: %d em vez de %d" % (P.NOMES_PACKET.get(pid, pid), m, d))
    ok(not mau, "formato %d: os %d packets batem com a documentacao %s"
       % (fmt, len(st), mau or ""))
    igual(P.carros(fmt), 22 if fmt == 2025 else 24,
          "formato %d traz %d carros" % (fmt, 22 if fmt == 2025 else 24))
igual(P.PacketId.TELEMETRY2 in P.construir(2025), False,
      "o Car Telemetry 2 NAO existe em 2025")
igual(P.PacketId.TELEMETRY2 in P.construir(2026), True,
      "o Car Telemetry 2 existe em 2026")
ok(c.sizeof(P.Cabecalho) == 29, "o cabecalho tem 29 bytes")

# ==================================================== 2. FORMATO DESCONHECIDO
print()
print("2. um formato que nao sabemos ler")
l = leitor_vazio()
l._tratar(bytes(memoryview(cabecalho(2023, P.PacketId.TELEMETRY)).cast("B")) + b"\x00" * 1300)
igual(l.estado.formato, None, "nao aceitou o formato 2023")
ok(2023 in l.estado.formatos_desconhecidos,
   "guardou o 2023 como formato desconhecido, em vez de adivinhar")
s = l.snapshot()
igual(s["connected"], False, "com um pacote por ler, nao se diz que ha ligacao")
igual(s["packetFormatDesconhecido"], 2023, "e diz QUAL formato nao sabe")
ok(l.vivo() is False, "e nao se diz que o jogo esta' a correr")
try:
    P.construir(2024)
    ok(False, "construir(2024) tinha de falhar")
except ValueError:
    ok(True, "construir(2024) falha em vez de inventar structs")

# ============================================ 3. O CARRO DO JOGADOR
print()
print("3. o carro do jogador, nos dois formatos")
for fmt in (2025, 2026):
    print(" formato %d" % fmt)
    l = leitor_vazio()
    recibo(l, fmt, P.PacketId.TELEMETRY, telemetria(fmt))
    recibo(l, fmt, P.PacketId.STATUS, estado(fmt))
    recibo(l, fmt, P.PacketId.LAP, voltas(fmt))
    recibo(l, fmt, P.PacketId.SESSION, sessao(fmt))
    recibo(l, fmt, P.PacketId.DAMAGE, dano(fmt))
    recibo(l, fmt, P.PacketId.PNEUS, conjuntos(fmt))
    recibo(l, fmt, P.PacketId.MOTION, motion(fmt))
    recibo(l, fmt, P.PacketId.MOTION_EX, motion_ex())
    s = l.snapshot()
    c = s["car"]

    igual(s["connected"], True, "  ha' ligacao")
    igual(s["live"], True, "  e o jogo esta' a correr")
    igual(s["formato"], fmt, "  e sabe o formato")
    igual(s["jogo"], "f125", "  e diz que jogo e'")

    # --- o que o AC nao tem
    igual(c["velocidade"], 287, "  velocidade em km/h")
    igual(c["rpm"], 11450, "  rpm")
    igual(c["maxRpm"], 13000, "  o limitador")
    igual(c["caixa"], "4", "  a caixa")
    igual(c["luzes"], 72, "  as luzes de rotacao, em percentagem")
    igual(c["caixaSugerida"], 5, "  a caixa sugerida")
    igual(c["tempMotor"], 104, "  a temperatura do motor")

    # --- A ORDEM DAS RODAS. O jogo da' RL, RR, FL, FR; o painel quer
    # FL, FR, RL, RR. E' o teste mais importante deste ficheiro, porque
    # as duas ordens desenham uma grelha quase simetrica e um painel ao
    # contrario nao da erro nenhum.
    igual(c["tempTravões"], [380, 365, 512, 498],
          "  temp dos travoes em FL,FR,RL,RR (o jogo mandou RL,RR,FL,FR)")
    igual(c["tempPneuSuperficie"], [88, 86, 96, 94],
          "  temp de superficie do pneu na ordem do painel")
    igual(c["tempPneuInterior"], [95, 93, 104, 102],
          "  temp interior do pneu na ordem do painel")
    igual(c["pressaoPneu"], [29.4, 29.2, 28.7, 28.9],
          "  pressao em psi, na ordem do painel")
    igual(c["superficieRoda"], [0, 7, 1, 0],
          "  a superficie de cada roda: asfalto na FL, relva na FR, berma na RL")
    igual(c["superficieNomes"], ["Asfalto", "Relva", "Berma", "Asfalto"],
          "  e o nome de cada uma, tambem na ordem do painel")

    # --- o pedal da embraiagem, que no AC e' 0.0 a 1.0 e aqui e' 0 a 100
    igual(c["embraiagem"], 100, "  a embraiagem vem 0 a 100, nao 0.0 a 1.0")

    # --- o volante, que vem JA normalizado
    igual(c["volante"], -0.42, "  o volante vem normalizado, -1 a 1")

    # --- DRS: o F1 25 da' a zona a serio
    igual(c["drsAvailable"], 1, "  a zona de DRS existe")
    igual(c["drsDistancia"], 340, "  e faltam 340 m")
    igual(c["drs"], 1, "  e o DRS esta' ligado")

    # --- as unidades que NAO sao as do AC
    igual(c["combustivelKg"], 42.5, "  o combustivel em quilos")
    igual(c["biasTrava"], 58, "  o bias de trava em percentagem (0 a 100)")
    igual(c["ersStoreJ"], 3100000.0, "  o ERS em joules")
    igual(c["potenciaIceW"], 412000.0, "  a potencia do ICE em watts")

    # --- o ABS e' ON/OFF, e nao uma percentagem
    igual(c["abs"], 1, "  o ABS e' um 0 ou 1")
    igual(c["tc"], 2, "  o TC e' um modo (0 off, 1 medio, 2 cheio)")

    # --- o compound
    igual(c["compoundId"], 20, "  o id do composto")
    igual(c["compoundVisualId"], 16, "  e o visual, que e' diferente")

    # --- ERS
    igual(c["ersDeployNome"], "Hotlap", "  o modo de ERS")
    igual(c["ersUsadoJ"], 950000.0, "  o ERS usado na volta")
    igual(c["ersColhidoMJ"], 420000.0, "  o ERS colhido pelo MGU-K")

    # --- a volta
    laps = s["laps"]
    igual(laps["atual"], "0:42.110", "  o tempo da volta")
    igual(laps["anterior"], "1:23.456", "  a volta anterior")
    igual(laps["sector1"], "0:23.456", "  o sector 1")
    igual(laps["sector2"], "1:33.456",
          "  o sector 2 SOMA os minutos: 1 min + 33456 ms")
    igual(laps["sector3"], None,
          "  o sector 3 e' None, nao 0: o jogo nao o manda nesta packet")
    igual(laps["posicao"], 3, "  a posicao")
    igual(laps["volta"], 12, "  o numero da volta")
    igual(laps["setor"], 2, "  o sector")
    igual(laps["deltaLider"], 34567, "  o delta para o lider, em ms")
    igual(laps["distanciaVolta"], 5300.0, "  a distancia na volta, em metros")
    igual(laps["percentagem"], 1.0,
          "  a percentagem da pista: 5300 m de uma pista de 5300 m")

    # --- o mundo
    f = s["fisica"]
    igual(f["x"], 812.5, "  a posicao X")
    igual(f["y"], 44.25, "  a ALTITUDE (o Y nao e' o plano da pista)")
    igual(f["z"], -1204.75, "  a posicao Z")
    if fmt == 2026:
        igual(f["gLateral"], 4.21,
              "  a forca lateral de 2026 e' int16 QUANTIZADA: 4210 / 1000")
        igual(f["gLongitudinal"], -1.87, "  e a longitudinal tambem")
    else:
        igual(f["gLateral"], 4.21, "  a forca lateral de 2025 e' float")
    igual(f["escorregamentoRatio"], [0.008, 0.0, 0.031, 0.0],
          "  o escorregamento em ratio, na ordem do painel")
    igual(f["escorregamentoAngulo"], [0.0, 0.0, 0.44, 0.0],
          "  o escorregamento em angulo, na ordem do painel")
    igual(f["anguloRoda"], 0.2137, "  o angulo da roda da frente, em radianos")

    # --- os pneus
    p = s["pneus"]
    igual(p["desgaste"], [99.1, 98.8, 97.5, 97.0],
          "  o desgaste, na ordem do painel, 0 a 100 com 100 = novo")
    igual(p["vida"], 14, "  AS VOLTAS QUE FALTAM: o numero que o AC nao tem")
    igual(p["vidaMax"], 22, "  e o maximo recomendado para o composto")
    igual(p["bolhas"], [0, 0, 3, 0],
          "  as bolhas: 3 na RL, que no painel e' o indice 2")
    igual(p["wingEsquerda"], 22, "  a asa da frente esquerda")
    igual(p["componentes"]["ICE"], 8, "  o desgaste do ICE")

    # --- a sessao
    t = s["track"]
    igual(t["pista"], "Spa", "  o nome da pista, pela tabela de ids")
    igual(t["comprimento"], 5300, "  o comprimento, em metros")
    igual(t["sessao"], "Corrida", "  o tipo de sessao")
    igual(t["weatherNome"], "Chuva fraca", "  o estado do tempo")
    igual(t["pistaTemp"], 28, "  a temperatura da pista")
    igual(t["arTemp"], 19, "  a temperatura do ar")
    igual(t["safetyCarNome"], "Nenhum", "  o safety car")
    igual(t["previsao"][0]["chuva"], 60,
          "  a previsao de chuva, que o AC nao tem")
    igual(t["zonasDrs"], [[0.12, 0.28], [0.86, 0.99]] if fmt == 2026 else [],
          "  as zonas de DRS, so no formato 2026")

# ============================================ 4. A CLASSIFICACAO
print()
print("4. a classificacao")
l = leitor_vazio()
recibo(l, 2025, P.PacketId.PARTICIPANTS, participantes(2025, 3))
recibo(l, 2025, P.PacketId.LAP, voltas(2025))
recibo(l, 2025, P.PacketId.TELEMETRY, telemetria(2025))
recibo(l, 2025, P.PacketId.STATUS, estado(2025))
o = l.opponents()
igual(o["available"], True, "  ha' adversarios")
igual(o["count"], 1, "  mas so 1: o jogo so preencheu o primeiro carro")
igual(o["cars"][0]["nome"], "JOGADOR", "  e o nome vem dos participantes")
igual(o["focus"], 0, "  o foco e' o carro do jogador")

# Com tres carros preenchidos, e o jogador no indice 2
l = leitor_vazio()
par = participantes(2025, 3)
lv = P.construir(2025)[P.PacketId.LAP]()
for i in range(3):
    lv.cars[i].resultStatus = 2
    lv.cars[i].carPosition = 3 - i
    lv.cars[i].currentLapTimeInMS = 10000 * (i + 1)
par.cars[2].name = b"EU"
recibo(l, 2025, P.PacketId.PARTICIPANTS, par)
recibo(l, 2025, P.PacketId.LAP, lv, player=2)
o = l.opponents()
igual(o["count"], 3, "  com tres carros a correr, saem tres")
igual([c["pos"] for c in o["cars"]], [1, 2, 3], "  e por ordem de posicao")
igual(o["focus"], 2, "  o foco e' o indice 2")
# O nosso carro e' o indice 2 da lista ORIGINAL, e estava em P1, portanto
# depois de ordenar fica em primeiro. E' o `nosso` que diz qual e' qual --
# comparar com a posicao seria comparar com uma coisa que muda.
igual(o["cars"][0]["nome"], "EU",
      "  o nosso carro e' o primeiro depois de ordenar, porque estava em P1")
igual(o["cars"][0]["nosso"], True, "  e vem marcado com `nosso`")
igual(o["cars"][2]["nosso"], False, "  e os outros nao")

# Um carro INACTIVO tem de desaparecer. E' o m_resultStatus e nao o
# m_numActiveCars que decide: um carro com 1 tem zeros em tudo, e um zero
# e' plausivel.
l = leitor_vazio()
par = participantes(2025, 3)
lv = P.construir(2025)[P.PacketId.LAP]()
lv.cars[0].resultStatus = 2
lv.cars[1].resultStatus = 1        # inactivo
lv.cars[2].resultStatus = 0        # invalido
recibo(l, 2025, P.PacketId.PARTICIPANTS, par)
recibo(l, 2025, P.PacketId.LAP, lv)
igual(l.opponents()["count"], 1,
      "os carros inactivos e invalidos NAO entram na lista")

# ============================================ 5. A TELEMETRIA RESTRITA
print()
print("5. a telemetria restrita")
l = leitor_vazio()
recibo(l, 2025, P.PacketId.PARTICIPANTS, participantes(2025, 2, restrito=True))
lv = P.construir(2025)[P.PacketId.LAP]()
for i in range(2):
    lv.cars[i].resultStatus = 2
recibo(l, 2025, P.PacketId.LAP, lv)
o = l.opponents()
igual(o["restrito"], True, "  o receptor diz que a telemetria esta' restrita")
igual(o["cars"][0]["dadosEscondidos"], True,
      "  e o painel pode dizer que os zeros nao sao do jogo")
igual(o["cars"][0]["melhor"], None,
      "  e a melhor volta e' None, nao 0: 0 s seria 'fiz 0.000'")

# ============================================ 6. O JOGO PARADO
print()
print("6. o jogo parado, a pausa e o formato a mudar")
l = leitor_vazio()
recibo(l, 2025, P.PacketId.TELEMETRY, telemetria(2025))
igual(l.snapshot()["live"], True, "com pacotes a chegar, esta' a correr")

# Congelar o relogio e recontar: e' a forma de simular o jogo parado sem
# esperar dois segundos a cada teste.
import time as _time
_real = _time.time
l.estado.recebido_em = _real() - 5.0
igual(l.snapshot()["live"], False, "passados 5 s, ja nao esta' a correr")
igual(l.snapshot()["estadoJogo"], "em_pausa",
      "e a 5 s isso e' uma pausa, nao o fim da sessao")
l.estado.recebido_em = _real() - 200.0
igual(l.snapshot()["estadoJogo"], "encerrado",
      "e a 200 s e' o fim da sessao")

# O formato pode mudar com o jogo a correr.
l = leitor_vazio()
recibo(l, 2025, P.PacketId.TELEMETRY, telemetria(2025))
igual(l.snapshot()["formato"], 2025, "comeca em 2025")
recibo(l, 2026, P.PacketId.TELEMETRY, telemetria(2026))
igual(l.snapshot()["formato"], 2026, "e passou a 2026 sem reiniciar")
igual(l.snapshot()["car"]["velocidade"], 287,
      "e continua a ler o carro certo depois da troca")

# ============================================ 7. A CORRUPCAO
print()
print("7. um datagrama estragado")
l = leitor_vazio()
recibo(l, 2025, P.PacketId.TELEMETRY, telemetria(2025))
antes = l.snapshot()["car"]["velocidade"]
l._tratar(b"\x00" * 10)                       # mais curto que o cabecalho
l._tratar(bytes(memoryview(cabecalho(2025, P.PacketId.TELEMETRY)).cast("B"))
          + b"\x00" * 40)                     # mais curto que a struct
l._tratar(bytes(memoryview(cabecalho(2025, 99)).cast("B")) + b"\x00" * 100)
ok(l.estado.invalidos >= 3, "os tres foram contados como invalidos (%d)"
   % l.estado.invalidos)
igual(l.snapshot()["car"]["velocidade"], antes,
      "e o ultimo bom estado continua intacto")
igual(l.vivo(), True, "e o receptor nao morreu")

# ============================================ 8. A LOGICA
print()
print("8. a logica, que e' onde as unidades sao decididas")
from actelemetry.jogos.f125 import logica as L

# O truque dos tempos: um uint16 nao chega para 5 minutos de volta.
igual(L.tempo_de_minutos(1, 33456), 93456, "1 min + 33456 ms = 93456 ms")
igual(L.tempo_de_minutes if False else L.tempo_de_minutos(5, 1200), 301200,
      "5 min + 1200 ms = 301200 ms")
igual(L.tempo_de_minutos(0, 0), 0, "zero")

# A percentagem da pista tem de recusar o que esta' fora de [0, 1], porque
# o m_lapDistance e' NEGATIVO antes da linha de chegada.
igual(L.percentagem_pista(2650, 5300), 0.5, "metade da pista")
igual(L.percentagem_pista(-120, 5300), None,
      "antes da linha o valor e' NEGATIVO, e a percentagem e' None")
igual(L.percentagem_pista(6000, 5300), None, "alem do fim tambem")
igual(L.percentagem_pista(100, 0), None, "sem comprimento nao ha percentagem")

# O composto. A tabela tem tres colunas, conforme a formula, e o VISUAL
# e' diferente do ACTUAL: mostrar o visual seria mentir sobre o que esta'
# no carro.
igual(L.composto(20, 0), "C1", "C1 em F1 Modern")
igual(L.composto(16, 0), "C5", "16 e' C5")
igual(L.composto(20, 0, visual=True), None,
      "20 nao existe na tabela VISUAL, e None e' melhor que um nome errado")
igual(L.composto(16, 0, visual=True), "Soft", "16 e' soft no visual")
igual(L.composto(9, 1), "Dry", "9 e' dry em F1 Classic")
igual(L.composto(11, 2), "Super soft", "11 e' super soft em F2")
igual(L.composto(99, 0), None, "um id que nao existe da' None")

# A caixa
igual(L.caixa(0), "N", "0 e' ponto morto")
igual(L.caixa(-1), "R", "-1 e' re")
igual(L.caixa(8), "8", "8 e' a oitava")

# O modo de ERS muda de nome entre os formatos, no mesmo numero.
igual(L.modo_ers(3, 2025), "Overtake", "o 3 em 2025 e' overtake")
igual(L.modo_ers(3, 2026), "Boost", "o 3 em 2026 e' boost")
igual(L.modo_ers(1, 2025), "Medium", "o 1 e' medium nos dois")

# A percentagem do ERS, que o AC calcula e aqui nao: o maximo nao e'
# publicado, e inventar um 4 MJ fixo seria um numero que o jogo nao da.
igual(L.ers_percentagem(2000000, 4000000), 50.0, "metade, com o maximo dado")
igual(L.ers_percentagem(2000000, 0), None, "sem maximo, None e nao 100%")
igual(L.ers_percentagem(2000000, None), None, "sem maximo, tambem None")

# ============================================ 9. AS CAPACIDADES
print()
print("9. as capacidades")
caps = L.capacidades()
ok(caps["vidaPneu"] == "on", "o F1 25 da' a vida do pneu")
ok(caps["travãoDeMão"] == "off", "o travão de mao nao existe em nenhum dos dois")
ok(caps["nivelAbs"] == "off", "o F1 25 nao da uma percentagem de ABS")
ok(caps["tempo"] == "on", "o F1 25 publica o tempo")
ok(caps["zonasDrs"] == "on", "o F1 25 da as zonas de DRS")
from actelemetry.jogos.ac.logica import capacidades as _caps_ac
caps_ac = _caps_ac()
ok(caps_ac["vidaPneu"] == "auto", "no AC a vida do pneu e' estimada")
ok(caps_ac["nivelAbs"] == "on", "no AC o ABS e' um nivel de 0 a 1")
ok(caps_ac["estadoTempo"] == "off", "o AC nao publica o estado do tempo")

# A lista canonica e' o contrato entre o servidor e o frontend, e os DOIS
# jogos tem de a preencher toda. A primeira versao nao preenchia, e o
# teste apanhou: o AC tinha 22 chaves que o F1 25 nao tinha. Um cartao
# que o painel escondia num jogo e mostrava no outro, sem regra que o
# explicasse.
from actelemetry.jogos import base
for nome, c in (("f125", caps), ("ac", caps_ac)):
    r = base.conferir(c, nome)
    ok(not r["falta"], "%s preenche as %d capacidades (faltam %s)"
       % (nome, len(base.CAPACIDADES), r["falta"] or "nenhuma"))
    ok(not r["sobra"], "%s nao tem chaves a mais (%s)" % (nome, r["sobra"] or "nenhuma"))
    ok(not r["valoresRuins"], "%s so usa on/off/auto (%s)"
       % (nome, r["valoresRuins"] or "sim"))

os_comuns = (set(caps) & set(caps_ac)) - set(base.METADADOS)
diferentes = {k: (caps[k], caps_ac[k]) for k in os_comuns
              if caps[k] != caps_ac[k]}
ok(len(diferentes) >= 30,
   "e %d capacidades diferem entre os dois, o que e' o ponto de ter dois"
   " modulos" % len(diferentes))

# ============================================ 10. O TRACO FINAL
print()
if FALHAS:
    print("%d FALHA(S):" % len(FALHAS))
    for f in FALHAS:
        print("  - %s" % f)
    sys.exit(1)
print("ok: o F1 25 le-se nos dois formatos, e as regras estao no codigo.")
