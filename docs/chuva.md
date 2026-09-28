# A chuva, agora que a app corre dentro do jogo

Escrito em 2026-09-27. Isto fecha uma pergunta que estava dada como
sem resposta, e a mudança que a torna possível é uma só: **agora temos
uma app Python a correr DENTRO do jogo.**

---

## O que se sabia, e o que seDiscoveriu

Duas conclusões antigas, ambas correctas e ambas incompletas:

**A memória partilhada não tem chuva.** Confirmado outra vez, campo a
campo. A página de gráficos tem `windSpeed` e `windDirection` e mais
nada; a de física tem `surfaceGrip`, que é o *efeito* da pista molhada,
não a chuva. A página estática não tem nada. **A Regra nº 15 fica
confirmada quanto à memória partilhada.**

**Mas a API Python tem**, e eu nunca tinha PAIRADO para ver — porque
até agora ninguém tinha uma app dentro do jogo. O inventário completo,
de todas as apps Python instaladas nesta máquina:

```
ac.ext_weatherFxActive()     -> bool,   a chuva esta' a renderizar?
ac.ext_rainParams()          -> [0] = chuva 0..1,  [1] = limpa-para-brisas
ac.ext_weatherDebugText()    -> str,    "current day: 2020-05-06 16:31:25 ..."
ac.ext_getWeatherTimeMult()  -> float,  quanto o clima avança depressa
ac.ext_patchVersionCode()    -> int,    a versão do Custom Shaders Patch
ac.getWindSpeed()            -> float
ac.getWindDirection()        -> float
```

De onde veio a certeza, e não de adivinhação:

| facto | fonte |
|---|---|
| `RainParams[0]` é a chuva 0..1 | `sol_weather.py:3953` — `ac.setValue(spinnerRain, int(RainParams[0]*100.0))`, e `RainParams[0]>=0.05 and <0.25` como teste de chuva fraca |
| `RainParams[1]` são as limpa-para-brisas | `sol_weather.py:3992` — `TargetWipers = int(round(RainParams[0]*4,0))`, e `int(round(RainParams[0]*4,0))` é o valor de `RainParams[1]` |
| o `ext_` vem do Custom Shaders Patch | `sol_weather.py:4042` — o `except` diz `'Shaders Patch not enabled or installed.'` |
| o CSP **está instalado** | `extension/internal/lua-sdk/`, `extension/internal/lua-apps/CspDebug/` |
| o formato de `weatherDebugText` | `sol_weather.py:4167` — `find('current day: ')+13`, e depois 19 caracteres |

E do lado da Lua, que dá o **tipo** de clima e não só a intensidade:

```lua
-- extension/internal/lua-apps/CspDebug/CspDebug.lua
local w = ac.connect({ ac.StructItem.key('weatherFXDebugOverride.1'),
  windDirection = ac.StructItem.float(), windSpeedFrom = ac.StructItem.float(),
  windSpeedTo   = ac.StructItem.float(), humidity = ac.StructItem.float(),
  pressure      = ac.StructItem.float(), rainIntensity = ac.StructItem.float(),
  rainWetness   = ac.StructItem.float(), rainWater = ac.StructItem.float() })
```

O `ac.WeatherType` tem **22 valores**, 0 a 21, de `LightThunderstorm`
a `Mist`, com `LightRain=6`, `Rain=7`, `HeavyRain=8`. Isto é Lua
(`ac.connect` não existe em Python), por isso **não é isto que se vai
ler** — mas serve para saber que o número da intensidade tem um
significado, e não é arbitrário.

---

## O que se vai fazer, e o que não

### Sobe: a intensidade da chuva, e uma prova de que a API é o mesmo mundo

O que a app passa a publicar, **no cabeçalho** da página (é clima da
sessão, não de cada carro — por isso os 128 carros não crescem):

