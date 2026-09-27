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
"""
import io
import sys

ALVO = 'python_app/actelemetry_shm.py'
CERTO = "('turboBoost', c_float),            # fracao 0..1"
ERRADO = "('turboBoost', c_float * 2),        # MUTACAO DE TESTE"

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

io.open(ALVO, 'w', encoding='utf-8', newline='').write(s.replace(CERTO, ERRADO, 1))
print('mutacao posta: turboBoost passou a c_float * 2 -- 4 bytes a mais.')
print('espera-se que o test_contrato acuse: os offsets a partir dai errados,')
print('o tamanho do carro diferente, e a pagina maior do que o leitor espera.')
