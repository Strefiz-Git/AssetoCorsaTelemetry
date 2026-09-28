# Acessibilidade e exame geral

Escrito a 2026-09-26, depois de um exame medido da interface a correr
(Chrome, `http://localhost:8799`). **Nada aqui é uma opinião: cada número
foi lido do DOM ou do `getComputedStyle`, não de uma tabela de contraste
teórica.** Onde a medição não pôde discriminate, está dito.

A regra quefoi deu: **uma lista de campos que escreveste não é uma
prova** (`AGENTS.md`, Regra nº 15). O mesmo vale para uma lista de
problemas de acessibilidade. Por isso o que está marcado *medido* foi
contado a partir da página real, e o que está marcado *por verificar*
precisa de verificação antes de virar código.

---

## 1. Contraste — era 26 de 113 abaixo do mínimo. Agora é 0

Medido: percorri todas as folhas de texto das três vistas visíveis,
calculei a cor real de cada uma (com a transparência composta sobre o
fundo que lhe está por baixo, e não a cor declarada) e comparei com o
WCAG AA.

| | antes | depois |
|---|---|---|
| Folhas de texto medidas | 113 | 113 |
| Abaixo do mínimo | **26** | **0** |
| Pior caso | 1,63:1 (mínimo 4,5:1) | **4,50:1** |

### O culpado era um só token

`--grey: #555C5D` está em **43 regras** do `style.css` e media:

| fundo | onde | contraste antigo | para passar 4,5:1 |
|---|---|---|---|
| `--panel` `#151C1D` | cartões | **2,53:1** | `#7A8486` |
| `--bloco` `#171717` | blocos | **2,63:1** | `#788283` |
| `--fundo` `#000000` | fundo | 3,08:1 | `#6D7678` |
| `--line` `#22292A` | linhas | **2,17:1** | `#859092` |

Ou seja: **quase todo o cinzento do interface estava abaixo do mínimo** —
etiquetas, unidades, valores secundários, legendas.

### As cinco que sobraram depois de mexer no cinzento

Subir `--grey` resolveu 21 das 26. As outras cinco tinham a cor
escrita à mão, e cada uma precisava de uma decisão diferente:

| o quê | media | porquê | como ficou |
|---|---|---|---|
| `.drs-txt` desligado | 1,77:1 | `#3c4344` fixo no CSS | `var(--vazio)` |
| pressão do pneu | 1,86:1 | `#3F4647` fixo — e era o **dado medido**, com o desvio (secundário) mais bem tratado do que ele | branco, pequeno |
| estado vazio, 2× | 3,03:1 | eu tinha posto `--vazio` a 3:1, e 18 px a negrito **não** conta como "texto grande" (só a partir de 18,66) | `#7D8586`, 4,58:1 |
| delta vermelho | 4,32:1 | `--red` puro | `--red-txt: #FF3C3C`, 4,91:1 |
| bandeira azul | 4,48:1 | branco por cima de `#2B6CFF` | `--badge-blue: #265CE0`, 5,69:1 |

A do estado vazio é a que vale a pena reter: **a janela para um tom
"sem valor" separado é quase nenhuma.** O `--grey` normal está a 4,53:1
e o vazio a 4,58:1. Não há um cinzento claramente mais escuro que ainda
passe. Por isso o "não há valor" passou a dizer-se **pelos traços**
(`--:--.---`) e não por estar mais apagado — o que é mais honesto,
porque "presente mas ilegível" é o pior dos dois estados: não se sabe
se é um zero ou se ainda não chegou.

### Cheio e texto são coisas diferentes

O `--red: #FF0000` dá 5,28:1 sobre o painel, que passa folgado como
**cheio** (a barra, o ponto, o anel). O mesmo vermelho como **texto** dá
4,32:1 e não passa. Passámos a ter dois vermelhos, e o mesmo para o
azul. Não é preciosismo: um ecrã com brilho baixo é exactamente onde isto
se vê.
### O que NÃO está errado (e vale a pena preservar)

