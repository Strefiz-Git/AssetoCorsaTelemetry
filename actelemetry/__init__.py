"""
O painel de telemetria, com dois jogos.

A estrutura e' esta:

    actelemetry/
      defs.py        onde se guardam as definicoes, e onde esta o frontend
      hub.py         o estado partilhado: um thread le, varios clientes
      http.py        o servidor HTTP e o SSE. Nao sabe nenhum jogo
      jogos/
        base.py      o que um jogo tem de cumprir
        ac/          o Assetto Corsa: leitor, mapa, capacidades
        f125/        o F1 25: protocolo, receptor, logica, jogo

O nucleo -- `hub.py` e `http.py` -- nao sabe se o painel esta' a ler
memoria partilhada ou datagramas UDP. Ele pede um leitor ao registo de
`jogos/` e le dicionarios. E' a Regra no 19 do `AGENTS.md` aplicada a
arquitectura: o contrato e' a interface, e nao uma conversa implicita
entre dois ficheiros que ninguem verifica.

A regra de ouro do nucleo: **nenhum numero e' inventado aqui**. Onde o
jogo nao publica um dado, a chave fica a None. Um None pinta-se a neutro
no painel; um zero e' lido como "zero", e zero e' plausivel.
"""

__version__ = "2.0.0"
