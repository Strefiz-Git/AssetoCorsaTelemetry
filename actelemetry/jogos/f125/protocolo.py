"""
As structs do F1 25, nos dois formatos, e as tabelas da EA.

Este ficheiro e' a traducao literal de
    resources/docs/f125/F1 25 Telemetry Output Structures.txt
e
    resources/docs/f125/2026 Season Pack Telemetry Output Structures (1).txt

Ver docs/f1-25.md, que explica os dois formatos e porque e' que nao se
pode ler os dois com a mesma struct.

O QUE ESTE FICHEIRO NAO FAZ
---------------------------
Nao abre socket, nao le bytes, nao junta frames. Isso e' do receptor.py.
Aqui so' ha structs e tabelas, para que o receptor seja legivel e para
que o teste de tamanhos tenha o que medir.

A REGRA DOS 36 BYTES, DE NOVO
-----------------------------
A EA mudou QUATRO tipos a meio da vida do jogo, quando saiu o Season Pack
2026. Cada mudanca muda o tamanho do bloco de um carro, e portanto
desloca todos os carros seguintes. E' a mesma armadilha dos 9 campos
comentados do Assetto Corsa (AGENTS.md Regra no 3), com a diferenca de
que aqui a mudanca e' OFICIAL e por isso mesmo e' mais facil de cair:
le-se o ficheiro novo, ve-se que tem 24 carros, e Assume-se que a
diferenca e' so' o numero.

Por isso `FORMATO` decide TUDO: o numero de carros, os tipos dos ids, a
temperatura do motor, e se as forcas G sao float ou int16. Nao ha' um
campo que se possa ler sem escolher o formato primeiro.
"""

import ctypes as c

# ------------------------------------------------------------- os tipos base
u8, i8, u16, i16, u32, i32, u64, f32, f64 = (
    c.c_uint8, c.c_int8, c.c_uint16, c.c_int16,
    c.c_uint32, c.c_int32, c.c_uint64, c.c_float, c.c_double)

# O F1 25 e' "packed", sem padding nenhum. Esta e' a palavra que faz a
# diferenca: sem ela o ctypes mete alinhamento e TODOS os offsets a partir
# do primeiro array ficam errados, e o primeiro que se lê e' o array de
#rodas do primeiro carro, que e' o que o painel mostra em grande.
_PACK = 1

FORMATOS = (2025, 2026)


def _s(*fields):
    """Cria uma struct packed. fields: (nome, tipo) ou (nome, tipo, n)."""
    fs = []
    for f in fields:
        nome, tipo = f[0], f[1]
        n = f[2] if len(f) > 2 else 0
        fs.append((nome, tipo * n if n else tipo))
    return type("X", (c.Structure,), {"_pack_": _PACK, "_fields_": fs})


# ------------------------------------------------------------------ cabecalho
# Os 29 bytes sao IGUAIS nos dois formatos, e sao o unico pacote que se
# pode ler para decidir qual dos dois esta' a correr. Por isso o receptor
# le-o sempre primeiro, e so' depois escolhe a tabela.
Cabecalho = _s(
    ("packetFormat", u16),     # 2025 ou 2026. E' POR AQUI que se decide.
    ("gameYear", u8),           # 25, mesmo com o Season Pack 2026
    ("gameMajorVersion", u8),
    ("gameMinorVersion", u8),
    ("packetVersion", u8),      # versao DESTE packet
    ("packetId", u8),           # ver PacketId
    ("sessionUID", u64),
    ("sessionTime", f32),       # segundos desde o inicio da sessao
    ("frameIdentifier", u32),
    ("overallFrameIdentifier", u32),
    ("playerCarIndex", u8),     # qual dos carros e' o nosso
    ("secondaryPlayerCarIndex", u8),
)

# ------------------------------------------------------------------ packet ids
class PacketId:
    MOTION = 0
    SESSION = 1
    LAP = 2
    EVENT = 3
    PARTICIPANTS = 4
    SETUPS = 5
    TELEMETRY = 6
    STATUS = 7
    CLASSIFICATION = 8
    LOBBY = 9
    DAMAGE = 10
    HISTORIA = 11
    PNEUS = 12          # Tyre Sets: o unico com a vida do pneu
    MOTION_EX = 13
    TIME_TRIAL = 14
    POSICOES = 15
    TELEMETRY2 = 16     # so' em 2026


