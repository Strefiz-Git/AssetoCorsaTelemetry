# -*- coding: utf-8 -*-
"""
Corre a suite toda, por ordem. Sai com codigo != 0 se algo falhar.

    python tests\\run_all.py

Regras que este script cumpre, e que Os testes individuais tambem cumprem:
  - NUNCA escrever nas paginas reais do AC. Os testes usam "ac_test_*"
    e abortam sozinhos se o jogo estiver a correr (AGENTS.md Regra n.1).
  - NUNCA escrever bytecode, e limpar a cache antes de cada teste. Um
    .pyc de uma versao partida do codigo faz o teste mentir sem dar erro
    nenhum. Ver tests\\test_mutation.py para a historia toda.
"""
import os
import shutil
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", PYTHONIOENCODING="utf-8")

SUITE = [
    ("layout das structs", "py", "test_layout.py"),
    ("leitura de telemetria", "py", "test_acshm.py"),
    ("leitura de adversarios", "py", "test_opponents.py"),
    ("o servidor fica calado", "py", "test_handler.py"),
    ("tempos de volta e delta", "node", "test_tempos.js"),
    ("vida do pneu", "node", "test_tyres.js"),
    ("os testes mordem mesmo", "py", "test_mutation.py"),
    ("texto sem caracteres estranhos", "py", "verificar_texto.py"),
]

# codigo 2 = "o jogo esta a correr, nao se pode testar". Nao e' falha: e
# o aviso a dizer para fechar o AC. Dizemos isso e seguimos.
AVISO_JOGO_VIVO = 2


def limpar_cache():
    for pasta in ("__pycache__", os.path.join("tests", "__pycache__")):
        p = os.path.join(RAIZ, pasta)
        if os.path.isdir(p):
            shutil.rmtree(p, ignore_errors=True)


def cabecalho(n, total, nome):
    print()
    print("=" * 68)
    print(" %d/%d  %s" % (n, total, nome))
    print("=" * 68)


def tem_node():
    from shutil import which
    return which("node") is not None


def main():
    limpar_cache()
    print("Assetto Corsa Telemetry - suite de testes")
    print("regra: com o AC a correr, os testes de memoria sao ignorados")
    if not tem_node():
        print("aviso: node nao esta instalado, o teste de tempos nao corre")

    total = len(SUITE)
    falhou, ignorados = [], []

    for i, (nome, tipo, ficheiro) in enumerate(SUITE, 1):
        cabecalho(i, total, nome)
        caminho = os.path.join("tests", ficheiro)
        if tipo == "node":
            if not tem_node():
                print("saltado: node nao esta instalado")
                ignorados.append(nome + " (sem node)")
                continue
            argv = ["node", caminho]
        else:
            limpar_cache()
            argv = [sys.executable, "-u", caminho]
        r = subprocess.run(argv, cwd=RAIZ, capture_output=True, text=True,
                           encoding="utf-8", errors="replace", env=ENV)
        saida = (r.stdout or "") + (r.stderr or "")
        print(saida.rstrip())
        if r.returncode == 0:
            continue
        if r.returncode == AVISO_JOGO_VIVO:
            ignorados.append(nome)
        else:
            falhou.append(nome)

    cabecalho(total, total, "resumo")
    if ignorados:
        print("ignorados (o AC esta a correr): %s" % ", ".join(ignorados))
    if falhou:
        print("FALHARAM: %s" % ", ".join(falhou))
        return 1
    print("tudo o que se podia correr passou.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
