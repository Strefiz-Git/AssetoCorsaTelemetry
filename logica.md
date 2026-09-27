# Segunda volta do exame: a lógica e o visual

Escrito a 2026-09-26, depois da primeira passagem (que foi de
acessibilidade — ver `acessibilidade.md`). Esta volta vai à **lógica** e
ao **visual**, que a primeira só tinha tocado.

Mesma regra: **cada número foi medido**, e onde a medição não pôde
discriminar está dito. E a regra vale para mim: durante este exame
cometi **dois** erros de teste que acusaram problemas inexistentes, e
**um** erro meu que partiu um ficheiro. Os três estão escritos abaixo
porque são mais úteis que as conclusões.

---

## 1. O achado grave: um NaN deixa o dashboard preso

### O que medi

Chamei `render()` com um estado real e depois com os mesmos dados
corrompidos, cronometrando. Em todos os casos, com o jogo parado e uma
página limpa:

| entrada | tempo de um `render()` |
|---|---|
| estado real, como controlo | **0,5 ms** |
| todos os números a `0` | 0,7 ms |
| todos os números a `-1` | 0,7 ms |
| todos os números a `NaN` | **não voltou em 60 s** |
| todos os números a `Infinity` / `-Infinity` | idem |

Não é lento: **é um ciclo que não acaba**. E o pior não é o render — é
que **o separador fica inutilizável e a navegação deixa de responder**.
Tive de fechar o separador. Para o utilizador, isto é "o site frozei e
tive de fechar a janela".

### A correcção

Sanear no limite, com `sanear()`, em `render()` e `renderOpponents()`:

```javascript
// um numero que nao e' finito NAO E' UM DADO
if (typeof v === 'number' && !isFinite(v)) d[k] = undefined;
```

**Não se põe 0**, porque 0 significa "parado" e seria uma mentira. O
código de desenho já sabe lidar com a ausência, e é a ausência que se
quer mostrar. Verificado: com todos os números a `NaN`, o ecrã mostra
`--`, `--:--.---`, `a medir` e `—`, e não aparece um único `NaN`,
`undefined`, `null` ou `Infinity`.

Depois da correcção: **0,4 a 0,9 ms** para `NaN`, `Infinity` e
`-Infinity`.

### Porque é que isto é uma repetição, e não um azar

O `acshm.py` já tem `_finito()` exactamente por isto, e o comentário
dela explica: o AC publica `inf` no `sessionTimeLeft` de um treino sem
cronómetro, e `int(inf * 1000)` rebentava o `snapshot()` **inteiro**, e
o `/api/state` passava a dar erro.

Ou seja: **o mesmo tipo de valor, do mesmo jogo, no mesmo sitio, com
outro sintoma.** O servidor ficou defendido; o cliente nunca ficou. É a
Regra nº 4 aplicada ao outro lado da ligação.

**Não isolei o campo culpado.** A instrumentação (60 s por tentativa) era
demasiado grossa, e isolar por campo custaria mais do que vale. Não faz
falta: com a sanitização a classe do bug deixa de existir.

---

## 2. Tradução: uma chave no ecrã e 24 linhas mortas

### pt-BR estava a faltar duas chaves

| | antes | depois |
|---|---|---|
| chaves em pt-PT / es / en | 124 | 124 |
| chaves em pt-BR | **121** | **124** |

Faltavam `tyres.notWear` e `tyres.notWearWhy`. E o caminho é **vivo**:
o estimador chama `t('tyres.notWear')` quando a taxa de desgaste não é
plausível — que, pelas medições deste projecto, é a **situação normal**
neste jogo (0,17 % ao fim de duas voltas dariam 588 voltas de vida).

### O pior: `t()` não tinha fallback nenhum

```javascript
function t(k) { return (I18N[LANG] && I18N[LANG][k]) || k; }
```

Sem fallback. Uma tradução em falta — ou **uma letra trocada no nome da
chave** — devolvia a chave crua, e a chave crua aparecia no ecrã. Um
brasileiro lia `tyres.notWear` no sítio do texto.

Agora cai para o português e avisa uma vez na consola. Um brasileiro vê
português, que é Mau mas legível; e em desenvolvimento o aviso aparece.

> O meu primeiro teste deste ponto **errou** e disse que não havia
> problema, porque escrevi `DEF.lang = 'pt-BR'` e chamei `t()`, que usa o
> global `LANG` — que só muda em `applyLang()`. O teste affirmava o
> oposto do que se passava. Corrigido, o bug era real.

### Seis chaves mortas

Contadas **fora** das definições, no JS e no HTML:

