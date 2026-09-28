# -*- coding: utf-8 -*-
"""Confere factos do README contra o codigo, para nao publicar uma
afirmacao que o codigo nao sustenta.

Um README que descreve o que o codigo FAZ e' util. Um README que
descreve o que o codigo FAZIA e' pior do que nenhum, porque ninguem
descobre que esta errado ate o ler a correr.

Este nao prova que o README e' bom. Prova que as coisas que se podem
verificar sem correr o jogo batem certo.

A PRIMEIRA VERSAO DESTE TINHA SEIS ERROS, todos do mesmo feitio

Escrevi os padroes de busca a partir do que supunha, e nao do que o
ficheiro tem. Seis de catorze grupos falharam:

  - `PAGE_NAME` nao esta no `acshm.py`. O nome do lado do leitor e' a
    constante de classe `Opponents.NAME`, e o `test_contrato.py` que as
    compara. Eu procurava uma variavel de modulo que nao existe;
  - `tyreWear` e' um `c_float * 4` -- um por pneu -- e eu procurava um
    `c_float` simples;
  - psi nao esta em lado nenhum do codigo. E' uma conclusao do
    `AGENTS.md`, tirada de uma medicao, e eu escrevi o teste como se
    fosse uma constante que se fosse verificar no `acshm.py`;
  - as chaves de traducao estao em linhas com meia duzia de chaves
    juntas, e eu procurava `"ventoso."` -- o ponto era meu, o nome da
    chave nao tem ponto nenhum;
  - e um `faltan` que devia ser `faltam`, que apanhou o `compilar.py`.

O padrao e' o mesmo do `test_layout.py` e do `test_contrato.py`: nao
assumir a forma, ler.
"""
import io
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def ler(*partes):
    return io.open(os.path.join(RAIZ, *partes), encoding='utf-8').read()


R = ler('README.md')
S = ler('server.py')
# O codigo do HTTP saiu do server.py, que passou a ser a linha de
# comando. O nucleo e' ctelemetry/http.py, e e' la que a porta, a
# cadencia e o --bind sao declarados -- por isso e' ele que este teste
# tem de ler, e nao o server.py. Verificar a linha de comando quando se
# quer verificar o servidor e' a forma de o teste continuar a passar sem
# estar a medir nada.
H = ler('actelemetry', 'http.py')
BASE = ler('actelemetry', 'jogos', 'base.py')
A = ler('acshm.py')
APP = ler('python_app', 'actelemetry_strefiz', 'actelemetry_strefiz.py')
SHM = ler('python_app', 'actelemetry_strefiz', 'actelemetry_shm.py')
JS = ler('static', 'app.js')
HTML = ler('static', 'index.html')
# Os modulos puros, que foram para static/nucleo/, e os modulos de
# jogo, que estao em static/jogos/. Ler static/tempo.js dava
# FileNotFoundError e o teste parava no sitio -- que e' a falha mais
# enganadora que um teste pode ter, porque parece que passou.
T = ler('static', 'nucleo', 'tempo.js')
NUCLEO_JS = [ler('static', 'nucleo', n) for n in
             sorted(os.listdir(os.path.join(RAIZ, 'static', 'nucleo')))
             if n.endswith('.js')]
JOGOS_JS = [ler('static', 'jogos', n) for n in
            sorted(os.listdir(os.path.join(RAIZ, 'static', 'jogos')))
            if n.endswith('.js')]
RUN = ler('tests', 'run_all.py')
AG = ler('AGENTS.md')
HTTP = ler('actelemetry', 'http.py')
RECEPTOR = ler('actelemetry', 'jogos', 'f125', 'receptor.py')
PROTOCOLO = ler('actelemetry', 'jogos', 'f125', 'protocolo.py')
F125JS = ler('static', 'jogos', 'f125.js')
BASE_PY = ler('actelemetry', 'jogos', 'base.py')
JOGOS = ler('actelemetry', 'jogos', '__init__.py')

problemas = []
ok = 0


def chk(cond, msg, detalhe=''):
    global ok
    if cond:
        ok += 1
        print("  ok   %s" % msg)
    else:
        problemas.append(msg + (detalhe and ("  -- " + detalhe)))
        print("  FALHA  %s" % msg)


