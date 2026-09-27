# -*- coding: utf-8 -*-
"""Prova de que a regra das animacoes da auditoria morde. (Regra nº 12)

Um teste que nunca falha nao prova nada. Este acrescenta ao `style.css` uma
animacao INFINITA nova, sem alternativa em `prefers-reduced-motion`, e a
`auditar_frontend.py` tem de a acusar.

    python tests\\mutacao_acessibilidade.py

Corre tudo sozinho: mete a mutacao, corre a auditoria, desfaz, e confirma
que o ficheiro em disco ficou como estava.

O QUE MUDOU, E PORQUE

A versao anterior era de DUAS FASES, com a segunda a cargo de alguem:

    python tests\\mutacao_acessibilidade.py            # mete a mutacao
    # ... correr o check_acessibilidade.js no browser, tem de acusar
    python tests\\mutacao_acessibilidade.py restaurar   # desfaz

Esquecer a ultima deixava no `static/style.css`:

    /* MUTACAO DE TESTE -- tem de ser apagada */
    .mut-test{animation:mut-flash 1.4s ease-in-out infinite}

E isso e' pior do que uma animacao a mais: e' um comentario que diz
"tem de ser apagada" no ficheiro que produz o ecra. Aconteceu a meio da
revisao, com este e o `mutacao_contrato.py`, e o `run_all.py` seguinte
falhou em tres grupos por uma razao sem relacao com nada que tivesse
sido mexido. A unica pista era um `git status`.

O que torna isto possivel e' que o teste de mordida precisava do BROWSER:
o `check_acessibilidade.js` corre colado na consola da pagina viva. Um
teste que so se pode correr interactivamente e' um teste que ninguem
corre, e portanto a regra 2.3.3 nao era verificada em lado nenhum.

Agora e' verificada em forma estatica pela `auditar_frontend.py`, que
corre sem browser e ja estava na suite. E' por isso que este script
deixa de precisar de duas fases.

`--deixar` mantem o modo antigo, avisando que o ficheiro fica partido.
"""
import io
import os
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALVO = os.path.join(RAIZ, 'static', 'style.css')
ALVO_REL = 'static/style.css'
TESTE = os.path.join('tests', 'auditar_frontend.py')
ENV = dict(os.environ, PYTHONIOENCODING='utf-8', PYTHONDONTWRITEBYTECODE='1')

MARCADOR = '/* MUTACAO DE TESTE -- tem de ser apagada */'
MUTACAO = (
    '\n' + MARCADOR + '\n'
    '.mut-test{animation:mut-flash 1.4s ease-in-out infinite}\n'
    '@keyframes mut-flash{0%,100%{opacity:.3}50%{opacity:1}}\n'
)
DEIXAR = '--deixar' in sys.argv


def correr():
    r = subprocess.run([sys.executable, '-u', TESTE], cwd=RAIZ,
                       capture_output=True, text=True, encoding='utf-8',
                       errors='replace', env=ENV)
    return r.returncode, (r.stdout or '') + (r.stderr or '')


def escrever(t):
    io.open(ALVO, 'w', encoding='utf-8', newline='').write(t)


def falha(msg, codigo=1):
    print('  FALHA: %s' % msg)
    sys.exit(codigo)


print('alvo   : %s' % ALVO_REL)
print('teste  : %s' % TESTE)
print('mutacao: .mut-test anima em infinite, sem bloco no-preference')
print()

original = io.open(ALVO, encoding='utf-8', newline='').read()

# --- o ficheiro ja vem mutado de uma corrida anterior? -------
if MARCADOR in original:
    if not DEIXAR:
        print('  O ficheiro JA VINHA MUTADO de uma corrida anterior.')
        print('  Vou restaurar antes de comecar, para partir de uma base limpa.')
        escrever(original.replace(MUTACAO, ''))
        original = io.open(ALVO, encoding='utf-8', newline='').read()
        if MARCADOR in original:
            falha('nao consegui remover a marcacao; restaura com git.')
        print('  removida.')
        print()

# --- a base tem de passar, senao a mutacao nao prova nada -----
rc, saida = correr()
if rc != 0:
    print(saida)
    falha('a auditoria ja falha SEM a mutacao. Uma mutacao nao prova nada '
          'quando o teste ja esta' + chr(39) + ' roto.')
print('  ok   a base passa')
print()

if DEIXAR:
    escrever(original + MUTACAO)
    print('  MUTACAO POSTA e deixada no ficheiro, como pediste (--deixar).')
    print('  A %s vai acusar. Quando acabares:' % TESTE)
    print('      git checkout -- %s' % ALVO_REL)
    sys.exit(0)

problemas = []
escrever(original + MUTACAO)
try:
    rc, saida = correr()
finally:
    escrever(original)
apanhou = rc != 0 and 'mut-flash' in saida
print('  %s  a auditoria reparou a animacao infinita'
      % ('ok  ' if apanhou else 'FALHOU'))
if not apanhou:
    problemas.append('a auditoria NAO reparou -- a regra 2.3.3 nao esta a ser '
                     'verificada em suite, so' + chr(39) + ' no browser')

# --- o disco tem de ter ficado como estava -------------------
depois = io.open(ALVO, encoding='utf-8', newline='').read()
if depois != original:
    problemas.append('o style.css ficou alterado!')
    print('  !!  o style.css ficou alterado')
elif MARCADOR in depois:
    problemas.append('a marcacao da mutacao ficou no ficheiro!')
    print('  !!  a marcacao ficou no ficheiro')

rc, _ = correr()
if rc != 0:
    problemas.append('depois de restaurar, a auditoria ainda falha')
    print('  !!  depois de restaurar, a auditoria ainda falha')

print()
if problemas:
    for p in problemas:
        print('  FALHA: %s' % p)
    sys.exit(1)
print('  ok   o style.css ficou como estava, e a auditoria voltou a passar')
print('  ok   a regra 2.3.3 e' + chr(39) + ' mesmo verificada em suite')
