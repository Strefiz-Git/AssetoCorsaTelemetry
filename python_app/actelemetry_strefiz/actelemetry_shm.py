"""
Struct da pagina de memoria partilhada entre o Assetto Corsa e o
AssettoCorsaTelemetry.

Esta e' a NOSSA app -- nao ha' nada do SimHub aqui dentro. O que
existia antes (a pasta "SimHub", com os ficheiros SimHub.py e
simhub_shared_mem.py) e' o mesmo codigo com outro nome; a unica coisa
que mudou a serio foi o que esta a pagina da struct -- ver os campos
marcados TROCADOS.

O NOME DA PAGINA e' o contrato entre os dois lados:

    writer  (aqui, dentro do jogo)   mmap.mmap(0, tam, NOME)
    reader  (acshm.py, fora do jogo) CreateFileMappingW(..., NOME)

Se um dos dois escrever um nome diferente da outra, o leitor abre um
mapeamento vazio e o dashboard diz que nao ha' adversarios -- sem erro
nenhum. Por isso o nome esta escrito num comentario bem visivel nos dois
ficheiros, e tests/test_contrato.py falla se algum deles mudar sozinho.

Por que um nome novo em vez de continuar "acpmf_simhub_v3": porque a
struct mudou de tamanho, e um mapeamento antigo (struct mais pequena)
combinado com um leitor novo (struct maior) faz o leitor ir buscar
bytes a seguir ao fim real da pagina. E' um bug silencioso e feio. Com
um nome que nao existia antes, so' ha' duas possibilidades: esta' tudo
actualizado e funciona, ou a pagina nao existe e o acshm.py responde
available=False, que e' o comportamento certo.

imports so' stdlib -- o AC traz o seu Python e nao deve depender do
Python do sistema.
"""
import ctypes
import mmap
from ctypes import c_char, c_float, c_int32

# ---------------------------------------------------------------------------
# O NOME DA PAGINA. Tem de ser igual ao que esta em acshm.py.
# tests/test_contrato.py verifica.
# ---------------------------------------------------------------------------
PAGE_NAME = "acpmf_actelemetry_v2"

# Numero de carros. O AC nao passa de 128 e a struct e' alocada uma vez
# so, na arranque, portanto 128 e' o maximo sensato.
MAX_CARS = 128

# Maximo de setores por volta que se guarda por carro. As pistas do AC
# raramente passam de 3-4; 8 deixa folga sem desperdicar memoria
# (128 carros x 8 x 4 bytes = 4 KB na pagina toda).
MAX_SECTORS = 8


class vec3(ctypes.Structure):
    _pack_ = 4
    _fields_ = [
        ('x', c_float),
        ('y', c_float),
        ('z', c_float),
    ]


class CarInfo(ctypes.Structure):
    """Um carro. O MESMO formato tem de existir em acshm.py, byte a byte."""

    _pack_ = 4
    _fields_ = [
        ('carId', c_int32),
        ('driverName', c_char * 64),
        ('carModel', c_char * 64),
        ('speedMS', c_float),
        ('bestLapMS', c_int32),
        ('lapCount', c_int32),
        ('currentLapInvalid', c_int32),
        ('currentLapTimeMS', c_int32),
        ('lastLapTimeMS', c_int32),
        ('worldPosition', vec3),
        ('isCarInPitline', c_int32),
        ('isCarInPit', c_int32),
        ('carLeaderboardPosition', c_int32),
        ('carRealTimeLeaderboardPosition', c_int32),
        ('spLineLength', c_float),
        ('isConnected', c_int32),

        # ------------------------------------------------------------------
        # TROCADOS (v3 -> v1 nossa). Antes aqui estava:
        #     suspensionDamage  c_float * 4      (16 bytes)
        #     engineLifeLeft     c_float         ( 4 bytes)
        #     tyreInflation      c_float * 4      (16 bytes)
        # Nenhum dos tres era preenchido. Ficavam sempre a zero, todos os
        # dias, e custavam 36 bytes por carro -- 4,6 KB na pagina.
        #
        # Nenhum deles existe no enum CS do acsys.py, que e' o que o
        # ac.getCarState() aceita. Nao ha' CS.SuspensionDamage, nem
        # CS.EngineLifeLeft, nem CS.TyreInflation. Logo nao era a app que
        # estava mal -- era que se tentava escrever campos que o Python
        # nao sabe ler. (O HUD em Lua le-os, mas pela API do objecto
        # carro, que e' outra interface -- ver a Regra no 18.)
        #
        # Em vez de 36 bytes mortos, agora vao coisas que o CS tem mesmo,
        # e que sao as que interessam a ver num adversario:
        # ------------------------------------------------------------------
        # Temperatura do nucleo dos 4 pneus, em Celsius.
        ('tyreCoreTemp', c_float * 4),
        # Turbo, fracao 0..1.
        ('turboBoost', c_float),
        # ERS guardado, fracao 0..1.
        ('kersCharge', c_float),
        # DRS: a zona existe, e o DRS esta' ligado. 1 = sim, 0 = nao.
        # Sao os MESMOS flags que o proprio dashboard usa para o carro
        # do jogador, entao a leitura e' consistente entre os dois lados.
        ('drsAvailable', c_int32),
        ('drsEnabled', c_int32),

        # Temperatura da banda dos 4 pneus, em Celsius.
        ('tyreSurfaceTemp', c_float * 4),

        # Tempos de setor da ULTIMA volta completa, em ms. Vem de
        # ac.getLastSplits(carId), que a documentacao oficial diz estar
        # disponivel para QUALQUER carro (nao so' o 0).
        ('lastSplitsMS', c_int32 * MAX_SECTORS),
        # Quantos dos MAX_SECTORS valores acima sao validos. Os que
        # sobram sao lixo, nao tempo -- o leitor tem de cortar por este
        # numero.
        ('lastSplitsCount', c_int32),

        # ------------------------------------------------------------------
        # CAIXA, pela API -- para comparar com o 'gear' da pagina de
        # fisica, que e' um campo DIFERENTE com o mesmo nome (Regra no 18).
        # Ha' um bug em que a caixa aparece com +1, e ha' duas hipoteses
        # que so' se separam com os dois valores no mesmo instante:
        #   - a API da -1 e a shm da 0  -> o ecrã e a shm discordam
        #   - a API da 1 e a shm da 2  -> a shm vale +1 a API
        # Ler um no ecra e o outro num print e' cronometragem humana, e
        # erra-se. Aqui os dois ficam gravados no MESMO ciclo.
        # Ver caixa.md.
        # ------------------------------------------------------------------
        ('gearApi', c_int32),
    ]