print("=== 1. o nome da pagina bate nos dois lados ===")
# o nome do lado da app e' uma variavel de modulo; o do leitor e' a
# constante de classe `Opponents.NAME`. Nao sao o mesmo sitio, e por isso
# e' que o `test_contrato.py` existe.
nome_app = re.search(r'PAGE_NAME\s*=\s*["\']([\w]+)["\']', SHM)
nome_lei = re.search(r'^\s*NAME\s*=\s*["\']([\w]+)["\']', A, re.M)
chk(nome_app is not None, "a app declara PAGE_NAME")
chk(nome_lei is not None, "o leitor declara Opponents.NAME")
chk(nome_app and nome_lei and nome_app.group(1) == nome_lei.group(1),
    "o nome e' o mesmo nos dois",
    "%s vs %s" % (nome_app and nome_app.group(1), nome_lei and nome_lei.group(1)))
# e o teste que compara precisa mesmo de comparar os dois
chk('acshm.Opponents.NAME != shm.PAGE_NAME' in ler('tests', 'test_contrato.py'),
    "o test_contrato.py compara exactamente essas duas")
# o README menciona as quatro paginas do JOGO e a NOSSA. A busca tem de
# ser pela nossa -- a primeira `acpmf_` que aparece e' `acpmf_physics`, e
# comparar com essa dava "o README diz o mesmo nome" quando o README
# esta a falar de outra pagina.
no_readme = re.search(r'`(acpmf_actelemetry_\w+)`', R)
chk(no_readme and nome_app and no_readme.group(1) == nome_app.group(1),
    "o README diz o mesmo nome da pagina da app",
    no_readme and no_readme.group(1))
for jogo in ('acpmf_physics', 'acpmf_graphics', 'acpmf_static'):
    chk(jogo in R, "o README menciona %s, a pagina do jogo" % jogo)

print()
print("=== 2. a versao que o README manda confirmar no log ===")
versao = re.search(r'VERSION\s*=\s*"([\d.]+)"', APP)
m = re.search(r'AssettoCorsaTelemetry ([\d.]+) a escrever', R)
chk(versao and m, "as duas lados declaram uma versao")
chk(m and versao and m.group(1) == versao.group(1),
    "a versao do README e' a da app",
    "README %s vs app %s" % (m and m.group(1), versao and versao.group(1)))

print()
print("=== 3. a porta e a cadencia por omissao ===")
porta = re.search(r'--(?:porta|port)["\'],\s*type=int,\s*default=(\d+)', S)
chk(porta and ('localhost:%s' % porta.group(1)) in R,
    "o README usa a porta por omissao do servidor", porta and porta.group(1))
rate = re.search(r'--rate["\'],\s*type=int,\s*default=(\d+)', S)
chk(rate and ('predefinição: %s' % rate.group(1)) in R,
    "o README diz a cadencia por omissao", rate and rate.group(1))

print()
print("=== 4. o --bind ===")
bind = re.search(r'--bind["\'],\s*default="([\d.]+)"', S)
chk(bind is not None, "o servidor declara --bind")
chk('127.0.0.1' in S and '127.0.0.1' in R, "o 127.0.0.1 existe dos dois lados")
chk('0.0.0.0' in R, "o README diz que o 0.0.0.0 e' a predefinicao")
chk('palavra-passe' in R, "o README avisa que nao ha' palavra-passe")
chk('/api/settings' in R, "e que da' para mudar a pasta do jogo")
# e o aviso tem de ser verdade: o endpoint tem mesmo de escrever
chk('/api/settings' in H and 'do_POST' in H,
    "o POST /api/settings existe mesmo, e esta' no nucleo e' nao no server.py")

print()
print("=== 5. os quatro idiomas ===")
langs = sorted(set(re.findall(r"^\s+'([a-z]{2}(?:-[A-Z]{2})?)':\s*\{", JS, re.M)))
chk(len(langs) == 4, "ha' 4 blocos de idioma no app.js", str(langs))
for l in langs:
    chk(l in R, "o README menciona %s" % l)

print()
print("=== 6. o tyreWear: escala e o que o campo e' ===")
campo = re.search(r"\(\s*['\"]tyreWear['\"]\s*,\s*([a-z_0-9 *]+?)\s*\)", A)
chk(campo is not None, "o acshm.py declara o campo")
chk(campo and '*' in campo.group(1),
    "e' um array de 4, um por pneu", campo and campo.group(1))
