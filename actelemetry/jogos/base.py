"""
O que um jogo tem de cumprir para aparecer no painel.

A ideia e' que o nucleo do servidor (o Hub, o HTTP, o SSE) nao saiba nada
sobre nenhum dos dois jogos. Ele pergunta "qual e' o jogo?", e o jogo
responde com um leitor. Tudo o que e' especifico de um jogo -- a struct, o
transporte, a escala de um campo -- vive no modulo desse jogo.

Isto e' a Regra no 19 do AGENTS.md aplicada aarchitectura em vez de a
struct: dois lados que falam sem um contrato comum divergem em silencio.
Aqui o contrato e' esta interface, e o teste e' que os dois jogos a
implementam sem o nucleo saber qual deles esta' activo.

O que o nucleo FAZ, e' o minimo que os dois precisam:
  - um leitor que da' um snapshot do carro do jogador
  - um leitor que da' os adversarios
  - saber se o jogo esta' vivo (para o painel esbatido e nao em branco)
  - publicar um dicionario de capacidades, para o frontend mostrar so' o
    que existe neste jogo
"""

# O que o frontend nao deve poder fazer: mostrar um cartao com dados que
# o jogo nao publica. Um "0" e' plausivel e ninguem questiona (Regra no 19),
# e um cartao inteiro a zeros e' a forma mais rapida de mentir. Por isso a
# lista de capacidades vem do servidor e nao esta escrita no HTML.
#
# Cada chave e' um cartao ou um campo do painel, e o valor diz o que fazer:
#   "on"     mostrar sempre
#   "off"    esconder sempre
#   "auto"   mostrar, mas a pinta a neutro quando o valor e' None
#
# ---------------------------------------------------------------------------
# A LISTA CANONICA
# ---------------------------------------------------------------------------
# Estas chaves sao o CONTRATO entre o servidor e o frontend, e estao aqui
# e' nao em cada jogo, de proposito.
#
# A primeira versao tinha a lista escrita em cada jogo, e o
# `test_f125_parser.py` apanhou logo que as duas nao coincidiam: o AC
# tinha 22 chaves que o F1 25 nao tinha, e o F1 25 tinha 4 que o AC nao
# tinha. Traduzido para o ecra: um cartao que o painel escondia num jogo
# e mostrava no outro, sem nenhuma regra que o explicasse. E o frontend
# ficava a depender de `if (capabilidades.x)` para coisas que deviam
# existir sempre.
#
# Por isso: a lista esta aqui, os jogos PREENCHEM, e o teste confirma que
# os dois preencheram tudo. Um jogo novo tem de declarar cada chave, nem
# que seja a "off" -- e e' esse "off" que documenta o que esse jogo nao
# da.
CAPACIDADES = (
    # --- o carro
    "velocidade", "caixa", "rpm", "pedais", "volante", "embraiagem",
    "luzesRotacao", "caixaSugerida",
    # --- energia
    "ers", "ersJoules", "ersQuilojoules", "ersRecuperacao", "potenciaWatts",
    "turbo", "combustivel", "consumoMedia", "balastro", "limitador",
    # --- DRS e aero
    "drs", "drsDistancia", "zonasDrs", "assistencias",
    # --- pneus
    "pneus", "tempPneuZonas", "tempPneuDuas", "tempNucleoPneu",
    "pressaoPneu", "vidaPneu", "idadePneu", "bolhas", "pneuSujo",
    "compoundId", "compoundActual", "compoundTexto", "pneusDisponiveis",
    # --- travões e danos
    "travões", "danos", "danoSuspensao", "asa", "componentesMotor",
    "biasTrava", "nivelAbs", "nivelTc", "absOnOff", "tcModo",
    # --- física
    "gLateral", "gRelativo", "escorregamentoRatio", "escorregamentoAngulo",
    "anguloRoda", "forcasRoda", "camber", "rideHeight", "cgHeight",
    "finalFF",
    # --- o mundo
    "mapa", "mapaFicheiro", "spline", "sectorCount",
    "superficieRoda", "aderencia",
    # --- o tempo
    "tempo", "estadoTempo", "chuva", "previsao", "densidadeAr",
    "ventoVelocidade", "ventoDireccao",
    # --- a sessao
    "voltas", "sectores", "deltaJogo", "deltaLider", "posicao",
    "posicaoAoVivo", "classificacao", "penalidadeTipo", "safetyCar",
    "setup", "coloridaLivery", "bandeiras", "travãoDeMão",
)

# Uma lista, e nao um dicionario: a ordem nao interessa e um dicionario
# dava a impressao de que um valor por omissao era uma opcao valida.
CHAVES_CAPACIDADES = set(CAPACIDADES)

# O `jogo` que `capacidades()` acrescenta e' METADATA: diz qual dos dois
# jogos esta' activo, e o frontend precisa dele para escolher o modulo de
# logica. Nao e' uma capacidade, e por isso `conferir` nao o conta nem
# como falta nem como sobra. Declarar isto aqui e' melhor do que
#ignorar dentro da funcao: a lista do que NAO e' uma capacidade fica
# escrita, e da para a ler.
METADADOS = ("jogo",)


