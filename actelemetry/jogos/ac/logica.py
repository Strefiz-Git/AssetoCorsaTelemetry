"""
O que e' especifico do Assetto Corsa, e so' o AC.

Dois blocos, e nada mais:

  1. `capacidades()` -- o que este jogo consegue mostrar. O frontend le
     isto e esconde o que nao existe. Sem esta lista, o painel do F1 25
     mostraria um cartao de chuva e um cartao de densidade de ar que o
     AC nao tem, e a remedy seria encher tudo a "-1" -- que e' pior do
     que nao mostrar, porque "-1" ocupa o mesmo espaco que um numero e
     finge que se sabe de alguma coisa.

  2. As funcoes que decidem COMO mostrar uma coisa do AC. Deliberadamente
     poucas: o grosso da matematica do AC esta' em `static/tempos.js`,
     `static/tyres.js` e `static/tempo.js`, que sao puros e correm no
     node. Aqui so' fica o que precisa de saber como o AC escreve.

A REGRA DESTE FICHEIRO
---------------------
Cada chave da lista canonica de `jogos/base.py` aparece aqui, com "on",
"off" ou "auto". As chaves a "off" nao sa' decoracao: sao a documentacao
do que este jogo NAO da, e e' o que impede o painel de prometer um numero
que o AC nao tem.

E nada e' declarado sem o campo que o sustenta. A lista foi feita a
contar os campos das tres paginas (60 + 30 + 42, medido com ctypes), e
nao a partir da memoria de como o painel era. Ver a Regra no 15 do
AGENTS.md: uma lista de campos que escreveste prova o que tem, e nunca o
que nao tem.
"""

from acshm import SPageFileGraphic, SPageFilePhysics, SPageFileStatic

# A contagem que a lista de capacidades se apoia. Esta' aqui para que
# mudar um campo sem mudar esta lista da erro em vez de dar uma
# capacidade que ninguem verifica.
CONTAGENS = {
    "physics": len(SPageFilePhysics._fields_),
    "graphics": len(SPageFileGraphic._fields_),
    "static": len(SPageFileStatic._fields_),
}


