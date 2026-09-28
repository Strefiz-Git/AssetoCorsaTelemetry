"""
As regras que so valem para o F1 25.

O nucleo nao sabe nada disto, e o frontend do AC nao vem aqui buscar nada.
Tudo o que esta neste ficheiro e' uma traducao de "o que o jogo escreve"
para "o que o painel mostra", e e' o unico sitio onde essa traducao pode
viver.

O que NAO esta aqui, de proposito:
  - a matematica das voltas e do delta, que e' a mesma nos dois jogos e
    por isso vive em `static/tempos.js`
  - a vida do pneu a partir do desgaste, tambem igual nos dois
  - o desenho. Isso e' do frontend, e o frontend nao tem logica de jogo

A REGRA QUE DOMINA ESTE FICHEIRO
-------------------------------
Nenhum numero e' ajustado ao olho. Se a unidade nao esta escrita na
documentacao, mede-se; e se nao se pode medir, publica-se o valor cru e
admite-se que a unidade nao se sabe. Um valor plausivel e errado e' o pior
resultado possivel, porque ninguem o questiona.
"""

from .protocolo import (COMBUSTIVEL, ERS_MODO, ERS_MODO_2026, FIA, FORMULAS,
                        PISTAS, RESULTADO, SAFETY_CAR, SESSOES, SUPERFICIES,
                        TEMPOS)

# A tabela do compound tem TRES colunas que dependem da formula, e o
# painel so pode escolher a coluna com o `m_formula` do pacote Session.
# Ver docs/f1-25.md, secao 6.9.
#
# O erro a evitar: mostrar o composto VISUAL. O visual e' o que o modelo
# de 2022 mostra, e num carro novo como o McLaren de 2025 o visual e'
# "soft" quando o actual e' C5. Mostrar o visual e' mentir sobre o que
# esta' no carro, e o piloto sente a diferenca.
COMPOSTO_MODERN = {7: "Inter", 8: "Wet", 16: "C5", 17: "C4", 18: "C3",
                   19: "C2", 20: "C1", 21: "C0", 22: "C6"}
COMPOSTO_VISUAL_MODERN = {7: "Inter", 8: "Wet", 16: "Soft", 17: "Medium",
                          18: "Hard"}
COMPOSTO_CLASSIC = {9: "Dry", 10: "Wet"}
COMPOSTO_F2 = {11: "Super soft", 12: "Soft", 13: "Medium", 14: "Hard",
               15: "Wet"}


def composto(valor, formula=0, visual=False):
    """O nome do composto, ou None se o id nao for de nenhuma formula.

    `formula` e' o m_formula do Session. 0 e' F1 Modern, que e' o caso
    normal e o unico em que a tabela e' completa.

    Devolve None, e nao um numero, quando o id nao esta em nenhuma tabela.
    O painel escreve '--' para None e mostra o numero na dica, que e' o
    comportamento certo: um nome inventado seria pior que nenhuma.
    """
    if valor is None:
        return None
    tabela = COMPOSTO_MODERN
    if visual:
        tabela = COMPOSTO_VISUAL_MODERN
    if formula == 1:
        tabela = COMPOSTO_CLASSIC
    elif formula == 2:
        tabela = COMPOSTO_F2
    return tabela.get(int(valor))


def ers_percentagem(energia_j, maximo_j):
    """A percentagem de ERS, ou None quando nao se sabe o maximo.

    O maximo NAO vem no pacote: o `m_ersStoreEnergy` e' o que esta'
    guardado, e o limite e' fixo no jogo e nao e' publicado. Um F1 moderno
    tem 4 MJ, mas isso e' uma constante do jogo e nao um dado da
    telemetria -- por isso o painel mostra os JOULES CRUS e a barra fica a
    neutro quando nao ha maximo. Um 100% inventado seria pior.
    """
    try:
        e = float(energia_j)
    except (TypeError, ValueError):
        return None
    if e < 0:
        return None
    try:
        m = float(maximo_j)
    except (TypeError, ValueError):
        return None
    if m <= 0:
        return None
    return round(e / m * 100.0, 1)


# A percentagem da pista. O `m_lapDistance` e' em METROS desde a linha, e
# e' NEGATIVO antes de a passar pela primeira vez. Um traçado desenhado com
# uma percentagem negativa mostra o carro fora da pista, aoBeginning do
# vez no fim, e sem nenhum erro.
def percentagem_pista(metros, comprimento):
    try:
        m = float(metros)
        c = float(comprimento)
    except (TypeError, ValueError):
        return None
    if c <= 0:
        return None
    p = m / c
    # Uma volta e' um circulo fechado: percentagens fora de [0, 1] nao tem
    # sentido para o mapa. O valor cru fica no payload, para quem quiser.
    if p < 0.0 or p > 1.0:
        return None
    return round(p, 5)


