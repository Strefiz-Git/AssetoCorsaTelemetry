# -*- coding: utf-8 -*-
"""Teste do CONTRATO HTTP: o que o `/api/state` tem de conter.

POR QUE ISTE TESTE EXISTE
-------------------------
O bloco do clima ja estava testado dos dois lados, e na ligacao do meio
nao estava:

  - `test_loop_app.py` prova que a APP escreve `rainAmount` e
    `windSpeedApi` na pagina de memoria partilhada;
  - `test_acshm.py` prova que o `acshm.py` os le do `snapshot()`;
  - **nada** prova que chegam ao `/api/state`.

E foi por ai que a ligacao errada passou despercebida. O clima estava a
ser cosido ao sitio errado -- o `AGENTS.md` regista a mudanca, com o
nome do commit `3005ee97` -- e nada disse nada: a app escrevia, o leitor
lia, os campos existiam no payload, e o painel mostrava "--". Um teste
que verifica as duas pontas nao verifica o meio, e o meio e' onde a
mala-ligacao estava.

Este teste arranca um servidor a serio, numa porta efemera, com um
`Hub` de mentira que devolve um estado conhecido, e pergunta ao HTTP
pelo que o browser vai buscar. E o mesmo caminho que o browser percorre,
porta e parsing incluidos.

O QUE NAO E' TESTADO AQUI, E PORQUE

  - os VALORES. Quem valida os valores e' o `test_acshm.py`; aqui
    interessa o que existe e o que nao, nao o que vale;
  - a MEDICAO, o SSE e a cadencia. Sao coisas de outra classe, e o
    `diag_drs.py` trata delas.

O QUE FICA PROVADO QUANDO ISTO PASSA

  - `/api/state` tem os campos do clima, todos, e nenhum a menos;
  - os mesmos campos aparecem achatados no topo -- o `app.js` le-os
    em `d.rainAmount` e nao em `d.clima.rainAmount`, e essa distincao
    ja custou uma ligacao mal feita;
  - `/api/opponents` responde e traz a sua forma;
  - `_file()` nao serve nada de fora de `static/`.
"""
import io
import json
import os
import sys
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8")

# O nucleo do painel. O server.py passou a ser so' a linha de comando, e
# o que serve o HTTP e' ctelemetry/http.py -- que nao sabe qual e' o
# jogo. Ver 	ests/test_handler.py, que faz a mesma mudanca.
from actelemetry.http import Handler  # noqa: E402
from actelemetry.defs import STATIC  # noqa: E402

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

import acshm  # noqa: E402


def climas_de_ausencia():
    """A forma REAL do bloco do clima quando nao ha' Custom Shaders Patch.

    Sai de `ACTelemetry._clima()` com o `Opponents` trocado por um que
    falha ao abrir, e nao de uma lista escrita aqui. A primeira versao
    deste teste tinha a lista a mao e falhou em cinco campos -- a lista
    estava desactualizada em relacao com o codigo, que e' exactamente o
    que um teste nao deve poder estar.

    `_clima()` so' abre a NOSSA pagina, `acpmf_actelemetry_v2`. Nao toca
    nas paginas do jogo, que sao `acpmf_physics`, `acpmf_graphics` e
    `acpmf_static` -- a Regra nº 1 nao se aplica aqui.
    """
    class _AppQueNaoAbre:
        _view = None

        def open(self):
            return False

    t = acshm.ACTelemetry.__new__(acshm.ACTelemetry)
    t._app = _AppQueNaoAbre()
    return t._clima()


# o que o clima tem de ser quando nao se sabe. O `-1` e' o "nao sei" da
# regra nº 19, e o que impede que um zero se leia como "seco". Um `0`
# aqui seria um teste que passa pelo motivo errado.
CLIMA = climas_de_ausencia()

# e os dois que vem da pagina de graficos do jogo, e nao da app
DO_JOGO = {"windSpeed": 0.0, "windDirection": 0.0}

ESTADO = {
    "packetId": 1234,
    "speed": 42.5,
    "airTemp": 20.0,
    "roadTemp": 24.9,
    "airDensity": 1.1632,
    "surfaceGrip": 1.0,
}
ESTADO.update(CLIMA)
ESTADO.update(DO_JOGO)

ADVERSARIOS = {"available": True, "numCars": 3,
               "cars": [{"name": "RBR", "carModel": "rb21", "position": 1}]}


class HubDeMentira:
    """O `Hub` de sempre, com dois dicionarios dentro.

    Serve para fixar a RESPOSTA e medir o pedido. Um teste que dependesse
    da memoria partilhada seria um teste que so corre com o jogo aberto,
    e a suite salta esses de proposito."""

    def __init__(self):
        self.estado = dict(ESTADO)
        self.adversarios = dict(ADVERSARIOS)

    def get(self):
        return dict(self.estado)

    def get_opponents(self):
        return dict(self.adversarios)

    def start(self):
        pass

    def stop(self):
        pass


def pedir(porta, caminho):
    url = "http://127.0.0.1:%d%s" % (porta, caminho)
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            return r.status, r.read(), r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        return e.code, e.read(), ""


