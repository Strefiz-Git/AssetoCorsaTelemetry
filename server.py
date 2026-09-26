"""
Servidor de telemetria do Assetto Corsa.

Lê a shared memory do AC e serve um dashboard no browser. Nao usa o
SimHub, por isso nao ha limite de 10 fps e nao precisa de licenca.

    python server.py              -> http://localhost:8765
    python server.py --port 9000
"""

import argparse
import json
import os
import socket
import threading
import time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

import acshm

HERE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(HERE, "static")

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


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    hub = None

    def log_message(self, fmt, *args):
        pass                      # silencio: 60 fps enche o log

    # -- utilitarios ---------------------------------------------------
    def _send(self, code, body=b"", ctype="text/plain; charset=utf-8",
              extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if body:
            self.wfile.write(body)

    def _file(self, rel):
        path = os.path.normpath(os.path.join(STATIC, rel.lstrip("/")))
        if not path.startswith(STATIC) or not os.path.isfile(path):
            return self._send(404, b"nao encontrado")
        ext = os.path.splitext(path)[1].lower()
        with open(path, "rb") as f:
            data = f.read()
        self._send(200, data, MIME.get(ext, "application/octet-stream"))

    # -- rotas ---------------------------------------------------------
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html"):
            return self._file("index.html")
        if path == "/api/state":
            return self._send(200, json.dumps(self.hub.get()).encode(),
                              "application/json; charset=utf-8")
        if path == "/api/lan":
            return self._send(200, json.dumps(self._lan()).encode(),
                              "application/json; charset=utf-8")
        if path == "/events":
            return self._events()
        return self._file(path)

    def _lan(self):
        return {"ip": lan_ip(), "port": self.server.server_address[1]}

    def _events(self):
        """Server-Sent Events: empurra um snapshot por frame, a 60 Hz."""
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-store")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        period = 1.0 / 60.0
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--rate", type=int, default=200, help="amostras por segundo")
    args = ap.parse_args()

    hub = Hub(rate_hz=args.rate)
    hub.start()
    Handler.hub = hub

    srv = ThreadingHTTPServer(("0.0.0.0", args.port), Handler)
    srv.daemon_threads = True

    ip = lan_ip()
    print("=" * 56)
    print("  Telemetria do Assetto Corsa")
    print("=" * 56)
    print(f"  Este PC : http://localhost:{args.port}/")
    print(f"  Rede    : http://{ip}:{args.port}/")
    print(f"  leitura : {args.rate} amostras/s, difusao a 60 Hz")
    print("  Ctrl+C para parar")
    print("=" * 56)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nparado.")
    finally:
        hub.stop()
        srv.shutdown()


if __name__ == "__main__":
    main()
