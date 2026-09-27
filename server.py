"""
Servidor de telemetria do Assetto Corsa.

Lê a shared memory do AC e serve um dashboard no browser. Nao usa o
SimHub, por isso nao ha limite de 10 fps e nao precisa de licenca.

    python server.py              -> http://localhost:8765
    python server.py --port 9000
"""

import argparse
import configparser
import json
import os
import re
import socket
import string
import struct
import sys
import threading
import time
from urllib.parse import parse_qs, quote
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

import acshm

HERE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(HERE, "static")
SETTINGS_FILE = os.path.join(HERE, "ac_settings.json")

MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".ttf": "font/ttf",
    ".woff2": "font/woff2",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
}


# --------------------------------------------------------- pasta do jogo
# O jogo nao publica o mapa da pista na shared memory - so a posicao do
# carro. A imagem (data/map.png) e a escala (data/map.ini) estao nos
# ficheiros do proprio jogo, por isso e' preciso saber onde o AC esta
# instalado para ir busca-los. Sem isto, o site so consegue desenhar o
# tracado a medida que se anda (o comportamento antigo).

def _load_settings():
    if os.path.isfile(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (OSError, ValueError):
            pass
    return {}


def _save_settings(data):
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f)
    except OSError:
        pass


def _is_ac_root(path):
    """Confirma que 'path' e' mesmo a pasta principal do AC (tem content/tracks)."""
    return bool(path) and os.path.isdir(os.path.join(path, "content", "tracks"))


