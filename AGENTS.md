# AGENTS.md

Instruções para agentes de IA (e pessoas) que trabalhem neste repositório.

Este projecto é pequeno, mas tem **armadilhas reais** que já custaram
tempo. Estão todas aqui para não se repetirem.

---

## Obrigatório: git automático

**Lê a skill `git-workflow` antes de fazer a primeira alteração.**

```
.opencode/skill/git-workflow/SKILL.md
```

Resumo, sem desculpas:

- **Commita sem perguntar.** Cada bloco de trabalho concluído é um commit.
  Nunca perguntar se se deve commitar.
- **Cria branch para trabalho grande** (nova função, refactor, documento
  grande) — antes de começar a mexer, não no fim. Bug fix pequeno vai
  directo ao `main`.
- **Um commit, uma coisa.** A mensagem explica o **porquê**.
- **Nunca** `push`, `--force`, `reset --hard`, `clean -fd` ou
  `checkout .` sobre trabalho por guardar. Essas não se desfazem.

---

## Regra nº 1 — nunca escrever na memória do jogo

**Isto é o mais importante deste ficheiro.**

O Assetto Corsa publica memória partilhada com nome (`acpmf_physics`,
`acpmf_graphics`, `acpmf_static`). O SimHub mantém-nas mapeadas **mesmo
com o jogo fechado**.

Por isso, se um teste fizer:

```python
h = CreateFileMappingW(None, None, PAGE_READWRITE, 0, size, "acpmf_physics")
```

com o jogo a correr, `CreateFileMapping` **devolve o objecto que já
existe** — e todas as escritas a seguir vão para dentro da sessão em
curso. Não dá erro. Altera o carro, a pista, o rpm máximo, a capacidade
de combustível, o estado de ERS/DRS.

**Já aconteceu.** Um teste injectou `carModel="ferrari_488"` e
`track="monza"` na memória de um jogador que estava a conduzir um RB21 em
Spa. Não deu erro nenhum, só dados corrompidos em silêncio.

Como fazer bem:

```python
# NUNCA nos nomes reais. Usar nomes proprios:
NAMES = ("ac_test_physics", "ac_test_graphics", "ac_test_static")
```

E, antes de escrever em qualquer página, confirmar que o jogo **não** está
a vivo:

```python
def jogo_a_correr():
    h = OpenFileMappingW(FILE_MAP_READ, False, "acpmf_physics")
    a = MapViewOfFile(h, FILE_MAP_READ, 0, 0, 2048)
    t = ctypes.c_int32.from_address(a).value   # packetId
    time.sleep(0.35)
    return ctypes.c_int32.from_address(a).value != t
```

`test_acshm.py` já faz isto e aborta com código 2 se o jogo estiver a
correr.

---

## Regra nº 2 — "a página existe" não significa "o jogo está a correr"

O SimHub mantém as páginas mapeadas sempre que está aberto. Sem o jogo,
`OpenFileMapping` continua a devolver um handle válido e lê-se a última
sessão congelada.

O único sinal de vida é o **`packetId`** da página de física: o AC
incrementa-o a cada frame.

Atenção: em **PAUSA** e no **menu** o `packetId` também para. Por isso o
código não esconde o dashboard — mostra o último estado esbatido e
escreve "EM PAUSA" (< 90 s) ou "JOGO ENCERRADO" (> 90 s).

---

## Regra nº 3 — a estrutura tem 9 campos que a documentação esconde

A estrutura de referência do AC em Python ( circulate em vários repositórios)
tem estes campos **comentados** a meio de `SPageFilePhysics`:

```python
#('performanceMeter', c_float),
#('engineBrake', c_int32),
#('ersRecoveryLevel', c_int32),
#('ersPowerLevel', c_int32),
#('ersHeatCharging', c_int32),
#('ersIsCharging', c_int32),
#('kersCurrentKJ', c_float),
#('drsAvailable', c_int32),
#('drsEnabled', c_int32),
```

**Eles existem na memória.** A documentação marca-os como deprecados, mas
continuam lá. Sem eles, tudo o que vem a seguir fica **36 bytes
deslocado** (9 × 4).

Como se parecia: os travões davam 0 °C e as temperaturas interiores dos
pneus davam 375 °C.

Guardá-los também dá acesso a dados que o SimHub não expõe bem:
`ersIsCharging`, `kersCurrentKJ` e os flags `drsAvailable` / `drsEnabled`
inteiros (o campo `drs` é um float).

---

## Regra nº 4 — testes auto-consistentes não provam nada sobre o mundo

`test_layout.py` escreve um valor único em cada campo e lê de volta. Isso
**valida a estrutura contra si própria** — não prova que os offsets batem
certo com o Assetto Corsa. Passou 100% com a estrutura 36 bytes errada.

Só duas coisas provam o layout real:

```bash
python tests\verify_real.py    # com o jogo aberto
python tests\probe_layout.py   # despeja os valores e procura padrões
```

Regra prática: **quando um valor de telemetria for implausível
(375 °C num pneu, 0 °C nos travões, 9994 % de desgaste), não é o
formato — é o offset.** Dump de floats e procura grupos de 4 valores
parecidos: é a assinatura de uma temperatura de travões ou de pneu.

O mesmo se aplica a um flag. **`drsAvailable` é um caso real:** ver
Regra nº 11.

---

## Regra nº 11 — um flag que está quase sempre aceso não é um mapa

**Primeira medição, num Red Bull RB21 em Suzuka:** `drsAvailable` esteve
a **1 em 98.9% do traçado**, por igual nos cinco quintos da pista. Conclusão
escrita na altura: "este flag não marca a zona".

**Segunda medição, num Ferrari SF25 em Interlagos:** `drsAvailable` esteve
a 1 em **18,5% da volta**, em **duas zonas contíguas** (0–30% e 85–100%),
e só a **262–312 km/h**, quase sempre em 8.ª ou 9.ª caixa. Isto é
exactamente a forma de uma zona de DRS real.

**Portanto a primeira conclusão estava errada, ou era específica daquele
carro.** Um flag medido uma vez, num só carro, tratado como regra geral.

A interface **não confia no flag**: mede uma volta inteira e só o aceita
se a percentagem do traçado ligado for uma minoria clara (2% a 60%).

