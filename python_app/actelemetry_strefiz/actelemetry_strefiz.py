"""
AssettoCorsaTelemetry -- app Python para o Assetto Corsa.

Corre DENTRO do jogo, em
assettocorsa/apps/python/actelemetry_strefiz/.
Escreve a pagina de memoria partilhada "acpmf_actelemetry_v2", que e'
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

# ---------------------------------------------------------------------------
# O CTYPES QUE CARREGOU, E' O CERTO?
# ---------------------------------------------------------------------------
# O `sys.path.insert` acima e' a proteccao, e uma proteccao fraca: uma
# entrada de `sys.path` que NAO EXISTE e' ignorada em silencio pelo
# Python, sem erro e sem aviso. Provado -- meter um caminho que nao
# existe a frente do `sys.path` e fazer `import ctypes` da o ctypes do
# SISTEMA, sem uma palavra.
#
# E o caso nao e' teorico. Os `_ctypes.pyd` NAO estao no git: um
# `git archive` do repositorio traz dois ficheiros em
# `python_app/actelemetry_strefiz/` e nenhuma pasta `stdlib`. Quem faz
# clone, copia a pasta para o jogo e liga a app fica, sem um unico sinal,
# com a proteccao exactamente a ausente que o comentario de cima proibe
# -- e com a struct escrita com os tamanhos do ctypes errado.
#
# Por isso o resultado e' VERIFICADO, e nao presumido. O `_ctypes` e' a
# extensao C que define `c_float` e `c_int32`; ela vem de dentro da
# pasta que acabamos de meter a frente. Se vier de outro sítio, diz-se
# alto, porque daqui em diante os numeros da struct sao numeros de outro
# interpreter.
#
# Nao se aborta. O dashboard nao mostra nada, e um `raise` aqui seria
# indistinguivel do sintoma que ja' conhecemos -- "a app nao arrancou,
# vai ver o log". Registar e' o que separa as duas coisas.
import _ctypes as _ctypes_cargado

_CORRECTO = os.path.normcase(os.path.abspath(sysdir)) in \
    os.path.normcase(os.path.abspath(os.path.dirname(_ctypes_cargado.__file__)))

if not _CORRECTO:
    ac.console('AssettoCorsaTelemetry: AVISO GRAVE -- o ctypes carregado '
               'e' + chr(39) + ' o do sistema, e nao o do jogo. A struct '
               'fica com o tamanho errado e os valores lidos vao estar '
               'errados sem dar erro nenhum.')
    ac.log('AssettoCorsaTelemetry: o _ctypes veio de %s, e devia ter vindo '
           'de %s' % (_ctypes_cargado.__file__, sysdir))
    ac.log('AssettoCorsaTelemetry: a pasta %s nao existe, ou esta vazia. '
           'Corre "python instalar_app.py" na raiz do projecto, que copia '
           'os .pyd do jogo para aqui. Ou copia-os a mao de '
           'assettocorsa/apps/python/system/lib-dynload/.' % sysdir)
else:
    ac.log('AssettoCorsaTelemetry: ctypes do jogo, de %s'
           % os.path.basename(_ctypes_cargado.__file__))

shared = Shared()

VERSION = "1.1.0"

# ---------------------------------------------------------------------------
# O CLIMA
# ---------------------------------------------------------------------------
# A memoria partilhada nao tem chuva. Confirmado campo a campo: a pagina de
# graficos tem windSpeed e windDirection e mais nada, e a de fisica tem
# surfaceGrip, que e' o EFEITO da pista molhada e nao a chuva. Ver chuva.md.
#
# Mas a API Python tem, e isso so apareceu agora que temos uma app a correr
# DENTRO do jogo. O inventario saiu das apps Python desta instalacao --
# sobretudo do sol_weather, que e' a app de clima e usa todas:
#
#   ac.ext_weatherFxActive()    -> bool   a chuva esta' a renderizar
#   ac.ext_rainParams()         -> [0] = chuva 0..1,  [1] = limpa-para-brisas
#   ac.ext_weatherDebugText()   -> str    "current day: 2020-05-06 16:31:25..."
#   ac.ext_getWeatherTimeMult() -> float  quao depressa o clima avanca
#   ac.ext_patchVersionCode()   -> int    a versao do Custom Shaders Patch
#
# OS QUE NAO SE CHAMAM, E PORQUE:
#   ext_rainParamsSet, ext_rainParamsAdjust, ext_setWeatherTimeMult,
#   ext_weatherTimeOffset, ext_applyTrackConfig, ext_takeAStepBack
# Todas ESCREVEM no estado do jogo. Uma app de telemetria que muda o
# clima estraga a sessao de quem a instalou, e a Regra no 1 fala de
# memoria partilhada mas o espirito e' o mesmo. So' se le.
#
# SONDAR UMA VEZ, E SO' UMA
# Se uma destas funcoes nao existir -- e nao existe se o Custom Shaders
# Patch nao a expor ao Python -- e a chamassemos a cada frame, teriamos
# 40 erros por segundo por funcao em falta. Com quatro, 160. E' o modo de
# falha que o lastError passou a denunciar, e que transformou o contador
# em ruido: 1 001 704 erros que eram uma linha errada.
#
# Por isso: um getattr no arranque, e a partir dai ou a funcao esta' na
# mao ou vale None. Nao ha' hasattr dentro do laco, e nao ha' excepcao
# possivel de uma funcao que sabemos que nao existe.
#
# O -1 que se publica e' "nao sei", e nao "zero". Um zero de chuva seria
# mentira, e a diferença entre "nao chove" e "isto nao esta' disponivel"
# e' o que separa uma leitura de uma invencao.

_EXT = {}

# A SONDA DO DESGASTE, e separada da do clima de proposito.
#
# O clima vem do Custom Shaders Patch, que expoe funcoes `ac.ext_*`. O
# desgaste vem da OUTRA interface -- a do objecto carro -- que e' a que
# o HUD do Content Manager usa. Sao sondagens diferentes, e uma falhar
# nao tem nada a ver com a outra.
#
# A PERGUNTA: `ac.getCar` existe em PYTHON?
#
#   - o SDK de Lua tem, e documenta `.wheels[0..3].tyreWear` como fracao
#     0..1, onde 1 e' o pneu gasto. E' a mesma grandeza que o HUD mostra
#     com `(1 - tyreWear) * 100`;
#   - o enum `CS` do `acsys.py`, que e' o que o Python usa, tem **73
#     campos e nenhum e' o desgaste**. Nao ha' `TyreWear` nem equivalente;
#   - e nao ha' SDK de Python do CSP na instalacao: o modulo `ac` e'
#     injectado pelo Content Manager em runtime, e a unica API
#     documentada em disco e' o `acsys.py`.
#
# Portanto nao se supoe -- mede-se. E mede-se NO LOG, e nao na struct: a
# struct que crescer obriga os dois lados a mudar no mesmo instante, e
# ate o AC reiniciar o leitor da' `available: false` e a lista de
# adversarios esvazia. Nao se paga esse preco para uma medicao.
#
# A conta que prova que sao grandezas diferentes ja esta feita, e nao
# precisa da sonda: a memoria partilhada da' 100,0 e a formula do HUD
# aplicada a esse valor da' -9900.
_EXT_PNEU = {'estado': 'por sondar'}


def _sondaPneu():
    """Se `ac.getCar` existe em Python, e o que as rodas dao.

    Le DUAS vezes, de proposito: o carro da CAMERA, que e' o que o HUD
    mostra, e o carro 0, que e' o jogador. A diferenca entre os dois e'
    a razao de ser uma comparacao e nao uma leitura -- e ja foi o que
    happens no primeiro bug da secao: o painel a mostrar o pneu de outra
    pessoa."""
    f = getattr(ac, 'getCar', None)
    if f is None:
        _EXT_PNEU['estado'] = 'sem getCar'
        ac.log('AssettoCorsaTelemetry: ac.getCar NAO existe em Python. '
               'O desgaste fica so com o campo de aderencia da memoria '
               'partilhada, que e\' outra grandeza. Regra nº 18.')
        return
    partes = []
    for indice, nome in ((None, 'camera'), (0, 'jogador')):
        try:
            carro = ac.getSim().focusedCar if indice is None else indice
            c = f(carro)
            rodas = getattr(c, 'wheels', None)
            if not rodas:
                partes.append('%s= sem rodas' % nome)
                continue
            vals = []
            for i in range(4):
                v = getattr(rodas[i], 'tyreWear', None)
                vals.append('%.3f' % v if isinstance(v, (int, float)) else '?')
            partes.append('%s(carro %s) = %s' % (nome, carro, ' '.join(vals)))
        except Exception as e:
            partes.append('%s= ERRO %s' % (nome, e))
    _EXT_PNEU['estado'] = ' | '.join(partes)
    ac.log('AssettoCorsaTelemetry: desgaste pela Lua -- %s'
           % _EXT_PNEU['estado'])
    ac.log('AssettoCorsaTelemetry: o `tyreWear` da memoria partilhada deu '
           '100,0 e a formula do HUD aplicada a esse valor daria -9900, '
           'logo sao grandezas diferentes. o do HUD.')


def _sondaClima():
    """Procura as funcoes de clima uma vez, no arranque."""
    for nome in ("ext_weatherFxActive", "ext_rainParams",
                 "ext_weatherDebugText", "ext_getWeatherTimeMult",
                 "ext_patchVersionCode",
                 "getWindSpeed", "getWindDirection"):
        _EXT[nome] = getattr(ac, nome, None)

    emFalta = [n for n, f in _EXT.items() if f is None]
    if emFalta:
        ac.log('AssettoCorsaTelemetry: sem estas funcoes de clima: %s'
               % ', '.join(emFalta))
        ac.log('AssettoCorsaTelemetry: o painel vai dizer que o clima '
               'esta indisponivel, e nao vai mostrar zero.')
    else:
        ac.log('AssettoCorsaTelemetry: clima disponivel '
               '(%d funcoes).' % len(_EXT))


def _leClima():
    """O clima da sessao, para o cabecalho da pagina.

    Devolve None quando a funcao nao existe ou rebentou. O -1 que vai
    para a pagina e' o mesmo "nao sei" de sempre.

    O vento e' lido DUAS VEZES DE PROPOSITO: uma pela API
    (ac.getWindSpeed) e outra pela memoria partilhada, que ja' a
    dashboard le. Se derem o mesmo numero -- e a razao para as ler as
    duas e' essa -- entao a API Python ve o mesmo mundo que a memoria, e
    isso valida a premissa de tudo o que esta app escreve. Se
    diferirem, a diferenca fica publicada e da' para investigar. E uma
    transformacao de suposicao em medicao, e custa dois campos. """
    f = _EXT
    out = {'rainAmount': -1.0, 'rainFxActive': -1, 'windSpeedApi': -1.0,
           'windDirApi': -1.0, 'weatherTimeMult': -1.0,
           'cspVersionCode': -1, 'weatherDebug': b''}

    if f.get('ext_rainParams') is not None:
        rp, ok = _tentar(f['ext_rainParams'], None)
        # sol_weather: RainParams[0] e' a chuva (0..1) e [1] as
        # limpa-para-brisas. Vem como sequencia.
        if ok and rp is not None:
            try:
                out['rainAmount'] = float(rp[0])
            except Exception as e:
                _anotaErro(e)

    if f.get('ext_weatherFxActive') is not None:
        v, ok = _tentar(f['ext_weatherFxActive'], None)
        if ok:
            out['rainFxActive'] = 1 if v else 0

    if f.get('getWindSpeed') is not None:
        v, ok = _tentar(f['getWindSpeed'], None)
        if ok and v is not None:
            out['windSpeedApi'] = float(v)

    if f.get('getWindDirection') is not None:
        v, ok = _tentar(f['getWindDirection'], None)
        if ok and v is not None:
            out['windDirApi'] = float(v)

    if f.get('ext_getWeatherTimeMult') is not None:
        v, ok = _tentar(f['ext_getWeatherTimeMult'], None)
        if ok and v is not None:
            out['weatherTimeMult'] = float(v)

    if f.get('ext_patchVersionCode') is not None:
        v, ok = _tentar(f['ext_patchVersionCode'], None)
        if ok and v is not None:
            try:
                out['cspVersionCode'] = int(v)
            except Exception as e:
                _anotaErro(e)

    # O texto cru. Nao se sabe o que traz a nao ser o que o sol_weather
    # extrai com uma regex -- e a forma de saber e' ler. 128 bytes dao
    # para a data e mais umas coisas, e se nao chegar amplia-se.
    if f.get('ext_weatherDebugText') is not None:
        v, ok = _tentar(f['ext_weatherDebugText'], None)
        if ok and v:
            out['weatherDebug'] = _texto(v, 127)

    return out


timer = 0
event = threading.Event()
stop_thread = False

# Quantas leiturasaram exception. Um contador e' melhor que nada: se o
# AC mudar a API um dia, o numero sobe e da para ver, em vez de a app
# falhar em silencio.
erros = 0


def _seguro(ler, alt=0):
    """Le um valor do AC sem deixar uma excepcao matar a thread.

    A versao anterior nao tinha isto. Uma unica leitura que levantasse
    excepcao matava o thread, e o dashboard ficava congelado no ultimo
    estado sem explicar nada -- o pior defeito possivel, porque parece
    que o jogo parou. Ler e' sempre melhor do que morrer.

    O `alt` por omissao e' 0, INTEIRO, e nao 0.0. Isto nao e' um
    detalhe: a struct tem campos c_int32 (bestLapMS, lapCount,
    isConnected, drsAvailable, ...) e o ctypes recusa um float num
    campo inteiro --

        TypeError: 'float' object cannot be interpreted as an integer

    -- em ATRIBUICAO, que e' depois de o _seguro ja ter devolvido. Ou
    seja: o _seguro impedia a excepcao de matar o fio, e a excecao
    reaparecia um instante depois, na mesma linha, dentro do
    actualizar(). Com o omissao a 0.0, qualquer leitura Integer que
    falhasse matava o ciclo todo, e a leaderboard esvaziava sem dizer
    nada -- o mesmo sintoma, outra causa.

    O 0 funciona nos dois: o ctypes converte int para c_float sem
    problema. O 0.0 so' funciona em campos float.

    O `alt` e' o valor devolvido quando a leitura falha. ESCOLHE-O COM
    CUIDADO: se o `alt` for um valor que o AC usa para dizer uma coisa
    (o '-1' de getCarName, por exemplo), entao uma excepcao passa a
    significar essa coisa, e nenhum sitio da app consegue mais distinguir
    "o jogo disse que nao ha' carro" de "a leitura rebentou". Foi
    exactamente o que aconteceu: o _seguro escondia a falha tao bem que
    a leaderboard ficava vazia e o dashboard culpava a app nao estar
    ligada -- que era a instrucao errada.

    Quando precisares de distinguir, usa _tentar(), que devolve um
    (valor, deu_certo) em vez de esconder a falha dentro do valor.

    Tambem anota o TEXTO do erro, e nao so' o contador. Sem isso o
    contador subia e o lastError ficava vazio -- porque quase todas as
    leituras passam pelo _seguro, e e' _tentar que anotava. Um contador
    que sobe sem dizer o que falhou e' metade do problema: obriga a ir
    ao log do AC, que ninguem tem aberto.
    """
    global erros
    try:
        return ler()
    except Exception as e:
        erros += 1
        _anotaErro(e)
        return alt


def _tentar(ler, alt=None):
    """(valor, deu_certo) -- e' o _seguro que nao esconde a falha.

    Existe porque o _seguro e' bom para valores onde um valor
    significa "isto e' mesmo o que o jogo disse", e mau para valores
    onde um valor tambem significa "isto falhou". Com os dois
    separadas, uma excepcia deixa de parecer uma resposta do jogo.
    """
    global erros
    try:
        return ler(), True
    except Exception as e:
        erros += 1
        _anotaErro(e)
        return alt, False


# O ultimo erro, para publicar. Um contador sozinho diz que alguma
# coisa falhou; o texto diz o quê -- e sem o texto, a unica pista que
# o dashboard tem para dar e' a instrucao errada.
_ultimoErro = ''


def _anotaErro(e):
    global _ultimoErro
    msg = '%s: %s' % (type(e).__name__, e)
    _ultimoErro = msg[:120]
    try:
        ac.log('AssettoCorsaTelemetry: %s' % _ultimoErro)
    except Exception:
        pass


def _num(v, roda=None):
    """O que o getCarState devolve, convertido para numero.

    MEDIDO, COM O JOGO A CORRER: para CurrentTyresCoreTemp, LastTyresTemp,
    TurboBoost e KersCharge, o ac.getCarState() NAO devolve um numero --
    devolve uma sequencia. O float() de antes rebentava com

        TypeError: float() argument must be a string or a number

    1 001 704 vezes em duas voltas, e os quatro campos ficavam a zero sem
    que nada o dissesse. (E' este erro que fez o lastError valer a pena
    ser publicado: sem ele, a contagem de erros existia mas nao dizia o
    que era.)

    O mesmo getCarState, SEM conversao, funciona bem noutros campos:
    speedMS, spLineLength e worldPosition chegam certos. E com int(), o
    Gear chega certo. Ou seja: a chamada esta' certa, a conversao e' que
    estava errada.

    O QUE NAO SEI, e que este comentario nao finge saber: se a sequencia
    tem 1 elemento ou 4. Sao duas leituras diferentes para as
    temperaturas dos pneus -- se sao 4 e eu ler [0] para todos os quatro,
    as quatro temperaturas ficam iguais, que e' o sintoma que a
    docstring de _tempPorPneu descreve. Por isso o codigo NAO escolhe: se
    vierem 4, tira o elemento da roda pedida; se vier 1, tira o unico.
    Cobre as duas sem adivinhar. E a mensagem de erro inclui o tipo e o
    conteudo, para o proximo arranque do jogo dizer qual era.
    """
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, (list, tuple)):
        if len(v) == 1:
            return float(v[0])
        if roda is not None and len(v) > roda:
            return float(v[roda])
        if len(v) > 0:
            return float(v[0])
    raise TypeError('getCarState devolveu %s(%r), que nao e' + "' "
                    + 'um numero' % (type(v).__name__, v))


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

    USA-SE range(4) E NAO acsys.WHEELS. O acsys.py define

        class WHEELS:FL,FR,RL,RR=range(4)

    que e' uma CLASSE, nao uma lista nem um enumerado. Percorrer uma
    classe levanta TypeError: 'type' object is not iterable -- e esse
    TypeError nascia na LISTA COMPREENSIVA, ou seja FORA do _seguro, e
    portanto subia ate ao actualizar() e matava o ciclo inteiro.

    Era este o bug da leaderboard. O _tempPorPneu e' um ARGUMENTO de
    escreverCarro, logo e' avaliado ANTES da chamada. O numVehicles ja'
    tinha sido escrito (vem antes no loop), e por isso o cabecalho da
    pagina mostrava 11 carros enquanto os 128 slots ficavam a zero: uma
    lista vazia, sem erro na consola e sem nada no log.
    """
    return [_seguro(lambda: _num(ac.getCarState(carro, estado, roda), roda))
            for roda in range(4)]


