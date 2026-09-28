"""
O socket UDP do F1 25, e o estado que se acumula com o que chega.

O F1 25 manda datagramas, um por packet, e nao manda todos no mesmo
frame. Session e Car Setups vao a 2 Hz; o resto vai a taxa escolhida no
menu. Por isso aqui se guarda O ULTIMO valor de cada packet, e nao "o que
chegou neste frame" -- um receptor que so desenhasse o que chegou agora
mostrava metade dos valores a piscar, uma vez por segundo.

O FORMATO
---------
O `m_packetFormat` do cabecalho diz 2025 ou 2026, e as structs sao
diferentes. O `gameYear` NAO serve: com o Season Pack 2026 o jogo continua
a dizer 25. Por isso o formato e' lido do datagrama, e as structs sao
reconstruidas se ele mudar. Ver `protocolo.py`.

E se vier um formato que nao conhecemos -- o menu do F1 25 deixa escolher
2023 e 2024 -- o receptor NAO adivinha. Fica em `formato_desconhecido` e
o painel diz que nao sabe ler aquele formato. Ler bytes a partir do offset
errado daria numeros plausiveis, e um numero plausivel nao se denuncia
sozinho.

O JOGO PARADO
-------------
O F1 25 so emite telemetria a conduzir. Nos menus, nas repeticoes e no
ecra de resultados nao sai nada. Portanto "nao chega nada" e' o estado
normal de uma sessao acabada, e nao um erro. O receptor guarda o ultimo
estado e diz ha quanto tempo esta' calado, para o painel poder escrever
EM PAUSA ou JOGO ENCERRADO em vez de mostrar zeros. Ver a Regra no 2.

Isto e' diferente do AC, em que as paginas ficam mapeadas com o jogo
fechado e "a pagina existe" nao quer dizer nada.
"""

import socket
import struct
import threading
import time

from . import logica
from .protocolo import (COMBUSTIVEL, FIA, FORMULAS, PISTAS, SAFETY_CAR,
                        SESSOES, SUPERFICIES, TEMPOS, Cabecalho, NOMES_PACKET,
                        PacketId, TRADUCAO, construir, formato_suportado,
                        tamanho_esperado)

# O tamanho de leitura. O maior pacote e' o Session de 2026, com 926
# bytes. Ler 2048 da' folga sem cortar nada, e um datagrama maior e'
# simplesmente truncado pelo proprio UDP (que e' o comportamento certo
# para um pacote que nao recognisecemos).
BUFFER = 2048

# Um pacote que se considerava parado. O jogo so emite a conduzir, e a
# 60 Hz um frame e' 16 ms; dois segundos e' uma margem enorme para
# "parou" e curta para nao piscar numa pausa de box.
PARADO_S = 2.0
# E a partir daqui ja nao e' uma pausa: e' outra coisa. O painel escreve
# JOGO ENCERRADO.
ENCERRADO_S = 90.0

PORTA_PADRAO = 20777


def _texto(v):
    """Um c_char[32] numa string. O jogo manda UTF-8 com \0 no fim."""
    if not v:
        return ""
    if isinstance(v, bytes):
        return v.split(b"\x00", 1)[0].decode("utf-8", "ignore").strip()
    return str(v).split("\x00", 1)[0].strip()


def _f(v, casas=2, padrao=None):
    """Um float do jogo, arredondado. None quando nao se pode ler.

    O F1 25 manda alguns campos a zero LEGITIMAMENTE (um pneu a 0 bar, um
   |km/h de uma parado), e nao com o sentido de "nao vem". Por isso o
    zero passa. O que nao passa e' um None ou um valor que nao se
    consegue converter: ai e' "nao se sabe", e nao zero.
    """
    try:
        x = float(v)
    except (TypeError, ValueError):
        return padrao
    if x != x or x in (float("inf"), float("-inf")):
        return padrao
    return round(x, casas)


def _i(v, padrao=None):
    try:
        return int(v)
    except (TypeError, ValueError):
        return padrao


def _ms(v):
    """Milissegundos -> "M:SS.mmm", igual ao formato que o AC usa.

    O mesmo formato nos dois jogos e' deliberado: o frontend tem uma
    funcao so para formatar tempos, e um tempo que se escreve de duas
    maneiras e' um tempo que se mostra de duas maneiras.
    """
    try:
        ms = int(v)
    except (TypeError, ValueError):
        return "--:--.---"
    if ms <= 0:
        return "--:--.---"
    m, resto = divmod(ms, 60000)
    s, mseg = divmod(resto, 1000)
    return "%d:%02d.%03d" % (m, s, mseg)


