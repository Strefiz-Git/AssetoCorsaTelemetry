---
name: progresso
description: Como manter o registo docs/progresso.md. Usar no fim de cada bloco de trabalho concluído e no fim de cada sessão, sempre que se corrigir um bug, se descobrir algo sobre o jogo ou a memória, se tomar uma decisão de arquitectura, ou se tentar algo que não funcionou. Diz onde escrever a entrada, o formato, o que incluir, e quando uma descoberta deve passar a Regra do AGENTS.md.
license: MIT
---

# Progresso

`docs/progresso.md` é o registo cronológico: o que se fez, **porquê**, o
que correu mal, o que se aprendeu. Serve para não repetir erros. Está em
CRLF: manter (ver `sessao-de-trabalho`, *Editar sem estragar*).

Não confundir com o `AGENTS.md`, que guarda as **regras** que já se
provaram (ver `documentacao`). O progresso é o diário; a regra é o que
sobrou do diário depois de se ter a certeza.

## Quando escrever

- Um bloco de trabalho fechou (a mesma altura do commit).
- Uma coisa **não funcionou**: escreve-se também, com o que se tentou.
  É o que mais poupa tempo à sessão seguinte.
- Descobriu-se algo do jogo, de uma unidade, de um offset, de um formato.
- Fim de sessão, se nada disto foi registado.

Não escrever para tarefas de um minuto sem consequência (renomear uma
variável, corrigir um erro de escrita num comentário). O commit chega.

## Onde

1. Uma secção nova `## AAAA-MM-DD — título curto` **imediatamente antes**
   de `## Resumo do que se aprendeu` (que fica sempre no fim). Se já
   existe uma secção do mesmo dia e tema, acrescentar-lhe uma parte em vez
   de abrir outra: `## 2026-09-28 (2.ª parte) — título`.
2. Actualizar a linha **Estado actual** no topo, se mudou.
3. Ao `Resumo do que se aprendeu` só vai uma linha, e só se a lição
   for geral.

## Formato

```
## AAAA-MM-DD — título curto

### Porque
Uma ou duas frases: o problema ou o pedido.

### O que foi feito
| Ficheiro | |
|---|---|
| `caminho/ficheiro` | o que mudou |

### Dificuldades
Numeradas. Cada uma: o que se viu, a causa **medida** (ou "não confirmada"),
e o que se fez.

### Falta / não verificado
O que ficou de fora, e porquê.
```

Secções sem conteúdo apagam-se. Uma entrada normal tem até **25 linhas**.

## Honestidade

- Diz-se o que foi **medido** e o que foi **suposto**. Sem o dado, a causa
  fica como hipótese (Regra nº 9).
- Diz-se o que **não** foi testado, e o que os testes não apanham.
- Valores com unidades. "Ficou mais rápido" não é uma entrada; "de 10 fps para
  60 fps" é.

## Quando é grande de mais

Uma investigação com tabelas e medições passa para `docs/<tema>.md` e o
progresso fica com **três linhas e a ligação**. O `progresso.md` não é para
crescer sem fim (ver limites em `codigo-modular`: vale também para texto).

## Quando vira Regra

Se a descoberta é uma armadilha que **outra pessoa cairia**, tem de estar
no `AGENTS.md` como Regra nº N (skill `documentacao` diz como). No
progresso escreve-se "ver Regra nº N" em vez de a repetir.
