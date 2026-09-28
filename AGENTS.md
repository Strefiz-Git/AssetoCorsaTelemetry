# AGENTS.md

Instruções para agentes de IA (e pessoas) que trabalhem neste repositório.

Este projecto é pequeno, mas tem **armadilhas reais** que já custaram
tempo. Estão todas aqui para não se repetirem.

---

## Por onde começar

1. **Lê a skill `sessao-de-trabalho`.** Diz a ordem: começar, procurar sem
   abrir ficheiros grandes, editar sem estragar, e fechar.
2. **Este ficheiro não se lê inteiro.** Tem mais de mil linhas. Lê esta
   secção, o *Índice das regras* logo a seguir, e só a Regra ou a secção que
   a tarefa toca.
3. Se a tarefa continua trabalho anterior, lê o fim de `docs/progresso.md`.

### As skills

Ficam em `.opencode/skill/<nome>/SKILL.md`. Cada uma manda numa coisa só, e
as outras apontam para ela em vez de a repetir.

| Skill | Usar quando |
|---|---|
| `git-workflow` | **sempre**: commits automáticos, branches, o que nunca se faz |
| `sessao-de-trabalho` | início e fim de qualquer tarefa; eficiência; a ordem do fecho |
| `codigo-modular` | ao escrever ou alterar código: ficheiros pequenos, módulos, helpers, funções puras e reutilizáveis |
| `testes` | antes de commitar; ao criar ou registar um teste |
| `jogos-e-capacidades` | campo novo no `snapshot()`, capacidade nova, jogo novo |
| `mesma-convencao` | quando os dois jogos divergem no que mostram, e qual dos dois manda |
| `progresso` | no fim de cada bloco de trabalho: a entrada em `docs/progresso.md` |
| `documentacao` | Regra nova, arquitectura ou contagens alteradas, docs a crescer |

### O registo do que se faz

`docs/progresso.md` é o diário: o que se fez, porquê, o que correu mal e o
que ainda não foi verificado. Cada bloco de trabalho fechado acrescenta-lhe
uma entrada (skill `progresso`), **no mesmo commit** do trabalho. O que
sobrar desse diário e for uma armadilha para outros passa a Regra aqui.

### Código pequeno e modular

Nenhum ficheiro novo cresce sem limite: partem-se em módulos, e o que outro
código possa reutilizar vive num helper próprio, com funções puras. Os
limites de tamanho e o sítio de cada coisa estão na skill `codigo-modular`
(e só lá). Os ficheiros que já são grandes ficam **congelados**: código novo
vai para um módulo novo. Não se reorganizam pastas por iniciativa própria.

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
- **A entrada do `docs/progresso.md` vai no mesmo commit** do trabalho que
  descreve.
- **Nunca** `push`, `--force`, `reset --hard`, `clean -fd` ou
  `checkout .` sobre trabalho por guardar. Essas não se desfazem.

---

## Índice das regras

Procura por assunto, e lê só a Regra que interessa
(`grep -n "^## Regra nº 18" AGENTS.md`). As Regras não estão por ordem no
ficheiro, e **não se renumeram**: outros ficheiros citam-nas pelo número.

| Quando mexes em… | Lê as Regras nº |
|---|---|
| memória partilhada, `ctypes`, structs do AC | 1, 2, 3, 6, 7, 19 |
| unidades, escalas e nomes de campos | 5, 8, 24 |
| pneus (desgaste, temperaturas) | 18 |
| tempos de volta, delta, início de volta | 13, 14, 20 |
| mapa e canvas | 10, 11, 16, 17 |
| F1 25 (formatos, rodas, adversários) | 21, 22, 23, 24 |
| os dois jogos divergirem numa apresentação — e o F1 25 manda | 30 |
| texto que descreve o jogo (rodapé, título, ecrã de espera) | 25 |
| rotas de um jogo, e o contrato com o núcleo | 26 |
| `.bat` e `.ps1`, e o que demora | 27 |
| `<script src>`, globais entre ficheiros, e módulos que não chegam ao browser | 28 |
| HTML partido, ecras aninhados, e as saidas de um ecra | 29 |
| testes que passam sem provar nada | 4, 12, 15, 19 |
| dar uma causa ou uma conclusão | 9 |

Uma Regra nova e a nº 31 e vai à tabela acima (skill `documentacao`).

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

## Regra nº 21 — o F1 25 tem DOIS formatos, e a EA mudou um tipo a meio

O F1 25 com o **2026 Season Pack** não é um jogo novo: é o mesmo jogo com
o formato UDP **2026** em vez de 2025. E a diferença **não** é só o número
de carros.

A forma de saber qual está a correr é o `m_packetFormat` do cabeçalho.
**Não** pelo `m_gameYear`: com o Season Pack o jogo continua a dizer `25`.

E há **quatro** mudanças de tipo, e cada uma muda o tamanho do bloco de
cada carro — o que desloca todos os carros a seguir. É a Regra nº 3 outra
vez, com a diferença de que aqui a mudança é **oficial** e por isso mesmo
é mais fácil de cair: lê-se o ficheiro novo, vê-se que tem 24 carros, e
assume-se que a diferença é só o número.

| o que mudou | 2025 | 2026 | no bloco de um carro |
|---|---|---|---|
| carros por packet | 22 | 24 | — |
| `m_driverId`, `m_networkId`, `m_teamId` | `uint8` | **`uint16`** | **+3** |
| `m_teamId` (Lobby e Time Trial) | `uint8` | **`uint16`** | +1 |
| `m_engineTemperature` | `uint16` | **`uint8`** | **−1** |
| `m_ersHarvestLimitPerLap` | — | **novo** `float` | +4 |
| forças G | `float` | **`int16`**, dividir por **1000** | −6 |

