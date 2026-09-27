# -*- coding: utf-8 -*-
"""A suite passa a VERIFICAR A SINTAXE do JavaScript.

O QUE FALHOU

Acrescentei tres palavras de traducao aos quatro blocos de idioma do
`app.js` e o ficheiro deixou de correr:

    "wx.furacao": "FURACAO""wx.ventoso": "VENTOSO", ..., "TORNADO", ,
                  "wx.topoDoCartao": ...

Faltava uma virgula a seguir ao valor de `furacao` -- porque a chave
nova foi inserida entre o valor e a virgula que ja' la estava -- e
ficava uma virgula a mais no fim do bloco. `SyntaxError`.

A `auditar_frontend.py` falhou, mas **por acidente**: ela avalia o
bloco de traducoes com o `eval` do Python, e o Python tambem nao
parseia aquilo, portanto deu "invalid syntax" sem nunca apontar para a
linha. Se a corrupcao tivesse sido mojibake dentro de uma string -- que e'
o que o PowerShell faz -- o `eval` passava e a auditoria dizia "ok".

E o `node --check` nao estava em lado nenhum. O `compilar.py`, que
escrevi ha' pouco, so cobre Python. Nenhuma alteracao de JavaScript
neste projecto tinha uma verificacao de sintaxe, e o ficheiro que
desenha o ecra inteiro e' JavaScript.

O QUE ESTE TESTE FAZ

`node --check` em todos os `.js` do projecto, menos o `ac_info` que e'
de terceiro. O `--check` so faz parse: nao executa, nao abre o browser
e nao precisa dele.

O QUE ELE NAO APANHA

Um `SyntaxError` e' o unico erro de JavaScript que se apanha sem correr
o ficheiro. Um `TypeError` -- chamar uma funcao com o numero de
argumentos errado, que e' a regra nº 14 deste projecto -- passa. O
`test_tempos.html` e o browser apanham esses, e so eles.

E' o mesmo limite do `compilar.py` em Python, e vale a pena dizer em
voz alta em vez de deixar parecer que a suite cobre mais do que cobre.
"""
import glob
import os
import shutil
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXCLUIDOS = ('ac_info', '.git', 'node_modules', '__pycache__')

ficheiros = []
for pasta, subpastas, nomes in os.walk(RAIZ):
    partes = os.path.relpath(pasta, RAIZ).split(os.sep)
    if partes and partes[0] in EXCLUIDOS:
        subpastas[:] = []
        continue
    subpastas[:] = [s for s in subpastas if s not in EXCLUIDOS]
    for n in nomes:
        if n.endswith('.js'):
            ficheiros.append(os.path.join(pasta, n))

rel = sorted(os.path.relpath(f, RAIZ) for f in ficheiros)
if len(rel) < 3:
    sys.exit('  encontrei %d ficheiros .py; a busca esta errada.' % len(rel))

node = shutil.which('node')
if node is None:
    print('  node nao esta instalado: saltado, como o test_tempos.js.')
    print('  NOTA: entao nenhuma alteracao de JavaScript e verificada')
    print('  quanto a sintaxe enquanto o node nao estiver instalado.')
    sys.exit(0)

print('  %d ficheiros .js a verificar com node --check' % len(rel))
ruins = []
for r in rel:
    p = subprocess.run([node, '--check', os.path.join(RAIZ, r)],
                       capture_output=True, text=True)
    if p.returncode != 0:
        # a primeira linha do erro do node tem a linha e o ponto
        linhas = [l for l in p.stderr.splitlines() if l.strip()]
        onde = linhas[0] if linhas else '(sem mensagem)'
        ruins.append('  %s\n      %s' % (r, onde.strip()[:90]))

if ruins:
    print('')
    print('!!! %d ficheiro(s) NAO CORREM !!!' % len(ruins))
    print('\n'.join(ruins))
    print('')
    print('  Um SyntaxError aqui NAO falha nada se a auditoria nao avaliar o')
    print('  bloco: o `eval` do Python tambem nao parseia JavaScript, e da')
    print('  "invalid syntax" sem apontar para a linha. Se a corrupcao for')
    print('  mojibake dentro de uma string, o `eval` passa e a auditoria diz')
    print('  que esta tudo bem.')
    sys.exit(1)

print('  ok: %d ficheiros fazem parse' % len(rel))
print('')
print('  NOTA: parse NAO e' + chr(39) + ' execucao. Um `TypeError` -- chamar uma funcao')
print('  com o numero de argumentos errado, que ja aconteceu neste projecto --')
print('  passa. Para isso so ha o browser.')
