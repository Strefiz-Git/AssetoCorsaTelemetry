# Assetto Corsa — telemetria

Tudo o que este projecto sabe sobre a telemetria do **Assetto Corsa**.
Escrito a partir de:

- `resources/docs/ac/ACSharedMemoryDocumentation.pdf` (o documento oficial
  da EA, 7 páginas — a fonte primária)
- `resources/docs/ac/ACPythonDocumentation.pdf` (a API de Python que
  corre **dentro** do jogo)
- `resources/docs/ac/ACRemoteTelemetryDocumentation.pdf` (o protocolo
  remoto, que é outra coisa e não é usado)
- e de medições feitas com o jogo a correr, que estão marcadas como tal
  e com o sítio onde foram tiradas.

O documento do outro jogo está em [`f1-25.md`](f1-25.md).

---

## 1. A ideia em duas linhas

O Assetto Corsa publica **três páginas de memória partilhada com nome**
(uma coisa do Windows, não uma ligação de rede) e o painel lê-as
directamente, a 200 Hz, sem passar pelo SimHub.

A parte cara não é ler: é que **os adversários não estão nessas páginas**.
As três são só do carro do jogador. Para os outros carros é preciso uma
nossa app a correr **dentro** do jogo, que escreve uma quarta página
— e essa é a metade do trabalho que no F1 25 não existe.

| | Assetto Corsa | F1 25 |
|---|---|---|
| transporte | memória partilhada com nome | datagramas UDP |
| adversário | **app Python dentro do jogo** | vem no próprio packet |
| é preciso instalar alguma coisa | **sim** | não |
| documenta o tempo | não | sim |
| vida do pneu | não existe, estima-se | `m_lifeSpan` |

---

## 2. As três páginas, e o que cada uma é

| página | tamanho | cadência | o que tem |
|---|---|---|---|
| `acpmf_physics` | **580** bytes | cada frame | física do carro, alta frequência |
| `acpmf_graphics` | **296** bytes | cada frame | sessão, tempos, bandeira, posição na pista |
| `acpmf_static` | **684** bytes | nunca muda | o carro e a pista: `maxRpm`, ERS, DRS, nome |

Tamanhos medidos com `ctypes` em `acshm.py`, que é a struct que o painel
lê. `_pack_ = 4` nos três, o que é o mesmo que o AC usa (é um jogo de
32 bits e as structs não são naturalmente alinhadas).

A quarta página é nossa e chama-se `acpmf_actelemetry_v2`. Ver §7.

### Como se abre uma página

```python
k32.OpenFileMappingW.restype = wintypes.HANDLE      # Regra nº 6, armadilha 1
addr = k32.MapViewOfFile(h, FILE_MAP_READ, 0, 0, ctypes.sizeof(struct))
```

Sem o `restype`, o handle de 64 bits é truncado para 32, o `MapViewOfFile`
recebe um handle inválido e devolve `None`. E o **segundo** parâmetro do
`MapViewOfFile` é `dwDesiredAccess` (`FILE_MAP_*`), **não** a protecção de
página (`PAGE_*`) — são famílias de constantes diferentes e
`PAGE_READONLY` (0x02) pede `FILE_MAP_WRITE`. Regra nº 6, armadilhas 1 e 2.

---

## 3. Regra nº 3 — os nove campos que a documentação esconde (e não é a documentação)

Este é o erro mais caro que já custou tempo a este projecto, e vale a pena
escrever exactamente o que se passa, porque a versão que circula está
errada num detalhe importante.

**O que a documentação oficial diz.** As páginas 4 e 5 do
`ACSharedMemoryDocumentation.pdf` listam, a meio de `SPageFilePhysics`, e
**sem qualquer marca de depreciação**:

```c
float performanceMeter;   int engineBrake;      int ersRecoveryLevel;
int   ersPowerLevel;      int ersHeatCharging;  int ersIsCharging;
float kersCurrentKJ;       int drsAvailable;     int drsEnabled;
```

São 9 campos, 36 bytes, e estão todos documentados com a sua descrição.

**O que acontece na prática.** A struct de referência do AC em Python — a
que circula em vários repositórios, e que muita gente copia — traz estes
mesmos nove campos **comentados**, a meio de `SPageFilePhysics`. E é essa
que a esmagadora maioria dos projectos usa.

**Porque é que isso é um desastre.** Sem os 36 bytes, tudo o que vem a
seguir fica deslocado, e a deslocação só se nota em números que parecem
errados, não em números que parecem impossíveis:

| campo | o que aparecia | o que devia ser |
|---|---|---|
| `brakeTemp` | 0 °C | 300 a 800 °C |
| `tyreTempI` | 375 °C | 60 a 110 °C |
| `tyreWear` | 9994 % | 98,7 % |

Nenhum destes números dá erro. São floats, e um float mal lido é um float
perfeitamente normal. A pista clássica 375 °C num pneu e 0 °C nos travões
é que diz o que se passa.

