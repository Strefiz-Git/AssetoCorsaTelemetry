# Progresso

Registo das alterações, do que foi feito e do que se aprendeu pelo caminho.
Serve para não se perder e para não repetir erros.

**Estado actual:** funcional, a correr a 60 fps, sem SimHub. Dois jogos (Assetto Corsa e F1 25), escolhidos no ecra.

---

## 2026-09-26 — website próprio, sem SimHub

### Porque

O dashboard do SimHub gratuito vai a **10 fps** no browser. Passou a fazer
sentido ler a telemetria directamente do Assetto Corsa e saltá-lo.

### O que foi feito

| Ficheiro | |
|---|---|
| `acshm.py` | structs do AC + leitura das 3 páginas de memória partilhada |
| `server.py` | servidor HTTP + Server-Sent Events |
| `static/` | interface (HTML, CSS, JS) + fontes |
| `tests/` | testes e sondas de diagnóstico |

Fluxo: `AC → memória partilhada → Hub a 200 Hz → SSE a 60 Hz → canvas`.

### Dificuldades que apareceram

**1. O Python do AC não tem extensões C.** O `python33.zip` do jogo
contém `socket.py` e `threading.py` mas **zero** ficheiros `.pyd`, logo
`_socket.pyd` falta e `import socket` falha. Não há rede possível de
dentro do jogo. Daí a opção de correr o servidor **fora**, em Python
normal do Windows, a ler as páginas de memória partilhada.

**2. Escrevi na memória do jogo em execução.** O primeiro teste criou
páginas com os nomes reais `acpmf_*`. Como o SimHub as mantém mapeadas
mesmo com o jogo fechado, o `CreateFileMappingW` devolveu o objecto
existente e as escritas foram para dentro da sessão a correr. Sem erro,
apenas dados corrompidos. Corrigido com nomes fictícios (`ac_test_*`) e
uma guarda que aborta se detectar o jogo vivo.

**3. Estrutura 36 bytes curta.** A estrutura de referência do AC em
Python traz 9 campos comentados a meio de `SPageFilePhysics`
(`performanceMeter`, `engineBrake`, `ersRecoveryLevel`, `ersPowerLevel`,
`ersHeatCharging`, `ersIsCharging`, `kersCurrentKJ`, `drsAvailable`,
`drsEnabled`). Eles **existem** na memória. Sem eles, os travões davam
0 °C e as temperaturas interiores dos pneus davam 375 °C.

Descobristo porque os valores não faziam sentido — o teste
auto-consistente passava a 100 % mesmo com o erro. Só a leitura contra o
jogo real expôs o problema.

**4. Escalas contra-intuitivas.**

- `tyreWear` é **0..100** (100 = novo), não é fracção. Multiplicar por 100
  dava 9994 % de desgaste.
- `kersCharge` (ERS) é fracção `0..1`.
- Guardar os 9 campos_secretos deu acesso a `ersIsCharging`,
  `kersCurrentKJ` e aos flags inteiros `drsAvailable` / `drsEnabled`.

**5. "A página existe" não quer dizer "o jogo está a correr".** O SimHub
mantém as páginas mapeadas. Quem diz se há vida é o `packetId`. Mas em
pausa e no menu também para — por isso o site mostra o último estado
esbatido com "EM PAUSA" / "JOGO ENCERRADO" em vez de se esconder.

**6. ctypes em Windows, quatro armadilhas.** Handles de 64 bits truncados
sem protótipos; `MapViewOfFile` recebe `dwDesiredAccess` (`FILE_MAP_*`)
e não protecção de página (`PAGE_*`); `c_float` também tem `_type_`;
`c_float * 3 * 4` é 4×3 e não 3×4.

### O que ficou melhor do que o SimHub

- 60 fps em vez de 10
- Sem licença e sem plugin
- Mapa que desenha da posição real (`carCoordinates`), sem precisar de
  "aprender" durante voltas
- DRS/ERS com os flags inteiros do jogo, em vez de inferidos
- Temperatura dos pneus em 3 zonas (interior / meio / exterior)
- Delta calculado contra a melhor volta, por comparação de `trackPct`

---

## 2026-09-25 — dashboard do SimHub

### Contexto

Partiu-se de um guia (`Instalar_Dashboard_SimHub_AC.txt`) para fazer um
dashboard no SimHub. O ficheiro `.simhubdash` que o utilizador tinha era
um esboço: 4 widgets ligados, tempos de volta e pneus em texto fixo, e um
mapa que era só uma nota a dizer "adicionar via plugin".

### Verificação do guia

Antes de executar, o guia foi confrontado com a realidade:

| Afirmação do guia | Realidade |
|---|---|
| "Grid Dash" é um plugin gratuito do GitHub | É um **produto pago** ("a paid license unlocks the complete feature set"), servido como app web à parte em `localhost:8920`. Instalar o `GridDashSetup.exe` seria correr um instalador da net para uma versão limitada. |
| O AC "não envia a posição" | O AC **envia**. O log do SimHub mostra `AC UDP data connected` e a app Python do SimHub está instalada em `apps\python\SimHub`. É ela que envia a posição — por isso o mapa funciona. |
| Widget chamado "Track Map" | Não existe com esse nome. O tipo real é `GeneratedMapItem`. |
| Widgets separados para cada elemento | `TyreTemperatureText` (com `DisplayedTyre` 0-3), `CurrentLapTime`, `BestLapTime`, etc. |

**Conclusão:** o plugin pago não era necessário. Usou-se o widget nativo
do SimHub, que faz o mesmo auto-desenho.

### O que foi feito no dashboard

Completados os widgets em falta, com os tipos lidos de dashboards oficiais
instalados (`SimHub - Wheels Infos`, `SimHub - Live map`, `AudiConcept`,
`F3`) em vez de inventar nomes de propriedades:

- mapa (`GeneratedMapItem`), tempos de volta, 4 temperaturas de pneu
- delta, DRS, ERS, penalidade
- reorganização em 6 painéis (o original tinha o mapa sobreposto ao
  velocímetro)
- Titillium Web embebida em `_SHFonts`, com a licença OFL

### Erros meus no ficheiro

**O dashboard não abria.** Dois bugs de estrutura, ambos por não ter
verificado a ordem das chaves:

1. `$type` sem a vírgula: `...Models.RectangleItem SimHub.Plugins` em vez
   de `..., SimHub.Plugins`.
2. `$type` **tem de ser a primeira chave** do objecto. O SimHub (Newtonsoft)
   descobre a classe por ela; se não for, ele chega a `Height` sem saber o
   que está a deserializar e atira:
   `Could not create an instance of type IGDashItem ... Path 'Screens[0].Items[0].Childrens[0].Height'`.

A validação que fiz na altura só verificava JSON válido e tipos correctos
— não a **ordem**. Por isso é que passou.

**O ERS estava ao contrário** (mostrava 5 % gasto em vez de 95 %
disponível). Causa: `ERSPercent` **não é publicado** pelo plugin do AC
(`ACSharedMemory.dll` — zero ocorrências da cadeia), apesar de a propriedade
existir no `GameReaderCommon.dll` e aparecer na lista do SimHub. O plugin
publica `ERSStored` e `ERSMax`, a partir de `kersCharge` / `KersMaxJ`, logo
a percentagem é cálculo nosso: `stored / max * 100`.

**As letras não tinham ar de F1.** Pedia-se o peso `ExtraBold` (800), que
a Titillium Web **não tem** (vai de Light 300 a Black 900) — o SimHub caía
na fonte do sistema. Passou a usar só pesos com ficheiro: Light, Regular,
SemiBold, Bold, Black.

**`Fuel_LastLapConsumption` não existe.** Não aparecia em nenhum dashboard
instalado. Substituído por `Fuel_LitersPerLap` e `Fuel_RemainingLaps`,
confirmados.

### Estado

O dashboard do SimHub ficou funcional e continua instalado
(`DashTemplates\AC - Dashboard Principal`), mas o website substituiu-o
como forma principal de ver telemetria.

---

## 2026-09-26 (2.ª parte) — adversários, mão de obra e interface

### O que se descobriu

**1. O SimHub tem uma API JSON que não conhecíamos.** A página de debug
de leaderboard dele (`/Api/GetLeaderboarddata`, porta 8888) devolve
`SectorsCount`, `Opponents` e `BestSessionSplits`. Respondia HTTP 200 com
`Opponents: null`.

**2. Porque vinha vazio — e uma correcção importante.** First TRACE, o
`acpmf_simhub_v2` (a página que a app Python do SimHub preenche com os
128 carros) não existia, e a app *está* activa:

```
[SIMHUB] ACTIVE=1     em python.ini
SimHub Was Here!      em logs/py_log.txt
```

Concluí que a app morria ao arrancar em
`ac.getServerName().encode('utf-8')` quando devolve `None`.

**Isso não está confirmado.** O AC fechou-se entretanto, e sem o jogo a
corre a página `acpmf_simhub_v2` desaparece de qualquer maneira. Portanto
a explicação pode ser essa ou pode ser só "o jogo não estava a correr".
Fica por verificar com o jogo aberto. A hipótese continua plausível — há
mesmo um bug de escopo no código (`global sharedMem` mas a escrever num
`sharedmem` novo) — mas não é um facto.

Lição: afirmei uma causa antes de ter o dado que a sustenta.

**3. O travão de mão não existe na shared memory do AC.** A estrutura
documentada tem `gas`, `brake` e `clutch`. Não há campo de handbrake. Só
se acede a ele pela API Python dentro do jogo. Ver as opções em
[ideia.md](ideia.md).