| o que mediu | veredito | o que acontece |
|---|---|---|
| 18,5%–26% | `zona` | pinta sozinho, e repinta o traçado já gravado |
| > 60% | `sempre ligado` | não pinta, diz que não serve |
| < 2% | `nunca ligado` | não pinta, diz que não serve |

Cada ponto do mapa guarda o `drsAvailable` original no 5.º elemento, para
o repintar ser possível sem voltar a conduzir. O veredito fica visível nas
definições — se a interface decide sozinha, o piloto tem de ver o que ela
decidiu e porquê.

**A marcação manual continua lá** para os carros em que o flag não serve.

Regra geral: **antes de desenhar um campo no mapa, confirmar que ele
varia ao longo da pista — e medi-lo em mais do que um carro.** Um campo
constante não é um campo, é decoração; mas também um campo que parece
constante num só carro pode não ser.

O `drsEnabled` é fiável para a luz: `drsAvailable=1` com
`drsEnabled=0` deu 98 amostras (a zona acesa, o botão ainda não carregado)
e `drsEnabled=1` deu 735. São os dois estados que a luz usa.

---

## Regra nº 13 — nunca deitar fora o início de uma volta

O `app.js` guardava a volta de referência com um array e, ao passar de
4000 pontos, fazia `shift()` — deitava fora o ponto **mais antigo**.

Medido: uma volta de 116 s a 60 Hz dá 6960 pontos. Com o limite em 4000,
a referência ficava a começar em **22,6% da pista** e a 49 s. Resultado:

- `computeDelta(0.02, 2)` devolvia **`null`** — sem delta no primeiro
  quarto da pista, sem dar erro nenhum;
- e logo na fronteira, um **degrau de −4,9 s**.

A correcção é reduzir a resolução em vez de descartar: quando a volta
excede o limite, fica um ponto em cada dois. Custa metade da resolução e
poupa o início da volta, que é a parte que interessa. Está em
`empilharPonto`, no `tempos.js`, com testes.

Armadilha do mesmo feitio: **qualquer buffer com limite tem de ser
sub-amostrado, nunca truncado a partir do início.** Numa lista ordenada
por percentagem da pista, o início é o que dá a escala.

E um aviso sobre `deltaParaRef`: procura o intervalo com um varrimento
linear, portanto é O(n) por chamada. A 60 Hz com 12 000 pontos são 720 mil
iterações por segundo — irrelevante a correr. Mas **testar** a função
uma vez por cada ponto de uma referência de 12 000 dá 144 milhões de
iterações e o teste não acaba. Amostrar nos testes.

---

## Regra nº 14 — um auxiliar que recebe id e outro que recebe elemento

O `app.js` tem os dois estilos: `setLight(id, …)` resolve o id com
`getElementById`, e `pintarDelta(el, …)` recebe o elemento. Passar o
elemento a um que espera o id dá:

```javascript
$(cardId)          // cardId e' um elemento
// getElementById(<element>)  ->  null
// if (!e) return;            ->  sai aqui, calado
```

**Não dá erro, não aparece nada no DOM, e o código parece correcto.**
Foi assim que o `ABS` e o `TC` ficaram a mostrar `—` durante uma
inspecção inteira, com zero erros na consola.

Como detectar: se um campo aparece no payload mas o texto no ecrã não
muda, ver o que a função faz com o que recebe, antes de suspectar do
payload.

---

## Regra nº 12 — um `.pyc` envenenado faz o teste mentir sem dar erro

O Python valida o bytecode em `__pycache__` pelo par **(data de
modificação em segundos, tamanho do ficheiro)**. Se uma ferramenta
reescrever um `.py` no sítio e o novo ficheiro tiver **o mesmo tamanho e
a mesma data, ao segundo**, o Python reutiliza o `.pyc` antigo — que foi
compilado de uma versão do código que já não existe no disco.

Aconteceu aqui, e foi do pior tipo: o teste **passava a dar o valor
errado** em vez de falhar.

```python
# o que se escrevia no ficheiro, mutado
"y": round(c.worldPosition.y, 2)   ->   "y": round(c.worldPosition.z, 2)
#                              ^ mesmo tamanho, mesma linha
```

Ao restaurar o ficheiro original logo a seguir, dentro do mesmo segundo,
o `.pyc` continuou válido. Resultado: `acshm.py` no disco estava
correto, o `git diff` estava limpo, e o teste acusava `y` a devolver o
valor de `z` — o mesmo bug do plano do mapa, ressuscitado do nada.

Só apareceu porque o teste foi lido de perto: todos os acessos directos
ao campo davam o valor certo, e só o `snapshot()` dava o errado. **Um
`git status` limpo não prova que se está a executar o código do disco.**

Como qualquer ferramenta que reescreva fontes sofre disto:

```python
# correr testes e mexer no codigo ao mesmo tempo:
env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
# e apagar a cache antes de cada corrida
shutil.rmtree("__pycache__", ignore_errors=True)
```

`tests/test_mutation.py` faz as duas coisas, e existe precisamente para
isto: parte o código de propósito e confirma que o teste o apanha.
**Oito mutações, as oito detectadas.** Um teste que nunca falha não
prova nada — foi assim que a estrutura 36 bytes errada passou a 100%.

Correu-se com:

```bash
python tests\run_all.py
```

---

## Regra nº 15 — uma lista de campos que escreveste não é uma prova

A Regra nº 7 diz "o struct do `acshm.py` é a lista do que existe". Isso
vale para os campos **que lá estão** — mas a lista foi escrita por mim, e
se a struct real for maior, há campos que existem e não são lidos. A
regra é circular quando usada para afirmar que *algo não existe*.

Exemplo concreto: "o AC não publica chuva". Isso veio de não encontrar
campo de chuva na lista. Pode ser verdade, mas a evidência é fraca.

**Tentativa que não funcionou, para não repetir:** medir o tamanho real
das páginas pelo maior `MapViewOfFile` que o SO aceita. A memória
partilhada é sempre alocada em páginas de 4 KB, por isso o SO aceita
4096 bytes mesmo quando a struct tem 296. Devolveu 4096 para as três
páginas. O padding estava a zeros. `tests/tamanho_real.py` ficou com o
resultado registado de propósito.

