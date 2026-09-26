# AGENTS.md

Instruções para agentes de IA (e pessoas) que trabalhem neste repositório.

Este projecto é pequeno, mas tem **armadilhas reais** que já custaram
tempo. Estão todas aqui para não se repetirem.

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

---

## Regra nº 5 — escalas que não são óbvias

Confirmadas contra o AC real:

- `tyreWear` é **0..100** (100 = novo). **Não** é fracção 0..1. Multiplicar
  por 100 dá 9994 %.
- `kersCharge` (ERS) é fracção **0..1**.
- `tyreTempI / M / O` são três zonas por pneu; a ordem é
  `[FL, FR, RL, RR]` em todos os arrays de 4.
- `iCurrentTime`, `iBestTime`, `iLastTime` em **milissegundos**.
- `carCoordinates` são metros no mundo, e `y` precisa de ser invertido
  para desenhar (o AC tem y para cima, o canvas tem y para baixo).
- No **AC base** a página de gráficos só traz `penaltyTime` (segundos) e a
  bandeira `AC_PENALTY_FLAG`. O enum de tipo de penalidade (`DT`, `SG10`,
  `DSQ`) é do **ACC** e não existe no AC base.

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

---

## Arquitetura

| Ficheiro | Responsabilidade |
|---|---|
| `acshm.py` | structs do AC, mapeamento, `snapshot()`. **Só leitura.** |
| `server.py` | HTTP + SSE. Um thread lê a 200 Hz, cada cliente recebe a 60 Hz. |
| `static/app.js` | desenha, mapa em canvas, cálculo do delta. |
| `static/index.html` / `style.css` | estrutura e paleta. |

Fluxo de dados: `AC → memória partilhida → Hub (200 Hz) → SSE (60 Hz) → DOM`.

O `Hub` tem um lock e só um thread lê a memória, para não haver leituras
concorrentes da mesma página.

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
  `[FL, FR, RL, RR]`.

---

## Ao mexer no frontend

- Recarregar a página **não** apaga o mapa: está no `localStorage`
  (chave `acmap.v1`). Para limpar de propósito, usar o botão **limpar**.
- Ao mudar de pista o mapa é invalidado automaticamente.
- Se mudar o layout, verificar nos três tamanhos: ecrã largo (3×2),
  tablet (2 colunas) e telemóvel (1 coluna).

---

## Ao mexer no `acshm.py`

1. Correr `python tests\test_layout.py` — valida a estrutura.
2. Com o jogo aberto, correr `python tests\verify_real.py` e **olhar para
   os valores**. Temperaturas de pneu têm de ter interior < meio <
   exterior. Travões da frente mais quentes que os de trás num RWD. Se
   algum valor for absurdo, é o offset (Regra nº 4).
3. Nunca acrescentar escritas nas páginas reais (Regra nº 1).
