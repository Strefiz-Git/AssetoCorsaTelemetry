# -*- coding: utf-8 -*-
"""
Descobre o tamanho REAL de cada pagina de memoria partilhada, e o que
ha no que nao estamos a ler.

Porque: a lista de campos do acshm.py e' uma lista que EU escrevi. Se a
pagina real for maior, ha campos que existem e nao sao lidos - e a
conclusao "o AC nao publica chuva" seria apenas "eu nao li a chuva".

Metodo: o SO so aceita MapViewOfFile ate ao tamanho da seccao. Testando
tamanhos cada vez maiores, o maior que ainda aceita e' o tamanho real da
pagina. Depois de-se o que sobrou: e' a zona que ninguem esta a ler.

SO LE. Nunca escreve. Seguro com o jogo a correr.
"""
import ctypes
import sys
from ctypes import wintypes

sys.path.insert(0, r"C:\Users\Strefiz\Documents\GitHub\AssetoCorsaTelemetry")
sys.stdout.reconfigure(encoding="utf-8")
import acshm

PAGINAS = (
    ("acpmf_physics", ctypes.sizeof(acshm.SPageFilePhysics), acshm.SPageFilePhysics),
    ("acpmf_graphics", ctypes.sizeof(acshm.SPageFileGraphic), acshm.SPageFileGraphic),
    ("acpmf_static", ctypes.sizeof(acshm.SPageFileStatic), acshm.SPageFileStatic),
    ("acpmf_simhub_v2", ctypes.sizeof(acshm.SPageFileSimHub), acshm.SPageFileSimHub),
)

# o SO arredonda a paginas de 4 KB, por isso o tamanho util e' procurado
# por tentativas binarias
LIMITE = 64 * 1024


def maior_mapeavel(nome):
    """Maior tamanho que MapViewOfFile aceita para esta pagina."""
    h = acshm.k32.OpenFileMappingW(acshm.FILE_MAP_READ, False, nome)
    if not h:
        return None
    lo, hi = 0, LIMITE          # lo = aceite, hi = recusado
    melhor = 0
    while lo + 4096 <= hi:
        meio = ((lo + hi) // 2 // 4096) * 4096
        if meio <= lo:
            break
        a = acshm.k32.MapViewOfFile(h, acshm.FILE_MAP_READ, 0, 0, meio)
        if a:
            acshm.k32.UnmapViewOfFile(ctypes.c_void_p(a))
            melhor, lo = meio, meio
        else:
            hi = meio
    acshm.k32.CloseHandle(h)
    return melhor


def ler_pagina(nome, tamanho):
    h = acshm.k32.OpenFileMappingW(acshm.FILE_MAP_READ, False, nome)
    if not h:
        return None
    a = acshm.k32.MapViewOfFile(h, acshm.FILE_MAP_READ, 0, 0, tamanho)
    if not a:
        return None
    bruto = ctypes.string_at(a, tamanho)
    acshm.k32.UnmapViewOfFile(ctypes.c_void_p(a))
    acshm.k32.CloseHandle(h)
    return bruto


print("Tamanho real de cada pagina, medido pelo SO")
print("=" * 74)
print("%-20s %10s %10s %8s" % ("pagina", "o que lemos", "real (aprox)", "faltam"))
print("-" * 74)
sobras = {}
for nome, nosso, struct in PAGINAS:
    real = maior_mapeavel(nome)
    if real is None:
        print("%-20s %10s %10s %8s" % (nome.replace("acpmf_", ""), nosso, "ausente", "-"))
        continue
    # a seccao e' multipla de 4 KB, por isso o tamanho real e' o maior
    # multiplo de 4 KB que o SO aceita. O struct verdadeiro esta entre
    # o ultimo multiplo-4096 e esse multiplo.
    print("%-20s %10d %10d %8s" % (nome.replace("acpmf_", ""), nosso, real,
          "sim" if real > nosso else "nao"))
    if real > nosso:
        sobras[nome] = (real, struct)

print()
print("=" * 74)
print("A parte que o acshm.py NAO le")
print("=" * 74)
if not sobras:
    print("Nenhuma pagina e maior do que a nossa struct. A lista de campos")
    print("cobre a pagina toda, e a conclusion sobre a chuva fica de pe.")
    sys.exit(0)

for nome, (real, struct) in sobras.items():
    bruto = ler_pagina(nome, real)
    if bruto is None:
        continue
    # offset do fim da nossa struct
    fim = ctypes.sizeof(struct)
    print()
    print("--- %s: %d bytes a seguir ao nosso struct ---" % (nome, real - fim))
    print("    (o tamanho util real e' no maximo %d; o resto e' arredondamento)" % real)
    ultimo_campos = {}
    for nome_campo, campo in struct._fields_:
        ultimo_campos[getattr(campo, "offset", 0)] = nome_campo
    inicio = (fim // 4) * 4
    linha = []
    for off in range(inicio, min(fim + 256, len(bruto) - 3), 4):
        i = ctypes.c_int32.from_buffer_copy(bruto[off:off + 4]).value
        f = ctypes.c_float.from_buffer_copy(bruto[off:off + 4]).value
        marca = "  <-- ultimo campo declarado: %s" % ultimo_campos.get(off, "") if off in ultimo_campos else ""
        linha.append("  +%4d  int=%-12d float=%-14.4f%s" % (off - inicio, i, f, marca))
    print("\n".join(linha[:40]))
    print("    ... (a continuar)")
