# Progresso

Registo das alterações, do que foi feito e do que se aprendeu pelo caminho.
Serve para não se perder e para não repetir erros.

**Estado actual:** funcional, a correr a 60 fps, sem SimHub.

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
| Luz de DRS | `avail` pisca a 1 s, `open` sólida com brilho, `off` apagada — confirmado pelo estilo computado |
| Leaderboard | 19 carros, jogador assinalado |
| Unidades | °C/°F e km/h/mph a converter nos valores e nos rótulos |
| Idiomas | pt-PT, pt-BR, es, en |
| Mapa | forma da pista correcta, zona de DRS pintada, sectores marcados |

### Com o AC desligado: a suite de testes a sério

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

## A correção mais importante: o mapa estava no plano errado

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
