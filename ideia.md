# Ideia

O conceito por trás do projecto, os princípios e para onde pode crescer.

---

## A ideia em uma frase

**Ler a telemetria do Assetto Corsa directamente da memória do jogo e
mostrá-la no browser a 60 fps, sem depender do SimHub.**

---

## O problema

O SimHub é bom e faz muito. Mas na versão gratuita serve o dashboard no
browser a **10 fps** — sensível numa curva rápida. Pagar a licença
resolve, mas nem toda a gente quer.

E há um segundo problema, mais de fundo: o SimHub é um intermediário.
Plugins têm de adivinhar escalas e compensar lacunas. Já foi assim com o
`ERSPercent`, que o plugin do AC nunca escreve e que por isso aparecia
com valores ao contrário.

Lendo a memória partilhada directamente:

- **Não há limite de fps.** O limite é o browser.
- **Não há camadas de tradução.** O que o carro tem, temos.
- **Não há licença, plugin nem versão do SimHub a acompanhar.**

---

## Princípios

**1. Ler, nunca escrever.**
O AC escreve nas suas páginas de memória. Nós só lemos. Escrever em testes
já corrompeu uma sessão em curso.

**2. O jogo é a fonte da verdade.**
Cada valor é verificado contra o AC em execução. Nada de supor escalas a
partir da documentação — o `tyreWear` é 0..100 e não 0..1, e isso só se
descobre olhando.

**3. Sem dependências.**
Só a biblioteca standard do Python. Sem `pip install`, sem `node_modules`.

**4. Simplicidade à frente degénio.**
Sem framework no frontend, sem WebSocket, sem base de dados. Um `<canvas>`,
`EventSource` e um ficheiro de CSS.

**5. Deve correr em qualquer ecrã.**
No monitor do simulador, num telemóvel no suporte, num tablet.

**6. Ler de relance, ou não serve.**
Quem conduz não lê: olha de relance, durante meio segundo. Este princípio
manda em toda a interface.

---

## A interface

### O que estava mal na primeira versão

Foi feita por temas: um painel por assunto, etiquetas de 8 px, números
de 26 px. Mucha informação, pouca legibilidade:

- Os chips de estado (DRS, ERS, ABS, TC, PIT) tinham etiquetas de 8 px —
  ilegíveis a 300 km/h
- O DRS era um chip minúsculo entre cinco iguais. **O sinal mais
  importante ficava perdido na grelha**
- Os pedais eram duas barras finas: informação importante, pouco espaço
- Muito espaço morto nos cartões de tempos e de travões
- O mapa era pequeno para a importância que tem
- Não se via quando o DRS ficava disponível

### A regra que rege a interface nova

Ordenar por **prioridade de leitura**, não por tema:

| # | O quê | Porquê |
|---|---|---|
| 1 | **Velocidade** | o número que se procura a cada segundo |
| 2 | **Caixa** | lê-se mais depressa que qualquer número |
| 3 | **Barra de rpm** com zona vermelha | aviso de mudança de caixa |
| 4 | **Luz de DRS** | tem de se ver sem procurar |
| 5 | **Penalidade e bandeira** | têm de gritar quando existem |
| 6 | **ERS** | orçamento de deployment |
| 7 | **Tempos e delta** | a cada entrada de curva |
| 8 | **Pedais** | sentir o carro |
| 9 | **Pneus e travões** | entre paragens |
| 10 | **Combustível** | estratégico |
| 11 | **Mapa** | orientação |

### As decisões

**A luz de DRS é a coisa mais grande do cabeçalho, e não um chip.**

- **Pisca a verde** quando o DRS está disponível e ainda não foi aberto
- **Verde sólido e a brilhar** quando está aberto
- **Apagada** quando não há zona

Piscar é o sinal certo, porque é o mesmo sinal que os carros reais dão
no volante. Uma cor sólida leria-se uma vez e depois seria ignorada; o
piscar continua a chamar a atenção em visão periférica.

**A zona de DRS aparece no mapa.** O `drsAvailable` liga e desliga ao
longo da pista, por isso o mapa guarda em que troços o DRS estava
disponível e pinta-os a verde. Depois de uma volta já se sabe onde é a
zona, sem marcar à mão.

**Os pedais deixam de ser barras e passam a ser um gráfico.**