### O que foi feito

**Leitor de adversários** (`Opponents` em `acshm.py`). Estrutura completa
dos 128 carros: piloto, modelo, posição, volta, tempos, posição no
mundo, pit. Vai num canal SSE separado a 10 Hz, porque 128 carros a 60 Hz
seriam ~25 KB por frame.

**Interface reconstruída** por prioridade de leitura, não por tema:

- A luz de DRS passou de chip de 8 px para o elemento mais grande do
  cabeçalho. **Pisca** a verde quando o DRS está disponível e não está
  aberto, fica sólida quando abre, apaga-se sem zona.
- A zona de DRS passa a ser pintada no mapa, a partir do `drsAvailable`.
- Os pedais passaram de duas barras a um osciloscópio com histórico de
  ~6 s e quatro traços (acelerador, travão, embragagem, travão de mão).
- Três modos: telemetria, leaderboard e misto, com menu na primeira
  entrada.
- Definições: Celsius/Fahrenheit, km/h/mph, idioma (pt-PT, pt-BR, es,
  en), mostrar/esconder mapa, e os fps a que o servidor envia.

**Unidades de ERS corrigidas.** `ersMaxJ` vem em joules (4 500 000 num F1
= 4,5 MJ) e `kersCurrentKJ` em kilojoules. O campo chamava-se
`ersMaxKJ`, o que anunciava kJ para um valor em J. Passou a `ersMaxJ` e
`ersMaxMJ`. A interface nunca usou o campo, por isso o erro estava
latente.

## 2026-09-26 (3.ª parte) — com o jogo a correr

### Em curso → concluído

- [x] `acshm.py`: `Opponents` pronto
- [x] `server.py`: canal de adversários a 10 Hz + fps por cliente
- [x] `static/index.html`: menu, três modos, definições
- [x] `static/style.css`: reescrito
- [x] `static/app.js`: reescrito
- [x] Testado com o jogo a correr, nos três modos

Branch: `feat/interface-nova-e-modo-liderboard`

### O que está verificado a correr

| | |
|---|---|
| 60 fps no modo telemetria | medido |
| FPS de envio 10 e 30 e 60 | medido: 60→60, 10→10 |
| Luz de DRS | `avail` pisca a 1 s, `open` sólida com brilho, `off` apagada — confirmado pelo estilo computado, e o `drsEnabled` confirmado em 735 amostras |
| Leaderboard | 19 carros, jogador assinalado |
| Unidades | °C/°F e km/h/mph a converter nos valores e nos rótulos |
| Idiomas | pt-PT, pt-BR, es, en |
| Mapa | forma da pista correcta, sectores marcados |
| Zona de DRS | pintada sozinha depois de o jogo a confirmar que o campo é zona (26% do traçado, duas zonas) |
| Layout | 3 modos × 13 larguras, 39 combinações, zero problemas |
| Pressões em psi | 28,7–32,3 num F1; kPa seria menos que a pressão atmosférica |
| Embraiagem = engate | 21 mergulhos, 21 mudanças de caixa, 100% |
| ABS/TC = nível | constantes em 4502 amostras, logo são ajuste e não actividade |
| Clima | ar, pista, vento e densidade lidos da memória; medido 18,9 °C, 25,1 °C, 0 km/h, 1,2146 kg/m³ |
| Pneu | código extraído do nome: "Slick Hard (H)" → badge **H**; "Pirelli P Zero 2025 C3 (C3)" → **C3** |

### Com o AC desligado: a suite de testes

O `test_acshm.py` nunca tinha corrido — abortava sempre com "o AC está a
correr". Com o jogo fechado, correu: **46/46 valores**. E abriram-se
duas lacunas que só se vêem com tempo.

### O struct dos adversários nunca foi testado

O `acpmf_simhub_v2` (128 carros) tinha uma leitura a funcionar, mas zero
testes. Para o testar com segurança faltava uma coisa: o `Opponents` tinha
o nome da página fixo no código, e **essa página é mantida mapeada pelo
SimHub mesmo com o jogo fechado** — criar uma com o nome real devolveria
o objeto já existente e as escritas do teste iriam parar a uma sessão
real. Passou a aceitar um `name`, como o `ACTelemetry` já fazia.

Resultado: `acsVehicleInfo` tem 228 bytes, a página 30252, e o filtro de
carros sem nome funciona (um carro que sai da sessão não fica na lista).

### Um `.pyc` envenenado quase me fez «consertar» código que estava certo

Escrevi um teste que parte o código de propósito, para confirmar que o
teste o apanha. Na primeira mutação troquei `'y'` por `'z'` nas
coordenadas — e o teste passou a acusar `y` a devolver o valor de `z`.

Isto parecia o bug do plano do mapa ressuscitado. Não era. O `acshm.py`
no disco estava correcto e o `git diff` estava limpo. O que acontecia:

O Python valida o bytecode de `__pycache__` pelo par **(data de
modificação, em segundos, + tamanho do ficheiro)**. Uma mutação
`.y` → `.z` mantém o tamanho, e restaurar o ficheiro original logo a
seguir cai no mesmo segundo. Portanto o Python reutilizou o `.pyc`
compilado da versão **partida**, e passou a executar código que já não
existia em lado nenhum.

Só se descobriu porque o teste foi lido de perto: todos os acessos
directos ao campo davam o valor certo, e só o `snapshot()` dava o
errado. **Um `git status` limpo não prova que se está a executar o
código do disco.**

Corrigido: os testes correm com `PYTHONDONTWRITEBYTECODE=1` e a cache é
apagada antes de cada corrida. Está escrito na Regra nº 12.

### Os testes agora mordem

`tests/test_mutation.py` parte o código de oito maneiras e confirma que
o teste o apanha, todas as oito:

| mutação | apanhada |
|---|---|
| campo novo a meio | sim |
| campo novo no fim | sim |
| m/s esquecidos na conversão | sim |
| posição ao vivo trocada com a oficial | sim |
| filtro de carros vazios desligado | sim |
| `y` trocada por `z` | sim |
| tempo em ms lido como segundos | sim |
| box confundido com a lane do box | sim |

Um teste que nunca falha não prova nada — foi assim que a estrutura 36
bytes errada passou a 100% no início do projecto.

Vale a pena dizer: **a primeira versão deste teste dava dois falsos
positivos, ambos meus.** Esperava 224 bytes onde há 228 (contei mal os
campos) e esperava 3 carros onde há 4 (esqueci-me de que tinha criado
quatro). O struct estava certo nas duas vezes. Ficou a checar o tamanho
por dois lados: a soma dos campos *e* uma constante congelada — porque
a soma sozinha se recalcula a partir da própria lista e não apanha um
campo novo.

`python tests\run_all.py` corre tudo e diz o que passou.

---

## Examinar os dados com o jogo a correr

Com o AC ligado, capturei 4502 amostras do canal SSE (75 s, 60 Hz) e
analisei-as campo a campo, com `tests/capturar.py` e `tests/analisar.py`.
Quatro coisas saíram. Duas eram bugs meus.

### 1. ABS e TC não são on/off — são o nível de ajuste (bug meu)

Mostrava "ABS OFF" e "TC OFF" sempre que o valor era menor que 0,5. Mas
em 4502 amostras com travagens duras e aceleração a fundo, `abs` ficou
**sempre** em 0.13 e `tc` **sempre** em 0.08. Não variaram uma vez só.

Portanto não é "está a actuar": é o nível que o piloto tem ajustado na
garagem. Com 13% de ABS, dizer "OFF" é dizer ao piloto que não tem nada
quando tem 13%. Agora mostra a percentagem, com barra.

### 2. A referência da delta estava a ser truncada (bug meu, mais grave)

A volta de referência era um array com limite de 4000 pontos, e ao
passar do limite fazia-se `shift()` — deitava fora o ponto mais antigo.

Uma volta de 116 s a 60 Hz dá 6960 pontos. Com o limite em 4000, a
referência ficava a começar em **22,6% da pista**, a 49 s. O que dava:

- `computeDelta(0.02, 2)` devolvia `null` — **sem delta no primeiro quarto
  da pista**, sem erro nenhum;
- e logo na fronteira, um **degrau de −4,9 s**.

Corrigido com sub-amostragem em vez de descarte: quando a volta excede o
limite, fica um ponto em cada dois (`empilharPonto`, no `tempos.js`, com
13 testes novos). Custa metade da resolução e poupa o início da volta,
que é a parte que dá a escala.

Regra que sai daqui: **um buffer com limite tem de ser sub-amostrado,
nunca truncado a partir do início.** Numa lista ordenada pela percentagem
da pista, o início é o que interessa.

### 3. O drsAvailable afinal marca a zona — eu tinha concluído o contrário

Com um Ferrari SF25 em Interlagos, o `drsAvailable` esteve a 1 em
**18,5% da volta**, em **duas zonas contíguas** (0–30% e 85–100%), e só
a **262–312 km/h**, quase sempre em 8.ª ou 9.ª caixa. É uma zona de DRS
como deve ser.

Eu tinha medido antes num RB21 em Suzuka e concluído que o flag "não
marca a zona nenhuma" por estar ligado em 98.9% do traçado. **Essa
conclusão estava errada, ou era só daquele carro.**

A interface agora não confia no flag: mede uma volta inteira e só o
aceita se for uma minoria clara do traçado (2% a 60%). Aceitou com 26% e
repintou 1574 pontos retroativamente — e os 2086 pontos pintados são
exactamente os 2086 onde o flag original estava ligado. O veredito está
visível nas definições, e a marcação manual fica disponível.

