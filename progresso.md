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

### Em curso

- [ ] `acshm.py`: `Opponents` pronto
- [x] `server.py`: canal de adversários pronto
- [ ] `static/index.html`: nova estrutura e menu escritos
- [ ] `static/style.css`: por reescrever
- [ ] `static/app.js`: por reescrever (gráfico de pedais, luz de DRS,
      modos, idiomas, definições, FPS)

Branch: `feat/interface-nova-e-modo-liderboard`

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