NOMES_PACKET = {
    0: "Motion", 1: "Session", 2: "Lap Data", 3: "Event",
    4: "Participants", 5: "Car Setups", 6: "Car Telemetry",
    7: "Car Status", 8: "Final Classification", 9: "Lobby Info",
    10: "Car Damage", 11: "Session History", 12: "Tyre Sets",
    13: "Motion Ex", 14: "Time Trial", 15: "Lap Positions",
    16: "Car Telemetry 2",
}

# ------------------------------------------------------------------ constantes
# O jogo diz no array de 4 rodas: 0 = RL, 1 = RR, 2 = FL, 3 = FR.
#
# A ordem interna do painel e' [FL, FR, RL, RR], que e' a do Assetto
# Corsa. Traduzir de uma para a outra e' FEITO UMA VEZ, no
# receptor.py, e nunca dentro da logica de desenho. Ver a Regra no 22 do
# docs/f1-25.md: as duas ordens desenham uma grelha quase simetrica, e
# um painel ao contrario nao da erro nenhum.
ORDEM_F1 = ("RL", "RR", "FL", "FR")
ORDEM_PAINEL = ("FL", "FR", "RL", "RR")
TRADUCAO = {0: 2, 1: 3, 2: 0, 3: 1}     # indice F1 -> indice do painel

TEMPO_ANTIGO_1S = 2.0     # um pacote que se consideraria parado
POR_ACAO_LENTO = 2.0      # depois disto o painel diz EM PAUSA

# Os ids que o painel precisa. Nem todos os pacotes se usam: Session
# History, Final Classification, Lap Positions, Time Trial e Lobby sao
# para o fim da sessao e para o lobby, e ficam de fora de proposito.
# O que o painel usa e' o que muda a cada frame ou a 2 Hz.
PACOTES_USADOS = (
    PacketId.MOTION, PacketId.SESSION, PacketId.LAP, PacketId.EVENT,
    PacketId.PARTICIPANTS, PacketId.TELEMETRY, PacketId.STATUS,
    PacketId.DAMAGE, PacketId.PNEUS, PacketId.MOTION_EX, PacketId.SETUPS,
)


# --------------------------------------------------- tabelas da EA (anexos)
# Todas copiadas dos anexos do "Data Output from F1 25 v3.pdf" e do
# documento do Season Pack 2026. Ver docs/f1-25.md seccao 11.
#
# A tabela de pistas e' SPARSE: o id 1 nao existe. Nao e' que falte um
# valor -- simplesmente nao ha' pista com id 1. Um id que nao esteja aqui
# e' pista desconhecida, e o painel escreve o numero em vez de um nome
# inventado. Ver o mesmo ponto no AC, onde o nome da pista vem em texto.
PISTAS = {
    0: "Melbourne", 2: "Shanghai", 3: "Sakhir (Bahrain)", 4: "Catalunya",
    5: "Monaco", 6: "Montreal", 7: "Silverstone", 9: "Hungaroring",
    10: "Spa", 11: "Monza", 12: "Singapore", 13: "Suzuka", 14: "Abu Dhabi",
    15: "Texas", 16: "Brazil", 17: "Austria", 19: "Mexico",
    20: "Baku (Azerbaijan)", 26: "Zandvoort", 27: "Imola", 29: "Jeddah",
    30: "Miami", 31: "Las Vegas", 32: "Losail",
    39: "Silverstone (Reverse)", 40: "Austria (Reverse)",
    41: "Zandvoort (Reverse)", 42: "Madrid",
}

SESSOES = {
    0: "Desconhecida", 1: "Treino 1", 2: "Treino 2", 3: "Treino 3",
    4: "Treino curto", 5: "Qualificacao 1", 6: "Qualificacao 2",
    7: "Qualificacao 3", 8: "Qualificacao curta",
    9: "Qualificacao unica", 10: "Sprint Shootout 1",
    11: "Sprint Shootout 2", 12: "Sprint Shootout 3",
    13: "Sprint Shootout curto", 14: "Sprint Shootout unica",
    15: "Corrida", 16: "Corrida 2", 17: "Corrida 3", 18: "Time Trial",
}

# O estado do piloto. O 4 e' o unico que significa "a conduzir", e e' o
# que o painel usa para saber se ha' algo para mostrar.
PILOTO = {0: "Na garagem", 1: "Volta de lancamento", 2: "Em volta",
          3: "Volta de saida", 4: "Em pista"}

# O estado do resultado. SO' o 2 e o 3 tem dados validos: e' este campo,
# e nao o m_numActiveCars, que decide se um carro entra na classificacao.
# Um carro com 1 (inactivo) no inicio da sessao tem zeros em tudo, e um
# zero e' plausivel -- ver a Regra no 19.
RESULTADO = {0: "Invalido", 1: "Inactivo", 2: "A correr", 3: "Terminou",
             4: "Nao terminou", 5: "Desqualificado",
             6: "Nao classificado", 7: "Reformou"}

