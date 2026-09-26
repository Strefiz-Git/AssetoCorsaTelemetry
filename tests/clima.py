# -*- coding: utf-8 -*-
"""
Lista os campos que o acshm ja le, e procura mais candidatos a clima.
Nao escreve nada: so le. Por isso e' seguro com o jogo a correr.
"""
import ctypes
import sys

sys.path.insert(0, r"C:\Users\Strefiz\Documents\GitHub\AssetoCorsaTelemetry")
sys.stdout.reconfigure(encoding="utf-8")
import acshm

INTERESSA = ("temp", "rain", "wind", "cloud", "density", "weat", "fog",
             "wet", "grip", "surface", "ambient", "humid", "track")

for nome, struct in (("FISICA", acshm.SPageFilePhysics),
                     ("GRAFICOS", acshm.SPageFileGraphic),
                     ("ESTATICA", acshm.SPageFileStatic)):
    print("=== %s (%d bytes) ===" % (nome, ctypes.sizeof(struct)))
    for fname, campo in struct._fields_:
        baixo = fname.lower()
        if any(k in baixo for k in INTERESSA):
            print("   %-26s %s" % (fname, str(campo)[:40]))
    print()

print()
print("=== o que o snapshot expoe hoje, com as palavras de clima ===")
s = acshm.ACTelemetry()
if not s.connected:
    print("AC nao esta ligado")
    raise SystemExit(0)
snap = s.snapshot()
for k in sorted(snap):
    if any(x in k.lower() for x in INTERESSA):
        print("   %-22s = %r" % (k, snap[k]))

print()
print("=== leitura directa dos campos que existem mas nao sao expostos ===")
try:
    g = acshm.ACTelemetry._views if hasattr(acshm.ACTelemetry, "_views") else None
except Exception:
    g = None
t = acshm.ACTelemetry()
v = t._views
for rotulo, chave in (("FISICA", "acpmf_physics"), ("GRAFICOS", "acpmf_graphics"),
                      ("ESTATICA", "acpmf_static")):
    ent = v.get(chave)
    if not ent:
        continue
    _, _, struct = ent
    obj = struct
    for fname, campo in struct._fields_:
        baixo = fname.lower()
        if any(x in baixo for x in INTERESSA) and fname not in ("tyreTempI", "tyreTempM", "tyreTempO", "brakeTemp", "tyreCoreTemp"):
            try:
                val = getattr(obj, fname)
            except Exception as e:
                val = "erro: %s" % e
            print("   %-10s %-22s = %r" % (rotulo, fname, val))
t.close()
