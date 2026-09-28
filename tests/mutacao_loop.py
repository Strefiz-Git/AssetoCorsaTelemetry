# -*- coding: utf-8 -*-
"""Prova que o test_loop_app morde: volta os bugs de proposito.

Um teste que nunca falha nao prova nada (AGENTS.md Regra no 4 e no 12).
Volta cada um dos tres defeitos, um de cada vez, e confirma que o teste
acusa. No fim restaura tudo e confirma que volta a passar.
"""
import io
import subprocess
import sys
import os

ALVO = 'python_app/actelemetry_strefiz/actelemetry_strefiz.py'
TESTE = 'tests/test_loop_app.py'

# (descricao, certo, partido)
MUTACOES = [
    ("as rodas outra vez pela classe em vez de range(4)",
     "for roda in range(4)]",
     "for roda in acsys.WHEELS]"),

    ("o _seguro volta a devolver 0.0, que o ctypes recusa num campo inteiro",
     "def _seguro(ler, alt=0):",
     "def _seguro(ler, alt=0.0):"),

    ("o loop volta a terminar no nome, e volta a esconder a falha",
     "        nome, deuCerto = _tentar(lambda: ac.getCarName(carId), '')\n"
     "        if deuCerto and str(nome) == '-1':",
     "        nome, deuCerto = _seguro(lambda: ac.getCarName(carId), '-1'), True\n"
     "        if str(nome) == '-1':"),
    ("a sondagem do clima passa a chamar em vez de perguntar antes",
     "        _EXT[nome] = getattr(ac, nome, None)",
     "        _EXT[nome] = (lambda f: (lambda: f(ac, nome)))(getattr)"),

    ("o _num volta a recusar sequencias (os 4 campos a zero)",
     "    if isinstance(v, (list, tuple)):",
     "    if isinstance(v, str) and len(v) == 99:"),

]

ENV = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", PYTHONIOENCODING="utf-8")

# ---------------------------------------------------------------------------
# AS FINAIS DE LINHA: PORQUE ISTO ESTA AQUI
#
# O git guarda LF, e o Windows checked-out em CRLF. O `io.open(...,
# newline='')` devolve o ficheiro tal e como esta, CRLF incluido, e uma
# procura feita com `\n` nunca casa. A unica das cinco mutacoes que
# falhava era a que tem uma ancora de DUAS LINHAS -- as outras quatro sao
# de uma linha so, e uma linha casa com CRLF ou com LF sem Repair.
#
# A mutacao "o loop volta a terminar no nome" deixava de ser mutada, o
# teste nao a exercise, e o script acabava com
#
#     nao encontrei o codigo a mutar
#
# que parece um erro do codigo a mutar e e' um erro de finais de linha.
# As outras quatro continuavam a passar, entao a suite dava quase tudo
# certo -- que e' a pior forma de isto acontecer.
#
# A leitura e' feita com `newline=''` para o ORIGINAL continuar a ter as
# finais que tinha: se o teste devolvesse o ficheiro com LF quando o
# disco tem CRLF, o `git status` mostraria um ficheiro alterado que
# ninguem alterou. A busca e' que se faz sobre uma versao normalizada.
# ---------------------------------------------------------------------------
original = io.open(ALVO, encoding='utf-8', newline='').read()
original_nl = original.replace('\r\n', '\n')
tem_crlf = original != original_nl
if tem_crlf:
    print("nota: %s tem CRLF. A busca e' feita sobre LF e o ficheiro e'"
          " devolvido como estava." % ALVO)


def escrever(texto_lf):
    """Escreve o que se leu, com as finais de linha que tinha."""
    io.open(ALVO, 'w', encoding='utf-8', newline='').write(
        texto_lf.replace('\n', '\r\n') if tem_crlf else texto_lf)


def correr():
    r = subprocess.run([sys.executable, "-u", TESTE], capture_output=True,
                       text=True, encoding="utf-8", errors="replace", env=ENV)
    return r.returncode, (r.stdout or "") + (r.stderr or "")


rc, saida = correr()
if rc != 0:
    print("FALHA: o teste ja falha sem nenhuma alteracao.")
    print(saida)
    sys.exit(1)
print("base: o teste passa  OK")
print()

problemas = []
for desc, certo, partido in MUTACOES:
    if certo not in original_nl:
        problemas.append("  nao encontrei o codigo a mutar: %r" % certo[:50])
        print("  ??   %s" % desc)
        continue
    escrever(original_nl.replace(certo, partido, 1))
    try:
        rc, _ = correr()
    finally:
        escrever(original_nl)
    apanhou = rc != 0
    print("  %s  %s" % ("OK   " if apanhou else "FALHOU", desc))
    if not apanhou:
        problemas.append("  o teste NAO reparou: %s" % desc)

# o disco tem de ter ficado como estava
if io.open(ALVO, encoding='utf-8', newline='').read() != original:
    problemas.append("  o plugin ficou alterado!")
    print("  !!  o plugin ficou alterado")

rc, _ = correr()
if rc != 0:
    problemas.append("  depois de restaurar, o teste ainda falha")
    print("  !!  ainda falha com o codigo limpo")

print()
if problemas:
    print("!!! %d PROBLEMA(S) !!!" % len(problemas))
    print("\n".join(problemas))
    sys.exit(1)
print("OK: as %d mutacoes foram detectadas, e o codigo esta intacto."
      % len(MUTACOES))