### 4. Coisas que a medição resolveu

- **A embraiagem.** Houve 21 mergulhos de `clutchRaw` maiores que 0.25 em
  4502 amostras, e **os 21 coincidiram com uma mudança de caixa** (100%),
  a 96–203 km/h. Se o campo fosse a posição do pedal não teria relação
  com as mudanças. É o **engate**: 1 = encaixada. A inversão que já
  estava na interface está certa, e agora tem prova.
- **A pressão dos pneus é em psi.** 28,7 a 32,3 num F1. Se fossem kPa
  seriam 0,29 a 0,32 bar — **menos que a pressão atmosférica** (1 atm =
  101,3 kPa), impossível. Como psi dá 1,98 a 2,23 bar, que é o que um F1
  usa. A unidade não vem escrita em lado nenhum, por isso passou a
  aparecer no ecrã.
- **A regra das três zonas do pneu estava errada.** A AGENTS.md dizia
  "interior < meio < exterior". Medido: a roda **esquerda** tem sempre
  I<M<O e a **direita** tem sempre I>M>O — 4502 de 4502 em todos os
  quatro cantos, sem uma única amostra irregular. A regra só vale para
  metade dos pneus, e não serve para diagnosticar offsets.
- **Y é mesmo a altitude, noutra pista.** Em Interlagos: X 660 m,
  **Y 43 m**, Z 1038 m. Terceira pista a confirmar.
- **Nenhum valor fora do razoável** em 4502 amostras.

### 5. Um ficheiro de captura que vale a pena

`tests/capturar.py 75 captura.json` grava a série, e
`tests/analisar.py captura.json` responde às perguntas. Sem eles, cada
verificação é um pedido de `/api/state` que devolve um instante — e é
exatamente num instante que se tiram as conclusões erradas.

O que não percebi ainda, e está anotado em `ideia.md`: o `wheelSlip`
chega a 177.5 sem se saber a unidade, e `carDamage` e `turbo` não são
mostrados.

Duas coisas que pareciam bugs e **não são**, para não voltar a elas:

- **O combustível não mexia dentro da volta** (30,0 L constantes em duas
  voltas) porque o **consumo estava desligado no jogo**. Opção do AC, não
  erro de leitura. Confirmado depois: com o consumo ligado desce a
  0,22 L/min, com 90 valores distintos em 90 s, e a percentagem bate com
  os litros com menos de 0,06 pontos de erro, que é só arredondamento.
  Durante a confirmação apareceu uma coisa nova: **o depósito salta para
  exactamente 70,00 L ao entrar na box**, nas 3 vezes em que isso
  aconteceu em 7201 amostras. A leitura está certa; o que é estranho é o
  número redondo que o jogo escreve. Anotado em `ideia.md`, sem
  conclusão.
- **A delta a −37 s no início** porque a volta de referência foi a da
  largada parada, que é muito mais lenta. É o comportamento certo, e é o
  que se quer: a referência passa a ser a melhor volta e a comparação faz
  sentido ao fim de uma volta.

---

## Com o AC desligado: a suite de testes a sério

### A correção mais importante: o mapa estava no plano errado

O mapa desenhava um rabisco achatado. A causa:

**No AC, Y é a altitude.** O plano da pista é **X-Z**.

Medido com os 19 adversários: X 997 m, **Y 88 m**, Z 2012 m. E o
desnível de Spa é de ~100 m — logo aqueles 88 m são a altitude. A
primeira versão desenhava X contra Y, ou seja, distância contra altura.

Com X contra Z aparece a Eau Rouge, o Raidillon e a reta do Kemmel, e
dá para reconhecer Spa de imediato.

O `acshm.py` nem sequer expunha o `z` — só `x` e `y`.

### Erros meus nesta parte

**Erro de sinal no canvas.** Depois de corrigir o eixo, o mapa ficou
**completo de vazio** e sem erro nenhum na consola. A causa foi minha:
calculava o `offset` a partir do mínimo positivo e depois invertia o Z,
o que invalida o offset. Passou a transformar a partir do centro de
cada eixo.

**Dois sinais de brakes colados** — estava a injectar quatro `<b>` dentro
de um `<b>` que já era o elemento alvo, por isso aparecia
`291287254249`.

**Grelha do leaderboard com 5 colunas para 6 campos**, o que fazia o
"DIF." cair para a linha seguinte.

**Modo misto completamente desfeito** — dei à tabela de classificação
duas classes de área (`c-lbtel c-lb`) que se sobrepunham, e o cluster
transbordava do cartão.

**`NaN` no primeiro frame** — `undefined + 1`. Passou a haver guarda.

**A unidade de velocidade não mudava** — o rótulo era `"km/h"`
hardcoded no HTML, ligado ao idioma e não à definição de velocidade.

---

## 2026-09-28 — skills de organização e AGENTS.md