Osciloscópio a correr da direita para a esquerda, cerca de 6 segundos de
histórico, quatro traços:

| Traço | Cor | Razão da cor |
|---|---|---|
| Acelerador | verde `#23CF16` | o que empurra |
| Travão | vermelho `#FF0000` | perigo, o que trava |
| Embragagem | azul `#2B6CFF` | desliga do eixo do motor |
| Travão de mão | dourado `#FFD700` | nitido contra verde e vermelho |

Linhas de 2 px sobrepõem-se melhor do que áreas preenchidas, porque
áreas escondem-se umas às outras.

**O mapa ganha sectores e linha de meta.** A troca de sector é visível
(`currentSectorIndex`), o que permite marcar as fronteiras.

**Modo misto não é "os dois lado a lado".** Os dois painéis competem pelo
mesmo espaço, e o que se sacrifica é o mapa ou o gráfico de pedais.

---

## Os três modos

| Modo | Para quê |
|---|---|
| **Telemetria** | conduzir. Só dados. |
| **Leaderboard** | acompanhar a corrida: tabela grande mais uma faixa compacta do teu carro. |
| **Misto** | telemetria condensada à esquerda, leaderboard à direita. |

Escolha no menu à primeira entrada, guardada em `localStorage`, mudável
depois nas definições. O menu não volta a aparecer sozinho.

---

## Definições

| Definição | Valores | Porquê |
|---|---|---|
| **Vista** | telemetria / leaderboard / misto | muda o que se quer ver |
| **Temperatura** | Celsius / Fahrenheit | unidades-De-land nos Estados Unidos |
| **Velocidade** | km/h / mph | o mesmo |
| **Idioma** | pt-PT, pt-BR, es, en | o corre em todo o lado |
| **Mapa** | mostrar / esconder | num ecrã pequeno rouba espaço ao que importa |
| **FPS de envio** | 10 a 60 | 60 é bonito mas gasta bateria e rede; num telemóvel a 20 chega para conduzir |

A escolha de FPS é do **servidor**: menos difusão é menos trabalho e
menos bateria. O browser pede o valor e o servidorabranda a mandar.

---

## Como está construído

```
Assetto Corsa
   │  escreve a cada frame
   ▼
acpmf_physics   acpmf_graphics   acpmf_static
   │
   │  ctypes, só leitura
   ▼
server.py ── SSE telemetria a 60 Hz ──▶ browser
         └─ SSE adversários a 10 Hz ──▶
```

Os adversários vão num canal separado a 10 Hz: 128 carros a 60 Hz seriam
cerca de 25 KB por frame, e a 10 Hz chega perfeitamente para uma tabela.

---

## O que a memória do jogo dá

### Já a mostrar

velocidade · rpm · caixa · pedais (acelerador, travão, embragagem) ·
ABS · TC · pit limiter · DRS · ERS · temperaturas de pneu em 3 zonas ·
desgaste · pressão · temperatura dos travões · combustível · ar e pista ·
tempos de volta · delta · sectores · mapa com zona de DRS · bandeira ·
penalidade · posição · adversário (leaderboard)

### Disponível e por fazer

| Dado | Onde | Para que serve |
|---|---|---|
| `accG` | física | vector G |
| `wheelSlip` | física | quanto cada pneu patina |
| `wheelLoad` | física | carga transferida entre eixos |
| `suspensionTravel` | física | curso da suspensão, por canto |
| `camberRAD` | física | cambagem, para setup |
| `tyreContactPoint/Normal/Heading` | física | **o carro inteiro** — suspensão em 3D |
| `steerAngle` · `localVelocity` | física | predição de trajectória, replay |
| `carDamage[5]` | física | avarias por zona |
| `surfaceGrip` | gráficos | aderência, correlaciona com o delta |
| `idealLineOn` | gráficos | se a racing line está ligada |
| `windSpeed/Direction` | gráficos | vento |
| `numberOfTyresOut` | física | penalização por quatro rodas fora |
| `mandatoryPitDone` | gráficos | paragem obrigatória |
| `trackSPlineLength` | estática | comprimento da racing line |

### Fora do alcance da memória partilhada

