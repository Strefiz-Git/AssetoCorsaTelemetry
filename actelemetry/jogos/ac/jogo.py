"""
O Assetto Corsa como o nucleo do servidor o ve.

Este modulo e' uma FINA camada por cima do `acshm.py`, que fica onde
esta. Nao se mexeu no leitor: ele tem 30 testes dependentes, foi medido
contra o jogo a correr, e mexer nele sem necessidade seria trocar coisa
que funciona por coisa que ainda nao foi testada.

O que este modulo acrescenta e' so' a adaptacao: o `acshm.ACTelemetry`
devolve um dicionario plano com nomes de campos em ingles, e o painel
precisa de duas coisas que o F1 25 tambem tem de ter:

  1. um metodo `opponents()` (o AC tem `Opponents` a parte, e o nucleo
     nao quer saber dessa diferenca)
  2. um `estado_jogo` que diga "a correr", "em pausa" ou "encerrado",
     porque o AC tem uma armadilha que o F1 25 nao tem: o SimHub mantem
     as paginas mapeadas com o jogo fechado, e portanto a pagina existir
     nao quer dizer nada. Ver a Regra no 2.

E as diferencas que o painel tem de saber, que sao as que interessam:

  - o AC NAO publica chuva. O que publica e' o EFEITO: a aderencia
    desce. A chuva vem da API Python, dentro do jogo, e so existe se o
    Custom Shaders Patch estiver instalado. Quando nao esta', o valor e'
    -1, e -1 e' "nao se sabe" e nao "seco". Ver docs/assetto-corsa.md.
  - o AC nao da a vida do pneu, e o painel estima-a a partir de duas
    voltas medidas de desgaste. O F1 25 da o numero. Por isso o `vidaPneu`
    e' "auto" aqui e "on" no F1 25.
  - o AC tem de ser instalado para haver adversarios. O F1 25 nao.
"""

import acshm

from ..base import LeitorBase, JogoBase
from .logica import capacidades as capacidades_ac


class Leitor(LeitorBase):
    """O `acshm.ACTelemetry` mais `acshm.Opponents`, com uma fachada so."""

    def __init__(self, nomes=None, app_name=None):
        self._t = acshm.ACTelemetry(names=nomes, app_name=app_name)
        self._o = acshm.Opponents(name=app_name)

    def snapshot(self):
        return self._t.snapshot()

    def opponents(self):
        # O AC devolve a lista de adversarios com a forma que o painel ja
        # consome. Nao ha' nada a traduzir, e essa e' a razao de o
        # painel do AC nao ter precisado de mudancas.
        return self._o.snapshot()

    def vivo(self):
        return bool(getattr(self._t, "live", False))

    def ha_historico(self):
        # Ao contrario do F1 25, o AC TEM historico: as paginas ficam
        # mapeadas com o jogo fechado e o painel mostra a ultima sessao
        # esbatida. E' a Regra no 2, e e' a razao de aqui ser True.
        return True

    def estado_jogo(self):
        """'a_correr', 'em_pausa' ou 'encerrado'.

        O AC tem uma regra que o F1 25 nao precisa: a pagina existir nao
        e' o jogo estar a correr. O SimHub mantem-nas mapeadas sempre, e
        em PAUSA e no menu o `packetId` tambem para. Por isso a
        distincao e' por TEMPO, e nao por conexao: a mesma regra que o
        frontend ja usava, agora no sitio certo.
        """
        if not self._t.connected:
            return "encerrado"
        if self.vivo():
            return "a_correr"
        if getattr(self._t, "since_packet", 0) < 90.0:
            return "em_pausa"
        return "encerrado"

    def close(self):
        try:
            self._o.close()
        except Exception:
            pass


class AC(JogoBase):
    id = "ac"
    nome = "Assetto Corsa"
    transporte = "memória partilhada"
    precisa_instalar = True
    tem_mapa_de_ficheiro = True

    def criar_leitor(self, opcoes=None):
        return Leitor()

    def rotas(self):
        # O AC e' o unico dos dois com ficheiros do jogo em disco, e por
        # isso o unico com rotas que precisam de saber onde ele esta'
        # instalado. O nucleo do servidor nao sabe nada disso: o registo
        # devolve o dicionario e ele serve o que estiver la dentro.
        #
        # O `mapa` e' a funcao que sabe ir buscar o map.png e o map.ini.
        # Ela vive no AC porque so' o AC tem esses ficheiros -- e e' o
        # que a Regra no 17 do AGENTS.md diz: o SCALE_FACTOR e' a escala,
        # e quem mediu isso foi o AC.
        from .mapa import registar_rotas
        return registar_rotas()

    def _capacidades(self):
        return capacidades_ac()

    def estado_leitor(self):
        return {
            "instrucao": "Assetto Corsa: instala a app em "
                         "assettocorsa/apps/python/ e liga-a no Content "
                         "Manager para ver os adversarios.",
            "nota": "A telemetria do teu carro aparece sem a app. "
                    "Os adversarios, nao.",
        }