chk('0..100' in R, "o README diz a escala")
chk('não é desgaste' in R, "o README diz que nao e' desgaste")
chk('aderência' in R.lower() or 'aderencia' in R.lower(),
    "e' o que o painel lhe chama")
# O AGENTS.md diz "0..100, 100 = novo" na Regra nº 5, e a Regra nº 18
# explica que a direccao e' a mesma que a da Lua. Isso e' COMPATIVEL com
# "100 = melhor aderencia" -- sao a mesma frase por outra via. O que
# nao pode e' o AGENTS dizer que e' fraccao 0..1, que foi o erro antigo.
chk('0..100' in AG, "o AGENTS.md diz a mesma escala")
chk('Nao** e' + chr(39) + ' frac' not in AG or '0..100' in AG,
    "e nao diz que e' fraccao 0..1 -- o erro antigo")
# e o painel tem de chamar-lhe isso
chk('ADER' in JS and 'NCIA' in JS.replace('\u00ca', 'E').replace('\u00d3', 'O'),
    "o painel mostra ADERENCIA para este campo")

print()
print("=== 7. a pressao: psi e' uma conclusao medida, nao uma constante ===")
# nao ha' 'psi' no codigo -- e' uma conclusao tirada de medir 28,7 a
# 32,3. O README pode dize-lo; o teste tem de ir ver a prova.
chk('psi' in R, "o README diz psi")
chk('28,7' in AG and '32,3' in AG, "e' o AGENTS.md que tem a medicao")
chk('28,7' in R, "o README da a mesma medida")

print()
print("=== 8. a cena do tempo ===")
for valor in ('0.001', '0.125', '0.6'):
    chk(valor in T, "o tempo.js tem o limiar %s" % valor)
chk('0,001' in R and '0,125' in R and '0,6' in R,
    "o README cita os mesmos limiares, em portugues")
# as quatro cenas, no tempo.js E traduzidas nos quatro idiomas.
# O rotulo portugues do furacao leva o til -- "FURACAO" sem ele dava
# "nao esta traduzida" num ficheiro que esta traduzido.
for chave, rotulo in ((u'ventoso', 'VENTOSO'), (u'aguaceiro', 'AGUACEIRO'),
                      (u'tornado', 'TORNADO'), (u'furacao', u'FURAC\u00c3O')):
    chk(chave in T, "a cena %r existe no tempo.js" % chave)
    chk(('"wx.%s": "%s"' % (chave, rotulo)) in JS,
       "e esta traduzida em portugues no app.js", chave)
# e o numero de idiomas com a chave tem de ser 4
for chave in ('ventoso', 'aguaceiro', 'tornado'):
    n = len(re.findall(r'"wx\.%s"\s*:' % chave, JS))
    chk(n == 4, "wx.%s esta nos 4 idiomas" % chave, "veio %d" % n)
chk(len(re.findall(r'"wx\.furacao"\s*:', JS)) == 4,
    "wx.furacao continua nos 4 idiomas")

print()
print("=== 9. o contrato ===")
chk('test_contrato.py' in R, "o README aponta para o teste do contrato")
chk('test_contrato.py' in RUN, "e o teste esta na suite")
chk('v2' in R and 'zeros' in R.lower(),
    "o README explica a razao do nome -- os zeros")

print()
print("=== 10. o instalador ===")
chk(os.path.isfile(os.path.join(RAIZ, 'instalar_app.py')), "instalar_app.py existe")
inst = ler('instalar_app.py')
chk('python instalar_app.py' in R, "o README manda correr o instalador")
chk('--verificar' in R and 'verificar' in inst,
    "o modo --verificar existe dos dois lados")
chk('sys.argv' in inst or 'verificar' in inst, "e sabe o que fazer")
# a votacao, que e' a parte que evitou o binario errado
chk('maior grupo' in inst or 'len(melhor_apps)' in inst,
    "o instalador vota em vez de ficar com o primeiro")

print()
print("=== 11. nada de obsoleto, e nada de ficheiro que nao existe ===")
for mau in ('1.0.0', 'capital.js'):
    chk(mau not in R, "o README nao repete %r" % mau)
citados = set(re.findall(r'`([a-zA-Z_0-9]+\.(?:py|js|css|md|ps1|bat|html|json))`', R))