O `delta` é vermelho/verde, mas **traz o sinal** (`+`/`−`). A temperatura
dos pneus é colorida, mas **traz o número**. O DRS é verde, mas
distingue "disponível" de "aberto" por **piscar vs sólido** — ou seja,
por uma pista que não é só cor. As setas de posição são ▲▼, forma e não
cor. Os badges OFF/PIT são texto.

Isto é melhor do que a maioria dos dashboards. A correcção não pode
quebrar nenhuma destas pistas: ao mexer no cinzento, o número tem de
continuar a ser lido sem a cor.

---

## 2. Movimento — quatro animações infinitas, sem saída

No `style.css`:

| animação | onde | período |
|---|---|---|
| `spin` | indicador de arranque | 1 s linear |
| `mark-pulse` | botão "Marcar" (zona DRS) | 1,1 s |
| `drs-blink` | ponto do DRS disponível | 1 s `steps(1,end)` |
| `drs-box-flash` | caixa do DRS disponível | 1 s `steps(1,end)` |

**Não há `prefers-reduced-motion` em lado nenhum** (medido: zero
ocorrências). Quem tem uma perturbação do equilíbrio, enxaquecas
ou enjoo com animação recebe as quatro sem forma de as desligar.

O DRS é um requisito teu — piscar verde quando está disponível e não
foi aberto, sólido quando está aberto. **Não mexo nisso por omissão.**
O que proponho é dar um alternativa **sem movimento** para quem pediu:

```css
@media (prefers-reduced-motion: reduce){
  /* disponivel: contorno tracejado, sem piscar
     aberto:     caixa cheia, sem piscar
     a diferenca passa a ser a forma, nao o movimento */
}
```

A distinção "disponível" vs "aberto" continua a existir, passa a ser
forma em vez de movimento. É a forma correcta de resolver: não se tira
a informação a ninguém.

**Feito, e verificado:** com a preferência ligada, as 4 animações ficam
cobertas — confirmado pelo `check_acessibilidade.js`, que emparelha cada
selector animado com a regra que o desliga.

---

## 3. Teclado e diálogo — três falhas, agora nenhuma

Testado com `Tab` e `Enter` a sério na página aberta, não por leitura do
código.

| | antes | depois |
|---|---|---|
| Anel de foco | ok | ok |
| Alvos de toque | ok | ok |
| Nomes acessíveis | ok | ok (+ traduzidos) |
| `role="dialog"` | **falta** | `role="dialog" aria-modal="true" aria-labelledby="set-title"` |
| Escape fecha | **não** | fecha |
| Foco preso | **saía ao 28.º Tab** | não sai em 45 |
| Foco restaurado ao fechar | **não** | volta a `btn-set` |

O foco não estar preso era o mais chato: um utilizador de teclado abria
as definições, percorria 27 controlos e de repente estava a navegar o
interface que estava coberto, sem dar por isso.

A correcção é `inert`, não um focus-trap à mão: põe `#app` fora da ordem
de tabulação enquanto a gaveta está aberta, e por isso não há nada para
o foco "saltar" para trás. Confirmei o ciclo completo: `Tab` até
`btn-set` → `Enter` → o foco vai para `set-close` → `Escape` → fecha e o
foco volta a `btn-set`.

### Um bug de tradução que só a acessibilidade denunciou

O `applyLang` só trocava `textContent`. Os `aria-label` estavam escritos
à mão em português, portanto **em inglês o botão de fechar anunciava
"Fechar"** — e o leitor de ecrã lia a interface toda em português.
Isto é um bug de i18n que só se vê quando se olha para os rótulos
acessíveis. Passou a haver `data-i18n-aria` e `data-i18n-title`, com as
quatro línguas.

---

## 4. Leitor de ecrã — o interface é um muro

Medido: **zero `role=`** e **zero `aria-label` em todo o lado onde há
dados**. Os seis `aria-` que existem são `aria-hidden` em ícones
decorativos e `aria-label` em três botões de ícone.