`boot.closed` · `state.off` · `state.on` · `tyres.lapsLeft` ·
`tyres.used` · `tyres.worn`

24 linhas removidas. `tyres.worn` e `tyres.used` sugerem que o painel dos
pneus foi reescrito e os rótulos antigos ficaram para trás.

---

## 3. Onde a medição me desmentiu (dois casos)

### O "texto cortado a 1×" — já contado na primeira passagem

Injectar `*{font-size:...}` não é aumentar o texto: substitui as 60
declarações `px` por valores derivados de `1em`. Re-medido sem a
injecção, nos 39 pares vista × largura: **0 cortados**. Ver
`acessibilidade.md`, secção 5.

### O script que partiu o ficheiro

Tentei remover chaves duplicadas com um script que comparava cada linha
com a anterior. Ele removeu **35 linhas legítimas** — vários `}`
seguidos, que são perfeitamente normais em JavaScript — e o `app.js` ficou
sintacticamente partido. O `node --check` apanhou.

Restaurei do `HEAD` e reapliquei à mão, com o `edit` (que falha em voz
alta se o alvo não bater certo) e `node --check` depois de cada passo.

**A lição que fica:** para remoções em massa, `edit` com âncora
verificada, e `node --check` sempre. Um script que apaga por
"parecido com a linha anterior" não sabe a diferença entre uma
duplicação e uma coincidência.

---

## 4. Visual: o que medi e o que está por decidir

### O transbordo do cartão dos pedais (medido)

A zona de **861 a 1240 px**: o conteúdo dos pedais mede 349 px dentro de
uma caixa de 260 px. **Já estava provado como anterior** por comparação
com o `HEAD:static/style.css`, e as três opções estão em `ideia.md`.
Não mudei nada aqui — é uma decisão de layout, não uma correção.

### O que não medi, e porquê

- **A hierarquia visual** (o que é mais importante LOOKS mais importante)
  só se julga a ver. As capturas de browser falham neste ambiente
  ("needs a visible tab"), e medir só com números de DOM não diz se uma
  coisa parece importante — só se é grande. **Por isso não afirmo nada
  sobre a hierarquia.**
- **A legibilidade do mapa a conduzir** é um caso de teste com o jogo a
  correr, não com a página parada.

---

## 5. O modo misto perde informação em silêncio

Já apontado na primeira passagem e **medido com mais rigor agora**: 48
campos no misto contra 78 na telemetria. Faltam a vida do pneu, os
danos, o B. TRAVA, o ABS, o TC, os tempos de volta, o delta, os sectores
e o cartão de combustível.

O pior continua a ser o mesmo: **`renderTyres()` chama `renderTyreLife()`
e `renderDanos()` sempre, e no modo misto esses elementos não existem**,
por isso as funções saem em silêncio. Sem erro na consola, sem aviso.

Isto é a Regra nº 16 pelo outro lado: duas vistas da mesma telemetria
com as convenções a divergir sem ninguém dar por isso. Mudas de vista e
perdes a previsão do stint e o aviso de danos, sem o interface te dizer
nada.

**Continua a ser decisão tua:** meter o stint e os danos no cartão dos
pneus do misto (são duas linhas), ou avisar que a vista é resumida.

---

## 6. O que não fiz, e porquê

| | porquê |
|---|---|
| Escala de texto em `rem` | 60 sítios. Trabalho mecânico, mas a decisão de o fazer agora é tua. |
| Rótulos `aria-label` em todos os valores | Trabalho grande, e o `aria-live` a 1 Hz é delicate. Ao teu ritmo. |
| `forced-colors` no Windows | A regra está escrita; falta ligá-la no Windows e ver. |
| Hierarquia visual | Não consigo medir honestamente sem ver. |

---

## 6. A leaderboard: um fio que engolia demasiado bem

O pior defeito que encontrei em todo o projecto, e o único que estava a
impedir uma feature inteira de funcionar.

### O que se via

Com o jogo a correr, numa corrida a sério:

```
numVehicles      = 11
carro[0] id=0 nome=b'' modelo=b'' lap=0 pos=0 vel=0.0
carro[1] id=0 nome=b'' modelo=b'' lap=0 pos=0 vel=0.0
carro[2] id=0 nome=b'' modelo=b'' lap=0 pos=0 vel=0.0
   ... 3 leituras separadas por 1 s, sempre igual
```

O cabeçalho dizia 11 carros. Os 128 slots, a zero. **O fio escrevia e
o número chegava** — o que é a pior combinação possível, porque parece
que está a funcionar.

