# -*- coding: utf-8 -*-
r"""Prova de que o test_contrato morde (Regra no 12).

Um teste que nunca falha nao prova nada. Este muda um campo SO do lado
da app -- o `turboBoost` passa de c_float para c_float * 2, o que
empurra 4 bytes -- e o test_contrato tem de o apanhar.

    python tests\mutacao_contrato.py            # mete a mutacao
    python tests\test_contrato.py               # tem de falhar
    python tests\mutacao_contrato.py restaurar   # desfaz
    python tests\test_contrato.py               # tem de voltar a passar

A primeira versao deste script tinha uma logica de restaurar que dava
dois "substitui" encadeados e nao desfazia nada -- o ficheador ficou
mutado e o teste continuou a falhar. Por isso agora a mutacao e' uma
unica troca de texto, e o "restaurar" e' a troca inversa exata, com uma
verificacao depois. Sem isto, um script que mexe em ficheiros e' um
perigo: o pior caso e' ficar com codigo partido e nao dar por isso.

Duas coisas que este script ja apanhou, ambas por causa de escrever o
caminho e o texto a mao:

  - a pasta da app passou a chamar-se actelemetry_strefiz, e o caminho
    escrito aqui deixou de existir;
  - o comentario "# fracao 0..1" mudou para a linha de cima quando os
    campos foram reescritos, e o texto a procurar ja nao casava --
    portanto o script falhava por dois motivos ao mesmo tempo, e um
    deles escondia o outro.

Daqui a regra: o caminho descobre-se, e o texto a mutar verifica-se
antes de escrever seja o que for.
"""
import glob
import io
import os
import sys

ACHADOS = glob.glob('python_app/*/actelemetry_shm.py') or \
    glob.glob('**/actelemetry_shm.py', recursive=True)
if not ACHADOS:
    print('ERRO: nao encontrei actelemetry_shm.py dentro de python_app/.')
    sys.exit(2)

ALVO = ACHADOS[0]
print('alvo: %s' % ALVO)

# o comentario "# fracao 0..1" foi para a linha de cima, por isso a
# procuras e' so' pelo campo -- e tem de ser UNICA, senao a mutacao ia
# mexer no sitio errado sem dar erro
CERTO = "('turboBoost', c_float),"
ERRADO = "('turboBoost', c_float * 2),   # MUTACAO DE TESTE"

s = io.open(ALVO, encoding='utf-8').read()
ja_mutado = ERRADO in s

if 'restaurar' in sys.argv:
    if not ja_mutado:
        print('nao ha mutacao para desfazer. O ficheiro esta limpo.')
        sys.exit(0)
    io.open(ALVO, 'w', encoding='utf-8', newline='').write(s.replace(ERRADO, CERTO))
    # verificacao: se a linha nao voltou ao sitio, dizer logo
    depois = io.open(ALVO, encoding='utf-8').read()
    if ERRADO in depois:
        print('ERRO: o ficheiro continua mutado depois de restaurar.')
        sys.exit(1)
    print('restaurado e confirmado.')
    sys.exit(0)

if ja_mutado:
    print('a mutacao ja esta posta. Corre o test_contrato, depois "restaurar".')
    sys.exit(0)

if CERTO not in s:
    print('ERRO: nao encontrei a linha para mutar. O ficheiro mudou?')
    sys.exit(1)

if s.count(CERTO) != 1:
    print('ERRO: a linha aparece %d vezes. Mutar uma delas as outras ficariam'
          % s.count(CERTO))
    print('       como estavam, e o teste nao apanhava nada.')
    sys.exit(1)

io.open(ALVO, 'w', encoding='utf-8', newline='').write(s.replace(CERTO, ERRADO, 1))
print('mutacao posta: turboBoost passou a c_float * 2 -- 4 bytes a mais.')
print('espera-se que o test_contrato acuse: os offsets a partir dai errados,')
print('o tamanho do carro diferente, e a pagina maior do que o leitor espera.')
