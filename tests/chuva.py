# -*- coding: utf-8 -*-
"""
Descobre se o AC publica chuva - comparando a memoria antes e depois de
mudar o estado do tempo.

PORQUE ESTE SCRIPT EXISTE
-------------------------
A conclusao "o AC nao publica chuva" assenta numa coisa que EU escrevi: a
lista de campos do acshm.py. Se a struct real for maior, ha campos que
existem e nao estao a ser lidos, e a conclusao estar errada sem eu dar
por isso.

Ja se tentou responder pelo tamanho da pagina: nao da. A memoria
partilhada e' sempre alocada em paginas de 4 KB, por isso o SO aceita
mapear 4096 bytes mesmo que a struct tenha 296. O padding esta a zeros.
Esse caminho da em nada.

O QUE FAZ
---------
Despeja TODOS os 4 bytes de cada pagina - nao so os campos declarados, que
e' precisamente o ponto - e compara duas capturas:

    python tests\\chuva.py antes     # com o tempo seco
    (mudar o tempo no AC para chuva)
    python tests\\chuva.py depois    # com chuva

O que interessa sao os campos que mudaram. O ficheiro e' reescrito de cada
vez, para se poder repetir. SO LE, NUNCA ESCREVE.

Cada fase tira varias amostras e guarda so os valores que ficam estaveis
dentro da fase. Assim o que muda de frame a frame (velocidade, rpm, pos)
fica de fora, e o que fica e' o que o AC escreveu por causa do novo tempo.
"""
import collections
import ctypes
import json
import os
import struct
import sys
import time
from ctypes import wintypes

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8")
import acshm

FICH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chuva_dump.json")
PAGINAS = ("acpmf_physics", "acpmf_graphics", "acpmf_static")
PALAVRAS = 1024          # 4 KB por pagina
AMOSTRAS = 40


def capturar():
    """Varias amostras; fica com o valor mais comum de cada palavra."""
    brutos = {}
    for nome in PAGINAS:
        h = acshm.k32.OpenFileMappingW(acshm.FILE_MAP_READ, False, nome)
        if not h:
            print("  %s: nao existe" % nome)
            continue
        a = acshm.k32.MapViewOfFile(h, acshm.FILE_MAP_READ, 0, 0, PALAVRAS * 4)
        if not a:
            acshm.k32.CloseHandle(h)
            print("  %s: nao mapeia" % nome)
            continue
        contagem = collections.defaultdict(collections.Counter)
        for _ in range(AMOSTRAS):
            bruto = ctypes.string_at(a, PALAVRAS * 4)
            for i in range(PALAVRAS):
                contagem[i][bruto[i * 4:i * 4 + 4]] += 1
            time.sleep(0.03)
        estavel = {}
        for i, c in contagem.items():
            val, _ = c.most_common(1)[0]
            # so interessa se for ESTAVEL dentro da fase
            if c[val] >= AMOSTRAS * 0.8:
                estavel[i] = val.hex()
        brutos[nome] = estavel
        acshm.k32.UnmapViewOfFile(ctypes.c_void_p(a))
        acshm.k32.CloseHandle(h)
        print("  %s: %d palavras estaveis de %d" % (nome, len(estavel), PALAVRAS))
    return brutos


def nomes_conhecidos():
    """offset -> nome, de tudo o que a struct declara, para legibilidade."""
    m = {}
    for struct in (acshm.SPageFilePhysics, acshm.SPageFileGraphic, acshm.SPageFileStatic):
        for nome, campo in struct._fields_:
            off = getattr(campo, "offset", None)
            if off is not None:
                m.setdefault(off, nome)
    return m


def legivel(hexs):
    b = bytes.fromhex(hexs)
    i = struct.unpack("<i", b)[0]
    f = struct.unpack("<f", b)[0]
    return i, f


def main():
    fase = sys.argv[1] if len(sys.argv) > 1 else ""
    if fase not in ("antes", "depois"):
        print(__doc__)
        print("uso: python tests\\chuva.py antes | depois")
        return 2

    print("fase '%s' - a recolher %d amostras por pagina" % (fase, AMOSTRAS))
    dados = capturar()
    if not dados:
        print("nenhuma pagina lida: o AC esta a correr?")
        return 1

    conhecidos = nomes_conhecidos()

    if fase == "antes":
        with open(FICH, "w", encoding="utf-8") as f:
            json.dump(dados, f)
        print()
        print("guardado em %s" % FICH)
        print("agora muda o tempo no AC (Settings / condicoes da sessao) para")
        print("chuva, e corre:  python tests\\chuva.py depois")
        return 0

    # fase 'depois': comparar
    if not os.path.exists(FICH):
        print("nao existe '%s'. Corre primeiro: python tests\\chuva.py antes" % FICH)
        return 1
    with open(FICH, encoding="utf-8") as f:
        antes = json.load(f)

    total = 0
    for nome in PAGINAS:
        if nome not in antes or nome not in dados:
            continue
        mudados = [i for i in antes[nome]
                   if dados[nome].get(i) and dados[nome][i] != antes[nome][i]]
        print()
        print("=== %s: %d palavras mudaram ===" % (nome.replace("acpmf_", ""), len(mudados)))
        for i in sorted(mudados):
            ia, fa = legivel(antes[nome][i])
            id_, fd = legivel(dados[nome][i])
            etiqueta = conhecidos.get(i * 4, "")
            total += 1
            print("  byte %5d  %-22s" % (i * 4, etiqueta))
            print("      int  %d -> %d      float %g -> %g" % (ia, id_, fa, fd))

    print()
    if total == 0:
        print("NADA mudou nas paginas.")
        print()
        print("Leitura: o AC nao escreve o estado do tempo na memoria")
        print("partilhada. Nao ha campo de chuva. (Ou o tempo escolhido nao")
        print("mudou nada, o que se confirma vendo o ceu no jogo.)")
    else:
        print("%d palavras mudaram. Estas sao as candidatas a clima:" % total)
        print("o que o AC escreve quando muda o tempo. O campo de chuva, se")
        print("existir, esta na lista acima - e o offset 0 de cada pagina e'")
        print("o packetId, que muda sempre.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
