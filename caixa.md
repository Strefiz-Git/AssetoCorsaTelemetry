# O bug da caixa, e o que a previsão dos pneus do outro HUD faz

Escrito a 2026-09-27.

---

# Parte 1 — A caixa: «N» em reverso, «2» em 1.ª

## O que se reporta

A caixa mostra **N** quando se está em reverso, e **2** quando se está
na 1.ª. Os dois sintomas somam **+1** — o que cheira a deslocamento de
offset, e foi a minha primeira hipótese.

## O que já está verificado, e que descarta essa hipótese

### 1. O offset está certo

Despejei o struct à volta do campo, com o jogo fechado (a página fica
congelada, mas o layout dos offsets é o mesmo):

| índice | offset | campo | valor | faz sentido? |
|---|---|---|---|---|
| 0 | 0 | packetId | 63679 | — |
| 1 | 4 | gas | 0,0000 | sim |
| 2 | 8 | brake | 0,0000 | sim |
| 3 | 12 | fuel | 4,1675 | litros, sim |
| **4** | **16** | **gear** | **0** | — |
| 5 | 20 | rpms | 4000 | sim |
| 6 | 24 | steerAngle | 0,0000 | sim |
| 7 | 28 | speedKmh | 0,0006 | km/h, sim |

A `gear` está no índice 4, a 16 bytes. **Se estivesse deslocada, um
destes vizinhos imediatos tinha de ser absurdo** — é a Regra nº 4, e
a regra de diagnóstico dos testes. Não é.

### 2. O mapeamento bate com o de outra fonte

O HUD do Content Manager lê a **API Lua**, não a memória partilhada, e
escreve:

```lua
local gear_string = string.format("%d", car_gear)
if car_gear == 0 then gear_string = 'N' end
if car_gear == -1 then gear_string = 'R' end
```

E o `acshm.py`:

```python
def _gear(g):
 if g == 0: return "N"
 if g < 0: return "R"
 return str(g)
```

Os dois concordam: **0 é neutra, −1 é reverso, positivo é a caixa.**
Duas fontes independentes, uma de terceiros.

### 3. O frontend não pode estragar isto

São **três linhas**, todas a mesma coisa:

```javascript
setTxt('gear', d.gear || 'N');
setTxt('b-gear', d.gear || 'N');
setTxt('m-gear', d.gear || 'N');
```

Não há nenhuma comparação numérica, nenhum `parseInt`, nada que possa
converter a string `"R"` em `NaN`. É a Regra nº 14 pelo caminho
inverso: verifiquei o que a função faz com o que recebe, e ela faz o
mínimo.

## Medição de 2026-09-27, com o jogo a correr

Duas leituras **no mesmo instante** (o `snapshot()` e o `int32` cru lidos
dentro do mesmo ciclo — antes tinham sido comandos separados, que não
são uma medição):

| instante | `snapshot()` | `int32` no offset 16 | como float | offset 20 | offset 24 |
|---|---|---|---|---|---|
| t=0 … t=9 | `2` | `2` | 0,0000 | 0 | 0 |

Duas coisas saem daqui:

1. **O `snapshot()` não inventa nada.** Lê mesmo o offset 16, e o que lá
   está é `2`. Os 736 valores de `2` na leitura de 15 s anteriores são
   reais, não um erro de leitura.
2. **Com o carro parado, o campo vale 2** — e não 0, que era o que a
   captura com o jogo fechado tinha dado.

O ponto 2 é o que torna a hipótese do "+1" plausível e ao mesmo tempo
**não a prova**: um carro parado em 2.ª sem acceleration é exactamente o
que o AC faz, porque mantém a caixa engatada. Se o ecra do jogo também
disser "2", está tudo certo e o relato do bug é que precisa de ser
reobservado com o carro a andar.

## A hipótese que falta testar: dois sítios diferentes para a mesma caixa

O CMRT tira a caixa da **API Lua** (`ac.getCarState(0).gear`). Nós
tiramos da **memória partilhada** (`gear`, offset 16). São as duas
interfaces distintas da Regra nº 18, e a Regra nº 18 diz que campos com
o mesmo nome **não são o mesmo campo**.

A hipótese passa a ser: **o AC mostra a caixa no ecrã a partir da API, e
a memória partilhada tem outro valor.** Não é um offset errado — é um
sítio errado. As duas previsões são diferentes:

| se acontecer | o que significa |
|---|---|
| API = −1, shm = 0, no mesmo instante | o ecrã e a shm discordam. A shm é que está errada para mostrar |
| API = 1, shm = 2, no mesmo instante | a shm vale o valor +1 à API |
| API = shm, sempre | o bug não é aqui, e o relato tem de ser reobservado a conduzir |

**Isto decide-se por medição, não a olho.** E medir exige os dois valores
**no mesmo instante** — comparar o ecrã do jogo com um `print` é
cronometragem humana, e erra-se.

Por isso a app passa a publicar também a caixa da API. É um campo novo
nos dois lados do contrato (Regra nº 19), e a partir daí o `caixa.py`
compara os dois valores dentro do mesmo ciclo de leitura, sem ninguém
a olhar para o ecrã.

### O que fica por confirmar antes de mandar isto

- [ ] A API dentro do jogo chama-se mesmo `ac.getCarState(0).gear` no
      Python. O CMRT usa isso em **Lua**; a Python pode ter outro nome.
      **A confirmar no `acsys.py` antes de escrever uma linha.**
- [ ] Se `gear` na API também for 0/−1/positivo, ou se a API devolve
      outra coisa (a Lua pode dar o índice da caixa directamente).
