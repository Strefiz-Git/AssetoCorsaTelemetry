# -*- coding: utf-8 -*-
"""Testa o `medir_tyrewear.py` com paginas falsas, sem o jogo.

PORQUEE ESTE TESTE EXISTE

O script so' corre com o Assetto Corsa a andar. Eso e' exactamente o
que torna um script perigoso: nao ha' maneira de o correr sem estar a
conduzir, portanto nunca se descobre que o loop tem um erro ate estar-se
a meio de uma volta -- que e' quando ninguem esta' com pressa.

Aconteceu: a primeira versao leu `ph.lapCount`, que nao existe na struct
da fisica. Deu AttributeError no primeiro segundo, mas dentro de um
`try` largo que apanhou a gralha como se fosse a partida ter fechado, e
o resumo continuou em frente com valores que nunca foram assignados. O
erro que o utilizador viu foi um `NameError` sobre `nucleo`, que nao tem
nada a ver com a causa.

O `CS` da struct da fisica nao tem contador de voltas nenhum: quem conta
as voltas do jogador e' o `completedLaps` da pagina de graficos. O
`lapCount` existe, mas no registo de cada CARRO, que e' outra pagina e
outra interface, e da' o numero de outro carro.

COMO

As paginas falsas sao `ctypes.Structure` a serio, com os campos que o
script realmente le -- porque o script chama `ctypes.sizeof()` nelas, e
isso exige uma estrutura de verdade. E' o mesmo padrao do
`test_acshm.py`: escrever num buffer, e o script le-lo como se fosse o
jogo.

O `sys.modules['acshm']` e' semeado antes de o script importar, e um
`import` de um modulo que ja esta' la devolve o que esta' la. E' por isso
que o `sys.path.insert` do script nao atrapalha.

A taxa e' CONHECIDA -- 2,0% por volta -- de modo que o teste compara o
que o script mediu com o que se simulou. Nao e' "o script correu": e' "o
script mediu a taxa certa".
"""
import contextlib
import ctypes
import io
import os
import re
import runpy
import sys
import time
import types
from ctypes import c_float, c_int32

TXA = 2.0                 # % por volta que a pagina falsa desce
VOLTAS_A_MEDIR = 3
LEITURAS_POR_VOLTA = 4    # o script le de 0,5 em 0,5 s

# O script agora aceita o numero de voltas na linha de comando, e e' o
# que decide quando para. O `sys.argv` e' mexido AQUI, e nao no script:
# e' o comando do utilizador, e um teste nao o pode mudar. Se o script
# lesse um valor fixo, este teste passaria a medir outra coisa do que a
# que corre.

estado = {'leitura': 0}


def _voltas():
    return estado['leitura'] // LEITURAS_POR_VOLTA


# As paginas falsas: so' os campos que o script le, e na ordem em que
# ele os le -- que e' o que interessa, porque o `ctypes.sizeof` tem de
# devolver um numero.
class _Fisica(ctypes.Structure):
    _pack_ = 4
    _fields_ = [
        ("packetId", c_int32),
        ("speedKmh", c_float),
        ("tyreWear", c_float * 4),
        ("tyreCoreTemperature", c_float * 4),
    ]


class _Graficos(ctypes.Structure):
    _pack_ = 4
    _fields_ = [("completedLaps", c_int32)]


FISICA = _Fisica()
GRAFICOS = _Graficos()


def _avancar():
    """Passa 'meio segundo' de tempo: sobe a leitura e reescreve os
    valores como o jogo faria, com o pneu a gastar a taxa simulada."""
    estado['leitura'] += 1
    v = 98.5 - TXA * _voltas()
    FISICA.packetId = estado['leitura']
    FISICA.speedKmh = 250.0
    for i, extra in enumerate((0.0, 0.1, -0.2, -0.2)):
        FISICA.tyreWear[i] = v + extra
    for i, t in enumerate((123.0, 116.0, 133.0, 133.0)):
        FISICA.tyreCoreTemperature[i] = t
    GRAFICOS.completedLaps = min(_voltas(), VOLTAS_A_MEDIR)


_avancar()


class _K32(object):
    @staticmethod
    def OpenFileMappingW(*a):
        return 1

    @staticmethod
    def MapViewOfFile(*a):
        return 1


