---
name: testes
description: Como verificar alterações e acrescentar testes neste projecto. Usar depois de qualquer alteração de código antes de commitar, ao criar um teste, ao corrigir um bug (que tem de ganhar um teste), ao acrescentar um módulo ou um ficheiro em tests/, e quando um teste passar sem parecer provar nada. Diz que teste correr para cada tipo de mudança, como registar um teste novo na suite, e como garantir que um teste morde.
license: MIT
---

# Testes

Comandos em Windows, a partir da raiz do projecto. A suite completa é
`python tests\run_all.py`. Sai com código diferente de zero se algo falhar
e com **2** se o AC estiver aberto e os testes de memória forem saltados
(isso **não** é falha).

A tabela do que cada teste prova está no `AGENTS.md` (secção *A suite*).
Não se repete aqui, e **não se edita à mão** (ver mais abaixo).

## O que correr, conforme o que se mexeu

Enquanto se trabalha, o teste focado. No fim, `run_all.py`.

| Mexi em… | Correr |
|---|---|
| `acshm.py` (structs, leitura) | `test_layout.py`, `test_acshm.py`, `test_contrato.py` |
| um jogo no servidor (`actelemetry/jogos/…`) | `test_f125_parser.py`, `verificar_servidor.py`, `test_payload.py` |
| regras de tempos, pneu, combustível | o `.js` respectivo: `node tests\test_tempos.js` (etc.) |
| regras de um jogo no browser (`static/jogos/`) | `node tests\test_jogos.js` |
| `app.js`, `index.html`, `style.css` | `auditar_frontend.py`, `verificar_js.py` |
| clima | `node tests\test_tempo.js` |
| texto, docs, README | `verificar_texto.py`, `verificar_readme.py` |
| imports ou a estrutura de pastas | `verificar_servidor.py` (é o que apanha imports relativos partidos) |

Nunca commitar com um teste vermelho (`git-workflow`, regra 5).

## Um teste que passa não prova nada, até morder

Duas Regras do `AGENTS.md` mandam: **nº 4** (um teste auto-consistente
passa mesmo com o erro) e **nº 12** (um `.pyc` envenenado faz o teste
mentir). Na prática:

1. **Escrever o teste primeiro, ver-o falhar**, e só depois corrigir. Um
   bug corrigido ganha o teste que o teria apanhado.
2. Ou **partir o código de propósito** e confirmar que o teste falha. Para
   regras críticas existe o padrão `mutacao_*.py`: parte o código, corre o
   teste, exige que falhe, e repõe.
3. Dados de teste que vêm do próprio código que se testa não provam nada:
   usar valores **medidos** do jogo (Regra nº 15).
4. Testes Python: `PYTHONDONTWRITEBYTECODE=1` e limpar `__pycache__`,
   como o `run_all.py` faz. Um `.pyc` de uma versão partida mente.

## Acrescentar um teste novo (todas as partes, ou a suite mente)

1. Escrever o ficheiro em `tests/`: `test_<assunto>.py` ou
   `test_<assunto>.js` (node). Sai com 0 se passa, 1 se falha, 2 só para
   "o jogo está aberto".
2. Registá-lo em `tests/run_all.py`, na lista `SUITE`:
   `("o que prova, numa frase", "py" ou "node", "ficheiro")`.
3. Acrescentar a descrição em `DESCRICAO` dentro de `tests/tabela_testes.py`.
4. Regenerar a tabela: `python tests\tabela_testes.py`. **Não editar à mão**
   a secção *A suite* do `AGENTS.md`: o script substitui-a inteira, e uma
   edição manual perde-se na próxima corrida.
5. Um ficheiro em `tests/` que **não** entra na suite (precisa do jogo, do
   browser ou de dados gravados) vai para o dicionário `FORA`, com o
   motivo. Um ficheiro sem descrição faz o script parar: é de propósito.
6. Correr `python tests\run_all.py` de ponta a ponta.

Se o teste é sobre um número que o README ou o AGENTS repetem (contagens de
ficheiros, casos, capacidades), confirmar que `verificar_readme.py` continua
a passar (ver `documentacao`).

## O que os testes automáticos não substituem

- Valores reais com o jogo aberto: `python tests\verify_real.py`, e
  **olhar** para os números (Regra nº 4).
- Layout nos três tamanhos (largo, tablet, telemóvel).
- Um `TypeError` por argumento a mais ou a menos só se vê a correr (Regra nº 14).

Quando algo disto não foi verificado, dizê-lo no progresso e ao utilizador.
