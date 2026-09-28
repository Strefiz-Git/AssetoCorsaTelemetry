"""
O mapa da pista do Assetto Corsa: onde estao os ficheiros e como se leem.

Isto saiu do `server.py` para aqui por uma razao, e a razao e' o
objectivo do projecto: o `server.py` passou a ter DOIS jogos, e o mapa do
AC e' a unica parte dele que precisa de saber onde o Assetto Corsa esta'
instalado. Deixar isso no servidor era deixar o knowledge de um jogo no
sitio onde se Poole o outro, e o primeiro bug a aparecer seria o F1 25
pedir um `map.png` que nao existe em lado nenhum.

O F1 25 nao tem ficheiro de mapa. Desenha-se o tracado a medida que se
conduz, a partir das coordenadas do pacote Motion -- que e' exactamente o
caminho que o AC tem como alternativa quando nao encontra o `map.png`.
Nao e' um buraco, e' o mesmo desenho.

A REGRA DO SCALE_FACTOR, que e' o mais importante deste ficheiro
-----------------------------------------------------------------
Medido com um trajecto real de Monza (206 pontos), medindo a distancia
de cada ponto a linha desenhada no `map.png`:

    imgX = (x + X_OFFSET) / SCALE_FACTOR   ->  mediana 0 px
    imgX = (x + X_OFFSET)                   ->  mediana 132 m
    imgX = (x + X_OFFSET) * SCALE_FACTOR   ->  fora da imagem

O `SCALE_FACTOR` E' a escala: e' px por metro quem fica a dividi-lo.
Monza tem `SCALE_FACTOR = 1,4`, e um pixel da imagem vale 1,4 metros.

O que engana e' o `WIDTH`/`HEIGHT` do `map.ini`. Bate ao pixel com as
dimensoes do PNG (monza 927,4 -> 927 px; imola 1543,9 -> 1543; montreal
508,8 -> 508; spa 1004,8 -> 1004). Isso PARECE provar "1 pixel por metro",
e parece tao bem que a regra foi escrita com essa conclusao.

Mas o `WIDTH` esta' em PIXEIS DA IMAGEM, e a extensao do mundo e'
`WIDTH * SCALE_FACTOR` metros. O `map.ini` mistura as duas unidades no
mesmo ficheiro, e o nome do campo nao diz qual e'.

E a pista onde isto se mediu primeiro foi a que NAO discriminava: Baku tem
`SCALE_FACTOR = 1`, e com escala 1 as duas leituras dao o mesmo numero. Foi
a confirmacao de uma amostra incapaz de discordar. Monza
(`SCALE_FACTOR = 1,4`) e' que separou as hipoteses. Ver a Regra no 11.
"""

import configparser
import os
import re
import struct
import string

from .defs import _load_settings, _save_settings


# ------------------------------------------------------- onde esta o AC
def _is_ac_root(path):
    """Confirma que 'path' e' mesmo a pasta principal do AC (tem content/tracks)."""
    return bool(path) and os.path.isdir(os.path.join(path, "content", "tracks"))


def _steam_library_paths():
    """Le o libraryfolders.vdf do Steam para encontrar TODAS as bibliotecas,
    nao so a que tem o Steam instalado (o utilizador pode ter o AC noutro
    disco)."""
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
    """Tenta encontrar a pasta do Assetto Corsa sozinho. Devolve None se nao
    encontrar -- ai e' preciso configurar a mao."""
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


def caminho_ac():
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


