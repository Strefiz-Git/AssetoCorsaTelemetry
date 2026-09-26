# -*- coding: utf-8 -*-
"""
Ferramenta de duas fases para decidir a transformacao mundo -> imagem.

FASE 1 (capturar): recolhe (x, z) do teu carro durante alguns segundos e
guarda num JSON. Guarda tambem a pista e o momento, para se poder repetir a
analise sem voltar a conduzir.

FASE 2 (analisar): carrega o trajecto e testa as hipoteses possiveis,
pontuando cada uma por SOBREPOSICAO com a imagem do mapa.

Porque sobreposicao e nao "o ponto caiu na pista": o map.png do AC e' um
CONTORNO de 2 px sobre fundo preto (visto a olho nu). Um teste de
acertar/errar seria quase sempre "errar", mesmo com a formula certa. Em
vez disso desenha-se o trajecto com uma caneta grossa por cima da imagem e
vê-se que fracao da pista desenhada ele explica. A orientacao certa
explica quase tudo; a virada explica quase nada.

  python tests\\mapa.py cap 150 50
  python tests\\mapa.py analisa [fichiero.json]
"""
import json
import math
import os
import sys
import time
import urllib.request

import numpy as np
from PIL import Image, ImageDraw

sys.stdout.reconfigure(encoding="utf-8")
RAIZ = r"D:\SteamLibrary\steamapps\common\assettocorsa\content\tracks"
AQUI = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------- caminhos

def ini_de(track):
    p = os.path.join(RAIZ, track, "data", "map.ini")
    cfg = {}
    if not os.path.exists(p):
        return cfg
    for linha in open(p, encoding="utf-8", errors="ignore"):
        if "=" in linha:
            k, v = linha.split("=", 1)
            try:
                cfg[k.strip().upper()] = float(v.strip())
            except ValueError:
                pass
    return cfg


def estado():
    r = urllib.request.urlopen("http://localhost:8765/api/state", timeout=8)
    return json.loads(r.read().decode())


def opcoes(d):
    """Opcoes registadas no servidor, para texto de erro mais util."""
    try:
        r = urllib.request.urlopen("http://localhost:8765/api/options", timeout=8)
        return json.loads(r.read().decode())
    except Exception:
        return {}


# ------------------------------------------------------------------ fase 1

def capturar(segundos, hz):
    """Recolhe (pista, x, z) JUNTAMENTE, a alta cadencia.

    Duas lições aqui, ambas custaram uma captura:

    1. O nome da pista tem de viajar com cada ponto. A primeira versao lia-o
       uma vez no inicio; se o jogo estivesse em pausa, esse nome era o da
       sessao anterior e os pontos seguintes eram de outra pista. Da
       resultava comparar o trajecto de Baku com o mapa de Magny-Cours e a
       ferramenta dizer, com toda a honestidade, "nao cabe".

    2. A leitura tem de ser directa da memoria partilhada, nao por HTTP.
       Com /api/state a cadencia efectiva era de 1 ponto por 2,4 s; a
       200 km/h sao 55 m entre amostras, acima do limiar de 40 m, e portanto
       CADA passo era lido como teleporte. O trajecto desenhado ficava com
       dois trocos de dois pontos e a medicao nao via nada. Lendo a acshm
       directamente fica suave e a mesma logica passa a funcionar.
    """
    sys.path.insert(0, os.path.dirname(AQUI))
    try:
        import acshm
    except ImportError:
        print("Nao consegui importar o acshm. Corre a partir da pasta do projecto.")
        return None

    tel = acshm.ACTelemetry()
    amostras, t0 = [], time.time()
    print("a recolher durante %.0f s a %.0f Hz -- conduz e percorre a pista."
          % (segundos, hz))
    while time.time() - t0 < segundos:
        try:
            e = tel.snapshot()
        except Exception:
            time.sleep(0.05)
            continue
        if e.get("x") is not None and e.get("track"):
            amostras.append([e["track"], round(e["x"], 3), round(e["z"], 3)])
        time.sleep(1.0 / hz)

    if not amostras:
        print("nenhuma amostra com posicao -- o jogo esta' a correr?")
        return None

    pistas = set(a[0] for a in amostras)
    if len(pistas) > 1:
        print("A pista mudou durante a captura (%s). Nao se pode misturar."
              % ", ".join(sorted(pistas)))
        return None
    track = amostras[0][0]

    cfg = ini_de(track)
    png = os.path.join(RAIZ, track, "map.png")
    if not cfg:
        print("'%s' nao tem data/map.ini nesta instalacao." % track)
        return None
    if not os.path.exists(png):
        print("'%s' nao tem map.png na raiz da pista (%s)." % (track, png))
        return None

    pts = [[a[1], a[2]] for a in amostras]
    destino = os.path.join(AQUI, "mapa_%s.json" % track)
    with open(destino, "w", encoding="utf-8") as f:
        json.dump({"track": track, "ini": cfg, "pontos": pts}, f)
    xs = [p[0] for p in pts]
    zs = [p[1] for p in pts]
    print("pista %s | %d pontos -> %s" % (track, len(pts), destino))
    print("X %.0f..%.0f (amplitude %.0f m) | Z %.0f..%.0f (amplitude %.0f m)"
          % (min(xs), max(xs), max(xs) - min(xs), min(zs), max(zs), max(zs) - min(zs)))
    return destino