### Porque
O projecto cresceu com ficheiros enormes (`app.js` com mais de 3000
linhas) e sem regras escritas de como trabalhar nele. Faltavam skills que
mandassem partir o código em módulos e helpers reutilizáveis, e um
`AGENTS.md` que apontasse para o registo e para o commit automático.

### O que foi feito
| Ficheiro | |
|---|---|
| `.opencode/skill/codigo-modular/` | limites de tamanho, helpers em ficheiros próprios, funções puras, ficheiros grandes congelados |
| `.opencode/skill/sessao-de-trabalho/` | começar, procurar sem abrir ficheiros grandes, editar em Windows, a ordem do fecho |
| `.opencode/skill/progresso/` | como e quando escrever aqui |
| `.opencode/skill/testes/` | que teste correr, como registar um novo, como garantir que morde |
| `.opencode/skill/jogos-e-capacidades/` | campo novo, capacidade nos três sítios, jogo novo |
| `.opencode/skill/documentacao/` | onde vive cada informação, como nasce uma Regra |
| `.opencode/skill/git-workflow/` | ligado ao progresso e ao fecho; nota sobre o BOM nas mensagens |
| `AGENTS.md` | topo novo: skills, registo, índice das Regras por assunto; `static/tempos.js` passou a `static/nucleo/tempos.js` |

Nenhuma pasta nem ficheiro de código foi movido.

### Verificado
`verificar_texto`, `mutacao_texto`, `auditar_frontend`, `verificar_js` e os
cinco testes em node passam. `tabela_testes.py` deixa o `AGENTS.md`
idêntico. **Não verificado:** `run_all.py` completo e `verificar_readme.py`,
porque precisam de Windows (`ctypes.WinDLL`); o `verificar_readme.py` falha
da mesma forma no zip original.

## 2026-09-28 (2.ª parte) — F1 25, e o painel passa a ter dois jogos

### Porque

Pedido de acrescentar compatibilidade com o F1 25, com escolha de jogo
ao abrir o site, frontend separado **sem lógica**, módulos de lógica por
jogo, e a pasta melhor estruturada.

### O que foi feito

| Ficheiro | |
|---|---|
| `docs/f1-25.md` | a telemetria do F1 25: 17 packets, dois formatos, e as medições |
| `docs/assetto-corsa.md` | a do AC, ao mesmo nível, com o que **não** está resolvido |
| `actelemetry/` | o núcleo (hub, http, defs) que **não sabe qual é o jogo**, e `jogos/{ac,f125}/` |
| `static/nucleo/`, `static/jogos/` | matemática partilhada, e um módulo de regras por jogo |
| `static/index.html`, `app.js` | ecrã de escolha do jogo, e o `app.js` sem regras de jogo |
| `tests/` | `test_f125_parser.py`, `test_jogos.js`, `verificar_servidor.py`, `mutacao_texto.py` |

### Dificuldades

1. **O teste apanhou um bug de ordem nas rodas que não se via.** As
   temperaturas dos travões ficaram de fora da tradução — as outras três
   estavam feitas. Quatro números muito parecidos não denunciam nada.
   Está escrito como Regra nº 22.
2. **Um `getattr` perdeu as aspas** e o servidor dava 500 em
   `/api/capabilities`. **Não** se via nos testes: só com o servidor a
   arrancar. Saiu com o `verificar_servidor.py`.
3. **O import do `defs` no mapa do AC tinha um ponto a menos**, e o
   sintoma era um 500 em `/api/games` — três pastas longe da causa.
4. **`mutacao_loop.py` escrevia as mutações com LF e o ficheiro está em
   CRLF**, por isso a terceira mutação era saltada em qualquer checkout do
   Windows. Estava a passar sem provar nada.
5. **Um `\t` numa string Python partiu dois caminhos** no `AGENTS.md`
   (`tests<TAB>est_jogos.js`). O `verificar_texto.py` passou a apanhar
   isso, e o `mutacao_texto.py` confirma que a regra morde.

### Falta / não verificado
6. **O teste dos `.bat` bloqueava para sempre, e o `timeout` não
   chegava a disparar.** O `arrancar.ps1` lança o servidor com
   `Start-Process`, e o filho herda as duas pontas do pipe. O
   `communicate()` do Python fica à leitura até ver EOF, e o EOF só
   chega quando o servidor sai — que foi quando a sessão acaba. Com
   `capture_output` o teste não voltava. É `DEVNULL`, e a prova de
   que o servidor arrancou é o HTTP, não a saída do PowerShell.

- **O F1 25 nunca foi lido do jogo a correr.** Tudo o que está no
  `docs/f1-25.md` vem da especificação da EA e dos 33 tamanhos medidos
  com `ctypes`; a leitura real ainda não foi confirmada. É o mesmo
  buraco que a Regra nº 4 descreve, e só `verify_real.py` com o jogo
  aberto o fecha.
