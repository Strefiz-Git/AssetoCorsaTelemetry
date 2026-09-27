# -*- coding: utf-8 -*-
"""A suite passa a COMPILAR a app, e nao so' a comparar as structs.

O QUE FALHOU

Escrevi um apostrofo a mais numa string do log da app -- "O que vier
acima e' a do HUD" -- e a suite passou a 16/16.

Como? Porque `test_contrato.py` compara as duas STRUCTS, campo a campo, e
a string estava no `actelemetry_strefiz.py`, que ninguem compila. O
`run_all.py` nao corre `py_compile` sobre a app. Um erro de sintaxe na
app nao falha nada: so' rebenta dentro do jogo, no arranque, e o painel
fica a mostrar "liga a app no Content Manager" -- que e' a instrucao
errada para um erro de sintaxe.

Isto e' a Regra nº 4 noutro sitio: um teste que valida a estrutura
contra si proprio nao prova que o codigo que a usa existe.

O QUE MUDA

Um teste que compila TODOS os `.py` do projecto, e nao so' os que a
suite ja usava. Compilar nao executar: nao escreve em pagina nenhuma, nao
abre o jogo, e nao precisa dele. E apanha o que apanhou -- sintaxe --
mais o que o byte-compile apanha e a leitura nao apanha: um `import` de
um nome inexistente so' falha quando o modulo corre, e nao na
compilacao. Esse fica de fora, e vale a pena dizer porquê em vez de
deixar parecer que o teste cobre mais do que cobre.

O `py_compile` escreve um `.pyc` ao lado do fonte, por isso o teste
compila para a memoria e nao toca no disco -- e apaga o `__pycache__` no
fim, para nao deixar lixo. O `PYTHONDONTWRITEBYTECODE` nao chega, porque
o `py_compile` escreve na mesma.
"""
import glob
import io
import os
import py_compile
import shutil
import sys
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOME = 'a app compila'

# o que fica de fora, e porque
EXCLUIDOS = {
    'ac_info': 'material de terceiro, fora do projecto',
    '.git': 'o git',
    '__pycache__': 'cache',
}

ficheiros = []
for pasta, subpastas, ficheiros_em_pasta in os.walk(RAIZ):
    rel = os.path.relpath(pasta, RAIZ)
    partes = rel.split(os.sep)
    if partes and partes[0] in EXCLUIDOS:
        subpastas[:] = []
        continue
    subpastas[:] = [s for s in subpastas if s not in EXCLUIDOS]
    for f in ficheiros_em_pasta:
        if f.endswith('.py'):
            ficheiros.append(os.path.join(pasta, f))

if len(ficheiros) < 5:
    print('  so' + ' Enforcement: encontrei %d ficheiros; a busca esta errada.'
          % len(ficheiros))
    sys.exit(1)

print('  %d ficheiros .py a compilar' % len(ficheiros))

# compila-se para uma pasta temporaria: o `py_compile` escreveria um
# `.pyc` ao lado de cada fonte, e nao se quer isso num teste
tmp = tempfile.mkdtemp(prefix='compilar_')
ruins = []
for caminho in ficheiros:
    rel = os.path.relpath(caminho, RAIZ)
    destino = os.path.join(tmp, rel)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    try:
        py_compile.compile(caminho, cfile=destino + 'c', doraise=True)
    except py_compile.PyCompileError as e:
        ruins.append('  %s\n      %s' % (rel, str(e).strip().splitlines()[-1]))
    except Exception as e:
        ruins.append('  %s\n      %s: %s' % (rel, type(e).__name__, e))

shutil.rmtree(tmp, ignore_errors=True)
# o py_compile pode ter criado __pycache__ apesar do destino, num cenario
# em que o fonte e' lido de outra forma
for pasta, subpastas, _ in os.walk(RAIZ):
    if os.path.basename(pasta) == '__pycache__':
        shutil.rmtree(pasta, ignore_errors=True)
        subpastas[:] = []

if ruins:
    print('')
    print('!!! %d ficheiro(s) NAO COMPILAM !!!' % len(ruins))
    print('\n'.join(ruins))
    print('')
    print('  Um erro de sintaxe aqui nao falha mais nada: a suite compara as')
    print('  STRUCTS, e nao compila o codigo que as usa. O sintoma em jogo e')
    print('  o painel dizer "liga a app no Content Manager", que e' + chr(39) + ' a')
    print('  instrucao errada para um erro de sintaxe.')
    sys.exit(1)

print('  ok: %d ficheiros compilam' % len(ficheiros))
print('')
print('  NOTA: compilar NAO e' + chr(39) + ' executar. Um `import` de um nome que nao existe')
print('  so' + ' falha quando o modulo corre, e nao na compilacao. Este teste nao')
print('  apanha isso -- e o unico teste dentro do jogo que apanha, que e' + chr(39) + ' o')
print('  `test_loop_app.py`, com um `ac` falso.')