### Duas excepções, nenhuma delas visível

**A primeira:** `_tempPorPneu` fazia `for roda in acsys.WHEELS`. O
`acsys.py` do jogo define

```python
class WHEELS:FL,FR,RL,RR=range(4)
```

que é uma **classe**, e uma classe não se percorre:
`TypeError: 'type' object is not iterable`.

O `TypeError` nascia dentro da **lista compreensiva**, ou seja **fora**
do `_seguro`, que não a apanhava. E `_tempPorPneu` é um **argumento**
de `escreverCarro`, portanto é avaliado *antes* da chamada: o
`numVehicles` já tinha sido escrito (vem antes no loop) e o carro 0
nunca chegava a ser escrito.

**Cabeçalho certo, lista vazia.** É a assinatura exacta do defeito.

**A segunda:** o `_seguro` devolvia `0.0` por omissão, e a struct tem
campos `c_int32`. O `ctypes` recusa um `float` num inteiro — *em
atribuição*, que é **depois** de o `_seguro` já ter devolvido:

```python
info.bestLapMS = _seguro(lambda: ..., -1)   # tem -1 explícito, está bem
info.lapCount   = _seguro(lambda: ...)       # usa o omissão → 0.0 → TypeError
```

Ou seja: o `_seguro` impedia a excepção de matar o fio, e a excepção
reaparecia um instante depois, na mesma linha, dentro do
`actualizar()`. **A protecção e a falha no mesmo sítio.**

### O que é realmente objectionável

Não é nenhuma das duas. É que **nada era dito**.

A app engole excepções de propósito, e está certo — uma leitura que
levanta excepção não pode matar o fio. Mas o `_seguro` devolvia `'-1'`
quando a leitura falhava, e `'-1'` é o valor que o AC usa para dizer
*"não há carro neste slot"*. Portanto **qualquer** excepção punha a app
a concluir que a pista estava vazia, para sempre, sem dar erro.

E o dashboard, não sabendo de nada, mostrava:

> **A aguardar os dados dos adversários.**
> A app Python do SimHub escreve a página de memória com os carros.
> Confirma que está activa no Content Manager…

Com a app **ligada e a escrever**. A instrução era errada, e era a
única que havia. Quem a obeyesse não resolvia nada, e não havia forma
de saber que o problema era outro.

### O que ficou

| | antes | depois |
|---|---|---|
| Fim da lista | `getCarName() == '-1'` | `getCarsCount()`, que é o que o jogo deu |
| Falha de leitura | indistinguível de "não há carro" | o carro é escrito sem nome, e a falha é contada |
| Texto da falha | inexistente | `lastError`, publicado no cabeçalho |
| No ecrã | "liga a app no Content Manager" | o erro, e a nota de que **não** é a app estar desligada |
| Teste | nenhum | `test_loop_app.py`, com `mutacao_loop.py` a provar que morde |

`tests/test_loop_app.py` corre o loop contra um `ac` falso e confirma
que os carros continuam a ser escritos quando uma leitura rebenta. É o
teste que teria dito "isto está partido", e não havia nada que provasse
que a lista vazia tinha uma causa.

**A lição:** um mecanismo que evita que um erro se veja é um mecanismo
que impede que o erro se corrija. O `_seguro` era a decisão certa com a
implementação errada — o que faltava era publicar o que foi engolido, e
separar *falhou* de *não há*.

### E uma lição sobre o meu próprio teste

`mutacao_loop.py` apanha 2 das 3 mutações à primeira, e a terceira
escapou por uma razão que vale mais que o teste:

> A mutação do `0.0` **não** era apanhada porque o `BestLap` passa um
> `-1` explícito e nunca usa o valor por omissão. O campo que depende
> do omissão é o `lapCount` — e é lá que o bug morava.

E, quando corrigi o teste, ele passou a mostrar **60 erros** no caso
"tudo funciona". 60 = 20 por carro = exactamente todas as chamadas
`getCarState`. Passavam por detalhe, e diziam "está tudo mal" sem dizer
*o quê*. O teste agora exige **zero** erros nesse caso.

---

## Estado depois desta volta

| | |
|---|---|
| `run_all.py` | 9/9 |
| layouts (39 pares vista × largura) | 0 problemas |
| contraste | 113 folhas, pior 4,50:1, 0 abaixo |
| acessibilidade | 0 falhas |
| chaves de tradução mortas | 0 |
| traduções completas nas 4 línguas | 124 / 124 / 124 / 124 |
| `render()` com `NaN` | 0,5 ms (era: não voltava) |
