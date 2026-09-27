# Três coisas que apareceram a conduzir, e o desenho antes de as fazer

Escrito em 2026-09-27, com o jogo a correr e a leaderboard finalmente a
funcionar. As três vêm do mesmo sítio: o que se vê no ecrã que não bate
com o que está nos dados.

---

## 1. Quatro campos mortos, e o `lastError` que os denunciou

O `errorCount` que a app passou a publicar chegou a dar **1 001 704**,
com `lastError = TypeError: float() argument must be a string or a
number`. Foi a primeira vez que a causa apareceu sozinha.

São quatro campos, todos escritos com `float()` ou `int()` à volta de
`ac.getCarState`:

| campo | estado | valor medido |
|---|---|---|
| `tyreCoreTemp` | `CurrentTyresCoreTemp` | `[0, 0, 0, 0]` |
| `tyreSurfaceTemp` | `LastTyresTemp` | `[0, 0, 0, 0]` |
| `turboBoost` | `TurboBoost` | `0.0` |
| `kersCharge` | `KersCharge` | `0.0` |

E o mesmo `getCarState` **sem** `float()` funciona: `speedMS = 48.3`,
`spLineLength = 0.087`, `worldPosition` com os três eixos. E com `int()`
também: `gearApi = 4`.

Ou seja: a chamada é boa, e o que falha é a **conversão**. O
`getCarState` não devolve um número para estes quatro — devolve uma
sequência.

**O que não sei, e não vou adivinhar:** se devolve uma tupla de 4 (um
por pneu) ou de 1. São duas leituras diferentes para os pneus, e
escolher a errada dá 4 temperaturas erradas em vez de 4 a zero.

Por isso a correcção tem duas partes, e a segunda é a que vale:

1. um `_num(v, roda)` que aceita número ou sequência — número devolve
   ele, sequência de 1 devolve `[0]`, sequência de 4 devolve `[roda]`.
   Cobre as duas leituras sem escolher;
2. **a mensagem de erro passa a dizer o tipo e o `repr` do que
   chegou.** Uma leitura de `list` de 4 floats, ou de 1, diz qual das
   duas era — e o próximo reinício do jogo acaba com a dúvida, sem
   adivinharmos.

Um teste novo para este: o `test_loop_app.py` passa a devolver
sequências, e confirma que saem 4 temperaturas diferentes e não 4
iguais.

---

## 2. Os tempos em `--:--.---` e o teu `INT` a `-`

Duas perguntas, e só uma é bug.

### Os tempos: **não é bug**

Medido na página, com a corrida a andar: **os 11 carros estão na volta
0**. Ninguém terminou uma volta. `last` e `best` são `--:--.---` para
todos porque não há volta nenhuma para mostrar. Duas voltas depois, enchem
sozinhos. O `--` é honesto.

O que **é** uma escolha discutível: a tua própria linha mostra
`--:--.---` no TEMPO, quando o teu painel de voltas ao lado tem
`00:25.725` a correr. O teu tempo existe, está no ecrã, e a leaderboard
diz que não. Passa a mostrar o tempo da volta em curso na tua linha.

### O teu `INT` a `-`: é uma escolha, e está no código

```javascript
if (c.id === myCarId) return { txt: '-', atrasado: false };
```

Linha 2522. A tua linha é sempre `-`, por desenho. A ideia era que o
que te interessa é o delta para a tua referência, não o intervalo até ao
carro da frente — mas isso é o número que responde a *"quanto falta
para o apanhar"*, que é uma pergunta normal a meio de uma corrida.

Vai passar a mostrar o intervalo real, calculado exactamente como o
dos outros.

### E a posição: `P6` no cabeçalho, `P11` na lista

Isto é a **segunda** metade do mesmo problema, e é mais séria que as
outras duas. Do payload:

| | `pos` | `livePos` |
|---|---|---|
| tu | **11** | **5** |
| o P1 | 1 | 0 |
| o P9 | 9 | 10 |

O cabeçalho usa o `livePos` (por isso diz `P6`). A lista usa o `pos`, que
é a posição **oficial** do AC, e que nesta sessão vai 6 posições atrás da
real. O resultado é o que viste: subiste e a lista não se mexeu.

**O que é certo?** Para quem conduz, a posição ao vivo. A oficial conta
voltas completas, e no primeiro tempo de uma corrida e, no primeiro tempo de uma corrida, fica atrasada
— o jogo não te promove por teres passado mais depressa alguém que ainda
não fechou a volta. A lista passa a usar o `livePos` quando é > 0, com
o `pos` como recurso, e as setas passam a ser calculadas sobre o mesmo
número. A lista e o cabeçalho passam a dizer a mesma coisa, que é o
mínimo.

Isto estava no `progresso.md` como "livePos vs position, a investigar".
Ficou resolvido por medição: os dois campos existem, discordam, e o
utilizador é o ao vivo.

---

## 3. Combustível: piscar quando não dá para 1,5 voltas

Hoje o cartão tem `fuel-pct`, `Na reserva` em litros, e `Voltas` a
mostrar **`-` sempre** — porque `d.fuelLaps` não existe no payload. Não
há nada por trás daquele `-`.

O que o AC dá: `fuelL` (litros no depósito), `fuelPct`, `maxFuelL`. O
que **não** dá: litros por volta. E `Fuel_LastLapConsumption` não existe
na memória partilhada (Regra nº 7, tabela dos campos que não existem).

Logo: **medir**, como o pneu mede o desgaste. Sem inventar.

### Desenho

`static/combustivel.js`, puro e testável no node, como o `tyres.js` —
mesma razão: a matemática tem de se poder testar sem browser.

Mede os litros por volta pela **diferença entre o início e o fim de cada
volta**, guardada quando o contador de voltas muda. Média de todas as
voltas fechadas, não da última: uma volta com safety car não deve
fazer a estimativa descer só por causa disso.

- **0 voltas fechadas** → `a medir` (e a nota diz quantas faltam).
- **1 volta fechada** → usa-a, e diz que é de 1 volta. A diferença de
  consumo entre voltas é de poucos por cento, e o sinal é em litros (não
  em 0,1% como o desgaste do pneu), portanto 1 volta já diz alguma coisa.
- **2 ou mais** → média de todas, e a partir daí a média passa a incluir
  a nova volta e a esquecer a mais antiga, para não ficar presa ao
  passado.

Precisa de uma regra para quando o depósito **sobe** (reabastecimento no
box, ou delta de segurança): nesse caso a medição da volta é inválida e
descarta-se, em vez de dar litros por volta negativos.

### O piscar

`lapsLeft = fuelL / litrosPorVolta`

| `lapsLeft` | estado |
|---|---|
| ≥ 1,5 | normal |
| 1,0 – 1,5 | **laranja**, a piscar |
| < 1,0 | **vermelho**, a piscar |

Com `prefers-reduced-motion`, o piscar vira cor fixa — a distinção
laranja/vermelho continua a fazer o trabalho sem movimento, que é o
mesmo que se fez com o DRS.

E a linha `Voltas` passa a mostrar o número em vez de `-`, que é o que
faz a linha existir.

### Uma coisa que este desenho **não** resolve

Um depósito com 1,4 voltas de margem é um número **médio**. Numa corrida
com safety car, ou a parar no box, o consumo real muda. Por isso o
aviso é "não dá para 1,5 voltas **ao ritmo médio**", e o texto diz
isso — um número de planeador que se apresenta como verdade
durante uma caution seria pior do que nenhum número.
