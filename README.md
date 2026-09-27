# Assetto Corsa Telemetry

Dashboard de telemetria do **Assetto Corsa** em HTML, que lê a memória
partilhada do jogo e mostra-a no browser a **60 fps**.

Não usa o SimHub. Sem limite de 10 fps, sem licença, sem plugin.

![paleta](https://img.shields.io/badge/paleta-F1-FFD700) ![licença](https://img.shields.io/badge/licença-MIT-blue)

---

## Porque é que isto existe

O SimHub gratuito serve o dashboard no browser a **10 fps**. Isto lê
exatamente a mesma telemetria, saltando o SimHub, e envia-a ao browser a
60 fps via Server-Sent Events.

## Os adversários (e a app que os traz)

As três páginas que o próprio jogo escreve — `acpmf_physics`,
`acpmf_graphics`, `acpmf_static` — são **só do carro de quem está a
conduzir**. Para os outros carros é preciso uma app a correr **dentro**
do jogo, porque só lá dentro a API existe.

Essa app é **nossa**, e está em [`python_app/`](python_app/):

```
assettocorsa/apps/python/actelemetry/
    actelemetry.py         o plugin
    actelemetry_shm.py     a struct e o nome da página
    stdlib/stdlib64/       os .pyd do ctypes (obrigatórios)
```

Copia a pasta `python_app` para `assettocorsa/apps/python/actelemetry/`
e liga-a em **Content Manager → Settings → Python Apps**. Confirma que
arrancou pelo log do AC: `AssettoCorsaTelemetry 1.0.0 a escrever`.

Sem a app, o dashboard não dá erro — simplesmente não há adversários, e
`/api/opponents` responde `available: false`. É o comportamento certo.

O que ela publica, e porquê o que publica, está em
[`ideia.md`](ideia.md) e na Regra nº 19 do `AGENTS.md`.

## Como usar

### Requisitos

| | |
|---|---|
| Sistema | Windows (o AC é só Windows) |
| Python | 3.8 ou superior — [python.org](https://python.org) |
| Dependências | **nenhuma** — só a biblioteca standard |

O `ctypes` e o `http.server` já vêm com o Python. Não há `pip install`
a fazer.

### Arrancar

```
git clone <este-repo>
cd AssettoCorsaTelemetry
INICIAR.bat
```

Ou à mão:

```
python server.py --abrir
```

Depois abre **http://localhost:8765**. `--abrir` faz o próprio servidor
abrir o browser assim que a porta aceita ligações.

### Parar e reiniciar

| Ficheiro | O que faz |
|---|---|
| `INICIAR.bat` | arranca o servidor **em segundo plano** e abre o browser |
| `PARAR.bat` | **para o servidor** |
| `REINICIAR.bat` | para e arranca de novo |

**O servidor fica a correr em segundo plano.** Pode fechar a janela do
`INICIAR.bat` (ou do `REINICIAR.bat`) que o dashboard continua a
funcionar. Para o parar, é o `PARAR.bat`.

O `REINICIAR.bat` é o que se usa **depois de mexer no `acshm.py` ou no
`server.py`**: o servidor lê o código uma vez só, no arranque, e por isso
uma alteração a esses ficheiros não aparece sem um reinício. Mudar
apenas ficheiros em `static/` não precisa — o browser vai buscá-los de
novo a cada recarregamento.

O `PARAR.bat` mata pelo **número da porta**, não por "todos os
processos python". Isto importa porque o Python do Content Manager, o do
SimHub e o de outras ferramentas também se chama `python.exe`. Antes de
matar, confirma pela linha de comando que o processo é mesmo o
servidor; se for outra coisa na mesma porta, diz e não toca.

Se o `INICIAR.bat` for aberto com o servidor já a correr, ele avisa e
limita-se a abrir o browser — não arranca uma segunda cópia.

### Quando algo corre mal

O servidor corre sem janela, por isso não há consola onde ver erros. O
que sai dele vai para **`servidor.log`** e **`servidor.log.err`**, no
directório do projecto. É o primeiro sítio a olhar se o dashboard não
actualizar.

### Opções

```
python server.py --port 9000     # mudar a porta
python server.py --rate 400      # amostrar mais depressa (predefinição: 200)
python server.py --abrir         # abre o browser assim que a porta aceita ligações
```

O `--abrir` existe porque o servidor é o único que sabe quando está
pronto. Abrir o browser a partir de um script que adivinha o tempo de
arranque dá uma corrida: ou a página é pedida cedo demais e aparece um
erro de ligação, ou espera-se sem necessidade. É o que o `INICIAR.bat`
usa.

### Aceder do telemóvel

O IP da máquina aparece no arranque. Com o telemóvel na mesma rede:

```
http://192.168.x.x:8765
```

Se não funcionar à primeira, o Windows Firewall está a bloquear — na
primeira execução o Python pergunta se aceita em redes privadas.

---

## O que mostra

| | |
|---|---|
| **Velocidade · rpm · caixa** | com barra de rpm com zona vermelha |
| **Pedais** | travão e acelerador em tempo real |
| **Mapa da pista** | desenha-se sozinho a partir da posição real do carro |
| **Tempos de volta** | actual, melhor, anterior e **delta** contra a melhor volta |
| **Pneus** | temperatura interior / meio / exterior, desgaste, pressão |
| **Travões** | temperatura dos quatro |
| **Combustível** | %, litros, capacidade, temperatura do ar e da pista |
| **Clima** | ar, pista, vento, densidade do ar, aderência |
| **Pneus** | código do pneu (C3, H, …), nome completo, pressão em psi, aderência |
| **DRS · ERS · ABS · TC** | estado e percentagens |
| **Penalidade · bandeira · posição** | |

Layout responsivo: em ecrã largo usa uma grelha 3×2; em telemóvel passa
a uma coluna.

---

## Como funciona

O Assetto Corsa publica três páginas de memória partilhada com nome:

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
      │  lido por ctypes, só leitura
      ▼
server.py  ──── Server-Sent Events, 60 Hz ────▶  browser
```

O servidor lê a 200 Hz (para não perder frames do jogo) e empurra para o
browser a 60 Hz. O desenho é feito num `<canvas>`.

O mapa não precisa de "aprender": usa `carCoordinates`, que é a posição
real do carro no mundo. Vai desenhando à medida que conduz.

### O delta

O AC não dá delta. O `app.js` guarda os pontos `[trackPct, tempo]` de
cada volta; quando uma volta acaba, se foi a melhor fica de referência, e
o delta passa a ser a diferença entre o tempo actual e o tempo da
referência no mesmo ponto da pista, interpolado.

---

## Estrutura

```
AssettoCorsaTelemetry/
├── INICIAR.bat              arranca o servidor em segundo plano e abre o browser
├── PARAR.bat                para o servidor
├── REINICIAR.bat            para e arranca de novo
├── arrancar.ps1             a lógica do INICIAR (o .bat chama esta)
├── parar.ps1                a lógica do PARAR (o .bat chama esta)
├── server.py                servidor HTTP + SSE
├── acshm.py                 leitura da memória partilhada e structs do AC
├── static/
│   ├── index.html           estrutura
│   ├── style.css            cores e layout
│   ├── tempos.js            matemática das voltas e do delta (pura)
│   ├── app.js               desenho, mapa, idiomas, definições
│   └── fonts/               Titillium Web (OFL incluída)
└── tests/
    ├── run_all.py           corre a suite toda
    ├── test_layout.py       valida as structs campo a campo
    ├── test_acshm.py        testa a leitura com memória fictícia
    ├── test_opponents.py    testa a leitura dos 128 carros
    ├── test_tempos.js       tempos e delta, sem browser
    ├── test_tempos.html     os mesmos casos, no browser
    ├── test_mutation.py     confirma que os testes falham quando devem
    ├── check_layout.js      layout nos 3 modos × 13 larguras (colar na consola)
    ├── verify_real.py       confere a leitura contra o jogo a correr
    ├── diag_drs.py          agrupa o que encontra no canal SSE
    ├── probe_layout.py      sonda os valores reais
    └── diff_offsets.py      compara offsets calculados vs. reais
```

---

## Testes

```
python tests\run_all.py        # a suite toda, por ordem
```

Ou um a um:

```
python tests\test_layout.py    # não precisa do jogo
python tests\test_acshm.py     # não pode correr com o jogo aberto
node    tests\test_tempos.js   # não precisa do jogo nem de browser
python tests\verify_real.py    # precisa do jogo a correr
```

**Com o AC a correr, os testes de memória são saltados** — é o
comportamento certo, não uma falha. Escrevem em páginas `ac_test_*`, que
são criadas e destruídas pelo próprio teste, e nunca tocam nas páginas
reais do jogo.

> **Atenção:** `test_acshm.py` cria páginas de memória partilhada para
> injectar valores conhecidos. Usa nomes fictícios (`ac_test_*`) e tem uma
> guarda que aborta se detectar o jogo em execução — porque se usasse os
> nomes reais, as escritas do teste iam para dentro do AC a correr.
> Ver [AGENTS.md](AGENTS.md) para a história completa.

---

## Tipos e escalas

Confirmados contra o AC em execução, não só por leitura da documentação:

| Campo | Escala |
|---|---|
| `kersCharge` (ERS) | fracção `0..1` |
| `tyreWear` | **`0..100`, 100 = pneu novo** — não é fracção |
| `kersMaxJ`, `kersCurrentKJ` | ver nota abaixo |
| `tyreTempI / M / O` | °C, três zonas por pneu || `brakeTemp` | °C |
| `wheelsPressure` | unidade do jogo (~26) |
| `iCurrentTime`, `iBestTime` | milissegundos |
| `carCoordinates` | xyz do mundo, em metros |
| `normalizedCarPosition` | `0..1` ao longo da volta |
| `packetId` | incrementa a cada frame — diz se o jogo está vivo |

> **Unidades de ERS — atenção.** `ersMaxJ` e `kersMaxJ` vêm em **joules**
> (num F1 dá ~4 500 000, ou seja 4,5 MJ). `kersCurrentKJ` vem em
> **kilojoules** (centenas por volta). Trocá-las é um erro de factor 1000.

---

## Notas

- Se o SimHub estiver aberto, tudo funciona na mesma. As páginas ficam
  mapeadas mesmo com o jogo fechado, por isso "a página existe" **não**
  significa "o jogo está a correr" — quem diz isso é o `packetId`.
- O mapa guarda-se no `localStorage`: recarregar a página não o apaga.
  O botão **limpar** apaga.
- Em pausa ou no menu o `packetId` para. O site mostra o último estado,
  esbatido, com "EM PAUSA" ou "JOGO ENCERRADO" em vez de fingir que está
  vivo.

---

## Licença

MIT — ver [LICENSE](LICENSE).

A fonte **Titillium Web** (fonte oficial da F1) está incluída em
`static/fonts/` sob a licença SIL Open Font License — ver
`static/fonts/OFL.txt`.