| Queria | Situação |
|---|---|
| **Travão de mão** | **Não existe** na shared memory do AC. A documentação só tem `gas`, `brake` e `clutch`. Ver a nota abaixo. |
| **Telemetria do CSP** (mods) | só existe com o Content Manager instalado |
| **Setup ideal** | não é telemetria, é cálculo |

#### Nota sobre o travão de mão

Não há campo de travão de mão no AC. Há `clutch`, que existe e está a ser
usado, mas o travão de mão só é acessível pela API Python dentro do
jogo (`ac.getCarState(..., CS.Handbrake)` ou o botão) — ou seja, com uma
app a correr lá dentro, exactamente como a do SimHub.

Duas formas de o ter, por ordem de custo:

1. **Derivar** de `wheelAngularSpeed` traseiro: com o travão de mão as
   rodas traseiras travam, a velocidade angular cai a zero com o carro
   ainda em movimento. Funciona, mas também dispara com um sautane
   qualquer, por isso é heurístico e tem de ser rotulado como tal.
2. **Escrever a app Python** que preenche a página dos adversários, e
   mandar lá também o estado do travão de mão. Fica exacto.

Fica por decidir. Enquanto isso, o traço aparece mas vazio.

---

## Caminho

### Feito

- [x] Ler a memória partilhada do AC
- [x] Servir por SSE a 60 Hz
- [x] Testes de estrutura e de leitura
- [x] Deteção de pausa / jogo encerrado
- [x] Mapa persistente, com zona de DRS
- [x] Interface por prioridade de leitura
- [x] Luz de DRS que pisca
- [x] Gráfico de pedais
- [x] Três modos com menu inicial
- [x] Definições de unidades, idioma e FPS
- [x] Leitor de adversários

### A seguir

- [ ] Confirmar o travão de mão
- [ ] Confirmar a zona de DRS no mapa com uma volta completa
- [ ] Delta por setor
- [ ] Gráfico de G
- [ ] Derrapagem por pneu
- [ ] Exportar CSV
- [ ] Perfil por carro (GT vs F1)

### Mais longe

- [ ] Raven de loads
- [ ] Replay
- [ ] Sugestões de setup a partir da temperatura do núcleo do pneu
- [ ] Vista da suspensão em 3D
- [ ] Modo pit: Yokohama, undercut
- [ ] Discord / Telegram
- [ ] App nativa para ecrã sempre ligado

---

## Chuva: ainda não está provado que não exista

Importa ser preciso aqui. A conclusão "o AC não publica chuva" assenta
numa coisa que **eu escrevi**: a lista de campos do `acshm.py`. Se a
struct real for maior, há campos que existem e não estou a ler, e a
conclusão está errada sem eu dar por isso.

**Já se tentou responder pelo tamanho da página, e não dá.** A memória
partilhada é sempre alocada em páginas de 4 KB, por isso o SO aceita
mapear 4096 bytes mesmo que a struct tenha 296 — o resultado é 4096 para
as três páginas, qualquer que seja a struct. O padding está a zeros.
`tests/tamanho_real.py` ficou com esse resultado registado, para não se
tentar o caminho outra vez.

**O método que funciona é comparar antes e depois.** `tests/chuva.py`
despeja os 4 bytes de cada página — todos, não só os campos declarados, que
é precisamente o ponto — e compara duas capturas:

```
python tests\chuva.py antes      # tempo seco
# mudar o tempo no AC para chuva
python tests\chuva.py depois     # e comparar
```

Cada fase tira 40 amostras e fica só com os valores que não mudam de frame
a frame, para o que muda constantemente (velocidade, rpm) ficar de fora. O
que sobrar é o que o AC escreveu por causa do novo tempo.

**Estado: a fase "antes" já está capturada.** Falta arrancar uma sessão
com chuva e correr a fase "depois". Se nada mudar, a conclusão fecha-se
com prova. Se mudar alguma coisa, aparece o offset e o campo existe.

---

## Perguntas em aberto

- **`wheelSlip` chega a 177,5** numa roda. Não se sabe se é percentagem
  ou ângulo, e não é mostrado. Com 177% de derrapagem, ou a unidade não
  é percentagem ou o valor é um ângulo. Fica por investigar.
- **`carDamage` e `turbo` não são mostrados.** O primeiro parece
  interessante (dano é coisa que um piloto quer ver). O segundo é
  ambíguo. Nenhum dos dois foi mostrado porque não se sabe o que são.