# Superficie do que a roda esta' a tocar. Isto e' MELHOR do que o
# surfaceGrip do AC: a aderencia e' uma estimativa, e aqui o jogo diz o
# que a roda tocou. O 8 e' agua, e um F1 na agua e' um safety car.
SUPERFICIES = {0: "Asfalto", 1: "Berma", 2: "Betão", 3: "Rocha",
               4: "Gravilha", 5: "Lama", 6: "Areia", 7: "Relva",
               8: "Agua", 9: "Calçada", 10: "Metal", 11: "Ondulado"}

# O tempo, como o jogo o escreve: 0 limpo, 1 nuvem baixa, 2 encoberto,
# 3 chuva fraca, 4 chuva forte, 5 trovoada. Sao SEIS estados, e o AC nao
# tem nenhum (docs/f1-25.md secao 8).
TEMPOS = {0: "Limpo", 1: "Nuvem baixa", 2: "Encoberto", 3: "Chuva fraca",
          4: "Chuva forte", 5: "Trovoada"}

SAFETY_CAR = {0: "Nenhum", 1: "Safety car", 2: "Virtual safety car",
              3: "Safety car de formacao"}

FIA = {-1: "Desconhecida", 0: "Nenhuma", 1: "Verde", 2: "Azul", 3: "Amarela"}

COMBUSTIVEL = {0: "Magro", 1: "Normal", 2: "Rico", 3: "Maximo"}

# O modo de ERS. O 3 e' "overtake" em 2025 e "boost" em 2026, e a
# documentacao do 2026 muda o comentario sem mudar o numero. Por isso o
# receptor passa o formato para a funcao que escreve o nome.
ERS_MODO = {0: "Nenhum", 1: "Medium", 2: "Hotlap", 3: "Overtake"}
# Em 2026 o 3 passou a significar "boost", e a EA mudou o comentario sem
# mudar o numero. Sem o formato, o painel dizia "Overtake" a quem
# conduz um F1 26 com o boost ligado.
ERS_MODO_2026 = dict(ERS_MODO)
ERS_MODO_2026[3] = "Boost"

FORMULAS = {0: "F1 Modern", 1: "F1 Classic", 2: "F2", 3: "F1 Generic",
            4: "Beta", 6: "Esports", 8: "F1 World", 9: "F1 Elimination",
            13: "F1 26"}

# ------------------------------------------------------------------ os packets
# Cada bloco de "um carro" e'construido dentro de `construir`, porque
# depende do formato. O que NAO depende do formato e' escrito aqui uma
# vez so, e e' a maioria.

_MARSHAL = _s(("zoneStart", f32), ("zoneFlag", i8))
_AERO = _s(("zoneStart", f32), ("zoneEnd", f32))
_WX = _s(("sessionType", u8), ("timeOffset", u8), ("weather", u8),
         ("trackTemp", i8), ("trackTempChange", i8), ("airTemp", i8),
         ("airTempChange", i8), ("rainPct", u8))