class Estado:
    """O que se sabe da sessao, a partir de tudo o que ja chegou.

    Um pacote de cada tipo. Os que o painel nao usa nao sao guardados, e
    isso e' de proposito: guardar tudo era memoria sem uso, e a lista do
    que se guarda e' a lista do que o painel mostra.
    """

    def __init__(self):
        self.limpar()

    def limpar(self):
        self.formato = None
        self.pacotes = {}
        self.frame = 0
        self.frame_total = 0
        self.sessionTime = 0.0
        self.playerIndex = 0
        self.uid = 0
        self.recebido_em = 0.0
        self.primeiro_em = 0.0
        self.pacotes_vistos = set()
        # Contadores, para o painel e para o log dizerem o que esta a
        # acontecer. Um receptor que falha em silencio e' indistinguivel
        # de um receptor que nao esta a ouvir.
        #
        # `recebidos` e' quantos datagramas chegaram. `validos` e' quantos
        # se CONSEGUIRAM ler. Sao coisas diferentes, e a diferencia e' o
        # que separa "o jogo esta' a mandar" de "eu percebo o que o
        # jogo manda". Um datagrama de um formato que nao conhecemos
        # chega e nao se le: se `connected` dependesse de `recebidos`, o
        # painel mostraria "ligado" e depois um painel de nada, que e'
        # pior do que dizer "nao percebo este formato".
        self.recebidos = 0
        self.validos = 0
        self.invalidos = 0
        self.formatos_desconhecidos = set()
        self.perdidos = 0

    def guardar(self, packet_id, dados, cabecalho, agora):
        self.pacotes[packet_id] = dados
        self.frame = int(cabecalho.frameIdentifier)
        self.frame_total = int(cabecalho.overallFrameIdentifier)
        self.sessionTime = float(cabecalho.sessionTime)
        self.playerIndex = int(cabecalho.playerCarIndex)
        self.uid = int(cabecalho.sessionUID)
        self.recebido_em = agora
        self.pacotes_vistos.add(packet_id)
        self.validos += 1
        if not self.primeiro_em:
            self.primeiro_em = agora

    def tem(self, packet_id):
        return packet_id in self.pacotes