**O que funciona:** mudar uma coisa e ver o que muda. `tests/chuva.py`
compara a memória antes e depois de mudar o tempo, despejando os 4 bytes
todos — não só os campos declarados, que é o ponto. Cada fase fica só
com os valores estáveis dentro dela, para o que muda a cada frame não
aparecer como candidato.

Regra geral: **para afirmar que um dado não existe, mudar a condição e ver
se aparece alguma coisa nova.** Uma lista de campos que escreveste prova
o que tem, nunca o que não tem.

---

## Regra nº 5 — escalas que não são óbvias

Confirmadas contra o AC real:

- `tyreWear` é **0..100** (100 = novo). **Não** é fracção 0..1. Multiplicar
  por 100 dá 9994 %.
- `kersCharge` (ERS) é fracção **0..1**.
- `tyreTempI / M / O` são três zonas por pneu; a ordem é
  `[FL, FR, RL, RR]` em todos os arrays de 4.
- **As três zonas do pneu NÃO seguem uma ordem única.** Medido em 4502
  amostras de um F1 em Interlagos: a roda **esquerda** tem sempre
  `I < M < O` e a roda **direita** tem sempre `I > M > O` — 4502 de 4502
  em todos os quatro cantos, sem uma única amostra irregular. A regra
  "interior < meio < exterior" só vale para FL e RL. Não a usar para
  diagnosticar offsets.
- **ABS e TC são o nível de ajuste, 0..1 — não são "está a actuar".**
  Medido: em 4502 amostras com travagens duras e aceleração a fundo,
  `abs` ficou em 0.13 e `tc` em 0.08 sem variarem uma única vez. A
  interface mostra a percentagem ("ABS 13%"). Mostrar ON/OFF a partir de
  um limiar de 0.5 dizia ao piloto que não tinha ABS quando tinha 13%.
- **`wheelsPressure` está em psi.** Medido 28,7 a 32,3 num F1. Se
  fossem kPa seriam 0,29 a 0,32 bar, **menos que a pressão atmosférica**
  (1 atm = 101,3 kPa) — impossível. Como psi dá 1,98 a 2,23 bar, que é
  o que um F1 usa. A unidade não vem escrita em lado nenhum.
- **`clutch` é 1.0 = encaixada, 0.0 = solta.** A documentação diz
  "1 = totalmente premida", o que é enganador. Medido a conduzir:
  fica em 1.0 durante a condução normal e desce a ~0.63 a travar forte.
  A interface mostra o **inverso** (quanto está solta), que é o que
  interessa para pontas de embraiagem e kicking.
- **Prova concludente:** numa captura de 4502 amostras houve 21 mergulhos
  de `clutchRaw` maiores que 0.25, e **os 21 coincidiram com uma mudança
  de caixa** (100%), a 96–203 km/h. Se fosse a posição do pedal, não
  teria relação nenhuma com as mudanças.
- `iCurrentTime`, `iBestTime`, `iLastTime` em **milissegundos**.
- No **AC base** a página de gráficos só traz `penaltyTime` (segundos) e a
  bandeira `AC_PENALTY_FLAG`. O enum de tipo de penalidade (`DT`, `SG10`,
  `DSQ`) é do **ACC** e não existe no AC base.

### Eixos do mundo — o que não é óbvio

**No AC, o eixo Y é a ALTITUDE. O plano da pista é X-Z.**

Medido em Spa com 19 adversários:

| eixo | amplitude |
|---|---|
| X | 997 m |
| **Y** | **88 m** ← o desnível de Spa |
| Z | 2012 m |

Se alguém desenhar o mapa com X contra Y, sai um rabisco achatado que
**não é a pista** — foi exactamente o que aconteceu na primeira versão.
A pista de Spa dá para reconhecer (Eau Rouge, Raidillon, Kemmel) assim
que se usa X contra Z.

Isto também vale para o `acpmf_simhub_v2` dos adversários: as
coordenadas que lá vêm são as mesmas.

---

## Regra nº 10 — transformações de canvas a partir do centro

Com um `offset` calculado à partida do mínimo, inverter um eixo
invalida o offset e o desenho sai todo fora do canvas **sem dar erro**.
Aconteceu com o Z no mapa: o traçado desapareceu sem erro na consola.

Transformar sempre a partir do centro de cada eixo:

```javascript
// bem
const cx = (minX + maxX) / 2;
const px = (p) => (p[0] - cx) * sc + w / 2;
const py = (p) => (cz - p[1]) * sc + h / 2;   // Z invertido, offset incluido

// mal: inverter p[1] e continuar a usar um offset feito com o min positivo
const py = (p) => -p[1] * sc + oy;            // oy calculado com min > 0
```

Vale para os gráficos dos pedais, para o delta e para o mapa.

---

## Regra nº 16 — duas vistas do mesmo mundo têm de usar a mesma convenção

O mapa tem **dois** caminhos de desenho, e durante algum tempo
discordavam um do outro, em silêncio:

| | transformação | o que desenhava |
|---|---|---|
| imagem do jogo | `iy = (z + Z_OFFSET) * k` | Y do canvas **cresce** com Z |
| traçado a conduzir | `py = (cz - z) * sc + h/2` | Y do canvas **decresce** com Z |

Um é o espelho do outro. Nenhum dos dois dá erro: os dois desenham uma
pista com aspecto perfeitamente plausível. Só de os pôr lado a lado se vê
que um está ao contrário — e o sintoma que o piloto relata não é "o mapa
parece estranho", é **"virei à direita e o mapa virou à esquerda"**.

Um mapa espelhado ainda parece um mapa, e é por isso que passa despercebido
até alguém virar à direita com a mão no volante.

Regra: **quando há mais do que uma vista para o mesmo plano do mundo, a
convenção de eixos é uma só, escrita num sítio só.** Se as duas vistas
têm de concordar, elas têm de chamar à mesma função — duas constantes
escritas em dois sítios diferentes vão divergir sem ninguém dar por isso.

E para decidir o sinal, não raciocinar sobre sistemas de coordenadas:
**medir.** Ver Regra nº 17.

---

## Regra nº 17 — o `map.ini` do Assetto Corsa, medido