- A zona de DRS lida do Season Pack 2026 (a lista de zonas) não está
  desenhada no mapa: a capacidade está declarada, a pintura não.
- Os `.bat` e o `.ps1` já são testados: o `verificar_servidor.py` corre o
  `arrancar.ps1` com e sem `-Jogo`, e pergunta ao HTTP se o jogo ficou o
  certo. O que **não** se verificou é o browser: ninguém abriu a página
  para ver o ecrã de escolha a funcionar.

## 2026-09-28 (3.ª parte) — abrir o browser apanhou o que os testes nao apanhavam

### Porque

OUtilizador pediu para verificar tudo. A suite passava, e o browser nunca
tinha sido aberto. A regra do `AGENTS.md` e' a do `sessao-de-trabalho`: a
suite prova a logica, e o ecra' e' uma coisa diferente.

### O que foi feito

| Ficheiro | |
|---|---|
| `static/app.js`, `static/index.html` | o rodape' passa a dizer o transporte do jogo, e o titulo e o ecra' de espera deixam de nomear um jogo |
| `arrancar.ps1` | valida o jogo em 1 s, e a espera pela porta deixa de levar 69 s |
| `actelemetry/jogos/ac/mapa.py` | `/api/track-map-image` devolveva bytes e rebentava o handler |
| `tests/auditar_frontend.py` | duas verificacoes novas, e uma delas le' o registo de jogos |
| `tests/verificar_servidor.py` | §3b mete todas as rotas de todos os jogos por HTTP; §4c-1 mede o tempo |
| `tests/mutacao_rodape.py` | prova que as duas verificacoes novas mordem |

### Dificuldades

1. **O rodape' dizia duas coisas, uma certa e outra errada.** Com o F1 25
   escolhido, "F1 25" ao lado de "memoria do AC, sem SimHub". Sem erro na
   consola e sem teste a falhar -- a errada e' a que tem a forma de frase,
   e uma frase le-se sem reparar. Regra no 25.
2. **A imagem do mapa da pista nunca carregou.** A rota devolvia os bytes
   do PNG em vez do dicionario, o handler rebentava com
   `AttributeError: 'bytes' object has no attribute 'get'`, e o
   `socketserver` fechava a ligacao sem responder. Ninguem notou porque o
   mapa desenhado da sempre a pista certa. Regra no 26.
3. **O `Get-NetTCPConnection` leva 2,0 s numa porta sem nada.** O ciclo de
   30 tentativas do `arrancar.ps1` prometia 9 segundos e levava 69. Com um
   jogo escrito errado, a janela ficava um minuto em silencio. Regra no 27.
4. **O `Start-Process` com redireccionamento e' o que prende um `run` do
   Python**, porque o filho herda as duas pontas do pipe e o
   `communicate()` fica a ler ate o servidor sair. `DEVNULL` no teste, e
   o HTTP como prova de que arrancou.

### Falta / não verificado

- O F1 25 continua nunca lido do jogo a correr. E' o buraco da Regra no 4
  e so `verify_real.py` com o jogo aberto o fecha.
- O painel so' foi visto com o **AC** e com o **F1 25** sem ligacao. Nao ha
  telemetria real de nenhum dos dois no ecra'.
- A zona de DRS do Season Pack 2026 esta' declarada como capacidade e nao
  desenhada no mapa.


## 2026-09-28 (4. parte) - dois modulos nunca chegaram ao browser

O `feat/f125` reorganizou o `static/` em `nucleo/` e `jogos/`. Fez-lo
bem: os modulos de jogo ficaram puros e ha' agora 145 casos de regras a
correr sem nenhum jogo a correr. Mas a reorganizacao **esqueceu-se de um
`<script>`**, e foi preciso abrir o browser para dar com isso.

### O que se encontrou

| | Sintoma | Causa |
|---|---|---|
| o tempo | `TypeError` a cada pintura do campo do tempo | `nucleo/tempo.js` nao esta' na lista do HTML, e o `app.js` chama `Tempo.cenaDe()` sem guarda |
| a vida do pneu | "a medir" para sempre, sem dizer nada | `nucleo/tyres.js` publica `Pneus`, o `ac.js` le `global.Tyres` |

O primeiro rebenta. O segundo nao rebenta -- e por isso e' o pior, porque
um `--` que parece uma medida e' indistinguivel de um `--` que nao ha.

**Nenhum dos dois apanhou os testes.** E' o ponto: um modulo carregado
por `require` traz as dependencias que o FICHEIRO declara; um modulo
carregado por `<script>` so' tem as que o HTML LISTA. Sao worlds
diferentes, e o `test_jogos.js` vive no primeiro. Regra no 28.

### O que se fez

