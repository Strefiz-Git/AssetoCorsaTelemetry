"""
O servidor HTTP e o SSE. Nao sabe qual e' o jogo.

Este ficheiro e' o nucleo do painel, e a propriedade que interessa e' o
que ele NAO sabe: nao sabe o que e' memoria partilhada, nao sabe o que e'
UDP, nao sabe o que e' um `map.png`, e nao sabe que o Assetto Corsa se
instala em `assettocorsa/apps/python`.

Ele sabe tres coisas, e sao as mesmas para os dois jogos:

  1. servir a pagina e o CSS e o JavaScript
  2. entregar um dicionario de estado a cada cliente, ao ritmo que ele pedir
  3. aceder a um jogo registado, e a mais nada

O que e' especifico de um jogo entra por `jogo.rotas()`, que devolve um
dicionario `caminho -> (metodo, funcao)`. Um jogo novo com rotas suas
nao obriga a mudar uma linha deste ficheiro. E' a razao de o mapa do AC
ter sa'do `server.py` para `jogos/ac/mapa.py`: deixar ali era deixar o
conhecimento de um jogo no sitio onde se serve o outro.
"""

import json
import socket
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

from . import defs, jogos

# A cadencia que o navegador pode pedir, e o tecto. Nem 1 fps (inutil),
# nem 200 (queima CPU e bateria e nao acrescenta nada a ver um numero
# que muda 60 vezes por segundo).
FPS_MIN, FPS_MAX = 5, 60


