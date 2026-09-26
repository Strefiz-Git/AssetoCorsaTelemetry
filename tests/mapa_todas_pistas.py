# -*- coding: utf-8 -*-
"""
Confirma, em TODAS as pistas instaladas, que a imagem do mapa tem um pixel
por metro do mundo.

Porque e que isto importa: o outroAssistant usou a formula
    imgX = (x + X_OFFSET) / SCALE_FACTOR
Se o SCALE_FACTOR fosse a escala da imagem, o PNG teria WIDTH * SCALE_FACTOR
pixels de largura. Numa pista com SCALE_FACTOR = 1,3 e WIDTH = 508,8 m
isso daria 661 px. Se o PNG tiver 508 px, a divisao esta errada.

Este script le o cabecalho de cada PNG (sem abrir a imagem toda) e compara
com o WIDTH/HEIGHT do map.ini ao lado.
"""
import os
import struct
import sys

sys.stdout.reconfigure(encoding="utf-8")
RAIZ = r"D:\SteamLibrary\steamapps\common\assettocorsa\content\tracks"


def dimensoes(caminho):
    """Largura e altura de um PNG a partir do cabecalho IHDR."""
    with open(caminho, "rb") as f:
        cab = f.read(24)
    if len(cab) < 24 or cab[:8] != b"\x89PNG\r\n\x1a\n" or cab[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", cab[16:24])


def ini_de(pasta):
    cfg = {}
    for linha in open(pasta, encoding="utf-8", errors="ignore"):
        if "=" in linha:
            k, v = linha.split("=", 1)
            try:
                cfg[k.strip().upper()] = float(v.strip())
            except ValueError:
                pass
    return cfg


def achar_mapa(pista):
    """map.png vive na raiz da pista; o map.ini em data/ (ou numa subpasta)."""
    raiz = os.path.join(RAIZ, pista)
    png = os.path.join(raiz, "map.png")
    if not os.path.isfile(png):
        for sub in sorted(os.listdir(raiz)):
            p = os.path.join(raiz, sub, "map.png")
            if os.path.isfile(p):
                png = p
                break
        else:
            return None, None
    pasta = os.path.dirname(png)
    for cand in (os.path.join(pasta, "data", "map.ini"),
                 os.path.join(os.path.join(pasta, ".."), "data", "map.ini"),
                 os.path.join(pasta, "map.ini")):
        if os.path.isfile(cand):
            return png, cand
    return png, None


def main():
    pistas = sorted(os.listdir(RAIZ))
    iguais, diferentes, sem_mapa, sem_ini = [], [], [], []

    print("%-22s %-9s %-9s %-9s %-8s %s"
          % ("pista", "WIDTH m", "png px", "HEIGHT m", "escala", "veredicto"))
    print("-" * 84)

    for p in pistas:
        pasta = os.path.join(RAIZ, p)
        if not os.path.isdir(pasta):
            continue
        png, ini = achar_mapa(p)
        if not png or not os.path.isfile(png):
            sem_mapa.append(p)
            continue
        if not ini:
            sem_ini.append(p)
            continue
        dim = dimensoes(png)
        if not dim:
            sem_mapa.append(p)
            continue
        larg, alt = dim
        cfg = ini_de(ini)
        W, H = cfg.get("WIDTH", 0), cfg.get("HEIGHT", 0)
        S = cfg.get("SCALE_FACTOR", 1.0)
        bate = abs(W - larg) <= 2 and abs(H - alt) <= 2
        print("%-22s %-9.1f %-9d %-9.1f %-8.2f %s"
              % (p, W, larg, H, S, "1 px por metro" if bate else "*** NAO BATE ***"))
        (iguais if bate else diferentes).append((p, W, larg, H, alt, S))

    print()
    print("pistas com mapa: %d" % (len(iguais) + len(diferentes)))
    print("  WIDTH/HEIGHT == dimensoes do PNG (1 px por metro): %d" % len(iguais))
    print("  nao batem: %d" % len(diferentes))
    for p, W, larg, H, alt, S in diferentes:
        print("     %s: WIDTH %.1f vs %d px, HEIGHT %.1f vs %d px, escala %.2f"
              % (p, W, larg, H, alt, S))
    if sem_ini:
        print("  sem data/map.ini (tem png mas nao a escala): %d -> %s"
              % (len(sem_ini), ", ".join(sem_ini[:8])))
    if sem_mapa:
        print("  sem map.png: %d" % len(sem_mapa))

    if not diferentes and iguais:
        print()
        print("CONCLUSAO: em todas as %d pistas com mapa, a imagem tem UM pixel"
              % len(iguais))
        print("por metro e o SCALE_FACTOR NAO e a escala da imagem. A transformacao")
        print("correcta e  imgX = x + X_OFFSET ,  imgY = z + Z_OFFSET  (+ eventual")
        print("inversao do eixo, a decidir separadamente).")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