**A regra, então, é:** quando a documentação oficial e a referência da
comunidade divergem, **a documentação oficial ganha**, e confirma-se contra
o jogo a correr. Não o contrário, e não a média.

A correcção está em `acshm.py`, com o bloco dos 9 campos e um comentário
que explica porquê. E asuite inteira passa a dar 100 % com a struct errada,
se a referência da comunidade for a base — o que é a Regra nº 4: um teste
que valida a struct contra si própria não prova nada sobre o mundo.

### Os arrays de três dimensões: `c_float * 3 * 4` vs `c_float * 4 * 3`

```python
("tyreContactPoint", c_float * 3 * 4)   # 4 linhas de 3  -> float[4][3]  CORRECTO
("tyreContactPoint", c_float * 4 * 3)   # 3 linhas de 4  -> float[3][4]  tamanho igual
```

O mesmo tamanho, a ordem errada, e nenhuma das duas formas dá erro. É a
quarta armadilha do `ctypes`, e a única em que as duas versões são
indistinguíveis pelo tamanho.

---

## 4. `acpmf_static` — o carro e a pista, 42 campos

Não muda durante a sessão. É o que o painel lê para saber o que é o carro
e o que é a pista.

```c
wchar_t _smVersion[15], _acVersion[15];
int     numberOfSessions, numCars;
wchar_t carModel[33], track[33], trackConfiguration[33];
wchar_t playerName[33], playerSurname[33], playerNick[33], carSkin[33];
int     sectorCount;                 // quantos sectores a pista tem
float   maxTorque, maxPower;         // do carro
int     maxRpm;                      // limitador
float   maxFuel;                     // litros
float   suspensionMaxTravel[4], tyreRadius[4];
float   maxTurboBoost;
float   deprecated_1, deprecated_2;   // "Do not use it" — e a sério
int     penaltiesEnabled;
float   aidFuelRate, aidTireRate, aidMechanicalDamage, aidStability;
int     aidAllowTyreBlankets, aidAutoClutch, aidAutoBlip;
int     hasDRS, hasERS, hasKERS;     // o carro TEM o sistema?
float   kersMaxJ, ersMaxJ;           // joules
int     engineBrakeSettingsCount, ersPowerControllerCount;
float   trackSPlineLength;           // comprimento da spline, METROS
int     isTimedRace, hasExtraLap, reversedGridPositions;
int     PitWindowStart, PitWindowEnd; // volta/minuto
```

`deprecated_1` e `deprecated_2` são os **únicos** campos que a
documentação marca como deprecados, e estão a dizer a verdade. Estão na
struct porque é preciso estar lá: sem eles, o `penaltiesEnabled` e tudo o
que se segue fica deslocado.

**As unidades do ERS, que dão o número certo com a unidade errada:**

| campo | unidade | o valor típico num F1 |
|---|---|---|
| `ersMaxJ` / `kersMaxJ` | **joules** | ~4 500 000 = 4,5 MJ |
| `kersCurrentKJ` | **quilojoules** | ~2000 por volta |

Differe num factor de **1000**, e o nome de um dos campos (`kersMaxJ`)
não ajuda. Regra nº 8. O painel publica os dois: `ersMaxJ` e `ersMaxMJ`,
para não haver dúvida sobre qual é qual.

---

## 5. `acpmf_physics` — a física, 60 campos

O `packetId` é a primeira coisa, e é a que diz se o jogo está vivo (§6).

```c
int   packetId;              // o AC incrementa a cada frame
float gas, brake;            // 0 a 1
float fuel;                  // LITROS
int   gear, rpms;
float steerAngle;            // RADIÂNOS
float speedKmh;
float velocity[3], accG[3];         // accG é no referencial LOCAL
float wheelSlip[4], wheelLoad[4], wheelsPressure[4], wheelAngularSpeed[4];
float tyreWear[4];                  // 0 a 100, 100 = NOVO
float tyreDirtyLevel[4];
float tyreCoreTemperature[4];
float camberRAD[4], suspensionTravel[4];
float drs;                   // float 0 ou 1
float tc, abs;               // NÍVEL de ajuste, 0 a 1
float heading, pitch, roll;
float cgHeight;
float carDamage[5];          // frente, trás, esquerda, direita (+1 morto)
int   numberOfTyresOut, pitLimiterOn;
float kersCharge, kersInput; // 0 a 1
int   autoShifterOn;
float rideHeight[2];
float turboBoost, ballast;
float airDensity, airTemp, roadTemp;
float localAngularVel[3], finalFF;
```

E depois os nove campos de §3, e depois:

```c
float brakeTemp[4];
float clutch;                // ver abaixo
float tyreTempI[4], tyreTempM[4], tyreTempO[4];
int   isAIControlled;
float tyreContactPoint[4][3], tyreContactNormal[4][3], tyreContactHeading[4][3];
float brakeBias;             // 0 (traseira) a 1 (frenteira)
float localVelocity[3];
```

