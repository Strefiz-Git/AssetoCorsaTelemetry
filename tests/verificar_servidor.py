"""Liga o servidor com cada jogo e pergunta-lhe o que responde.

Este script e' o "a correr de verdade" que a suite nao pode fazer: a suite
testa as PECAS (as structs, as regras, o contrato entre o painel e o
servidor), e este testa o SISTEMA ligado -- o HTTP a responder, a troca de
jogo a quente, e o payload a ter as chaves que o painel precisa.

E' a prova de que `python server.py --jogo f125` arranca, serve, e troca
de jogo sem reiniciar.
"""
import io
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')

FALHAS = []


def ok(cond, msg):
    print(('  ok   ' if cond else '  FALHA ') + msg)
    if not cond:
        FALHAS.append(msg)


def pedir(porta, caminho, metodo='GET', corpo=None):
    url = 'http://127.0.0.1:%d%s' % (porta, caminho)
    dados = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(url, data=dados, method=metodo)
    if dados:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def arrancar(porta, jogo):
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1',
               PYTHONIOENCODING='utf-8')
    p = subprocess.Popen(
        [sys.executable, '-u', 'server.py', '--jogo', jogo,
         '--porta', str(porta), '--bind', '127.0.0.1'],
        cwd=RAIZ, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, encoding='utf-8', errors='replace')
    # A porta a aceitar E' o sinal de que o servidor arrancou, mas o
    # terminal so' escreve DEPOIS -- a `_ecra_inicial` corre depois do
    # `serve_forever`. Ler a saida aqui dava '' e o teste diria que o
    # terminal nao anuncia o jogo, quando o anunciava.
    #
    # Por isso a funcao devolve o processo e o script le a saida no fim,
    # depois do `terminate`. E a razao de ser COPIA: registar o que o
    # utilizador viu, e nao o que seConsegue apanhar a tempo.
    for _ in range(60):
        if p.poll() is not None:
            return p, p.stdout.read()
        try:
            urllib.request.urlopen('http://127.0.0.1:%d/api/games' % porta,
                                   timeout=1).read()
            return p, ''
        except Exception:
            time.sleep(0.25)
    return p, 'a porta nao abriu'


def parar(p):
    """Fecha o servidor e devolve o que ele escreveu no terminal."""
    try:
        p.terminate()
        p.wait(timeout=5)
    except Exception:
        p.kill()
    try:
        return p.stdout.read() or ''
    except Exception:
        return ''  


print()
print('=== 1. o F1 25 arranca e diz o que tem ===')
PORT = 8791
p, saida = arrancar(PORT, 'f125')
try:
    st, corpo = pedir(PORT, '/api/games')
    d = json.loads(corpo)
    ok(st == 200, '/api/games responde 200')
    ok(d['jogo'] == 'f125', 'e diz que o jogo activo e o f125')
    ids = [j['id'] for j in d['jogos']]
    ok(ids == ['ac', 'f125'], 'e lista os dois jogos: %s' % ids)
    nomes = {j['id']: j for j in d['jogos']}
    ok(nomes['ac']['precisaInstalar'] is True,
       'o AC avisa que precisa da app instalada')
    ok(nomes['ac']['instrucao'] != '' and nomes['f125']['instrucao'] != '',
       'e os dois trazem a instrucao, que sao diferentes')
    ok(nomes['ac']['instrucao'] != nomes['f125']['instrucao'],
       'e as instrucoes NAO sao a mesma (a confusao mais cara do ecra)')

    st, corpo = pedir(PORT, '/api/state')
    d = json.loads(corpo)
    ok(st == 200, '/api/state responde 200')
    ok(d.get('jogo') == 'f125', 'e o payload diz de que jogo e\'')
    ok(d.get('connected') is False,
       'sem jogo a correr diz nao ligado, e nao zeros a fingir')
    # AS CHAVES QUE O PAINEL PRECISA. Todas, e nao uma: uma chave em
    # falta faz o frontend decidir sozinho, e uma decisao tomada no sitio
    # errado e' a forma mais facil de mostrar "--" onde devia mostrar um
    # valor. Regra no 14.
    NECESSARIAS = ('speed', 'rpm', 'gear', 'throttle', 'brake', 'steer',
                   'clutchRaw', 'drs', 'drsAvailable', 'ersJ', 'turbo',
                   'fuelKg', 'fuelPct', 'currentTime', 'lastTime',
                   'compound', 'pos', 'lap', 'x', 'y', 'z', 'trackPct',
                   'tyreTempSurface', 'tyrePressure', 'tyreWear',
                   'brakeTemp', 'brakeBias', 'airTemp', 'tyreAge',
                   'absOnOff', 'tcModo', 'weatherNome', 'weather')
    faltam = [k for k in NECESSARIAS if k not in d]
    ok(not faltam, 'as chaves que o painel precisa estao todas (faltam %s)'
       % (faltam or 'nenhuma'))
    # e o que NAO pode vir a zero
    ok(d.get('tyreWear') in (None, []) or d.get('tyreWear') is None,
       'e o desgaste e\' None e nao [0,0,0,0] sem jogo a correr')
    ok(d.get('brakeBias') is None,
       'e o bias de trava tambem, em vez de 0 que parece um valor honesto')

    st, corpo = pedir(PORT, '/api/capabilities')
    caps = json.loads(corpo)
    ok(st == 200 and caps.get('jogo') == 'f125', '/api/capabilities')
    ok(caps.get('vidaPneu') == 'on', 'e diz que o F1 25 da a vida do pneu')
    ok(caps.get('travãoDeMão') == 'off', 'e que o travão de mão nao existe')

    st, corpo = pedir(PORT, '/api/opponents')
    d = json.loads(corpo)
    ok(st == 200, '/api/opponents responde 200')
    ok(d.get('available') is False, 'e diz que nao ha adversarios, com motivo')
    ok(d.get('motivo'), 'e o motivo esta escrito: %r' % d.get('motivo'))

    st, corpo = pedir(PORT, '/api/diagnostics')
    diag = json.loads(corpo)
    ok(diag.get('jogoSolicitado') == 'f125', '/api/diagnostics diz o jogo')
    ok(diag.get('instrucao', '') != '',
       'e o diagnostico traz a instrucao do jogo, para o painel mostrar '
       'quando nao ha telemetria')
