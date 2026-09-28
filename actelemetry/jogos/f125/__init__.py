"""
Telemetria do F1 25.

O jogo manda datagramas UDP, um por packet, com um cabecalho de 29 bytes
que diz o formato. Ha' dois formatos (2025 e 2026 Season Pack) e as structs
deles NAO sao interchangeaveis -- ver `protocolo.py` e `docs/f1-25.md`.

Estes tres ficheiros, e o que cada um faz:

    protocolo.py   as structs e as tabelas. Nao faz rede.
    receptor.py    o socket, a leitura dos datagramas, e o estado
                   acumulado de um pacote de cada tipo.
    logica.py      o que o painel mostra: unidades, escalas, compound,
                   e as regras que so valem para este jogo.

O nucleo do servidor (Hub, HTTP, SSE) nao sabe nada disto. Ele pede um
leitor e le dicionarios. E' a Regra no 19 do AGENTS.md aplicada a
arquitectura: o contrato e' a interface, e nao uma conversa implicita
entre dois ficheiros.
"""

from .jogo import F125

JOGO = F125()
