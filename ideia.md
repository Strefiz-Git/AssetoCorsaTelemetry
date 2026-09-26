# Ideia

O conceito por trás do projecto, os princípios e para onde pode crescer.

---

## A ideia em uma frase

**Ler a telemetria do Assetto Corsa directamente da memória do jogo e
mostrá-la no browser a 60 fps, sem depender do SimHub.**

---

## O problema

O SimHub é bom e faz muito. Mas na versão gratuita serve o dashboard no
browser a **10 fps** — sensível numa curva rápida, e a aplicação de
telemetria mais rápida acaba por não o ser. Pagar a licença resolve, mas
nem toda a gente quer.

E há um segundo problema, mais de fundo: o SimHub é um intermediário. Para
ler dados que o jogo não expõe de forma padronizada, plugins têm de adivinhar
escalas e compensar lacunas. Já foi assim com o `ERSPercent`, que o plugin
do AC nunca escreve e que, por isso, aparecia com valores ao contrário.

Lendo a memória partilhada directamente:

- **Não há limite de fps.** O limite é do browser.
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
Funciona em 2026 e em 2030, num qualquer PC com Python.

**4. Simplicidade à frente degénio.**
Sem framework no frontend, sem WebSocket, sem base de dados. Um `<canvas>`,
`EventSource` e um ficheiro de CSS.

**5. Deve correr em qualquer ecrã.**
No monitor do simulador, num telemóvel no suporte, num tablet. A interface
adapta-se; os dados não mudam.

---

## Como está construído

```
Assetto Corsa
   │  escreve a cada frame (~300 Hz na física)
   ▼
acpmf_physics   acpmf_graphics   acpmf_static
   │
   │  ctypes, só leitura
   ▼
acshm.py → Hub (thread, 200 Hz)
   │
   │  Server-Sent Events, 60 Hz
   ▼
browser → <canvas> + DOM
```

O servidor lê mais depressa do que envia, para não perder frames. Cada
cliente recebe o seu stream; o telemóvel e o monitor podem estar ligados
ao mesmo tempo.

---

## O que a memória do jogo dá (e o que ainda não usamos)

Isto é o terreno disponível. Quase tudo já é[lido](progresso.md) ou é
fácil de acrescentar.

### Já a mostrar

velocidade · rpm · caixa · pedais · ABS · TC · pit limiter · DRS · ERS ·
temperaturas de pneu em 3 zonas · desgaste · pressão · temperatura dos
travões · combustível · ar e pista · tempos de volta · delta · mapa ·
bandeira · penalidade · posição

### Disponível e por fazer

| Dado | Onde | Para que serve |
|---|---|---|
| `accG` | física | vector G, num painel ou num gráfico |
| `wheelSlip` | física | quanto cada pneu está a patinar |
| `wheelLoad` | física | carga transferida entre eixos |
| `suspensionTravel` | física | curso da suspensão, por canto |
| `camberRAD` | física | cambagem, útil para setup |
| `tyreContactPoint/Normal/Heading` | física | **o carro inteiro** — dá para desenhar a suspensão em 3D |
| `localVelocity` · `steerAngle` | física | predição de trajectória, replay |
| `carDamage[5]` | física |avuarias por zona |
| `brakeBias` | física | distribuição de travagem |
| `surfaceGrip` | gráficos | aderência actual, correlaciona com o delta |
| `idealLineOn` | gráficos | se a racing line está ligada |
| `windSpeed/Direction` | gráficos | vento, para simuladores |
| `lastSectorTime` | gráficos | tempo do último setor |
| `numberOfTyresOut` | física | penalização por 4 rodas fora |
| `mandatoryPitDone` | gráficos | paragem obrigatória |
| `kersCurrentKJ` | física | ERS gasta nesta volta |
| `ersIsCharging` | física | a recuperar |
| `trackSPlineLength` | estática | comprimento da racing line |

### Fora do alcance da memória partilhada

| Queria | Porquê não está | Alternativa |
|---|---|---|
| **Posições dos adversários** | O AC não põe as coordenadas dos outros carros na memória partilhada. O SimHub resolve com uma app em Python dentro do jogo, que escreve numa página à parte (`acpmf_simhub_v2`) com os 128 carros. | Ler também essa página. É possível: é mais uma página de memória partilhada, e o AC já a escreve. **Próximo passo natural.** |
| **Telemetria do CSP** (mods) | Só existe com o Content Manager instalado. | Detectar e ler, se estiver presente. |
| **Setup ideal** | Não é telemetria, é cálculo. | Precompute, a partir de `tyreCoreTemperature` e `surfaceGrip`. |
| **Comportamento de pneus** | O AC não expõe o modelo. | Ajustar empiricamente a partir do desgaste medido. |

---

## Caminho

### Já feito

- [x] Ler a memória partilhada do AC
- [x] Servir por SSE a 60 Hz
- [x] Interface F1 responsiva
- [x] Mapa que se desenha da posição real
- [x] Delta contra a melhor volta
- [x] DRS, ERS, penalidade
- [x] Temperaturas de pneu em 3 zonas
- [x] Detecção de pausa / jogo encerrado
- [x] Testes de estrutura e de leitura
- [x] Mapa persistente

### A seguir

- [ ] **Adversários** — ler `acpmf_simhub_v2`, pôr todos os carros no mapa
      e mostrar gaps. É a falta mais visível.
- [ ] **Leaderboard** — posição de cada carro, volta atual e melhor
- [ ] **Setores** — os três tempos por setor e o delta por setor
- [ ] **Gráfico de G** — `accG` em tempo real
- [ ] **Derrapagem por pneu** — `wheelSlip` como quatro barras
- [ ] **Exportar CSV** — gravar a sessão para analisar depois
- [ ] **Perfil por carro** — guardar layouts diferentes para GT e F1

### Mais longe

- [ ] **Raven de loads** — a linha da traces
- [ ] **Replay** — guardar a posição e reproduzir
- [ ] **Sugestões de setup** — a partir da temperatura do núcleo do pneu
      e da aderência
- [ ] **Vista da suspensão** — `tyreContactPoint` em 3D, para sentir o carro
- [ ] **Modo pit** — cronómetro de paragem, Yokohama, undercut
- [ ] **Integração com Discord / Telegram** — avisos de tanda amarela
- [ ] **Telemetria do CSP** — se o Content Manager estiver instalado
- [ ] **App nativa** — embrulvar isto num ecrã sempre ligado

---

## Perguntas em aberto

- **Quantos carros并存 na página `acpmf_simhub_v2`?** A estrutura do
  SimHub sugere 128, mas vale a pena confirmar a versão actual antes de
  construir o mapa de adversários em cima dela.
- **Ler vale a pena ou refresca a tela inteira?** A 60 Hz e 128 carros, o
  JSON deve ficar dentro de uns 4 KB por frame. Deve dar, mas vale medir.
- **Vale a pena manter o SimHub?** Neste momento, não. Mas se a telemetria
  do CSP ou o suporte a outro jogo interessarem, os dois podem viver
  juntos — este site para o AC, o SimHub para o resto.

---

## Ficheiros

| | |
|---|---|
| [README.md](README.md) | como instalar e usar |
| [AGENTS.md](AGENTS.md) | armadilhas — **ler antes de mexer** |
| [progresso.md](progresso.md) | o que foi feito e o que se aprendeu |
| [LICENSE](LICENSE) | MIT |