Medido com `ctypes` (`tests/test_f125_parser.py`): os **33** tamanhos
declarados pela EA batem ao byte, nos dois formatos.

> **A struct de um packet é escolhida pelo `m_packetFormat`, e só por ele.**
> E um formato que não se conhece — o menu deixa escolher 2023 e 2024 —
> é **recusado**, nunca adivinhado. Ler os bytes a partir do offset errado
> daria números plausíveis, e um número plausível não se denuncia sozinho
> (Regra nº 19).

E `Car Telemetry`, de que o painel depende, é **um dos que mudaram de
tamanho**. Azar com sorte.

## Regra nº 22 — no F1 25 a ordem das rodas é RL, RR, FL, FR

**Todos** os arrays de 4 do F1 25 são nesta ordem. O Assetto Corsa usa
`[FL, FR, RL, RR]`.

```
F1 25:  0 = RL   1 = RR   2 = FL   3 = FR
painel: 0 = FL   1 = FR   2 = RL   3 = RR
```

São as duas ordens lado a lado, e as duas desenham uma grelha 2×2 quase
simétrica. Um painel ao contrário **não dá erro nenhum**: descobre-se a
conduzir, a comparar com o carro, e depois de estragar um stint.

Isto vale para as temperaturas, pressões, desgaste, dano, bolhas, forças,
camber, e o escorregamento.

> **A tradução acontece uma vez, na fronteira — em `jogos/f125.js`, no
> `_quatro()` — e nunca dentro da lógica de desenho.** Nenhum outro sítio
> sabe qual é a ordem.

E **cada teste põe um valor diferente em cada canto.** Com os quatro
iguais, uma ordem errada é indistinguível de uma ordem certa, e o teste
passa com o painel ao contrário.

**Isto aconteceu.** As temperaturas dos travões ficaram de fora da
tradução — as outras três estavam feitas — e ninguém notou, porque quatro
números muito parecidos não denunciam nada. O `test_jogos.js` apanhou-o
depois de o mesmo bug estar no receptor Python.

## Regra nº 23 — telemetria restrita põe a zero os adversários

O `m_yourTelemetry` nas opções do jogo é **Restrito** por omissão. Com ele
em restrito, o jogo põe a **zero** o combustível, o ERS e todo o dano
**dos outros carros**.

Ou seja: **metade da telemetria dos adversários é zero, e zero é
plausível.** Um painel que diz "sem ERS" está a mentir.

Para os ver inteiros: *Settings → Telemetry Settings → Your Telemetry →
Public*. Para o **carro do jogador os dados vêm sempre**, qualquer que
seja a definição.

O receptor publica também a **marca** de que estão escondidos, e o painel
diz isso em vez de mostrar os zeros. É a Regra nº 19 com uma origem
diferente: no AC é a nossa app que não preenche; aqui é o próprio jogo a
esconder.

## Regra nº 24 — três campos com o mesmo nome e unidades diferentes

Ao passar de um jogo para o outro, estes **não** se copiam:

| | Assetto Corsa | F1 25 |
|---|---|---|
| embraiagem | fracção **0.0 a 1.0**, e 1.0 = **embraiada** | **0 a 100**, e 100 = embraiada |
| ABS | **nível de ajuste** 0.0 a 1.0 | **ON/OFF**, um `uint8` |
| TC | **nível de ajuste** 0.0 a 1.0 | **modo**: 0 off, 1 médio, 2 cheio |
| combustível | **litros** | **quilogramas** |
| bias de travão | **fracção 0.0 a 1.0** | **percentagem 0 a 100** |
| ERS | `kersCurrentKJ` em **kilojoules** | `ersStoreEnergy` em **joules** |
| volante | **ângulo em radianos**, limite desconhecido | **−1 a 1 normalizado**, limite escrito |
| zonas do pneu | **três** (interior, meio, exterior) | **duas** (superfície, interior) |
| vida do pneu | **não existe** — estimada | **`m_lifeSpan`**, lida |

> **A unidade nunca se converte: escreve-se a unidade que o jogo manda.**
> 42,5 quilos não são 42,5 litros, e escolher uma das unidades e mostrar
> o número na outra é um número plausível e errado — o pior resultado
> possível, porque ninguém o questiona. (Regra nº 8, com mais uma linha.)

E por isso é que a resposta de um módulo traz **`txt` separado de `pct`**.
Ha casos em que se escreve um número e **não** se pode pintar uma barra: o
máximo não é publicado (o ERS do F1 25 não diz quanto cabe), ou o valor
é um **estado** e não uma quantidade (o ABS). Uma barra a 100 % seria
mentir sobre a única coisa que um piloto quer saber a meio de uma curva.

## Regra nº 25 — um texto herdado de um jogo não se repara

Quando o F1 25 entrou, o painel deixou de ser de um jogo só. Três textos
continuaram a ser do **Assetto Corsa**, e nenhum deles dava erro:

| Onde | Dizia | Devia dizer |
|---|---|---|
| rodapé, linha 1 | `F1 25` | `F1 25` — esta estava certa |
| rodapé, linha 2 | `memória do AC, sem SimHub` | o transporte do jogo activo |
| título da página | `Telemetria AC` | `Telemetria` |
| ecrã de espera | `A aguardar o Assetto Corsa` | `A aguardar o jogo` |

