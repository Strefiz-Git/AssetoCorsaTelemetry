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

# AS MUTACOES E AS NEWLINES
# --------------------------
# As mutacoes escrevem-se com LF, e o ficheiro no disco pode estar com
# CRLF. O `.gitattributes` deste repositorio tem `* text=auto` e o
# `core.autocrlf` do Windows esta' a true, por isso um ficheiro versionado
# chega ao disco com CRLF -- e uma mutacao escrita com LF nao aparece
# NUNCA num ficheiro CRLF.
#
# A terceira mutacao -- "o loop volta a terminar no nome, e volta a
# esconder a falha" -- e' a unica que tem uma quebra de linha dentro, e
# por isso era a unica a ser saltada. O script imprimia "??" e contava-a
# como problema, mas o teste da suite nao a contava como falha, porque o
# `run_all.py` tratava o codigo de saida... e o codigo de saida era 1.
# Ou seja: a suite acusava. Mas quem corria `mutacao_loop.py` a mao via
# cinco "OK" e um "??" e podia nao dar importancia ao "??".
#
# Isto e' a Regra no 4, e a razao de o script ser COPIA: correr o teste
# contra um ficheiro em que o codigo nao esta e' a forma mais facil de
# um teste de mutacao passar sem provar nada. Ver `test_mutation.py`,
# que tem a mesma regra pelo mesmo motivo.
#
# O que se passa agora: a procura e' feita sobre texto NORMALIZADO, e o
# que vai para o disco tem as mesmas newlines que o ficheiro ja tinha.
# Funciona com LF e com CRLF, e o resto do script fica igual.


def _normaliza(t):
    return t.replace("\r\n", "\n").replace("\r", "\n")


original = io.open(ALVO, encoding='utf-8', newline='').read()
plano = _normaliza(original)
# A newline do disco, para reescrever o ficheiro no mesmo formato em que
# o encontrámos. Sem isto, guardar o resultado normalizado transformava
# o ficheiro inteiro em LF, e o `git diff` no fim mostrava 662 linhas
# alteradas.
_newline_disco = "\r\n" if "\r\n" in original else "\n"


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
    if certo not in plano:
        problemas.append("  nao encontrei o codigo a mutar: %r" % certo[:50])
        print("  ??   %s" % desc)
        continue
    io.open(ALVO, 'w', encoding='utf-8', newline='').write(
        plano.replace(certo, partido, 1).replace("\n", _newline_disco))
    try:
        rc, _ = correr()
    finally:
        io.open(ALVO, 'w', encoding='utf-8', newline='').write(original)
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
