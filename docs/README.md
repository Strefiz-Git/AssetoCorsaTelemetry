# A documentação

Três coisas aqui, e elas não se misturam: **como cada jogo conta o que
mede**, **as investigações** que ficaram a meio, e **o que foi
planeado**.

---

## A telemetria de cada jogo

O que este projecto sabe sobre o que cada jogo publica, campo a campo,
com as unidades e as medições ao lado. É a referência antes de mexer em
qualquer coisa de um jogo.

| | |
|---|---|
| [`f1-25.md`](f1-25.md) | o F1 25: os 17 packets, os **dois formatos**, e o Season Pack 2026 |
| [`assetto-corsa.md`](assetto-corsa.md) | o Assetto Corsa: as três páginas de memória partilhada, e a app que corre dentro do jogo |

Os dois documentos são **complementares e não redundantes**. Onde os
jogos separem, cada um diz o seu e o outro também, lado a lado, porque
a diferença é a informação:

- o F1 25 manda o combustível em **quilos** e o AC em **litros**;
- o F1 25 diz os **metros que faltam** para a zona de DRS e o AC dá dois
  flags que mediram 98,9 % e 18,5 % em dois carros;
- a **vida do pneu** existe num e não no outro — no outro é estimada.

E as **armadilhas** estão nos dois, com o porquê:

- a ordem das rodas é `[FL, FR, RL, RR]` no AC e `[RL, RR, FL, FR]` no F1
  25, e as duas desenham uma grelha quase simétrica;
- o ABS é um **nível de 0 a 1** num e um **ON/OFF** no outro, com a mesma
  palavra;
- o Season Pack 2026 mudou **quatro tipos**, e cada um desloca todos os
  carros seguintes.

---

## As investigações que ficaram a meio

Documentos de trabalho, e estão aqui porque cada um tem uma pergunta que
**não está respondida**. Nenhum deles é uma conclusão: são registos do
que se mediu, do que se provou, e do que falta.

| | a pergunta |
|---|---|
| [`chuva.md`](chuva.md) | de onde vem a chuva, e porque é que um zero dela é mentira |
| [`chuva2.md`](chuva2.md) | as 37 cenas do Pure Planner, e de onde saem os cortes |
| [`caixa.md`](caixa.md) | a caixa aparece com +1. A API e a memória discordam, e ninguém lê as duas ao mesmo tempo |
| [`combustivel.md`](combustivel.md) | quantas voltas de combustível, quando o jogo não diz |
| [`acessibilidade.md`](acessibilidade.md) | o contraste medido de cada cor da paleta |

---

## O que foi planeado

| | |
|---|---|
| [`ideia.md`](ideia.md) | a ideia original, antes de haver código |
| [`logica.md`](logica.md) | a lógica do painel, escrita antes de a escrever |
| [`progresso.md`](progresso.md) | o que está feito e o que não está |

---

## Onde está cada regra

As regras **não** estão aqui. Estão no
[`../AGENTS.md`](../AGENTS.md), que se lê **antes** da primeira
alteração, e cada uma tem a medição que a justifica.

Uma regra aqui e uma regra no `AGENTS.md` divergem em silêncio, e o
`AGENTS.md` é que se lê. A regra é: **medida e-armadilha no `AGENTS.md`;
referência a esta pasta, e só a esta pasta.**

---

## A documentação de terceiros

O material da EA e da Codemasters **não** está versionado aqui. Se o
`AGENTS.md` remeter para um ficheiro que não existe, é porque o
ficheiro é de um pacote de terceiros e vive ao lado do projecto, não
dentro dele:

| | |
|---|---|
| `resources/docs/ac/` | a documentação oficial do Assetto Corsa e do ACC, em PDF |
| `resources/docs/f125/` | a especificação UDP do F1 25, em PDF e texto, e o código-fonte original da Codemasters |

O `verificar_texto.py` não varre `resources/` — e não por preguiça: o
código C++ da Codemasters é indentado com TAB e tem comentários em
inglês, e uma regra que dispara sobre material de terceiros é uma regra
que se desliga em vez de se corrigir.
