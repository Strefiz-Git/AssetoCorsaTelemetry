# -*- coding: utf-8 -*-
"""Confirma que o verificar_html.py MORDE.

Um teste que nunca falha nao prova nada, e este nasceu de um bug em que os
31 grupos da suite passaram com o ecra de escolha aninhado dentro do ecra
de espera. Se ele tambem passar com o HTML partido, nao serve para nada.
"""
import io
import os
import re
import shutil
import subprocess
import sys
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
H = os.path.join(RAIZ, 'static', 'index.html')
TESTE = os.path.join(RAIZ, 'tests', 'verificar_html.py')

original_bruto = io.open(H, encoding='utf-8', newline='').read()
# As mutacoes sao escritas com LF e o ficheiro esta' em CRLF, e um alvo
# com `\n` nao casa NUNCA -- que e' o mesmo buraco do `mutacao_loop.py`.
# A mutacao e' feita sobre o texto normalizado e gravada no formato do
# ficheiro.
NL = '\r\n' if '\r\n' in original_bruto else '\n'
original = original_bruto.replace('\r\n', '\n')
# A copia vai para a pasta temporaria e nao ao lado do ficheiro: um
# sufixo ao lado de "Documents/GitHub/AssetoCorsaTelemetry/static" da
# `ValueError: stat: path too long for Windows`, que e' um erro de
# caminho e nao do teste -- e que aborta antes de fazer o que quer que fosse.
copia = os.path.join(tempfile.gettempdir(), 'actelemetry_index.html.bak')
shutil.copyfile(H, copia)

MUTACOES = [
    ('o `</div>` da .boot-box desaparece -- o bug de ontem',
     lambda s: s.replace('  </div>\n</div>\n', '</div>\n', 1)),
    ('o botao do ecra de espera e apagado',
     lambda s: re.sub(r'\n\s*<!-- ESCOLHER O JOGO.*?</button>', '', s,
                      flags=re.S)),
    ('o botao sai de dentro do ecra de espera',
     lambda s: s.replace('    <button id="boot-jogo"',
                         '  </div>\n  <button id="boot-jogo"', 1)),
]

try:
    for nome, mudar in MUTACOES:
        mudou = mudar(original)
        if mudou == original:
            print('  A MUTACAO NAO FEZ NADA: %s' % nome)
            sys.exit('  uma mutacao que nao muda nada nao prova nada')
        io.open(H, 'w', encoding='utf-8', newline='').write(
            mudou.replace('\n', NL))

        r = subprocess.run([sys.executable, '-u', TESTE], capture_output=True,
                           text=True, encoding='utf-8', errors='replace',
                           env=dict(os.environ, PYTHONIOENCODING='utf-8'))
        apanhou = r.returncode != 0
        print('  %s  %s' % ('OK  ' if apanhou else 'FALHOU', nome))
        if apanhou:
            linha = next((l.strip() for l in r.stdout.split('\n')
                          if 'FALHA' in l), '')
            print('        acusa: %s' % linha[:88])
        else:
            sys.exit('  o teste passou com o HTML partido -- nao serve')
finally:
    shutil.move(copia, H)

r = subprocess.run([sys.executable, '-u', TESTE], capture_output=True, text=True,
                   encoding='utf-8', errors='replace',
                   env=dict(os.environ, PYTHONIOENCODING='utf-8'))
print('')
print('  restaurado, o teste volta a: %s' % ('ok' if r.returncode == 0 else 'FALHA'))
print('  %d mutacoes, todas detectadas, e o HTML esta' % len(MUTACOES)
      + ' intacto.')
sys.exit(0 if r.returncode == 0 else 1)
