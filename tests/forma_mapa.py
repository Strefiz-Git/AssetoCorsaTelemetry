# -*- coding: utf-8 -*-
"""
Desenha o trajecto nas DUAS convencoes de eixo Y e grava as duas imagens,
para se ver qual delas se parece com o mapa oficial da pista.

Isto e' a verificacao que o numero nao resolveu. Com o trajecto completo a
medida por sobreposicao decide; mas mesmo com poucos pontos, a forma
geral (o loop grande fica em cima ou em baixo, e para onde vai o
rectangulo estreito do outro extremo) ja separa as duas convencoes, e e'
isso que se ve.

O desenho e' propositado igual ao do site: normalizado pela sua propria
caixa, com o Z centrado, para se poder comparar com o screenshot.
"""
import json
import os
import sys

from PIL import Image, ImageDraw

sys.stdout.reconfigure(encoding="utf-8")
AQUI = os.path.dirname(os.path.abspath(__file__))


def desenhar(pts, inverter, destino, tam=(360, 400)):
    xs = [p[0] for p in pts]
    zs = [p[1] for p in pts]
    cx = (min(xs) + max(xs)) / 2
    cz = (min(zs) + max(zs)) / 2
    spanX = max(max(xs) - min(xs), 1)
    spanZ = max(max(zs) - min(zs), 1)
    pad = 22
    w, h = tam
    sc = min((w - pad * 2) / spanX, (h - pad * 2) / spanZ)
    px = lambda p: (p[0] - cx) * sc + w / 2
    py = lambda p: ((cz - p[1]) if inverter else (p[1] - cz)) * sc + h / 2

    img = Image.new("RGB", (w, h), (10, 14, 14))
    d = ImageDraw.Draw(img)
    d.line([(px(p), py(p)) for p in pts], fill=(139, 147, 148), width=3, joint="curve")
    d.ellipse([px(pts[0]) - 5, py(pts[0]) - 5, px(pts[0]) + 5, py(pts[0]) + 5],
              fill=(255, 215, 0))
    d.ellipse([px(pts[-1]) - 6, py(pts[-1]) - 6, px(pts[-1]) + 6, py(pts[-1]) + 6],
              fill=(255, 240, 120))
    img.save(destino)
    return destino


def main():
    cand = [os.path.join(AQUI, f) for f in os.listdir(AQUI)
            if f.startswith("mapa_") and f.endswith(".json")]
    if not cand:
        print("nada para desenhar")
        return 1
    caminho = max(cand, key=os.path.getmtime)
    with open(caminho, encoding="utf-8") as f:
        d = json.load(f)
    pts = d["pontos"]
    print("pista %s, %d pontos" % (d["track"], len(pts)))

    a = desenhar(pts, True, os.path.join(AQUI, "forma_Z_invertido.png"))
    b = desenhar(pts, False, os.path.join(AQUI, "forma_Z_normal.png"))
    print("Z invertido (como o site faz hoje): %s" % a)
    print("Z normal    (Y do canvas cresce com Z): %s" % b)
    print()
    print("Compara as duas com o mapa oficial: o loop grande e' a forma")
    print("fechada e larga. Se numa delas ele fica em baixo-esquerda (como")
    print("no mapa oficial) e na outra em cima-esquerda, sao espelhos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