Tudo o que segue foi medido nesta instalação: as 76 pistas com mapa
(`python tests\\mapa_todas_pistas.py`) e um trajecto real conduzido em
Baku e em Monza (`python tests\\mapa.py cap 200 50`).

### Os ficheiros não estão onde se procura

```text
content/tracks/<pista>/map.png          <- a imagem, NA RAIZ da pista
content/tracks/<pista>/data/map.ini     <- a escala, em data/
```

**Os dois não estão na mesma pasta.** Procurar `data/map.png` — que é o
que se faz por natural — faz o `/api/track-map` responder `not-found` para
**todas** as pistas, sem erro nenhum, e o mapa real nunca aparece.

### A imagem tem 1 pixel por metro. O `SCALE_FACTOR` não é a escala.

**Isto está ERRADO, e está aqui para eu não voltar a errar.**

A verdade, medida com um trajecto real de Monza (206 pontos, medindo a
distância de cada ponto à linha desenhada no `map.png`):

| fórmula | distância mediana à pista |
|---|---|
| `imgX = (x + X_OFFSET) / SCALE_FACTOR` | **0 px** |
| `imgX = (x + X_OFFSET)` | 132 m |
| `imgX = (x + X_OFFSET) * SCALE_FACTOR` | fora da imagem |

O `SCALE_FACTOR` **é** a escala. É px por metro quem fica a dividi-lo:
Monza tem `SCALE_FACTOR=1,4`, e um pixel da imagem vale 1,4 metros.

**A armadilha que me fez errar:** o `WIDTH`/`HEIGHT` do `map.ini` batem ao
pixel com as dimensões do PNG (monza 927,4 → 927 px; imola 1543,9 → 1543;
montreal 508,8 → 508; spa 1004,8 → 1004). Isso parece provar "1 pixel por
metro", e parece tão bem que eu escrevi a regra com essa conclusão.

Mas o `WIDTH` está em **píxeis da imagem**, não em metros. A extensão do
mundo é `WIDTH * SCALE_FACTOR` metros. O `map.ini` mistura as duas
unidades no mesmo ficheiro, e o nome do campo não diz qual é.

**E a pista onde medi isto primeiro foi a que não discriminava:** Baku tem
`SCALE_FACTOR=1`, e com escala 1 as duas leituras dão o mesmo número.
Foi a confirmação de uma amostra incapaz de discordar — a Regra nº 11 outra
vez, exactamente igual. Monza (`SCALE_FACTOR=1,4`) é que separou as
hipóteses.

Como verificar, sem dados de condução: `1 / SCALE_FACTOR` tem de dar um
número que projecta o trajecto para dentro da imagem. Se der 1,0 numa pista
com `SCALE_FACTOR=1,3`, está errado.

### O `MARGIN` não está cozido na imagem

`MARGIN=20` com a imagem exatamente `WIDTH` px de lado: logo a margem
**não** está somada. Medido em Monza — somar `MARGIN/2` punha a mediana
de 0 px para 9 px, e somar `MARGIN` para 19 px.

### Pistas com dados que não batem com a própria imagem

O `WIDTH`/`HEIGHT` do `map.ini` tem de descrever a imagem em píxeis, e em
54 das 76 pistas bate. Onde não bate, os dados estão errados e o mapa
sairia torto — `ek_irohazaka` (`WIDTH` 2368 numa imagem de 1993 px) e
`Brooklyn Park` (365,9 em 355 px, 350,4 em 200 px). Aí o servidor manda
`trusted: false` e o cliente volta ao mapa traçado, que é sempre correcto.

---

## Regra nº 18 — o `tyreWear` da API Lua e o da memória partilhada são campos diferentes

O jogo tem **duas interfaces** completamente distintas, e campos com o
**mesmo nome** significam coisas diferentes em cada uma:

| | memória partilhada | API Lua (`ac.getCar`) |
|---|---|---|
| `tyreWear` | **0..100**, 100 = novo | **fracção 0..1**, 1 = **destruído** |
| como se mostra | o valor, que é o que resta | `(1 - tyreWear) * 100` = **o que resta** |

O HUD do Content Manager faz exactamente isso:

```lua
local wear_string = string.format("%d%%", (1 - wheel.tyreWear) * 100)
```

**A direcção do valor da Lua já esteve escrita ao contrário aqui, e
vale a pena ver porque é que se decidiu ao contrário.** A primeira
versão dizia "fracção 0..1, 1 = novo" e "a fórmula mostra o gasto". São
as duas ao contrário, e a prova está nas duas linhas seguintes do
`CMRT-Complete-HUD`:

```lua
if wheel.isBlown or wheel.tyreWear >= 1 then   -- 1 = destruído
  is_broken = true
end
...
if wheel.tyreWear < -0.1 or (data_maybe_unavailable and wheel.tyreWear == 0) then
  wear_string = '-'                             -- o zero é "não escrito"
end
```

`>= 1` ser **partido** só faz sentido se 1 for o fim da vida. Se 1
fosse "novo", essa linha estaria a marcar o pneu novo como partido — e
um HUD com um erro desses saltava aos olhos. E o `== 0` ser tratando
como **indisponível**, e não como "novo", é a mesma coisa pelo outro
lado: num valor de desgaste, zero é a página não escrita, nunca um
pneu intacto.

Portanto: Lua `tyreWear` é **quanto já foi gasto**, e `(1 - tyreWear) * 100`
é **quanto resta**. Que é o mesmo sentido que a memória partilhada, e
não o contrário.

### E porque é que isto não chega para comparar os dois números

Ter a mesma direcção não é ter o mesmo número. Medido lado a lado, com
as duas leituras no mesmo instante (a temperatura do núcleo bate a 1 °C
entre as duas, por isso é o mesmo carro e o mesmo segundo):

| | FL | FR | RL | RR |
|---|---|---|---|---|
| memória partilhada (`acshm.py`) | 98,7 | 98,8 | 98,4 | 98,4 |
| HUD do CM, lido como "restante" | 88 | 91 | 82 | 82 |

Dez pontos de diferença, e **sem explicação**. O que está confirmado:

- **Não é um offset.** A `struct` está alinhada: `tyreCoreTemperature`
  (offset 152) bate com o HUD a 1 °C, e vem **depois** de `tyreWear`
  (offset 120). Se o `tyreWear` estivesse deslocado, a temperatura
  também estaria.