### As três escalas que não são óbvias

**`tyreWear` é 0 a 100, e 100 é novo.** Não é uma fracção. Multiplicar por
100 dá 9994 %, que é o número que apareceu. O painel calcula o **gasto**,
`100 - valor`, e é esse que se mostra.

**`abs` e `tc` são o nível de ajuste, 0 a 1 — não "está a actuar".**
Medido, em 4502 amostras de travagens duras e aceleração a fundo: `abs`
ficou em 0,13 e `tc` em 0,08 **sem variarem uma única vez**. O painel
mostra "ABS 13%", que é a verdade. Mostrar ON/OFF a partir de um limiar
de 0,5 diria ao piloto que não tinha ABS quando tinha 13 %.

Isto é o contrário do F1 25, onde o `m_antiLockBrakes` é um 0 ou 1 e não
há percentagem nenhuma. **A mesma palavra, dois meanings, dois painéis
diferentes** — ver `f1-25.md` §6.8.

**`clutch` é 1.0 = encaixada, e a documentação mente.** A documentação
diz "Value of clutch pedal: 0 to 1 (fully pressed)", e isso faz Reading
"1.0 = o pedal está premido" — e 1.0 é precisamente o contrário, é a
embraiagem fechada, a que se chega a conduzir em normal. Medido: fica em
1.0 durante a condução normal e desce a ~0,63 a travar forte.

O painel mostra o **inverso** (quanto está solta), que é o que interessa
para pontas de embraiagem e kicking.

A prova concludente de que é a embraiagem e não o pedal: numa captura de
4502 samples houve 21 mergulhos de `clutchRaw` maiores que 0,25, e **os 21
coincidiram com uma mudança de caixa** (100 %), a 96–203 km/h. Se fosse a
posição do pedal, não teria relação nenhuma com as mudanças.

### As três zonas do pneu, e a regra que NÃO se deve usar

`tyreTempI`, `tyreTempM` e `tyreTempO` são interior, meio e exterior. A
regra "interior < meio < exterior" **só é verdadeira nas rodas
esquerdas**. Medido em 4502 amostras de um F1 em Interlagos:

| roda | ordem medida | amostras |
|---|---|---|
| esquerda (FL, RL) | sempre `I < M < O` | 4502 de 4502 |
| direita (FR, RR) | sempre `I > M > O` | 4502 de 4502 |

Sem uma única amostra irregular, nos quatro cantos. O mesmo pneu, o mesmo
instante,heated pelas duas bandas: a da esquerda lê de dentro para fora e a
da direita ao contrário.

**Portanto: a regra "interior < meio < exterior" não se usa para
diagnosticar offsets.** O que serve para isso é o padrão, não a ordem —
ver a secção seguinte.

### As unidades de `wheelsPressure`, que não estão escritas em lado nenhum

Medido 28,7 a 32,3 num F1. Se fossem kPa seriam 0,29 a 0,32 bar, **menos
que a pressão atmosférica** (1 atm = 101,3 kPa) — impossível. Como psi dá
1,98 a 2,23 bar, que é o que um F1 usa. **psi.**

### `brakeBias` é uma fracção 0 a 1

Medido **0,58** num Toyota TS040 sem nada mexido. O HUD do Content Manager
lê o campo com o mesmo nome, mostra-o ×100 e ajusta-o de 0,5 em 0,5. Isto
é diferente do F1 25, onde o `m_frontBrakeBias` é uma percentagem 0 a 100.

---

## 6. `acpmf_graphics` — a sessão, 30 campos

```c
int   packetId;
int   status;              // 0 OFF, 1 REPLAY, 2 LIVE, 3 PAUSE
int   session;             // -1 .. 6
wchar_t currentTime[15], lastTime[15], bestTime[15], split[15];
int   completedLaps, position;
int   iCurrentTime, iLastTime, iBestTime;   // MILISSEGUNDOS
float sessionTimeLeft;                     // SEGUNDOS
float distanceTraveled;
int   isInPit, currentSectorIndex, lastSectorTime, numberOfLaps;
wchar_t tyreCompound[33];
float replayTimeMultiplier;
float normalizedCarPosition;               // 0 a 1 na spline
float carCoordinates[3];
float penaltyTime;                         // SEGUNDOS
int   flag;                                // 0 a 6
int   idealLineOn, isInPitLane;
float surfaceGrip;
int   mandatoryPitDone;
float windSpeed, windDirection;
```

**Os tempos vêm duas vezes**, em `wchar_t[15]` (texto "1:23.456", que é o
que o HUD mostra) e em `int` (milissegundos, que é o que se pode
calcular). O painel usa os `int`. E `sessionTimeLeft` é um `float` em
**segundos**, ao contrário de tudo o resto.

