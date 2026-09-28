---
name: mesma-convencao
description: Como os dois jogos (Assetto Corsa e F1 25) têm de dizer a mesma coisa no painel. Usar sempre que se acrescentar, renomear ou reformatar um valor que aparece no ecrã, quando se decidir que um número se escreve de uma maneira e não de outra, quando os dois jogos divergirem no que mostram do mesmo campo, ou quando se estiver a pintar uma percentagem, uma barra, um travessão ou uma unidade. Diz o que é apresentação, o que é unidade e o que é campo, porque a regra só manda na apresentação.
license: MIT
---

# A mesma coisa nos dois jogos

O F1 25 é o jogo mais relevante, e o AC acompanha-o. Quando os dois
divergem numa **apresentação**, **manda o F1 25** — e o AC muda para ele.

A lei, com o porquê e a medição que a justifica, está no
[`AGENTS.md`](../../../AGENTS.md), **Regra nº 30**. Aqui está o
procedimento.

O exemplo que originou a regra: em vez de **12 % restante de pneu**,
diz-se **88 % de pneu usado**. E os 88 % são para os dois.

## As três coisas, e qual a regra se aplica a cada uma

Esta distinção é o que impede a regra de ser aplicada ao sítio errado. A
Regra nº 30 é sobre **apresentação** — e 90 % dos erros de leitura vêm de
a aplicar ao campo ou à unidade.

| | o que é | regra | onde se resolve |
|---|---|---|---|
| **apresentação** | como o número se **escreve**: que lado de uma percentagem é o bom, "restante" ou "usado", `—` ou `0` quando não se sabe | **Regra nº 30 — o F1 25 manda** | na decisão, e uma vez no sítio comum |
| **unidade** | litros ou quilos, joules ou kilojoules | **Regra nº 24 — nunca se converte** | no módulo do jogo |
| **campo** | qual array se lê, e em que ordem vem | **Regra nº 22 — traduz-se uma vez, na fronteira** | no módulo do jogo |

O que **não** acontece: o AC deixar de mandar os seus campos. A regra é
sobre como se mostra, não sobre o que se mede.

## O caso que tripped a regra, e o que ele ensina

A temperatura do pneu é o exemplo de campo, e estava partido:

- o AC publica três zonas por pneu e o F1 25 publica duas, e o que se
  mostra como número grande é o **núcleo** num e a **carcaça** no outro;
- a pintura lia `d.tyreCore` nos dois, e no F1 25 o campo não existe.

O que apareceu no ecrã: `FL -- 15.5 -- 24.6 psi` — o travessão no sítio
da temperatura, com o desgaste e a pressão à volta, e **os quatro pneus
iguais**. Passou despercebido porque quatro números parecidos não
denunciam nada.

E o mesmo painel, no mesmo instante, dava `0.0 L` com 7,34 quilos no
depósito — a mesma falha pelo outro lado, na unidade.

> **Um `--` parece uma medida em falta, e não um campo que se leu pelo
> nome errado.** E um `0` num campo que não existe é pior: ninguém
> questiona um zero. (Regra nº 19, e a Regra nº 14 pelo avesso.)

## O procedimento

Ao acrescentar, renomear ou reformatar um valor no ecrã:

1. **Perguntar de que tipo é**: apresentação, unidade ou campo? Se for
   unidade ou campo, é a Regra nº 24 ou a 22 e esta skill não se aplica.
2. **Escrever no módulo do jogo**, em função pura, e devolver o texto
   pronto. A pintura não conhece nomes de campos (Regra nº 22).
3. **Se a apresentação divergir entre os dois, seguir o F1 25** — e
   deixar isso escrito no módulo, com um comentário que diga *porquê*.
4. **Cada teste põe um valor diferente em cada canto.** Com os quatro
   iguais, uma convenção errada é indistinguível de uma certa.
5. **`node tests\test_jogos.js`**, e depois `python
   tests\auditar_frontend.py`.

## O que esta regra **não** obriga

- **Não obriga a mostrar o mesmo número.** O F1 25 tem `m_lifeSpan` e o AC
  não tem vida de pneu nenhuma; o AC é estimado. Isso é o **campo**, e o
  campo de cada jogo é o que existe.
- **Não obriga a inventar um máximo.** O ERS do F1 25 não diz quanto cabe,
  e o painel escreve joules sem barra em vez de uma percentagem de
 mentira. Se um dia a medição trouxer o máximo, passa a haver percentagem
  — nos dois.
- **Não obriga a trocar o que se mede pelo que o outro jogo mede.** O
  `tyreWear` do AC é aderência, não desgaste, e a Regra nº 18 mediu porquê
  (desce 0,45 % por volta, e um pneu que durasse 220 voltas não é um
  pneu). Escrever "88 % usado" a partir de um valor que é aderência é a
  Regra nº 19 com outro nome.

## O que um teste pode e não pode verificar

**Não pode** verificar uma convenção de linguagem: ninguém mede se "88 %
usado" soa melhor do que "12 % restante".

**Pode** verificar que os dois jogos **dizem a mesma coisa**, e é o que
`tests/test_jogos.js` faz: quando um jogo acrescenta um campo ou uma
capacidade, os dois têm de a ter, e a lista de cada um é conferida contra a
do outro.

E o que esta regra proíbe é o pior silêncio do projecto: cada módulo
escolher a sua convenção, e ninguém comparar. **A escolha passa a ser uma,
e fica escrita num sítio só** — que é o que o `AGENTS.md` é.

## Onde a regra está escrita

| ficheiro | porque |
|---|---|
| `AGENTS.md`, Regra nº 30 | a lei, com o porquê |
| `docs/f1-25.md` | quem mexe no F1 25 lê esse ficheiro, e não o `AGENTS.md` |
| `docs/assetto-corsa.md` | **é o AC que muda**, e quem mexe no AC tem de saber |
| `README.md` | a tabela "o que muda entre os dois jogos" fica incompleta sem isto |
| esta skill | o procedimento, e não a lei |