O que um leitor de ecrã encontra num cartão:

```html
<div class="speed" id="speed">0</div>
```

lido como "zero", sem dizer se é km/h, sem dizer de quê. Um cartão
inteiro lê-se como uma sequência de números soltos — 58, 26, 12, 91 —
que é precisamente o oposto do que um dashboard deve ser.

### O aqui está a armadilha

A primeira ideia é pôr tudo em `aria-live`. **Isso seria um erro.** O
interface actualiza a 60 Hz: um leitor de ecrã a annunciar 60 vezes por
segundo é inutilizável, e é pior do que não anunciar nada. Com
`aria-live` a 60 Hz, a app fica pior para quem usa leitor de ecrã do que
se não tivesse nada.

O padrão certo, e o que proponho:

1. **Rótulos explícitos** em cada valor — `aria-label="Velocidade"`,
   `aria-label="Temperatura do travão da frente"`. Custo zero, resolve a
   maior parte.
2. **Um resumo num único elemento `aria-live="polite"`**, actualizado a
   ~1 Hz, não a 60: "159 km/h, 6.ª caixa, volta 12, DRS disponível,
   delta +0,42". Uma frase, uma vez por segundo — suportável.
3. **Os canvas como `role="img"`** com uma descrição escrita, não com os
   valores. O mapa é uma imagem; o gráfico dos pedais também.

Isto é trabalho a sério, não meia hora. **Por fazer, com data.**

---

## 5. Escala de texto — medido e a falhar

Acessibilidade WCAG 1.4.4 é "aumentar o texto até 200% sem perder
conteúdo nem funcionalidade". Tentei medir o que acontece quando todo o
`font-size` cresce, e **a primeira medição estava errada.**

### O erro do teste, que vale registar

Injetei `*{font-size:calc(var(--fs,1em) * fator)}` para crescer o texto.
A 1×, esse `1em` **não é o mesmo valor** que as 60 declarações `px` que
estão no `style.css` — a regra injectada substitui-as todas por outros
valores. O resultado foi "18 textos cortados a 1×", com `"DENSIDADE"` e o
`"VOLTA"` da classificação apontados como exemplo.

**Re-medi sem a injecção, nos 39 pares vista × largura: 0 cortados.**
Os 18 eram o teste a errar, não a interface. Não havia bug nenhum para
corrigir, e eu já me tinha posto a preparar a correcção de dois sítios
que não precisavam dela.

Isto é a mesma regra que este projecto já conhece por duas vias
diferentes: a Regra nº 12 (o `.pyc` envenenado) e a Regra nº 11 (a pista
que não discrimina). **Quando a leitura directa e a função discordam, é a
função que está errada** — e a primeira coisa a fazer é refazer a
medição sem o instrumento.

Pelo mesmo motivo, **não suspecto dos números de 1,5× e 2×** que saíram da
mesma injecção. A direção é verdadeira — texto maior parte o layout —,
mas as contagens exactas não são fiáveis e não as escrevo aqui como se
fossem.

### O que fica, e é real

**Os 60 `font-size` do `style.css` estão em `px`, e há zero em `rem`.**
Por isso a preferência de tamanho de texto do browser — a que uma pessoa
com baixa visão vai procurar nas definições do browser, e que o Firefox
deixa pôr como mínimo — **é simplesmente ignorada**. A aplicação aceita o
botão e nada acontece.

Esta é a lacuna real, e é um problema de *preferência*, não de
*leitura*: quem faz Ctrl+`+` (zoom de viewport) está bem servido, porque
isso reduz a largura em píxeis e os `@media` de 1240 px e 860 px já
tratam disso. São os mesmos 39 layouts que já passam.

A correcção é pôr a escala em `rem` com um `html{font-size:100%}` e não
mexer no tamanho em `px` dos números grandes (esses devem usar `clamp`,
e 14 deles já usam).

---

## 6. Modo misto perde informação em silêncio

Isto não é acessibilidade, é lógica, e é pior.