def tempo_de_minutos(minutos, ms_part):
    """O truque dos tempos do F1 25, em milissegundos.

    O jogo nao manda o tempo do sector nem o delta num uint32: manda os
    MILISSEGUNDOS num uint16 e os MINUTOS INTEIROS num uint8 separado,
    porque um uint16 nao chega para os 5 minutos de uma volta de Monza.

    A conta errada aqui e' pequena e silenciosa: uma volta de 1:23,456 vem
    83 * 60000 + 23456. Sem os minutos, da 23,456 s -- um tempo absurdo mas
    perfeitamente plausivel, e o delta errado sem ninguem perceber.
    """
    try:
        return int(minutos) * 60000 + int(ms_part)
    except (TypeError, ValueError):
        return 0


def caixa(gear):
    """O `m_gear` e' um int8: 0 = N, -1 = R, 1..8 = as caixas."""
    try:
        g = int(gear)
    except (TypeError, ValueError):
        return "N"
    if g == 0:
        return "N"
    if g < 0:
        return "R"
    return str(g)


def modo_ers(valor, formato):
    """O nome do modo de ERS.

    O 3 e' "overtake" em 2025 e "boost" em 2026, e a EA mudou o comentario
    sem mudar o numero. Sem o formato, o painel dizia "Overtake" a quem
    conduz um F1 26 com o boost ligado.
    """
    tabela = ERS_MODO_2026 if formato == 2026 else ERS_MODO
    return tabela.get(valor, "—")


def piso(valor, tabela, guarda="—"):
    """Um id vai buscar o nome a uma tabela, sem inventar.

    O F1 25 tem varias tabelas SPARSE: o id 1 de pista nao existe, e o
    enum das bandeiras tem um -1 para "desconhecida" que nao e' um indice.
    Um id que nao esteja na tabela devolve a guarda, e o painel mostra o
    numero cru na dica.
    """
    if valor is None:
        return guarda
    return tabela.get(valor, guarda)


