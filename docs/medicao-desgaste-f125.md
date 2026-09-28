# Medição: o `m_tyresWear` do F1 25 é **quanto já foi usado**

Data: 2026-09-28. Onde: F1 25 a conduzir,compound C5, volta 5, o jogador
a dizer que tinha usado pouco os pneus. Como: leitura do `/api/state` e uma
fotografia do MFD do jogo, no mesmo minuto.

## O que foi medido

| | FL | FR | RL | RR |
|---|---|---|---|---|
| **painel** (`tyreWear`) | 10.0 | 14.2 | 10.2 | 11.3 |
| **MFD do jogo** | 12 % | 17 % | 12 % | 13 % |

E no mesmo instante:

| campo | valor | de onde |
|---|---|---|
| `tyreLifeMax` | **21** | `m_usableLife` — a vida do conjunto, em voltas |
| `tyreAge` | **19** | `m_lifeSpan` |

O FR é o pior dos dois lados e o RL o melhor, **com a mesma forma**. Os dois
pontos de diferença são o carro a circular entre a leitura do payload e a
fotografia. São a mesma grandeza, lidas com segundos de intervalo.

## A separação, e ela é só aritmética

O jogo dá a vida do conjunto **e** as voltas que faltam. Logo sabemos
quantas voltas o pneu já correu, sem pedir nada a ninguém:

```
21 - 19 = 2 voltas corridas
```

E agora a conta nas duas leituras possíveis. **Uma delas é impossível:**

**(a) se 10,0 for QUANTO USOU**

```
2 voltas de 21 = 9,5 % usado.    O medido é 10,0 %.    Bate.
```

**(b) se 10,0 for QUANTO RESTA**

```
2 voltas de 21 = 9,5 % de gauche  =  90,5 % USADO
```

O pneu teria corrido **19 voltas**, não 2. E o jogo anunciaria *"faltam 2"*,
não *"faltam 19"*.

> **Isto não é uma leitura alternativa. É aritmeticamente falsa:** exige que
> o mesmo `21` valha ao mesmo tempo para as 2 voltas corridas e para as 19
> que faltam. Não sobra vida nenhuma para as duas coisas.

E a leitura (b) está descartada nas quatro rodas — nela o pneu teria corrido
entre 17,4 e 19,0 voltas, e o jogo diz que faltam 19 de 21.

## O veredicto

> **`m_tyresWear` é QUANTO USOU. 0 = novo, 100 = gasto.**

## Porque é que o comentário estava errado

O `receptor.py`, linha 684, diz:

> *O `m_tyresWear` é 0 a 100 com 100 = NOVO, exactamente como o `tyreWear`
> da memória do AC. Mesma direcção, portanto a mesma fórmula de vida do pneu
> serve aos dois sem converter nada.*

Foi escrito **por analogia com o AC**, e não medido. E a analogia é
precisamente o que falha: o `tyreWear` do AC é mesmo "quanto resta", mas o
do F1 25 tem o **mesmo nome** e o sentido **contrário**, e não há nenhuma
razão para serem iguais.

Isto é a Regra nº 24 a acontecer dentro do mesmo nome de campo, e é a
Regra nº 15 pelo avesso: uma lista de campos escrita por alguém não prova
o *sentido* de um campo — prova só que ele existe.

E a consequência da analogia era concreta: escrevia que *"a mesma fórmula de
vida do pneu serve aos dois sem converter nada"*. A fórmula do AC é
`100 - wear` para obter o gasto. Aplicada ao F1 25 sem converter, dava
**10 % de gasto num pneu que o jogo diz que ainda tem 19 voltas de 21** —
ou seja, um pneu quase novo apresentado como quase morto. Um número
plausível e errado, que é o pior resultado possível porque ninguém o
questiona (Regra nº 19).

## Onde isto vai parar

- o comentário do `receptor.py` é corrigido, e passa a citar esta medição;
- o `app.js` deixa de mostrar o valor do F1 25 no sítioOnde está escrito
  "aderência", porque no F1 25 **é desgaste medido** e no AC é aderência —
  são grandezas diferentes e o painel dizia as duas pelo mesmo nome;
- e é a medição que sustenta a Regra nº 30: o exemplo do "88 % usado" não
  era uma preferência de leitura, era a leitura **certa** deste campo.