O modo **Misto** desenha 48 campos contra os 78 da vista de
telemetria. Não é só renomear `speed` para `b-speed`. **Faltam coisas
que o piloto usa para decidir:**

| falta no misto | porque importa |
|---|---|
| vida do pneu (`.stint`) | o número accionável do stint |
| danos | o aviso de que algo partiu |
| B. TRAVA | a distribuição |
| ABS e TC | só lá estão ERS e PIT |
| tempos de volta, delta, sectores | o carro não sabe a sua volta |
| cartão de combustível | inteiro |
| valores numéricos dos pedais | só fica o gráfico |

E o pior: **as funções já são chamadas e saem em silêncio.** Com o
`renderTyres` a chamar sempre o `renderTyreLife` e o `renderDanos`, mas
o HTML do modo misto não ter `.stint` nem `#damage-row`, o
`$()` devolve `null` e a função sai. Sem erro na consola, sem aviso.

Ou seja: **mudas para o modo misto e perdes a previsão de vida do pneu
e o aviso de danos, sem o interface te dizer nada.** Isto é a Regra nº
16 pelo outro lado — duas vistas da mesma telemetria, com as convenções
a divergir em silêncio.

Não é um bug de uma linha. É uma decisão de produto: o modo misto tem
menos espaço. Proponho (a discutir) escolher **uma** das duas:

1. meter o stint e os danos no cartão dos pneus do modo misto — são
   duas linhas, e é a informação que o piloto mais precisa;
2. ou então o modo misto passa a mostrar um aviso visível de que é uma
   vista resumida, para ninguém perder a conta do stint sem dar por isso.

---

## 7. Contraste alto / `forced-colors`

Medido: **zero** `forced-colors` e zero `prefers-contrast`.

O Windows tem um modo de alto contraste que troca as cores do sistema
por todas as que a página declarar. Como esta aplicação pinta quase
tudo — fundos, barras, gráficos de canvas, pontos no mapa — **o modo de
alto contraste do Windows vai destruí-la**: barras que somem, um mapa
vazio, o DRS sem cor nenhuma.

Não é um EXTRA de Accessibility: é uma utilização normal para quem
precisa. O mínimo é declarar as cores do sistema (`Canvas`,
`CanvasText`, `Highlight`) nos pontos onde a cor **transporta
informação** — o DRS, o delta, as barras de ERS/ABS/TC, os pontos do
mapa. O canvas não se resolve com CSS, e há que o dizer.

---

## 8. O que já está bem (e não se deve partir)

Isto é consequência das medições, não elogio:

- **Rótulos sempre visíveis.** O número nunca aparece sozinho. É o que
  salva a telemetria de ser só cor.
- **Delta com sinal**, não só cor.
- **A distinção DRS por forma** (piscar vs sólido) — sobrevive a
  daltonismo, e sobrevive também ao `reduced-motion` se eu fizer a
  alternativa em forma.
- **Piso de tamanho nos pontos do mapa** e número omitido quando não
  cabe. É a decisão certa, já tomada.
- **Todas as unidades visíveis** e a temperatura calculada sempre em
  Celsius para a cor, para mudar a unidade não mudar a leitura.
- **Alvos de toque e nomes acessíveis todos correctos.**

---

## 9. O teste que guarda isto

`tests/check_acessibilidade.js` — abre-se em `http://localhost:8765/` e
cola-se na consola, como o `check_layout.js`. Mede cinco coisas:
contraste, foco, alvos de toque, diálogos e movimento.

Estado actual, na página a correr:

```
contraste: 113 folhas de texto, pior 4.50:1, 0 abaixo do minimo
foco: 2 regra(s) de :focus no CSS, 2 de 2 controlos com anel por omissao
alvos de toque: 0 abaixo de 24x24
dialogos: menu e gaveta verificados
movimento: 4 animacoes infinitas, 4 com alternativa em prefers-reduced-motion
ok: nenhuma falha de acessibilidade medida
```

