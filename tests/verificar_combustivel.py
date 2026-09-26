# -*- coding: utf-8 -*-
"""Verifica o combustivel: desce, e a percentagem bate com os litros?"""
import json
import sys
import time
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")
SEG = float(sys.argv[1]) if len(sys.argv) > 1 else 90.0

r = urllib.request.urlopen("http://localhost:8765/events?fps=60", timeout=SEG + 10)
t0 = time.time()
A = []
while time.time() - t0 < SEG:
    linha = r.readline()
    if linha.startswith(b"data: "):
        try:
            A.append(json.loads(linha[6:]))
        except ValueError:
            pass
r.close()

if not A:
    print("sem amostras: o AC esta a correr?")
    sys.exit(1)

lit = [a.get("fuelL") for a in A if a.get("fuelL") is not None]
pct = [a.get("fuelPct") for a in A if a.get("fuelPct") is not None]
mx = A[0].get("maxFuelL")

print("%d amostras em %.0f s | carro %s | %s" % (
    len(A), SEG, A[0].get("car"), A[0].get("track")))
print("capacidade: %s L" % mx)
print()
print("litros   : %.2f -> %.2f  (desceu %.2f L)" % (lit[0], lit[-1], lit[0] - lit[-1]))
print("percentagem: %.2f -> %.2f" % (pct[0], pct[-1]))
print()
print("valores distintos de litros: %d" % len(set(lit)))
print("  primeros: %s" % [round(v, 3) for v in lit[:6]])
print("  ultimos: %s" % [round(v, 3) for v in lit[-6:]])

sobe = [(i, lit[i - 1], lit[i]) for i in range(1, len(lit)) if lit[i] > lit[i - 1] + 1e-9]
print()
print("subidas: %d" % len(sobe))
for i, antes, depois in sobe[:5]:
    print("  +%.2f L na amostra %d" % (depois - antes, i))
    # o que se passava nesse instante? abertura para o gasolio, fim de
    # volta, mudanca de sessao... e' preciso ver, para nao adivinhar
    for j in range(max(0, i - 3), min(len(A), i + 4)):
        a = A[j]
        marca = ">>" if j == i else "  "
        print("    %s t=%6.1fs  L=%.2f  box=%s  lane=%s  limitador=%s  volta=%s  "
              "sessao=%s  vel=%.0f" % (
                  marca, j / 60.0, a.get("fuelL") or 0,
                  a.get("isInPit"), a.get("isInPitLane"), a.get("pitLimiter"),
                  a.get("lap"), a.get("session"), a.get("speed") or 0))
if not sobe:
    print("  (o consumo nunca volta a subir, como deve ser)")

# a percentagem tem de bater com os litros
erros = [abs(l / mx * 100 - p) for l, p in zip(lit, pct) if mx]
print("erro maximo entre litros e percentagem: %.4f pontos percentuais" % max(erros))
print()
if lit[0] - lit[-1] < 0.05:
    print("VEREDICTO: o combustivel NAO desceu. Se o consumo esta ligado no jogo,")
    print("           entao a leitura do valor esta errada.")
else:
    taxa = (lit[0] - lit[-1]) / SEG
    print("VEREDICTO: desce a %.2f L/min, cerca de %.1f L por volta de 75 s."
          % (taxa * 60, taxa * 75))