`sessionTimeLeft` vem a **infinito** quando a sessão não tem limite — e é
o caso de um treino normal. Com isso, `int(inf * 1000)` levanta
`OverflowError`, que rebenta o `snapshot()` inteiro e o `/api/state` passa a
dar erro. O painel fica cego **numa sessão sem tempo**, que é
precisamente quando se treina. Por isso o `snapshot()` passa tudo por um
`_finito()`.

### A bandeira, e o que o AC base não tem

`flag`: 0 nenhuma · 1 azul · 2 amarela · 3 preta · 4 branca · 5 xadrez ·
6 penalidade.

O **tipo** de penalidade (DT, SG10, DSQ) é do **ACC**, não do AC base. O
AC base só traz `penaltyTime` em segundos e a bandeira. O `acshm.py` tem
uma tabela com os valores do ACC (0 a 21) mas o comentário avisa que não
existem no AC base — e mostrar um "SG10" que o AC não tem seria inventar.

### `windSpeed` é m/s, e a documentação oficial concorda

Este é o caso raro em que o comentário do código estava certo e a
documentação do ACC (v1.8.12) é que salva: "Wind speed in m/s". O número
que o painel mostra é 10 quando o vento é 10, e é 10 **m/s** = 36 km/h.

O `windDirection` é mais complicado. A documentação do AC diz
**"Direction of the wind (0-359)"**, ou seja graus, mas o comentário no
`acshm.py` diz que são **radianos**. Ninguém mostra a direcção, e é isso que
mantém o erro quieto. **Não está resolvido** — ver a Regra nº 9 e a
secção 12.

### `surfaceGrip` e o zero que é pior do que o erro

O `surfaceGrip` é 0 quando o jogo **não** está a simular o carro: no menu,
ou numa página que ninguém escreve. A aderência real **nunca** é
exactamente 0 — molhado desce, mas não a zero.

E o 0 é o pior resultado possível, porque é plausível: o painel pinta a
vermelho abaixo de 0,85, e um "0.00" a vermelho diz ao piloto que o carro
está sobre gelo. Medido numa sessão parada: `surfaceGrip 0` com o carro no
Nordschleife, a traçado, com os pneus a 39–42 °C. Não era gelo — era o
jogo parado.

Daí a regra que vale para todo o payload: **só um valor negativo é "não
disponível"**, e o zero é um zero honesto. Ver a Regra nº 19.

### As coordenadas do mundo: Y é a ALTITUDE

**O plano da pista é X-Z, e o eixo Y é a altura.** Medido em Spa com 19
adversários:

| eixo | amplitude |
|---|---|
| X | 997 m |
| **Y** | **88 m** ← o desnível de Spa |
| Z | 2012 m |

Spa tem um desnível de ~100 m, e os 88 m de Y são a altura. Desenhar o
mapa com X contra Y dá um rabisco achatado que não é a pista — e foi
exactamente o que aconteceu na primeira versão.

Isto vale também para o `acpmf_simhub_v2` dos adversários: as coordenadas
que lá vêm são as mesmas.

---

## 7. Regra nº 1 e Regra nº 19 — a quarta página, e porque o nome tem uma versão

Os adversários **não** estão nas três páginas do AC. Quem os publica é a
nossa app, `python_app/actelemetry_strefiz/`, que corre **dentro** do
jogo e escreve uma página nossa:

```
acpmf_actelemetry_v2      37 192 bytes      128 carros, 280 bytes cada
```

O cabeçalho (16 campos) traz o que é da sessão, e o bloco de 128 carros
traz o que é de cada um. O clima está no cabeçalho, e não em cada carro,
porque é da sessão:

```c
int   numVehicles, focusVehicle;
char  serverName[512];
CarInfo carInfo[128];      // 280 bytes cada
char  acInstallPath[512];
int   isInternalMemoryModuleLoaded;
char  pluginVersion[32];   // ← a versão, lida pelo leitor
int   errorCount;  char lastError[128];
float rainAmount;          // -1 = não se sabe
int   rainFxActive;
float windSpeedApi, windDirApi, weatherTimeMult;
int   cspVersionCode;  char weatherDebug[128];
```

E o `CarInfo`, os 25 campos que interessam a um adversário:

```c
int   carId;  char driverName[64];  char carModel[64];
float speedMS;                      // m/s — o painel converte
int   bestLapMS, lapCount, currentLapInvalid;
int   currentLapTimeMS, lastLapTimeMS;
vec3  worldPosition;
int   isCarInPitline, isCarInPit;
int   carLeaderboardPosition, carRealTimeLeaderboardPosition;
float spLineLength;                 // 0 a 1 na spline
int   isConnected;
float tyreCoreTemp[4], tyreSurfaceTemp[4];   // Celsius
float turboBoost, kersCharge;                // fracções 0 a 1
int   drsAvailable, drsEnabled;
int   lastSplitsMS[8], lastSplitsCount;
int   gearApi;
```