def capacidades():
    """O que o AC mostra, e o que nao mostra.

    Mesma forma que a do F1 25, e a comparacao entre as duas listas e' o
    que diz o que cada jogo ganha e o que perde. Ver o quadro em
    `docs/f1-25.md` secao 8.
    """
    return {

        # --- o carro
        "velocidade": "on", "caixa": "on", "rpm": "on", "pedais": "on",
        "embraiagem": "on",
        # O `steerAngle` do AC e' um ANGULO EM RADIÃOS e nao ha' nada que
        # diga o limite. O painel inventa uma escala (o `STEER_REF` do
        # app.js, ainda marcado como nao confirmado) e por isso isto e'
        # "auto": mostra-se o numero, com a ressalva de que a escala nao
        # esta confirmada. O F1 25 da' -1 a 1 normalizado, e nao ha' o
        # que adivinhar.
        "volante": "auto",
        "luzesRotacao": "off",      # o AC nao publica as luzes
        "caixaSugerida": "off",     # so com caixa automatica, e nao vem

        # --- energia. As unidades do AC sao OUTRAS: o ERS e' uma fracao
        # de 0 a 1, o `kersCurrentKJ` e' em quilojoules, e o `ersMaxJ` em
        # joules. A lista de capacidades diz "sim" e nao a unidade: a
        # unidade e' da logica de cada jogo, e e' `docs/assetto-corsa.md`
        # que a escreve.
        "ers": "on",
        "ersJoules": "off",         # o AC da' so a fracao
        "ersQuilojoules": "on",     # kersCurrentKJ
        "ersRecuperacao": "on",     # ersIsCharging, ersRecoveryLevel
        "potenciaWatts": "off",     # nao ha' nada disso no AC
        "turbo": "on",              # o AC tem turbo; o F1 25 nao
        "combustivel": "on",        # em LITROS, e nao em quilos
        "consumoMedia": "off",      # nao ha' m_fuelRemainingLaps
        "balastro": "on",           # ballast, em quilos
        "limitador": "on",          # pitLimiterOn

        # --- DRS. Ver a Regra no 11: o `drsAvailable` do AC mentiu num
        # carro e disse a verdade noutro, e o painel teve de medir uma
        # volta inteira para decidir. Da' por isso "auto" e nao "on": o
        # dado existe, mas a sua fiabilidade e' decidida a conduzir e o
        # veredito tem de ser visivel.
        "drs": "on",
        "drsDistancia": "off",      # o AC nao da metros
        "zonasDrs": "auto",         # desenhado a conduzir, com veredito
        "assistencias": "off",      # as do jogador nao vem nas paginas

        # --- pneus
        "pneus": "on",
        # As TRES zonas do AC (interior, meio, exterior) sao uma coisa
        # diferente das DUAS do F1 25 (superficie, interior). Nao e'
        # melhor nem pior.
        "tempPneuZonas": "on",
        "tempPneuDuas": "off",
        "tempNucleoPneu": "on",     # tyreCoreTemperature
        "pressaoPneu": "on",        # psi, medido
        # A VIDA DO PNEU e' o caso serio. O AC nao publica a vida do
        # composto, e o painel estima-a a partir do desgaste medido em
        # duas voltas. Funciona, mas e' uma conta, e a conta depende de
        # dois numeros que mudam com o carro, o piloto e a pista. O F1 25
        # manda o `lifeSpan`. Da' por isso "auto" e nao "on".
        "vidaPneu": "auto",
        "idadePneu": "off",         # nao ha' m_tyresAgeLaps
        "bolhas": "off",
        "pneuSujo": "on",           # tyreDirtyLevel
        "compoundId": "off",        # o AC da' o NOME, em texto
        "compoundActual": "off",
        "compoundTexto": "on",      # tyreCompound, wchar[33]
        "pneusDisponiveis": "off",  # nao ha' o equivalente ao Tyre Sets

        # --- travões e danos
        "travões": "on",
        "danos": "on",
        "danoSuspensao": "on",      # carDamage: frente, tras, esq., dir.
        "asa": "off",               # o AC nao tem asas
        "componentesMotor": "off",  # nem os 6 wears
        # O `brakeBias` do AC e' uma FRACAO de 0 a 1 (medido 0,58 num
        # Toyota TS040). O do F1 25 e' uma percentagem de 0 a 100. A
        # capacidade e' "on" nos dois; a unidade e' da logica de cada um.
        "biasTrava": "on",
        # O `abs` e' `tc` do AC sao o NIVEL a que o sistema esta' a
        # trabalhar, 0 a 1. Medido: 0,13 e 0,08 durante 4502 amostras de
        # travagens duras. Da' por isso uma percentagem, que e' a verdade.
        # No F1 25 sao um 0/1 e um modo, e nao ha' percentagem nenhuma.
        "nivelAbs": "on",
        "nivelTc": "on",
        "absOnOff": "off",
        "tcModo": "off",

        # --- física
        "gLateral": "on",          # accG, no referencial LOCAL
        "gRelativo": "on",
        # O `wheelSlip` do AC e' uma PERCENTAGEM de escorregamento. O
        # F1 25 da' ratio e angulo, que e' o indice de aderencia de
        # verdade. Sao Grandezas diferentes e comparar os dois numeros
        # seria comparar coisas diferentes.
        "escorregamentoRatio": "off",
        "escorregamentoAngulo": "off",
        "anguloRoda": "off",        # o Motion Ex nao existe no AC
        "forcasRoda": "off",
        "camber": "off",            # ha' camberRAD, mas em radianos e
                                    # o painel nao o mostra; fica off
                                    # para nao prometer o que nao se ve
        "rideHeight": "on",
        "cgHeight": "on",
        "finalFF": "on",            # o valor de force feedback

        # --- o mundo
        "mapa": "on",
        # O AC e' o unico dos dois com a imagem da pista no disco. E' o
        # `map.png` na raiz da pista e o `map.ini` em `data/`, e a escala
        # e' o SCALE_FACTOR (Regra no 17). Quando nao ha' ficheiro, o
        # painel desenha o tracado a medida -- que e' o mesmo caminho do
        # F1 25, e nao um buraco.
        "mapaFicheiro": "on",
        "spline": "on",            # trackSPlineLength, em METROS
        "sectorCount": "on",        # a pista pode ter 3, 4, 5
        "superficieRoda": "off",    # o AC nao diz o que a roda tocou
        "aderencia": "on",         # surfaceGrip, com o zero avisado

        # --- o tempo. Esta e' a diferenca mais visivel entre os dois
        # jogos. O AC nao publica chuva nem estado do ceu, e a
        # documentacao foi contada campo a campo para o confirmar: nos
        # 60 campos da pagina de fisica so ha' airTemp, roadTemp e
        # airDensity (Regra no 15). O que o AC tem e' o EFEITO, e a
        # aderencia que desce e' o que diz que esta molhado.
        "tempo": "off",
        "estadoTempo": "off",
        # A chuva vem da API Python, e so' existe se o Custom Shaders
        # Patch estiver instalado. Sem ele o valor e' -1, e -1 e' "nao
        # se sabe" e nao "seco". Da' por isso "auto" e nao "on".
        "chuva": "auto",
        "previsao": "off",
        "densidadeAr": "on",        # airDensity, kg/m3
        # O AC da' a velocidade do vento, e a documentacao oficial diz
        # m/s. A direccao e' outra historia: a documentacao diz "0-359"
        # (graus) e o comentario no acshm.py diz radianos. Nao se sabe.
        # Ver docs/assetto-corsa.md, secao 12.
        "ventoVelocidade": "on",
        "ventoDireccao": "auto",

        # --- a sessao
        "voltas": "on",
        "sectores": "on",           # o indice e o ultimo tempo
        "deltaJogo": "off",         # o AC nao da delta para ninguem
        "deltaLider": "off",
        "posicao": "on",
        # O AC publica DUAS posicoes e elas discordam. A lista mostra a
        # ao vivo, que e' o que interessa a conduzir, e a oficial fica
        # no title da linha. Ver o comentario em acshm.py.
        "posicaoAoVivo": "on",
        "classificacao": "on",      # mas precisa da app instalada
        # O TIPO de penalidade (DT, SG10, DSQ) e' do ACC, nao do AC base.
        # O AC so traz penaltyTime em segundos. Mostrar um "SG10" seria
        # inventar.
        "penalidadeTipo": "off",
        "safetyCar": "off",
        "setup": "off",             # o AC nao publica o setup
        "coloridaLivery": "off",
        "bandeiras": "on",          # 7 valores na pagina de graficos
        # O travão de mao nao existe em NENHUMA das tres paginas. So' ha'
        # gas, brake e clutch. O painel mostra o botao com um travessao e
        # a dica a dizer porquê.
        "travãoDeMão": "off",
    }