class Leitor:
    """O leitor de telemetria do F1 25.

    Um thread so le o socket, e o `snapshot()` le o estado desse thread.
    O mesmo desenho que o Hub do AC: nunca dois threads a ler a mesma
    coisa ao mesmo tempo.

    UDP NAO E' FIAVEL. Perdem-se datagramas e chegam fora de ordem, e
    por isso o `frameIdentifier` serve para contar os saltos. Isso nao e'
    uma correccao -- o painel nao pode inventar o pacote que se perdeu --
    e so' um numero para saber, se alguma coisa estiver estranha, se a
    culpa e' da rede.
    """

    def __init__(self, porta=PORTA_PADRAO, bind="0.0.0.0"):
        self.porta = int(porta)
        self.bind = bind
        self._sock = None
        self._thread = None
        self._stop = threading.Event()
        self._lock = threading.Lock()
        self.estado = Estado()
        self.erro = None
        self._structs = None
        self._formato = None
        self._ultimo_frame = None

    # -- ciclo de vida -------------------------------------------------
    def abrir(self):
        """Abre o socket. Nao da erro se a porta estiver ocupada: devolve
        False e escreve o porque em `self.erro`, que o painel mostra.

        Voltar a tentar ao abrir e' o comportamento certo, porque a outra
        metade e' a do jogo: a porta 20777 e' a que o SimHub usa, e os
        dois ao mesmo tempo nao podem. Dizer qual dos dois esta' com a
        porta e' mais util do que uma exceccao.
        """
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind((self.bind, self.porta))
            # O jogo pode mandar mais do que o receive buffer aguenta
            # numarajada. Sem isto, os pacotes descartam-se em silencio e
            # a telemetria tem buracos sem nenhuma pista de porquê.
            s.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 1 << 20)
            s.settimeout(0.2)
            self._sock = s
            self.erro = None
            return True
        except OSError as e:
            self._sock = None
            self.erro = str(e)
            return False

    def start(self):
        if not self.abrir():
            return False
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        return True

    def stop(self):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=1.0)
            self._thread = None
        self.close()

    def close(self):
        if self._sock:
            try:
                self._sock.close()
            except OSError:
                pass
            self._sock = None

    def _loop(self):
        while not self._stop.is_set():
            try:
                dados, _ = self._sock.recvfrom(BUFFER)
            except socket.timeout:
                continue
            except OSError:
                # O socket foi fechado debaixo de nos (o stop()).
                break
            try:
                self._tratar(dados)
            except Exception as e:
                # Um datagrama malformado nao pode matar o fio. Perder
                # um pacote e' melhor do que perder a sessao inteira, e o
                # contador diz que aconteceu.
                with self._lock:
                    self.estado.invalidos += 1
                    self.erro = str(e)

    # -- a decodificacao ----------------------------------------------
    def _tratar(self, dados):
        agora = time.time()
        with self._lock:
            self.estado.recebidos += 1

        if len(dados) < 29:
            with self._lock:
                self.estado.invalidos += 1
            return

        # O CABECALHO primeiro, e sozinho. E' o unico pacote que se pode
        # ler sem saber o formato, e e' ele que diz o formato.
        cab = Cabecalho.from_buffer_copy(dados[:29])
        formato = int(cab.packetFormat)
        packet_id = int(cab.packetId)

        if not formato_suportado(formato):
            with self._lock:
                self.estado.formatos_desconhecidos.add(formato)
                self.estado.invalidos += 1
            return

        # O formato pode mudar com o jogo a correr: muda-se o UDP Format
        # nas opcoes e o proximo datagrama ja vem diferente. Reconstruir
        # as structs e' a unica forma de se adapting, e e' barato.
        if formato != self._formato:
            self._structs = construir(formato)
            self._formato = formato
            with self._lock:
                self.estado.formato = formato
                # Os pacotes do formato antigo nao valem nada no novo.
                self.estado.pacotes = {}
                self.estado.pacotes_vistos = set()

        st = self._structs.get(packet_id)
        if st is None:
            # Um packet id que este formato nao define. Nao e' um erro
            # grave: o jogo mandou algo que nao pedimos, e deitamos
            # fora. E o caso do TELEMETRY2 num jogo em 2025.
            with self._lock:
                self.estado.invalidos += 1
            return

        # A CONTAGEM DE BYTES, que e' a verificacao mais barata que existe.
        # Um datagrama mais curto do que a struct e' um parse errado, e um
        # parse errado devolve numeros plausiveis. Preferimos nao ler.
        esperado = tamanho_esperado(packet_id, formato)
        if esperado and len(dados) < esperado:
            with self._lock:
                self.estado.invalidos += 1
            return

        try:
            v = st.from_buffer_copy(dados)
        except ValueError:
            with self._lock:
                self.estado.invalidos += 1
            return

        with self._lock:
            # A contagem de frames perdidos. UDP nao e' fiavel, e se a
            # telemetria tiver buracos este e' o numero que explica por
            #quê.
            if self._ultimo_frame is not None:
                salto = int(cab.frameIdentifier) - self._ultimo_frame
                if salto > 1:
                    self.estado.perdidos += salto - 1
            self._ultimo_frame = int(cab.frameIdentifier)
            self.estado.guardar(packet_id, v, cab, agora)

    # -- o que o painel ve --------------------------------------------
    def _calmo_ha(self):
        with self._lock:
            if not self.estado.recebido_em:
                return None
            return time.time() - self.estado.recebido_em

    def vivo(self):
        """O jogo esta' a emitir telemetria AGORA.

        Ao contrario do AC, aqui nao ha' a confusao das paginas
        mapeadas: se o jogo nao manda nada, e' porque nao esta' a correr
        ou esta' parado. A unica excepcao e' a pausa, e por isso o
        `snapshot` tambem devolve ha quanto tempo esta' calado.
        """
        ha = self._calmo_ha()
        if ha is None:
            return False
        return ha < PARADO_S

    def _estado_jogo(self):
        """'a_correr', 'em_pausa' ou 'encerrado'."""
        ha = self._calmo_ha()
        if ha is None:
            return "encerrado"
        if ha < PARADO_S:
            return "a_correr"
        if ha < ENCERRADO_S:
            return "em_pausa"
        return "encerrado"

    def _usuarios(self):
        """O `m_playerCarIndex` vale quantos ao mesmo tempo."""
        with self._lock:
            seg = int(self.estado.pacotes.get(PacketId.LOBBY) is not None)
        return 1 + seg

    def snapshot(self):
        e = self.estado
        with self._lock:
            formato = e.formato
            pacotes = dict(e.pacotes)
            recebidos = e.recebidos
            validos = e.validos
            invalidos = e.invalidos
            perdidos = e.perdidos
            desconhecidos = sorted(e.formatos_desconhecidos)
            uid = e.uid
            vistos = set(e.pacotes_vistos)
            frame = e.frame
            sessao_t = e.sessionTime
            idx = e.playerIndex

        estado_jogo = self._estado_jogo()
        base = {
            "jogo": "f125",
            # connected e' sobre os pacotes que se CONSEGUIRAM ler, e nao
            # sobre os que chegaram. A diferenca aparece quando o jogo
            # manda um formato que nao sabemos: os datagramas chegam, e
            # dizer "ligado" com um painel de nada seria o pior dos
            # dois mundos -- nem se sabe que ha' jogo, nem se sabe que
            # nao sabemos ler.
            "connected": bool(validos),
            "live": estado_jogo == "a_correr" and bool(validos),
            "estadoJogo": estado_jogo,
            "formato": formato,
            "packetFormatDesconhecido": desconhecidos[0] if desconhecidos else None,
            "frame": frame,
            "sessionTime": round(sessao_t, 3),
            "packetsRecebidos": recebidos,
            "packetsValidos": validos,
            "packetsInvalidos": invalidos,
            "packetsPerdidos": perdidos,
            "pacotesVistos": sorted(vistos),
        }
        if self.erro:
            base["erro"] = self.erro

        if not validos:
            # Nenhum pacote lido. Nao se inventa nada: as chaves ficam a
            # None e o painel pinta a neutro. Um zero aqui seria "0 km/h"
            # e "0 rpm", que e' plausivel e falso. Regra no 19.
            base.update(_vazio())
            return base

        if formato is None:
            base.update(_vazio())
            return base

        base["track"] = self._sessao(pacotes)
        base["car"] = self._carro(pacotes, idx, formato)
        base["laps"] = self._voltas(pacotes, idx, base["track"])
        base["pneus"] = self._pneus(pacotes, idx)
        base["fisica"] = self._fisica(pacotes, idx, formato)
        base["setup"] = self._setup(pacotes, idx)
        return base

    # -- cada packet ---------------------------------------------------
    def _sessao(self, p):
        s = p.get(PacketId.SESSION)
        if s is None:
            return {}
        id_pista = _i(s.trackId, -1)
        previsao = []
        for i in range(min(int(s.numWeatherSamples), 64)):
            w = s.weatherSamples[i]
            previsao.append({
                "minutos": int(w.timeOffset),
                "weather": int(w.weather),
                "chuva": int(w.rainPct),
                "pista": _i(w.trackTemp),
                "ar": _i(w.airTemp),
            })
        # As zonas de DRS so existem em 2026. O `getattr` com um valor
        # por omissao e' o que impede o 2025 de rebentar aqui, e o
        # comentario explica porque e' aceitavel: em 2025 o campo nao
        # existe, e nao ha' zona nenhuma para pintar. Uma lista vazia e' a
        # resposta certa, e nao uma estimativa.
        zonas_drs = []
        for i in range(min(int(getattr(s, "numDRSZones", 0) or 0), 4)):
            z = s.drsZones[i]
            zonas_drs.append([round(float(z.zoneStart), 5),
                              round(float(z.zoneEnd), 5)])
        return {
            # Um id que nao esteja na tabela e' PISTA DESCONHECIDA, e o
            # painel escreve o numero em vez de um nome inventado. A
            # tabela e' sparse de proposito: o id 1 nao existe.
            "pista": logica.piso(id_pista, PISTAS,
                                 guarda=str(id_pista) if id_pista >= 0 else "—"),
            "pistaId": id_pista,
            "comprimento": _i(s.trackLength),
            "totalLaps": _i(s.totalLaps),
            "sessao": logica.piso(_i(s.sessionType), SESSOES),
            "sessaoId": _i(s.sessionType),
            "formula": _i(s.formula),
            "formulaNome": logica.piso(_i(s.formula), FORMULAS),
            "weather": _i(s.weather),
            "weatherNome": logica.piso(_i(s.weather), TEMPOS),
            "pistaTemp": _i(s.trackTemp),
            "arTemp": _i(s.airTemp),
            "tempoFim": _i(s.timeLeft),
            "duracao": _i(s.duration),
            "pitSpeedLimit": _i(s.pitSpeedLimit),
            "safetyCar": _i(s.safetyCarStatus),
            "safetyCarNome": logica.piso(_i(s.safetyCarStatus), SAFETY_CAR),
            # A preferencia do jogador, que e' um campo DIFERENTE com um
            # nome quase igual. Ver a nota em protocolo.py.
            "safetyCarPreferencia": _i(s.safetyCar),
            "aiDifficulty": _i(s.aiDifficulty),
            "regras": _i(s.ruleSet),
            "mistura": _i(getattr(s, "equalCarPerformance", 0)),
            "assistencias": {
                "volante": _i(s.steeringAssist),
                "travagem": _i(s.brakingAssist),
                "caixa": _i(s.gearboxAssist),
                "box": _i(s.pitAssist),
                "ers": _i(s.ersAssist),
                "drs": _i(s.drsAssist),
            },
            "superficie": _i(s.surfaceType),
            "previsao": previsao,
            "zonasDrs": zonas_drs,
            "s2": _f(s.sector2LapDistanceStart, 1),
            "s3": _f(s.sector3LapDistanceStart, 1),
        }

    def _carro(self, p, idx, formato):
        t = p.get(PacketId.TELEMETRY)
        s = p.get(PacketId.STATUS)
        c = t.cars[idx] if t is not None else None
        st = s.cars[idx] if s is not None else None
        d = {"indice": idx}

        if c is not None:
            d.update({
                "velocidade": _i(c.speed),
                "acelerador": round(float(c.throttle) * 100),
                "travão": round(float(c.brake) * 100),
                # O steer vem JA normalizado, -1 a 1, com o limite escrito
                # na documentacao. No AC e' um angulo em radianos sem
                # escala conhecida, e essa e' uma das razoes pelas quais
                # o volante do F1 25 fica direito sem trabalho extra.
                "volante": round(float(c.steer), 3),
                # 0 a 100 AQUI, e 0.0 a 1.0 no AC. O sentido e' o mesmo.
                "embraiagem": _i(c.clutch),
                "caixa": logica.caixa(c.gear),
                "caixaNum": _i(c.gear),
                "rpm": _i(c.engineRPM),
                "drs": _i(c.drs),
                "luzes": _i(c.revLightsPercent),
                "caixaSugerida": _i(t.suggestedGear),
                "tempMotor": _i(c.engineTemperature),
                "tempTravões": [None] * 4,
                # A ordem do JOGO e' RL, RR, FL, FR. Traduzimos para a
                # ordem do painel -- FL, FR, RL, RR, que e' a do AC -- no
                # ciclo logo a seguir, UMA VEZ. Ver a Regra no 22 do
                # docs/f1-25.md: as duas ordens desenham uma grelha
                # 2x2 quase simetrica, e um painel ao contrario nao da
                # erro nenhum.
                #
                # A temperatura dos travoes entrava NESTA lista e nao
                # saia. O `test_f125_parser.py` apanhou isso: os quatro
                # valores apareciam pela ordem errada e passavam todos os
                # testes que verem "quatro numeros". Um array de quatro
                # temperaturas e' o sitio onde um slip passa mais
                # despercebido, porque quatro numeros muito parecidos nao
                # denunciam nada.
                "tempPneuSuperficie": [None] * 4,
                "tempPneuInterior": [None] * 4,
                "pressaoPneu": [None] * 4,
                "superficieRoda": [None] * 4,
                # Isto e' MELHOR do que o surfaceGrip do AC. A aderencia
                # e' uma estimativa; aqui o jogo diz o que a roda tocou.
                # E o 8 e' AGUA, que num F1 e' um safety car -- o painel
                # pode dizer isso em vez de desenhar uma barra a zero que
                # ninguem questiona.
                "superficieNomes": [None] * 4,
            })
            for i in range(4):
                j = TRADUCAO[i]
                d["tempTravões"][j] = _i(c.brakesTemperature[i])
                d["tempPneuSuperficie"][j] = _i(c.tyresSurfaceTemperature[i])
                d["tempPneuInterior"][j] = _i(c.tyresInnerTemperature[i])
                d["pressaoPneu"][j] = _f(c.tyresPressure[i], 2)
                sid = _i(c.surfaceType[i])
                d["superficieRoda"][j] = sid
                d["superficieNomes"][j] = logica.piso(sid, SUPERFICIES)
            d["tempTravões"] = [x if x is not None else 0
                                for x in d["tempTravões"]]
            d["tempPneuSuperficie"] = [x if x is not None else 0
                                       for x in d["tempPneuSuperficie"]]
            d["tempPneuInterior"] = [x if x is not None else 0
                                     for x in d["tempPneuInterior"]]
            d["pressaoPneu"] = [x if x is not None else 0.0
                                for x in d["pressaoPneu"]]
            d["superficieRoda"] = [x if x is not None else -1
                                   for x in d["superficieRoda"]]
            d["superficieNomes"] = [x or "\u2014" for x in d["superficieNomes"]]

        if st is not None:
            d.update({
                "compoundId": _i(st.actualTyreCompound),
                "compoundVisualId": _i(st.visualTyreCompound),
                "idadePneu": _i(st.tyresAgeLaps),
                # O F1 25 DA a zona de DRS a serio: um 0/1 e os metros que
                # faltam. No AC so ha' dois flags que podem mentir, e a
                # interface teve de medir uma volta inteira para saber se
                # eram de confianca. Aqui nao ha' duvida nenhuma.
                "drsAvailable": _i(st.drsAllowed),
                "drsDistancia": _i(st.drsActivationDistance),
                "ersStoreJ": _f(st.ersStoreEnergy, 0),
                "ersDeploy": _i(st.ersDeployMode),
                "ersDeployNome": logica.modo_ers(_i(st.ersDeployMode), formato),
                "ersColhidoMJ": _f(st.ersHarvestedThisLapMGUK, 0),
                "ersColhidoHMGU": _f(st.ersHarvestedThisLapMGUH, 0),
                "ersUsadoJ": _f(st.ersDeployedThisLap, 0),
                "potenciaIceW": _f(st.enginePowerICE, 0),
                "potenciaMGUKW": _f(st.enginePowerMGUK, 0),
                "combustivelKg": _f(st.fuelInTank),
                "combustivelMaxKg": _f(st.fuelCapacity),
                # Este e' o numero que o MFD do jogo mostra. O AC nao
                # tem nada parecido, e e' a razao de o AC estimar as
                # voltas de combustivel a partir de duas leituras.
                "combustivelVoltas": _f(st.fuelRemainingLaps, 2),
                "maxRpm": _i(st.maxRPM),
                "idleRpm": _i(st.idleRPM),
                "maxCaixas": _i(st.maxGears),
                # PERCENTAGEM 0 a 100, ao contrario do AC que e' 0.0 a 1.0.
                "biasTrava": _i(st.frontBrakeBias),
                "abs": _i(st.antiLockBrakes),
                "tc": _i(st.tractionControl),
                "mistura": _i(st.fuelMix),
                "misturaNome": logica.piso(_i(st.fuelMix), COMBUSTIVEL),
                "limitador": _i(st.pitLimiterStatus),
                "fia": _i(st.vehicleFIAFlags),
                "fiaNome": logica.piso(_i(st.vehicleFIAFlags), FIA),
            })
        return d

    def _voltas(self, p, idx, sessao):
        l = p.get(PacketId.LAP)
        if l is None:
            return {}
        v = l.cars[idx]
        # O tempo da volta e' um uint32 normal, sem a parte dos minutos.
        # O truque so e' preciso nos SECTORES e nos DELTAS.
        atual = int(v.currentLapTimeInMS)
        anterior = int(v.lastLapTimeInMS)
        s1 = logica.tempo_de_minutos(v.sector1TimeMinutesPart, v.sector1TimeMSPart)
        s2 = logica.tempo_de_minutos(v.sector2TimeMinutesPart, v.sector2TimeMSPart)
        dist = _f(v.lapDistance, 1)
        return {
            "atual": _ms(atual),
            "atualMs": atual if atual > 0 else None,
            "anterior": _ms(anterior),
            "anteriorMs": anterior if anterior > 0 else None,
            "sector1": _ms(s1),
            "sector2": _ms(s2),
            # O sector 3 NAO vem no Lap Data. Vem no Session History, que
            # so chega no fim da sessao. Por isso o painel mostra o
            # ultimo sector conhecido e nao um zero: o AC tem um campo
            # `lastSectorTime` para isto, e o F1 25 nao.
            "sector3": None,
            "setor": _i(v.sector),
            "volta": _i(v.currentLapNum),
            "posicao": _i(v.carPosition),
            "posicaoGrelha": _i(v.gridPosition),
            "estadoPiloto": _i(v.driverStatus),
            "estadoResultado": _i(v.resultStatus),
            "voltaInvalida": bool(int(v.currentLapInvalid)),
            "box": _i(v.pitStatus),
            "paradas": _i(v.numPitStops),
            "penalidadeS": _i(v.penalties),
            "avisos": _i(v.totalWarnings),
            # O jogo manda os DELTAS em milissegundos com a parte dos
            # minutos em separado, e o valor e' POSITIVO quando se esta
            # atrasado. Um delta negativo e' um bug de leitura, nao um
            # pilotagem impossivel: a linha de meta e' mais rapida que
            # quem esta' atrasado de si, e o jogo nunca da negativo.
            "deltaFrente": logica.tempo_de_minutos(
                v.deltaToCarInFrontMinutesPart, v.deltaToCarInFrontMSPart) or None,
            "deltaLider": logica.tempo_de_minutos(
                v.deltaToRaceLeaderMinutesPart, v.deltaToRaceLeaderMSPart) or None,
            "distanciaVolta": dist,
            "distanciaTotal": _f(v.totalDistance, 1),
            "deltaSafetyCar": _f(v.safetyCarDelta, 2),
            "velocidadeArmadilha": _f(v.speedTrapFastestSpeed, 1),
            # A percentagem da pista. O m_lapDistance e' em METROS desde
            # a linha, e precisa do comprimento do Session para virar
            # percentagem. E antes de passar a linha e' NEGATIVO, e uma
            # percentagem negativa desenhava o carro fora da pista sem
            # dar erro nenhum. Por isso o helper devolve None fora de
            # [0, 1] e o valor cru fica logo ao lado, para quem quiser.
            "percentagem": logica.percentagem_pista(
                dist, sessao.get("comprimento") if sessao else None),
        }

    def _pneus(self, p, idx):
        d = p.get(PacketId.DAMAGE)
        n = p.get(PacketId.PNEUS)
        if d is None:
            return {}
        # `d` e' o PACOTE, e tem um array de carros dentro. E' `d.cars[idx]`
        # que e' o carro. Confundir os dois da um AttributeError, que e'
        # pelo menos uma falha que se ve logo -- mas um `getattr` calado
        # aqui daria um dicionario vazio, e um painel de pneus vazio sem
        # erro nenhum e' o pior dos dois. A Regra no 14, ao contrario.
        d = d.cars[idx]
          # O `m_tyresWear` e' QUANTO JÁ FOI USADO, e nao quanto resta.
          #
          # MEDIDO, e nao deduzido: 2026-09-28, F1 25 a conduzir, C5,
          # volta 5. O MFD do jogo lia 12 / 17 / 12 / 13 % e o painel
          # 10.0 / 14.2 / 10.2 / 11.3 -- a mesma grandeza, roda a roda, e
          # o FR o pior das duas maneiras. No mesmo instante o jogo dava
          # `usableLife` 21 e `lifeSpan` 19, ou seja 2 voltas corridas:
          #
          #     2 de 21 = 9,5 % usado.  O medido e' 10,0 %.  Bate.
          #
          # Se fosse "quanto resta", 10,0 % de resto seriam 19 voltas
          # gastas, e o jogo anunciaria "faltam 2" em vez de "faltam 19".
          # E' aritmeticamente impossivel, e nao so improvavel:
          #
          # A MEDICAO INTEIRA: `docs/medicao-desgaste-f125.md`.
          #
          # O COMENTARIO QUE ESTAVA AQUI, e que estava ERRADO, dizia "0 a
          # 100 com 100 = NOVO, exactamente como o `tyreWear` da memoria
          # do AC. Mesma direcao, portanto a mesma formula de vida do pneu
          # serve aos dois sem converter nada." Foi escrito por ANALOGIA
          # com o AC, e a analogia e' o que falha: os dois campos chamam-
          # se `tyreWear` e significam o contrario. E a consequencia nao era
          # cosmetica -- a formula do AC e' `100 - wear` para obter o
          # gasto, e aplicada aqui sem converter dava 10 % de gasto num
          # pneu que o jogo diz que ainda tem 19 voltas de 21.
          #
          # A CORRECCAO QUE VEIO DA MEDICAO esta no desenho, e nao aqui:
          # o painel mostrava este valor com a etiqueta de "aderencia" e
          # pintava a vermelho o que fosse menor que 20 -- ou seja, os
          # pneus NOVOS do F1 25. Ver `desgastePneu` em `jogos/f125.js`.
        desgaste = [None] * 4
        dano = [None] * 4
        travões = [None] * 4
        bolhas = [None] * 4
        for i in range(4):
            j = TRADUCAO[i]
            desgaste[j] = _f(d.tyresWear[i], 1)
            dano[j] = _i(d.tyresDamage[i])
            travões[j] = _i(d.brakesDamage[i])
            bolhas[j] = _i(d.tyreBlisters[i])

        fitted = _i(n.fittedIdx, -1) if n is not None else -1
        vida = None
        vidaMax = None
        desgasteConjunto = None
        if n is not None and 0 <= fitted < 20:
            conjunto = n.sets[fitted]
            # lifeSpan e' VOLTAS QUE FALTAM. E' o numero que o AC nao
            # tem, e que lá e' estimado a partir de duas voltas medidas
            # de desgaste. Aqui e' lido. E a diferenca mais grande entre
            # os dois paineis.
            vida = _i(conjunto.lifeSpan)
            vidaMax = _i(conjunto.usableLife)
            desgasteConjunto = _i(conjunto.wear)

        return {
            "desgaste": desgaste,
            "dano": dano,
            "danoTravões": travões,
            "bolhas": bolhas,
            "vida": vida,
            "vidaMax": vidaMax,
            "desgasteConjunto": desgasteConjunto,
            "wingEsquerda": _i(d.frontLeftWingDamage),
            "wingDireita": _i(d.frontRightWingDamage),
            "wingTraseira": _i(d.rearWingDamage),
            "assoalho": _i(d.floorDamage),
            "difusor": _i(d.diffuserDamage),
            "sidepod": _i(d.sidepodDamage),
            "caixa": _i(d.gearBoxDamage),
            "motor": _i(d.engineDamage),
            "componentes": {
                "MGU-H": _i(d.engineMGUHWear), "ES": _i(d.engineESWear),
                "CE": _i(d.engineCEWear), "ICE": _i(d.engineICEWear),
                "MGU-K": _i(d.engineMGUKWear), "TC": _i(d.engineTCWear),
            },
            "erroDrs": bool(int(d.drsFault)),
            "erroErs": bool(int(d.ersFault)),
            "motorRebentou": bool(int(d.engineBlown)),
            "motorPreso": bool(int(d.engineSeized)),
        }

    def _fisica(self, p, idx, formato):
        m = p.get(PacketId.MOTION)
        x = p.get(PacketId.MOTION_EX)
        d = {}
        if m is not None:
            v = m.cars[idx]
            if formato == 2026:
                # As forcas G sao int16 QUANTIZADAS no 2026: dividir por
                # 1000. Sem isto, 4200 em vez de 4,2 G, e um grafico de
                # forca lateral mil vezes grande demais.
                gl = round(float(v.gLat) / 1000.0, 3)
                gv = round(float(v.gLong) / 1000.0, 3)
                gz = round(float(v.gVert) / 1000.0, 3)
            else:
                gl = round(float(v.gLat), 3)
                gv = round(float(v.gLong), 3)
                gz = round(float(v.gVert), 3)
            d.update({
                # X-Z e' o plano da pista, Y e' a ALTITUDE, como no AC.
                "x": _f(v.posX), "y": _f(v.posY), "z": _f(v.posZ),
                "vx": _f(v.velX), "vy": _f(v.velY), "vz": _f(v.velZ),
                "gLateral": gl, "gLongitudinal": gv, "gVertical": gz,
                "yaw": round(float(v.yaw), 4),
                "pitch": round(float(v.pitch), 4),
                "roll": round(float(v.roll), 4),
            })
        if x is not None:
            ratio = [None] * 4
            angulo = [None] * 4
            forcaLat = [None] * 4
            forcaLong = [None] * 4
            forcaVert = [None] * 4
            camber = [None] * 4
            for i in range(4):
                j = TRADUCAO[i]
                ratio[j] = _f(x.wheelSlipRatio[i], 3)
                angulo[j] = _f(x.wheelSlipAngle[i], 3)
                forcaLat[j] = _f(x.wheelLatForce[i], 0)
                forcaLong[j] = _f(x.wheelLongForce[i], 0)
                forcaVert[j] = _f(x.wheelVertForce[i], 0)
                camber[j] = round(float(x.wheelCamber[i]), 4)
            d.update({
                # Estes dois sao o indice de aderencia de verdade. O
                # wheelSlip do AC e' uma percentagem de escorregamento,
                # que e' outra coisa, e comparar os dois numeros seria
                # comparar coisas diferentes.
                "escorregamentoRatio": ratio,
                "escorregamentoAngulo": angulo,
                "forcaLateral": forcaLat,
                "forcaLongitudinal": forcaLong,
                "forcaVertical": forcaVert,
                "camber": camber,
                # O angulo REAL da roda da frente, em radianos. No AC
                # nao existe, e e' o que resolveria a duvida da escala do
                # volante.
                "anguloRoda": round(float(x.frontWheelsAngle), 4),
                "alturaG": _f(x.heightOfCOGAboveGround, 3),
                "assCalhaFrente": _f(x.frontAeroHeight, 4),
                "assCalhaTras": _f(x.rearAeroHeight, 4),
                "chassiGuinada": round(float(x.chassisYaw), 4),
                "chassiArfagem": round(float(x.chassisPitch), 4),
            })
        return d

    def _setup(self, p, idx):
        s = p.get(PacketId.SETUPS)
        if s is None:
            return {}
        v = s.cars[idx]
        return {
            "asaFrente": _i(v.frontWing),
            "asaTras": _i(v.rearWing),
            "camberFrente": round(float(v.frontCamber), 2),
            "camberTras": round(float(v.rearCamber), 2),
            "toeFrente": round(float(v.frontToe), 2),
            "toeTras": round(float(v.rearToe), 2),
            "alturaFrente": _i(v.frontSuspensionHeight),
            "alturaTras": _i(v.rearSuspensionHeight),
            "pressaoTravAO": _i(v.brakePressure),
            "biasTrava": _i(v.brakeBias),
            "travaMotor": _i(v.engineBraking),
            "balastroKg": _i(v.ballast),
            "combustivelKg": _f(v.fuelLoad),
        }

    def opponents(self):
        """A classificacao, montada de tres packets.

        No F1 25 isto e' uma coisa simples e no AC e' o trabalho de uma
        app inteira que corre dentro do jogo. O jogo manda o estado de
        todos os carros, sem pedir nada em troca e sem instalacao.

        A excepcao que obriga a cuidado: com o `m_yourTelemetry` em
        RESTRITO -- que e' a omissao nas opcoes -- o jogo poe a ZERO o
        combustivel, o ERS e todo o dano dos adversarios. Zero e'
        plausivel, e um painel que diz "sem ERS" esta' a mentir. Por
        isso publicamos tambem se a telemetria esta' restrita, e o painel
        diz isso em vez de mostrar os zeros. Regra no 23 do f1-25.md.
        """
        e = self.estado
        with self._lock:
            if not e.validos:
                return {"available": False, "cars": [],
                        "motivo": "sem pacotes UDP validos"}
            if e.formato is None:
                return {"available": False, "cars": [],
                        "motivo": "formato desconhecido"}
            p = dict(e.pacotes)
            idx = e.playerIndex
            restrito = False
            parc = p.get(PacketId.PARTICIPANTS)
            if parc is not None and 0 <= idx < len(parc.cars):
                restrito = int(parc.cars[idx].yourTelemetry) == 0

        lap = p.get(PacketId.LAP)
        tel = p.get(PacketId.TELEMETRY)
        status = p.get(PacketId.STATUS)
        dano = p.get(PacketId.DAMAGE)
        if lap is None:
            return {"available": False, "cars": [],
                    "motivo": "sem pacote de voltas"}

        n = len(lap.cars)
        nomes = {}
        if parc is not None:
            for i in range(min(int(parc.numActiveCars), n)):
                nomes[i] = _texto(parc.cars[i].name)

        carros = []
        for i in range(n):
            v = lap.cars[i]
            # E' ESTE campo, e nao o m_numActiveCars, que decide se um
            # carro tem dados. Um carro com resultStatus 1 (inactivo) tem
            # zeros em tudo, e um zero e' plausivel.
            res = int(v.resultStatus)
            if res in (0, 1):
                continue
            nome = nomes.get(i) or ("Carro %d" % (i + 1))
            c = {
                "id": i,
                "nome": nome,
                "pos": _i(v.carPosition, 0),
                "volta": _i(v.currentLapNum),
                "estado": res,
                "invalida": bool(int(v.currentLapInvalid)),
                "box": _i(v.pitStatus) > 0,
                "paradas": _i(v.numPitStops),
                "atual": _ms(int(v.currentLapTimeInMS)),
                "anterior": _ms(int(v.lastLapTimeInMS)),
                "penalidadeS": _i(v.penalties),
                "velocidadeArmadilha": _f(v.speedTrapFastestSpeed, 1),
                # A melhor volta de cada um so vem no Session History, que
                # so chega no fim. Portanto fica a None em vez de 0: 0 s
                # seria "fiz 0.000", e None e' "ainda nao sei". E a chave
                # existe SEMPRE, mesmo sem o pacote -- uma chave em falta
                # obriga o frontend a decidir sozinho, e uma decisao
                # tomada no sitio errado e' a forma mais facil de mostrar
                # "--" onde devia mostrar um valor. Regra no 14.
                "melhor": None,
                "deltaLider": logica.tempo_de_minutos(
                    v.deltaToRaceLeaderMinutesPart, v.deltaToRaceLeaderMSPart) or None,
                "s1": _ms(logica.tempo_de_minutos(
                    v.sector1TimeMinutesPart, v.sector1TimeMSPart)),
                "s2": _ms(logica.tempo_de_minutos(
                    v.sector2TimeMinutesPart, v.sector2TimeMSPart)),
                "distancia": _f(v.lapDistance, 1),
                "nosso": i == idx,
            }
            if tel is not None and i < len(tel.cars):
                c["velocidade"] = _i(tel.cars[i].speed)
                c["caixa"] = logica.caixa(tel.cars[i].gear)
            # dadosEscondidos e' posto ANTES do if, para a chave
            # existir sempre. Significa: "estes numeros estao a zero
            # porque o jogo os escondeu", e nao "o jogo nao mandou".
            # Sao situacoes diferentes e o painel tem de as pintar
            # diferente.
            c["dadosEscondidos"] = restrito
            if status is not None and i < len(status.cars):
                st = status.cars[i]
                c["compoundId"] = _i(st.actualTyreCompound)
                c["idadePneu"] = _i(st.tyresAgeLaps)
                # Com o telemetria restrita estes dois vem a zero do
                # jogo, nao por bug. Publicamos o valor E a marca, para o
                # painel poder distinguir "0" de "escondido".
                c["combustivelKg"] = _f(st.fuelInTank)
                c["ersStoreJ"] = _f(st.ersStoreEnergy, 0)
                c["dadosEscondidos"] = restrito
            if dano is not None and i < len(dano.cars):
                c["pneuDesgaste"] = _f(dano.cars[i].tyresWear[0], 1)
            carros.append(c)

        # A melhor volta de cada um so vem no Session History, que so
        # chega no fim. Portanto `melhor` fica a None em vez de 0: 0 s
        # seria "fiz 0.000", e None e' "ainda nao sei".
        carros.sort(key=lambda d: (d["pos"] if d["pos"] else 999, d["nome"]))
        return {
            "available": True,
            "jogo": "f125",
            "restrito": restrito,
            "focus": idx,
            "count": len(carros),
            "cars": carros,
        }


def _vazio():
    """O payload quando ainda nao se sabe nada.

    As chaves TODAS presentes, com None. Uma chave em falta faz o
    frontend decidir sozinho, e uma decisao tomada no sitio errado e' a
    forma mais facil de mostrar "--" onde devia mostrar um valor. Regra
    no 14 do AGENTS.md.
    """
    return {
        "track": {}, "car": {}, "laps": {}, "pneus": {}, "danos": {},
        "fisica": {}, "setup": {},
    }