finally:
    # o terminal so' se le aqui, com o processo ja fechado
    ecra = parar(p)
    ok('F1 25' in ecra, 'o terminal anuncia o F1 25')
    ok('20777' in ecra, 'e diz a porta do UDP')
    ok('Telemetry' in ecra or 'telemetria' in ecra.lower(),
       'e diz de que se trata')

print()
print('=== 2. trocar de jogo a quente, sem reiniciar ===')
p, saida = arrancar(PORT, 'ac')
try:
    st, corpo = pedir(PORT, '/api/games')
    ok(json.loads(corpo)['jogo'] == 'ac', 'arrancou no AC')

    st, corpo = pedir(PORT, '/api/game', 'POST', {'jogo': 'f125'})
    d = json.loads(corpo)
    ok(st == 200, 'o POST /api/game responde 200')
    ok(d['jogoActivo'] == 'f125', 'e o servidor trocou para o f125')
    ok(len(d['jogos']) == 2, 'e devolve a lista dos dois')

    st, corpo = pedir(PORT, '/api/state')
    d = json.loads(corpo)
    ok(d.get('jogo') == 'f125', 'e o /api/state ja diz f125')
    ok('drsDistancia' in d, 'e o payload ja tem o que so o F1 25 da')

    st, corpo = pedir(PORT, '/api/capabilities')
    ok(json.loads(corpo).get('jogo') == 'f125',
       'e as capacidades tambem trocaram')

    st, corpo = pedir(PORT, '/api/game', 'POST', {'jogo': 'ac'})
    ok(json.loads(corpo)['jogoActivo'] == 'ac', 'e volta ao AC')
    st, corpo = pedir(PORT, '/api/capabilities')
    caps = json.loads(corpo)
    ok(caps.get('vidaPneu') == 'auto',
       'e a vida do pneu volta a ser estimada, como no AC')
finally:
    parar(p)

print()
print('=== 3. o que o painel recebe, para os dois ===')
for jogo in ('ac', 'f125'):
    p, saida = arrancar(PORT + 1, jogo)
    try:
        st, corpo = pedir(PORT + 1, '/')
        ok(st == 200 and b'<html' in corpo.lower(),
           "%s: a raiz responde HTML" % jogo)
        st, corpo = pedir(PORT + 1, '/app.js')
        ok(st == 200 and b'Jogos' in corpo,
           "%s: e o app.js traz a ponte para os modulos" % jogo)
        st, corpo = pedir(PORT + 1, '/jogos/ac.js')
        ok(st == 200, "%s: e o modulo do AC tambem e servido" % jogo)
        st, corpo = pedir(PORT + 1, '/jogos/f125.js')
        ok(st == 200, "%s: e o modulo do F1 25 tambem e servido" % jogo)
        st, corpo = pedir(PORT + 1, '/nucleo/tempos.js')
        ok(st == 200, "%s: e a matematica partilhada tambem e servida" % jogo)
        st, corpo = pedir(PORT + 1, '/api/settings')
        d = json.loads(corpo)
        chaves = {x['chave']: x for x in d['definicoes']}
        ok('jogo' in chaves, "%s: as definicoes tem a escolha de jogo" % jogo)
        ok(chaves['acPath']['jogo'] == 'ac',
           "%s: e o caminho do jogo diz a que JOGO pertence" % jogo)
    finally:
        parar(p)

print()
if FALHAS:
    print('%d FALHA(S):' % len(FALHAS))
    for f in FALHAS:
        print('  - %s' % f)
    sys.exit(1)
print('ok: o sistema ligado funciona com os dois jogos.')