- **A ordem das rodas bate.** FR é o melhor dos dois lados, RL e RR os
  piores. Não é ruído: é o mesmo estado, lido por duas interfaces.
- **Não se pode confirmar pelo Python.** O enum `CS` do
  `acsys.py` tem **73 campos e nenhum é o desgaste** — foi contado um a
  um. Não há `TyreWear` nem equivalente, ao contrário do que se supunha
  ao escrever a regra. Sem ele, a app não consegue publicar o valor da
  Lua para o comparar com o da memória no mesmo frame, que era a
  prova que resolvia isto (o mesmo método que o `windSpeedApi` usou).

As duas explicações que ficam em pé, e **nenhuma está provada**:

1. **O HUD lê o carro da câmara, não o jogador.** O `tires/first.lua`
   faz `ac.getCar(focused)`, e o `focused` vem de
   `ac.getSim().focusedCar` (`common/players.lua`, linha 862) — que é
   o carro que a câmara está a ver, e muda se a câmara mudar.
2. **Um dos dois números não é desgaste.**

Regra prática: **não ajustar o número sem a prova.** Um valor
plausível e errado é o pior resultado possível, porque ninguém o
questiona — é a Regra nº 19 noutro sítio.

### O que a Lua mostra e a memória partilhada não tem

Lendo os 16 módulos do `CMRT-Complete-HUD` (16 módulos, 73 ficheiros)
e cruzando os nomes de campo com as minhas três structs, **só três dos
campos úteis da Lua existem na memória partilhada** — e todos três já
estavam no `acshm.py`, dois deles por decifrar:

| Campo Lua | Na shm? | O que se ganhou |
|---|---|---|
| `brakeBias` | **sim**, na física, nunca extraído | B. TRAVA, em % |
| `damage[4]` | **sim**, `carDamage` | danos por canto |
| `suspensionDamage[4]` | sim, mas na struct dos **adversários** | só via índice 0 |
| `tyreConsumptionRate` | **não** | vida do pneu: fora de alcance |
| `fuelPerLap` | **não** | voltas de combustível: fora de alcance |
| `isWeatherFXActive`, `weatherType` | **não** | **confirma a Regra nº 15** |
| `isLapValid`, `isLastLapValid` | **não** | validade da volta |
| `absModes`, `tractionControlModes` | **não** | "ABS 1 de 5" |
| `mgukRecovery`, `mgukDelivery`, `mguhChargingBatteries` | **não** | repartição de energia |
| `engineLifeLeft`, `gearboxDamage` | **não** | vida do motor |

**Três decisões antigas fecham-se aqui.** O `isWeatherFXActive` e o
`weatherType` existem, mas **na API Lua** — o que torna a conclusão
"o AC não publica chuva" (Regra nº 15) correcta quanto à **memória
partilhada**, e não um artigo de fé. E `tyreConsumptionRate` e
`fuelPerLap`explicam porque é que a estimativa de vida do pneu é
impossível de fazer bem: o jogo tem o número, e é precisamente esse
número que não chega.

Isto é a Regra nº 15 pelo outro lado: uma lista de campos que **eu**
escrevi não prova o que não existe, mas ler o código de um HUD de
terceiros que usa a **outra** interface, campo a campo, prova.

### `brakeBias` e `carDamage`, já decifrados

```lua
bump_damage[i] = car.damage[i] / 60          -- 0..60 -> 0..1
engine_damage   = 1 - car.engineLifeLeft / 1000
```

- **`brakeBias` é uma fracção 0..1.** Medido **0,58** num Toyota TS040
  sem nada mexido, e a Lua mostra-o ×100 e ajusta-o de 0,5 em 0,5.
  Não estava no `snapshot()`; estava na struct, por ler.
- **`carDamage` são 5 floats** e a Lua usa **4**, e o desenho do painel
  diz a ordem: **frente, trás, lado esquerdo, lado direito**. Dividir por
  60 é o que a Lua faz, logo 60 é o máximo. O **quinto valor não é usado
  por ninguém** que eu tenha encontrado — fica por explicar e não é
  mostrado.

Um painel de danos vazio é ruído, e o HUD do jogo também só o mostra
quando algo parte. Por isso a linha só aparece com dano > 0.

---

## Regra nº 19 — o contrato entre a app e o leitor é binário e ninguém o verifica

A app em `python_app/` corre **dentro** do jogo e escreve uma struct
numa página de memória partilhada. O `acshm.py` corre **fora** e lê
essa mesma struct. São dois ficheiros, dois processos, dois
interpretadores — e nada os liga a não ser o **nome da página** e a
**ordem dos campos**.

Se um dos dois mudar sozinho, **não dá erro nenhum**. O leitor mapeia
a página, lê os bytes, e devolve números plausíveis a partir do sítio
errado. A única forma de isso aparecer no ecrã é um carro com os tempos
todos trocados, e isso descobre-se a conduzir — nunca num teste.

É a Regra nº 16 aplicada a um contrato binário em vez de a um eixo: duas
coisas escritas em dois sítios divergem sem ninguém dar por isso.

### `tests/test_contrato.py` — e ele morde

Compara as duas structs campo a campo: nome, offset em bytes, tipo e
tamanho total. Também compara `MAX_SECTORS`, `MAX_CARS` e o nome da
página.

```
$ python tests\test_contrato.py
ok: a app e o acshm.py falam a mesma linguagem.
    pagina acpmf_actelemetry_v2, 37192 bytes, 128 carros, 280 bytes por carro

$ python tests\mutacao_contrato.py      # o turboBoost passa a c_float*2
$ python tests\test_contrato.py
13 PROBLEMA(S) no contrato.
```

Os outros testes **não apanham isto**. O `test_opponents.py` valida a
struct do `acshm.py` contra si próprio — que é exactamente o que a
Regra nº 4 avisa que não prova nada sobre o mundo.

### O segundo caso: os zeros são piores do que o erro

A regra acima é abstracta. A segunda vez que o nome mudou, a struct
ganhou 20 bytes (o bloco do clima) e a **v1 continuou a correr**. O
leitor novo, a ler `acpmf_actelemetry_v1`, foi buscar 20 bytes a
seguir ao fim real da página — e deu **zeros**.