Nenhum teste falhou. Nenhum erro na consola. O painel com o F1 25
escolhido dizia, em simultâneo, **"F1 25"** e **"memória do AC"**.

Porquê custa: **dois textos vizinhos, um certo e um errado, e o errado
é o que tem a forma de frase.** O "F1 25" é um nome, e lê-se como uma
etiqueta. "memória do AC, sem SimHub" é uma frase, e uma frase descreve
a situação — lê-se sem reparar. A Regra nº 19 pelo avesso: um número
plausível e errado é o pior resultado possível, e uma frase plausível e
errada é o mesmo.

O ecrã de espera e o título são o caso mais difícil, porque nomeavam um
jogo **antes de haver um jogo escolhido**. Não há como estar certo: só se
pode dizer "o jogo".

**A regra:** quando o painel passa a ter mais do que um jogo, cada texto
que **descreve o jogo** é por jogo, ou não é nada. E o que descreve o
jogo não é só o número: é a origem dos dados, o título, e tudo o que
aparece antes da escolha.

Como se faz, por ordem:

- A frase do rodapé é `foot.src.<id>`, nos **quatro** idiomas. Não é texto
  tirado do módulo do jogo: a tradução vive num só sítio (o `app.js`) e
  partida por jogos deixa de se contar o I18N inteiro.
- A lista de ids **não se escreve** no `app.js` nem no `arrancar.ps1`. Sai
  do registo, `actelemetry.jogos`. Uma lista escrita à mão é um segundo
  sítio a saber os jogos, e diverge em silêncio no dia em que se
  acrescenta um terceiro.
- Se a chave faltar, escreve-se o transporte cru do jogo. É feio, e não
  é mentira.
- Como a linha é escrita à mão, `applyLang` chama
  `AplicarJogoNaInterface()` — senão mudar de idioma deixa a etiqueta do
  jogo na língua anterior.

**O que verifica**, e ambas morrem (`python tests\mutacao_rodape.py`):

- `auditar_frontend.py` confere que as chaves `foot.src.<id>` são
  exactamente as dos jogos registados. Acrescentar um jogo sem a frase
  falha o teste — e a falha aponta para a frase, que é a coisa a escrever.
- E que `app.title` e `boot.waiting` não nomeiam nenhum jogo registado,
  nos quatro idiomas. Procura-se o **nome** vindo do registo, não uma
  lista de textos proibidos, porque o teste tem de sobreviver à EA renomear
  o jogo.

E uma segunda, mais geral, que é a mesma coisa noutro sítio:

> **Uma rota de jogo tem de responder pelo caminho do browser.**
> `verificar_servidor.py` §3b mete todas as rotas de todos os jogos por
> HTTP e pergunta o código. Só pedia que **existissem**.

## Regra nº 26 — uma rota que devolve a forma errada fecha a ligação

`/api/track-map-image` devolvia os **bytes do PNG** em vez do dicionário
`{"__status", "body"}` que o núcleo consome. O `_enviar_rota` fazia
`r.get("body")` e rebentava:

```
AttributeError: 'bytes' object has no attribute 'get'
```

O `socketserver` fechava a ligação **sem responder**. O browser via um
502, e o painel caía no traçado desenhado — que dá sempre a pista certa.

Duas coisas difíceis de ver, juntas:

1. **Havia um caminho de reserva que funciona.** O `map.png` do jogo
   nunca carregou, e ninguém notou, porque o mapa desenhado a partir das
   coordenadas é sempre correcto. Onde há algo que funciona, o que falha
   não se vê.
2. **A forma errada não dá 500.** Dá uma excepção dentro do handler, e o
   `socketserver` transforma-a em ligação morta. O 500 é para quando se
   apanha a excepção; aqui ninguém a apanha.

O contrato entre um módulo de jogo e o núcleo é binário e não verificado —
a Regra nº 19 outra vez, com o contrato do jogo em vez do contrato da
app. **Por isso a correcção foi um teste, não uma linha:** §3b do
`verificar_servidor.py`, que passa todas as rotas pelo caminho do browser
e pergunta o código. Deliberadamente não reescreve a forma que a rota tem
de ter — reescrevê-la aqui seria uma segunda cópia que divergia da
primeira em silêncio.

## Regra nº 27 — 30 chamadas de 2 segundos não são 9 segundos

O `arrancar.ps1` espera que a porta responda com 30 tentativas de 300 ms,
e dizia "O servidor NÃO arrancou em 9 segundos".

O ciclo usava `Get-NetTCPConnection`. **Medido nesta máquina: 2,0 s por
chamada** numa porta sem nada. Trinta vezes são **69 segundos**, e a
mensagem dizia 9.

O que acontecia: `INICIAR.bat 8765 f1251` — um carácter a mais, o erro
mais provável de quem acabou de instalar — deixava a janela em silêncio
durante um minuto, e no fim o único texto era um tempo que não era o
tempo, seguido de um `servidor.log.err` que ninguém ia abrir. O argparse
do servidor recusava o jogo **correctamente**; só chegava tarde demais
para servir de alguma coisa.

Duas correcções, ambas no `arrancar.ps1`:

- **O jogo é validado no script, antes de arrancar.** Os ids são pedidos
  ao registo, `actelemetry.jogos.ORDEM`, e não escritos à mão. Responde
  em **1,0 s** e diz o que escrever.
- **A espera usa uma ligação TCP**, `Porta-Aberta`, e não o cmdlet.
  Sub-milissegundo com a porta fechada. E é a pergunta certa: o
  `Get-NetTCPConnection` diz se a porta está em *LISTEN*, que é diferente
  de haver quem responda.