### O nome da página é a garantia de versão

O contrato entre a app (dentro do jogo) e o leitor (fora) é **só** o nome
da página e a ordem dos campos. São dois ficheiros, dois processos, dois
interpretadores, e nada os liga. Se um mudar sozinho, **não dá erro** — o
leitor lê bytes do sítio errado e devolve números plausíveis.

Por isso a página chama-se `acpmf_actelemetry_v2`, um nome que **nunca
existiu**. A v1 tinha 37 040 bytes; a v2 tem 37 192. Com a v1 a correr, o
leitor novo ia buscar 152 bytes a seguir ao fim real da página — e dava
**zeros**.

**Zeros são o pior resultado possível**, porque são plausíveis:
`rainAmount = 0` lê-se como "não chove", e ninguém questiona um zero de
chuva. Foi assim que o bloco do clima esteve a dar "seco" sem nada indicar
que estava fora da página — e foi preciso ir ler o `pluginVersion` para dar
da conta.

Por isso o `pluginVersion` está no cabeçalho e o leitor lê-o: é o que
responde a "qual dos dois lados está a correr", que é a pergunta que um
desalinhamento não responde sozinho.

E `tests/test_contrato.py` compara as duas structs campo a campo — nome,
offset, tipo e tamanho total — e falha se alguma divergir. Os outros testes
não apanham isto, porque validam a struct do `acshm.py` contra si mesma.

### A app do AC é nossa, e instala-se

Copiar a pasta `actelemetry_strefiz` para `assettocorsa/apps/python/` e
ligá-la no Content Manager (Settings → Python Apps). Confirma-se pelo log
do AC: `AssettoCorsaTelemetry <versão> a escrever na página`.

A app **engole excepções de propósito** — é melhor ler um valor errado do
que matar o fio. Mas também **publica as falhas** (`errorCount`,
`lastError`), porque esconder a falha foi como a leaderboard ficou vazia
sem ninguém saber porquê, e o painel culpar a app não estar ligada, que
era a instrução errada.

---

## 8. Regra nº 15 — o que se **pode** afirmar que não existe

O `SPageFilePhysics` tem 60 campos, o `SPageFileGraphic` 30, o
`SPageFileStatic` 42. **Essa lista prova o que existe, nunca o que não
existe** — foi escrita por quem a escreveu, e se a struct real for maior,
há campos que existem e não são lidos.

Tentativa que **não** funcionou, registada para não se repetir: medir o
tamanho real das páginas pelo maior `MapViewOfFile` que o SO aceita. A
memória partilhada é sempre alocada em páginas de 4 KB, por isso o SO
aceita 4096 bytes mesmo quando a struct tem 296. Devolveu 4096 para as três
páginas, e o padding estava a zeros. Ficou em `tests/tamanho_real.py`, de
propósito, com o resultado escrito.

**O que funciona:** mudar uma coisa e ver o que muda. `tests/chuva.py`
compara a memória antes e depois de mudar o tempo, despejando os 4 bytes
todos — não só os campos declarados, que é o ponto.

### O AC não publica chuva. E agora sabemos porquê melhor do que antes

São **60 campos** na página de física, e sobre o tempo só há `airTemp`,
`roadTemp` e `airDensity`. Não há `humidity`, não há `mist`, não há `sun`,
não há chuva. Isto foi contado, não deduzido.

O que o AC **tem** é o **efeito**: a aderência da pista desce quando está
molhado. E é por isso que o `surfaceGrip` diz mais sobre a chuva do que um
flag que não existe.

A chuva que o painel mostra vem da **API Python**, dentro do jogo, via
`ac.ext_rainParams()` e `ac.ext_weatherFxActive()` — funções do **Custom
Shaders Patch**, e que só existem se o CSP estiver instalado. Quando não
existem, a app publica **-1**, que o painel pinta a neutro. Nunca um zero.
Ver `docs/chuva.md` e `docs/chuva2.md`.

---

## 9. Regra nº 20 — a tabela do tempo, e de onde ela vem

O vocabulário do tempo do AC não está no AC. Está no Pure Planner, em
`ac_info/apps/lua/PurePlanner/settings/settings_defaults.lua`, em 37
linhas. As trinta e sete cenas, com vento, chuva e nuvem.

**Doze das 37 têm `rain` a zero**, e com só a chuva o painel dizia "seco" a
todas. Das doze, **uma** se distingue: `windy`, com vento 50. As outras
diferenciam-se por `humidity`, `mist` e `sun`, que **não estão na memória
partilhada**.

A `air_temp` da tabela **não serve como detector**: é o valor do *preset*,
e o Pure põe a chuva abaixo de zero de propósito, para sair neve em vez de
chuva. A tabela vai de −12 °C a +5 °C, e uma sessão normal lê 20 °C — não
corresponde a presets nenhum.

