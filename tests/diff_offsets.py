import acshm

# offsets reais, descobertos olhando para os valores reais
REAL = {
    "brakeTemp":     348,   # 187, 187, 150, 150  (frente/quente, tras/frio)
    "clutch":        364,   # 0.069
    "tyreTempI":     368,   # 57.7 57.0 62.0 61.9
    "tyreTempM":     384,   # 59.4 55.4 63.3 60.9
    "tyreTempO":     400,   # 61.2 54.0 64.2 59.7
    "isAIControlled":416,   # 0
    "tyreContactPoint":420, # 532, 72, 936 repetidos 4x
}

print("%-24s %8s %8s %8s" % ("campo", "meu", "real", "delta"))
print("-" * 52)
mine = {}
for name, ft in acshm.SPageFilePhysics._fields_:
    mine[name] = getattr(acshm.SPageFilePhysics, name).offset

for name, real in REAL.items():
    m = mine.get(name)
    if m is None:
        print("%-24s %8s %8d %8s" % (name, "???", real, "-"))
    else:
        print("%-24s %8d %8d %+8d" % (name, m, real, m - real))

print()
print("Os valores reais {'real'} confirmam-se por agrupamento:")
print("  brakeTemp   -> 4 floatsfollowed (187,187,150,150) = 2 dianteiros + 2 traseiros")
print("  clutch      -> 0.069 logo a seguir")
print("  3 blocos de 4 floats (55-64) = temperaturas interior/meio/exterior")
print("  depois, a repetir (532, 72, 936) = coordenadas do ponto de contacto")
print()
print("Conclusao: estou a ler %+d bytes de deslocamento nos campos da cauda."
      % (mine.get("brakeTemp", 0) - REAL["brakeTemp"]))