> **`Get-NetTCPConnection` é um cmdlet de inventário, não um teste de
> conectividade.** Serve numa vez, antes de arrancar, para descobrir o
> PID. Num ciclo de espera é 2 s por tentativa e o ciclo deixa de medir o
> que diz medir.

A espera que sobrou (2 chamadas de `parar.ps1`, 1 do passo 0) fica: são
uma vez cada e o `Get-NetTCPConnection` é o que **dá** o PID, que a
ligação TCP não dá.

Verifica: `verificar_servidor.py` §4c-1 mede que um jogo inventado
responde em menos de 20 s, e imprime os segundos que levou.

## Arquitetura

O painel tem **dois jogos**, e a regra que organiza tudo e' uma so:

> **O núcleo não sabe qual é o jogo. Sabe o que um jogo tem de ter.**

### No servidor

| Ficheiro | Responsabilidade |
|---|---|
| `server.py` | **só a linha de comando.** O `--jogo`, a porta, o `--bind`, e o que se imprime no terminal. |
| `actelemetry/hub.py` | o estado partilhado: um thread lê o jogo, vários clientes leem. **Não sabe qual é o jogo.** |
| `actelemetry/http.py` | HTTP e SSE. **Não sabe qual é o jogo.** Serve o que o jogo registou em `jogo.rotas()`. |
| `actelemetry/defs.py` | onde se guardam as definições, e onde está o frontend. **O único sítio do servidor que escreve em disco.** |
| `actelemetry/jogos/base.py` | o que um jogo tem de cumprir, e a **lista canónica de 81 capacidades**. |
| `actelemetry/jogos/__init__.py` | o registo dos jogos, e a lista que o ecrã de escolha mostra. |
| `actelemetry/jogos/ac/` | o Assetto Corsa: `jogo.py` (a fachada), `logica.py` (capacidades), `mapa.py` (o `map.png` e o `map.ini`). O leitor continua no `acshm.py`. |
| `actelemetry/jogos/f125/` | o F1 25: `protocolo.py` (as structs e as tabelas), `receptor.py` (o socket), `logica.py` (as regras), `jogo.py` (a fachada). |

Fluxo de dados, **nos dois jogos**:

```
jogo -> leitor (200 Hz) -> Hub -> SSE telemetria (?fps=N, 5..60)
                                 -> SSE adversários (10 Hz)
```

O `Hub` tem um lock e só um thread lê. E **é o que impede a troca a
quente de ficar a meio**: o leitor antigo é fechado antes do novo abrir,
porque o socket do F1 25 fica na porta 20777 e dois em simultâneo não
podem.

### No browser

| Ficheiro | Responsabilidade |
|---|---|
| `static/index.html` | estrutura, três modos, o ecrã de escolha, `data-i18n`. **Sem lógica.** |
| `static/app.js` | o frontend: DOM, canvas, 4 idiomas, definições, SSE. **Sem regras de jogo.** |
| `static/nucleo/` | a matemática que é **igual** nos dois jogos. Puras, sem DOM. |
| `static/jogos/ac.js` | as regras do Assetto Corsa. Pura. |
| `static/jogos/f125.js` | as regras do F1 25. Pura. |
| `static/jogos/seletor.js` | a ponte: qual é o jogo activo, e o que ele consegue mostrar. |

**Por que é que os módulos de jogo são puros.** Uma regra dentro do
`app.js` só se pode testar com o jogo a correr e olhando para o ecrã. E
os cortes do clima do AC estavam errados assim durante meses: via-se o
resultado no ecrã, e ver catorze valores a cada alteração não é um teste.
`tests/test_jogos.js` cobre agora **145 casos dos dois módulos** sem
nenhum deles a correr.

### As três camadas, e porque não se misturam

| camada | sabe | não sabe |
|---|---|---|
| **núcleo** | que há leitores, e que devolvem dicionários | o que é telemetria, e de que jogo |
| **jogo** | os campos do seu jogo, e as unidades deles | o que se pinta no ecrã |
| **frontend** | ids, cores, canvas, idiomas | as unidades, e o que cada campo significa |

Uma regra de jogo no `app.js` é uma regra que só se testa com o jogo a
correr. Uma unidade no frontend é uma unidade que se copia para os dois
jogos e se torna errata num deles. E um `if (jogo === 'f125')`
espalhado pelo `app.js` é um segundo sítio a saber de jogos, e os dois
divergem.

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
  `[FL, FR, RL, RR]` **no AC**. No F1 25 o jogo manda `[RL, RR, FL, FR]`
  e a tradução está em `jogos/f125.js` — Regra nº 22.
- **A ordem das rodas converte-se uma vez, na fronteira, e nunca
  dentro da lógica de desenho.** E nenhum array de 4 chega ao painel
  sem passar pela tradução do módulo do jogo.

---

## Regra nº 28 — o `require` de um teste e um `<script>` são worlds diferentes

O painel é feito de módulos que se registam num global e se lêem uns aos
outros. O `jogos/ac.js` abre com:

```javascript
const U = global.NucleoUnidades;
const T = global.Tempo;
```

e o `app.js` chama `Tempo.cenaDe(v, w)` a cada pintura. **Isto só
funciona se o `index.html` trouxer o ficheiro que cria o global.** A
dependência não está escrita em lado nenhum: está na lista de `<script>`,
que é a única coisa que o browser lê.

