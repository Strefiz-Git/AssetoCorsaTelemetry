"""
O F1 25 como o nucleo do servidor o ve: um id, um nome e um leitor.

Este ficheiro e' a adaptacao. O nucleo nao conhece o F1 25 -- conhece
`JogoBase`, e este objecto implementa esse contrato. Se amanha houver um
terceiro jogo, e' um ficheiro novo com estas mesmas quatro coisas, e o
Hub, o HTTP e o SSE nao mudam uma linha.
"""

from ..base import LeitorBase, JogoBase
from . import logica
from .protocolo import PISTAS, SUPERFICIES
from .receptor import PORTA_PADRAO, Leitor as ReceptorF125


class Leitor(LeitorBase):
    """O receptor, mais as tres coisas que a base pede.

    O `snapshot()` do receptor devolve o estado bruto, em blocos
    (`car`, `laps`, `pneus`...). O `snapshot()` daqui achata-o no formato
    que o painel consome, que e' o MESMO formato que o AC usa. E' essa a
    razao de o achatamento ser uma unica funcao e nao uma coisa spread
    pelo frontend: o frontend nao sabe qual dos dois jogos esta' activo,
    e nao deve saber.
    """

    def __init__(self, porta=PORTA_PADRAO, bind="0.0.0.0"):
        self._r = ReceptorF125(porta=porta, bind=bind)

    def start(self):
        return self._r.start()

    def stop(self):
        self._r.stop()

    def close(self):
        self._r.stop()

    def snapshot(self):
        return achatado(self._r.snapshot(), self._r)

    def opponents(self):
        return self._r.opponents()

    def vivo(self):
        return self._r.vivo()

    def ha_historico(self):
        # Ao contrario do AC, o F1 25 nao tem nada para mostrar com o
        # jogo fechado: nao ha' pagina mapeada que fique com a ultima
        # sessao congelada. So' se escreve o ultimo estado em disco, e
        # isso e' historico, nao estado actual.
        return False

    def diagnostico(self):
        return {"porta": self._r.porta, "erro": self._r.erro}


