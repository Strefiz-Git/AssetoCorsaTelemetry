"""
Os jogos que este painel sabe ler.

Cada jogo e' um modulo com a MESMA forma: um `Jogo` que se identifica, e
um `Leitor` que devolve dicionarios. O nucleo do servidor so conhece esta
interface, e nao nenhum dos jogos em concreto.

A ordem de registo e' a ordem em que aparecem no ecra de escolha. E'
voluntariamente o que estava a ser mais usado primeiro, para que o
primeiro botao seja o certo para quem ja usava o painel.
"""

from .base import JogoBase, LeitorBase
from . import ac
from . import f125

# O registo. Um dicionario, e nao uma lista com ids espalhados: assim
# nao ha' dois sítios onde se pode acrescentar um jogo e esquecer o
# outro, que e' a forma mais facil de um jogo novo nao aparecer no ecra
# de escolha e ninguem perceber porque.
JOGOS = {
    ac.JOGO.id: ac.JOGO,
    f125.JOGO.id: f125.JOGO,
}

# O jogo que se assume quando ainda nao se escolheu nenhum. O AC, porque
# e' o que este painel fez durante anos e quem abrir sem escolher esta a
# ver o mesmo ecra de sempre.
PADRAO = ac.JOGO.id

ORDEM = list(JOGOS)


def obter(jogo_id):
    """O jogo com este id, ou None.

    Devolver None em vez de levantar e' deliberado: o id vem do ficheiro
    de definicoes, que o utilizador pode ter editado a mao, e um ficheiro
    de definicoes nao deve poder impedir o servidor de arrancar. O
    servidor cai no jogo padrao e diz no ecra que nao reconheceu o
    pedido.
    """
    if not jogo_id:
        return None
    return JOGOS.get(str(jogo_id).strip().lower())


def para_o_ecra():
    """A lista que o ecra de escolha mostra.

    So' o que a interface precisa para desenhar os botoes. `nota` diz o
    que e' preciso fazer para o jogo aparecer, e e' a unica coisa que um
    utilizador precisa de saber antes de escolher: no AC ha' uma app para
    instalar dentro do jogo, e no F1 25 ha' um menu para ligar. Escolher o
    jogo errado e' mais barato do que escolher e nao ver nada.
    """
    saida = []
    for chave in ORDEM:
        j = JOGOS[chave]
        est = j.estado_leitor() or {}
        saida.append({
            "id": j.id,
            "nome": j.nome,
            "transporte": j.transporte,
            "precisaInstalar": j.precisa_instalar,
            "temMapaFicheiro": j.tem_mapa_de_ficheiro,
            "instrucao": est.get("instrucao", ""),
            "nota": est.get("nota", ""),
        })
    return saida
