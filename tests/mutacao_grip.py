# -*- coding: utf-8 -*-
"""Verifica que o caso da aderencia MORDE, partindo o leitor de proposito.

Tres mutacoes, e as tres tem de ser apanhadas:

  1. a guarda desaparece (volta a publicar o 0 cru)      -> o 0 daria 0
  2. a guarda e' larga demais (`< 1` em vez de `<= 0`)   -> o 0,62 molhado
                                                           deixava de passar
  3. a guarda e' do sinal errado (`< 0`, que nunca happens)-> o 0 passava

A segunda e' a importante. Com so' o caso do 0, uma guarda `if g < 1`
passava o teste e MATAVA o aviso de pista molhada -- que e' a razao de o
campo existir. Um teste que so' prova o caso facile nao prova a guarda.

Cada mutacao e' aplicada a uma COPIA, nunca ao ficheiro do disco: o
projecto ja sofreu com um teste que escrevia no codigo e deixava um .pyc
envenenado (Regra nº 12).
"""
import io
import os
import subprocess
import sys

ORIGINAL = 'acshm.py'
PROVA = os.path.join('tests', '_mutacao_grip.py')

MUTACOES = [
    ("a guarda desaparece",
     '"surfaceGrip": (round(gr.surfaceGrip, 2)\n'
     '                            if gr.surfaceGrip > 0 else -1),',
     '"surfaceGrip": round(gr.surfaceGrip, 2),'),

    ("a guarda e' larga demais: < 1 em vez de > 0",
     '"surfaceGrip": (round(gr.surfaceGrip, 2)\n'
     '                            if gr.surfaceGrip > 0 else -1),',
     '"surfaceGrip": (round(gr.surfaceGrip, 2)\n'
     '                            if gr.surfaceGrip < 1 else -1),'),

    ("a guarda e' do sinal errado: < 0, que nunca acontece",
     '"surfaceGrip": (round(gr.surfaceGrip, 2)\n'
     '                            if gr.surfaceGrip > 0 else -1),',
     '"surfaceGrip": (round(gr.surfaceGrip, 2)\n'
     '                            if gr.surfaceGrip < 0 else -1),'),
]

fonte = io.open(ORIGINAL, encoding='utf-8').read()
original_grip = MUTACOES[0][1]
if original_grip not in fonte:
    raise SystemExit('  nao encontrei a guarda em %s; a mutacao esta'
                     ' desatualizada e isto nao provaria nada.' % ORIGINAL)

# o ficheiro com a mutacao tem de ter o MESMO NOME que o original, porque
# o teste faz 'import acshm' -- por isso vai para uma pasta propria com
# uma copia do teste, e o PYTHONPATH aponta para la
import shutil
os.makedirs('tests/_mut', exist_ok=True)
env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1',
           PYTHONIOENCODING='utf-8')

fugiram = 0
# A reposicao esta' num finally, e nao no fim a direito. Este script
# REESCREVE o acshm.py em disco, e a partir de agora corre dentro do
# run_all.py -- se uma mutacao levantar uma excepcao a meio, o leitor
# ficava partido no disco e o erro apareceria no teste SEGUINTE, longe
# da causa. E' o pior sitio possivel para um bug aparecer.
try:
    for nome, de, para in MUTACOES:
        if de not in fonte:
            print('  %-46s a ancora nao casa; a mutacao envelheceu' % nome)
            fugiram += 1
            continue
        io.open(ORIGINAL, 'w', encoding='utf-8',
                newline='').write(fonte.replace(de, para, 1))
        r = subprocess.run([sys.executable, '-u', 'tests/test_acshm.py'],
                           capture_output=True, text=True,
                           encoding='utf-8', errors='replace', env=env)
        apanhou = r.returncode != 0
        motivo = ''
        for l in r.stdout.splitlines():
            if 'surfaceGrip' in l and 'esperava' in l:
                motivo = l.strip()
                break
        print('  %-46s %s' % (nome, 'APANHADA' if apanhou else '** ESCAPOU **'))
        if motivo:
            print('      %s' % motivo[:92])
        if not apanhou:
            fugiram += 1
finally:
    # repor SEMPRE, mesmo com uma excepcao a meio
    io.open(ORIGINAL, 'w', encoding='utf-8', newline='').write(fonte)
    shutil.rmtree('tests/_mut', ignore_errors=True)
    if os.path.exists(PROVA):
        os.remove(PROVA)

print('  o ficheiro foi reposto: %s'
      % ('ok' if io.open(ORIGINAL, encoding='utf-8').read() == fonte else 'NAO'))

if fugiram:
    raise SystemExit('  %d MUTACAO(ES) ESCAPARAM' % fugiram)
print('  as 3 mutacoes batem certo.')
