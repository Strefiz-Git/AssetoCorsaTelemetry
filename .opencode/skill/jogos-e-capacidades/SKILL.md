---
name: jogos-e-capacidades
description: Checklist para acrescentar um campo de telemetria, uma capacidade ou um jogo novo ao painel. Usar sempre que se acrescentar algo ao snapshot() de um jogo, se declarar ou mudar uma capacidade, se mexer em jogos/base.py, static/jogos/ ou no seletor, ou se for integrar um jogo novo. A capacidade declara-se em três sítios e esquecer um deles esconde ou mostra mal um elemento sem dar erro.
license: MIT
---

# Jogos e capacidades

A regra que organiza tudo: **o núcleo não sabe qual é o jogo, sabe o que
um jogo tem de ter** (`AGENTS.md`, *Arquitectura*). Esta skill é o
procedimento; as armadilhas de cada jogo estão nas Regras e em `docs/`.

Antes de começar: ler a parte do jogo em `docs/f1-25.md` ou
`docs/assetto-corsa.md`, e as Regras nº 3, 7, 8, 22 e 24 quando a mudança
toca em campos, unidades ou ordem das rodas.

## Campo novo que só um jogo tem

1. Escrever o campo no `snapshot()` **desse jogo**
   (`actelemetry/jogos/<id>/`), com unidades no nome ou no comentário.
   Não inventar propriedades que o jogo não publica (Regra nº 7).
2. Declarar a capacidade em **três** sítios, senão o painel esconde mal:
   - `actelemetry/jogos/base.py`: a lista canónica `CAPACIDADES`, se é uma
     chave nova, e o `_capacidades()` de **cada** jogo tem de a devolver
     (`"on"`, `"off"` ou `"auto"`), nem que seja `"off"`, porque o `off`
     documenta o que esse jogo não dá;
   - `static/jogos/<id>.js`: o que o painel pinta;
   - `data-cap` no `static/index.html`, se há um elemento para esconder.
3. A regra do campo (conversão de unidade, limite, "sem dado") vai para o
   módulo do jogo, em função pura (`codigo-modular`), e não para o `app.js`.
   `null` é «não sei»; `0` é uma medida (ver *Ao mexer na matemática das voltas*).
4. Texto visível: chave nova no `I18N` do `app.js`, nos **quatro** idiomas.
   **Sem comentários dentro do `I18N`** (o auditor avalia-o em Python).
5. Correr `python tests\test_f125_parser.py` e `node tests\test_jogos.js`:
   o primeiro confere o servidor, o segundo o browser, e cada um acusa uma
   lista de capacidades incompleta. Depois `auditar_frontend.py`.
6. Se o número de capacidades mudou (hoje 81), actualizar as contagens
   escritas nos documentos (skill `documentacao`, *Quando actualizar*).

## Ordem das rodas e unidades

A conversão faz-se **uma vez, na fronteira**, no módulo do jogo. AC:
`[FL, FR, RL, RR]`. F1 25: o jogo manda `[RL, RR, FL, FR]` (Regra nº 22).
Nenhum array de 4 chega ao painel sem passar pela tradução do jogo.

## Jogo novo

Só arrancar depois de haver documentação da telemetria do jogo. Ficheiros:

| Onde | O quê |
|---|---|
| `actelemetry/jogos/<id>/` | `jogo.py` (a fachada, cumpre `JogoBase`), `logica.py` (as capacidades), mais o leitor (`receptor.py` ou `protocolo.py`, um por assunto) |
| `actelemetry/jogos/__init__.py` | `import` do jogo e **uma** entrada no dicionário `JOGOS` (o `ORDEM` do ecrã de escolha segue-o) |
| `static/jogos/<id>.js` | as regras do jogo, puras, com o bloco `module.exports` |
| `static/jogos/seletor.js` | uma entrada em `JOGOS` (`<id>: () => global.<Modulo>`) |
| `static/index.html` | `<script src="/jogos/<id>.js">` antes do `seletor.js` |
| `static/app.js` | apenas as chaves `I18N` novas (4 idiomas) |
| `docs/<jogo>.md` + `docs/README.md` | a telemetria do jogo, campo a campo, e a ligação no índice |
| `tests/` | `test_<jogo>_parser.py` e o caso em `test_jogos.js`, registados na suite (skill `testes`) |

Depois: `python tests\verificar_servidor.py` (arranca o sistema com todos
os jogos e faz a troca a quente), e uma Regra nova no `AGENTS.md` para cada
armadilha descoberta (skill `documentacao`).

Um `if (jogo === '...')` no `app.js` é sinal de que uma regra está no
sítio errado.
