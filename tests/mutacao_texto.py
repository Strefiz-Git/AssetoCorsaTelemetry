"""Verifica que a regra dos TABs morde, mutando o ficheiro de proposito.

E' a mutacao do `mutacao_*.py`, e a razao de ela existir e' a mesma de
todos os outros: uma regra que nunca disparou nao esta' a provar nada.
A regra dos TABs foi escrita depois de a corrupcao acontecer uma vez, e
nunca foi vista disparar -- o que e' exactamente o estado em que uma
regra e' decoracao.
"""
import io
import os
import shutil
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALVO = os.path.join(RAIZ, 'AGENTS.md')
TESTE = 'tests/verificar_texto.py'
ENV = dict(os.environ, PYTHONDONTWRITEBYTECODE='1', PYTHONIOENCODING='utf-8')

# o que se escreve certo, e o que se escreve partido. Um TAB a meio de
# "test_jogos.js", que e' o que um \t dentro de uma string Python faz.
CERTO = 'tests\\test_jogos.js'
PARTIDO = 'tests\test_jogos.js'          # <- TAB de verdade


def correr():
    r = subprocess.run([sys.executable, '-u', TESTE], cwd=RAIZ,
                       capture_output=True, text=True, encoding='utf-8',
                       errors='replace', env=ENV)
    return r.returncode, (r.stdout or '') + (r.stderr or '')


def main():
    original = io.open(ALVO, encoding='utf-8', newline='').read()
    backup = io.open(ALVO, encoding='utf-8', newline='').read()
    problemas = []

    rc, saida = correr()
    if rc != 0:
        print('FALHA: o teste ja falha sem nenhuma alteracao.')
        print(saida)
        return 1
    print('base: o teste passa  OK')
    print()

    try:
        if CERTO not in original:
            problemas.append('a linha certa nao esta no ficheiro: %r' % CERTO)
        else:
            io.open(ALVO, 'w', encoding='utf-8', newline='').write(
                original.replace(CERTO, PARTIDO, 1))
            rc, saida = correr()
            apanhou = rc != 0 and 'TAB DENTRO' in saida
            print('  %s  a corrupcao de um TAB dentro de um caminho'
                  % ('OK   ' if apanhou else 'FALHOU'))
            if not apanhou:
                problemas.append('o teste NAO reparou no TAB dentro da palavra')
    finally:
        io.open(ALVO, 'w', encoding='utf-8', newline='').write(backup)

    # e o ficheiro tem de ter ficado como estava
    if io.open(ALVO, encoding='utf-8', newline='').read() != original:
        problemas.append('o AGENTS.md ficou alterado!')
        print('  !!  o AGENTS.md ficou alterado')

    rc, _ = correr()
    if rc != 0:
        problemas.append('depois de restaurar, o teste ainda falha')
        print('  !!  ainda falha com o ficheiro limpo')

    print()
    if problemas:
        print('!!! %d PROBLEMA(S) !!!' % len(problemas))
        for p in problemas:
            print('  - %s' % p)
        return 1
    print('OK: a regra do TAB morde, e o ficheiro esta intacto.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
