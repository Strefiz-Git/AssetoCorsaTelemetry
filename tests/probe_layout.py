"""
Descobre o layout REAL da pagina de fisica do AC, olhando para os valores.

O problema: a estrutura de referencia que usei tem uns campos comentados
no meio (performanceMeter, engineBrake, ers*, kersCurrentKJ, drsAvailable,
drsEnabled). Se esses campos existirem mesmo na memoria, tudo o que vier
depois esta deslocado - e foi o que aconteceu: brakeTemp dava 0 e
tyreTempI dava 375 C.

Metodo: despejar os floats a partir de certo offset e procurar os
conjuntos de 4 valores com aspecto de temperatura (agrupados e na mesma
faixa), que e' a assinatura das temperaturas dos travões e dos pneus.
"""
import ctypes, struct, sys
import acshm

k = acshm.k32
h = k.OpenFileMappingW(acshm.FILE_MAP_READ, False, "acpmf_physics")
if not h:
    print("AC nao esta a correr"); sys.exit(1)
size = 4096
a = k.MapViewOfFile(h, acshm.FILE_MAP_READ, 0, 0, size)

# amostra varias vezes e guarda o maximo de cada slot, para ver valores reais
N = 40
best = [-1e30] * (size // 4)
for _ in range(N):
    raw = ctypes.string_at(a, size)
    for i in range(0, size, 4):
        v = struct.unpack_from("<f", raw, i)[0]
        if v == v and abs(v) < 1e9 and v > best[i // 4]:
            best[i // 4] = v
    import time; time.sleep(0.02)

def show(lo, hi, title):
    print("=" * 78)
    print(title)
    print("=" * 78)
    for off in range(lo, hi, 4):
        idx = off // 4
        v = best[idx]
        # marca os grupos de 4
        tag = ""
        print(f"  off {off:4d}  f[{idx:3d}] = {v:14.3f}{tag}")
    print()

show(300, 460, "cauda da fisica: onde esperamos travões e temperaturas")

# procurarsignature: 4 floats seguidos, todos entre 100 e 900, e
# max-min pequeno (as 4 temperaturas de um eixo sao ParetoSimilares)
print("=" * 78)
print("GRUPOS DE 4 VALORES SIMILARES (assinatura de temperaturas 100-900 C)")
print("=" * 78)
for idx in range(len(best) - 3):
    q = best[idx:idx + 4]
    if all(100 < x < 900 for x in q) and (max(q) - min(q)) < 60:
        print(f"  off {idx*4:4d}  ->  " + "  ".join(f"{x:8.2f}" for x in q))

print()
print("=" * 78)
print("VALORES MUITO ALTOS (>1000) - onde o 375 C aparece")
print("=" * 78)
for idx, v in enumerate(best):
    if 1000 < v < 100000:
        print(f"  off {idx*4:4d}  f[{idx:3d}] = {v:14.2f}")
