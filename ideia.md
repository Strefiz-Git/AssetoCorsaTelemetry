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

## Perguntas em aberto

- **A app Python do SimHub está a correr?** A página
  `acpmf_simhub_v2` não aparecia, mas o AC fechou-se entretanto, por isso
  a hipótese de que a app morre ao arrancar **não está confirmada**.
  Falta arrancar o jogo e voltar a verificar.
- **A zona de DRS no mapa fica registada entre recarregamentos?** Está no
  `localStorage` junto com o traçado, mas ainda não foi testado.
- **Mudar o FPS no servidor obriga a reabrir a ligação?** Se sim, é
  aceitável — muda-se uma vez e fica.
- **O delta sobrevive a recarregar a página?** A referência da melhor
  volta vive em memória JavaScript, portanto **não**. Vale a pena
  guardá-la.

---

## Ficheiros

| | |
|---|---|
| [README.md](README.md) | como instalar e usar |
| [AGENTS.md](AGENTS.md) | armadilhas — **ler antes de mexer** |
| [progresso.md](progresso.md) | o que foi feito e o que se aprendeu |
| [LICENSE](LICENSE) | MIT |