# ------------------------------------------------------------------ fase 2

def hipoteses(W, H, X0, Z0, S, MG):
    """
    Cada hipotese devolve (nome, funcao(x, z) -> (px, py)).

    A CORRECTA e' a primeira: dividir pelo SCALE_FACTOR. O SCALE_FACTOR e'
    a escala da imagem, e um pixel da imagem vale SCALE_FACTOR metros.
    Medido com um trajecto real de Monza (SCALE_FACTOR 1,4): a distancia
    mediana a linha da pista e' 0 px com a divisao, e 132 m sem ela.

    As outras hypotheses ficam aqui para se ver que estão erradas. E
    notar que Baku, onde isto se mediu primeiro, tem SCALE_FACTOR 1 — e
    com escala 1 as hypotheses A, C e E dão o mesmo numero, ou seja, a
    medição em Baku não conseguia distinguir nada.
    """
    return [
        ("A  /S   (a correcta)", 1.0 / S, 0, 0, False),
        ("B  /S, Z invertido", 1.0 / S, 0, 0, True),
        ("C  sem escala (1 px por metro)", 1.0, 0, 0, False),
        ("D  sem escala, Z invertido", 1.0, 0, 0, True),
        ("E  *S", S, 0, 0, False),
        ("F  *S, Z invertido", S, 0, 0, True),
        ("G  /S, +MARGIN", 1.0 / S, MG, MG, False),
        ("H  /S, +MARGIN, Z invertido", 1.0 / S, MG, MG, True),
    ]


def trocar_em_trocos(pts, salto_max=40.0):
    """Parte o trajecto onde o carro 'saltou' (pausa, mudanca de sessao).

    Sem isto, um salto de 1196 m desenha uma reta a atravessar a pista e a
    pontuacao passa a medir a reta, nao o trajecto. Regra: um passo maior
    que 40 m nao e' movimento de carro -- e' teleporte. O mesmo limiar que
    o mapa do site usa para nao ligar pontos com uma linha falsa.
    """
    trocos, atual = [], [pts[0]]
    for i in range(1, len(pts)):
        d = math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
        if d > salto_max:
            if len(atual) >= 3:
                trocos.append(atual)
            atual = [pts[i]]
        else:
            atual.append(pts[i])
    if len(atual) >= 3:
        trocos.append(atual)
    return trocos


def pontuar(img, branco, trocos, largura_caneta):
    """
    Desenha cada troco com uma caneta grossa e devolve
      (cobertura, precisao)
    cobertura = fracao da pista desenhada no PNG que o trajecto explica
    precisao  = fracao da caneta que caiu sobre a pista desenhada

    A caneta e' grossa de proposito: o map.png e' um CONTORNO de ~2 px, e um
    traço de 1 px acabaria quase sempre ao lado por causa de um pixel de
    erro. Com 25 px a hipotese certa acerta a linha e a errada nao acerta
    nada, e a diferenca entre as duas deixa de ser ruido.
    """
    W, H = img.size
    mask = Image.new("1", (W, H), 0)
    d = ImageDraw.Draw(mask)
    for troco in trocos:
        poly = [(float(x), float(y)) for x, y in troco]
        d.line(poly, fill=1, width=largura_caneta, joint="curve")
    m = np.asarray(mask, dtype=bool)
    inter = np.logical_and(m, branco).sum()
    cobertura = 100.0 * inter / max(1, branco.sum())
    precisao = 100.0 * inter / max(1, m.sum())
    return cobertura, precisao


