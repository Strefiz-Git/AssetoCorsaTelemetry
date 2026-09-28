---
name: documentacao
description: Como manter o AGENTS.md, o README.md e a pasta docs/. Usar quando se descobrir uma armadilha que outra pessoa cairia (vira Regra), quando mudar a arquitectura, uma contagem, um caminho ou uma convenção, quando uma tabela ou índice ficar desactualizado, e quando um texto estiver a crescer demais. Diz onde cada tipo de informação vive, como numerar e escrever uma Regra, e o que os testes verificam nos documentos.
license: MIT
---

# Documentação

Cada tipo de informação vive **num só sítio**. O resto aponta para ele.

| Informação | Vive em |
|---|---|
| armadilhas provadas, arquitectura, convenções, como se testa | `AGENTS.md` |
| o que é o projecto, como se instala e arranca | `README.md` |
| como cada jogo conta o que mede (campo a campo) | `docs/f1-25.md`, `docs/assetto-corsa.md` |
| investigações a meio, com a pergunta por responder | `docs/<tema>.md` |
| o que se fez e quando | `docs/progresso.md` (skill `progresso`) |
| como se trabalha (procedimentos) | `.opencode/skill/*/SKILL.md` |

Na raiz só há **`README.md` e `AGENTS.md`**: qualquer outro `.md` na raiz
faz `verificar_readme.py` falhar.

## Uma Regra nova no AGENTS.md

Acrescenta-se quando um erro **custou tempo** e outra pessoa (ou agente)
o repetiria. Se só aconteceu uma vez e não é armadilha, fica no progresso.

- Numeração: a seguir à mais alta que existe (`grep -n "^## Regra nº" AGENTS.md`).
  As Regras **não estão por ordem** no ficheiro, e não se renumeram: outras
  páginas citam-nas por número.
- Título: a frase da lição, no imperativo ou como facto:
  `## Regra nº 25 — <a lição>`.
- Corpo, até ~40 linhas: **o que se viu**, **porquê acontece**, **o que
  fazer** e **como se verifica** (o teste que a protege). Números medidos,
  com unidades.
- Mais do que isso (tabelas, medições longas) vai para `docs/<tema>.md`, e
  a Regra fica com o essencial e a ligação.
- Acrescentar a Regra ao **índice** no topo do `AGENTS.md`, numa linha.

## Quando actualizar (a lista que se esquece)

- Ficheiro novo ou movido: a tabela *Arquitectura* (servidor ou browser).
- Teste novo: `python tests\tabela_testes.py` (skill `testes`). Nunca à mão.
- Skill nova ou alterada: a tabela de skills no topo do `AGENTS.md`.
- Contagens (capacidades, casos, `.js`, grupos da suite): procurar o número
  com `grep -n` em `AGENTS.md`, `README.md`, `docs/` e `tests/tabela_testes.py`.
- Caminho que mudou: `grep -rn "caminho/antigo"` em `docs/`, `AGENTS.md`,
  `README.md` e `tests/`. (O AGENTS.md já falou de `static/tempos.js` depois de
  ele ter passado para `static/nucleo/`.)
- Estado, versão, porta ou cadência no README: `verificar_readme.py` confere.

## Como se escreve

- Português de Portugal. Frases curtas. O **porquê** primeiro, o como depois.
- Nada de afirmar o que não se mediu (Regra nº 9): "medido" ou "não confirmado".
- Blocos de código com o comando exacto, no formato que o utilizador usa em
  Windows (`python tests\run_all.py`).
- Sem caracteres estranhos nem TAB no meio de uma palavra
  (`verificar_texto.py`). `AGENTS.md` está em LF; não converter.
- O `AGENTS.md` já é grande. Ao acrescentar, **ler o índice e ver se o assunto
  já tem casa**; duas Regras a dizerem o mesmo divergem.

## Depois de escrever

`python tests\verificar_texto.py` e `python tests\verificar_readme.py`;
`python tests\run_all.py` se mudou contagens ou a tabela.