# O bloco da sessao, igual nos dois formatos ate m_sector3LapDistanceStart.
# O 2026 acrescenta as zonas de aero e DRS, e mais um rabo de assistencias.
_SESSAO_COMUM = [
    ("weather", u8), ("trackTemp", i8), ("airTemp", i8), ("totalLaps", u8),
    ("trackLength", u16), ("sessionType", u8), ("trackId", i8),
    ("formula", u8), ("timeLeft", u16), ("duration", u16),
    ("pitSpeedLimit", u8), ("paused", u8), ("spectating", u8),
    ("spectatorCarIndex", u8), ("sliPro", u8), ("numMarshalZones", u8),
    ("marshalZones", _MARSHAL, 21),
    # O nome e' m_safetyCarStatus na documentacao, e o m_safetyCar de
    # mais abaixo e' OUTRO campo -- a preferencia de segurar o safety car.
    # Nomear os dois safetyCar e' um erro que o ctypes NAO apanha: a
    # struct fica do tamanho certo, o primeiro campo mantem o nome, e o
    # segundo fica com o offset certo e sem nome nenhum. O sintoma e'
    # silencioso -- a preferencia nunca aparece -- e por isso o
    # 	est_f125_parser.py conta os nomes repetidos. Ver a Regra no 6.
    ("safetyCarStatus", u8), ("networkGame", u8),
    ("numWeatherSamples", u8), ("weatherSamples", _WX, 64),
    ("forecastAccuracy", u8), ("aiDifficulty", u8),
    ("seasonLinkId", u32), ("weekendLinkId", u32), ("sessionLinkId", u32),
    ("pitStopWindowIdealLap", u8), ("pitStopWindowLatestLap", u8),
    ("pitStopRejoinPosition", u8), ("steeringAssist", u8),
    ("brakingAssist", u8), ("gearboxAssist", u8), ("pitAssist", u8),
    ("pitReleaseAssist", u8), ("ersAssist", u8), ("drsAssist", u8),
    ("dynamicRacingLine", u8), ("dynamicRacingLineType", u8),
    ("gameMode", u8), ("ruleSet", u8), ("timeOfDay", u32),
    ("sessionLength", u8), ("speedUnitsPlayer", u8),
    ("temperatureUnitsPlayer", u8), ("speedUnitsPlayer2", u8),
    ("temperatureUnitsPlayer2", u8), ("numSafetyCarPeriods", u8),
    ("numVirtualSafetyCarPeriods", u8), ("numRedFlagPeriods", u8),
    ("equalCarPerformance", u8), ("recoveryMode", u8), ("flashbackLimit", u8),
    ("surfaceType", u8), ("lowFuelMode", u8), ("raceStarts", u8),
    ("tyreTemperature", u8), ("pitLaneTyreSim", u8), ("carDamage", u8),
    ("carDamageRate", u8), ("collisions", u8),
    ("collisionsOffForFirstLapOnly", u8), ("mpUnsafePitRelease", u8),
    ("mpOffForGriefing", u8), ("cornerCuttingStringency", u8),
    ("parcFermeRules", u8), ("pitStopExperience", u8),
    ("safetyCar", u8),          # a PREFERENCIA do jogador, nao o estado
    ("safetyCarExperience", u8), ("formationLap", u8),
    ("formationLapExperience", u8), ("redFlags", u8),
    ("affectsLicenceLevelSolo", u8), ("affectsLicenceLevelMP", u8),
    ("numSessionsInWeekend", u8), ("weekendStructure", u8, 12),
    ("sector2LapDistanceStart", f32), ("sector3LapDistanceStart", f32),
]
_SESSAO_2026 = [
    ("activeAeroTrackStatus", u8), ("numActiveAeroZonesFull", u8),
    ("activeAeroZonesFull", _AERO, 8), ("numActiveAeroZonesPartial", u8),
    ("activeAeroZonesPartial", _AERO, 8), ("numDRSZones", u8),
    ("drsZones", _AERO, 4), ("startReactionTime", f32),
    ("antiLockBrakesAssist", u8), ("tractionControlAssist", u8),
    ("dynamicRacingLineHiVis", u8), ("dynamicRacingLineColourBlind", u8),
    ("recurringRewindPrompt", u8),
]

# O bloco de volta e' IDENTICO nos dois formatos, 57 bytes. Confirmed
# pela medicao: e' um dos poucos que a EA nao tocou.
LAP = _s(
    ("lastLapTimeInMS", u32), ("currentLapTimeInMS", u32),
    # O truque: os milissegundos num uint16 e os MINUTOS num uint8
    # separado. O valor e' minutos * 60000 + a parte. Um uint16 nao
    # chega para 5 minutos de volta, e o jogo nao quis mandar float.
    ("sector1TimeMSPart", u16), ("sector1TimeMinutesPart", u8),
    ("sector2TimeMSPart", u16), ("sector2TimeMinutesPart", u8),
    ("deltaToCarInFrontMSPart", u16), ("deltaToCarInFrontMinutesPart", u8),
    ("deltaToRaceLeaderMSPart", u16), ("deltaToRaceLeaderMinutesPart", u8),
    ("lapDistance", f32),          # METROS nesta volta. Negativo antes da linha.
    ("totalDistance", f32), ("safetyCarDelta", f32),
    ("carPosition", u8),           # 1 = primeiro
    ("currentLapNum", u8), ("pitStatus", u8), ("numPitStops", u8),
    ("sector", u8), ("currentLapInvalid", u8), ("penalties", u8),
    ("totalWarnings", u8), ("cornerCuttingWarnings", u8),
    ("numUnservedDriveThroughPens", u8), ("numUnservedStopGoPens", u8),
    ("gridPosition", u8), ("driverStatus", u8), ("resultStatus", u8),
    ("pitLaneTimerActive", u8), ("pitLaneTimeInLaneInMS", u16),
    ("pitStopTimerInMS", u16), ("pitStopShouldServePen", u8),
    ("speedTrapFastestSpeed", f32), ("speedTrapFastestLap", u8),
)

