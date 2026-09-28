# -*- coding: utf-8 -*-
"""Confirma que o verificar_html.py MORDE.

Um teste que nunca falha nao prova nada, e este nasceu de dois bugs em que
os 33 grupos da suite passaram:

  - o `</div>` da `.boot-box` comido, e o ecra de escolha aninhado dentro
    do ecra de espera -- que media 0x0 e nao se via nada;
  - o ecra de escolha posto a `inert`, que se via e nao se podia clicar.

O segundo e' o mais chato, porque e' invisivel para tudo o que nao clique:
os ids existem, o ecra tem tamanho, e o HTML fecha bem. So' o browser o
denuncia.

PORQUE CADA MUTACAO DIZ O QUE MUDA
----------------------------------
Uma mutacao que nao muda nada passa o teste e nao prova nada -- e ja
aconteceu com o `mutacao_loop.py`, cuja ancora de duas linhas nunca casava
com um ficheiro em CRLF. Por isso o script ABORTA se uma mutacao nao
mexer em nada, em vez de contar como sucesso.
"""
import io
import os
import re
import shutil
import subprocess
import sys
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(RAIZ, 'static', 'index.html')
JS = os.path.join(RAIZ, 'static', 'app.js')
TESTE = os.path.join(RAIZ, 'tests', 'verificar_html.py')
TMP = tempfile.gettempdir()

original = {}
for p in (HTML, JS):
    bruto = io.open(p, encoding='utf-8', newline='').read()
    original[p] = (bruto, '\r\n' if '\r\n' in bruto else '\n')
    shutil.copyfile(p, os.path.join(TMP, os.path.basename(p) + '.mutacao'))

# (ficheiro, o que a mutacao faz, o que a mutatione realmente troca)
MUTACOES = [
    (HTML, 'o `</div>` da .boot-box desaparece -- o bug de ontem',
     lambda s: s.replace('  </div>\n</div>\n', '</div>\n', 1)),
    (HTML, 'o botao do ecra de espera e apagado',
     lambda s: re.sub(r'\n\s*<!-- ESCOLHER O JOGO.*?</button>', '', s, flags=re.S)),
    (HTML, 'o botao sai de dentro do ecra de espera',
     lambda s: s.replace('    <button id="boot-jogo"',
                         '  </div>\n  <button id="boot-jogo"', 1)),
    (JS, 'o ecra de escolha fica inert -- o ecra que se via e nao se clica',
     lambda s: s.replace("$('app').inert = true;\n  $('jogos').inert = false;",
                         "$('jogos').inert = true;", 1)),
]

ENV = dict(os.environ, PYTHONIOENCODING='utf-8', PYTHONDONTWRITEBYTECODE='1')


def correr():
    return subprocess.run([sys.executable, '-u', TESTE], capture_output=True,
                          text=True, encoding='utf-8', errors='replace', env=ENV)


def restaurar():
    # `copyfile` e' nao `move`: o `move` consome a copia, e a segunda
    # restauracao -- que e' a do `finally` -- nao a encontra. Um ficheiro
    # de teste que rebenta ao RESTAURAR deixa o codigo partido no disco,
    # que e' pior do que um teste que passa.
    for p in (HTML, JS):
        shutil.copyfile(os.path.join(TMP, os.path.basename(p) + '.mutacao'), p)


try:
    for alvo, nome, mudar in MUTACOES:
        # RESTAURA ANTES DE CADA MUTACAO, e nao so' no fim.
        #
        # Sem isto as mutacoes ACUMULAM: a terceira parte o HTML, a
        # quarta corre com o HTML ainda partido, e falha -- mas pela razao
        # errada. A quarta acusou "nenhuma etiqueta fecha fora de sitio"
        # quando o que devia ter accusations era o `inert`. Um teste que
        # falha pelo motivo errado nao prova nada, e e' pior do que um que
        # falha pelo certo: da' a sensacao de que a regra pega quando
        # quem a escreveu nao sabe o que ela apanha.
        restaurar()

        bruto, NL = original[alvo]
        # As mutacoes sao escritas com LF. O ficheiro esta' em CRLF, e um
        # alvo com `\n` nao casa NUNCA -- a mesma armadilha do
        # `mutacao_loop.py`, que durante meses nao mutou nada e nao disse
        # nada. Muta-se o texto normalizado e grava-se no formato.
        base = bruto.replace('\r\n', '\n')
        mudou = mudar(base)
        if mudou == base:
            print('  A MUTACAO NAO FEZ NADA: %s' % nome)
            sys.exit('  uma mutacao que nao muda nada nao prova nada')
        io.open(alvo, 'w', encoding='utf-8', newline='').write(
            mudou.replace('\n', NL))

        r = correr()
        apanhou = r.returncode != 0
        print('  %s  %s' % ('OK   ' if apanhou else 'FALHOU', nome))
        if not apanhou:
            sys.exit('  o teste passou com o bug la dentro -- nao serve')
        # A RAZAO TEM DE SER A CERTA. Um `FALHA` que nao mencione o que a
        # mutacao mexeu significa que o teste falhou por outra coisa, e
        # entao nao esta' a provar o que diz provar.
        linha = next((l.strip() for l in r.stdout.split('\n') if 'FALHA' in l), '')
        print('         acusa: %s' % linha[:86])
finally:
    restaurar()

r = correr()
print('')
print('  restaurado, o teste volta a: %s' % ('ok' if r.returncode == 0 else 'FALHA'))
print('  %d mutacoes, todas detectadas, e os ficheiros estao intactos.'
      % len(MUTACOES))
sys.exit(0 if r.returncode == 0 else 1)
