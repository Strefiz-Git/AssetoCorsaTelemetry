# -*- coding: utf-8 -*-
r"""Prova de que o `test_contrato` morde (Regra nº 12).

Um teste que nunca falha nao prova nada. Este muda um campo SO do lado da
app -- o `turboBoost` passa de `c_float` para `c_float * 2`, o que empurra
4 bytes -- e o `test_contrato` tem de o apanhar.

    python tests\mutacao_contrato.py

Corre tudo sozinho: aplica a mutacao, corre o teste, desfaz, e confirma
que o ficheiro em disco ficou como estava.

O QUE MUDOU, E PORQUE

A versao anterior era de DUAS FASES, e a segunda era um comando a mao:

    python tests\mutacao_contrato.py            # mete a mutacao
    python tests\test_contrato.py               # tem de falhar
    python tests\mutacao_contrato.py restaurar  # desfaz    <-- esquecia-se

Correr a primeira linha e esquecer a ultima deixava o
`actelemetry_shm.py` COM `turboBoost` a `c_float * 2` no disco. Nao dava
erro nenhum no momento: o script tinha feito o que pedia. O que acontecia
era o `run_all.py` seguinte falhar em tres grupos -- "a app e o leitor
falam igual", "o loop da app nao engole falhas", "o loop da app morde
mesmo" -- por uma razao que nao tinha nada a ver com nada que se tivesse
mudado. A unica pista era um `git status`, e so' de longe.

Nao e' hipotetico: foi o que aconteceu a meio da revisao, com estes
dois ficheiros o `mutacao_contrato.py` e o `mutacao_acessibilidade.py`.
O `mutacao_loop.py` ja fazia bem -- le o original uma vez, restaura num
`finally`, e no fim confirma que o disco ficou igual. Este passa a fazer o
mesmo, e por isso passa a poder entrar na suite como os outros.

`--deixar` continua a existir para quem quiser o modo antigo a duas fases,
mas avisa que o ficheiro fica partido.

O QUE ESTE SCRIPT JA APANHOU, por escrever o caminho e o texto a mao

  - a pasta da app passou a chamar-se `actelemetry_strefiz` e o caminho
    escrito aqui deixou de existir;
  - o comentario `# fracao 0..1` mudou de linha quando os campos foram
    reescritos, e o texto a procurar ja nao casava -- o script falhava
    por dois motivos ao mesmo tempo, e um deles escondia o outro.

Daqui a regra: o caminho descobre-se, e o texto a mutar verifica-se antes
de escrever seja o que for. Por isso o alvo vem de um `glob`, e a
ocorrencia tem de ser UNICA.
"""
import glob
import io
import os
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTE = os.path.join('tests', 'test_contrato.py')
ENV = dict(os.environ, PYTHONIOENCODING='utf-8', PYTHONDONTWRITEBYTECODE='1')

# --- o alvo descobre-se, nao se escreve ------------------------
ACHADOS = glob.glob(os.path.join(RAIZ, 'python_app', '*', 'actelemetry_shm.py'))
if not ACHADOS:
    print('ERRO: nao encontrei actelemetry_shm.py dentro de python_app/.')
    sys.exit(2)
ALVO = ACHADOS[0]
ALVO_REL = os.path.relpath(ALVO, RAIZ).replace(os.sep, '/')
DEIXAR = '--deixar' in sys.argv

CERTO = "('turboBoost', c_float),"
ERRADO = "('turboBoost', c_float * 2),   # MUTACAO DE TESTE"


def correr():
    r = subprocess.run([sys.executable, '-u', TESTE], cwd=RAIZ,
                       capture_output=True, text=True, encoding='utf-8',
                       errors='replace', env=ENV)
    return r.returncode, (r.stdout or '') + (r.stderr or '')


def escrever(texto):
    io.open(ALVO, 'w', encoding='utf-8', newline='').write(texto)


def falha(msg, codigo=1):
    print('  FALHA: %s' % msg)
    sys.exit(codigo)


print('alvo   : %s' % ALVO_REL)
print('teste  : %s' % TESTE)
print('mutacao: turboBoost passa a c_float * 2 -- 4 bytes a mais')
print()

original = io.open(ALVO, encoding='utf-8', newline='').read()

# --- o ficheiro ja vem mutado de uma corrida anterior? -------
if ERRADO in original:
    if not DEIXAR:
        print('  O ficheiro JÁ VINHA MUTADO de uma corrida anterior.')
        print('  Vou restaurar antes de comecar, para partir de uma base limpa.')
        escrever(original.replace(ERRADO, CERTO, 1))
        original = io.open(ALVO, encoding='utf-8', newline='').read()
        if ERRADO in original:
            falha('nao consegui restaurar; o ficheiro continua com a mutacao. '
                  'Restaura com git.')
        print('  restaurado.')
        print()

# --- as guardas antes de mexer em seja o que for --------------
if CERTO not in original:
    falha('nao encontrei a linha para mutar. O ficheiro mudou:\n'
          '        %r' % CERTO)
if original.count(CERTO) != 1:
    falha('a linha aparece %d vezes. Mutar uma delas deixaria as outras '
          'como estavam, e o teste nao apanhava nada.' % original.count(CERTO))

# --- a base tem de passar, senao a mutacao nao prova nada -----
rc, saida = correr()
if rc != 0:
    print(saida)
    falha('o teste ja falha SEM nenhuma alteracao. Uma mutacao nao prova nada '
          'quando o teste ja esta' + chr(39) + ' roto.')
print('  ok   a base passa')
print()

# --- mutar, testar, restaurar, SEMPRE -------------------------
if DEIXAR:
    escrever(original.replace(CERTO, ERRADO, 1))
    print('  MUTACAO POSTA e deixada no ficheiro, como pediste (--deixar).')
    print('  O %s vai falhar. Quando acabares:' % ALVO_REL)
    print('      python tests\\mutacao_contrato.py restaurar')
    print('  ou, se preferires, restaura com:')
    print('      git checkout -- %s' % ALVO_REL)
    sys.exit(0)

problemas = []
escrever(original.replace(CERTO, ERRADO, 1))
try:
    rc, saida = correr()
finally:
    escrever(original)
apanhou = rc != 0
print('  %s  o test_contrato reparou a mutacao' % ('ok  ' if apanhou else 'FALHOU'))
if not apanhou:
    problemas.append('o teste NAO reparou a mutacao -- o contrato nao esta a '
                     'ser verificado de todo')

# --- o disco tem de ter ficado como estava -------------------
if io.open(ALVO, encoding='utf-8', newline='').read() != original:
    problemas.append('o plugin ficou alterado!')
    print('  !!  o plugin ficou alterado')

rc, _ = correr()
if rc != 0:
    problemas.append('depois de restaurar, o teste ainda falha')
    print('  !!  depois de restaurar, o teste ainda falha')

print()
if problemas:
    for p in problemas:
        print('  FALHA: %s' % p)
    sys.exit(1)
print('  ok   o disco ficou como estava, e o teste voltou a passar')
print('  ok   o contrato e' + chr(39) + ' mesmo verificado')