Um módulo carregado por `require` traz as dependências que **o ficheiro**
declara. Um módulo carregado por `<script>` só tem as que o **HTML**
lista. São worlds diferentes, e é por isso que `test_jogos.js` passa com
um `global.Tempo` que o browser nunca vai ter: o `require` arrasta o
`tempo.js` como dependência, e esconde precisamente o bug.

### O que aconteceu, no `feat/f125`

O `tempo.js` foi movido de `static/` para `static/nucleo/` e ficou de
fora da lista do HTML. O `app.js` chama-o **sem guarda nenhuma**:

```javascript
const cena = Tempo.cenaDe(v, w);      // TypeError a cada pintura
```

O `ac.js` **tem** guarda, `if (!T) return null`, e isso é o engano
maior: a guarda existe, e o caminho que pinta o ecrã não passa por ela.
Um `if (!T)` no sítio que não é o do problema.

O título do commit que reconstruiu o `static/` era, literalmente,
*"o browser nunca tinha sido aberto"*. Não era um comentário a respeito:
era a razão.

E o mesmo branch tinha `nucleo/tyres.js` a publicar `root.Pneus` com o
`ac.js` a ler `global.Tyres`. Aqui não rebentou — havia guarda — e por
isso foi pior: a vida do pneu mostrava `a medir` para sempre, e nada
disse que o módulo não tinha carregado.

### A regra

> **Um global lido sem guarda tem de ser escrito por algum script que o
> `index.html` liste. E a lista de scripts é uma asserção, não um
> arquivo de inclui.**

`tests/test_scripts.js` confere isso **estaticamente**, sem browser e sem
executar nada: lê o `index.html`, lê cada script, e compara o que cada um
escreve com o que cada um lê. Deliberadamente não executa, porque
executar seria voltar ao mundo do `require`.

Duas decisões que ficaram escritas:

- **A ordem não é verificada, e é de propósito.** O `app.js` publica
  `globalThis.RepintarTudo` no fim do ficheiro e chama, antes disso,
  funções que o `seletor.js` só invoca quando o utilizador troca de
  jogo. Uma regra de ordem fio-a-fio daria falsos positivos nesses
  ganchos. O que interessa é o nome.
- **Globais publicados e nunca lidos são um relatório, não uma falha.** Um
  módulo pode publicar e ficar à espera de consumidor. A primeira versão
  fazia `ok()` em cada um e dava **onze falsos positivos** — os ganchos
  que o `seletor.js` chama sob `if (global.X)`. Um teste que apita doze
  vezes quando há um problema é um teste que se ignora, e um teste
  ignorado é pior do que nenhum.
- **E o nome procura-se por PALAVRA, não por `global.X`.** O `app.js`
  consome o módulo dos pneus assim, e é legal:
  `const r = Pneus.estimarPneus(S.pneuStint, { ... });`
  — sem `global.` à frente. `root.Pneus = api` põe `Pneus` no objecto
  global, e uma propriedade do objecto global *é* uma variável global.
  A primeira versão deste teste via só `global.X` e disse que o `Pneus`
  não tinha consumidor. Mudei o nome com essa informação, e a vida do
  pneu passou a dar `Pneus is not defined` na pintura, **com a suite
  toda a passar**. O `app.js` faz o mesmo com o combustível, e o estado
  do stint e do depósito vive em `S`, no `app.js` — não havia nada por
  ligar.

> **O relatório de um teste é uma afirmação, e uma afirmação falsa que
> leva a uma acção errada é pior do que não haver relatório.**

Por isso a resposta distingue duas coisas que não são a mesma: usado
**noutro** ficheiro — o global é consumido — e usado **só no ficheiro que
o publica**, que é o `window.VOLTA_MINIMA_S` do `tempos.js`: usado quatro
vezes no próprio ficheiro, publicado no global, e ninguém vai lá buscá-lo.

### O que o teste não apanha, e porque é o browser

`node --check` confirma que o ficheiro faz parse. Não confirma que a
função existe. Já aconteceu: `T_.vida(wear, sectors)` contra uma API que
se chama `estimarPneus(estado, dados)` — nomes diferentes, e um estado
persistente entre voltas que um módulo puro não pode ter. **Parse não é
execução**, e só abrir o browser diz o resto.

E a segunda limitação é a que me enganou: **uma leitura nua de um global
que não existe não é detectada.** A secção 2 só vê `global.X`, e por isso
se o `tyres.js` deixar de publicar `Pneus` o teste passa calado — e o
browser dá `Pneus is not defined` na pintura. As duas limitações são a
Regra nº 19 pelo avesso: um `undefined` que rebenta é melhor do que um
zero plausível, mas não chega.

O ficheiro diz as duas em código, na secção 4, para quem o ler não
confiar no que ele não cobre.

### Regra prática

Ao mover, renomear ou dividir um ficheiro em `static/`, abrir o browser.
E ao acrescentar um `<script>`, confirmar que o ficheiro está no disco
— um `/defs.js` apagado dá `null`, não dá erro, e é um 404 silencioso.

## Regra nº 29 — o ecra de espera tinha duas saidas que nao
funcionavam, e nenhuma

O ecra de espera tinha duas saidas que nao funcionavam, e nenhuma

Medido no browser, com o servidor a correr e a pagina aberta:

    #boot         VISIVEL 1223x886   z-index 60
    #jogos        VISIVEL 1223x886   z-index 50
    main.app      display:none

E duas coisas erradas, e a segunda esconde a primeira.

