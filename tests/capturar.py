# -*- coding: utf-8 -*-
"""
Captura o canal SSE durante N segundos e guarda tudo num JSON, para se
poder olhar para a serie temporale depois sem voltar a pedir nada ao
jogo. So funciona com o AC a correr.

    python tests\\capturar.py 60 saida.json
"""
import collections
import json
import math
import sys
import time
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

SEG = float(sys.argv[1]) if len(sys.argv) > 1 else 60.0
FICHEIRO = sys.argv[2] if len(sys.argv) > 2 else "captura.json"

r = urllib.request.urlopen("http://localhost:8765/events?fps=60", timeout=SEG + 10)
t0 = time.time()
amostras = []
while time.time() - t0 < SEG:
    linha = r.readline()
    if not linha.startswith(b"data: "):
        continue
    try:
        amostras.append(json.loads(linha[6:]))
    except ValueError:
        pass
r.close()

with open(FICHEIRO, "w", encoding="utf-8") as f:
    json.dump(amostras, f, ensure_ascii=False)

n = len(amostras)
print("guardadas %d amostras em %.0f s (%.1f Hz) -> %s" % (n, SEG, n / SEG, FICHEIRO))
if n < 10:
    print("poucas amostras: o AC esta a correr?")
    sys.exit(1)

def valores(campo):
    return [a.get(campo) for a in amostras]

def lista(campo):
    """Achata um campo que e' lista de 4 em quatro colunas."""
    cols = [[], [], [], []]
    for a in amostras:
        v = a.get(campo)
        if isinstance(v, list) and len(v) == 4:
            for i in range(4):
                cols[i].append(v[i])
    return cols

print()
print("pista %s | carro %s | %d carros | pos P%s" % (
    amostras[0].get("track"), amostras[0].get("car"),
    amostras[0].get("numCars"), amostras[0].get("position")))
print("voltas: %s..%s" % (min(valores("lap")), max(valores("lap"))))
print()

print("%-18s %8s %8s %8s   %s" % ("campo", "min", "max", "medio", "comentario"))
print("-" * 78)

def linha(nome, vals, nota=""):
    if not vals:
        return
    print("%-18s %8.2f %8.2f %8.2f   %s" % (
        nome, min(vals), max(vals), sum(vals) / len(vals), nota))

linha("velocidade", valores("speed"), "km/h")
linha("rpm", valores("rpm"))
linha("throttle", valores("throttle"))
linha("brake", valores("brake"))
linha("clutchRaw", valores("clutchRaw"), "1 = segundo a interpretacao 'encaixada'")
linha("drs (float)", [v for v in valores("drs") if v is not None])
linha("fuelL", valores("fuelL"), "litros")
linha("fuelPct", valores("fuelPct"))
linha("ersPct", valores("ersPct"))
linha("ersUsedThisLapKJ", valores("ersUsedThisLapKJ"), "kJ, nao J")
linha("airTemp", valores("airTemp"))
linha("roadTemp", valores("roadTemp"))
linha("trackPct", valores("trackPct"), "0..1")
linha("altitude y", valores("y"), "metros; o plano da pista e' X-Z")
linha("abs", valores("abs"))
linha("tc", valores("tc"))

print()
print("--- contagens de flags (so os valores que apareceram) ---")
for campo in ("drsAvailable", "drsEnabled", "ersCharging", "isInPit",
              "pitLimiter", "penaltyFlag", "flagId", "sector", "gear"):
    c = collections.Counter(str(v) for v in valores(campo))
    print("  %-14s %s" % (campo, dict(c.most_common(8))))

print()
print("---侮 ---")
print("--- portagens e temperaturas, por canto ---")
for campo in ("tyreTempI", "tyreTempM", "tyreTempO", "tyreCore",
              "tyrePressure", "brakeTemp", "tyreWearUsed", "wheelSlip"):
    cols = lista(campo)
    if not cols:
        continue
    etiqueta = " ".join("%s:%5.1f-%5.1f" % (n, min(c), max(c))
                        for n, c in zip("FL FR RL RR".split(), cols))
    print("  %-14s %s" % (campo, etiqueta))

print()
print("--- ordem das tres zonas do pneu: deve ser coerente? ---")
I, M, O = lista("tyreTempI"), lista("tyreTempM"), lista("tyreTempO")
if I and M and O:
    for nome, i, m, o in zip("FL FR RL RR".split(), I, M, O):
        rel = "I<M<O" if i <= m <= o else ("I>M>O" if i >= m >= o else "irregular")
        print("  %s  I=%.0f M=%.0f O=%.0f  -> %s" % (nome, i, m, o, rel))

print()
print("--- a referencia de delta chegou a ser construida? ---")
print("  trackPct subiu sem saltos? ")
saltos = 0
for a, b in zip(amostras, amostras[1:]):
    d = (b.get("trackPct") or 0) - (a.get("trackPct") or 0)
    if d < -0.3:
        saltos += 1
print("     %d inversoes (cada uma e' uma volta a fechar)" % saltos)
