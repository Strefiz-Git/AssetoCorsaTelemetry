---
name: sessao-de-trabalho
description: Como trabalhar com eficiência neste repositório, em Windows. Usar no INÍCIO de qualquer sessão ou tarefa e no FIM dela. Diz por onde começar sem ler o AGENTS.md inteiro, como procurar antes de abrir ficheiros grandes, como editar sem estragar codificação nem fins de linha, e a ordem certa do fecho (testes, progresso, commit). Usar também quando se estiver a gastar muito contexto, a reler ficheiros, ou a repetir comandos.
license: MIT
---

# Sessão de trabalho

Esta skill é o **maestro**: diz a ordem, e delega o detalhe nas outras.
Não repete regras que já estão noutro sítio.

| Assunto | Quem manda |
|---|---|
| commits, branches, o que nunca se faz | `git-workflow` |
| como se escreve e parte o código | `codigo-modular` |
| que testes correr e como acrescentar | `testes` |
| campo novo, capacidade nova, jogo novo | `jogos-e-capacidades` |
| registo do que se fez | `progresso` |
| AGENTS.md, README e `docs/` | `documentacao` |

## Começar

1. `git status --short` e `git log --oneline -5`. Árvore suja de trabalho
   anterior: commitar isso primeiro (`git-workflow`).
2. **Ler o topo do `AGENTS.md`** (o mapa e o índice das regras), e só
   depois a Regra ou a secção que a tarefa toca. O ficheiro tem mais de
   mil linhas e não se lê inteiro: procura-se pelo índice.
3. Tarefa que mexe em telemetria de um jogo: ler primeiro a parte certa de
   `docs/f1-25.md` ou `docs/assetto-corsa.md`.
4. Tarefa que continua trabalho anterior: ler o fim do `docs/progresso.md`
   (a última entrada e o **Estado actual** do topo).
5. Tarefa grande (atravessa camadas, refactor): criar a branch **agora**.

## Procurar antes de ler

Os ficheiros grandes (`app.js` tem mais de 3000 linhas) não se abrem
inteiros.

1. Procurar o símbolo ou a frase: `grep -n`, ou `Select-String` no
   PowerShell. Procurar também se a função que se ia escrever já existe
   (ver *Sem cópias* em `codigo-modular`).
2. Ler só o intervalo à volta do resultado (`view` com intervalo de linhas).
3. Vários ficheiros independentes para ler: pedir todos **na mesma chamada**.
4. Comandos independentes, juntar (`;` em PowerShell 5.1, `&&` só noutras shells).

Não voltar a ler um ficheiro que já se leu e que só se alterou pelas
próprias mãos: sabe-se o que lá está.

## Editar sem estragar (Windows)

Estas coisas já correram mal, e cada uma tem um teste a apanhá-la:

- **Fins de linha.** Os ficheiros não são todos iguais (`AGENTS.md` e a
  maior parte do código estão em LF; `docs/progresso.md`, `.gitignore`,
  `git-workflow` e alguns testes estão em CRLF; `git ls-files --eol` mostra).
  **Manter o que o ficheiro já tem.** Nunca converter um ficheiro inteiro:
  um `git diff` de 82 linhas onde se mudaram 8 é o sinal. Ficheiro novo: LF
  (o `.gitattributes` normaliza).
- **Codificação.** UTF-8 sem BOM. Em PowerShell 5.1, `>`, `Out-File` e
  `Set-Content` escrevem UTF-16 ou com BOM e estragam acentos. Editar com as
  ferramentas de edição, ou com Python (`io.open(..., encoding='utf-8',
  newline='')`). Ver `verificar_texto.py` e `auditar_frontend.py`.
- **`\t` numa string Python** que reescreve um ficheiro vira um TAB de
  verdade e parte caminhos como `tests\test_x.py`. Usar a ferramenta de
  edição, e não um script que reescreve o `AGENTS.md`.
- **Caracteres estranhos** (CJK, mojibake) escritos sem querer em
  comentários: `python tests\verificar_texto.py` apanha.
- **Escrever nas páginas reais de memória do jogo:** nunca (Regra nº 1).

## Durante

- Bloco fechado, verificado, **commit** (`git-workflow`). Não acumular.
- Se algo se descobrir e contradisser uma Regra do `AGENTS.md`, parar e
  dizê-lo ao utilizador em vez de contornar.
- Não afirmar uma causa sem o dado que a prove (Regra nº 9).

## Fechar (esta é a ordem, e é o único sítio onde está)

1. **Testes:** os focados enquanto se trabalha; no fim `python tests\run_all.py`
   (ver `testes`). Código de saída 2 com o AC aberto não é falha.
2. **Progresso:** confirmar que cada bloco fechado já tem a sua entrada em
   `docs/progresso.md` (skill `progresso`), e acrescentar as que faltam e o
   **Estado actual**. Cada entrada vai no commit do trabalho que descreve.
3. **Documentação:** se uma Regra, a arquitectura ou uma contagem mudou,
   actualizar `AGENTS.md`/README (skill `documentacao`).
4. **Commit final** e `git status` limpo (`git-workflow`).
5. Dizer ao utilizador: o que se fez, a branch, o hash, e o que **não** se
   fez ou não se verificou. Nunca `git push`.