def achatado(bruto, receptor):
    """O payload do F1 25 no formato que o painel ja consome.

    Nao ha' logica de jogo aqui dentro: e' so' a traducao das CHAVES. As
    unidades e as escalas ja foram decididas no receptor, e e' a' que
    tem de ser, porque e' o unico sitio onde se sabe de que formato o
    numero veio.

    O que NAO se faz aqui: nenhum valor e' inventado. Onde o F1 25 nao
    publica nada, a chave fica a None. Um None pinta-se a neutro no
    painel; um zero seria lido como "zero", e zero e' plausivel. Regra
    no 19.
    """
    s = bruto
    car = s.get("car") or {}
    track = s.get("track") or {}
    laps = s.get("laps") or {}
    pneus = s.get("pneus") or {}
    fis = s.get("fisica") or {}
    setup = s.get("setup") or {}

    out = {
        "jogo": "f125",
        "connected": s.get("connected", False),
        "live": s.get("live", False),
        "estadoJogo": s.get("estadoJogo", "encerrado"),
        "formato": s.get("formato"),
        "packetFormatDesconhecido": s.get("packetFormatDesconhecido"),
        "frame": s.get("frame"),
        "sessionTime": s.get("sessionTime"),
        "packetsRecebidos": s.get("packetsRecebidos", 0),
        "packetsValidos": s.get("packetsValidos", 0),
        "packetsInvalidos": s.get("packetsInvalidos", 0),
        "packetsPerdidos": s.get("packetsPerdidos", 0),
        "pacotesVistos": s.get("pacotesVistos", []),
        "erro": s.get("erro"),
        "desdePacket": 0.0 if s.get("live") else None,

        # --- cabecalho
        "track": track.get("pista"),
        "trackId": track.get("pistaId"),
        "trackLength": track.get("comprimento"),
        "sessao": track.get("sessao"),
        "formula": track.get("formulaNome"),
        "totalLaps": track.get("totalLaps"),
        "compound": logica.composto(car.get("compoundId"),
                                    track.get("formula") or 0),
        "compoundVisual": logica.composto(car.get("compoundVisualId"),
                                           track.get("formula") or 0, visual=True),
        "pos": laps.get("posicao"),
        "lap": laps.get("volta"),
        "estadoResultado": laps.get("estadoResultado"),
        "flagId": car.get("fia"),
        "flag": car.get("fiaNome"),
        "isInPit": car.get("box") == 2,
        "isInPitLane": car.get("box") == 1,
        "pitLimiter": bool(car.get("limitador")),
        "safetyCar": track.get("safetyCar"),
        "safetyCarNome": track.get("safetyCarNome"),

        # --- o carro
        "speed": car.get("velocidade"),
        "rpm": car.get("rpm"),
        "maxRpm": car.get("maxRpm"),
        "gear": car.get("caixa"),
        "throttle": car.get("acelerador"),
        "brake": car.get("travão"),
        "clutchRaw": car.get("embraiagem"),
        # O steer vem normalizado -1 a 1. O AC da' um angulo em radianos
        # sem escala conhecida, e o painel do AC tem de adivinhar uma
        # (o STEER_REF do app.js, ainda marcado como nao confirmado).
        # Aqui nao ha' o que adivinhar.
        "steer": car.get("volante"),
        "luzesRotacao": car.get("luzes"),
        "caixaSugerida": car.get("caixaSugerida"),
        "engineTemp": car.get("tempMotor"),

        # --- DRS: o F1 25 da' a zona a serio
        "drs": car.get("drs", 0),
        "drsAvailable": car.get("drsAvailable"),
        "drsEnabled": car.get("drs"),
        "drsDistancia": car.get("drsDistancia"),
        "zonasDrs": track.get("zonasDrs", []),

        # --- ERS em joules, potencia em watts
        "ersPct": None,        # o maximo nao e' publicado: ver logica.py
        "ersJ": car.get("ersStoreJ"),
        "ersMaxJ": None,
        "ersUsadoJ": car.get("ersUsadoJ"),
        "ersColhidoJ": car.get("ersColhidoMJ"),
        "ersDeploy": car.get("ersDeploy"),
        "ersDeployNome": car.get("ersDeployNome"),
        "potenciaIceW": car.get("potenciaIceW"),
        "potenciaMGUKW": car.get("potenciaMGUKW"),
        "turbo": None,          # o F1 25 nao tem turbo
        "hasERS": True,
        "hasDRS": car.get("drsAvailable") is not None,
        "hasKERS": False,

        # --- combustivel em QUILOGRAMAS
        "fuelKg": car.get("combustivelKg"),
        "maxFuelKg": car.get("combustivelMaxKg"),
        "fuelPct": _pct(car.get("combustivelKg"), car.get("combustivelMaxKg")),
        "fuelLaps": car.get("combustivelVoltas"),
        "misturaCombustivel": car.get("misturaNome"),

        # --- voltes
        "currentTime": laps.get("atual"),
        "lastTime": laps.get("anterior"),
        "sector1": laps.get("sector1"),
        "sector2": laps.get("sector2"),
        "sector": laps.get("setor"),
        "sectorCount": 3,
        "lapInvalid": laps.get("voltaInvalida"),
        "deltaJogo": laps.get("deltaFrente"),
        "deltaLider": laps.get("deltaLider"),
        "penaltyTime": laps.get("penalidadeS"),
        "posicaoGrelha": laps.get("posicaoGrelha"),
        "voltas": laps.get("paradas"),

        # --- o mundo. X-Z e' o plano, Y e' a ALTITUDE, como no AC.
        "x": fis.get("x"),
        "y": fis.get("y"),
        "z": fis.get("z"),
        "trackPct": laps.get("percentagem"),
        "distanciaVolta": laps.get("distanciaVolta"),
        "gLateral": fis.get("gLateral"),
        "gLongitudinal": fis.get("gLongitudinal"),
        "gVertical": fis.get("gVertical"),

        # --- pneus
        "tyreTempSurface": car.get("tempPneuSuperficie"),
        "tyreTempInner": car.get("tempPneuInterior"),
        "tyrePressure": car.get("pressaoPneu"),
        "surfaceType": car.get("superficieRoda"),
        "surfaceNames": car.get("superficieNomes"),
        "tyreWear": pneus.get("desgaste"),
        "tyreDamage": pneus.get("dano"),
        "brakeDamage": pneus.get("danoTravões"),
        "tyreBlisters": pneus.get("bolhas"),
        "tyreAge": pneus.get("vida"),
        "tyreLifeMax": pneus.get("vidaMax"),
        "compoundId": car.get("compoundId"),
        "brakeTemp": car.get("tempTravões"),
        # O F1 25 NAO tem uma percentagem de ABS. O `m_antiLockBrakes` e'
        # um 0 ou 1, e o TC e' um modo (0 off, 1 medio, 2 cheio). No AC
        # sao niveis de 0 a 1 e o painel mostra a percentagem. Mostrar
        # "ABS 100%" aqui seria inventar um numero que o jogo nao da.
        "abs": None,
        "tc": None,
        "absOnOff": car.get("abs"),
        "tcModo": car.get("tc"),
        "brakeBias": car.get("biasTrava"),
        "brakeBiasPct": car.get("biasTrava"),
        "camper": fis.get("camber"),

        # --- aderencia: escorregamento de verdade, nao uma estimativa
        "slipRatio": fis.get("escorregamentoRatio"),
        "slipAngle": fis.get("escorregamentoAngulo"),
        "forcaLateral": fis.get("forcaLateral"),
        "forcaLongitudinal": fis.get("forcaLongitudinal"),
        "forcaVertical": fis.get("forcaVertical"),
        "anguloRoda": fis.get("anguloRoda"),

        # --- danos, muito mais ricos do que os 5 floats do AC
        "damageAsaFrenteEsq": pneus.get("wingEsquerda"),
        "damageAsaFrenteDir": pneus.get("wingDireita"),
        "damageAsaTras": pneus.get("wingTras"),
        "damageAssoalho": pneus.get("assoalho"),
        "damageDifusor": pneus.get("difusor"),
        "damageSidepod": pneus.get("sidepod"),
        "damageCaixa": pneus.get("caixa"),
        "damageMotor": pneus.get("motor"),
        "componentesMotor": pneus.get("componentes"),
        "erroDrs": pneus.get("erroDrs"),
        "erroErs": pneus.get("erroErs"),
        "motorRebentou": pneus.get("motorRebentou"),
        "motorPreso": pneus.get("motorPreso"),

        # --- clima. O F1 25 PUBLICA o tempo; o AC nao.
        "weather": track.get("weather"),
        "weatherNome": track.get("weatherNome"),
        "trackTemp": track.get("pistaTemp"),
        "airTemp": track.get("arTemp"),
        "chuvaPrevisao": _chuva(track),
        "previsao": track.get("previsao", []),
        "climaAvailable": track.get("weather") is not None,
        "windSpeed": None,          # o F1 25 nao publica vento
        "windDirection": None,
        "airDensity": None,         # nem o AC publica, mas o painel mostra
        "surfaceGrip": None,        # aqui ha' melhor: surfaceType

        # --- assistencias e setup
        "assistencias": track.get("assistencias", {}),
        "setup": setup,
        "pitSpeedLimit": track.get("pitSpeedLimit"),
        "aiDifficulty": track.get("aiDifficulty"),
    }
    return out


