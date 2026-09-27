"""
Valida o LAYOUT das structs: escreve um valor unico em TODOS os campos e
le tudo de volta. Se a ordem ou a dimensao de algum campo estiver errada,
a leitura devolve o valor do campo vizinho - que e' o tipo de bug que nao
aparece nos testes normais.
"""
import ctypes
import os
import sys
from ctypes import wintypes

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import acshm

k = ctypes.WinDLL("kernel32", use_last_error=True)
k.CreateFileMappingW.restype = wintypes.HANDLE
k.CreateFileMappingW.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.DWORD,
                                 wintypes.DWORD, wintypes.DWORD, wintypes.LPCWSTR]

BASE = 1000


def write_field(obj, name, ftype, v):
    """Escreve v em obj.name e devolve o que espera ler de volta."""
    n = getattr(ftype, "_length_", None)
    elem = getattr(ftype, "_type_", ftype)

    if n is not None:                                   # array
        # c_float tambem tem um atributo _type_ (a string 'f'), por isso
        # so consideramos 'array de arrays' quando o elemento E' um array.
        is_nested = (hasattr(elem, "_length_")
                     and isinstance(getattr(elem, "_type_", None), type))
        if is_nested:                                   # array de arrays
            m = getattr(elem, "_length_", 1)
            arr = getattr(obj, name)
            for j in range(n):
                for kk in range(m):
                    arr[j][kk] = float(v) + j * m + kk
            return [[float(v) + j * m + kk for kk in range(m)] for j in range(n)]

        if elem is ctypes.c_wchar:                      # string
            s = (str(v) + "A" * 8)[:n - 1]
            setattr(obj, name, s)
            return s

        if elem is ctypes.c_float:                      # float[]
            vals = [float(v) + j for j in range(n)]
            setattr(obj, name, (ctypes.c_float * n)(*vals))
            return vals

        if elem is ctypes.c_int32:                      # int[]
            vals = [v + j for j in range(n)]
            setattr(obj, name, (ctypes.c_int32 * n)(*vals))
            return vals

        raise TypeError("array nao tratado: %s (%s)" % (name, elem))

    if ftype is ctypes.c_wchar:                         # char unico
        setattr(obj, name, "A")
        return "A"
    if ftype is ctypes.c_float:
        setattr(obj, name, float(v))
        return float(v)
    if ftype is ctypes.c_int32:
        setattr(obj, name, v)
        return v
    raise TypeError("escalar nao tratado: %s (%s)" % (name, ftype))


def read_field(obj, name, ftype):
    n = getattr(ftype, "_length_", None)
    elem = getattr(ftype, "_type_", ftype)
    got = getattr(obj, name)

    if n is not None:
        if elem is ctypes.c_wchar:                      # string, nao lista
            return got.rstrip("\0")
        is_nested = (hasattr(elem, "_length_")
                     and isinstance(getattr(elem, "_type_", None), type))
        if is_nested:                                   # array de arrays
            m = getattr(elem, "_length_", 1)
            return [[round(got[j][kk], 3) for kk in range(m)] for j in range(n)]
        return [round(x, 3) if isinstance(x, float) else x for x in got]
    if isinstance(got, str):
        return got.rstrip("\0")
    return got


def check(struct, label):
    print("=" * 64)
    print("%s  (%d bytes, %d campos)" % (label, ctypes.sizeof(struct),
                                         len(struct._fields_)))
    h = k.CreateFileMappingW(None, None, acshm.PAGE_READWRITE, 0,
                             ctypes.sizeof(struct), "ac_verify_" + label)
    addr = acshm.k32.MapViewOfFile(h, acshm.FILE_MAP_ALL_ACCESS, 0, 0,
                                   ctypes.sizeof(struct))
    obj = struct.from_address(addr)

    # encher tudo de zero primeiro, para nada herdado atrapalhar
    ctypes.memset(addr, 0, ctypes.sizeof(struct))

    expected = {}
    for i, (fname, ftype) in enumerate(struct._fields_):
        v = BASE + i + 1
        expected[fname] = write_field(obj, fname, ftype, v)

    bad = []
    for fname, ftype in struct._fields_:
        want, got = expected[fname], read_field(obj, fname, ftype)
        if isinstance(want, list):
            ok = len(want) == len(got) and all(
                (abs(a - b) < 1e-6) if isinstance(a, float) else a == b
                for a, b in zip(want, got))
        else:
            ok = want == got
        if not ok:
            bad.append((fname, want, got))

    if bad:
        print("  !!! %d CAMPO(S) A TROCAR !!!" % len(bad))
        for fname, want, got in bad:
            print("      %-26s escrevi %r  ->  leio %r" % (fname, want, got))
    else:
        print("  OK: os %d campos voltam todos com o valor escrito"
              % len(struct._fields_))
    print()
    return len(bad)


total = 0
total += check(acshm.SPageFilePhysics, "SPageFilePhysics")
total += check(acshm.SPageFileGraphic, "SPageFileGraphic")
total += check(acshm.SPageFileStatic, "SPageFileStatic")

print("=" * 64)
if total:
    print("FALHAS: %d campo(s) com layout errado" % total)
    sys.exit(1)
print("LAYOUT VALIDADO nos 3 structs.")
