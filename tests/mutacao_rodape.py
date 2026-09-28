# -*- coding: utf-8 -*-
r"""tests\mutacao_rodape.py  --  a regra do rodape' e' mesmo verificada.

O que este script prova: as duas verificacoes novas do
`auditar_frontend.py` -- o rodape' tem uma frase para cada jogo
registado, e nem o titulo nem o ecra' de espera nomeiam um jogo antes de
o escolher -- **mordem**. Parte o codigo de proposito, corre o auditor, e
confirma que acusa.

Sem isto, as duas verificacoes podiam estar a passar sem provar nada: uma
chave que o auditor nao encontra e' uma chave que ele nao acusa, e a
diferenca entre "morde" e "esta la' por-decoracao-decoration" so' se ve partindo
a coisa.

Cada mutacao parte o `static/` e DEPOIS restaura, a partir de uma copia
feita antes. A copia importa: o `static/` e' a unica coisa que o browser
le, e um script de teste que deixa o codigo partido atras de si da' uma
suite verde sobre codigo morto.

Corre:  python tests\mutacao_rodape.py
"""
import io
import os
import shutil
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ST = os.path.join(RAIZ, "static")
COPIA = os.path.join(os.environ.get("TEMP", RAIZ), "act_static_bom")
AUDITOR = os.path.join(RAIZ, "tests", "auditar_frontend.py")

# (descricao, ficheiro, texto que se apaga, o que se põe no lugar,
#  a palavra que o auditor tem de dizer)
MUTACOES = [
    ("o titulo volta a dizer 'Telemetria AC'",
     "app.js", "    'app.title': 'Telemetria',",
     "    'app.title': 'Telemetria AC',", "nomeiam um"),

    ("o ecra' de espera volta a dizer 'A aguardar o Assetto Corsa'",
     "app.js", "    'boot.waiting': 'A aguardar o jogo',",
     "    'boot.waiting': 'A aguardar o Assetto Corsa',", "nomeiam um"),

    ("o rodape' deixa de ter frase para o F1 25",
     "app.js", "    'foot.src.f125': 'UDP, sem SimHub',\n", "",
     "rodape'"),
]


def rodar_auditor():
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1",
               PYTHONIOENCODING="utf-8")
    p = subprocess.run([sys.executable, AUDITOR], cwd=RAIZ, env=env,
                       capture_output=True, text=True, encoding="utf-8",
                       errors="replace", timeout=180)
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def aplicar(ficheiro, velho, novo):
    """Troca um texto no ficheiro, mantendo o fim de linha do ficheiro."""
    caminho = os.path.join(ST, ficheiro)
    s = io.open(caminho, encoding="utf-8", newline="").read()
    NL = "\r\n" if "\r\n" in s else "\n"
    alvo = NL.join(velho.split("\n")) if "\n" in velho else velho
    if alvo not in s:
        raise SystemExit("  a mutacao nao encontra o texto em %s: %r"
                         % (ficheiro, velho[:60]))
    s = s.replace(alvo, NL.join(novo.split("\n")) if "\n" in novo else novo, 1)
    io.open(caminho, "w", encoding="utf-8", newline="").write(s)


def main():
    if os.path.isdir(COPIA):
        shutil.rmtree(COPIA)
    shutil.copytree(ST, COPIA)

    # A base tem de passar ANTES de partir seja o que for. Se nao passar,
    # uma mutacao que "falha" o auditor nao prova nada -- o auditor ja
    # estava a falhar.
    rc, _ = rodar_auditor()
    print("  %s a base passa (rc=%d)"
          % ("ok  " if rc == 0 else "FALHA", rc))
    if rc != 0:
        shutil.rmtree(COPIA)
        return 1
    base_ok = True

    print()
    print("  cada mutacao tem de fazer o auditor acusar")
    falhas = 0
    try:
        for desc, ficheiro, velho, novo, esperado in MUTACOES:
            # volta a base antes de cada mutacao, para uma nao depender
            # do estado em que a anterior deixou o ficheiro
            shutil.rmtree(ST)
            shutil.copytree(COPIA, ST)
            aplicar(ficheiro, velho, novo)
            rc, saida = rodar_auditor()
            apanhou = (rc != 0) and (esperado in saida)
            print("    %s %s" % ("OK  " if apanhou else "FALHA", desc))
            if not apanhou:
                falhas += 1
                print("       rc=%d; a saida nao contem %r" % (rc, esperado))
                for linha in saida.splitlines():
                    if "FALHA" in linha:
                        print("       %s" % linha.strip()[:150])
    finally:
        # restaura SEMPRE, mesmo com uma mutacao a rebentar a meio
        shutil.rmtree(ST)
        shutil.copytree(COPIA, ST)
        shutil.rmtree(COPIA)

    rc, _ = rodar_auditor()
    print()
    print("  restaurado: rc=%d, %s"
          % (rc, "a base volta a passar" if rc == 0 else "A BASE FICOU PARTIDA"))
    if rc != 0:
        return 1
    return 0 if (base_ok and not falhas) else 1


if __name__ == "__main__":
    sys.exit(main())