def existe(raiz, nome):
    """O README cita `app.js` e `test_contrato.py` sem caminho, porque
    estao em `static/` e `tests/`. Procura em toda a arvore em vez de
    so' na raiz -- a primeira versao deste teste dizia que os dois nao
    existiam, e o que nao existia era a busca."""
    if os.path.exists(os.path.join(raiz, nome)):
        return True
    achados = []
    for pasta, subpastas, ficheiros in os.walk(raiz):
        subpastas[:] = [s for s in subpastas
                        if s not in ('.git', 'ac_info', '__pycache__')]
        if nome in ficheiros:
            achados.append(pasta)
    return bool(achados)


inexistentes = sorted(c for c in citados if not existe(RAIZ, c))
chk(not inexistentes, "todos os ficheiros citados existem algures",
    ", ".join(inexistentes))

print()
print("=== 12. os scripts .bat que o README manda usar ===")
for bat in ('INICIAR.bat', 'PARAR.bat', 'REINICIAR.bat'):
    chk(os.path.isfile(os.path.join(RAIZ, bat)), "%s existe" % bat)
    chk(bat in R, "o README menciona %s" % bat)
for ps in ('arrancar.ps1', 'parar.ps1'):
    chk(os.path.isfile(os.path.join(RAIZ, ps)), "%s existe" % ps)

print()
print("=" * 62)
# ===================================================================
# OS DOIS JOGOS
# ===================================================================
# O README passou a descrever dois jogos, e cada afirmação nova é um
# facto que se pode conferir no código. Sem esta secção, "o painel serve
# o F1 25" podia ser verdade no README e falsa no programa — e é a mesma
# classe de mentira que a Regra no 19, com o README no lugar do payload.
print()
print("=== 13. os dois jogos ===")
chk('F1 25' in R, "o README menciona o F1 25")
chk('Assetto Corsa' in R, "e o Assetto Corsa")
# O registo importa-se, e nao se le. Ler o codigo-fonte e contar os
# caracteres dava "2369 jogos registados", que e' verdade nenhuma; e nao
# prova que o ficheiro importe sem erro, que ler o texto nao prova.
try:
    sys.path.insert(0, RAIZ)
    from actelemetry.jogos import JOGOS as REGISTO, obter
    chk(len(REGISTO) >= 2,
        "e o servidor tem %d jogos registados: %s"
        % (len(REGISTO), sorted(REGISTO)))
    chk('f125' in REGISTO, "o F1 25 está registado com o id f125")
    chk('ac' in REGISTO, "e o AC com o id ac")
    chk(obter('F125') is not None,
        "e o id pode-se pedir em qualquer caixa, porque quem escreve o "
        "ficheiro de definicoes tambem o escreve a mao")
    chk(obter('nao-existe') is None,
        "e um id inventado da None, e o servidor cai no padrao em vez "
        "de impedir o arranque")
    # A instrucao que o painel mostra vem do JOGO, nao do transporte.
    instrucoes = {j: obter(j).estado_leitor().get('instrucao', '')
                  for j in sorted(REGISTO)}
    vazias = [k for k, v in instrucoes.items() if not v]
    chk(not vazias, "os dois jogos trazem a instrucao de arranque %s"
        % (vazias or ''))
    distintas = len(set(instrucoes.values())) == len(instrucoes)
    chk(distintas,
        "e as instrucoes sao DIFERENTES entre os jogos, que e' o que "
        "evita seguir a instrucao do jogo errado")
except Exception as e:
    chk(False, "o registo dos jogos importa: %s" % e)

# A porta do UDP tem de ser a mesma em tres sitios: o README, o receptor
# que abre o socket, e a instrucao que o painel mostra. Regra no 16 com
# o eixo trocado -- tres copias de um numero divergem em silencio.
UDP = '20777'
chk(UDP in R, "o README diz a porta do UDP")
chk(UDP in RECEPTOR, "e o receptor escuta nessa porta")
chk(any(UDP in v for v in instrucoes.values()),
    "e e a que o painel mostra na instrucao")

# Os dois documentos existem e o README aponta para eles.
for doc in ('docs/f1-25.md', 'docs/assetto-corsa.md'):
    chk(os.path.isfile(os.path.join(RAIZ, doc)),
        "%s existe" % doc)
    chk(doc in R, "e o README aponta para %s" % doc)