def main():
    problemas = []
    passou = 0

    def ok(cond, msg):
        nonlocal passou
        if cond:
            passou += 1
            print("  ok   %s" % msg)
        else:
            problemas.append(msg)
            print("  FALHA  %s" % msg)

    hub = HubDeMentira()
    Handler.hub = hub
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    httpd.daemon_threads = True
    porta = httpd.server_address[1]
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    try:
        print("=== 1. /api/state responde e diz JSON ===")
        codigo, corpo, ctype = pedir(porta, "/api/state")
        ok(codigo == 200, "o codigo e' 200 (veio %d)" % codigo)
        ok("json" in ctype, "o Content-Type e' JSON (veio %r)" % ctype)
        try:
            dados = json.loads(corpo.decode("utf-8"))
        except ValueError as e:
            print("  FALHA  o corpo nao e' JSON: %s" % e)
            return 1
        ok(isinstance(dados, dict), "o corpo e' um objecto")

        print()
        print("=== 2. os campos do clima chegam ao payload ===")
        for chave in sorted(CLIMA):
            ok(chave in dados, "da app: %r" % chave)
        for chave in sorted(DO_JOGO):
            ok(chave in dados, "do jogo: %r" % chave)

        print()
        print("=== 3. o clima esta ACHATADO, e nao dentro de um bloco ===")
        # o `app.js` le `d.rainAmount`. Se alguem embrulhar o bloco num
        # `clima: {...}`, o painel passa a mostrar '--' e nada diz por que.
        for chave in ("rainAmount", "windSpeed", "climaAvailable"):
            ok(chave in dados, "esta no topo: %r" % chave)
        ok("clima" not in dados or not isinstance(dados.get("clima"), dict),
           "nao ha' um d.clima que esconda o resto")

        print()
        print("=== 4. o 'nao sei' chega como -1, e nao como 0 ===")
        # o zero e' "seco", e o -1 e' "a app nao consegue ler". Se este
        # teste passasse com 0, o painel estaria a mentir em silencio --
        # e foi assim que o clima mau-ligado passou despercebido.
        for chave, valor in sorted(CLIMA.items()):
            if chave == "climaAvailable":
                continue
            if valor == "":
                ok(chave in dados, "o texto %r chega" % chave)
                continue
            ok(dados.get(chave) == valor,
               "%s chega a %r quando a app nao le (veio %r)"
               % (chave, valor, dados.get(chave)))
        ok(dados.get("climaAvailable") is False,
           "climaAvailable diz que nao ha CSP (veio %r)"
           % dados.get("climaAvailable"))

        print()
        print("=== 5. o resto da telemetria tambem ===")
        for chave in ("speed", "airTemp", "roadTemp", "airDensity",
                      "surfaceGrip", "packetId"):
            ok(chave in dados, "o payload tem %r" % chave)

        print()
        print("=== 6. /api/opponents ===")
        codigo, corpo, _ = pedir(porta, "/api/opponents")
        ok(codigo == 200, "o codigo e' 200 (veio %d)" % codigo)
        try:
            adv = json.loads(corpo.decode("utf-8"))
        except ValueError as e:
            print("  FALHA  o corpo nao e' JSON: %s" % e)
            adv = {}
        ok("available" in adv, "traz `available` -- e' o que o painel "
                              "le para saber se ha' adversarios")
        ok(isinstance(adv.get("cars"), list), "traz `cars` como lista")

        print()
        print("=== 7. a pagina e' servida ===")
        codigo, corpo, ctype = pedir(porta, "/")
        ok(codigo == 200, "a raiz responde 200 (veio %d)" % codigo)
        ok(b"<!doctype html" in corpo.lower() or b"<html" in corpo.lower(),
           "a raiz e' HTML")

        print()
        print("=== 8. _file() nao serve nada de fora de static/ ===")
        # sete formas de subir a pasta. Quem protege e' o normpath, e nao
        # o startswith -- ver a nota do servidor sobre isso.
        for caminho in ("/../acshm.py",
                        "/../../AGENTS.md",
                        "/..%2f..%2facshm.py",
                        "/static/../../server.py",
                        "/./../../README.md",
                        "/..\\..\\server.py"):
            codigo, corpo, _ = pedir(porta, caminho)
            ok(codigo == 404, "%-28s da 404 (veio %d)" % (caminho, codigo))
            ok(b"def main" not in corpo and b"class Handler" not in corpo,
               "%-28s nao devolve codigo" % caminho)

        print()
        print("=== 9. um ficheiro de dentro de static/ E' servido ===")
        codigo, corpo, _ = pedir(porta, "/app.js")
        ok(codigo == 200, "o app.js responde 200 (veio %d)" % codigo)
        ok(b"Tempo" in corpo, "e' mesmo o app.js")

        print()
        print("=== 10. uma rota desconhecida da' 404, nao a pagina ===")
        codigo, _, _ = pedir(porta, "/api/nao-existe")
        ok(codigo == 404, "rota de API desconhecida da 404 (veio %d)" % codigo)
    finally:
        httpd.shutdown()
        httpd.server_close()

    print()
    print("=" * 60)
    if problemas:
        print("!!! %d FALHA(S) de %d" % (len(problemas), passou + len(problemas)))
        for p in problemas:
            print("  - %s" % p)
        return 1
    print("ok: %d casos. O payload tem o que o painel precisa." % passou)
    return 0


if __name__ == "__main__":
    sys.exit(main())