def _steam_library_paths():
    """Le libraryfolders.vdf do Steam para encontrar TODAS as bibliotecas,
    nao so a que tem o Steam instalado (o utilizador pode ter o AC noutro
    disco, como o D:\\SteamLibrary do pedido original)."""
    libs = []
    roots = [
        r"C:\Program Files (x86)\Steam",
        r"C:\Program Files\Steam",
        os.path.expanduser("~/.steam/steam"),
        os.path.expanduser("~/.local/share/Steam"),
    ]
    for root in roots:
        vdf = os.path.join(root, "steamapps", "libraryfolders.vdf")
        if not os.path.isfile(vdf):
            continue
        try:
            with open(vdf, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except OSError:
            continue
        for m in re.finditer(r'"path"\s*"([^"]+)"', content):
            libs.append(m.group(1).replace("\\\\", "\\"))
    return libs


def autodetect_ac_path():
    """Tenta encontrar a pasta do Assetto Corsa sozinho: bibliotecas Steam
    conhecidas (via libraryfolders.vdf) + os sitios mais comuns em cada
    disco. Devolve None se nao encontrar - ai' e' preciso configurar a mao."""
    guesses = []
    for lib in _steam_library_paths():
        guesses.append(os.path.join(lib, "steamapps", "common", "assettocorsa"))
    for letter in string.ascii_uppercase:
        drive = letter + ":\\"
        if not os.path.isdir(drive):
            continue
        for rel in (
            r"SteamLibrary\steamapps\common\assettocorsa",
            r"Steam\steamapps\common\assettocorsa",
            r"Program Files (x86)\Steam\steamapps\common\assettocorsa",
            r"Program Files\Steam\steamapps\common\assettocorsa",
            r"Games\assettocorsa",
        ):
            guesses.append(os.path.join(drive, rel))
    seen = set()
    for g in guesses:
        g = os.path.normpath(g)
        if g in seen:
            continue
        seen.add(g)
        if _is_ac_root(g):
            return g
    return None


def _current_ac_path():
    """O caminho a usar agora: o que o utilizador guardou, ou (se nunca
    guardou nada) uma deteccao automatica, que fica logo gravada para nao
    se repetir a busca em todos os discos a cada pedido."""
    settings = _load_settings()
    saved = (settings.get("ac_path") or "").strip()
    if saved:
        return saved, False
    found = autodetect_ac_path()
    if found:
        settings["ac_path"] = found
        _save_settings(settings)
        return found, True
    return "", False


def _find_track_dir(ac_path, track):
    """content/tracks/<track>, tolerando maiusculas/minusculas diferentes
    (o nome que a shared memory da' e' o nome da pasta, mas por seguranca)."""
    tracks_dir = os.path.join(ac_path, "content", "tracks")
    direct = os.path.join(tracks_dir, track)
    if os.path.isdir(direct):
        return direct
    try:
        names = os.listdir(tracks_dir)
    except OSError:
        return None
    low = track.lower()
    for n in names:
        if n.lower() == low:
            return os.path.join(tracks_dir, n)
    return None


def _png_size(path):
    """Largura e altura de um PNG, lidas do cabecalho IHDR.

    Nao se abre a imagem toda: um map.png pode ter alguns MB e esta funcao
    e' chamada a cada pedido. A assinatura sao 8 bytes, o bloco IHDR tem 13
    e a largura/altura sao os primeiros 4 bytes de cada, em big-endian.
    """
    try:
        with open(path, "rb") as f:
            cab = f.read(24)
    except OSError:
        return None
    if len(cab) < 24 or cab[:8] != b"\x89PNG\r\n\x1a\n" or cab[12:16] != b"IHDR":
        return None
    larg, alt = struct.unpack(">II", cab[16:24])
    if not larg or not alt:
        return None
    return larg, alt


def _first_file(bases, *names):
    """Primeiro ficheiro que exista, testando cada nome em cada base."""
    for base in bases:
        for name in names:
            p = os.path.join(base, name)
            if os.path.isfile(p):
                return p
    return None


def _find_map_files(ac_path, track, track_config):
    """Devolve (map_ini, map_png) ou None.

    ASTRAPOU DO JOGO, e medido em 76 pistas: o map.png esta' NA RAIZ da
    pista (content/tracks/<pista>/map.png) e o map.ini em data/ da MESMA
    pasta. Nao estao os dois em data/ -- procurar os dois em data/ e' o que
    fazia /api/track-map responder sempre "not-found".

    Pistas com varios tracados (ex.: ks_barcelona) tem o data/ dentro de
    uma subpasta por tracado (layout_gp, layout_moto, etc), por isso
    tenta-se primeiro com o trackConfig que veio da telemetria.
    """
    track_dir = _find_track_dir(ac_path, track)
    if not track_dir:
        return None
    bases = []
    if track_config:
        sub = os.path.join(track_dir, track_config)
        if os.path.isdir(sub):
            bases.append(sub)
    bases.append(track_dir)
    try:
        entries = sorted(os.listdir(track_dir))
    except OSError:
        entries = []
    for entry in entries:
        sub = os.path.join(track_dir, entry)
        if os.path.isdir(sub):
            bases.append(sub)

    ini = _first_file(bases, os.path.join("data", "map.ini"), "map.ini")
    png = _first_file(bases, "map.png", os.path.join("data", "map.png"))
    if ini and png:
        return ini, png
    return None


def _parse_map_ini(path):
    cp = configparser.ConfigParser(strict=False)
    try:
        with open(path, "r", encoding="utf-8-sig", errors="ignore") as f:
            content = f.read()
    except OSError:
        return None
    if "[" not in content:
        content = "[PARAMETERS]\n" + content
    try:
        cp.read_string(content)
    except configparser.Error:
        return None
    sec = cp[cp.sections()[0]] if cp.sections() else {}

    def getf(key, default=0.0):
        for k in sec:
            if k.lower() == key.lower():
                try:
                    return float(sec[k])
                except ValueError:
                    return default
        return default

    scale = getf("SCALE_FACTOR", 1.0) or 1.0
    return {
        "width": getf("WIDTH"),
        "height": getf("HEIGHT"),
        "scale": scale,
        "offsetX": getf("X_OFFSET"),
        "offsetZ": getf("Z_OFFSET"),
    }


# ------------------------------------------------------------------ estado
class Hub:
    """Estado partilhado: um unico thread le a memoria, varios clientes leem."""

    def __init__(self, rate_hz=200, opp_rate_hz=10):
        self.rate = 1.0 / rate_hz
        self.opp_rate = 1.0 / opp_rate_hz
        self.lock = threading.Lock()
        self.latest = {"connected": False, "live": False}
        self.opponents = {"available": False, "cars": []}
        self.frames = 0
        self._stop = threading.Event()
        self._thread = None

    def start(self):
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop.set()

    def _loop(self):
        tel = acshm.ACTelemetry()
        opp = acshm.Opponents()
        next_opp = 0.0
        while not self._stop.is_set():
            try:
                snap = tel.snapshot()
            except Exception as e:
                snap = {"connected": False, "live": False, "error": str(e)}
            with self.lock:
                self.latest = snap
                if snap.get("connected"):
                    self.frames += 1
            # os adversarios nao precisam de 60 Hz: 10 chega para o
            # leaderboard e evita 128 carros a cada frame
            now = time.time()
            if now >= next_opp:
                next_opp = now + self.opp_rate
                try:
                    osnap = opp.snapshot()
                except Exception as e:
                    osnap = {"available": False, "cars": [], "error": str(e)}
                with self.lock:
                    self.opponents = osnap
            time.sleep(self.rate)

    def get(self):
        with self.lock:
            return self.latest

    def get_opponents(self):
        with self.lock:
            return self.opponents


# ------------------------------------------------------------------ server
def lan_ip():
    """IP da maquina na rede local, para aceder a partir do telemovel."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        ip = "127.0.0.1"
    return ip


class Servidor(ThreadingHTTPServer):
    """Servidor HTTP que fica calado quando um cliente se vai embora.

    Um browser que cancela uma ligacao - o que acontece sempre que se
    reinicia o servidor com paginas abertas, porque os EventSource ficam
    a reconectar, e tambem quando o Chrome desfaz uma ligacao que ja nao
    precisa - produz um ConnectionAbortedError (WinError 10053 no
    Windows). O socketserver apanha isso e imprime o traceback inteiro,
    quatro ou cinco vezes, e parece que o servidor esta a partir quando
    nao esta a partir de nada.

    O sitio certo para abafar e' aqui, e nao no Handler: o
    socketserver apanha a excepcao em process_request_thread, que fica
    ACIMA de qualquer try dentro do handle(), e chama handle_error.
    Uma correccao posta no Handler nao chega a ver o erro - foi o que
    aconteceu da primeira vez, e o teste apanhou. Ver
    tests/test_handler.py.
    """

    # Ligacao cortada pelo cliente: normal, nao e' erro do servidor.
    DESLIGUE_ESPERADO = (ConnectionAbortedError, ConnectionResetError,
                         BrokenPipeError, ConnectionError, TimeoutError)

    daemon_threads = True

    def handle_error(self, request, client_address):
        exc = sys.exc_info()[1]
        if isinstance(exc, self.DESLIGUE_ESPERADO):
            return                      # esperado: silencio
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

    def _file(self, rel):
        # A verificacao e' por CONTEUDO, e nao por `startswith`.
        #
        # `path.startswith(STATIC)` e' verificacao por prefixo, e tem duas
        # falhas conhecidas. A primeira: `C:\proj\static` e' prefixo de
        # `C:\proj\static_secreto`, que e' outra coisa. A segunda: o
        # Windows e' case-insensitive e `startswith` nao e', portanto um
        # caminho com as letras todas em maiusculas e' rejeitado mesmo
        # sendo o mesmo caminho.
        #
        # Nao ha' `static_secreto` ao lado de `static` hoje, por isso a
        # forma actual nao e' exploravel -- e o `test_payload.py` prova
        # isso com seis formas de subir a pasta. Mas a verificacao
        # dizia que protegia o que so' protege o NOME da pasta, e uma
        # proteccao que protege ate quando muda e' uma proteccao que
        # ninguem deve deixar quieta.
        #
        # O `commonpath` responde as duas de uma vez: devolve o caminho
        # comum mais longo, e so' coincide com `STATIC` quando o ficheiro
        # esta mesmo dentro. Se `alvo` estiver noutra unidade, levanta
        # ValueError -- e uma unidade diferente NAO e' dentro de nada
        # nosso, logo e' False.
        alvo = os.path.normpath(os.path.join(STATIC, rel.lstrip("/\\")))
        try:
            dentro = os.path.commonpath([alvo, STATIC]) == STATIC
        except ValueError:
            dentro = False          # outra unidade: fora, sem discussao
        if not dentro or not os.path.isfile(alvo):
            return self._send(404, b"nao encontrado")
        with open(alvo, "rb") as f:
            data = f.read()
        ext = os.path.splitext(alvo)[1].lower()
        self._send(200, data, MIME.get(ext, "application/octet-stream"))

    # -- rotas ---------------------------------------------------------
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        query = self.path.split("?", 1)[1] if "?" in self.path else ""
        if path in ("/", "/index.html"):
            return self._file("index.html")
        if path == "/api/state":
            return self._send(200, json.dumps(self.hub.get()).encode(),
                              "application/json; charset=utf-8")
        if path == "/api/opponents":
            return self._send(200, json.dumps(self.hub.get_opponents()).encode(),
                              "application/json; charset=utf-8")
        if path == "/api/lan":
            return self._send(200, json.dumps(self._lan()).encode(),
                              "application/json; charset=utf-8")
        if path == "/events":
            return self._events(query)
        if path == "/events/opponents":
            return self._events_opponents(query)
        if path == "/api/settings":
            return self._api_settings_get()
        if path == "/api/track-map":
            return self._api_track_map(query)
        if path == "/api/track-map-image":
            return self._api_track_map_image(query)
        return self._file(path)

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/settings":
            return self._api_settings_post()
        return self._send(404, b"nao encontrado")

    def _api_settings_get(self):
        ac_path, autodetected = _current_ac_path()
        body = {
            "acPath": ac_path,
            "acPathValid": _is_ac_root(ac_path),
            "autodetected": autodetected,
        }
        return self._send(200, json.dumps(body).encode(),
                          "application/json; charset=utf-8")

    def _api_settings_post(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            data = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            data = {}
        ac_path = str(data.get("acPath") or "").strip().strip('"')
        settings = _load_settings()
        settings["ac_path"] = ac_path
        _save_settings(settings)
        body = {"acPath": ac_path, "acPathValid": _is_ac_root(ac_path)}
        return self._send(200, json.dumps(body).encode(),
                          "application/json; charset=utf-8")

    @staticmethod
    def _qs(query):
        return {k: v[0] for k, v in parse_qs(query).items()}

    def _api_track_map(self, query):
        q = self._qs(query)
        track = q.get("track", "")
        track_config = q.get("config", "")
        if not track:
            return self._send(400, b'{"available":false,"reason":"sem pista"}',
                              "application/json; charset=utf-8")
        ac_path, _ = _current_ac_path()
        if not _is_ac_root(ac_path):
            body = {"available": False, "reason": "no-path"}
            return self._send(200, json.dumps(body).encode(),
                              "application/json; charset=utf-8")
        found = _find_map_files(ac_path, track, track_config)
        if not found:
            body = {"available": False, "reason": "not-found"}
            return self._send(200, json.dumps(body).encode(),
                              "application/json; charset=utf-8")
        ini_path, png_path = found
        cfg = _parse_map_ini(ini_path)
        if not cfg:
            body = {"available": False, "reason": "bad-ini"}
            return self._send(200, json.dumps(body).encode(),
                              "application/json; charset=utf-8")
        cfg["available"] = True
        cfg["imageUrl"] = ("/api/track-map-image?track=" + quote(track)
                            + "&config=" + quote(track_config or ""))
        self._add_image_scale(cfg, png_path)
        return self._send(200, json.dumps(cfg).encode(),
                          "application/json; charset=utf-8")

    @staticmethod
    def _add_image_scale(cfg, png_path):
        """Acrescenta os pixels por metro, e diz se os dados da pista sao
        de confianca.

        MEDIDO com um trajecto real de Monza (206 pontos), medindo a
        distancia de cada ponto a linha desenhada no map.png:

            imgX = (x + X_OFFSET) / SCALE_FACTOR   ->  mediana 0 px
            imgX = (x + X_OFFSET)                   ->  mediana 132 m
            imgX = (x + X_OFFSET) * SCALE_FACTOR   ->  fora da imagem

        O SCALE_FACTOR e' mesmo a escala: e' px por METRO quem fica a
        dividi-lo. Monza tem SCALE_FACTOR 1,4, e por isso um pixel da imagem
        vale 1,4 metros do mundo.

        O que engana e' o WIDTH/HEIGHT do map.ini. Bate ao pixel com as
        dimensoes do PNG (monza 927,4 -> 927 px), e da' a ideia de que a
        imagem tem um pixel por metro. Nao tem: o WIDTH esta' em PIXEIS DA
        IMAGEM, e a extensao do mundo e' WIDTH * SCALE_FACTOR metros.

        E' a mesma armadilha da Regra nº 11: Baku e' a pista onde isto se
        mede primeiro, e Baku tem SCALE_FACTOR 1, onde as duas leituras dao
        o mesmo numero. Uma amostra que nao discrimina parece uma
        confirmacao -- e foi exactamente o que aconteceu.

        O trusted apanha as pistas em que os dados nao batem com a propria
        imagem (ek_irohazaka: WIDTH 2368 numa imagem de 1993 px; Brooklyn
        Park: 365,9 em 355 px e 350,4 em 200 px). Aí o cliente volta ao
        mapa tracado, que e' sempre certo.
        """
        dim = _png_size(png_path)
        if not dim:
            cfg["available"] = False
            return
        img_w, img_h = dim
        cfg["imageWidth"] = img_w
        cfg["imageHeight"] = img_h
        escala = cfg.get("scale") or 0.0
        if escala <= 0:
            cfg["available"] = False
            return
        cfg["pxPerMetre"] = round(1.0 / escala, 8)
        w = cfg.get("width") or 0.0
        h = cfg.get("height") or 0.0
        # o WIDTH/HEIGHT do ini tem de descrever a imagem em pixeis
        cfg["trusted"] = bool(w > 0 and h > 0
                              and abs(w - img_w) <= 2 and abs(h - img_h) <= 2)

    def _api_track_map_image(self, query):
        q = self._qs(query)
        track = q.get("track", "")
        track_config = q.get("config", "")
        ac_path, _ = _current_ac_path()
        found = _find_map_files(ac_path, track, track_config) if _is_ac_root(ac_path) else None
        if not found:
            return self._send(404, b"nao encontrado")
        _ini, png_path = found
        try:
            with open(png_path, "rb") as f:
                data = f.read()
        except OSError:
            return self._send(404, b"nao encontrado")
        return self._send(200, data, "image/png", {"Cache-Control": "public, max-age=3600"})

    @staticmethod
    def _fps(query, default=60, lo=5, hi=60):
        """fps pedido pelo browser (?fps=30). Fica sempre dentro do razoavel:
        nem 1 fps (inutil), nem 200 (so queima CPU e bateria)."""
        try:
            for pair in query.split("&"):
                if pair.startswith("fps="):
                    v = int(float(pair[4:]))
                    return max(lo, min(hi, v))
        except (ValueError, TypeError):
            pass
        return default

    def _lan(self):
        return {"ip": lan_ip(), "port": self.server.server_address[1]}

    def _sse_head(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-store")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

    def _events(self, query=""):
        """Telemetria do jogador, ao ritmo que este cliente pediu."""
        fps = self._fps(query)
        self._sse_head()
        period = 1.0 / fps
        next_t = time.time()
        try:
            while True:
                now = time.time()
                if now < next_t:
                    time.sleep(next_t - now)
                next_t += period
                if next_t < now:              # atrasou: nao acumula
                    next_t = now + period
                payload = json.dumps(self.hub.get(), separators=(",", ":"))
                self.wfile.write(b"data: " + payload.encode() + b"\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            pass

    def _events_opponents(self, query=""):
        """Adversarios. 10 Hz por predefinicao: 128 carros a 60 Hz seriam
        ~25 KB por frame, e para uma tabela isso e' desperdicio."""
        fps = self._fps(query, default=10, lo=2, hi=30)
        self._sse_head()
        period = 1.0 / fps
        next_t = time.time()
        try:
            while True:
                now = time.time()
                if now < next_t:
                    time.sleep(next_t - now)
                next_t += period
                if next_t < now:
                    next_t = now + period
                payload = json.dumps(self.hub.get_opponents(), separators=(",", ":"))
                self.wfile.write(b"data: " + payload.encode() + b"\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--rate", type=int, default=200, help="amostras por segundo")
    ap.add_argument("--abrir", action="store_true",
                    help="abre o browser quando o servidor ja esta a ouvir")
    ap.add_argument("--bind", default="0.0.0.0",
                    help="endereco a que se liga. 0.0.0.0 e' a rede toda; "
                         "127.0.0.1 so' neste PC")
    args = ap.parse_args()

    hub = Hub(rate_hz=args.rate)
    hub.start()
    Handler.hub = hub

    srv = Servidor((args.bind, args.port), Handler)
    srv.daemon_threads = True

    ip = lan_ip()
    so_local = args.bind in ("127.0.0.1", "localhost", "::1")
    print("=" * 56)
    print("  Telemetria do Assetto Corsa")
    print("=" * 56)
    if so_local:
        print(f"  Neste PC : http://localhost:{args.port}/")
        print("  Nao aceita ligacoes de fora. Para as aceitar:")
        print(f"    python server.py --bind 0.0.0.0 --port {args.port}")
    else:
        print(f"  Neste PC : http://localhost:{args.port}/")
        print(f"  Rede     : http://{ip}:{args.port}/")
        if not so_local:
            print()
            print("  AVISO: qualquer pessoa na mesma rede pode ver os teus")
            print("  dados de telemetria e mudar a pasta do jogo em")
            print("  /api/settings. Nao ha palavra-passe. Numa rede de casa")
            print("  ou de trabalho isso e' aceitavel; numa rede de hotel,")
            print("  de cafetaria ou de faculdade, nao.")
            print(f"  Para fechar: python server.py --bind 127.0.0.1 --port {args.port}")
    print(f"  leitura : {args.rate} amostras/s, difusao a 60 Hz")
    print("  Ctrl+C para parar")
    print("=" * 56)

    # Abrir o browser e' trabalho do servidor, e nao do .bat, porque o
    # servidor e' o unico que sabe quando a porta ja esta a aceitar
    # ligacoes. Do lado do .bat era preciso adivinhar com um sleep, e
    # adivinhar o tempo de arranque e' correr: ou o browser pede a pagina
    # cedo demais e da erro de ligacao, ou espera-se sem necessidade.
    # O socket ja esta em listen aqui, porque o ThreadingHTTPServer faz
    # listen no construtor.
    if args.abrir:
        def abrir():
            time.sleep(0.2)
            try:
                import webbrowser
                webbrowser.open(f"http://localhost:{args.port}/")
            except Exception:
                pass          # sem browser registado no sistema: nao e' fatal
        threading.Thread(target=abrir, daemon=True).start()

    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nparado.")
    finally:
        hub.stop()
        srv.shutdown()


if __name__ == "__main__":
    main()