- **O travão de mão.** Não existe na shared memory do AC. Falta decidir
  entre derivar das rodas traseiras (heurístico, pode falhar em curvas
  de baixa velocidade) ou escrever uma app Python no Content Manager que
  o publique. Está a ser mostrado como traço vazio, sem inventar valor.

## Clima: o que o AC dá e o que não dá

Procurado campo a campo nas três páginas com
`tests/clima.py`. O AC **não publica chuva nem estado do tempo** — não há
campo para isso. Publica o efeito:

| campo | o que é | medido |
|---|---|---|
| `airTemp` | temperatura do ar, °C | 18,9 |
| `roadTemp` | temperatura da pista, °C | 25,1 |
| `airDensity` | densidade do ar, kg/m³ | 1,2146 (1,225 ao nível do mar) |
| `windSpeed` | vento, km/h | 0,0 |
| `windDirection` | direção do vento | 0,0 |
| `surfaceGrip` | aderência da pista | 1,0 (seco) |

Por isso a interface mostra ar, pista, vento, densidade e aderência, e
**não mostra "chuva"** — não há nada para mostrar. A aderência é que diz
se a pista está molhada: 1,0 é seco, e desce com a água. A partir de
0,85 pinta-se a laranja, abaixo disso a vermelho. O número é sempre
visível; não se escreve "molhado" com base numa suposição.

Falta confirmar com uma sessão com chuva: não sei a que valor a
aderência desce, nem se o AC chega a simular vento.

## O pneu

O campo `tyreCompound` traz o nome completo, e nos carros de 2025 traz o
código entre parênteses: `"Pirelli P Zero 2025 C3 (C3)"`. Noutros
formatos é `"Slick Hard (H)"`.

A interface mostra o **código num badge dourado** ao lado do título, e o
nome completo por baixo. O código só aparece se estiver no nome: não se
adivinha uma sigla a partir de um nome. No AC base, onde o valor pode ser
`dry_compound`, o badge fica escondido em vez de inventar um código.

---

## Não são problemas (já esclarecidos)

- **O combustível não mexer dentro da volta.** Cheguei a registar isto
  como dúvida: 30,0 L constantes em 4502 amostras. **O consumo de
  combustível estava desligado no jogo** — é uma opção do AC, não um erro
  de leitura. Confirmado depois com o consumo ligado: desce a 0,22 L/min,
  com 90 valores distintos em 90 s, e a percentagem bate com os litros
  com menos de 0,06 pontos percentuais de erro (que é só arredondamento).
- **A delta mostrar −37 s no início.** Numa corrida com largada parada a
  volta 1 inclui a saída e fica muito mais lenta, por isso a delta
  aparecer muito negativa até essa volta ser batida. **Isto é o
  comportamento certo e é o que se quer.** A referência passa logo a ser
  a melhor volta, e a comparação deixa de ter sentido ao fim de uma
  volta. Não mexer.

## Observado, por explicar

- **O combustível salta para exactamente 70,00 L ao entrar na box.** Numa
  captura de 7201 amostras houve 3 subidas, e as 3 foram no mesmo
  instante em que `isInPit` passou a verdadeiro: 69,53 → 70,00, depois
  69,25 → 70,00, depois 69,52 → 70,00. O número redondo é que estranha —
  uma paragem não devia pôr o depósito a um valor fixo. A leitura está
  certa (desce a conduzir, e a percentagem bate com os litros); o que é
  estranho é o que o jogo faz. Fica a watchful, sem conclusão.
- **O sentido da embraiagem.** A documentação diz que `clutch` é a
  posição do pedal, 1 = totalmente premido. Mas a medir: parado o valor
  é ~0.1, e a 250 km/h é 1.0. Isso só faz sentido como **engate**
  (1 = encaixada). Mostro o inverso, para se ler "quanto está solta",
  que é o que interessa para pontas de embraiagem. Continua por
  confirmar: falta uma leitura com a embraiagem a meio, a fazer uma
  arrancada, e um valor que fique a meio caminho.
- **O delta sobrevive a recarregar a página?** Não — a referência da
  melhor volta vive só em memória JavaScript. Vale a pena guardá-la no
  `localStorage` junto com o mapa.
