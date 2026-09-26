"""
Verificacao contra o AC REAL: le a pagina de fisica e compara as
temperaturas com o que a sonda de offsets encontrou. Confirma tambem
o que e' realmente o campo tyreWear.
"""
import ctypes, struct, time
import acshm

k = acshm.k32
h = k.OpenFileMappingW(acshm.FILE_MAP_READ, False, "acpmf_physics")
a = k.MapViewOfFile(h, acshm.FILE_MAP_READ, 0, 0, 4096)

F = acshm.SPageFilePhysics.from_address(a)

print("=== campos da cauda, agora com o alinhamento correcto ===")
print("  brakeTemp     ", [round(v, 1) for v in F.brakeTemp])
print("  clutch        ", round(F.clutch, 3))
print("  tyreTempI     ", [round(v, 1) for v in F.tyreTempI])
print("  tyreTempM     ", [round(v, 1) for v in F.tyreTempM])
print("  tyreTempO     ", [round(v, 1) for v in F.tyreTempO])
print("  isAIControlled", F.isAIControlled)
print("  contactP[0]   ", [round(v, 1) for v in F.tyreContactPoint[0]])
print()
print("  DRS  -> drs=%.2f  drsAvailable=%d  drsEnabled=%d" % (F.drs, F.drsAvailable, F.drsEnabled))
print("  ERS  -> kersCharge=%.4f  kersCurrentKJ=%.1f  ersIsCharging=%d" %
      (F.kersCharge, F.kersCurrentKJ, F.ersIsCharging))
print()
print("=== tyreWear: que valor e' este? ===")
off = getattr(acshm.SPageFilePhysics, "tyreWear").offset
print("  offset no struct: %d" % off)
print("  valor: ", [round(v, 3) for v in F.tyreWear])
print("  a fechar: ", [round(v, 3) for v in F.tyreDirtyLevel])
print("  pressao:  ", [round(v, 2) for v in F.wheelsPressure])
print()
print("  dump de floats em torno do offset, para ver a vizinhanca:")
for o in range(off - 32, off + 32, 4):
    v = struct.unpack_from("<f", ctypes.string_at(a, 4096), o)[0]
    mark = " <-- tyreWear" if o == off else ""
    print(f"    off {o:4d}  {v:14.4f}{mark}")
