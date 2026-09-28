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
    ("a aderencia morde mesmo", "py", "mutacao_grip.py"),
    ("leitura de adversarios", "py", "test_opponents.py"),
    ("o F1 25 le-se nos dois formatos", "py", "test_f125_parser.py"),
    ("a app compila", "py", "compilar.py"),
    ("o JavaScript faz parse", "py", "verificar_js.py"),
    ("a app e o leitor falam igual", "py", "test_contrato.py"),
    ("o servidor fica calado", "py", "test_handler.py"),
    # O SISTEMA LIGADO. Todos os outros testam pecas -- structs,
    # regras, contratos -- e este arranca o servidor de verdade e
    # pergunta-lhe o que responde, com os dois jogos. E o unico que
    # apanha um import relativo partido, que so rebenta quando o
    # caminho passa por essa linha.
    ("o sistema ligado, com os dois jogos", "py", "verificar_servidor.py"),
    ("o payload tem o que o painel precisa", "py", "test_payload.py"),
    ("tempos de volta e delta", "node", "test_tempos.js"),
    ("vida do pneu", "node", "test_tyres.js"),
    ("voltas de combustivel", "node", "test_combustivel.js"),
    # As REGRAS dos dois jogos, sem browser e sem nenhum deles a correr.
    # Sao as que estavam dentro da IIFE do `app.js`, onde so seavam
    # vistas no ecra -- e os cortes do clima do AC estavam errados
    # assim durante meses. Ver `static/jogos/`.
    ("as regras dos dois jogos", "node", "test_jogos.js"),
    ("o frontend aguenta-se de pe", "py", "auditar_frontend.py"),
    ("a regra 2.3.3 morde mesmo", "py", "mutacao_acessibilidade.py"),
    # o rodape' e' a unica linha que diz COMO se le o jogo. A regra e'
    # que nao fique a dizer "memoria do AC" com o F1 25 no ecra, e que o
    # titulo e o ecra' de espera nao nomeiem um jogo antes de o escolher.
    ("a regra do rodape' morde", "py", "mutacao_rodape.py"),
    ("valores nao finitos", "py", "verificar_finitos.py"),
    ("os testes mordem mesmo", "py", "test_mutation.py"),
    ("o contrato e' mesmo verificado", "py", "mutacao_contrato.py"),
    ("o loop da app nao engole falhas", "py", "test_loop_app.py"),
    ("o loop da app morde mesmo", "py", "mutacao_loop.py"),
    ("as cenas do tempo sao as do jogo", "node", "test_tempo.js"),
    ("a medicao do pneu morde", "py", "test_medir_tyrewear.py"),
    ("o README bate com o codigo", "py", "verificar_readme.py"),
    ("texto sem caracteres estranhos", "py", "verificar_texto.py"),
    ("a regra do TAB morde", "py", "mutacao_texto.py"),
    ("mensagens de commit limpas", "py", "verificar_commits.py"),
    # O `index.html` diz WHICH scripts entram no browser, e so' o browser
    # le essa lista. O `require` de um teste traz as dependencias que o
    # FICHEIRO declara, e nao as que o HTML lista -- por isso e' que um
    # modulo pode faltar no HTML e todos os testes passarem. Ver a Regra.
    ("os scripts chegam todos ao browser", "node", "test_scripts.js"),
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
        print("aviso: node nao esta instalado; os tres testes de node nao correm")

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
