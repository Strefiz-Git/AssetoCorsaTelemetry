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
SECTIONS = ("\\.git", "__pycache__", "\\fonts", "\\ac_info",
            # o `f1-2021-udp` que esta' em `resources/docs/` e' o
            # codigo-fonte original da Codemasters, indentado com
            # TAB como o C++ manda. Um TAB entre duas letras e' la a
            # separacao entre o nome do campo e a declaracao, e nao
            # um caminho partido.
            "\\resources")

# ---------------------------------------------------------------------------
# TABS NUMA PATH: a corrupcao que nao se ve a ler
# ---------------------------------------------------------------------------
# Um `\t` escrito dentro de uma string Python normal, num script que reescreve
# o `AGENTS.md`, vira um TAB de verdade. O resultado e'
#
#     3. corre `python tests<TAB>est_f125_parser.py`
#
# que nao existe, e que se le como se existisse -- porque um TAB numa
# linha Markdown parece um espaco largo, e o olho passa por cima. O
# comando nao corre, e ninguem sabe porque.
#
# A razao de isto estar aqui e' a mesma de o resto deste ficheiro: e' uma
# classe de erro que o programa aceita em silencio. A alternativa e' reescrever
# o `AGENTS.md` a mao, que e' pior.
#
# O ficheiro tem de conter a path, e o caminho tem de existir. E um TAB em
# qualquer lado dentro de uma linha que pareca uma path e' suspecto.
TABS = 0
for pasta, _, ficheiros in os.walk(RAIZ):
    if any(x in pasta for x in SECTIONS):
        continue
    for f in ficheiros:
        if not f.endswith(EXTENSOES):
            continue
        caminho = os.path.join(pasta, f)
        try:
            linhas = io.open(caminho, encoding="utf-8").read().split("\n")
        except (UnicodeDecodeError, OSError):
            continue
        for num, linha in enumerate(linhas, 1):
            if "\t" not in linha:
                continue
            # Um TAB e' TABulacao e e' normal. O que parte um caminho e'
            # um TAB **dentro de uma palavra**: a letra de um lado, outra
            # letra do outro, sem espaco pelo meio. E a assinatura do
            # "\t" que se tornou TAB, e mais nada.
            for i, ch in enumerate(linha):
                if ch != "\t":
                    continue
                antes = linha[i - 1] if i else ""
                depois = linha[i + 1] if i + 1 < len(linha) else ""
                if antes.isalnum() and depois.isalnum():
                    rel = os.path.relpath(caminho, RAIZ)
                    print("  %s:%d  TAB DENTRO de uma palavra: %s"
                          % (rel, num, linha.strip()[:70]))
                    TABS += 1
                    break

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
if TABS:
    print("%d linhas com um TAB dentro, que parte um caminho" % TABS)
    print("  Um \\t escrito numa string Python virou um TAB. O comando nao")
    print("  corre, e a linha parece estar certa a ler.")
if n or TABS:
    sys.exit(1)
print("  ok: nenhum")
