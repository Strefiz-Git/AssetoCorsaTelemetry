# -*- coding: utf-8 -*-
"""
Prova que os testes真的 falham quando devem.

Um teste que nunca falha nao prova nada - e foi exactamente assim que a
estrutura errada passou a 100% no comeco do projecto (AGENTS.md Regra n.4).
Este script parte o codigo de proposito, corre o teste, e confirma que o
teste disse que estava mal. No fim restaura tudo.

Corre com o AC fechado.

ARMADILHA QUE JA CUSTOU TEMPO (leia antes de mexer):
este script reescreve acshm.py no sitio. O Python guarda o bytecode em
__pycache__ e valida-o pelo PAR (data de modificacao em segundos, tamanho
do ficheiro). Uma mutacao que troca '.y' por '.z' mantem o tamanho, e o
restaurar logo a seguir cai no mesmo segundo - portanto o Python
reutiliza o .pyc compilado da versao PARTIDA. O teste passa a mentir,
a dar valores de uma versao do codigo que ja nao esta no disco.

Daqui a regra: os sub-processos correm com PYTHONDONTWRITEBYTECODE=1 e a
cache e apagada antes de cada corrida. Nao e' paranoia, e' o que aconteceu.
"""
import io
import os
import shutil
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALVO = os.path.join(RAIZ, "acshm.py")
TESTE = os.path.join("tests", "test_opponents.py")

# (descricao, original, partido)
MUTACOES = [
    ("campo novo a meio (isConnected repetido)",
     '("isCarInPit", c_int32),',
     '("isCarInPit", c_int32),\n        ("isConnected", c_int32),'),

    ("campo novo no fim (tyreWearAdded)",
     '("tyreInflation", c_float * 4),',
     '("tyreInflation", c_float * 4),\n        ("tyreWearAdded", c_float * 4),'),

    ("m/s esquecidos na conversao para km/h",
     '"speed": round(c.speedMS * 3.6, 1),',
     '"speed": round(c.speedMS, 1),'),

    ("posicao ao vivo trocada com a oficial",
     '"livePos": int(c.carRealTimeLeaderboardPosition),',
     '"livePos": int(c.carLeaderboardPosition),'),

    ("filtro de carros sem nome desligado",
     "if not name:",
     "if False:"),

    ("'y' trocada por 'z' (o bug do plano do mapa)",
     '"y": round(c.worldPosition.y, 2),',
     '"y": round(c.worldPosition.z, 2),'),

    ("tempo em ms lido como se fossem segundos",
     '"best": _ms(c.bestLapMS),',
     '"best": str(c.bestLapMS),'),

    ("box confundido com a lane do box",
     '"inPit": bool(c.isCarInPit),',
     '"inPit": bool(c.isCarInPitline),'),
]

ENV = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", PYTHONIOENCODING="utf-8")


def limpar_cache():
    for pasta in ("__pycache__", os.path.join("tests", "__pycache__")):
        p = os.path.join(RAIZ, pasta)
        if os.path.isdir(p):
            shutil.rmtree(p, ignore_errors=True)


def correr_teste():
    limpar_cache()
    r = subprocess.run([sys.executable, "-u", os.path.join(RAIZ, TESTE)],
                       cwd=RAIZ, capture_output=True, text=True,
                       encoding="utf-8", errors="replace", env=ENV)
    return r.returncode, (r.stdout or "") + (r.stderr or "")


def escrever(conteudo):
    with io.open(ALVO, "w", encoding="utf-8", newline="") as f:
        f.write(conteudo)


def main():
    limpar_cache()

    rc, saida = correr_teste()
    if rc != 0:
        print("FALHA: o teste ja falha sem nenhuma alteracao.")
        print(saida)
        return 1
    print("base: o teste passa  OK")
    print()

    with io.open(ALVO, encoding="utf-8", newline="") as f:
        original = f.read()

    problemas = []
    for desc, antes, depois in MUTACOES:
        if antes not in original:
            problemas.append("  nao encontrei o codigo a mutar: %r" % antes)
            print("  ??  %s" % desc)
            continue
        escrever(original.replace(antes, depois, 1))
        try:
            rc, _ = correr_teste()
        finally:
            escrever(original)
        apanhou = rc != 0
        print("  %s  %s" % ("OK   " if apanhou else "FALHOU", desc))
        if not apanhou:
            problemas.append("  o teste NAO reparou: %s" % desc)

    # garantir que o disco ficou como estava E que a cache nao mente
    with io.open(ALVO, encoding="utf-8", newline="") as f:
        if f.read() != original:
            problemas.append("  acshm.py nao foi restaurado!")
            print("  !!  acshm.py ficou alterado")
    limpar_cache()
    rc, _ = correr_teste()
    if rc != 0:
        problemas.append("  depois de restaurar, o teste ainda falha")
        print("  !!  o teste ainda falha com o codigo limpo")

    print()
    if problemas:
        print("!!! %d PROBLEMA(S) !!!" % len(problemas))
        print("\n".join(problemas))
        return 1
    print("OK: as %d mutacoes foram todas detectadas, e o codigo esta intacto."
          % len(MUTACOES))
    print("Os testes mordem mesmo, ou nao servem para nada.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