def conferir(capacidades, jogo):
    """Confere que um jogo declarou TODAS as chaves, e nao so algumas.

    Devolve a lista do que falta ou sobra. O `test_f125_parser.py` chama
    isto para os dois jogos, e e' o que impede que as listas voltem a
    divergir -- que foi o que aconteceu na primeira versao, quando o AC
    tinha 22 chaves que o F1 25 nao tinha. Traduzido para o ecra: um
    cartao que o painel escondia num jogo e mostrava no outro, sem
    nenhuma regra que o explicasse.
    """
    caps = {k: v for k, v in capacidades.items() if k not in METADADOS}
    falta = sorted(CHAVES_CAPACIDADES - set(caps))
    sobra = sorted(set(caps) - CHAVES_CAPACIDADES)
    maus = sorted(c for c, v in caps.items() if v not in ("on", "off", "auto"))
    return {"jogo": jogo, "falta": falta, "sobra": sobra,
            "valoresRuins": maus, "total": len(caps)}


class LeitorBase:
    """O que um leitor de telemetria tem de ter.

    Nao e' uma classe abstracta a serio -- nao ha ABC nem notImplementedError
    -- porque a unica coisa que um leitor tem de fazer e' nao rebentar
    quando o jogo nao esta' a correr. Um jogo novo que falhe um metodo
    desaparecia com um erro de importacao, e isso e' pior do que um
    painel vazio.
    """

    def snapshot(self):
        """Um dicionario com o estado do carro do jogador.

        Devolve sempre um dicionario, mesmo quando o jogo nao esta' a
        correr. As chaves que o painel precisa tem de estar la com
        `None` ou `False`, e nao em falta: uma chave em falta faz o
        frontend mostrar '--' sem saber se e' para desenho.
        """
        return {"connected": False, "live": False}

    def opponents(self):
        """Os outros carros. `{"available": bool, "cars": [...]}`

        Devolve `available: False` quando nao ha' adversarios, e NAO uma
        lista vazia com `available: True`: sao situacoes diferentes, e a
        segunda diz ao piloto que a lista esta' a atualizar e a primeira diz
        que a app nao esta' instalada.
        """
        return {"available": False, "cars": []}

    def vivo(self):
        """O jogo esta' a correr AGORA, e nao apenas a pagina existe?

        O AC responde que sim mesmo com o jogo fechado, porque o SimHub
        mantem as paginas mapeadas. E' a Regra no 2.
        """
        return False

    def ha_historico(self):
        """False quando nada aqui vale a pena guardar em disco.

        O AC tem de mostrar o estado congelado da ultima sessao; o F1 25
        nao tem nada para congelar, porque nao ha' pagina mapeada para
        ficar para tras.
        """
        return False

    def close(self):
        pass


class JogoBase:
    """Um jogo, com a identidade e as capacidades que o frontend le."""

    id = ""
    nome = ""
    # O F1 25 manda UDP; o AC le paginas com nome. O nucleo nao precisa
    # disto para nada, mas o texto do rodape e' util e a app Python
    # (so' no AC) precisa de saber se e' preciso instalar alguma coisa.
    transporte = ""
    # Precisa de instalar alguma coisa dentro do jogo para ter adversarios?
    precisa_instalar = False
    # O jogo da uma imagem de mapa no disco, ou so' um traçado?
    tem_mapa_de_ficheiro = False

    def criar_leitor(self, opcoes=None):
        raise NotImplementedError

    def rotas(self):
        """Rotas HTTP extra deste jogo.

        Devolve um dicionario `caminho -> (metodo, funcao)`. O AC usa-o
        para `/api/track-map`, que precisa de saber onde esta' o jogo
        instalado; o F1 25 devolve um dicionario vazio, porque o UDP nao
        precisa de nada do disco.
        """
        return {}

    def capacidades(self):
        """O que este jogo consegue mostrar.

        Acrescenta o `id` ao dicionario que a subclasse preencheu. O id e'
        METADATA e nao uma capacidade, e e' por isso que entra aqui e nao
        dentro da lista: `conferir()` olha so' para as capacidades, e uma
        chave la dentro que nao seja uma capacidade faria o teste falhar
        sempre. Um teste que falha sempre e' um teste que se desligou.
        """
        caps = dict(self._capacidades())
        caps["jogo"] = self.id
        return caps

    def _capacidades(self):
        """O que a subclasse preenche.

        Tem de devolver TODAS as chaves de CAPACIDADES, nem que seja a
        "off". Uma chave a "off" nao e' decoracao: e' a documentacao do
        que este jogo nao da, e e' o que impede o painel de prometer um
        numero que o jogo nao publica.
        """
        return {}

    def estado_leitor(self):
        """Informacao que o painel mostra ANTES de haver telemetria.

        Serve para o ecra de espera dizer a instrucao certa: no AC, "liga a
        app no Content Manager"; no F1 25, "UDP Telemetry para 127.0.0.1
        na porta 20777". Sao instrucoes completamente diferentes, e
        mostrar a errada e' a mesma confusao que a do `lastError`.
        """
        return {}