class CarPage(ctypes.Structure):
    _pack_ = 4
    _fields_ = [
        ('numVehicles', c_int32),
        ('focusVehicle', c_int32),
        ('serverName', c_char * 512),
        ('carInfo', CarInfo * MAX_CARS),
        ('acInstallPath', c_char * 512),
        ('isInternalMemoryModuleLoaded', c_int32),
        ('pluginVersion', c_char * 32),
        # ------------------------------------------------------------------
        # As falhas, publicadas. Acrescentados no FIM do cabecalho, para
        # nao mover nenhum offset do que ja existia.
        #
        # A app engole excepcoes de proposito (ver _seguro em
        # actelemetry_strefiz.py): e' melhor ler um valor errado do que
        # matar o fio. Mas esconder a falha tambem e' um defeito -- foi
        # assim que a leaderboard ficou vazia sem ninguem saber porquê,
        # e o dashboard culpar a app nao estar ligada, que era a
        # instrucao errada.
        #
        # Um contador sozinho diz que algo falhou. O texto diz o quê.
        # ------------------------------------------------------------------
        ('errorCount', c_int32),
        ('lastError', c_char * 128),
        # ------------------------------------------------------------------
        # O CLIMA, no cabecalho e nao nos 128 carros: e' da sessao, e
        # nao de cada um. Ver chuva.md.
        #
        # Todos a '-1' quando nao se sabe. A distincao entre "nao chove"
        # e "nao consigo saber" e' o que separa uma leitura de uma
        # invencao, e um zero de chuva seria mentira sempre que a funcao
        # nao existe -- o que acontece se o Custom Shaders Patch nao a
        # expoer ao Python.
        # ------------------------------------------------------------------
        # 0..1. Vem de ac.ext_rainParams()[0].
        ('rainAmount', c_float),
        # 0/1. Vem de ac.ext_weatherFxActive().
        ('rainFxActive', c_int32),
        # O vento pela API, para comparar com o da memoria partilhada.
        # Se derem o mesmo numero -- e a razao para os ler as duas -- a
        # API Python ve o mesmo mundo que a memoria, e isso valida a
        # premissa de tudo o que esta app escreve.
        ('windSpeedApi', c_float),
        ('windDirApi', c_float),
        # Quao depressa o clima avanca. 1 = tempo real.
        ('weatherTimeMult', c_float),
        # A versao do Custom Shaders Patch. Responde a uma pergunta
        # permanente -- "a minha app esta' a ver o clima ou nao?" -- com
        # um numero no ecra em vez de uma suposicao sobre o que esta'
        # instalado.
        ('cspVersionCode', c_int32),
        # O texto cru de ac.ext_weatherDebugText(). Nao se sabe o que
        # traz a nao ser o que o sol_weather extrai com uma regex, e a
        # forma de saber e' ler. 128 bytes dao para a data e mais umas
        # coisas.
        ('weatherDebug', c_char * 128),
    ]


class Shared:
    """Abre (ou cria) a pagina e da' acesso a' struct."""

    def __init__(self):
        self._map = mmap.mmap(0, ctypes.sizeof(CarPage), PAGE_NAME)
        self.page = CarPage.from_buffer(self._map)

    def close(self):
        try:
            self._map.close()
        except Exception:
            pass

    def __del__(self):
        self.close()

    def get(self):
        return self.page