# E o que cada jogo tem de mostrar, comparado com o que o código diz.
# Escrever no README "o F1 25 dá a vida do pneu" quando o código diz
# "auto" seria um README que promete o que o painel não mostra.
# As listas de capacidades sao escritas por um script, e por isso uma
# delas usa aspas duplas e a outra simples. Apontar o teste para uma das
# formas e' assumir a forma em vez de ler -- que e' o que este ficheiro
# diz no topo, e o que a regra no 4 avisa. Normalizam-se os dois lados.
def _sem_aspas(t):
    return t.replace('"', "'")


CAPS_AC = _sem_aspas(ler('actelemetry', 'jogos', 'ac', 'logica.py'))
CAPS_F1 = _sem_aspas(ler('actelemetry', 'jogos', 'f125', 'logica.py'))
BASE = _sem_aspas(BASE_PY)

# Cada linha e' uma promessa do README, conferida no codigo que a cumpre.
for chave, valor, quem, txt in (
        ('vidaPneu', 'on', 'o F1 25', 'dá mesmo a vida do pneu'),
        ('vidaPneu', 'auto', 'o AC', 'é mesmo estimada'),
        ('nivelAbs', 'off', 'o F1 25', 'não dá percentagem de ABS'),
        ('nivelAbs', 'on', 'o AC', 'dá mesmo a percentagem'),
        ('estadoTempo', 'off', 'o AC', 'não publica o estado do tempo'),
        ('tempo', 'on', 'o F1 25', 'publica o tempo'),
        ('combustivel', 'on', 'os dois', 'publicam o combustível'),
):
    fonte = CAPS_AC if quem == 'o AC' else CAPS_F1
    if quem == 'os dois':
        chk("'%s': '%s'" % (chave, valor) in CAPS_AC
            and "'%s': '%s'" % (chave, valor) in CAPS_F1, txt)
        continue
    chk("'%s': '%s'" % (chave, valor) in fonte, "%s %s" % (quem, txt))

# E a lista canonica tem de ter a chave, senao a capacidade nao esta
# escrita em lado nenhum e o painel esconde o campo por omissao.
for chave in ('vidaPneu', 'nivelAbs', 'estadoTempo', 'tempo'):
    chk("'%s'" % chave in BASE, "a lista canonica tem a chave %s" % chave)
chk("'%s'" % 'jogo' in BASE, "e a lista canonica tem o `jogo` declarado como "
                          "metadata, e nao como capacidade")

# A ordem das rodas. O README diz que o F1 25 usa RL RR FL FR, e a
# ordem e' uma tabela no protocolo e no modulo do browser. Três sítios.
chk('RL' in PROTOCOLO and "'RL', 'RR', 'FL', 'FR'" in PROTOCOLO.replace('"', "'"),
    "o protocolo do F1 25 tem a ordem RL RR FL FR")
# O modulo do browser tem a ordem do PAINEL -- e e' a unica em que o
# painel pensa. O que tem de estar la e' a TABELA DE TRADUCAO, que e'
# a regra que converte a ordem do jogo na do painel.
#
# A verificacao anterior procurava a ordem do JOGO no modulo, nao a
# encontrou, e falhava. O que ela afirmava, traduzido, e' que o painel
# mostrava os pneus ao contrario -- e a unica forma de a fazer passar
# seria escrever a ordem errada no modulo. Um teste que so passa com o
# codigo partido e' pior do que nao ter teste.
chk("'FL', 'FR', 'RL', 'RR'" in _sem_aspas(F125JS),
    "e o modulo do browser tem a ordem do PAINEL")
chk(re.search(r"TRADUCAO\s*=\s*Object\.freeze\(\[\s*2\s*,\s*3\s*,\s*0\s*,\s*1\s*\]\)",
              F125JS) is not None,
    "e a tabela que traduz a ordem do jogo para essa: RL->2 RR->3 FL->0 FR->1")
# E a traducao do Python esta' em `protocolo.py`, e o receptor IMPORTA-A.
# Isso e' o que interessa: uma tabela e' uma tabela, e duas copias
# divergem em silencio. O mesmo teste (`test_jogos.js` do browser e
# `test_f125_parser.py` do Python) confere as duas pontas, e por isso as
# duas tem de dizer a mesma coisa.
chk(re.search(r"TRADUCAO\s*=\s*\{\s*0:\s*2\s*,\s*1:\s*3\s*,\s*2:\s*0\s*,\s*3:\s*1\s*\}",
              PROTOCOLO) is not None,
    "e o Python declara a traducao uma vez, em protocolo.py")