**A unidade do vento, que não está confirmada.** O AC documenta
`windSpeed` em m/s; a tabela não diz nada, e as duas leituras são
plausíveis:

| | `windy` a 50 | `hurricane` a 120 |
|---|---|---|
| se for **m/s** | 180 km/h, muito forte | 432 km/h, furacão a sério |
| se for **km/h** | 50 km/h, brisa | 120 km/h, forte |

**A medição que resolve é uma só:** escolher `windy` no Pure Planner,
deixar assentar, e ler o `windSpeed`. Perto de **50** é m/s; perto de
**14** é km/h. Até lá, o erro vai para o lado seguro (limiares altos demais
nunca disparam), e a `pintarChuva` põe o número cru na dica, que é o
único sítio onde se põe sem estar a interpretar.

Duas cenas com a mesma chuva — `tornado` (0,300 de chuva, vento 100) e
`heavy_sleet` (0,300, vento 0) — diziam as duas CHUVA FORTE. Foi isso que
motivou o eixo do vento. Regra geral: **quando uma decisão passa a ter mais
do que uma entrada, verifica se nenhuma delas é redundante.**

---

## 10. Regra nº 11 — o `drsAvailable` que quase sempre estava aceso

Primeira medição, num Red Bull RB21 em Suzuka: `drsAvailable esteve a 1
em **98,9 %** do traçado**, por igual nos cinco quintos da pista. Conclusão
escrita na altura: "este flag não marca a zona".

Segunda medição, num Ferrari SF25 em Interlagos: esteve a 1 em **18,5 % da
volta**, em **duas zonas contíguas** (0–30 % e 85–100 %), e só a
**262–312 km/h**, quase sempre em 8.ª ou 9.ª caixa. Isto é exactamente a
forma de uma zona de DRS real.

**Portanto a primeira conclusão estava errada, ou era específica daquele
carro.** Um flag medido uma vez, num só carro, tratado como regra geral.

O que o painel faz, e porque:

| o que mediu | veredito | o que acontece |
|---|---|---|
| 18,5 %–26 % | `zona` | pinta sozinho, e repinta o traçado já gravado |
| > 60 % | `sempre ligado` | não pinta, diz que não serve |
| < 2 % | `nunca ligado` | não pinta, diz que não serve |

Cada ponto do mapa guarda o `drsAvailable` original no 5.º elemento, para
o repintar ser possível sem voltar a conduzir. E o veredito fica visível
nas definições: se a interface decide sozinha, o piloto tem de ver o que
ela decidiu e porquê.

`drsEnabled` é fiável para a luz — `drsAvailable=1` com `drsEnabled=0` deu
98 amostras, `drsEnabled=1` deu 735. São os dois estados que a luz usa.

**E é aqui que o F1 25 é trivial e o AC é difícil.** O F1 25 dá
`m_drsAllowed` **e** `m_drsActivationDistance` (metros que faltam), e no
Season Pack 2026 dá a **lista de zonas de DRS** com início e fim em
fração de volta. O AC dá dois flags e é preciso conduzir uma volta
inteira para saber se são fiáveis. A medição não é opcional no AC, e
grátis no F1.

---

## 11. Regra nº 17 — o `map.ini`, medido em 76 pistas

O AC não publica o mapa da pista. A imagem e a escala estão nos ficheiros
do jogo, e é preciso saber onde o AC está instalado.

```text
content/tracks/<pista>/map.png          <- a imagem, NA RAIZ da pista
content/tracks/<pista>/data/map.ini     <- a escala, em data/
```

**Os dois não estão na mesma pasta.** Procurar `data/map.png` — que é o que
se faz por natural — faz o `/api/track-map` responder `not-found` para
**todas** as pistas, sem erro nenhum.

### A imagem tem 1 pixel por metro. Não. O `SCALE_FACTOR` é a escala.

Medido com um trajecto real de Monza (206 pontos), medindo a distância de
cada ponto à linha desenhada no `map.png`:

| fórmula | distância mediana à pista |
|---|---|
| `imgX = (x + X_OFFSET) / SCALE_FACTOR` | **0 px** |
| `imgX = (x + X_OFFSET)` | 132 m |
| `imgX = (x + X_OFFSET) * SCALE_FACTOR` | fora da imagem |

O `SCALE_FACTOR` **é** a escala: é px por metro quem fica a dividi-lo.
Monza tem `SCALE_FACTOR = 1,4`, e um pixel da imagem vale 1,4 metros.

**A armadilha que faz parecer o contrário:** o `WIDTH`/`HEIGHT` do
`map.ini` batem ao pixel com as dimensões do PNG (Monza 927,4 → 927 px;
Imola 1543,9 → 1543; Montreal 508,8 → 508; Spa 1004,8 → 1004). Isso
**parece** provar "1 pixel por metro", e parece tão bem que a regra foi
escrita com essa conclusão.

Mas o `WIDTH` está em **píxeis da imagem**, não em metros. A extensão do
mundo é `WIDTH × SCALE_FACTOR` metros. O `map.ini` mistura as duas unidades
no mesmo ficheiro, e o nome do campo não diz qual é.

E a pista onde isto se mediu primeiro foi a que **não discriminava**: Baku
tem `SCALE_FACTOR = 1`, e com escala 1 as duas leituras dão o mesmo
número. Foi a confirmação de uma amostra incapaz de discordar — a Regra nº
11 outra vez, exactamente igual. Monza (`SCALE_FACTOR = 1,4`) é que
separou as hipóteses.

O `MARGIN` **não** está cozido na imagem. Medido em Monza: somar
`MARGIN/2` punha a mediana de 0 px para 9 px, e somar `MARGIN` para 19 px.

Em 54 das 76 pistas o `WIDTH`/`HEIGHT` bate com a imagem. Onde não bate, os
dados estão errados e o mapa sairia torto — `ek_irohazaka` (`WIDTH` 2368
numa imagem de 1993 px) e `Brooklyn Park` (365,9 em 355 px, 350,4 em
200 px). Aí o servidor manda `trusted: false` e o cliente volta ao mapa
traçado, que é sempre correcto.

---

## 12. O que **não** está resolvido

Escrito aqui para não se perder, e porque a Regra nº 9 é sobre isto: dizer
a causa sem o dado é pior do que dizer "não sei".

1. **`windDirection`: graus ou radianos?** A documentação do AC diz
   "0-359" (graus). O comentário no `acshm.py` diz radianos. **Ninguém
   mostra a direcção**, e é por isso que o erro está quieto. Para
   resolver: meter a direcção no ecrã e comparar com a bandeira que o céu
   está a fazer.
2. **A `tyreWear` do AC e a da API Lua dão valores diferentes.** Medido
   lado a lado, no mesmo instante (a temperatura do núcleo bate a 1 °C, o
   que prova ser o mesmo carro): memória partilhada 98,7 / 98,8 / 98,4 /
   98,4, HUD do Content Manager lido como "restante" 88 / 91 / 82 / 82.
   Dez pontos, sem explicação. **Não é offset** (a `struct` está alinhada, e
   a temperatura vem *depois* do desgaste e bate a 1 °C). **Não se pode
   confirmar pelo Python** (o enum `CS` do `acsys.py` tem 73 campos e
   nenhum é o desgaste, foi contado um a um). Ver `f1-25.md` e a Regra nº 18
   do `AGENTS.md`.
3. **A caixa tem +1 deBug.** O `gearApi` da API e o `gear` da página de
   física discordam, e ninguém consegue ler os dois ao mesmo tempo. Os
   dois valores estão gravados no mesmo ciclo de leitura para se
   separarem. Ver `docs/caixa.md`.
4. **A caixa pela API Lua (`ac.getCar`) e a da memória partilhada são
   campos diferentes com o mesmo nome.** O HUD do Content Manager lê
   `ac.getCar(focused)` — a câmara, não o jogador — e `focused` muda se a
   câmara mudar.

---

## 13. Resumo do que o painel do AC mostra, e de onde vem

| o que se mostra | de onde vem | a armadilha |
|---|---|---|
| velocidade | `physics.speedKmh` | km/h |
| caixa | `physics.gear` | 0 = R, 1 = N, 2 = 1.ª |
| rpm / limitador | `physics.rpms` / `static.maxRpm` | |
| acelerador / travão | `gas`, `brake` × 100 | 0 a 1 |
| embraiagem | `1 - clutch` × 100 | **o inverso**, e a doc mente |
| volante | `steerAngle` | **radianos**, escala não confirmada |
| DRS | `drsAvailable` / `drsEnabled` | **os dois são inteiros** |
| ERS | `kersCharge` × 100 | fracção 0 a 1 |
| ERS na volta | `kersCurrentKJ` | **quilojoules** |
| ERS máximo | `ersMaxJ` | **joules** — factor 1000 |
| turbo | `turboBoost` | fracção 0 a 1 |
| combustível | `physics.fuel` / `static.maxFuel` | **litros** |
| temperatura do motor | — | **não há**; há `airTemp` e `roadTemp` |
| temperatura dos travões | `brakeTemp[4]` | depois dos 9 campos de §3 |
| temperatura do pneu | `tyreTempI/M/O[4]` | a ordem **não** é a mesma nos 4 cantos |
| pressão do pneu | `wheelsPressure[4]` | **psi**, não escrito |
| desgaste do pneu | `100 - tyreWear[4]` | `tyreWear` é 0 a 100 |
| vida do pneu | **estimada** | não existe, ver §8 |
| compound | `graphics.tyreCompound` | texto |
| ABS / TC | `abs`, `tc` × 100 | **nível**, não ON/OFF |
| bias de travão | `brakeBias` | **fracção 0 a 1** |
| danos | `carDamage[5]` | frente, trás, esq., dir., +1 morto |
| aderência | `graphics.surfaceGrip` | **0 quando o jogo está parado** |
| tempo | — | **não existe**, ver §9 |
| chuva | `ac.ext_rainParams()` | pela API, −1 se não há CSP |
| mapa | `carCoordinates` | **X-Z**, Y é altitude |
| `%` da pista | `normalizedCarPosition` | 0 a 1 |
| tempos | `iCurrentTime` etc. | **milissegundos** |
| tempo restante | `sessionTimeLeft` | **segundos**, e pode ser **inf** |
| CLASSIFICAÇÃO | a nossa app, página `v2` | **precisa da app instalada** |
| zona de DRS | `drsAvailable` medido numa volta | **Regra nº 11** |

---

## 14. As regras, todas juntas

As regras com o porquê e a medição estão em [`../AGENTS.md`](../AGENTS.md).
As que mais custaram tempo neste jogo:

| nº | a regra | porque |
|---|---|---|
| 1 | nunca escrever nas páginas reais | o `CreateFileMapping` devolve o objeto que já existe e as escritas vão para a sessão em curso |
| 2 | a página existir não é o jogo estar a correr | o SimHub mantém-nas mapeadas sempre; o sinal é o `packetId` |
| 3 | os 9 campos existem | sem eles, 36 bytes deslocados e números plausíveis e errados |
| 4 | um teste auto-consistente não prova nada | a suite passou a 100 % com a struct errada |
| 6 | `ctypes` no Windows | 4 armadilhas, todas encontradas durante a construção |
| 8 | unidades misturadas no mesmo nome | `ersMaxJ` em J e `kersCurrentKJ` em kJ |
| 9 | não afirmar causas sem o dado | e aqui está a lista do que não se sabe (§12) |
| 11 | um flag quase sempre aceso não é um mapa | medido em 2 carros: 98,9 % e 18,5 % |
| 13 | nunca deitar fora o início de uma volta | um `shift()` custava o primeiro quarto da pista |
| 15 | uma lista de campos não é uma prova | vale para o que existe, nunca para o que não |
| 16 | duas vistas do mesmo mundo, a mesma convenção | o mapa saiu ao contrário e ninguém viu |
| 17 | o `SCALE_FACTOR` é a escala | e `1 / SCALE_FACTOR` é que são os px por metro |
| 19 | o contrato é binário e ninguém o verifica | por isso `test_contrato.py` e a página com versão no nome |
| 20 | a tabela do tempo, e o que dela se lê | 37 cenas, 12 secas, 1 legível |
| 30 | quando os dois jogos divergem, o F1 25 manda | quem salta entre
os dois e' a mesma pessoa, e "12 % restante" e "88 % usado" sao o mesmo
fato com duas leituras -- **uma delas esta errada** |


### A unica regra em que o AC muda de habito (Regra nº 30)

Todas as outras linhas desta tabela sao "o AC e' assim". A 30 e'
a unica em que **o AC se passa a parecer com o F1 25**: quando os
dois jogos divergem numa apresentacao -- como se expressa uma
percentagem, que lado de uma barra e' o bom -- a convencao do
F1 25 passa a ser a do painel, e o AC muda para ela.

Isto **inclui este ficheiro**. O `tyreWear` do AC nao muda de
sentido, nao muda de escala e nao deixa de ser aderencia (veja a
Regra nº 18, e o `tyreWear` desta pagina): o que muda e' **como se
escreve** uma percentagem, nao **o que se mede**.

Ver [`../AGENTS.md`](../AGENTS.md), Regra nº 30, para o porquê e
para o exemplo -- 12 % restante contra 88 % usado.

---

## 15. Referências

| ficheiro | o que é |
|---|---|
| `assetto-corsa.md` | este documento |
| `f1-25.md` | a telemetria do outro jogo |
| `../AGENTS.md` | as regras, com o porquê de cada uma |
| `../acshm.py` | as structs, o mapeamento e o `snapshot()` |
| `../python_app/actelemetry_strefiz/` | a app que corre dentro do jogo |
| `../resources/docs/ac/ACSharedMemoryDocumentation.pdf` | o documento oficial |
| `../resources/docs/ac/ACPythonDocumentation.pdf` | a API de Python do jogo |
| `../tests/test_layout.py` | as structs, campo a campo |
| `../tests/test_acshm.py` | a leitura, 46 valores com unidades |
| `../tests/test_contrato.py` | que a app e o leitor falam a mesma linguagem |
| `../tests/verify_real.py` | os valores reais, com o jogo aberto |
| `../tests/probe_layout.py` | despeja a memória e procura padrões |
| `../tests/tamanho_real.py` | o tamanho real das páginas (resultado registado) |
| `../caixa.md`, `../chuva.md`, `../chuva2.md`, `../combustivel.md` | asinvestigações que faltam terminar |
