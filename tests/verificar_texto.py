# -*- coding: utf-8 -*-
"""Verifica se os ficheiros do projecto têm caracteres estranhos (CJK, etc.).

 Sai com codigo 1 se encontrar algum, para a suite apanhar. Ja apanhou
varios meus, escritos sem querer em comentarios. Nao fazem mal ao
programa, mas perturbam a leitura e escondem erros a serio num ficheiro
comprido.
"""
import io, os, sys, unicodedata
sys.stdout.reconfigure(encoding="utf-8")

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTENSOES = (".py", ".js", ".md", ".css", ".html", ".bat", ".txt", ".json")
SECTIONS = ("\\.git", "__pycache__", "\\fonts")

n = 0
for pasta, _, ficheiros in os.walk(RAIZ):
    if any(x in pasta for x in SECTIONS):
        continue
    for f in ficheiros:
        if not f.endswith(EXTENSOES):
            continue
        caminho = os.path.join(pasta, f)
        try:
            txt = io.open(caminho, encoding="utf-8").read()
        except (UnicodeDecodeError, OSError):
            continue
        for num, linha in enumerate(txt.split("\n"), 1):
            for ch in linha:
                nome = unicodedata.name(ch, "")
                if any(p in nome for p in ("CJK", "HIRAGANA", "KATAKANA", "HANGUL", "IDEOGRAPH")):
                    rel = os.path.relpath(caminho, RAIZ)
                    print("  %s:%d  %s" % (rel, num, nome))
                    n += 1
                    break

print("%d linhas com caracteres CJK" % n)
if n:
    print("  Estes caracteres nao deviam estar aqui. Ver a nota em AGENTS.md.")
    sys.exit(1)
print("  ok: nenhum")
