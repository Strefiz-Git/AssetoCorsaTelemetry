---
name: git-workflow
description: Obrigatória em todos os projectos. Commita automaticamente cada alteração concluída, cria branches para trabalho grande, e mantém o histórico legível — sem perguntar ao utilizador. Usar sempre que uma tarefa fechar um bloco de trabalho, antes de mexer em algo que atravesse várias camadas, e no fim de cada sessão.
license: MIT
---

# Git workflow

Esta skill é **obrigatória**. Não se pergunta ao utilizador se se deve
commitar — commita-se. O objectivo é que nunca se perca trabalho e que o
histórico explique *porque* mudou, não só *o que* mudou.

## Regras

**1. Commitar sem pedir.** Nunca perguntar "queres que commite?". Cada
bloco de trabalho concluído vai para um commit. Um commit sem pedir é
barato e reversível; trabalho não commitado é perdido.

**2. Uma branch para trabalho grande.** Criar branch quando a mudança
atravessa mais do que uma camada:

| Tipo de mudança | Branch |
|---|---|
| Bug fix localizado | `main` directamente |
| Função nova | `feat/nome-curto` |
| Correcção de algo que estava a dar mal | `fix/nome-curto` |
| Refactor / reestruturação | `refactor/nome-curto` |
| Documentação grande | `docs/nome-curto` |
| Trabalho experimental | `exp/nome-curto` |

Criar a branch **antes** de começar a mexer, não no fim. Assim o trabalho
experimental nunca contamina o `main`.

**3. Um commit, uma coisa.** Se a mensagem precisa de "e", são dois
commits. Não misturar bug fix com reformatação.

**4. A mensagem diz porquê.** O *diff* já diz o quê.

```
❌ Corrigido o problema dos pneus
✅ Destrava struct 36 bytes: 9 campos comentados na referência existem
```

**5. Commitar depois de verificar.** Antes de commitar, correr o que
verifica a alteração (skill `testes` diz o quê). Um commit que não compila
ou que parte os testes é pior do que nenhum commit.

**6. O registo vai no commit.** Quando o trabalho tem entrada em
`docs/progresso.md` (skill `progresso` diz quando), essa entrada vai no
**mesmo** commit desse trabalho, e não num commit à parte no fim.

## Antes de mexer

```bash
git status --short          # há trabalho por commitar?
git log --oneline -5        # onde é que estamos?
git branch --show-current
```

Se a árvore estiver suja por trabalho anterior, commitar aquilo primeiro
com mensagem do que era, e só depois começar o trabalho novo.

## Durante

Commitar assim que um bloco fecha — não acumular dez mudanças e fazer
um commit gigante no fim. Um bug corrigido commita-se logo, porque a
seguinte hipótese de onde está o erro fica mais fácil de testar.

## No fim de cada sessão

A ordem completa do fecho (testes, progresso, documentação) está na skill
`sessao-de-trabalho`. O que é do git:

1. `git status` para confirmar que não ficou nada de fora
2. Commit final com o que se fez nessa sessão
3. Dizer ao utilizador onde ficou a branch e o hash

## Nunca fazer

Isto é onde a automatização pára. Não é cautela a mais — é que estas
operações **não se desfazem** e publicam coisas.

| Nunca | Porquê |
|---|---|
| `git push` | Publica. Precisa de remote, e o remote é do utilizador. |
| `git push --force` | Apaga história do servidor. Irrecuperável. |
| `git reset --hard` sobre trabalho não commitado | Apaga trabalho sem deixar rasto. |
| `git checkout .` / `git restore .` com alterações por guardar | Apaga alterações sem aviso. |
| `git clean -fd` | Apaga ficheiros não versionados. |
| `git rebase` de branches já publicadas | Reescreve histórico partilhado. |
| Apagar branches sem confirmar | Pode ter trabalho por portar. |
| Mexer em `.git/config` ou em credenciais | Coisa do utilizador. |

Tudo o resto — branch, add, commit, log, diff, status, stash, merge local
— é automático.

## Se houver remote configurado

`git push` continua a ser manual até o utilizador dizer o contrário. Se
disser, push para a branch de trabalho, nunca para o `main`, e nunca com
`--force`.

## Mensagens

Primeira linha: até 72 caracteres, imperativo, sem ponto final.
Sem BOM e sem caracteres estranhos: em PowerShell 5.1 o `Out-File
-Encoding utf8` escreve um BOM que o `git commit -F` lê como parte do texto.
Escrever a mensagem com `-m`, ou com o ficheiro gravado em UTF-8 **sem** BOM
(`tests\verificar_commits.py` confere).
Corpo: em branco depois da primeira linha. Explicar o porquê e as
consequências, incluindo o que **não** foi feito e porquê.

Exemplo:

```
Corrige o peso de fonte que nao existe na Titillium Web

O dashboard pedia ExtraBold (800) e a Titillium Web so vai de Light
(300) a Black (900). O SimHub caia na fonte do sistema e os numeros
ficavam sem o ar de F1. Passou a usar so pesos com ficheiro .ttf
correspondente: Light, Regular, SemiBold, Bold, Black.

Bug-found, nao bug-fix: a propriedade ERSPercent tambem nao e'
publicada pelo plugin do AC, dai os valores de ERS ao contrario.
```

## Ficheiros

Antes do primeiro `git add`, confirmar que o `.gitignore` cobre o que não
deve ser versionado. Neste projecto: `__pycache__`, `*.log`,
`dash-v14-backup.simhubdash`, pastas de editores, `.venv`.

Fontes e dados **devem** ser versionados. Os `.ttf` estão sob licença
OFL e a licença acompanha-os.