- O `tempo.js` voltou a lista de scripts, **antes** dos modulos dos jogos,
  e nao por ordem alfabetica: e' o `ac.js` que o le no topo do script
  (`const T = global.Tempo;`), e um modulo que carregue antes fica com o
  `T` capturado como `undefined` PARA SEMPRE.
- O `tyres.js` passou a publicar `Tyres`, que e' o nome dos outros tres
  (`tempo.js` -> `Tempo`, `combustivel.js` -> `Combustivel`,
  `jogo-base.js` -> `JogoBase`).
- `tests/test_scripts.js`, novo: confere **estaticamente** que cada
  script da lista existe, e que cada global lido sem guarda e' escrito
  por algum deles. Sem browser e sem executar nada.

### Dificuldades

1. **A correccao do `Pneus` para o `Tyres` rebentou o `test_jogos.js`.**
   `T_.vida is not a function`. A guarda que escondia o nome errado
   deixou de proteger, e apareceu um terceiro erro: a `vidaPneu` do
   `ac.js` foi escrita contra uma API que nao existe. O `nucleo/tyres.js`
   expoe
   `estimarPneus(estado, dados)` e devolve `voltasRestantes`; o `ac.js`
   pedia `vida(wear, sectors)` e esperava `{ voltas, pronto }`. Nomes
   diferentes nao dao o mesmo numero -- e o `estado` e' persistente
   entre voltas, coisa que um modulo puro nao pode ter.
   **Ficou a dizer que nao sabe**, que e' o que ja fazia, e a diferenca
   e' que agora e' verdade. A vida do pneu do AC esta' por ligar, e a
   decisao de onde vive o estado nao esta' tomada.
2. **O stripper de comentarios do teste novo tinha um erro de
   precedencia** e escondeu-o bem. Escrito sem parenteses,
   `if (!dentro && c === '"' || c === "'")` le-se como
   `(!dentro && c === '"') || (c === "'")`, e entao um apostrofo DENTRO de
   um comentario abria uma string, engolia o resto da linha, e o fecho do
   comentario deixava de contar. O comentario continuava "aberto" ate ao
   fim do ficheiro. Descobriu-o a mutacao: a falha apontava para uma
   linha de comentario em vez do `ac.js` que le o global a serio.
3. **A seccao que reporta os globais órfãos deu onze falsos positivos** --
   os ganchos que o `seletor.js` chama sob `if (global.X)`, que por isso
   nunca entravam na lista de leituras. Passou a ser relatorio e nao
   falha. Um teste que apita doze vezes quando ha' um problema e' um
   teste que se ignora, e um teste ignorado e' pior do que nenhum.

### Falta / não verificado

- **A vida do pneu do AC nao esta' ligada**, e agora sabe-se porquê. O
  `app.js` nao consome o `nucleo/tyres.js` em lado nenhum, e o `estado`
  que a estimativa precisa vive em lado nenhum. O F1 25 tem `m_lifeSpan`
  lido, e por isso o f125 mostra um numero que o AC nao mostra.
- **`MontarDefinicoesJogo` nao tem consumidor.** O `app.js` publica o
  gancho em 3403 e o `seletor.js` nunca o chama -- o `aplicar()` dele
  chama `AplicarIdioma`, `AplicarUnidades`, `RepintarTudo` e
  `AplicarJogoNaInterface`, e nao aquele. Trocar de jogo pelo selector
  pode nao reconstruir as definicoes do jogo. Nao foi verificado no
  browser.
- **`JogoBase`, `Combustivel` e `VOLTA_MINIMA_S` tambem nao tem
  consumidor** no browser. O `jogo-base.js` e' o contrato que cada modulo
  de jogo tem de cumprir, e nao esta' ligado a lado nenhum: e' a
  ferramenta que teria apanhado o `Tyres`/`Pneus`.
- O `feat/f125` nao foi fundido com o `definicoes`. A fusao de ensaio da
  conflito em `AGENTS.md`, `index.html` e `mutacao_loop.py`; o `app.js`
  funde sozinho e o bloco do `Defs.validar` sobrevive no sitio certo.


## Resumo do que se aprendeu

| Lição | Onde está registada |
|---|---|
| Nunca escrever na memória partilhada do jogo em teste | AGENTS.md, regra nº 1 |
| `packetId` é o único sinal de vida | AGENTS.md, regra nº 2 |
| A estrutura tem 9 campos que a documentação esconde | AGENTS.md, regra nº 3 |
| Um teste auto-consistente não valida o mundo real | AGENTS.md, regra nº 4 |
| Escalas verificadas, não supostas | AGENTS.md, regra nº 5 |
| ctypes: handles, FILE_MAP vs PAGE, arrays | AGENTS.md, regra nº 6 |

A lição maior: **quatro dos bugs mais caros apareceram por validar a
estrutura contra si própria em vez de contra dados reais.** A verificação
que falhou foi sempre a mesma — ausência de comparação com a fonte.