def lan_ip():
    """O IP da maquina na rede local, para aceder a partir do telemovel."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        ip = "127.0.0.1"
    return ip


class Servidor(ThreadingHTTPServer):
    """Um servidor HTTP que fica calado quando um cliente se vai embora.

    Um browser que cancela uma ligacao -- o que acontece sempre que se
    reinicia o servidor com paginas abertas, porque os EventSource ficam a
    reconectar, e tambem quando o Chrome desfaz uma ligacao que ja nao
    precisa -- produz um `ConnectionAbortedError` (WinError 10053 no
    Windows). O `socketserver` apanha isso e imprime o traceback inteiro,
    quatro ou cinco vezes, e parece que o servidor esta' a partir quando
    nao esta' a partir de nada.

    O sitio certo para abafar e' aqui, e nao no Handler: o `socketserver`
    apanha a excepcao em `process_request_thread`, que fica ACIMA de
    qualquer `try` dentro do `handle()`, e chama `handle_error`. Uma
    correccao posta no Handler nao chega a ver o erro. Ver
    `tests/test_handler.py`.
    """

    DESLIGUE_ESPERADO = (ConnectionAbortedError, ConnectionResetError,
                         BrokenPipeError, ConnectionError, TimeoutError)

    daemon_threads = True

    def handle_error(self, request, client_address):
        exc = sys.exc_info()[1]
        if isinstance(exc, self.DESLIGUE_ESPERADO):
            return
        super().handle_error(request, client_address)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    hub = None

    def log_message(self, fmt, *args):
        pass                      # silencio: 60 fps enche o log

    # -- utilitarios ---------------------------------------------------
    def _send(self, code, body=b"", ctype="text/plain; charset=utf-8",
              extra=None):
        extra = extra or {}
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        if "Cache-Control" not in extra:
            self.send_header("Cache-Control", "no-store")
        for k, v in extra.items():
            self.send_header(k, v)
        self.end_headers()
        if body:
            self.wfile.write(body)

    def _json(self, obj, code=200):
        self._send(code, json.dumps(obj, separators=(",", ":")).encode(),
                   "application/json; charset=utf-8")

    def _file(self, rel):
        """Serve um ficheiro de `static/`, sem sair de la.

        A verificacao e' por CONTEUDO, e nao por `startswith`.

        `path.startswith(STATIC)` e' verificacao por prefixo, e tem duas
        falhas conhecidas. A primeira: `C:\\proj\\static` e' prefixo de
        `C:\\proj\\static_secreto`, que e' outra coisa. A segunda: o Windows
        e' case-insensitive e `startswith` nao e', portanto um caminho com
        as letras todas em maiusculas e' rejeitado mesmo sendo o mesmo
        caminho.

        Nao ha' `static_secreto` ao lado de `static` hoje, por isso a
        forma actual nao e' exploravel -- e o `test_payload.py` prova isso
        com seis formas de subir a pasta. Mas a verificacao dizia que
        protegia o que so' protege o NOME da pasta, e uma proteccao que
        protege ate quando muda e' uma proteccao que ninguem deve deixar
        quieta.

        O `commonpath` responde as duas de uma vez: devolve o caminho
        comum mais longo, e so' coincide com `STATIC` quando o ficheiro
        esta mesmo dentro. Se `alvo` estiver noutra unidade, levanta
        ValueError -- e uma unidade diferente NAO e' dentro de nada nosso.
        """
        import os
        alvo = os.path.normpath(os.path.join(defs.STATIC, rel.lstrip("/\\")))
        try:
            dentro = os.path.commonpath([alvo, defs.STATIC]) == defs.STATIC
        except ValueError:
            dentro = False
        if not dentro or not os.path.isfile(alvo):
            return self._send(404, b"nao encontrado")
        try:
            with open(alvo, "rb") as f:
                data = f.read()
        except OSError:
            return self._send(404, b"nao encontrado")
        ext = os.path.splitext(alvo)[1].lower()
        self._send(200, data, defs.MIME.get(ext, "application/octet-stream"))

    # -- as rotas do jogo activo ---------------------------------------
    def _jogo_activo(self):
        """O jogo do hub, ou None.

        `getattr` e' deliberado: o Handler tambem e' usado pelos testes com
        um hub de mentira que so tem `get()` e `get_opponents()`. Um
        `self.hub.jogo` directo rebentava com um AttributeError dentro do
        pedido, e o cliente via "Remote end closed connection without
        response" -- que e' a forma mais cara de dizer "falhou".
        """
        return getattr(self.hub, "jogo", None) if self.hub else None

    def _rota_do_jogo(self, path, metodo):
        """Chama a rota que o jogo activo registou para este caminho.

        E' o unico ponto de contacto entre o nucleo e o que e'
        especifico de um jogo. A funcao devolve um dicionario com
        `__status` e `body`; o `body` pode ser bytes (uma imagem) ou um
        objecto (sera' serializado).
        """
        jogo = self._jogo_activo()
        if jogo is None:
            return None
        try:
            rotas = jogo.rotas() or {}
        except Exception as e:
            return {"__status": 500,
                    "body": json.dumps({"erro": str(e)}).encode()}
        entrada = rotas.get(path)
        if not entrada or entrada[0] != metodo:
            return None
        try:
            r = entrada[1](self.query)
        except Exception as e:
            return {"__status": 500,
                    "body": json.dumps({"erro": str(e)}).encode()}
        if r is None:
            return {"__status": 404, "body": b"nao encontrado"}
        return r

    def _enviar_rota(self, r):
        if r is None:
            return False
        body = r.get("body", b"")
        code = r.get("__status", 200)
        extra = r.get("extra") or {}
        ctype = r.get("ctype") or "application/json; charset=utf-8"
        if not isinstance(body, (bytes, bytearray)):
            body = json.dumps(body, separators=(",", ":")).encode()
        self._send(code, body, ctype, extra)
        return True

    # Os tres Talking Points com o Hub.
    #
    # `getattr` em vez de ponto, e nao por defensividade gratuit: o Handler
    # e' tambem o que os testes usam, com um hub de mentira que so tem
    # `get()` e `get_opponents()`. Um `self.hub.capacidades` directo
    # rebentava com um AttributeError DENTRO do pedido, e o cliente via
    # "Remote end closed connection without response" -- que e' a forma
    # mais cara de dizer "falhou", porque nao diz o que.
    #
    # A alternativa seria obrigar o hub de mentira a ter os tres metodos,
    # que e' pior: o hub de mentira passaria a ter de saber a interface do
    # hub verdadeiro para poder fingi-lo.
    def _do_hub(self, nome, *args):
        f = getattr(self.hub, nome, None)
        return f(*args) if callable(f) else None

    def _capacidades(self):
        return self._do_hub("capacidades") or {}

    def _diagnostico(self):
        return self._do_hub("diagnostico") or {}

    def _trocar(self, novo):
        r = self._do_hub("trocar_de_jogo", novo)
        return r if r is not None else novo

    # -- o que se pede ao servidor -------------------------------------
    def do_GET(self):
        self.path, _, self.query = self.path.partition("?")

        # As rotas do jogo primeiro, para que `/api/track-map` do AC
        # chegue ao AC e nao a um 404 generico.
        if self._enviar_rota(self._rota_do_jogo(self.path, "GET")):
            return

        if self.path in ("/", "/index.html"):
            return self._file("index.html")
        if self.path == "/api/state":
            return self._json(self.hub.get())
        if self.path == "/api/opponents":
            return self._json(self.hub.get_opponents())
        if self.path == "/api/games":
            # A lista de jogos, para o ecra de escolha. Vem do registo e
            # nao do nucleo, para o nucleo nao saber os nomes.
            return self._json({"jogo": getattr(self.hub, "jogo_id", None),
                               "jogos": jogos.para_o_ecra()})
        if self.path == "/api/capabilities":
            return self._json(self._capacidades())
        if self.path == "/api/diagnostics":
            return self._json(self._diagnostico())
        if self.path == "/api/lan":
            return self._json({"ip": lan_ip(),
                               "porta": self.server.server_address[1]})
        if self.path == "/events":
            return self._events(self.query)
        if self.path == "/events/opponents":
            return self._events_opponents(self.query)
        if self.path == "/api/settings":
            return self._json(self._settings_get())
        return self._file(self.path)

    def do_POST(self):
        self.path, _, self.query = self.path.partition("?")
        if self.path == "/api/settings":
            return self._settings_post()
        if self.path == "/api/game":
            return self._game_post()
        return self._send(404, b"nao encontrado")

    # -- definicoes ----------------------------------------------------
    def _corpo(self):
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
            raw = self.rfile.read(length) if length else b"{}"
            dados = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError, OSError):
            return {}
        return dados if isinstance(dados, dict) else {}

    def _settings_get(self):
        """O que se pode definir, e onde esta cada coisa.

        Cada definicao diz QUAL jogo e dela. E' por isso que o `acPath` nao
        aparece quando o jogo activo e' o F1 25: nao ha' pasta para
        escolher, e mostrar um campo de texto que nao faz nada e' pior do
        que nao o mostrar. O frontend so precisa de ler `pertenceA` e
        esconder o resto.
        """
        d = defs.definicoes()
        corpo = {
            "jogo": defs.jogo_escolhido(),
            "jogoActivo": getattr(self.hub, "jogo_id", None),
            "definicoes": [
                {"chave": "jogo", "tipo": "escolha", "rotulo": "Jogo",
                 "jogo": None, "valor": defs.jogo_escolhido()},
                {"chave": "acPath", "tipo": "texto", "rotulo": "Pasta do jogo",
                 "jogo": "ac", "valor": (d.get("ac_path") or "").strip()},
            ],
        }
        return corpo

    def _settings_post(self):
        dados = self._corpo()
        atual = defs.definicoes()
        mudou_jogo = False
        if "acPath" in dados:
            atual["ac_path"] = str(dados.get("acPath") or "").strip().strip('"')
        if "jogo" in dados:
            defs.guardar_jogo(dados.get("jogo"))
            mudou_jogo = True
        if dados:
            defs.guardar(atual)
        if mudou_jogo:
            self._trocar(defs.jogo_escolhido())
        return self._json(self._settings_get())

    def _game_post(self):
        """Trocar de jogo sem reiniciar o servidor."""
        dados = self._corpo()
        novo = defs.guardar_jogo(dados.get("jogo"))
        activo = self._trocar(novo)
        return self._json({"jogoPedido": novo, "jogoActivo": activo,
                           "jogos": jogos.para_o_ecra(),
                           "capacidades": self._capacidades()})

    # -- o fluxo -------------------------------------------------------
    @staticmethod
    def _fps(query, default=60, lo=FPS_MIN, hi=FPS_MAX):
        try:
            for pair in query.split("&"):
                if pair.startswith("fps="):
                    return max(lo, min(hi, int(float(pair[4:]))))
        except (ValueError, TypeError):
            pass
        return default

    def _sse_head(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-store")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

    def _stream(self, fonte, fps):
        """O loop de SSE, comum aos dois canais.

        A correccao do `next_t` e' o que impede que um cliente lento
        acumule: se o frame demorou mais do que o periodo, o proximo
        marca-se a partir de AGORA e nao a partir de quando devia. Sem
        isso, um cliente que demore 300 ms com 60 fps pedidos vai
        acumular e, daqui a pouco, estar 2000 frames atrasado -- a mostrar
        telemetria de dois segundos atrasada e sem nenhuma indicação de
        isso.
        """
        self._sse_head()
        periodo = 1.0 / fps
        next_t = time.time()
        try:
            while True:
                agora = time.time()
                if agora < next_t:
                    time.sleep(next_t - agora)
                next_t += periodo
                if next_t < agora:
                    next_t = agora + periodo
                payload = json.dumps(fonte(), separators=(",", ":"))
                self.wfile.write(b"data: " + payload.encode() + b"\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError,
                OSError):
            pass

    def _events(self, query=""):
        """A telemetria do jogador, ao ritmo que este cliente pediu."""
        self._stream(lambda: self.hub.get(), self._fps(query))

    def _events_opponents(self, query=""):
        """Os adversarios, a 10 Hz por omissao."""
        self._stream(lambda: self.hub.get_opponents(),
                     self._fps(query, default=10, lo=2, hi=30))