def _texto(v, n=63):
    """str/bytes -> bytes de ate' n, para um campo c_char * (n+1).

    O campo tem de ser bytes: o ctypes aceita uma str num c_char*64
    apenas se tiver exactamente 64 caracteres, e o que o jogo dá tem
    comprimento variavel -- o que rebentaria a app em vez de a ler.
    """
    if v is None:
        return b''
    if not isinstance(v, bytes):
        try:
            v = str(v).encode('utf-8')
        except Exception:
            return b''
    return v[:n]


def escreverCarro(carId, info, nome, tempNuclear, tempBanda):
    info.carId = carId
    # O nome do carro ja' foi lido no loop, e veio de _tentar -- ou seja,
    # ou e' o que o jogo disse, ou a leitura falhou. Nao se volta a
    # perguntar: uma segunda leitura da mesma coisa que falhou volta a
    # falhar, e engole a falha outra vez.
    info.driverName = _texto(_seguro(lambda: ac.getDriverName(carId), ''))
    info.carModel = _texto(nome)
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
        lambda: _num(ac.getCarState(carId, acsys.CS.TurboBoost)))
    info.kersCharge = _seguro(
        lambda: _num(ac.getCarState(carId, acsys.CS.KersCharge)))
    info.drsAvailable = _seguro(
        lambda: int(_num(ac.getCarState(carId, acsys.CS.DrsAvailable))))
    info.drsEnabled = _seguro(
        lambda: int(_num(ac.getCarState(carId, acsys.CS.DrsEnabled))))
    # A caixa pela API. O HUD do Content Manager tira a caixa daqui, e
    # nos tiramos do 'gear' da pagina de fisica -- campos com o mesmo
    # nome em interfaces diferentes (Regra no 18). Ha' um bug em que
    # aparece +1, e a unica forma de o decidir e' ter os dois valores no
    # mesmo instante.
    #
    # A sentinela e' -99 e NAO -1, porque -1 e' o reveso: um valor que
    # e' valido seria lido como "caixa invalida", que e' exactamente o
    # bug que se quer ver. Nenhuma caixa chega a -99.
    info.gearApi = _seguro(lambda: int(_num(ac.getCarState(carId, acsys.CS.Gear))), -99)

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


    n, ok = _tentar(ac.getCarsCount, 0)
    page.numVehicles = n
    page.focusVehicle = _seguro(ac.getFocusedCar)

    # O clima, no cabecalho. E' clima da sessao, nao de cada carro, por
    # isso vai aqui e nao nos 128 slots.
    clima = _leClima()
    page.rainAmount = clima['rainAmount']
    page.rainFxActive = clima['rainFxActive']
    page.windSpeedApi = clima['windSpeedApi']
    page.windDirApi = clima['windDirApi']
    page.weatherTimeMult = clima['weatherTimeMult']
    page.cspVersionCode = clima['cspVersionCode']
    page.weatherDebug = clima['weatherDebug']

    _publicaErros(page)

    # O fim da lista e' o getCarsCount(), que e' a contagem que o jogo
    # deu. Antes o loop terminava quando getCarName devolvia '-1', e era
    # ESSA a linha que matava tudo: o _seguro devolvia '-1' tambem
    # quando a leitura rebentava, portanto qualquer excepcao -- uma API
    # renomeada, um argumento errado, o que fosse -- punha a app a
    # concluir que a pista estava vazia, para sempre, sem dar erro.
    #
    # Medido com o jogo a correr: numVehicles chegava a 11 e os 128
    # carros ficavam todos a zero, ao mesmo tempo, durante toda a
    # corrida.
    #
    # Agora o nome so' serve para mostrar. Se a leitura falhar, o carro
    # e' escrito na mesma (sem nome) e o erro fica publicado no cabecalho
    # -- em vez de a lista parecer vazia e o dashboard culpar a app nao
    # estar ligada, que era a instrucao errada.
    for carId in range(0, min(n, 128)):
        nome, deuCerto = _tentar(lambda: ac.getCarName(carId), '')
        if deuCerto and str(nome) == '-1':
            # o jogo diz mesmo que este slot esta' livre
            break
        escreverCarro(carId, page.carInfo[carId], nome,
                      _tempPorPneu(carId, acsys.CS.CurrentTyresCoreTemp),
                      _tempPorPneu(carId, acsys.CS.LastTyresTemp))

    # Publica-se tambem no fim do ciclo. No inicio, so' diria o que ja'
    # tinha acontecido no ciclo ANTERIOR -- e um erro que acontece uma
    # vez so' (uma API que mudou de nome) aparecia 25 ms mais tarde, o
    # que parece ser "nao ha' nada". No fim do ciclo, o erro em que
    # estamos ja' esta' publicado.
    _publicaErros(page)


def _publicaErros(page):
    page.errorCount = erros
    page.lastError = _ultimoErro.encode('utf-8')


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

    # Sondar o clima ANTES de qualquer escrita. Ver _sondaClima(): e
    # uma vez so, no arranque, e e o que impede 160 erros por segundo
    # quando o Custom Shaders Patch nao expoe alguma das funcoes ao
    # Python. Chamar isto aqui dentro, a cada ciclo, seria
    # precisamente o erro que a funcao existe para evitar.
    _sondaClima()
    # E a do desgaste, pelo mesmo motivo e pela mesma razao: uma vez so,
    # no arranque. A DIFFERENCA e' que esta nao escreve nada na pagina --
    # so' mede se `ac.getCar` existe em Python, e deixa o resultado no
    # log. Publicar o valor exigiria crescer a struct, e a struct que
    # cresce obriga os dois lados a mudar no mesmo instante, com a lista
    # de adversarios a esvaziar ate o AC reiniciar. Ver _sondaPneu().
    _sondaPneu()

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