# ------------------------------------------------------------ os ficheiros
def _find_track_dir(ac_path, track):
    """content/tracks/<track>, tolerando maiusculas/minusculas diferentes."""
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

    Nao se abre a imagem toda: um `map.png` pode ter alguns MB e esta
    funcao e' chamada a cada pedido. A assinatura sao 8 bytes, o bloco
    IHDR tem 13, e a largura/altura sao os primeiros 4 bytes de cada, em
    big-endian.
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

    ASTRAPOU DO JOGO, e medido em 76 pistas: o `map.png` esta' NA RAIZ da
    pista (`content/tracks/<pista>/map.png`) e o `map.ini` em `data/` da
    MESMA pasta. Nao estao os dois em `data/` -- procurar os dois em
    `data/` e' o que fazia `/api/track-map` responder sempre
    "not-found", sem erro nenhum.

    Pistas com varios tracados (ex.: `ks_barcelona`) tem o `data/` dentro
    de uma subpasta por tracado (`layout_gp`, `layout_moto`, etc), por
    isso tenta-se primeiro com o `trackConfig` que veio da telemetria.
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

    return {
        "width": getf("WIDTH"),
        "height": getf("HEIGHT"),
        "scale": getf("SCALE_FACTOR", 1.0) or 1.0,
        "offsetX": getf("X_OFFSET"),
        "offsetZ": getf("Z_OFFSET"),
    }


def _add_image_scale(cfg, png_path):
    """Acrescenta os pixels por metro, e diz se os dados da pista sao de
    confianca.

    O `WIDTH`/`HEIGHT` do ini tem de descrever a imagem em pixeis. Em 54
    das 76 pistas bate; onde nao bate, os dados estao errados e o mapa
    sairia torto -- `ek_irohazaka` (WIDTH 2368 numa imagem de 1993 px) e
    `Brooklyn Park` (365,9 em 355 px, 350,4 em 200 px). A'i o servidor
    manda `trusted: false` e o cliente volta ao mapa tracado, que e'
    sempre correcto.
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
    # 1 / SCALE_FACTOR, e' o que da os px por metro. Ver a nota do topo.
    cfg["pxPerMetre"] = round(1.0 / escala, 8)
    w = cfg.get("width") or 0.0
    h = cfg.get("height") or 0.0
    cfg["trusted"] = bool(w > 0 and h > 0
                          and abs(w - img_w) <= 2 and abs(h - img_h) <= 2)


# ------------------------------------------------------------- as rotas
def rota_track_map(query):
    """`/api/track-map` -- a escala e a imagem de uma pista do AC."""
    from urllib.parse import parse_qs, quote
    q = {k: v[0] for k, v in parse_qs(query).items()}
    track = q.get("track", "")
    track_config = q.get("config", "")
    if not track:
        return {"__status": 400,
                "body": b'{"available":false,"reason":"sem pista"}'}
    ac_path, _ = caminho_ac()
    if not _is_ac_root(ac_path):
        return {"__status": 200,
                "body": b'{"available":false,"reason":"no-path"}'}
    found = _find_map_files(ac_path, track, track_config)
    if not found:
        return {"__status": 200, "body": b'{"available":false,"reason":"not-found"}'}
    ini_path, png_path = found
    cfg = _parse_map_ini(ini_path)
    if not cfg:
        return {"__status": 200, "body": b'{"available":false,"reason":"bad-ini"}'}
    cfg["available"] = True
    cfg["imageUrl"] = ("/api/track-map-image?track=" + quote(track)
                        + "&config=" + quote(track_config or ""))
    _add_image_scale(cfg, png_path)
    return {"__status": 200, "body": cfg}


def rota_track_map_image(query):
    """`/api/track-map-image` -- os bytes do PNG."""
    from urllib.parse import parse_qs
    q = {k: v[0] for k, v in parse_qs(query).items()}
    track = q.get("track", "")
    track_config = q.get("config", "")
    ac_path, _ = caminho_ac()
    found = (_find_map_files(ac_path, track, track_config)
             if _is_ac_root(ac_path) else None)
    if not found:
        return None
    _ini, png_path = found
    try:
        with open(png_path, "rb") as f:
            return f.read()
    except OSError:
        return None


def registar_rotas():
    """As rotas deste jogo, para o nucleo do servidor as servir.

    O nucleo sabe que `rota` e' uma funcao que recebe a query e devolve um
    dicionario. Nao sabe o que ha' dentro, nem que e' do AC. Um jogo novo
    com rotas suas devolve um dicionario igual e o nucleo nao muda.
    """
    return {
        "/api/track-map": ("GET", rota_track_map),
        "/api/track-map-image": ("GET", rota_track_map_image),
    }