Zeros são o pior resultado possível, e a razão é serem **plausíveis**.
No caso do clima, `rainAmount = 0` lê-se como "não chove", e é um número
que ninguém questiona. Um erro, um `available: false` ou um `NaN` seriam
melhores: dizem logo que alguma coisa está errada.

Foi o que aconteceu, medido: a app a corria com `pluginVersion 1.0.0`, o
leitor esperava a struct nova, e os campos do clima davam 0 sem que nada
indicasse que estavam fora da página. **Foi preciso ir ler o
`pluginVersion` para dar conta.**

A regra não muda, aperfeita-se:

> **A struct mudou de tamanho, logo o nome muda. Sempre, sem excepção.**
> E não por cautela — porque a cautela aqui é deixar o desalinhamento
> passar em silêncio.

Por isso o `pluginVersion` está no cabeçalho e é lido pelo leitor: é o
que permite descobrir qual dos dois lados está a correr, que é a
pergunta que um desalinhamento não responde sozinho.

### O nome da página é a garantia de versão

`acpmf_actelemetry_v2` é um nome que **nunca existiu**, de propósito.
Um mapeamento antigo (struct pequena) combinado com um leitor novo
(struct grande) faz o leitor ir buscar bytes a seguir ao fim real da
página. Com um nome novo só há duas possibilidades: está tudo actualizado
e funciona, ou a página não existe e o `acshm.py` responde
`available: false`. **O falhar é explícito; o desalinhado é silencioso.**

### Os campos que estavam lá e nunca eram preenchidos

A struct antiga tinha `suspensionDamage`, `engineLifeLeft` e
`tyreInflation` — 36 bytes por carro, 4,6 KB na página, **sempre a
zero**. Nenhum deles existe no enum `CS` do `acsys.py`, que é o que o
`ac.getCarState()` aceita. Logo não era a app que estava mal: era que se
tentava escrever campos que o Python não sabe ler. A HUD em Lua lê-os,
mas pela API do objecto carro, que é outra interface (Regra nº 18).

No lugar deles, o mesmo espaço passou a ter coisas que o `CS` devolve
mesmo: temperatura do núcleo e da banda dos 4 pneus, turbo, ERS, e os
dois flags de DRS.

### Regra prática

**Ao acrescentar um campo, acrescente-o aos dois lados e corra
`test_contrato.py`.** Se o teste não o utilizar, o campo existe num
documento e não no dashboard — e não há nada que o diga.

---

## Regra nº 20 — a tabela do tempo, e o que dela se consegue ler

O vocabulário do tempo do Assetto Corsa não está no AC. Está no Pure
Planner, em
`ac_info/apps/lua/PurePlanner/settings/settings_defaults.lua`, em 37
linhas: o nome da cena e as quantidades que o próprio jogo reconhece.

**O comentário de cabeçalho desse ficheiro está certo** — nomeia as
treze colunas e batem com a linha, uma a uma:

```lua
-- name  id  rain  probability  variance  wetness  water  wind
   humidity  mist  sun  air_temp  road_temp
```

Isto está aqui escrito porque eu passei uns minutos a achar o contrário.
Li o comentário por um `print` limitado a 104 caracteres, que o cortou a
meio de `humidity`, e escrevi que o comentário nomeava nove colunas
quando a linha tem treze. **Não nomeia nove.** O que engana é o
alinhamento: as colunas do comentário não estão alinhadas com os
valores, e a última linha acaba em `},` — vírgula **depois** do fecho,
e `\r` no fim. Cortar só o `}` deixa o `road_temp` colado ao fecho, e o
parse falha em "campo não numérico", que culpa o número e não a linha.

Regra: **antes de dizer que um comentário está desatualizado, vê-lo
inteiro.** E põe uma guarda que compare o que o comentário diz com o que
o código espera — foi o `ler_cenas.py` a abortar com "o comentário da
tabela mudou" que me obrigou a olhar, e a diferença era um `nome` meu
onde o ficheiro tem `name`.

### As doze cenas secas, e porque só uma se distingue

**Doze das 37 cenas têm `rain` a zero.** Com só a chuva, o painel dizia
"seco" a todas:

| cena | vento | o que a distingue |
|---|---|---|
| `windy` | **50** | o vento — **é a única legível** |
| `broken_clouds` | 35 | nuvem |
| `scattered_clouds` | 20 | nuvem |
| `few_clouds`, `overcast_clouds` | 15 | nuvem |
| `clear` | 5 | nuvem |
| `fog`, `mist`, `smoke`, `haze`, `sand`, `dust` | 0 | `humidity`, `mist` |

`humidity`, `mist` e `sun` **não estão na memória partilhada**. Isto foi
contado, não deduzido: nos 60 campos da `SPageFilePhysics` há
`airTemp`, `roadTemp` e `airDensity`, e mais nada que diga respeito ao
tempo. É a Regra nº 15 pelo avesso — afirmar que um dado não existe a
partir de uma lista que eu escrevi não vale, e por isso é que se foi
contar os campos.

E a `air_temp` da tabela **não serve como detector**: é o valor do
*preset*, e o Pure põe a chuva abaixo de zero de propósito, para a
precipitação sair neve e não chuva. A tabela toda vai de −12 °C a
+5 °C, e uma sessão normal lê 20 °C — não corresponde a presets nenhum.
Temperatura de preset não descreve o que se está a ver.

### A unidade do `wind`, que não está confirmada

O AC documenta `windSpeed` em **m/s**. A tabela não diz nada, e as duas
leituras são plausíveis:

| | `windy` a 50 | `hurricane` a 120 |
|---|---|---|
| se for **m/s** | 180 km/h, muito forte | 432 km/h, furacão a sério |
| se for **km/h** | 50 km/h, brisa | 120 km/h, forte mas não furacão |

**A medição que resolve é uma só:** escolher `windy` no Pure Planner,
deixar assentar, e ler o `windSpeed`. Perto de **50** é m/s; perto de
**14** é km/h. Está escrito no bloco `CENAS_VENTO` de `static/tempo.js`.

Até essa medição, o erro vai para o lado seguro: os limiares são
valores da tabela, e um limiar alto demais nunca dispara. O que não é
aceitável é o inverso — dizer VENTOSO com brisa. Por isso a
`pintarChuva` põe o número cru na dica, que é o único sítio onde se põe
sem estar a interpretar.