EVENT = _s(("header", Cabecalho), ("code", u8, 4), ("details", u8, 12))

SETUP = _s(
    ("frontWing", u8), ("rearWing", u8), ("onThrottle", u8), ("offThrottle", u8),
    ("frontCamber", f32), ("rearCamber", f32), ("frontToe", f32),
    ("rearToe", f32), ("frontSuspension", u8), ("rearSuspension", u8),
    ("frontAntiRollBar", u8), ("rearAntiRollBar", u8),
    ("frontSuspensionHeight", u8), ("rearSuspensionHeight", u8),
    ("brakePressure", u8), ("brakeBias", u8), ("engineBraking", u8),
    ("rearLeftTyrePressure", f32), ("rearRightTyrePressure", f32),
    ("frontLeftTyrePressure", f32), ("frontRightTyrePressure", f32),
    ("ballast", u8), ("fuelLoad", f32),
)

DANO = _s(
    ("tyresWear", f32, 4), ("tyresDamage", u8, 4), ("brakesDamage", u8, 4),
    ("tyreBlisters", u8, 4),
    ("frontLeftWingDamage", u8), ("frontRightWingDamage", u8),
    ("rearWingDamage", u8), ("floorDamage", u8), ("diffuserDamage", u8),
    ("sidepodDamage", u8), ("drsFault", u8), ("ersFault", u8),
    ("gearBoxDamage", u8), ("engineDamage", u8),
    ("engineMGUHWear", u8), ("engineESWear", u8), ("engineCEWear", u8),
    ("engineICEWear", u8), ("engineMGUKWear", u8), ("engineTCWear", u8),
    ("engineBlown", u8), ("engineSeized", u8),
)

_HISTORIA_VOLTA = _s(
    ("lapTimeInMS", u32),
    ("sector1TimeMSPart", u16), ("sector1TimeMinutesPart", u8),
    ("sector2TimeMSPart", u16), ("sector2TimeMinutesPart", u8),
    ("sector3TimeMSPart", u16), ("sector3TimeMinutesPart", u8),
    ("lapValidBitFlags", u8),
)
_HISTORIA_STINT = _s(("endLap", u8), ("tyreActualCompound", u8),
                     ("tyreVisualCompound", u8))

CONJUNTO_PNEU = _s(
    ("actualTyreCompound", u8), ("visualTyreCompound", u8),
    ("wear", u8), ("available", u8), ("recommendedSession", u8),
    ("lifeSpan", u8),        # <-- VOLTAS QUE FALTAM. o numero que o AC nao tem.
    ("usableLife", u8),      # <-- o maximo recomendado para o composto
    ("lapDeltaTime", i16), ("fitted", u8),
)

# O Motion Ex e' o packet mais rico, e o unico sem qualquer equivalente no
# Assetto Corsa. Mudou zero bytes entre 2025 e 2026.
MOTION_EX = _s(
    ("header", Cabecalho),
    ("suspensionPosition", f32, 4), ("suspensionVelocity", f32, 4),
    ("suspensionAcceleration", f32, 4), ("wheelSpeed", f32, 4),
    # Estes dois sao o indice de aderencia de verdade. O wheelSlip do AC
    # e' uma percentagem de escorregamento, que e' outra coisa.
    ("wheelSlipRatio", f32, 4), ("wheelSlipAngle", f32, 4),
    ("wheelLatForce", f32, 4), ("wheelLongForce", f32, 4),
    ("heightOfCOGAboveGround", f32),
    ("localVelocityX", f32), ("localVelocityY", f32), ("localVelocityZ", f32),
    ("angularVelocityX", f32), ("angularVelocityY", f32),
    ("angularVelocityZ", f32), ("angularAccelerationX", f32),
    ("angularAccelerationY", f32), ("angularAccelerationZ", f32),
    # O angulo REAL da roda da frente, em radianos. No AC nao existe
    # nada equivalente, e e' o valor que resolveria a duvida da escala
    # do volante (ver caixa.md).
    ("frontWheelsAngle", f32),
    ("wheelVertForce", f32, 4), ("frontAeroHeight", f32), ("rearAeroHeight", f32),
    ("frontRollAngle", f32), ("rearRollAngle", f32),
    ("chassisYaw", f32), ("chassisPitch", f32),
    ("wheelCamber", f32, 4), ("wheelCamberGain", f32, 4),
)