chk(re.search(r"from\s+\.protocolo\s+import[^)]*TRADUCAO", RECEPTOR,
              re.S) is not None,
    "e o receptor importa-a em vez de ter uma segunda copia")
# o protocolo declara tambem a ordem do JOGO, que e' a que a traducao
# traduz
chk(re.search(r"ORDEM_F1\s*=\s*\(\s*\"RL\"\s*,\s*\"RR\"\s*,\s*"
              r"\"FL\"\s*,\s*\"FR\"\s*\)", PROTOCOLO) is not None,
    "e a ordem do jogo esta escrita ao lado da traducao, que e' onde se "
    "confere uma com a outra")
chk('TRADUCAO' in RECEPTOR or 'traducao' in RECEPTOR,
    "e o receptor traduz a ordem para a do painel")

# A escolha do jogo tem de existir nos dois sitios: o ecra e as
# definições. Um botão que abre o ecra e nada mais é uma saída sem
# entrada, e alguém que já escolheu fica preso.
chk('jogos-lista' in HTML, "o ecra de escolha existe no HTML")
chk('set-jogo' in HTML, "e há uma escolha de jogo nas definições")
chk('btn-jogo' in HTML, "e há um botão para voltar ao ecra")
for rota, porque in (("/api/game", "o POST que troca de jogo"),
                     ("/api/games", "a lista dos jogos"),
                     ("/api/capabilities", "as capacidades do jogo activo"),
                     ("/api/diagnostics", "o diagnostico")):
    chk(rota in HTTP, "e o servidor tem %s (%s)" % (rota, porque))

# ===================================================================
# OS DOCUMENTOS
# ===================================================================
# O `docs/` tem um indice que diz o que e' cada documento. Um indice que
# lista ficheiros que nao la esta' e' pior do que nao haver indice: da a
# confianca de que a documentacao esta' completa, e a falta so' se ve
# quando se vai procurar o que se precisava.
print()
print("=== 14. os documentos ===")
INDICE = 'docs/README.md'
chk(os.path.isfile(os.path.join(RAIZ, INDICE)), "%s existe" % INDICE)
if os.path.isfile(os.path.join(RAIZ, INDICE)):
    D = io.open(os.path.join(RAIZ, INDICE), encoding='utf-8').read()
    ligados = re.findall(r"\]\(([^)]+\.md)\)", D)
    quebrados = [l for l in ligados
                 if not os.path.isfile(os.path.join(RAIZ, 'docs', l))]
    chk(not quebrados, "os %d documentos que o indice lista existem %s"
        % (len(ligados), quebrados or ''))
    # E o indice tem de apontar para os DOIS textos de telemetria, que
    # sao os que se leem antes de mexer num jogo.
    for doc in ('f1-25.md', 'assetto-corsa.md'):
        chk(doc in ligados, "e o indice aponta para %s" % doc)
    # As tres mais importantes: telemetria, regras, e onde estao as
    # respostas para o que falta.
    chk('AGENTS.md' in D, "e diz onde estao as regras, que e' o AGENTS.md")
    chk('não está respondida' in D,
        "e diz que os ficheiros de ali sao perguntas por responder, e nao "
        "conclusoes")
    chk('resources/docs' in D,
        "e onde estao os ficheiros da EA, que nao sao nossos")

# O README principal tem de chegar ao indice, senao a pasta e' um sitio
# onde ninguem vai procurar.
chk('docs/' in R, "o README aponta para a pasta docs/")
chk('f1-25.md' in R, "e para o texto do F1 25")
chk('assetto-corsa.md' in R, "e para o do Assetto Corsa")

# NENHUM .md na raiz, a nao ser o README e o AGENTS. E' a forma de a
# pasta nao voltar a encher-se de ficheiros soltos: um documento que
# entra na raiz e' um documento que ninguem sabe onde esta'.
md_raiz = sorted(f for f in os.listdir(RAIZ) if f.endswith('.md'))
esperados = ['AGENTS.md', 'README.md']
chk(md_raiz == esperados,
    "a raiz so' tem o README e o AGENTS: %s" % md_raiz)

if problemas:
    print("!!! %d FALHA(S) de %d" % (len(problemas), ok + len(problemas)))
    for p in problemas:
        print("  - %s" % p)
    sys.exit(1)
print("ok: %d factos do README batem certo com o codigo." % ok)