def capacidades():
    """O que este jogo consegue mostrar. Ver jogos/base.py.

    Cada chave da lista canonica aparece aqui. As que estão a "off" não
    são decoração: são a documentação do que o F1 25 NÃO dá, e é o que
    impede o painel de prometer um número que o jogo não publica.

    A comparação entre esta lista e a do AC é o quadro de
    docs/f1-25.md secção 8, e é a razão de o documento existir: sem
    as listas lado a lado, "o que é que este jogo mostra" é uma
    pergunta que só se responde com o jogo a correr.
    """
    return {

        # --- o carro
        "velocidade": "on",
        "caixa": "on",
        "rpm": "on",
        "pedais": "on",
        "embraiagem": "on",
        # O m_steer vem NORMALIZADO, -1 a 1, com o limite escrito na
        # documentação. O AC dá um ângulo em radianos sem escala
        # conhecida, e o painel do AC tem de adivinhar uma. Aqui não há o
        # que adivinhar, e por isso "on" e não "auto".
        "volante": "on",
        "luzesRotacao": "on",      # m_revLightsPercent, 0 a 100
        "caixaSugerida": "on",     # m_suggestedGear

        # --- energia. O F1 25 dá o ERS em JOULES e a potência em WATTS.
        # O AC dá uma fração de 0 a 1 e quilojoules. A mesma palavra,
        # unidades que diferem num factor de mil, e é a razão de a
        # capacidade não ser a mesma nos dois.
        "ers": "on",
        "ersJoules": "on",
        "ersQuilojoules": "off",
        # ersIsCharging é o campo do AC; o F1 25 não tem um "a
        # carregar" separado, tem o desdobramento do ERS por componente.
        "ersRecuperacao": "on",
        "potenciaWatts": "on",     # ICE + MGU-K
        "turbo": "off",             # um F1 não tem turbo
        "combustivel": "on",       # em QUILÓGRAMAS
        # m_fuelRemainingLaps é o número que o MFD do jogo mostra. O AC
        # não tem nada parecido, e por isso lá as voltas de combustível
        # são estimadas a partir de duas leituras.
        "consumoMedia": "on",
        "balastro": "on",           # m_ballast no Car Setups
        "limitador": "on",         # m_pitLimiterStatus

        # --- DRS: o F1 25 dá a zona a sério
        "drs": "on",
        "drsDistancia": "on",      # m_drsActivationDistance, em METROS
        # E no Season Pack 2026 dá a LISTA de zonas, com início e fim em
        # fração de volta. O AC não dá nada disso, e o painel lá teve de
        # conduzir uma volta inteira para descobrir onde era (Regra 11).
        "zonasDrs": "on",
        "assistencias": "on",      # volante, travagem, caixa, ERS, DRS

        # --- pneus
        "pneus": "on",
        # As DUAS zonas do F1 25 (superfície e interior) contra as TRÊS
        # do AC (interior, meio, exterior).
        "tempPneuZonas": "off",
        "tempPneuDuas": "on",
        "tempNucleoPneu": "off",    # não há núcleo; há superfície
        "pressaoPneu": "on",       # PSI
        # AS VOLTAS QUE FALTAM, lidas. É a diferença mais grande entre os
        # dois painéis: no AC este número não existe e é estimado a
        # partir de duas voltas medidas de desgaste, e no F1 25 é lido.
        "vidaPneu": "on",
        "idadePneu": "on",         # m_tyresAgeLaps
        "bolhas": "on",            # m_tyreBlisters
        "pneuSujo": "off",
        "compoundId": "on",
        # O composto ACTUAL, que é o que o piloto sente. Mostrar o
        # VISUAL seria mentir: num McLaren de 2025 o visual é "soft"
        # quando o actual é C5.
        "compoundActual": "on",
        "compoundTexto": "off",
        # Os 20 conjuntos, cada um com a sua lifeSpan. O pacote inteiro
        # vai a zero se a telemetria estiver em restrito.
        "pneusDisponiveis": "on",
        "travões": "on",

        # --- danos: muito mais ricos do que os 5 floats do AC
        "danos": "on",
        "danoSuspensao": "on",     # m_tyresDamage
        "asa": "on",               # frente esq/dir, trás, assoalho, difusor
        "componentesMotor": "on",  # os 6 wears: MGU-H, ES, CE, ICE, MGU-K, TC
        "biasTrava": "on",         # m_frontBrakeBias, PERCENTAGEM
        # O m_antiLockBrakes é um 0 ou 1 e o m_tractionControl é um
        # modo (0 off, 1 médio, 2 cheio). NÃO há percentagem. Mostrar
        # "ABS 100%" seria inventar um número que o jogo não dá, e no AC
        # essa percentagem é a verdade.
        "nivelAbs": "off",
        "nivelTc": "off",
        "absOnOff": "on",
        "tcModo": "on",

        # --- física: o Motion Ex é o pacote mais rico e o AC não tem
        # nada equivalente
        "gLateral": "on",
        "gRelativo": "on",
        "escorregamentoRatio": "on",   # o índice de aderência de verdade
        "escorregamentoAngulo": "on",
        "anguloRoda": "on",            # radianos, do Motion Ex
        "forcasRoda": "on",            # lateral, longitudinal, vertical
        "camber": "on",
        "rideHeight": "on",            # altura do assoalho, frente e trás
        "cgHeight": "on",
        "finalFF": "off",

        # --- o mundo
        "mapa": "on",
        # O F1 25 não tem ficheiro de mapa, e a documentação da EA não diz
        # onde andaria um. O traçado desenha-se a medir, a partir do
        # Motion, que é o mesmo caminho que o AC usa quando não encontra o
        # map.png. Não é um buraco.
        "mapaFicheiro": "off",
        "spline": "on",           # m_trackLength, em METROS
        "sectorCount": "on",
        # O m_surfaceType é MELHOR do que o surfaceGrip do AC: diz o
        # que a roda tocou, em vez de estimar a aderência. E o 8 é água.
        "superficieRoda": "on",
        "aderencia": "on",        # pelo escorregamento, que é melhor
        "posicao": "on",
        "posicaoAoVivo": "off",   # a posição é uma só, e é a ao vivo
        "classificacao": "on",    # e vem no UDP, sem app nenhuma

        # --- o tempo: o F1 25 PUBLICA o tempo, e o AC não
        "tempo": "on",
        "estadoTempo": "on",      # m_weather, 6 estados
        "chuva": "on",            # m_rainPercentage
        "previsao": "on",         # 64 amostras, com tempo e chuva
        "densidadeAr": "off",
        "ventoVelocidade": "off",  # o F1 25 não publica vento
        "ventoDireccao": "off",

        # --- a sessao
        "voltas": "on",
        "sectores": "on",
        # O delta vem do PRÓPRIO JOGO, para quem está à frente e para o
        # líder. O AC não dá delta para ninguém, e por isso o delta do
        # painel do AC é calculado contra uma volta de referência — que é
        # mais trabalho e menos precisão.
        "deltaJogo": "on",
        "deltaLider": "on",
        "penalidadeTipo": "on",   # o evento PENA traz o tipo
        "safetyCar": "on",
        "setup": "on",            # o packet 5 inteiro
        "coloridaLivery": "on",   # as cores da carroçaria
        "bandeiras": "on",        # verde, azul, amarela, por carro
        # O travão de mão não é publicado: o m_brake é a única travagem
        # que há. Não existe em nenhum dos dois jogos.
        "travãoDeMão": "off",
    }
