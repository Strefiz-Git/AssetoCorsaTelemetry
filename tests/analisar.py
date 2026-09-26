# -*- coding: utf-8 -*-
"""Analisa a captura JSON sem voltar a pedir nada ao jogo."""
import collections
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")
A = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "captura.json",
                   encoding="utf-8"))
n = len(A)
print("%d amostras\n" % n)

def col(campo, i):
    return [a[campo][i] for a in A if isinstance(a.get(campo), list) and len(a[campo]) == 4]

print("=== 1) DRS: onde e' que o drsAvailable acende? ===")
ligado = [(a.get("trackPct") or 0) for a in A if a.get("drsAvailable")]
desligado = [(a.get("trackPct") or 0) for a in A if not a.get("drsAvailable")]
print("  amostras com drsAvailable=1: %d (%.1f%%)" % (len(ligado), 100.0 * len(ligado) / n))
if ligado:
    # agrupar em 20 bins de percentagem da pista
    bins = [0] * 20
    for p in ligado:
        bins[min(19, int(p * 20))] += 1
    print("  por Twentieths da pista (0 = inicio, 19 = fim):")
    for i, c in enumerate(bins):
        if c:
            print("    %4.0f%%-%4.0f%%  %s %d" % (i * 5, i * 5 + 5, "#" * min(40, c), c))
    v = [a.get("speed") or 0 for a in A if a.get("drsAvailable")]
    print("  velocidade com DRS disponivel: %.0f a %.0f km/h" % (min(v), max(v)))
    g = collections.Counter(str(a.get("gear")) for a in A if a.get("drsAvailable"))
    print("  caixa com DRS disponivel: %s" % dict(g.most_common(6)))

print()
print("=== 2) drsEnabled coincide com drsAvailable? ===")
comb = collections.Counter((a.get("drsAvailable"), a.get("drsEnabled")) for a in A)
for k, c in sorted(comb.items()):
    print("  drsAvailable=%s drsEnabled=%s -> %d" % (k[0], k[1], c))

print()
print("=== 3) embraiagem: os mergulhos batem com as mudancas de caixa? ===")
quedas = 0
for x, y in zip(A, A[1:]):
    if (x.get("clutchRaw") or 1) - (y.get("clutchRaw") or 1) > 0.25:
        quedas += 1
print("  quedas de clutchRaw > 0.25: %d em %d amostras" % (quedas, n))
# a caixa muda no mesmo instante?
mesmo = 0
for x, y in zip(A, A[1:]):
    if (x.get("clutchRaw") or 1) - (y.get("clutchRaw") or 1) > 0.25 and x.get("gear") != y.get("gear"):
        mesmo += 1
print("  dessas, %daccompanied de mudanca de caixa (%.0f%%)" % (
    mesmo, 100.0 * mesmo / max(1, quedas)))
# a que velocidade?
vv = [y.get("speed") or 0 for x, y in zip(A, A[1:])
      if (x.get("clutchRaw") or 1) - (y.get("clutchRaw") or 1) > 0.25]
if vv:
    print("  velocidade nesses momentos: %.0f a %.0f km/h (media %.0f)" % (
        min(vv), max(vv), sum(vv) / len(vv)))
print("  clutchRaw com aceleracao a fundo (throttle>=95): minimo %.2f" % min(
    [a.get("clutchRaw") or 0 for a in A if (a.get("throttle") or 0) >= 95] or [0]))

print()
print("=== 4) ABS e TC: sao(activity) ou (definicao)? ===")
for campo in ("abs", "tc"):
    v = [a.get(campo) for a in A if a.get(campo) is not None]
    distintos = sorted(set(v))
    print("  %s: %d valores distintos -> %s" % (campo, len(distintos), distintos[:6]))
    print("     variou durante %d amostras? %s" % (n, "nao" if len(distintos) == 1 else "sim"))
print("  (se nunca variasse com travagens e aceleracoes, e' um nivel de ajuste)")

print()
print("=== 5) as tres zonas do pneu: como se ordenam? ===")
for i, canto in enumerate("FL FR RL RR".split()):
    I, M, O = col("tyreTempI", i), col("tyreTempM", i), col("tyreTempO", i)
    if not I:
        continue
    asc = sum(1 for a, b, c in zip(I, M, O) if a <= b <= c)
    desc = sum(1 for a, b, c in zip(I, M, O) if a >= b >= c)
    outro = len(I) - asc - desc
    print("  %s  I<M<O em %4d amostras | I>M>O em %4d | irregular %4d  (de %d)" % (
        canto, asc, desc, outro, len(I)))

print()
print("=== 6) pressoes: que unidade pode ser? ===")
v = [a["tyrePressure"][i] for a in A if isinstance(a.get("tyrePressure"), list)
     for i in range(4)]
print("  valores: %.1f a %.1f" % (min(v), max(v)))
print("  se fossem kPa, %.0f kPa = %.2f bar, MENOS que a pressao atmosferica" % (max(v), max(v) / 100))
print("     (1 atm = 101.3 kPa) -> impossivel")
print("  se forem psi: %.0f a %.0f psi = %.2f a %.2f bar -> plausivel para um F1" % (
    min(v), max(v), min(v) * 0.0689, max(v) * 0.0689))

print()
print("=== 7) combustivel: muda mesmo? ===")
f = [a.get("fuelL") for a in A if a.get("fuelL") is not None]
print("  valores distintos: %s" % sorted(set(f))[:10])
print("  percurso da pista em voltas: %s" % sorted(set(a.get("lap") for a in A)))

print()
print("=== 8) valores fora do razoavel? ===")
suspeitos = []
for a in A:
    for campo, lim in (("rpm", (500, 15000)), ("speed", (0, 400)),
                       ("ersPct", (0, 100)), ("fuelPct", (0, 100))):
        val = a.get(campo)
        if val is not None and not (lim[0] <= val <= lim[1]):
            suspeitos.append((campo, val))
    for i in range(4):
        for campo in ("tyreTempI", "tyreTempM", "tyreTempO"):
            arr = a.get(campo)
            if isinstance(arr, list) and i < len(arr):
                if not (-20 <= arr[i] <= 250):
                    suspeitos.append((campo + str(i), arr[i]))
print("  %d valores fora do razoavel" % len(suspeitos))
for s in suspeitos[:10]:
    print("   ", s)

print()
print("=== 9) altitude: confirma que Y e' a altura? ===")
y = [a.get("y") or 0 for a in A]
x = [a.get("x") or 0 for a in A]
z = [a.get("z") or 0 for a in A]
print("  X: %8.1f a %8.1f   amplitude %7.1f m" % (min(x), max(x), max(x) - min(x)))
print("  Y: %8.1f a %8.1f   amplitude %7.1f m" % (min(y), max(y), max(y) - min(y)))
print("  Z: %8.1f a %8.1f   amplitude %7.1f m" % (min(z), max(z), max(z) - min(z)))
print("  -> o plano tem de ser X-Z; Y e' a altitude")