### Duas cenas com a mesma chuva

A tabela tem `tornado` (0,300 de chuva, 100 de vento) e `heavy_sleet`
(0,300, 0). Com só a chuva as duas diziam CHUVA FORTE — e uma é um
tornado e a outra é grão. Foi isso que motivou o eixo do vento.

Regra geral: **quando uma decisão passa a ter mais do que uma entrada,
verifica se nenhuma delas é redundante.** A chuva era a única, e
parecia suficiente porque nunca se viu `tornado` e `heavy_sleet` lado a
lado — e têm a mesma quantidade.

---

## Regra nº 6 — ctypes em Windows: armadilhas

Todas as quatro happened durante a construção deste projecto:

```python
# 1. Handles de 64 bits. Sem protótipos, o handle é truncado para 32 bits
#    e o MapViewOfFile recebe um handle inválido → devolve None.
k32.OpenFileMappingW.restype = wintypes.HANDLE
k32.OpenFileMappingW.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.LPCWSTR]
k32.MapViewOfFile.restype    = ctypes.c_void_p

# 2. MapViewOfFile: o 2.º parâmetro é dwDesiredAccess (FILE_MAP_*),
#    NÃO a protecção de página (PAGE_*). São famílias diferentes.
#    Passar PAGE_READONLY (0x02) é pedir FILE_MAP_WRITE.
addr = k32.MapViewOfFile(h, FILE_MAP_READ, 0, 0, ctypes.sizeof(struct))

# 3. c_float também tem um atributo _type_ (a string 'f').
#    Para detectar arrays aninhados, não basta testar _type_ is not None.
is_nested = (hasattr(elem, "_length_")
             and isinstance(getattr(elem, "_type_", None), type))

# 4. c_float * 3 * 4  =  4 linhas de 3   (é este o que se quer:
#    float[4][3], quatro pneus × três eixos)
#    c_float * 4 * 3  =  3 linhas de 4   (mesmo tamanho, ordem errada)
```

## Regra nº 7 — não inventar propriedades

Só escrever fórmulas com campos que **existem**. Já aconteceu com o
`ERSPercent`: a propriedade existe no `GameReaderCommon.dll` e aparece na
lista do SimHub, mas o plugin do AC **nunca a escreve**, por isso dava
valores ao contrário. O `acshm.py` é lido com atenção precisamente para
não cair nisto.

Verificar se um campo é mesmo publicado:

```powershell
Get-ChildItem 'C:\Program Files (x86)\SimHub\ACSharedMemory.dll'
# procurar a cadeia dentro do binario
```

Alternativa mais fiável: o struct de `acshm.py` é a lista do que
existe. Se não está lá, não existe.

### Campos que NÃO existem (já se perdeu tempo com isto)

| Queria-se | Situação real |
|---|---|
| `ERSPercent` | definido mas **não publicado** pelo plugin do AC. Usar `ERSStored / ERSMax`. |
| **Travão de mão** | **não existe** na shared memory do AC. Só há `gas`, `brake` e `clutch`. O handbrake só via API Python dentro do jogo. |
| `Fuel_LastLapConsumption` | não existe no SimHub. Usar `Fuel_LitersPerLap`. |

---

## Regra nº 8 — unidades misturadas no mesmo nome

`ersMaxJ` e `kersCurrentKJ` diferem por um factor de 1000 — um em
joules, outro em kilojoules. Um campo chamado `ersMaxKJ` que devolvia
joules foi um bug real, latente durante várias versões.

Ao acrescentar um campo com unidade no nome, confirmar a unidade contra o
jogo a correr antes de confiar no nome. A tabela do README é a
referência.

---

## Regra nº 9 — não afirmar causas sem o dado

Sei que foi tentador dizer "a app do SimHub crasha em
`getServerName()`" — fazia-me parecer mais competente do que sou, e ainda
por cima não era verdade. O AC tinha-se fechado entretanto, por isso não
havia forma de distinguir "a app morreu" de "o jogo não está a correr".

A regra: **quando se propõe uma causa, dizer o que a confirmaria**, e
não a apresentar como facto enquanto não a houver visto.

---

## Arquitetura

| Ficheiro | Responsabilidade |
|---|---|
| `acshm.py` | structs do AC, mapeamento, `snapshot()`, `Opponents`. **Só leitura.** |
| `server.py` | HTTP + SSE. Um thread lê a 200 Hz, cada cliente recebe ao ritmo que pediu. |
| `static/app.js` | desenho, mapa, gráfico de pedais, 4 idiomas, definições, estado. |
| `static/tempos.js` | matemática das voltas e do delta. **Pura**, sem DOM nem estado — por isso corre no node e é testada. |
| `static/index.html` / `style.css` | estrutura, três modos, definições e paleta. |

Fluxo de dados:

```
AC -> memória partilhada -> Hub (200 Hz) -> SSE telemetria (?fps=N, 5..60)
                                            -> SSE adversários (10 Hz)
```

O `Hub` tem um lock e só um thread lê a memória, para não haver leituras
concorrentes da mesma página.

---

## Convenções

- Comentários e mensagens de interface em **português de Portugal**.
- Código e nomes de variáveis em inglês.
- Paleta: `#000` fundo, `#151C1D` painel, `#171717` bloco, `#555C5D`
  secundário, `#FFD700` dourado, `#F58020` laranja, `#23CF16` verde,
  `#FF0000` vermelho.
- Fonte: Titillium Web. Só existem os pesos **Light 300, Regular 400,
  SemiBold 600, Bold 700, Black 900**. **Não usar `ExtraBold` (800) nem
  `Medium` (500)** — não existem e o browser cai na fonte do sistema.
- `tyreTemp*`, `brakeTemp` e afins estão em arrays de 4 na ordem
  `[FL, FR, RL, RR]`.

---

## Ao mexer no frontend

- Recarregar a página **não** apaga o mapa: está no `localStorage`
  (chave `acmap.v2`, no plano X-Z). Para limpar de propósito, usar o botão **limpar**.