CLASSIFICACAO = _s(
    ("position", u8), ("numLaps", u8), ("gridPosition", u8), ("points", u8),
    ("numPitStops", u8), ("resultStatus", u8), ("resultReason", u8),
    ("bestLapTimeInMS", u32), ("totalRaceTime", f64), ("penaltiesTime", u8),
    ("numPenalties", u8), ("numTyreStints", u8),
    ("tyreStintsActual", u8, 8), ("tyreStintsVisual", u8, 8),
    ("tyreStintsEndLaps", u8, 8),
)

TELEMETRIA2 = _s(
    ("activeAeroMode", u8), ("activeAeroAvailable", u8),
    ("activeAeroActivationDistance", u16),
    ("overtakeAvailable", u8), ("overtakeActive", u8),
    ("overtakeActivationDistance", u16),
    ("regulations2026", u8), ("drivingWrongWay", u8),
)


def construir(formato):
    """As structs de UM formato. `formato` e' 2025 ou 2026.

    Chamar isto e' a unica forma de obter structs, e so' com um formato
    que esteja em FORMATOS. A funcao levanta ValueError em vez de
    adivinhar: um `m_packetFormat` que nao conhecemos (o menu deixa
    escolher 2023 e 2024) e' uma situaacao que existe, e a resposta
    honesta e' dizer que nao se sabe, nao ler bytes a partir do offset
    errado.
    """
    if formato not in FORMATOS:
        raise ValueError("formato de packet desconhecido: %r" % (formato,))

    n = 22 if formato == 2025 else 24
    # As QUATRO mudancas de tipo entre 2025 e 2026. Ver a nota do topo.
    idt = u8 if formato == 2025 else u16
    motorT = u16 if formato == 2025 else u8

    motion = _s(
        ("posX", f32), ("posY", f32), ("posZ", f32),
        ("velX", f32), ("velY", f32), ("velZ", f32),
        # Os vectores normalizados: dividir por 32767. E' o que a
        # documentacao diz, e e' a razao de serem int16.
        ("fwdX", i16), ("fwdY", i16), ("fwdZ", i16),
        ("rightX", i16), ("rightY", i16), ("rightZ", i16),
        *(("gLat", f32), ("gLong", f32), ("gVert", f32)) if formato == 2025
        else (("gLat", i16), ("gLong", i16), ("gVert", i16)),
        ("yaw", f32), ("pitch", f32), ("roll", f32),
    )

    sessao = _s(("header", Cabecalho), *_SESSAO_COMUM,
               *(_SESSAO_2026 if formato == 2026 else ()))

    telemetria = _s(
        ("speed", u16), ("throttle", f32), ("steer", f32), ("brake", f32),
        # O clutch e' uma PERCENTAGEM 0 a 100 aqui, e uma fraccao 0 a 1 no
        # AC. O sentido e' o mesmo (100 = embraiada), a escala nao.
        ("clutch", u8), ("gear", i8), ("engineRPM", u16),
        ("drs", u8), ("revLightsPercent", u8), ("revLightsBitValue", u16),
        ("brakesTemperature", u16, 4),
        ("tyresSurfaceTemperature", u8, 4),
        ("tyresInnerTemperature", u8, 4),
        ("engineTemperature", motorT),      # uint16 em 2025, uint8 em 2026
        ("tyresPressure", f32, 4),         # PSI
        ("surfaceType", u8, 4),
    )

    estado = _s(
        ("tractionControl", u8), ("antiLockBrakes", u8), ("fuelMix", u8),
        ("frontBrakeBias", u8),             # PERCENTAGEM 0 a 100
        ("pitLimiterStatus", u8),
        ("fuelInTank", f32),               # QUILOGRAMAS, nao litros
        ("fuelCapacity", f32), ("fuelRemainingLaps", f32),
        ("maxRPM", u16), ("idleRPM", u16), ("maxGears", u8),
        ("drsAllowed", u8), ("drsActivationDistance", u16),
        ("actualTyreCompound", u8), ("visualTyreCompound", u8),
        ("tyresAgeLaps", u8), ("vehicleFIAFlags", i8),
        ("enginePowerICE", f32),           # WATTS
        ("enginePowerMGUK", f32), ("ersStoreEnergy", f32),   # JOULES
        ("ersDeployMode", u8),
        ("ersHarvestedThisLapMGUK", f32), ("ersHarvestedThisLapMGUH", f32),
        *((("ersHarvestLimitPerLap", f32),) if formato == 2026 else ()),
        ("ersDeployedThisLap", f32), ("networkPaused", u8),
    )

    participante = _s(
        ("aiControlled", u8), ("driverId", idt), ("networkId", idt),
        ("teamId", idt), ("myTeam", u8), ("raceNumber", u8),
        ("nationality", u8), ("name", c.c_char, 32),
        ("yourTelemetry", u8), ("showOnlineNames", u8), ("techLevel", u16),
        ("platform", u8), ("numColours", u8), ("liveryColours", u8, 12),
    )

    lobby = _s(
        ("aiControlled", u8), ("teamId", idt), ("nationality", u8),
        ("platform", u8), ("name", c.c_char, 32), ("carNumber", u8),
        ("yourTelemetry", u8), ("showOnlineNames", u8), ("techLevel", u16),
        ("readyStatus", u8),
    )

    time_trial = _s(
        ("carIdx", u8), ("teamId", idt), ("lapTimeInMS", u32),
        ("sector1TimeInMS", u32), ("sector2TimeInMS", u32),
        ("sector3TimeInMS", u32), ("tractionControl", u8),
        ("gearboxAssist", u8), ("antiLockBrakes", u8),
        ("equalCarPerformance", u8), ("customSetup", u8), ("valid", u8),
    )

    return {
        PacketId.MOTION: _s(("header", Cabecalho), ("cars", motion, n)),
        PacketId.SESSION: sessao,
        PacketId.LAP: _s(("header", Cabecalho), ("cars", LAP, n),
                         ("timeTrialPBCarIdx", u8), ("timeTrialRivalCarIdx", u8)),
        PacketId.EVENT: EVENT,
        PacketId.PARTICIPANTS: _s(("header", Cabecalho), ("numActiveCars", u8),
                                  ("cars", participante, n)),
        PacketId.SETUPS: _s(("header", Cabecalho), ("cars", SETUP, n),
                            ("nextFrontWingValue", f32)),
        PacketId.TELEMETRY: _s(("header", Cabecalho), ("cars", telemetria, n),
                                ("mfdPanelIndex", u8),
                                ("mfdPanelIndexSecondaryPlayer", u8),
                                ("suggestedGear", i8)),
        PacketId.STATUS: _s(("header", Cabecalho), ("cars", estado, n)),
        PacketId.CLASSIFICATION: _s(("header", Cabecalho), ("numCars", u8),
                                    ("cars", CLASSIFICACAO, n)),
        PacketId.LOBBY: _s(("header", Cabecalho), ("numPlayers", u8),
                           ("cars", lobby, n)),
        PacketId.DAMAGE: _s(("header", Cabecalho), ("cars", DANO, n)),
        PacketId.HISTORIA: _s(("header", Cabecalho), ("carIdx", u8),
                              ("numLaps", u8), ("numTyreStints", u8),
                              ("bestLapTimeLapNum", u8),
                              ("bestSector1LapNum", u8),
                              ("bestSector2LapNum", u8),
                              ("bestSector3LapNum", u8),
                              ("laps", _HISTORIA_VOLTA, 100),
                              ("stints", _HISTORIA_STINT, 8)),
        PacketId.PNEUS: _s(("header", Cabecalho), ("carIdx", u8),
                           ("sets", CONJUNTO_PNEU, 20), ("fittedIdx", u8)),
        PacketId.MOTION_EX: MOTION_EX,
        PacketId.TIME_TRIAL: _s(("header", Cabecalho), ("playerBest", time_trial),
                                 ("personalBest", time_trial),
                                 ("rival", time_trial)),
        PacketId.POSICOES: _s(("header", Cabecalho), ("numLaps", u8),
                              ("lapStart", u8), ("positions", u8, 50 * n)),
    } if formato == 2025 else {
        PacketId.MOTION: _s(("header", Cabecalho), ("cars", motion, n)),
        PacketId.SESSION: sessao,
        PacketId.LAP: _s(("header", Cabecalho), ("cars", LAP, n),
                         ("timeTrialPBCarIdx", u8), ("timeTrialRivalCarIdx", u8)),
        PacketId.EVENT: EVENT,
        PacketId.PARTICIPANTS: _s(("header", Cabecalho), ("numActiveCars", u8),
                                  ("cars", participante, n)),
        PacketId.SETUPS: _s(("header", Cabecalho), ("cars", SETUP, n),
                            ("nextFrontWingValue", f32)),
        PacketId.TELEMETRY: _s(("header", Cabecalho), ("cars", telemetria, n),
                                ("mfdPanelIndex", u8),
                                ("mfdPanelIndexSecondaryPlayer", u8),
                                ("suggestedGear", i8)),
        PacketId.STATUS: _s(("header", Cabecalho), ("cars", estado, n)),
        PacketId.CLASSIFICATION: _s(("header", Cabecalho), ("numCars", u8),
                                    ("cars", CLASSIFICACAO, n)),
        PacketId.LOBBY: _s(("header", Cabecalho), ("numPlayers", u8),
                           ("cars", lobby, n)),
        PacketId.DAMAGE: _s(("header", Cabecalho), ("cars", DANO, n)),
        PacketId.HISTORIA: _s(("header", Cabecalho), ("carIdx", u8),
                              ("numLaps", u8), ("numTyreStints", u8),
                              ("bestLapTimeLapNum", u8),
                              ("bestSector1LapNum", u8),
                              ("bestSector2LapNum", u8),
                              ("bestSector3LapNum", u8),
                              ("laps", _HISTORIA_VOLTA, 100),
                              ("stints", _HISTORIA_STINT, 8)),
        PacketId.PNEUS: _s(("header", Cabecalho), ("carIdx", u8),
                           ("sets", CONJUNTO_PNEU, 20), ("fittedIdx", u8)),
        PacketId.MOTION_EX: MOTION_EX,
        PacketId.TIME_TRIAL: _s(("header", Cabecalho), ("playerBest", time_trial),
                                 ("personalBest", time_trial),
                                 ("rival", time_trial)),
        PacketId.POSICOES: _s(("header", Cabecalho), ("numLaps", u8),
                              ("lapStart", u8), ("positions", u8, 50 * n)),
        # So' existe em 2026. Ler este id num pacote 2025 seria
        # impossible -- o jogo nao o envia.
        PacketId.TELEMETRY2: _s(("header", Cabecalho), ("cars", TELEMETRIA2, n)),
    }


