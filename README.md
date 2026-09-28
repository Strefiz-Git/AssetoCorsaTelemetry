# Telemetria de corridas

Painel de telemetria no browser, a ler **directamente do jogo** e a
mostrá-la a **60 fps**. Serve dois:

| | como lê | adversários |
|---|---|---|
| **Assetto Corsa** | memória partilhada do Windows | precisa da nossa app, instalada **dentro** do jogo |
| **F1 25** | datagramas **UDP** na porta 20777 | vêm no próprio protocolo, sem instalar nada |

Escolhe-se o jogo ao abrir a página, e troca-se nas definições sem
reiniciar nada.

O Assetto Corsa **não usa o SimHub**: sem limite de 10 fps, sem licença,
sem plugin. O F1 25 não passa por ninguém, porque a telemetria é um UDP
que o jogo manda para onde se quiser.

![paleta](https://img.shields.io/badge/paleta-F1-FFD700) ![licença](https://img.shields.io/badge/licença-MIT-blue)

---

## Os dois jogos, e o que muda entre eles

Não é o mesmo painel com números diferentes. Cada jogo traz as suas
regras, e elas estão em módulos separados — `static/jogos/ac.js` e
`static/jogos/f125.js` — porque uma regra dentro do frontend só se pode
testar com o jogo a correr e olhando para o ecrã.

O que muda, e que está medido ou na documentação do jogo:

| | Assetto Corsa | F1 25 |
|---|---|---|
| embraiagem | fracção 0–1, e 1,0 = **embraiada** | **0–100**, e 100 = embraiada |
| ABS | **nível** 0–1, medido em 0,13 → "ABS 13%" | **ligado/desligado**, sem percentagem |
| combustível | **litros** | **quilogramas** |
| bias de travão | fracção 0–1 | **percentagem** 0–100 |
| volante | ângulo em radianos, limite desconhecido | **−1 a 1**, limite escrito |
| ordem das rodas | `FL FR RL RR` | **`RL RR FL FR`** — traduzida |
| vida do pneu | **não existe**, é estimada de duas voltas | **`m_lifeSpan`**, lida |
| tempo e chuva | **não publica**; deduz-se da aderência | **`m_weather`**, chuva e previsão |
| zona de DRS | dois flags que mediram 98,9% e 18,5% | **os metros que faltam** |
| delta | calculado contra uma volta de referência | **vem do jogo** |

E o que **não** muda é a apresentação. Quando os dois jogos
divergem numa escolha de como se mostra — que lado de uma percentagem
é o "bom", como se expressa uma quantidade — **manda o F1 25, e o AC
muda para ele**. Porquê: quem conduz os dois é a mesma pessoa, e
"12 % restante" e "88 % usado" são o mesmo facto com duas leituras,
e uma delas está errada. A regra está no
[`AGENTS.md`](AGENTS.md) (Regra nº 30) e a unidade de cada campo
continua a ser a que o jogo publica — litros no AC, quilos no F1 25.

E o que o F1 25 dá e o AC não: o **setup** inteiro, a idade e a vida do
pneu, bolhas, o desgaste dos seis componentes do motor, o ângulo real da
roda, o escorregamento em *ratio* e em ângulo, o estado do céu com
previsão, e os adversários **sem instalar nada**.

Cada jogo só mostra o que publica. O que não existe fica escondido, e o
que existe mas é uma estimativa fica esbatido — "não existe" e "ainda
não sei" são coisas diferentes, e esconder a segunda seria mentir.

A telemetria dos dois jogos está escrita em
[`docs/assetto-corsa.md`](docs/assetto-corsa.md) e
[`docs/f1-25.md`](docs/f1-25.md). As regras do projecto — com a medição
que justifica cada uma — estão no [`AGENTS.md`](AGENTS.md), e a
documentação toda está indexesada em
[`docs/`](docs/README.md).

![paleta](https://img.shields.io/badge/paleta-F1-FFD700) ![licença](https://img.shields.io/badge/licença-MIT-blue)

---

## Começar

São três coisas: ligar a app ao jogo, arrancar o servidor, abrir o
browser. A primeira é a única que é fácil de fazer mal e difícil de
depurar, por isso está aqui em detalhe.

### O que precisas

| | |
|---|---|
| Sistema | Windows para o Assetto Corsa. O F1 25 é cross-platform, mas o servidor também |
| Python | 3.8 ou superior — [python.org](https://www.python.org/downloads/) |
| Dependências | **nenhuma** — só a biblioteca standard, não há `pip install` |
| Node | só para correr os testes. O painel funciona sem ele |

O `ctypes` e o `http.server` já vêm com o Python.

### F1 25 — nada para instalar

Se jogas F1 25, **é só arrancar o servidor e abrir a página**. O painel
espera na porta 20777 e aparece quando o jogo começa a mandar.

Para ligar a telemetria no jogo: *Settings → Telemetry Settings*, e

| opção | valor |
|---|---|
| UDP Telemetry | **On** |
| UDP IP Address | `127.0.0.1` |
| UDP Port | `20777` |
| UDP Send Rate | **60 Hz** |
| UDP Format | `2025` (ou `2026` com o Season Pack 2026) |
| Your Telemetry | **Public**, se quiseres ver os adversários |

**Your Telemetry em *Restricted* põe a zero o combustível, o ERS e todo o
dano dos outros carros.** É a definição de omissão, e o painel avisa
quando está assim — porque zero é um número plausível, e "sem ERS" seria
uma mentira. Para o teu carro os dados vêm sempre.

Só há telemetria **a conduzir**. Nos menus não sai nada, e o painel
escreve "EM PAUSA" ou "JOGO ENCERRADO" em vez de mostrar zeros.

### Assetto Corsa — um passo a mais

### Passo 1 — instalar a app no jogo

O AC escreve três páginas de memória partilhada, e nelas só está **o
carro de quem conduz**. Para os adversários é preciso uma app a correr
**dentro** do jogo, porque só lá dentro a API existe. Essa app é nossa e
está em [`python_app/`](python_app/).

Copia-a e liga-a num comando:

```
python instalar_app.py
```

O que ele faz:

1. encontra o Assetto Corsa (pergunta à pasta Steam, e se não
   encontrar aceita `--ac "C:\...\assettocorsa"`);
2. copia os dois `.py` para
   `assettocorsa/apps/python/actelemetry_strefiz/`;
3. copia o `_ctypes.pyd` certo para `stdlib/` e `stdlib64/`.

Depois liga-a no **Content Manager → Settings → Python Apps → actelemetry_strefiz → Start**.

Confirma que arrancou pelo log do AC: `AssettoCorsaTelemetry 1.1.0 a escrever`.

#### Porquê que o passo 3 é obrigatório

A app carrega o `ctypes` que vem **com o jogo**, e não o do sistema.
São extensões diferentes, compiladas contra interpretadores diferentes, e
as definições de `c_float` e `c_int32` podem não ter o mesmo tamanho. A
página de memória é escrita com um e lida com o outro, e um
desalinhamento de 4 bytes não dá erro nenhum: dá valores plausíveis a
partir do sítio errado.

O `_ctypes.pyd` **não está neste repositório** — é binário do Assetto
Corsa, e não se distribui aqui. Cada app do Content Manager traz o seu
exemplar, e o instalador copia de lá. Ele também não vai pelo primeiro
que encontra: **vota**. Nesta máquina há seis apps com `_ctypes.pyd`, e
elas não são iguais — cinco concordam e uma (`RacelabLib`) traz uma
compilação diferente, com 60% dos bytes distintos. A que está em
minoria fica de fora, e o instalador diz qual ficou de fora.

Sem este ficheiro a app arranca na mesma, avisa no log do AC que o
`ctypes` do sistema ficou a entrar, e a telemetria sai errada sem dar
erro. Para conferir o estado:

```
python instalar_app.py --verificar
```

#### Se não tiver Content Manager

Dá para na mão: copia `python_app\actelemetry_strefiz\*` para
`assettocorsa\apps\python\actelemetry_strefiz\` e copia um
`_ctypes.pyd` de outra app qualquer para `stdlib64\` (a de 32 bits vai
para `stdlib\`). O `instalar_app.py` faz exactamente isto.

Sem a app, o dashboard **não dá erro** — simplesmente não há adversários
e `/api/opponents` responde `available: false`. É o comportamento certo.
Tudo o resto funciona.

### Passo 2 — arrancar o servidor

Dá um duplo clique no **`INICIAR.bat`**.

Fica a correr em segundo plano, sem janela. Pode fechar a janela. A
primeira vez o Windows Firewall pergunta se aceita em redes privadas —
aceite, ou o telemóvel e os outros PC não chegam lá.

Depois abre **http://localhost:8765**.

Sem duplo clique:

```
python server.py --abrir
```

| | |
|---|---|
| `INICIAR.bat` | arranca em segundo plano e abre o browser |
| `PARAR.bat` | para o servidor |
| `REINICIAR.bat` | para e arranca de novo |

O `PARAR.bat` mata pelo **número da porta**, não por "todos os processos
python" — porque o Python do Content Manager, o do SimHub e o de outras
ferramentas também se chama `python.exe`. Antes de matar confirma pela
linha de comando que o processo é mesmo o servidor; se for outra coisa
na mesma porta, diz e não toca.

Se abrires o `INICIAR.bat` com o servidor já a correr, ele avisa e
limita-se a abrir o browser — não arranca uma segunda cópia.

### Passo 3 — escolher a vista

Na primeira abertura pergunta qual das três queres:

| Vista | Para quê |
|---|---|
| **Telemetria** | o painel completo |
| **Leaderboard** | a classificação de todos os carros |
| **Misto** | os dois ao mesmo tempo |

Podes mudar quando quiseres, no menu. A escolha fica guardada.

---

## Abrir noutro PC

O servidor é uma página web. Qualquer dispositivo na **mesma rede** pode
vê-la, e um PC pode servir de painel para outro.

### No telemóvel, ou noutro PC da mesma rede

No arranque o servidor imprime o endereço:

```
  Neste PC : http://localhost:8765/
  Rede     : http://192.168.1.42:8765/
```

Abre esse endereço no outro dispositivo. Não precisa de instalar nada —
é só o browser.

Se não funcionar à primeira, é o Windows Firewall. Na primeira execução
o Python pergunta se aceita em redes privadas; se Respondeste "não", é
sempre aqui:

*Definições → Rede e Internet → Propriedades da rede → Permitir a
aplicação através da Firewall* → marca **Redes privadas**.

### Se o outro dispositivo não estiver na mesma rede

O URL `192.168.x.x` só funciona dentro da tua rede. Fora dela há três
caminhos, por ordem de simplicidade:

1. **VPN** — Tailscale, WireGuard ou ZeroTier. As duas máquinas ficam
   na mesma rede virtual e o endereço do passo anterior funciona tal e
   qual. É a solução que recomendo: não expõe nada para a internet e
   não precisa de configuração no router.
2. **O dashboard como serviço** — abrir no telemóvel a partir do
   computador. Não involves a rede do computador.
3. **Encaminhamento de portas** — não é recomendado. Expõe a telemetria
   à internet aberta.

### O aviso que tem de ficar escrito

**Não há palavra-passe.** Qualquer pessoa que chegue ao endereço vê os
teus dados de telemetria e pode mudar a pasta do jogo em
`/api/settings`.

Numa rede de casa isso é aceitável. Numa rede de hotel, de café ou de
faculdade, não — e o endereço do servidor é adivinhável.

Para fechar:

```
python server.py --bind 127.0.0.1 --porta 8765
```

Com `--bind 127.0.0.1` só este PC responde; o endereço de rede deixa de
ser servido. O `0.0.0.0` é a predefição para não mudar o comportamento
de quem já tem isto instalado, e o servidor avisa no arranque quando
está aberto à rede toda.

---

## Quando algo corre mal

O servidor corre sem janela, por isso não há consola onde ver erros. O
que sai dele vai para **`servidor.log`** e **`servidor.log.err`**, no
directório do projecto. É o primeiro sítio a olhar se o dashboard não
actualizar.

| Sintoma | Onde está a causa |
|---|---|
| Não há adversários | a app não arrancou. Log do AC, procurar `AssettoCorsaTelemetry` |
| Os valores parecem errados por 4 bytes | falta o `stdlib64`. `python instalar_app.py --verificar` |
| O clima mostra `—` | a app não tem o Custom Shaders Patch a expor as funções de clima. O resto funciona |
| O mapa vem vazio | a pasta do AC não está configurada nas definições |
| O painel não abre | o Windows Firewall. Ver acima |
| A página abriu mas não actualiza | o AC não está a correr. O rodapé diz `JOGO ENCERRADO` |

O `servidor.log.err` é o ficheiro a mandar quando a página dá erro de
ligação.

### Opções do servidor

```
python server.py --porta 9000        # mudar a porta
python server.py --rate 400         # amostrar mais depressa (predefinição: 200)
python server.py --bind 127.0.0.1   # só este PC
python server.py --abrir            # abre o browser assim que a porta aceita ligações
```

O `--abrir` existe porque o servidor é o único que sabe quando está
pronto. Abrir o browser a partir de um script que adivinha o tempo de
arranque dá uma corrida: ou a página é pedida cedo demais e aparece um
erro de ligação, ou espera-se sem necessidade.

---

## O que mostra

| | |
|---|---|
| **Velocidade · rpm · caixa** | barra de rpm com zona vermelha |
| **Pedais** | travão, acelerador e embraiagem em tempo real |
| **Mapa da pista** | desenha-se a partir da posição real do carro |
| **Tempos de volta** | actual, melhor, anterior e **delta** contra a melhor |
| **Pneus** | temperatura, aderência e pressão, por pneu |
| **Vida do pneu** | estimativa a partir do desgaste medido neste stint |
| **Travões** | temperatura dos quatro, e o imbalance da travagem |
| **Combustível** | %, litros na reserva, voltas que faltam, ar e pista |
| **Clima** | ar, pista, vento, densidade e a **cena** — ver abaixo |
| **DRS · ERS · ABS · TC** | estado e percentagens |
| **Penalidade · bandeira · posição** | |

### As três cenas que piscam

Só três coisas piscam, e todas as três estão ligadas por uma razão: são
avisos que mudam de cor, e quem não olha de relance não os vê.

- **Combustível** — a moldura engrossa e o número a piscar, com a cor a
  subir com a percentagem: amarelo aos 15%, laranja aos 7%, vermelho ao
  fim.
- **DRS** — a carta **inteira** pisca, não só a caixa do DRS. A caixa é
  um rectângulo pequeno dentro de um painel cheio de números; o que se
  perde sem dar por isso não é um número, é uma ultrapassagem.
- **Posição no mapa** — o botão que marca a tua posição pulsa.

Quem pediu menos movimento não os vê. É a regra 2.3.3, e a auditoria
verifica que nenhuma animação infinita fica fora disso.

### A cena do tempo

O painel diz **SECO**, **CHIADA**, **CHUVA**, **TROVOADA**, **FURACÃO**,
e também **VENTOSO**, **AGUACEIRO** e **TORNADO**.

As palavras e as cores não são inventadas: são as 37 cenas do Pure
Planner, com os limiares tirados das quantidades que o próprio jogo
reconhece. `0,001` é chcada, `0,125` é chuva, `0,6` é chuva forte. E o
que estava a ser lido e deitado fora era o **vento**, que separa duas
cenas que a chuva sozinha não separa:

| cena | chuva | vento |
|---|---|---|
| `tornado` | 0,300 | 100 |
| `heavy_sleet` | 0,300 | 0 |

Com só a chuva as duas diziam CHUVA FORTE. Com vento, uma é um tornado e
a outra é grão. Na secura é ainda mais limpo: `windy` tem chuva zero e
vento 50, e dizer "seco" aí é mentira.

---

## Como funciona

O AC publica três páginas de memória partilhada com nome:

| Página | Conteúdo |
|---|---|
| `acpmf_physics` | física do carro, alta frequência (a cada frame) |
| `acpmf_graphics` | sessão, tempos de volta, bandeira, penalidade, posição |
| `acpmf_static` | dados fixos: carro, pista, rpm máximo, ERS, DRS |

```
Assetto Corsa
      │  escreve continuamente
      ▼
acpmf_physics / acpmf_graphics / acpmf_static
      │  só o carro de quem conduz
      ▼
actelemetry_strefiz  ──►  acpmf_actelemetry_v2  ──►  acshm.py
   (dentro do jogo)        (a nossa, com 128     (fora do jogo)
                             carros)
                                          │  200 Hz, só leitura
                                          ▼
                                      server.py ──── SSE, 60 Hz ────▶ browser
```

O nome da página é o contrato entre a app e o leitor. É
`acpmf_actelemetry_v2` nos dois lados, e `test_contrato.py` falha se
alg um mudar sozinho.

Isto não é cautela. Se a struct crescer e o nome não mudar, o leitor
novo com um mapeamento antigo vai buscar os bytes novos a seguir ao fim
real da página — e recebe **zeros**. Zeros são o pior resultado
possível, porque são plausíveis: `rainAmount = 0` lê-se como "não
chove", e é um número que ninguém questiona. Daí a regra: **a struct
mudou de tamanho, logo o nome muda. Sempre.** O `v2` é um nome que nunca
existiu, de propósito.

O mapa não precisa de "aprender": usa `carCoordinates`, que é a posição
real do carro no mundo, e vai desenhando à medida que conduz.

### O delta

O AC não dá delta. O `app.js` guarda os pontos `[percentagem da pista,
tempo]` de cada volta; quando uma volta acaba, se foi a melhor fica de
referência, e o delta passa a ser a diferença entre o tempo actual e o
tempo da referência no mesmo ponto, interpolado.

Perto de zero (menos de 50 ms) o número fica sem cor, para não piscar a
vermelho enquanto se está na linha.

---

## Estrutura

```
AssettoCorsaTelemetry/
├── INICIAR.bat              arranca o servidor em segundo plano e abre o browser
├── PARAR.bat                para o servidor
├── REINICIAR.bat            para e arranca de novo
├── arrancar.ps1             a lógica do INICIAR (o .bat chama esta)
├── parar.ps1                a lógica do PARAR
├── instalar_app.py          copia a app e o ctypes do jogo para lá
├── server.py                servidor HTTP + SSE
├── acshm.py                 structs do AC e leitura da memória partilhada
├── AGENTS.md                as armadilhas deste projecto, uma por regra
├── static/
│   ├── index.html           estrutura
│   ├── style.css            cores, layout e movimento
│   ├── app.js               desenho, mapa, idiomas, definições
│   ├── tempos.js            matemática das voltas e do delta (pura)
│   ├── tempo.js             as 37 cenas do tempo, vindas do jogo (pura)
│   ├── tyres.js             aderência e vida do pneu
│   ├── combustivel.js       consumos e autonomia
│   └── fonts/               Titillium Web e Roboto Mono (OFL incluída)
├── python_app/
│   └── actelemetry_strefiz/
│       ├── actelemetry_strefiz.py    a app, dentro do jogo
│       └── actelemetry_shm.py        a struct e o nome da página
├── tests/                   44 ficheiros — ver AGENTS.md
└── docs de desenho          docs/ideia.md, docs/chuva2.md, docs/acessibilidade.md, ...
```

---

## Testes

```
python tests\run_all.py
```

23 grupos, por ordem. Com o AC a correr os testes de memória são
saltados — é o comportamento certo, não uma falha: escrevem em páginas
`ac_test_*`, criadas e destruídas pelo próprio teste, e nunca tocam nas
páginas reais do jogo.

O que **cada** um prova está na tabela do
[AGENTS.md](AGENTS.md#a-suite), com a razão de cada um dos que correm à
mão.

> **Atenção:** um teste de mutação **mexe no código do disco** para
> confirmar que o teste ao lado morde. Todos restauram no fim, e
> confirmam que restauraram — correr a suite não deixa o projecto
> diferente. Se algum dia ficar com `MUTACAO DE TESTE` num ficheiro,
> é porque um deles foi interrompido a meio:
> `git checkout -- <ficheiro>` resolve.

---

## Tipos e escalas

Confirmados contra o AC em execução, não por leitura da documentação:

| Campo | Escala |
|---|---|
| `kersCharge` (ERS) | fracção `0..1` |
| `kersMaxJ` | **joules** (num F1 dá ~4 500 000) |
| `kersCurrentKJ` | **kilojoules** — trocar as duas é erro de factor 1000 |
| `tyreWear` | **`0..100`, 100 = melhor aderência.** Despite o nome, **não é desgaste** — mede aderência. Ver a nota abaixo |
| `wheelsPressure` | **psi** (medido 28,7 a 32,3 num F1) |
| `tyreTempI / M / O` | °C, três zonas por pneu, ordem `[FL, FR, RL, RR]` |
| `clutch` | `1.0` = encaixada. A interface mostra o inverso |
| `abs`, `tc` | **o nível de ajuste, `0..1`** — não são "está a actuar" |
| `iCurrentTime`, `iBestTime` | milissegundos |
| `carCoordinates` | x, y, z do mundo. O plano da pista é **X-Z**; o Y é a altitude |
| `normalizedCarPosition` | `0..1` ao longo da volta |
| `packetId` | incrementa a cada frame — é ele que diz se o jogo está vivo |

### Sobre o `tyreWear`

O campo chama-se `tyreWear` e **não é desgaste**. É um sinal de
aderência e saúde, de `0..100`, onde 100 é o máximo: começa perto de
`0,995` num pneu novo, sobe durante o aquecimento e depois desce
ligeiramente à medida que o pneu se gasta. A interface mostra-o com o
nome **ADERÊNCIA** por isso.

E o desgaste verdadeiro, o que o HUD do Content Manager mostra, vem de
outra interface — a do objecto carro, `ac.getCar(0).wheels[i]`, que o
Python não expõe. A app sonda-o no arranque e deixa o resultado no log
do AC. Ver a Regra nº 18 do [AGENTS.md](AGENTS.md).

---

## Notas

- Se o SimHub estiver aberto, tudo funciona na mesma. As páginas ficam
  mapeadas mesmo com o jogo fechado, por isso "a página existe" **não**
  significa "o jogo está a correr" — quem diz isso é o `packetId`.
- O mapa guarda-se no `localStorage`: recarregar a página não o apaga.
  O botão **limpar** apaga.
- Em pausa ou no menu o `packetId` para. O painel mostra o último estado,
  esbatido, com "EM PAUSA" ou "JOGO ENCERRADO" em vez de fingir que está
  vivo.
- Quatro idiomas: **pt-PT**, **pt-BR**, **es**, **en**. Muda-se nas
  definições.
- Verificar que o texto não entrou torto depois de uma edição:
  `python tests\verificar_texto.py`.

---

## Licença

MIT — ver [LICENSE](LICENSE).

A fonte **Titillium Web** (a oficial da F1) e a **Roboto Mono** estão
incluídas em `static/fonts/` sob a licença SIL Open Font License — ver
`static/fonts/OFL.txt`.