- **O delta no modo leaderboard** só faz sentido contra a melhor volta
  do jogador. Contra o melhor do mundo é outra coisa. Falta decidir.
- **A posição mostrada é a oficial ou a ao vivo?** A página traz as duas
  (`pos` e `livePos`). Na interface usa-se a oficial. Numa corrida em que
  se estivesse a recuperar posições, a ao vivo seria mais útil.
- **Pneus e travões com valores iguais nos quatro cantos** quando o
  carro está parado no fim da sessão. Por confirmar se é o jogo a
  replicar o valor ou se é a leitura a fazer isso.

## Resolvidas

- **Os adversários funcionam.** A app Python do SimHub escreve a página
  `acpmf_simhub_v2` e lê-se directamente — sem passar pela API dele nem
  pelo UDP. Duas correções ao que eu tinha dito antes:
  1. Eu tinha dito que a app *"morre ao arrancar"*. **Não era verdade.**
     A página não existia porque o AC estava fechado. Com o jogo a
     correr vêm 19 carros com nome, carro, posição, voltas, tempos,
     penalizações, coordenadas e estado de box.
  2. A zona de DRS no mapa **vê-se** e está desenhada a verde.
- **A zona de DRS no mapa fica registada entre recarregamentos?** Sim, vai
  no `localStorage` com o traçado, e sobreviveu a recarregamentos.
- **Mudar o FPS obriga a reabrir a ligação?** Sim. O servidor lê
  `?fps=N` por cliente e trava entre 5 e 60. Mudar-se uma vez e fica.
  **Medido:** a 10 fps chegam exactamente 10 pacotes por segundo.
- **O plano da pista.** Era a maior dúvida e estava errada: o mapa
  desenhava X contra Y, e o **Y é a altitude**. O plano é **X-Z**.
  Ver [AGENTS.md](AGENTS.md).
- **A zona de DRS no mapa é pintada sozinha, depois de o jogo provar que
  o campo serve.** A ideia inicial era pintar com o `drsAvailable`.
  Medido num RB21 em Suzuka, o flag esteve a 1 em 98.9% do traçado, por
  igual nos cinco quintos: parecia não servir para nada, e passou a
  marcar-se à mão.

  Depois, num Ferrari SF25 em Interlagos, o mesmo flag esteve a 1 em
  18.5% da volta, em duas zonas contíguas e só a 262–312 km/h. Isso é
  uma zona de DRS como deve ser.

  **A primeira medição estava errada, ou era só daquele carro.** Não
  se decide sobre um flag com uma leitura de um carro só.

  Agora a interface mede uma volta inteira e só aceita o flag se ele
  for uma minoria clara do traçado. Se aceitar, pinta e repinta o que já
  tinha gravado; se não, diz porquê e a marcação manual fica disponível.
  O veredito está visível nas definições.

---

## Vista do mapa: mapa inteiro ou relativa, com zoom — por fazer

O que o piloto pediu, e porque faz sentido.

**1. Um interruptor entre "pista inteira" e "vista relativa".**

| | o que se vê | para que serve |
|---|---|---|
| `inteira` | a pista completa, como agora | ver a zona toda, o traçado, a DRS || `relativa` | centrada no carro, com zoom | ver o que vem a seguir e onde se está |

**2. O zoom acompanha a velocidade.** Lento, amplia-se; rápido, afasta-se.
A velocidade sozinha faz a imagem oscilar a cada travagem, por isso o
valor tem de ser **amortecido**: ler a velocidade suavizada, não a
instantânea.

**3. As bolas um pouco maiores.** Com a pista inteira espremida em ~340 px
de ecrã, um círculo de 6 px é maior do que a própria linha da pista (2 px
na imagem, ainda mais fina depois de reduzida). O carro tapa a pista.

Isto não é um extra: é provavelmente a razão pela qual a posição parece
estar fora da pista (ver em baixo). Numa vista relativa com zoom, a linha
fica com vários píxeis e a posição deixa de ser ambígua.

## Em aberto — a posição do carro fora da pista, em Monza

**Resolvido, e a culpa foi minha.** O piloto.relatou que o ponto amarelo
não estava sobre a pista. Tinha razão: a distância mediana do trajecto à
linha desenhada era de **132 metros**.