def carros(formato):
    """Quantos carros o formato traz. 22 em 2025, 24 em 2026."""
    return 22 if formato == 2025 else 24


def formato_suportado(formato):
    """Este formato sabe-se ler?

    O menu do F1 25 deixa escolher 2023 e 2024, e o `m_packetFormat` pode
    ser qualquer um dos tres. A resposta honesta para um formato que nao
    conhecemos e' "nao", e o receptor fica a dizer isso -- e NUNCA
    adivinhar. Ler os bytes a partir do offset errado daria numeros
    plausiveis, e um numero plausivel nao se denuncia sozinho: e' a
    Regra no 19, e a razao de o F1 25 precisar de um veredito explicito
    enquanto o AC nao precisa (as paginas com nome nao mudam de formato).
    """
    return formato in FORMATOS


def tamanho_esperado(packet_id, formato):
    """O tamanho em bytes que o pacote TEM de ter, para este formato.

    Vem do comentario da propria EA, que foi confirmado com ctypes nos 35
    tamanhos (docs/f1-25.md, secao 3). Serve para uma coisa muito
    concreta: **detectar que o parse esta' errado**. Um datagrama mais
    curto do que a struct e' um erro de leitura, e a melhor maneira de
    apanhar isso e' contar bytes, que e' a verificacao mais barata que
    existe. Um parse errado devolve numeros plausiveis, e um numero
    plausivel nao se denuncia sozinho.
    """
    base = {
        PacketId.MOTION: 1349, PacketId.SESSION: 753, PacketId.LAP: 1285,
        PacketId.EVENT: 45, PacketId.PARTICIPANTS: 1284,
        PacketId.SETUPS: 1133, PacketId.TELEMETRY: 1352,
        PacketId.STATUS: 1239, PacketId.CLASSIFICATION: 1042,
        PacketId.LOBBY: 954, PacketId.DAMAGE: 1041,
        PacketId.HISTORIA: 1460, PacketId.PNEUS: 231,
        PacketId.MOTION_EX: 273, PacketId.TIME_TRIAL: 101,
        PacketId.POSICOES: 1131,
    }
    if formato == 2026:
        base = {
            PacketId.MOTION: 1325, PacketId.SESSION: 926, PacketId.LAP: 1399,
            PacketId.EVENT: 45, PacketId.PARTICIPANTS: 1470,
            PacketId.SETUPS: 1233, PacketId.TELEMETRY: 1448,
            PacketId.STATUS: 1445, PacketId.CLASSIFICATION: 1134,
            PacketId.LOBBY: 1062, PacketId.DAMAGE: 1133,
            PacketId.HISTORIA: 1460, PacketId.PNEUS: 231,
            PacketId.MOTION_EX: 273, PacketId.TIME_TRIAL: 104,
            PacketId.POSICOES: 1231, PacketId.TELEMETRY2: 269,
        }
    return base.get(packet_id)
