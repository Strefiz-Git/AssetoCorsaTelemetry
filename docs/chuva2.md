# O tempo no cabeçalho — o que se pode mostrar, e o que não

Escrito em 2026-09-27, depois do `chuva.md`. Aquele respondeu "de onde é
que a chuva vem". Este responde "o que é que se mostra, e onde".

O pedido: **o estado do tempo no cabeçalho**, não uma linha que diz se
chove ou não. E tem de mudar a meio da corrida, porque o tempo muda.

---

## 1. O que o cabeçalho é

```html
<button id="btn-menu">…</button>
<div class="head-id">pista / carro</div>
<div class="head-session">CORRIDA · Soft (S)</div>
<div class="head-right">bandeira · posição · volta · definições</div>
```

`head-right` tem `margin-left:auto`, portanto há um espaço livre entre
`head-session` e `head-right`. É lá que o grupo do tempo entra, sem
mexer no resto.

E é o sítio certo: o cabeçalho é a única zona que nunca muda de sítio nem
de tamanho. Uma carta que aparece e desaparece — a do combustível, por
exemplo — obriga o olho a saltar. O cabeçalho não obriga.

---

## 2. O que dá para saber, e o que é adivinhação

Duas fontes, e a diferença entre elas é o que decide o desenho.

### Da memória partilhada (sempre disponível, dentro do `acshm.py`)

| campo | o que é |
|---|---|
| `airTemp` | temperatura do ar, °C |
| `roadTemp` | temperatura da pista, °C |
| `windSpeed` / `windDirection` | vento |
| `surfaceGrip` | aderência — o **efeito** de estar molhado |

Isto não muda dentro da sessão: é o estado da pista, não o do tempo.

### Da API Python dentro do jogo (só com o Custom Shaders Patch)

Confirmado no `functions.txt` do CSP instalado, e todas estas são
**leitura**:

| função | o que dá |
|---|---|
| `ac.ext_rainParams()` | `[intensidade 0..1, limpa-para-brisas]` |
| `ac.ext_weatherFxActive()` | o sistema de tempo da sessão está ligado |
| `ac.ext_getAmbientMult()` | luz ambiente — o `sol_weather` trata `< 0.95` como "não está claro" |
| `ac.ext_weatherDebugText()` | texto que traz `current day: AAAA-MM-DD HH:MM:SS` |

As duas últimas são **novas** — não estão no que a app publica hoje, e
são elas que tiram o tempo de "chove ou não".

### O que continua a não existir

O `ac.WeatherType` (os 22 valores, `LightRain = 6`, `Rain = 7`,
`HeavyRain = 8`) é **Lua**. A nossa app é Python. Fica como referência
para Lonelyar a escala, nunca como algo a mostrar. O `chuva.md` já
explica porquê.

---

## 3. O modelo: dois eixos, não um

Um "estado do tempo" único seria uma invenção. O que os dados dão são
**dois eixos independentes**, e separá-los é o que evita mentir:

### Eixo 1 — a precipitação

| estado | regra | porquê este corte |
|---|---|---|
| `sem fx` | `rainFxActive == 0` | a sessão não tem sistema de tempo |
| `seco` | `rain < 0.05` | abaixo de 5% não há chuva a sentir |
| `fraca` | `0.05 ≤ rain < 0.35` | |
| `chuva` | `0.35 ≤ rain < 0.70` | |
| `forte` | `rain ≥ 0.70` | |

Os cortes **não estão medidos**. São um ponto de partida razoável, e
por isso ficam numa tabela só, com o aviso de que são um palpite
honesto e não uma medição. Se ao conduzir ficar claro que 0.35 é
demasiado, muda-se uma linha.

### Eixo 2 — a luz

| estado | regra |
|---|---|
| `dia` | `ambientMult ≥ 0.95` |
| `nublado` | `0.80 ≤ ambientMult < 0.95` |
| `escuro` | `ambientMult < 0.80` |

E a hora da sessão, do `current day:` do `ext_weatherDebugText()`, que
dá `noite` sem adivinhar.

**Um dia de chuva é `forte` + `nublado`. Não é um estado novo.** É por
isso que os eixos são separados: "chuva forte com o céu limpo" é uma
combinação que existe, e um estado único não a consegue dizer.

---

## 4. O desenho

Um grupo no cabeçalho, entre a sessão e a direita:

```html
<div class="head-wx" id="head-wx" hidden>
  <svg class="wx-ico" …></svg>
  <span class="wx-estado" id="head-wx-estado">CHUVA FORTE</span>
  <span class="wx-temp" id="head-wx-temp">12°C</span>
</div>
```

- **ícone** — SVG desenhado à mão, sem ficheiros de imagem. Um por
  precipitação, e o eixo da luz muda a cor de fundo do ícone.
- **palavra** — `SECO`, `FRACA`, `CHUVA`, `FORTE`, mais `NOITE` ou
  `NUBLADO` quando o segundo eixo pedir.
- **temperatura** — a do ar, que é a que interessa ao piloto. A da pista
  já está na carta do clima.

Quando não há CSP, ou a sessão não tem sistema de tempo, o grupo
**desaparece** (`hidden`). Não mostra `—`: no cabeçalho, um `—` é
lixo visual, e a ausência lê-se melhor do que um traço para encher.

### Porquê no cabeçalho e não na carta do clima

A carta do clima fica na zona inferior, e no modo misto essa carta nem
sempre existe. O cabeçalho está sempre, nas três vistas, com o mesmo
tamanho. E o que o piloto precisa de saber sobre o tempo é se vai
picar, e isso é uma coisa de relance — não uma coisa que se vá ler.

---

## 5. O que isto custa na app dentro do jogo

Três campos novos no cabeçalho da struct: `ambientMult`, `weatherHour`,
`weatherFxOn`. São 12 bytes, e portanto **o nome da página muda** para
`acpmf_actelemetry_v3` (Regra nº 19: a struct cresceu, logo o nome muda).

A app tem de ser reiniciada com o jogo para carregar. Até lá, o leitor
responde `disponivel: false` e o grupo fica escondido — que é o
comportamento certo, e não uma avaria.

---

## 6. O que fica de fora, e porquê

- **Não** se escreve nada de tempo. `ext_rainParamsSet`,
  `ext_rainParamsAdjust`, `ext_setWeatherTimeMult`,
  `ext_weatherTimeOffset`, `ext_applyTrackConfig`, `ext_takeAStepBack`
  mudam o estado do jogo. Uma app de telemetria que mexe no tempo de
  quem a instalou é uma app que estraga a sessão.
- **Não** se mostra a escala do `sol_weather` (o número cru e os
  botões). Isto é um painel de leitura.
- **Não** se inventa um estado único. Dois eixos, como acima.
- **Não** se põe uma previsão. O `ext_weatherDebugText` traz o estado
  **actual**; o que vem a seguir é do `sol_weather`, que precisa de
parsing à parte do log e é outra coisa.