**O `abrirEcraJogos()` nao escondia o ecra de espera.** O `showMenu()` ja'
fazia, uma linha, e o `abrirEcraJogos()` nao. O ecra de escolha abria POR
BAIXO do ecra de espera: o boot e' `z-index:60` e o overlay e' `50`, e quem
abria a pagina via "A aguardar o jogo" por cima de uns botoes que nao
aparecem. O `z-index` nao se mexe -- o `60` e' certo para uma espera. O que
estava errado e' o boot continuar visivel por cima de um ecra que se abriu
depois dele.

**E o `main.app` estava a `display:none`**, porque o painel so aparece
depois de escolhida a VISTA. Por isso o botao `#btn-jogo` do cabecalho --
que se tinha ligado no commit anterior -- tinha **zero de tamanho** e nao
tinha onde ser clicado. Ligar o botao foi preciso e nao chegou.

A correccao tem as duas metades, e a segunda e' a que foi pedida:

- `abrirEcraJogos()` esconde o `#boot`, como `showMenu()` ja' fazia.
- o ecra de espera tem um **botao para escolher o jogo**. Um ecra de
  espera sem saida e' um beco sem saida: quem abre o painel com o jogo
  errado ve uma roda a girar e nada que diga que ha' uma opcao. E o
  botao vai com o TEXTO e nao so' com o icone, porque a razao para aqui
  e' nao perceber o que se pode fazer.

E `fecharEcraJogos()` volta ao ecra de espera, e nao ao painel: fechar o
ecra de escolha deixava o ecra a vazio, sem painel e sem espera.

O `z-index` nao se mexeu. O que se mexeu foi quem esconde quem.

### O `inert` no sítio errado: um ecrã que se vê e não se pode clicar

Isto foi o meu erro, e é o mais instructive de todos os que estão aqui.

O `abrirEcraJogos()` levava uma linha a mais, que eu escrevi para
"marcar o ecrã como modal":

```javascript
$('jogos').inert = true;      // ERRADO
```

`inert` **não** é "isto é modal". É **"isto não aceita cliques nem
foco"**. O ecrã de escolha ficou inutilizável: os cartões tinham 453×181,
visíveis, e um clique no centro acertava o `<body>` em vez do botão.

Medido no browser, com o ecrã aberto:

```
ecraJogosTemInert   true     <-- o culpado
painelTemInert      false    <-- e devia ser este
pontoNoCentro       <BODY class="">
oPontoEoBotao       false
```

O modelo estava a três linhas de distância, no `showMenu()`:

```javascript
$('app').inert = true;        // a APLICAÇÃO de baixo, não o menu
```

**Um ecrã `aria-modal` tem de ser interativo** — é ele que tem os botões.
O que não entra na tabulação é o que está **por baixo**.

> **`inert` nunca em si. `inert` no que está por baixo de um modal.**

E o que o torna instrutivo é que **não dá erro nenhum**: os ids existem
todos, o ecrã tem tamanho, o HTML fecha bem, e os 33 grupos da suite
passam. Um `inert` no sítio errado é invisível para tudo o que não abrir o
browser e clicar. E a correção anterior — ligar o botão do cabeçalho — era
necessária e não chegava, porque eu não tinha medido nada.

**O que se confirmou, no browser, ponta a ponta:** o clique no centro do
cartão de jogo chega ao cartão; o botão do ecrã de espera, a 139×44, é
alcançado; escolhendo um jogo, o cartão guarda `acjogo` e o menu de vista
abre; escolhendo a vista, o painel aparece e a espera volta com o botão.

### O teste

A regra é verificável **sem browser**, e essa é a parte que importa: o
`aria-modal` está no HTML, o `inert` está no JS, e a regra é *nunca os dois
no mesmo elemento*. Não prova que o clique chega — para isso é o browser
— mas apanha a confusão exacta que fez o bug, e deixa-a escrita.

E o `mutacao_html.py` confirma que a regra morde, em quatro mutações, cada
uma pela **razão certa**:

```
o `</div>` da .boot-box desaparece   -> nenhuma etiqueta fecha fora de sitio
o botao do ecra de espera e apagado  -> os 50 ids que o JS pede existem todos
o botao sai de dentro do ecra       -> nenhuma etiqueta fecha fora de sitio
o ecra de escolha fica inert        -> `#jogos` e modal e nao pode ficar inert
```

A última linha importa mais do que parece. **Na primeira versão as quatro
mutações passavam, e a quarta era detectada pela razão errada** — acusava
uma etiqueta em vez do `inert`, porque as mutações se acumulavam e a
terceira tinha deixado o HTML partido. Por isso o script restaura antes
de cada mutação, e imprime a acusação de cada uma: um teste que falha
pelo motivo errado não prova nada, e é pior do que um que falha pelo
certo, porque dá a sensação de que a regra pega quando quem a escreveu
não sabe o que ela apanha.


---

## Regra nº 30 — quando os dois jogos divergem, o F1 25 manda

**O F1 25 é o jogo mais relevante, e o AC acompanha-o.**

Quando os dois jogos divergem numa escolha de apresentação — como se
expressa uma percentagem, que unidade se mostra, que lado de uma barra é
o "bom" — **a convenção do F1 25 passa a ser a do painel inteiro, e o AC
muda para ela.** Não fica "cada jogo à sua maneira", e não fica "o AC fica
como estava".

O exemplo dado por quem decide: em vez de dizer **12 % restante de pneu**,
diz-se **88 % de pneu usado**. E os 88 % são para todos, F1 25 e AC.

### Porquê, e o que muda na prática

O painel tem **dois** jogos e **um** utilizador. Um painel que mostra
"12 % restante" no AC e "88 % usado" no F1 25 obriga a traduzir de cabeça
de um para o outro, e quem salta entre os dois é a mesma pessoa.

E o risco aqui é o inverso do habitual: os dois números são verdadeiros, é
a **leitura** que muda. E a leitura que muda é a que se adivinha. Quem lê
"12 %" num pneu e entende "quase estragado" lê "88 %" no mesmo pneu e
entende "quase novo". **O mesmo facto, duas opiniões, e uma delas está
errada.**

> **O número que representa uma quantidade wears-se do lado que quem vende
> usa.** Ninguém põe "resta 12 %" numa peça; põe "88 % usado". E o F1 25 é
> o que o jogador vê no MFD, vinte vezes por volta.

### O que NÃO muda

A regra é sobre **apresentação**, e não sobre **medida**:

- a **unidade** continua a ser a que o jogo manda — litros no AC, quilos
  no F1 25 (Regra nº 24);
- a **tradução** continua a ser feita na fronteira, pelo módulo do jogo
  (Regra nº 22);
- e o **campo** que se lê não muda por isto. O `tyreWear` do AC não é
  desgaste: é aderência, e a Regra nº 18 mediu porquê — desce 0,45 % por
  volta, e um pneu que durasse 220 voltas não é um pneu. Se o painel
  passar a dizer "usado", tem de estar a dizer o desgaste **medido**, e não
  a mesma grandeza com o nome trocado.

Ou seja: **a regra diz como se escreve, não o que se mede.** Mudar o que se
mede é uma medição, e fica à espera de ela ser feita.

Isto é a Regra nº 19 pelo avesso, e é por isso que a frase "88 % usado" não
se aplica a tudo: aplicá-la a um valor que é aderência produziria um número
plausível e errado, que é o pior resultado possível porque ninguém o
questiona.

### Onde isto está escrito, e porque em tantos sítios

| ficheiro | porque a regra aparece lá |
|---|---|
| `AGENTS.md`, esta regra | é a lei, e é a única com o porquê |

**E não é uma preferência de estilo: há uma medição que a prova.** O
`m_tyresWear` do F1 25 e o `tyreWear` do AC chamam-se igual e significam
o contrário, e o painel tratava os dois como se fossem a mesma coisa --
e pintava a vermelho os pneus **novos** do F1 25, a dizer que tinham
pouca pegadela. A medicao inteira, com a conta que a torna aritmeticamente
impossível ler ao contrário, está em
[`docs/medicao-desgaste-f125.md`](docs/medicao-desgaste-f125.md).

| `docs/f1-25.md` | quem mexer no módulo do F1 25 lê esse ficheiro, e não este |
| `docs/assetto-corsa.md` | **é o AC que muda**, e quem mexe no AC tem de saber |
| `README.md` | a tabela "o que muda entre os dois jogos" fica incompleta sem isto |
| `.opencode/skill/jogos-e-capacidades/SKILL.md` | a regra entra no procedimento, não só na lei |

### O que um teste não pode verificar

Um teste não verifica uma convenção de linguagem. O que um teste **pode**
verificar é que os dois jogos **dizem a mesma coisa**, e é isso que
`tests/test_jogos.js` faz com as capacidades: quando um jogo acrescenta um
campo, os dois têm de o ter.

E o que esta Regra **proíbe** é o pior silêncio do projecto: cada módulo
escolher a sua convenção e ninguém comparar. A escolha passa a ser uma, e
fica escrita num sítio só.

---


## Ao mexer no frontend

**A regra que decide onde vai uma linha nova:** se é verdade nos dois
jogos, vai para `static/nucleo/`. Se é verdade só num, vai para o módulo
 desse jogo. Se é sobre ids, cores, canvas ou idiomas, vai para o
`app.js`. **Uma regra de jogo no `app.js` está no sítio errado**, e o
preço é não se poder testar sem o jogo a correr.

Ao acrescentar um campo que só um dos jogos tem:

1. escreve-o no `snapshot()` desse jogo (`actelemetry/jogos/*/…`);
2. declara a capacidade em **três** sítios, ou o painel esconde mal:
   `jogos/base.py` (o que o jogo publica), `jogos/<id>.js` (o que o
   painel pinta) e o `data-cap` no `index.html`, se houver um elemento
   para esconder;
3. corre `python tests\test_f125_parser.py` e `node tests\test_jogos.js`
   — o primeiro confere o servidor, o segundo o browser, e cada um
   acusa uma lista de capacidades incompleta.

O resto do que se sabe:

- Recarregar a página **não** apaga o mapa: está no `localStorage`
  (chave `acmap.v3`, no plano X-Z). Para limpar de propósito, usar o botão
  **limpar**.
- Ao mudar de pista o mapa é invalidado automaticamente.
- O `acshm.py` expõe `x`, `y` (altitude) e `z`. O plano da pista é X-Z;
  um mapa feito com X e Y parece uma pista e não é. **O F1 25 é igual**:
  o `m_worldPositionY` é a altitude, e a pista está no plano X-Z.
- Se mudar o layout, verificar nos três tamanhos: ecrã largo (3×2),
  tablet (2 colunas) e telemóvel (1 coluna).
- **O `I18N` não pode ter comentários dentro.** O `auditar_frontend.py`
  faz `eval` do literal em Python para contar as chaves, e um comentário
  em JavaScript não é Python. Bastou um `/* */` para o teste parar de
  avaliar o I18N inteiro e dizer "não consegui avaliar o I18N" — uma
  mensagem que não aponta para a causa.
- As chaves de tradução dos dois jogos estão nos **quatro** idiomas, e
  não é vaidade: o auditor acusa uma chave num idioma e não nos outros.

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
estiver a correr e os testes de memoria forem saltados. Sao 34 grupos.

| Ficheiro | O que prova |
|---|---|
| `test_layout.py` | os 3 structs, campo a campo (60 + 30 + 42) |
| `test_acshm.py` | a leitura de telemetria, 46 valores com unidades |
| `mutacao_grip.py` | que a regra da aderencia morde, partindo o codigo |
| `test_opponents.py` | o struct de 128 carros: ordem dos campos, m/s para km/h, tempos, filtro de carros vazios |
| `test_f125_parser.py` | o F1 25 nos DOIS formatos: os 33 tamanhos, a ordem das rodas, o truque dos minutos, o /1000 das forcas G, e o formato desconhecido recusado |
| `compilar.py` | que os `.py` compilam -- apanha erro de sintaxe |
| `verificar_js.py` | que os 20 `.js` fazem parse no node |
| `test_contrato.py` | que a app e o leitor falam a mesma linguagem |
| `test_handler.py` | que um cliente que cancela nao enche a consola |
| `verificar_servidor.py` | o SISTEMA ligado: arranca com os dois jogos, a troca a quente, e as rotas |
| `test_payload.py` | que o `/api/state` tem o que o painel precisa, clima incluido -- o meio da ligacao |
| `test_tempos.js` | 35 casos de tempos e delta, sem browser (node) |
| `test_tyres.js` | a vida do pneu e a escala dos valores (node) |
| `test_combustivel.js` | voltas de combustivel e a percentagem (node) |
| `test_ers.js` | o ERS: percentagem quando ha' maximo, JOULES quando nao ha', e nunca 0% com bateria dentro -- que era o que o F1 25 mostrava, com 1 105 744 J (node) |
| `test_jogos.js` | as regras dos dois jogos no browser: embraiagem, ABS, vida do pneu, combustivel, clima, delta e as 81 capacidades -- sem nenhum jogo a correr (node) |
| `auditar_frontend.py` | o frontend inteiro: ids, traduccoes, contraste, chaves CSS, movimento reduzido |
| `verificar_html.py` | que o HTML fecha, que cada ecra e' filho do <body> e nao de outro ecra, que o ecra de espera tem saida, e que um ecra `aria-modal` nunca e' posto a `inert` -- o que se ve mas nao se clica, e nao da' erro nenhum |
| `mutacao_html.py` | que essas verificacoes mordem, cada uma pela RAZAO certa: um `</div>` comido, o botao da espera apagado, o botao fora do ecra, e o ecra de escolha posto a `inert` |
| `mutacao_acessibilidade.py` | que a regra 2.3.3 morde, partindo o CSS |
| `mutacao_rodape.py` | que o rodape' nao fica a dizer o jogo errado |
| `verificar_finitos.py` | que nenhum valor chega a NaN ou infinito |
| `test_mutation.py` | que os testes de cima falham quando o codigo esta partido |
| `mutacao_contrato.py` | que o contrato entre a app e o leitor e' mesmo verificado |
| `test_loop_app.py` | que o loop da app nao engole uma excepcao |
| `mutacao_loop.py` | que esse teste morde, partindo o loop |
| `test_tempo.js` | 104 casos de clima, com os limiares das 37 cenas do Pure Planner e o eixo do vento (node) |
| `test_defs.js` | o esquema das definicoes: so' entra o que esta' declarado, e a reposicao mantem a vista e o idioma (node) |
| `test_medir_tyrewear.py` | que a medicao do desgaste por volta faz sentido |
| `verificar_readme.py` | que cada facto do README bate certo com o codigo -- versao, porta, cadencia, nomes, escalas |
| `verificar_texto.py` | que nao entrou texto torto nem caracteres estranhos |
| `mutacao_texto.py` | que a regra do TAB dentro de uma palavra morde, partindo o AGENTS.md |
| `verificar_commits.py` | que as mensagens de commit nao tem BOM nem caracteres estranhos |
| `test_scripts.js` | que os scripts que o index.html lista chegam ao browser, e que cada global lido sem guarda e' escrito -- sem browser, e sem executar nada (node) |

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
| `medir_bandeira.py` | ONDE ESTA A BANDEIRA DE PISTA DO F1 25, E PROVA QUE A POSICAO E' A CERTA. O painel mostra a bandeira do PROPRIO CARRO (`vehicleFIAFlags`) e nao a de pista, que vive no bitfield `vehicleFlags` -- e esse nao esta' no struct. Acrescentar um campo ao offset errado desloca tudo o que vem a seguir, sem erro nenhum (Regra no 19), e por isso este mede em vez de adivinhar. Precisa do jogo a conduzir |
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

A parte testável está em `static/nucleo/tempos.js`, **sem DOM e sem estado
global** — é por isso que dá para a correr no node. O `app.js` fica só
com o estado (`S`) e delega. Se acrescentar lógica de tempos, pô-la
aí, não no `app.js`.

`deltaParaRef` devolve `null` de propósito quando não há referência, ou
quando o carro está fora do percurso da referência. `null` é diferente
de zero: `null` quer dizer «não sei» e pinta-se neutro, `0.000` quer
dizer «estás exactamente na referência».

Perto de zero (menos de 50 ms) o número fica **sem cor**, para não
piscar a vermelho quando se está a andar na linha.
