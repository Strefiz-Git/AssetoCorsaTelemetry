"""
Onde se guardam asdefinicoes, e a pasta de estatica do frontend.

Saiu do `server.py` para o nucleo, e por uma razao: o `server.py` passou a
servir dois jogos, e cada um tem as suas proprias coisas para guardar. O AC
guarda o caminho onde esta' instalado, porque precisa de ir buscar o
`map.png` e o `map.ini`; o F1 25 nao guarda nada em disco, so' a porta do
socket.

Este modulo e' o unico sitio do servidor que escreve em disco. E' assim
que se sabe, a um `grep`, tudo o que o projecto guarda.
"""

import json
import os

# defs.py esta' em <raiz>/actelemetry/, e o frontend em <raiz>/static/.
# Sao dois niveis para cima, nao um.
#
# Isto esteve errado na primeira versao -- com um dirname a menos, o
# STATIC apontava para a pasta IRMA do repositorio, que nao existe, e o
# servidor respondia 404 a tudo sem uma linha de erro. O 	est_payload.py
# apanhou, e e' a razao de ele pedir a raiz E o pp.js em vez de so a
# API: um teste que so olha para a API passa com um servidor que nao
# serve uma pagina de HTML.
AQUI = os.path.dirname(os.path.abspath(__file__))        # actelemetry/
RAIZ = os.path.dirname(AQUI)                             # a raiz do repo
STATIC = os.path.join(RAIZ, "static")
SETTINGS_FILE = os.path.join(RAIZ, "ac_settings.json")

MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".ttf": "font/ttf",
    ".woff2": "font/woff2",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
    ".json": "application/json; charset=utf-8",
}


def _load_settings():
    if os.path.isfile(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                dados = json.load(f)
            return dados if isinstance(dados, dict) else {}
        except (OSError, ValueError):
            pass
    return {}


def _save_settings(dados):
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(dados, f)
    except OSError:
        pass


def definicoes():
    return _load_settings()


def guardar(dados):
    _save_settings(dados)


def jogo_escolhido():
    """O jogo que o utilizador escolheu, ou None se ainda nao escolheu.

    None e' diferente de um id invalido, e a distincao importa: `None` e'
    "ainda nao escolheu", que e' o que faz aparecer o ecra de escolha ao
    abrir o site. Um id invalido e' "escolheu mas nao existe", que faz o
    servidor cair no padrao e dizer isso no ecra.

    E' o que o `AGENTS.md` chama de "so' um NEGATIVO e' nao disponivel",
    aplicado a escolha: e' melhor um valor que significa "nao se sabe" do
    que um valor inventado que o resto do programa trata como verdade.
    """
    return (_load_settings().get("jogo") or "").strip().lower() or None


def guardar_jogo(jogo_id):
    """Grava a escolha. Devolve o que foi gravado, ja normalizado."""
    dados = _load_settings()
    limpo = (str(jogo_id or "").strip().lower())
    dados["jogo"] = limpo
    _save_settings(dados)
    return limpo
