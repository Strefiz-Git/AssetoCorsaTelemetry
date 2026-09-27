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
# `ac_info` esta no .gitignore: e' material de terceiros que o
# utilizador deixa ao lado para eu ler, e nao faz parte do projecto.
#
# Sem esta exclusao, o verificador acusava 295 linhas de CJK -- todas
# de `pure_planner_Chinese.txt`, que e' o ficheiro de AJUDA EM CHINES do
# Pure Planner. Nao era um erro nosso nem um erro do Pure Planner: era
# um ficheiro em chinês, numa pasta de terceiro, que o teste varria
# porque varre a arvore toda.
#
# E a razao de nao ser uma lista de excepcoes por ficheiro: o que
# exclui e' a PASTA, e a razao e' que ela esta' fora do projecto. Um
# ficheiro de terceiro que aparecesse dentro de `static/` ou `tests/`
# continuava a ser acusado -- que e' o que se quer.
SECTIONS = ("\\.git", "__pycache__", "\\fonts", "\\ac_info")

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