- [ ] Se o campo novo cabe. A struct tem 276 B/carro e não há folga sem
      mudar o tamanho da página; se não couber, o campo novo é o
      `tyreCoreTemp[0]` que já ninguém usa.

## O que falta, e por isso não concluo

Sem o carro a andar não há forma de distinguir:

- o valor que chega está mesmo errado (aí o suspecto passa a ser a
 leitura, não o offset), **ou**
- o valor está certo e o que difere é a fonte de onde o *ecrã do jogo*
 tira a caixa — ou seja, o AC pode mostrar "R" a partir de outro sítio
 que não é o `gear` partilhado.

São hipóteses diferentes com correções diferentes, e não tenho como
escolher entre elas a olho.

Uma nota de fundo plausível mas **não provada**: um TS040 é um protótipo
LMP, e pode não ter reveso. Se seleccionares reveso num carro que não o
tem, é perfeitamente possível que o AC continue a reportar `0` na
memória partilhada enquanto o ecra dele mostre outra coisa. **Não
afirmo que é isso** — é a primeira coisa a confirmar.

## A ferramenta

`tests\caixa.py` tira o valor **cru**, a correr, com o contexto de cada
transição:

```bash
python tests\caixa.py 30 # 30 s a 200 Hz, com o jogo aberto e a conduzir
python tests\caixa.py ver # le a captura
```

Grava `tests\caixa_captura.json` com **todas** as amostras e a lista de
**mudanças de caixa**, cada uma com o instante, o valor cru, o rpm e a
velocidade. Depois é uma leitura de 30 segundos ao ecra do jogo: se o
jogo mostrar −1/R e a captura der 0/N no mesmo instante, o valor chega
errado. Se o jogo também der 0, então os dois concordam e o problema é
de outro sítio.

**O script recusa-se a correr com o jogo fechado**, e diz porquê: sem
jogo, a página fica com o último estado congelado e qualquer conclusão
seria sobre nada (Regra nº 2). Só lê, nunca escreve (Regra nº 1).

---

# Parte 2 — A previsão dos pneus do outro HUD, decifrada

O `tires/first.lua` faz uma previsão de vida do pneu em duas voltas.
Vale a pena decompô-la, porque **diz exactamente o que me falta.**

```lua
local tire_consumption_rate = sim_info.tyreConsumptionRate

local eol_level = inverted_lut:get(94) -- fim de vida
local low_level = inverted_lut:get(96)
local mid_level = inverted_lut:get(98)
local high_level = inverted_lut:get(100)

local eol_value_km = 10 * eol_level / tire_consumption_rate
local high_lapcount = high_value_km / track_length_km
```

São três peças:

| peça | de onde vem | eu tenho? |
|---|---|---|
| `sim_info.tyreConsumptionRate` | `ac.getSim()` — **API Lua** | **não** |
| `inverted_lut` (temperatura → desgaste) | `WEAR_CURVE` do `data.acd` do carro | **não** |
| `trackLengthM` | `ac.getSim()` | **sim** (tenho `trackSPlineLength`) |

O `inverted_lut` é construído a partir da secção `WEAR_CURVE` do
`data.acd` — o ficheiro de configuração binário que o AC carrega. E o
próprio autor commenta que aquilo é errático:

```lua
-- TODO(cogno): sometimes we get the data sometimes we don't, it's random
```

**Portanto: a previsão deles não é reproduzível por mim**, e a minha
estimativa continua a ter de ser medida. Isto confirma e reforça o que
já está escrito na Regra nº 18.

## O que há lá que é uma boa ideia, e que EU posso fazer

A ideia estrutural deles é boa: **a taxa de desgaste depende da
temperatura.** Eles não dão um número único — dão quatro níveis (fim
de vida, baixo, médio, alto) calculados a partir da temperatura actual,
e cada um com as suas voltas.

E eu tenho a temperatura do núcleo. O que me falta é a *curva*, não a
temperatura. Mas a curva posso **medir**, e já meço a taxa: o meu
estimador em `static/tyres.js` acumula desgaste ao longo do stint.

A melhoria concreta que proponho, e que é honesta porque sai de dados
meus:

> **Bucketar a taxa de desgaste medida pela temperatura do pneu**, e
> mostrar não só "X voltas", mas "a esta temperatura, X voltas; se
> arrefecer 5 °C, Y".

Não é a mesma coisa que a curva do jogo — é uma aproximação medida, sem
a forma de lei, e tem de ser rotulada como tal. Mas responde à pergunta
que o piloto faz de verdade, que não é "quanto tempo de pneu me resta"
e sim "posso baixar a temperatura para aguentar mais duas voltas".

**Isto precisa de dados de condução para ser validado**, e ainda não os
tenho. Fica escrito como proposta, não como feito.

## Uma armadilha que eles confirmam

No módulo dos pneus:

```lua
local wear_string = string.format("%d%%", (1 - wheel.tyreWear) * 100)
```

O `tyreWear` da **API Lua** é uma fracção 0..1. O `tyreWear` da
**memória partilhada** é 0..100. Mesmo nome, escalas opostas, e
sentidos opostos: a Lua mostra o **gasto**, eu mostro o **restante**.

Consequência prática: mesmo que eu tivesse o `tyreConsumptionRate` e a
curva, a mesma fórmula daria números diferentes, porque os dois campos
não medem a mesma coisa na mesma escala. Está na Regra nº 18.

## O que fica por confirmar, e como

| | como |
|---|---|
| o bug da caixa | `python tests\caixa.py 30` a conduzir, e comparar com o ecra do jogo |
| o pneu da TS040 tem reveso? | simpler: seleccionar reveso e ver o que o jogo mostra |
| a taxa de desgaste por temperatura | conduzir um stint e registar temperatura + desgaste; tenho o registo no `tyres.js` |