| campo | de onde | `-1` significa |
|---|---|---|
| `rainAmount` | `ac.ext_rainParams()[0]` | a função não existe |
| `rainFxActive` | `ac.ext_weatherFxActive()` | idem |
| `windSpeedApi` | `ac.getWindSpeed()` | idem |
| `windDirApi` | `ac.getWindDirection()` | idem |
| `weatherTimeMult` | `ac.ext_getWeatherTimeMult()` | idem |
| `cspVersionCode` | `ac.ext_patchVersionCode()` | sem CSP |
| `weatherDebug` | `ac.ext_weatherDebugText()` | a função não existe |

**`-1` e não `0`.** É a regra do projecto, e aqui é a diferença entre
"não chove" e "não sei". Um `0` de chuva seria mentira se a função
fosse mudar no CSP.

### Desce: uma coisa que eu quase fiz e é errada

O `cspVersionCode` e o `weatherDebug` **não são para ficar**. São para
descobrir o formato, e `weatherDebug` em particular: só se sabe o que
`ext_weatherDebugText()` devolve lendo-o. Publicar 128 bytes do texto
cru, uma vez, é a forma honesta de o ver em vez de adivinhar a partir
do que o `sol_weather` extrai com uma regex.

O `cspVersionCode` vale a pena ficar porque responde a uma pergunta
permanente: *"a minha app está a ver o clima ou não?"* — e a resposta
passa a ser um número no ecrã e não uma suposição sobre o que tens
instalado.

---

## As três decisões que evitam repetir o bug dos 1 001 704 erros

**1. Sondar uma vez no arranque, nunca por frame.** Se `ac.ext_rainParams`
não existir, guarda-se isso e não se volta a chamar. Sem isto, quatro
funções em falta a 40 escritas por segundo dão 160 erros por segundo —
que é exactamente o modo de falha que o `lastError` agora denuncia, e
que transformou o contador em bruit. O contador tem de significar
"algo correu mal", e não "um `if` faltou".

**2. Nunca chamar `ac.ext_*` sem `hasattr`.** `getattr(ac, 'x', None)`
uma vez no arranque, guardar a função ou `None`. A partir daí é um
chamada normal, e a excepção que sobrar é uma excepção a sério.

**3. Sondar também o que já se sabia, para comparar.** A memória
partilhada dá `windSpeed` e a API dá `ac.getWindSpeed()`. Se derem o
**mesmo número**, está provado que a API Python lê o mesmo mundo que a
memória — e isso valida a premissa de tudo o que a app escreve. Se
diferirem, a diferença está publicada e dá para investigar. É a forma
barata de transformar uma suposição numa medição.

---

## O que fica a provar, e por quem

**Não dá para provar nada disto com o jogo fechado.** A prova é uma
sessão com chuva a correr, e o que se procura é:

1. o `lastError` da app — se disser `module 'ac' has no attribute
   'ext_rainParams'`, o CSP não está a expor isso ao Python, e o
   honesto é dizer "indisponível" no painel em vez de mostrar 0;
2. o `rainAmount` a mexer com a chuva a mudar, e o `rainFxActive` a
   passar de 0 a 1 quando a chuva começa;
3. o `windSpeedApi` a bater certo com o `windSpeed` da memória.

O passo 3 é o que transforma isto de "funciona" em "funciona bem".

E fica escrito o que **não** se vai fazer, para não haver tentação:

- **não** se vai ler o `ac.WeatherType`. É Lua (`ac.connect`), e a
  nossa app é Python. Os 22 valores ficam como referência para
  interpretar o número da intensidade, não como algo a mostrar;
- **não** se vai chamar nenhuma função de escrita: `ext_rainParamsSet`,
  `ext_rainParamsAdjust`, `ext_setWeatherTimeMult`,
  `ext_weatherTimeOffset`, `ext_applyTrackConfig`, `ext_takeAStepBack`.
  Todas mudam o estado do jogo. Uma app de telemetria que escreve no
  clima é uma app que pode estragar a sessão de quem a instalou — e a
  Regra nº 1 fala de memória, mas o espírito é o mesmo;
- **não** se vai adivinhar a escala. `RainParams[0]` é 0..1 porque o
  `sol_weather` o multiplica por 100 para uma percentagem. Se na
  prática der outra coisa, o número mostra-se com a unidade que
  der, e escreve-se o porque ao lado.
