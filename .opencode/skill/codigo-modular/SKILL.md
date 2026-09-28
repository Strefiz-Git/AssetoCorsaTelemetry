---
name: codigo-modular
description: Regras para escrever código que não engorda. Usar SEMPRE que se criar ou alterar código (Python, JavaScript, CSS ou HTML), antes de acrescentar mais de ~20 linhas a um ficheiro, ao criar uma função nova, ao ver um ficheiro grande a crescer, ou quando houver lógica que outro código possa querer reutilizar. Manda fazer ficheiros pequenos, módulos, helpers e funções puras em ficheiros próprios. Não reorganiza pastas.
license: MIT
---

# Código modular

O objectivo é que qualquer função útil possa ser importada por **outro
código** sem arrastar o resto do projecto atrás, e que nenhum ficheiro
volte a ser um sítio onde já ninguém consegue ler tudo.

Esta skill decide **como se escreve**. Onde vai cada coisa do painel
(núcleo, jogo, frontend) está no `AGENTS.md`, secção *Arquitectura*, e
não se repete aqui.

## Limites

| Coisa | Alvo | Limite duro |
|---|---|---|
| Ficheiro novo (`.py` ou `.js`) | até 200 linhas | 300 |
| Função | até 40 linhas | 60 |
| Parâmetros de uma função | até 4 | 6 (mais do que isso pede um dicionário ou um objecto) |
| Ficheiro CSS novo | até 300 linhas | 400 |

Passou do limite: **parte antes de continuar**. Não é "depois refaço".

## Ficheiros que já passam dos limites

Alguns ficheiros já estão acima de qualquer limite (`static/app.js`,
`static/style.css`, `static/index.html`, `acshm.py`,
`actelemetry/jogos/f125/receptor.py`, `actelemetry/jogos/f125/protocolo.py`).
Para estes vale a regra do **congelado**:

1. **Não crescem.** Código novo vai para um módulo novo, e o ficheiro
   grande só ganha a linha que o chama.
2. Uma correcção de bug pequena pode ficar lá dentro.
3. Ao mexer numa zona deles, se a função que se toca é **pura**, tirá-la
   para um módulo é bem-vindo: em branch `refactor/…` e commit próprio
   (`git-workflow`), nunca misturada com a correcção.
4. **Não se faz uma migração em massa por iniciativa própria.** Só se o
   utilizador a pedir, e então com branch `refactor/…` (ver `git-workflow`).

Não mover nem renomear pastas ou ficheiros existentes. Criar uma pasta
nova só quando aparecer o primeiro ficheiro que a justifica.

## Como se parte

**Uma responsabilidade por ficheiro.** Se o nome do ficheiro precisa de
um "e", são dois ficheiros.

**Helper reutilizável = ficheiro próprio.** Uma função (ou uma família
mínima de funções que só fazem sentido juntas) que outro código pode
querer vive num ficheiro com o nome do que faz, e não dentro do ficheiro
que a usou primeiro. Nome pelo que faz: `formatar_tempo.py`, `tempos.js`;
nunca `utils`, `helpers`, `misc`, `common`.

**Funções puras.** Recebem o que precisam e devolvem o resultado. Sem
DOM, sem estado global, sem escrever em disco, sem ler o relógio a
menos que o recebam por parâmetro. É isto que as torna testáveis e
reutilizáveis (o motivo de `static/nucleo/` existir).

**Uma função, uma coisa.** Ler, converter e desenhar são três funções.
Se uma função faz `if (jogo === ...)`, a variação pertence ao módulo do
jogo, e não a um `if` espalhado.

**Sem cópias.** Antes de escrever uma função, procurar se já existe
(ver `sessao-de-trabalho`, secção *Procurar antes de ler*). Duas cópias
divergem, e a Regra nº 14 mostra o preço. Se existe mas está presa a um
ficheiro grande, extrair e importar, e não copiar.

## Onde põe o helper novo

| Preciso de… | Vai para |
|---|---|
| matemática/JS que vale nos dois jogos | `static/nucleo/<nome>.js` |
| regra de um jogo, em JS | `static/jogos/<jogo>.js` (ou um módulo novo ao lado, se o ficheiro já é grande) |
| helper Python usado por vários jogos ou pelo núcleo | `actelemetry/util/<nome>.py` (criar a pasta com `__init__.py` no primeiro helper) |
| helper Python de um só jogo | `actelemetry/jogos/<jogo>/<nome>.py` |
| helper só para testes | `tests/`, com nome que diga o que faz |

O núcleo do servidor **não sabe qual é o jogo**: um helper em
`actelemetry/util/` nunca importa nada de `actelemetry/jogos/`.

## Ligar um módulo novo (JavaScript)

O frontend não tem bundler: são `<script>` globais. Portanto:

1. `'use strict';` no topo, sem DOM, sem `S`.
2. No fim, o bloco de exportação que os outros já têm:
   ```js
   if (typeof module !== 'undefined' && module.exports) {
     module.exports = { nomeDaFuncao };
   }
   ```
3. `<script src="/nucleo/<nome>.js"></script>` no `index.html`, **antes**
   de qualquer módulo que o use (a ordem das tags é a ordem de carga).
4. Um teste em node em `tests/` (ver skill `testes`).

## Ligar um módulo novo (Python)

Import relativo dentro do pacote `actelemetry` (`from . import x`,
`from ..base import y`). Um import relativo partido só rebenta quando o
caminho passa por essa linha, e é para isso que existe
`tests\verificar_servidor.py`: correr sempre que se mexe em imports.

## Antes de fechar

- [ ] Nenhum ficheiro novo acima de 300 linhas, nenhuma função acima de 60.
- [ ] Nenhum ficheiro congelado cresceu além da linha que chama o módulo.
- [ ] Nada copiado: o que já existia foi importado.
- [ ] Convenções do `AGENTS.md` (secção *Convenções*) cumpridas; num ficheiro que já existe, os nomes seguem o estilo que ele já tem.