### O teste também precisou de ser corrigido três vezes

Isto vale mais do que o resultado, porque é a regra nº 12 aplicada a um
teste novo. **As três falhas eram do teste, e duas acusaram problemas que
não existiam:**

1. O foco era medido com `el.focus()`. Mas o `:focus-visible` **só**
   dispara com foco de teclado, por definição — um `.focus()` programático
   dá "0 controlos com anel" numa página perfeitamente correcta. A
   verificação passou a ser estrutural: procura no CSS se há regra de
   `:focus`.
2. A animação era contada dentro do bloco `prefers-reduced-motion` com
   `/infinite/`. Mas lá escreve-se `animation:none`, que não tem a
   palavra "infinite" — contava zero.
3. Corrigido isso, ainda contava zero: **o CSSOM normaliza
   `animation:none` para a cadeia** `"auto ease 0s 1 normal none
   running none"`. A expressão tinha de ser contra `animationName`, que
   devolve `none`.

E uma quarta, que foi falha minha e não do teste: a primeira mutação
acrescentou um `@media` novo em vez de remover o que lá estava, e "acertou
em cheio" sem estar a testar nada.

### Prova de que morde

`tests/mutacao_acessibilidade.py` mete uma animação infinita nova no
`style.css`, sem alternativa no bloco `reduce`:

```
$ python tests\mutacao_acessibilidade.py
mutacao posta: ".mut-test" anima em infinite e nao tem alternativa

  movimento: 5 animacoes infinitas, 4 com alternativa
  FALHA: 1 animacao(oes) infinita(s) sem alternativa em
         prefers-reduced-motion: .mut-test

$ python tests\mutacao_acessibilidade.py restaurar
restaurado. A marcacao ainda esta no ficheiro? nao, esta limpo
```

O teste só inspeciona a **folha ligada** (procura o `href` que contenha
`style.css`), por isso a mutação tem de estar no ficheiro: uma feita com
um `<style>` injectado na página é-lhe invisível. Fica escrito para não
se perder tempo.

---

## Ordem de execução

| # | quê | risco | estado |
|---|---|---|---|
| 1 | contraste: `--grey`, `--vazio`, `--red-txt`, `--badge-blue` | baixo | **feito** — 26 → 0, pior 4,50:1 |
| 2 | `prefers-reduced-motion` com alternativa em forma | baixo | **feito** — 4 de 4 cobertas |
| 3 | gaveta: Escape, foco preso, `role=dialog`, restaurar foco | baixo | **feito** — medido com Tab real |
| 4 | `aria-label` traduzidos nas 4 línguas | baixo | **feito** |
| 5 | `forced-colors` nos pontos onde a cor transporta informação | médio | **feito** — falta verificar no Windows |
| 6 | `check_acessibilidade.js` + prova de que morde | baixo | **feito** |
| 7 | escala de texto em `rem` | **médio** — mexe em 60 sítios | por fazer |
| 8 | modo misto: stint e danos, ou aviso visível | **decisão de produto** | por decidir contigo |
| 9 | rótulos em todos os valores + resumo `aria-live` a 1 Hz | grande | por fazer, ao teu ritmo |

1 a 6 são correcções sem ambigüedad. 7 é trabalho mecânico com os 39
layouts como rede de segurança. 8 é uma decisão tua. 9 é trabalho grande
e deve ser o teu ritmo, não o meu.

### O item que entrou na lista e saiu

Havia um 4 que era "cortar `DENSIDADE` e `VOLTA` mesmo a 1×". ** Saiu,
porque era o meu teste a errar** — ver a secção 5. Fica escrito para a
próxima vez não voltar a aparecer: quando uma medição accuses dozens de
falhas de uma vez, antes de as corrigir todas, confirmar que a medição
não é que está a fazer uma injecção errada. Injectar `*{font-size:...}`
para "aumentar o texto" não é aumentar o texto: substitui as 60
declarações `px` por valores calculados a partir de `1em`, que são outra
coisa.