# `from_address` tem de devolver a pagina certa. O script mapeia a fisica
# primeiro e a graficos depois, mas em vez de contar a ordem -- que e'
# um detalhe que o teste nao deve depender -- cada classe devolve a sua.
falso = types.ModuleType('acshm')
falso.k32 = _K32()
falso.FILE_MAP_READ = 0x0004


def _com_from_address(cls, instancia):
    cls.from_address = staticmethod(lambda addr: instancia)
    return cls


falso.SPageFilePhysics = _com_from_address(_Fisica, FISICA)
falso.SPageFileGraphic = _com_from_address(_Graficos, GRAFICOS)
sys.modules['acshm'] = falso

# O script dorme meio segundo por volta. No teste esse sono e' o que
# avanca o tempo -- e' o unico sitio onde o teste toca no script, por
# isso o loop que corre e' mesmo o de verdade.
_real_sleep = time.sleep


def dormir(seg):
    _real_sleep(0)
    for _ in range(max(1, int(seg / 0.5))):
        _avancar()


time.sleep = dormir

ALVO = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                    'medir_tyrewear.py')

# O `sys.argv[1]` e' o numero de voltas que o script mede. Aqui sao
# testados tres valores, porque um so' nao apanha o erro que interessa:
# um valor fixo no script faria o teste passar sem se notar que o
# comando do utilizador tinha deixado de funcionar.
for VOLTAS_A_MEDIR in (1, 2, 3):
    estado['leitura'] = 0
    _avancar()
    print('')
    print('  === a pedir %d volta(s) ===' % VOLTAS_A_MEDIR)
    sys.argv = ['medir_tyrewear.py', str(VOLTAS_A_MEDIR)]
    codigo = 0
    # a saida do script e' capturada para a CONTAR. A primeira versao
    # imprimia 'o script respondeu com N descidas' sem as ter contado --
    # a frase afirmava uma coisa que o teste nao media, que e' a pior
    # forma de um teste: parece que verifica, e nao verifica nada.
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            runpy.run_path(ALVO, run_name='__main__')
    except SystemExit as e:
        codigo = e.code if isinstance(e.code, int) else 0
    except Exception as e:
        print('  !!! O SCRIPT DEU ERRO: %s: %s' % (type(e).__name__, e))
        codigo = 1
    if codigo:
        raise SystemExit('  com %d volta(s) o script nao passou (codigo %d)'
                         % (VOLTAS_A_MEDIR, codigo))

    saida = buf.getvalue()
    # A linha da descida e' a que tem QUATRO numeros com sinal. Filtrar
    # por 'desceu' nao chega, porque a frase do resumo -- 'quanto cada
    # roda desceu por volta' -- tem a mesma palavra, e contava como uma
    # descida a mais. Foi o que aconteceu na primeira versao deste
    # teste: pedia uma volta e o script 'mediava' duas.
    LINHA_DESCIDA = re.compile(r'[+-]\d+\.\d\d.*[+-]\d+\.\d\d'
                               r'.*[+-]\d+\.\d\d.*[+-]\d+\.\d\d')
    descidas = [l for l in saida.split('\n')
                if 'desceu' in l and LINHA_DESCIDA.search(l)]
    if len(descidas) != VOLTAS_A_MEDIR:
        raise SystemExit('  pediu %d volta(s) e o script mediu %d. Se mede '
                         'menos, nao conta voltas; se mede mais, conta a '
                         'mesma volta mais do que uma vez.'
                         % (VOLTAS_A_MEDIR, len(descidas)))
    # e cada descida tem de ser a taxa simulada, e nao zero
    for l in descidas:
        numeros = re.findall(r'[+-]\d+\.\d\d', l)
        if len(numeros) != 4:
            raise SystemExit('  a linha da descida nao tem quatro valores: %r' % l)
        for n in numeros:
            if abs(float(n) - (-TXA)) > 0.011:
                raise SystemExit('  a descida mediu %s e a taxa simulada e'
                                 ' %.1f -- o script leu outra coisa.'
                                 % (n, -TXA))
    print('  ok: pediu %d, mediu %d, e cada uma foi de %.2f.'
          % (VOLTAS_A_MEDIR, len(descidas), -TXA))

print('')
print('  os tres valores devolveram o numero certo de descidas, cada uma de')
print('  -%.1f, e o script e' % TXA + ' que para quando se chega a zero.')
print('  Sem o `sys.argv`, um valor fixo no script teria passado este teste')
print('  na mesma -- e o comando do utilizador nao faria nada.')