def analisar(caminho):
    with open(caminho, encoding="utf-8") as f:
        d = json.load(f)
    track, cfg, pts = d["track"], d["ini"], d["pontos"]
    png = os.path.join(RAIZ, track, "map.png")
    img = Image.open(png).convert("L")
    W, H = img.size
    a = np.asarray(img, dtype=np.uint8)

    # a pista e' a parte clara; o limiar e' a media entre o fundo e o pico,
    # que numa imagem de contorno preto/branco e' Robustissimo
    pico = int(np.percentile(a, 99.5))
    limiar = pico // 2
    branco = a > limiar
    print("pista %s | png %dx%d | WIDTH %.1f HEIGHT %.1f | 1 px por metro: %s"
          % (track, W, H, cfg["WIDTH"], cfg["HEIGHT"],
             abs(cfg["WIDTH"] - W) < 2 and abs(cfg["HEIGHT"] - H) < 2))
    print("X_OFFSET %.1f Z_OFFSET %.1f SCALE_FACTOR %.2f MARGIN %.0f"
          % (cfg["X_OFFSET"], cfg["Z_OFFSET"], cfg["SCALE_FACTOR"], cfg.get("MARGIN", 0)))
    print("mascara: limiar %d, %d px claros (%.1f%% da imagem)"
          % (limiar, branco.sum(), 100.0 * branco.mean()))
    print("%d pontos de trajecto" % len(pts))
    print()

    X0, Z0 = cfg["X_OFFSET"], cfg["Z_OFFSET"]
    HH, S = cfg["HEIGHT"], cfg["SCALE_FACTOR"]
    MG = cfg.get("MARGIN", 0)

    print("%-36s %-11s %-11s %s" % ("hipotese", "cobertura", "precisao", "dentro"))
    print("-" * 80)
    resultados = []
    for nome, esc, dx, dy, flip in hipoteses(cfg["WIDTH"], HH, X0, Z0, S, MG):
        trocos_img = []
        for troco in trocar_em_trocos(pts):
            poly = []
            for x, z in troco:
                px = (x + X0) * esc + dx
                py = (z + Z0) * esc + dy
                if flip:
                    py = HH * esc - py
                poly.append((px, py))
            # um troco que saia da imagem nao serve para comparar
            if all(0 <= a < W and 0 <= b < H for a, b in poly):
                trocos_img.append(poly)
        if not trocos_img:
            print("%-36s %-11s %-11s %s" % (nome, "-", "-", "nao cabe"))
            continue
        cob, prec = pontuar(img, branco, trocos_img, 25)
        resultados.append((cob, prec, nome, trocos_img))
        print("%-36s %-11.1f%% %-11.1f%% %d troco(s)" % (nome, cob, prec, len(trocos_img)))

    if not resultados:
        print()
        print("Nenhum troco do trajecto cabia na imagem. Ou a pista esta errada,")
        print("ou as coordenadas nao sao as do mundo do AC.")
        return None
    resultados.sort(key=lambda r: r[0], reverse=True)
    print()
    print("VENCEDORA: %s" % resultados[0][2])
    print("  cobertura %.1f%% da pista, precisao %.1f%%" % (resultados[0][0], resultados[0][1]))
    if len(resultados) > 1:
        print("  runner-up: %s com %.1f%% -- margem de %.1f pontos"
              % (resultados[1][2], resultados[1][0], resultados[0][0] - resultados[1][0]))

    saida = os.path.join(os.path.dirname(caminho), "mapa_prova.png")
    vis = Image.open(png).convert("RGB")
    dv = ImageDraw.Draw(vis)
    for poly in resultados[0][3]:
        dv.line([(float(a), float(b)) for a, b in poly],
                fill=(255, 40, 40), width=3, joint="curve")
    vis.save(saida)
    print()
    print("prova visual gravada em %s (trajecto a vermelho sobre a imagem)" % saida)
    return saida


# -------------------------------------------------------------------- main

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    cmd = sys.argv[1]
    if cmd == "cap":
        seg = float(sys.argv[2]) if len(sys.argv) > 2 else 120.0
        hz = float(sys.argv[3]) if len(sys.argv) > 3 else 50.0
        return 0 if capturar(seg, hz) else 1
    if cmd == "analisa":
        if len(sys.argv) > 2:
            caminho = sys.argv[2]
        else:
            cand = [os.path.join(AQUI, f) for f in os.listdir(AQUI)
                    if f.startswith("mapa_") and f.endswith(".json")]
            if not cand:
                print("Nao ha trajecto guardado. Primeiro: python tests\\mapa.py cap 120 50")
                return 1
            caminho = max(cand, key=os.path.getmtime)
        print("a analisar %s" % caminho)
        analisar(caminho)
        return 0
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main())
