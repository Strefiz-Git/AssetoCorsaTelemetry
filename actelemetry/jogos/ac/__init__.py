"""
O Assetto Corsa, como um dos dois jogos do painel.

    jogo.py     a fachada: implementa o contrato de `jogos/base.py`
    logica.py   o que este jogo mostra e o que nao mostra
    mapa.py     o map.png e o map.ini, que so' o AC tem

O leitor em si -- as structs, o mapeamento, o `snapshot()` -- continua no
`acshm.py` na raiz, sem alteracoes. Tem 30 testes dependentes e foi
medido contra o jogo a correr; mexer nele sem necessidade seria trocar
coisa que funciona por coisa que ainda nao foi testada.

Dizer isto aqui e' de proposito, porque da proxima vez que alguem abrir este
projecto vai tentar "arrumar" a estrutura e vai levar o `acshm.py` para
dentro de um pacote. O unico motivo de nao o ter feito ainda e' o
`test_layout.py`, o `test_acshm.py`, o `test_opponents.py` e o
`test_contrato.py` importarem-no pelo nome, e o ganho ser so' de
aparencia. Um dia, com a suite a acompanhar, faz-se. Ver
docs/assetto-corsa.md.
"""

from .jogo import AC

JOGO = AC()