- Ao mudar de pista o mapa é invalidado automaticamente.
- O `acshm.py` expõe `x`, `y` (altitude) e `z`. O plano da pista é X-Z;
  um mapa feito com X e Y parece uma pista e não é.
- Se mudar o layout, verificar nos três tamanhos: ecrã largo (3×2),
  tablet (2 colunas) e telemóvel (1 coluna).

---

## Ao mexer no `acshm.py`

1. Correr `python tests\run_all.py` — a suite toda, por ordem.
2. Com o jogo aberto, correr `python tests\verify_real.py` e **olhar para
   os valores**. Temperaturas de pneu têm de ter interior < meio <
   exterior. Travões da frente mais quentes que os de trás num RWD. Se
   algum valor for absurdo, é o offset (Regra nº 4).
3. Nunca acrescentar escritas nas páginas reais (Regra nº 1).

Com o AC a correr, `run_all.py` diz que o saltou — é o comportamento
certo, não uma falha. Os testes de memória escrevem em páginas
`ac_test_*`, que são criadas e destruídas pelo próprio teste.

### A suite

Corre com `python tests\run_all.py`. Sai com codigo diferente de zero se
algo falhar, e com codigo 2 (que nao e' falha) se o AC
estiver a correr e os testes de memoria forem saltados. Sao 23 grupos.

| Ficheiro | O que prova |
|---|---|
| `test_layout.py` | os 3 structs, campo a campo (60 + 30 + 42) |
| `test_acshm.py` | a leitura de telemetria, 46 valores com unidades |
| `mutacao_grip.py` | que a regra da aderencia morde, partindo o codigo |
| `test_opponents.py` | o struct de 128 carros: ordem dos campos, m/s para km/h, tempos, filtro de carros vazios |
| `compilar.py` | que os 40 `.py` compilam -- apanha erro de sintaxe |
| `verificar_js.py` | que os 11 `.js` fazem parse no node |
| `test_contrato.py` | que a app e o leitor falam a mesma linguagem |
| `test_handler.py` | que um cliente que cancela nao enche a consola |
| `test_payload.py` | que o `/api/state` tem o que o painel precisa, clima incluido -- o meio da ligacao |
| `test_tempos.js` | 35 casos de tempos e delta, sem browser (node) |
| `test_tyres.js` | a vida do pneu e a escala dos valores (node) |
| `test_combustivel.js` | voltas de combustivel e a percentagem (node) |
| `auditar_frontend.py` | o frontend inteiro: ids, traduccoes, contraste, chaves CSS, movimento reduzido |
| `mutacao_acessibilidade.py` | que a regra 2.3.3 morde, partindo o CSS |
| `verificar_finitos.py` | que nenhum valor chega a NaN ou infinito |
| `test_mutation.py` | que os testes de cima falham quando o codigo esta partido |
| `mutacao_contrato.py` | que o contrato entre a app e o leitor e' mesmo verificado |
| `test_loop_app.py` | que o loop da app nao engole uma excepcao |
| `mutacao_loop.py` | que esse teste morde, partindo o loop |
| `test_tempo.js` | 104 casos de clima, com os limiares das 37 cenas do Pure Planner e o eixo do vento (node) |
| `test_medir_tyrewear.py` | que a medicao do desgaste por volta faz sentido |
| `verificar_texto.py` | que nao entrou texto torto nem caracteres estranhos |
| `verificar_commits.py` | que as mensagens de commit nao tem BOM nem caracteres estranhos |

### Fora da suite, e porque

Estes correm a mao porque **precisam de uma condicao que a suite
nao cria**: o jogo aberto, o browser, ou uma serie ja gravada. Nao e
esquecimento -- e' que um teste que precisa do jogo para
correr tambem nao prova nada quando o jogo nao esta a abrir.

| Ficheiro | Porque e' a mao |
|---|---|
| `analisar.py` | responde as perguntas sobre essa serie |
| `caixa.py` | a cinemática da caixa e as reacções |
| `capturar.py` | grava a serie de N segundos num JSON |
| `check_acessibilidade.js` | as 5 regras de acessibilidade, no browser. A regra 2.3.3 tambem esta na `auditar_frontend.py`, em forma estatica, e e' essa que a suite usa |
| `check_layout.js` | medidas no browser, para colar na consola |
| `chuva.py` | compara a memoria antes e depois de mudar o tempo, campo a campo |
| `clima.py` | lista os campos do `acshm` e procura mais candidatos a clima |
| `diag_drs.py` | agrupa o que encontra no canal SSE, para nao concluir de duas amostras |
| `diff_offsets.py` | compara duas leituras para achar um offset deslocado |
| `forma_mapa.py` | desenha as duas formas de transformar o mapa, para comparar |
| `mapa.py` | grava um trajecto conduzido e desenha o mapa |
| `mapa_todas_pistas.py` | mede o `map.ini` das 76 pistas |
| `medir_tyrewear.py` | mede a queda do desgaste por volta, a conduzir |
| `probe_layout.py` | despeja os valores e procura grupos de 4 -- a assinatura de uma temperatura |
| `run_all.py` | NAO E' UM TESTE -- e' o que corre todos os outros, por ordem |
| `tabela_testes.py` | NAO E' UM TESTE -- e' o que escreve esta tabela |
| `tamanho_real.py` | mede o tamanho real das paginas. O resultado fica registado de proposito |
| `test_tempos.html` | os mesmos casos de tempos, para abrir no browser |
| `verificar_combustivel.py` | precisa do jogo a correr e do deposito a descer |
| `verify_real.py` | os valores reais, so' com o jogo aberto |
| `vida_pneu.py` | a vida do pneu a partir de uma serie ja gravada |

## Ao mexer na matemática das voltas

A parte testável está em `static/tempos.js`, **sem DOM e sem estado
global** — é por isso que dá para a correr no node. O `app.js` fica só
com o estado (`S`) e delega. Se acrescentar lógica de tempos, pô-la
aí, não no `app.js`.

`deltaParaRef` devolve `null` de propósito quando não há referência, ou
quando o carro está fora do percurso da referência. `null` é diferente
de zero: `null` quer dizer «não sei» e pinta-se neutro, `0.000` quer
dizer «estás exactamente na referência».

Perto de zero (menos de 50 ms) o número fica **sem cor**, para não
piscar a vermelho quando se está a andar na linha.
