# A física do pneu no Assetto Corsa: o que a Kunos não publica

Isto vem de **duas discussões do fórum do Assetto Corsa**, guardadas em
`ac_info/`. Não é medido por nós: é o que outras pessoas mediram com as
apps de debug da Kunos, e está aqui escrito **de quem** e **de quando**,
porque um número sem procedência é um número que se esquece de onde veio
(Regra nº 9).

| fonte | quem | quando | como |
|---|---|---|---|
| *Actual tire grip based on wear and temp* | Quffy | Out 2014 | *tyre debug app* |
| o mesmo tópico | Koppel | Out 2014 | ficheiros `tyres_ac` |
| o mesmo tópico | Stereo | Out 2016 | ficheiros de pneu do jogo |
| *LUT files* | garyjpaterson, Stereo | Ago 2018, Set 2022 | os ficheiros `.lut` |

**E os ficheiros foram apagados depois desta extracção.** A partir de agora
a fonte é este ficheiro.

---

## 1. A curva temperatura → aderência

O jogo traz uma tabela de consulta por pneu, `tcurve_slicks_GT3m` (e
`PERFORMANCE_CURVE=street_front.lut` na secção `[THERMAL_*]`). O Koppel
transcreveu-a:

| °C | 0 | 20 | 40 | 60 | 80 | 110 | 140 | 160 | 200 |
|---|---|---|---|---|---|---|---|---|---|
| aderência | 0,92 | 0,94 | 0,97 | 0,995 | **1,0** | **1,0** | 0,96 | 0,95 | 0,88 |

Três coisas que se lêem aqui e que o painel devia saber:

1. **A aderência tem um tecto, e é 1,0.** Não é "melhor é mais quente".
2. **O tecto é uma banda, 80 a 110 °C.** Fora dela desce dos dois lados.
3. **Um pneu frio não é um pneu estragado** — a 0 °C ainda tem 92 %.

> **Isto é a explicação de porquê um pneu de 90 °C não é um pneu estragado,
> e é o que falta ao painel:** os cortes de cor estão a 95 e a 105 °C, e o
> segundo está **dentro da banda de aderência máxima**.

**Os limites, que são reais:** a curva é de um **slick GT3**, não de um F1.
A janela-optimal de um F1 é outra, e mais alta. E é de 2014. Nada disto foi
medido por nós no AC.

## 2. O que o campo `tyreWear` da memória partilhada faz

O Quffy, com a *tyre debug app*, mediu o comportamento do número:

> *"The higher the % the more grip your tires have... you can start with the bmw
> z4 gt3 and it shows it has 94% because the tyres are cold. But once it gets
> warmer that percentage will rise to 99%. After that it will just get down,
> the softer the tyres the faster the grip gets down."*

Traduzido no que interessa ao painel:

| estado | valor | o que está a acontecer |
|---|---|---|
| saída dos boxes, pneu frio | ~94 | ainda não aqueceu |
| depois de aquecer | ~99 | **sobe**, e este é o valor máximo |
| a conduzir | desce devagar | o desgaste a acumular |

Isto é a **terceira via** de chegar à conclusão a que a Regra nº 18 já tinha
chegado por medição nossa (o `mutacao_grip.py`): **o campo é um sinal de
aderência/saúde, e não um "quanto resta"**. Uma pista:

- nós medimos 98,7 / 98,8 / 98,4 / 98,4 — é o patamar "quente", e é
  exatamente onde o Quffy diz que o valor para de subir;
- o valor **cai 0,45 por volta**, e o desgaste real de um F1 em duas voltas
  é muito mais que isso.

E explica a discrepância de dez pontos da Regra nº 18 sem recorrer à
câmara: **o número que desce é temperatura, e o número que o HUD do
Content Manager lê é outra coisa.** Um deles ainda não está identificado.

## 3. O desgaste é função de *slip*, não de voltas

Este é o mecanismo, e é a parte que faltava.

A secção `[THERMAL_*]` e o `WEAR_CURVE` apontam para uma LUT com **duas
colunas**:

```
0|100     2|96     8|94
0.3|100   4|95     11|92
0.6|100   12|88
1.0|99.5
```

- **esquerda: quilómetros virtuais (`vKM`)** — não quilómetros verdadeiros;
- **direita: multiplicador de desgaste**, de 100 (novo) a 88 e desce.

O Stereo define o que é um quilómetro virtual:

> *"it's the distance the tire has driven while accelerating hard (any of
> steering/throttle/braking). As far as I know at peak traction you get 1km
> per 1km driven (eg. if you were on a circular skidpad), and then above/below
> that it's proportionally more or less (so if you sit still doing a 300km/h
> burnout they'll wear out quickly since it's both moving fast and way above
> ideal slip)"*

Ou seja: **um pneu gasta-se a deslizar, não a rolar.** A uma volta de
skidpad gasta 1 vKM; a fazer um *burnout* a 300 km/h gasta muito mais, e a
volta passa a contar quase nada.

> **É isto que explica os 0,45 % por volta que medimos.** A volta só conta
> na medida em que o carro desliza, e uma volta de corrida é sobretudo
> rolagem. O número é lento **porque o número é lento é lento** — e não porque o
> campo seja outro.

E dá a resposta a uma pergunta que estava em aberto no tópico: o que
acontece a seguir ao `12|88`. O garyjpaterson diz que não sabe, e que
provavelmente fica no valor da última linha.

## 4. As outras leituras do ficheiro de pneu

Do `tyres_ac`, na secção `[FRONT]`/`[REAR]` de um pneu de rua:

| chave | o que é | porquê importa |
|---|---|---|
| `DY0`, `DX0` | aderência de pico, em ângulo de deriva e em *ratio* | o Stereo: *"The main variables controlling grip are DY0 and DX0 — these define peak grip in slip angle & slip ratio"* |
| `PRESSURE_IDEAL` | a pressão ideal para aderência, **em psi** | o painel mostra a pressão real e diz que a nominal não é publicada — e aqui está o sítio onde ela vive |
| `BLISTER_GAIN` | commento do ficheiro: *"100 value = 20% less grip"* | o F1 25 publica `tyreBlisters`; o AC não |
| `FRICTION_LIMIT_ANGLE` | o ângulo onde o pneu larga | — |

O `BLISTER_GAIN` é a única destas que **toca no F1 25**: o `m_tyreBlisters`
que o painel já mostra tem um significado declarado por aqui, e não é
decorativo.

## 5. O que isto NÃO prova

Escrito para que ninguém cite isto a mais:

- **Nada disto foi medido por nós.** Nenhum número deste ficheiro saiu de um
  AC nosso. Vem de uma transcrição de 2014 e de ficheiros de 2018.
- **A curva é de um GT3**, e o painel é usado sobretudo com F1. A janela
  de um F1 é mais alta, e não a temos.
- **Não fecha a Regra nº 18.** Fecha a *explicação* de que o número desce
  por temperatura; **não** identifica o que o HUD do Content Manager lê, que
  continua por resolver.
- **O `tyreWear` do AC é ao contrário do `m_tyresWear` do F1 25.** Aquele
  é aderência (100 = o melhor); este é desgaste usado (100 = o fim). Ver
  [`medicao-desgaste-f125.md`](medicao-desgaste-f125.md) e a Regra nº 30.

## 6. O que fica por fazer, e porquê não foi feito aqui

Os cortes de cor da temperatura estão a **95 °C (laranja) e 105 °C
(vermelho)**, no `app.js`, sem base escrita nenhuma. Esta curva diz que
105 °C está no meio da banda de aderência máxima.

**Não se alteraram os números**, por duas razões que são a mesma: a curva é
de um GT3 e não de um F1, e nenhuma das duas curvas foi medida na nossa
instalação. Mudá-los seria trocar um número sem base por outro número sem
base, e o primeiro ao menos era visível.

O que fica é uma **medição**: correr o AC, registar a temperatura das
zonas e o `tyreWear` ao mesmo tempo, e ver se o pico da curva bate com os
cortes. Enquanto não houver esse dado, os números ficam como estão e esta
página diz porquê.
