"""DiAGNOSTICO: le o canal SSE durante N segundos e agrupa as combinacoes
que encontrar. Serve para nao concluir a partir de duas amostras."""
import json, sys, urllib.request, collections, time

sys.stdout.reconfigure(encoding="utf-8")
SEG = float(sys.argv[1]) if len(sys.argv) > 1 else 20.0

r = urllib.request.urlopen("http://localhost:8765/events?fps=60", timeout=SEG + 5)
t0 = time.time()
n = 0
pairs = collections.Counter()
clutch = collections.Counter()
spd_when_no_drs = []
spd_all = []
while time.time() - t0 < SEG:
    line = r.readline()
    if not line.startswith(b"data: "):
        continue
    d = json.loads(line[6:])
    n += 1
    av, en, fl = d.get("drsAvailable"), d.get("drsEnabled"), d.get("drs")
    pairs[(av, en, round(fl or 0, 2))] += 1
    clutch[round(d.get("clutchRaw") or 0, 1)] += 1
    if av == 0:
        spd_when_no_drs.append(d.get("speed", 0))
    spd_all.append(d.get("speed", 0))
r.close()

print(f"{n} amostras em {SEG:.0f} s ({n/SEG:.0f} Hz)")
print()
print("drsAvailable / drsEnabled / drs  ->  ocorrencias")
for k, v in pairs.most_common():
    print(f"   {k[0]}  {k[1]}  {k[2]:<5} -> {v}")
print()
print("clutchRaw -> ocorrencias (arredondado a 0.1)")
for k, v in sorted(clutch.items(), reverse=True):
    bar = "#" * max(1, v * 40 // max(clutch.values()))
    print(f"   {k:>4} -> {v:>4}  {bar}")
print()
print(f"velocidade: min {min(spd_all):.0f}  max {max(spd_all):.0f} km/h")
if spd_when_no_drs:
    print(f"velocidades com drsAvailable=0: {sorted(set(round(v) for v in spd_when_no_drs))}")
else:
    print("drsAvailable NUNCA foi 0 em", n, "amostras")