def _pct(atual, maximo):
    try:
        a = float(atual)
        m = float(maximo)
    except (TypeError, ValueError):
        return None
    if m <= 0:
        return None
    return round(a / m * 100.0, 1)


def _chuva(track):
    """A chuva em percentagem, lida da previsao mais proxima.

    O F1 25 manda `m_rainPercentage` na previsao, e a previsao mais
    proxima (minutos == 0) e' o "agora". Se nao houver previsao com
    minutos 0, devolve None em vez de 0: sem previsao nao se sabe se
    chove, e um zero seria "nao chove". Regra no 19, outra vez.
    """
    prev = track.get("previsao") or []
    for amostra in prev:
        if amostra.get("minutos") == 0:
            return amostra.get("chuva")
    return None


class F125(JogoBase):
    id = "f125"
    nome = "F1 25"
    transporte = "UDP, porta 20777"
    precisa_instalar = False
    tem_mapa_de_ficheiro = False

    def criar_leitor(self, opcoes=None):
        opcoes = opcoes or {}
        return Leitor(porta=opcoes.get("porta", PORTA_PADRAO),
                      bind=opcoes.get("bind", "0.0.0.0"))

    def rotas(self):
        # O F1 25 nao precisa de nada do disco: o mapa e' desenhado a
        # medida que se conduz, a partir das coordenadas do Motion. E'
        # o mesmo caminho que o AC tem como alternativa quando nao
        # encontra o map.png, e nao um buraco.
        return {}

    def _capacidades(self):
        return logica.capacidades()

    def estado_leitor(self):
        return {
            "porta": PORTA_PADRAO,
            "instrucao": "F1 25: Settings > Telemetry Settings, UDP Telemetry On, "
                         "IP 127.0.0.1, porta 20777.",
            "nota": "So ha telemetria a conduzir. Nos menus nao sai nada.",
        }