A causa: eu tinha concluído, a partir de o `WIDTH` do `map.ini` bater ao
pixel com a largura do PNG, que a imagem tinha 1 píxel por metro — e
passei a não dividir por `SCALE_FACTOR`. Errado. O `WIDTH` está em
**píxeis da imagem**, não em metros; a extensão do mundo é
`WIDTH * SCALE_FACTOR` metros.

| fórmula | distância mediana à pista (Monza) |
|---|---|
| `(x + X_OFFSET) / SCALE_FACTOR` | **0 px** |
| `(x + X_OFFSET)` | 132 m |
| `(x + X_OFFSET) * SCALE_FACTOR` | fora da imagem |

Isto só apareceu numa pista com `SCALE_FACTOR` diferente de 1. Monza tem
1,4. Baku, onde a medição anterior foi feita, tem 1 — e com escala 1 as
duas leituras dão o mesmo número, ou seja, a medição não conseguia
discordar. Mesma armadilha da `drsAvailable` na Regra nº 11.

**Duas medições minhas erradas no mesmo assunto**, ambas a dar confiança a
mais:

- "a forma bate, IoU 49%" — verdade mas inútil: normalizar as duas nuvens
  pela sua própria caixa faz um traçado diagonal coincidir com um
  contorno. IoU depois de normalizar não mede alinhamento.
- "está dentro da caixa da pista" — medi que o ponto caía entre duas
  travessias da pista, mas essas travessias são **secções diferentes do
  mesmo circuito**, e o ponto estava no meio do enclosure.

A medição que serve é uma só: a **distância de cada ponto do trajecto ao
píxel claro mais próximo**, e a mediana dessa distribuição. Com 0 px está
certo; com 132 m está errado. Ver `tests\mapa.py analisa`.

---

## Em aberto — o desenho dos pedais e o transbordo do cartão dos pedais

**O transbordo é ANTERIOR, provado com o CSS antigo.** Medido nas cinco
larguras da zona de duas colunas (861–1240 px), com o `style.css` do
`HEAD` e com o actual, lado a lado:

| largura | CSS antigo | CSS actual |
|---|---|---|
| 1240 px | pedais 358 > 260 **transborda** | 358 > 260 **transborda** |
| 1100 px | pedais 349 > 260 **transborda** | 349 > 260 **transborda** |
| 1000 px | pedais 342 > 260 **transborda** | 342 > 260 **transborda** |
| 900 px | pedais 335 > 260 **transborda** | 335 > 260 **transborda** |
| 880 px | pedais 334 > 260 **transborda** | 334 > 260 **transborda** |

O cartão dos pneus está `ok` nos dois. Nada disto veio da vida do pneu.

**Porque acontece.** As linhas da grelha são `1.1fr 1fr 1fr` — dependem
das fracções, não do conteúdo dos cartões. Com a janela a 900 px de
altura sobram ~260 px para a linha do meio, e o cartão dos pedais
precisa de ~350: título 15 + gráfico 170 + volante 89 + teclas 38 +
enchimento 22.

**Já se tentou e não deu:** repartir a diferença nas fracções
(`1fr 1.28fr 1fr`) e encolher o gráfico para 132 px. Resolve o dos pedais
por pouco, mas faz o cartão dos pneus transbordar (243 > 234 a 1240 px) —
troca-se um problema por outro. revertedido.

**As saídas que fazem sentido, por ordem de custo:**

1. A zona de duas colunas é que não cabe. A 861–1240 px o painel tem
   3 linhas; abaixo de ~1000 px de altura isso é impossible. A solução
   honesta é deixar a página rolar, como já acontece abaixo de 860 px.
2. Esconder a linha das teclas dos pedais nessa zona (poupa 38 px) e
   encolher o volante. Custa informação.
3. Passar a zona de duas colunas a ter duas linhas em vez de três.

Fica para decidir com o piloto, porque as três mexem no que se vê.

---

## Ficheiros

| | |
|---|---|
| [README.md](README.md) | como instalar e usar |
| [AGENTS.md](AGENTS.md) | armadilhas — **ler antes de mexer** |
| [progresso.md](progresso.md) | o que foi feito e o que se aprendeu |
| [LICENSE](LICENSE) | MIT |
