# -*- coding: utf-8 -*-
r"""
tests\test_contrato.py

A app Python (dentro do jogo) escreve uma struct numa pagina de memoria
partilhada; o acshm.py (de fora) le essa mesma struct. Sao DOIS
ficheiros, em DOIS processos, em DOIS interpretadores -- e nada os liga
a nao ser o nome da pagina e a ordem dos campos.

Se um dos dois mudar sozinho, nao da' erro nenhum. O leitor mapeia a
pagina, le os bytes, e devolve numeros plausiveis a partir do sitio
errado. A unica forma de isso aparecer no ecrã e' um carro com o tempo
todo trocado, o que se descobre a conduzir, nunca num teste.

E' a Regra no 16 -- "duas vistas do mesmo mundo tem de usar a mesma
convencao" -- aplicada a um contrato binario em vez de a um eixo. E a
mesma razao que fez a falha do toolchain de canal: duas coordenadas
escritas em dois sitios divergem sem ninguem dar por isso.

Este teste compara as DUAS structs campo a campo e offset a offset:

  - o mesmo numero de campos
  - os mesmos nomes, pela mesma ordem
  - os mesmos tipos
  - os mesmos offsets em bytes, e o mesmo tamanho total

E so' este teste que apanha o problema. Os outros (test_opponents.py)
validam a struct do acshm.py CONTRA SI PROPRIO -- que e' o que a
Regra no 4 avisa que nao prova nada sobre o mundo.

Corre:  python tests\test_contrato.py
"""
import ctypes
import glob
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

# Descobre a pasta da app em vez de a escrever. A pasta chamava-se
# "python_app" e passou a chamar-se "actelemetry_strefiz"; com o caminho
# escrito a mao, este teste partiu logo -- o que e' a prova de que a
# proteccao funciona, mas nao de que era assim que se queria.
#
# Procura-se pelo modulo, que e' o que interessa: a estrutura pode
# mudar de nome sem que o contrato mude.
ACHADO = glob.glob(os.path.join(RAIZ, 'python_app', '*', 'actelemetry_shm.py'))
if not ACHADO:
    ACHADO = glob.glob(os.path.join(RAIZ, '**', 'actelemetry_shm.py'))
if not ACHADO:
    print('ERRO: nao encontrei actelemetry_shm.py dentro de python_app/.')
    print('      A app da partida sumiu? E a app que escreve a pagina de')
    print('      adversarios -- sem ela o dashboard fica sem lista.')
    sys.exit(2)

PASTA_APP = os.path.dirname(ACHADO[0])
sys.path.insert(0, PASTA_APP)
print('pasta da app: %s' % os.path.relpath(PASTA_APP, RAIZ))

import acshm
import actelemetry_shm as shm


def descrever(struct):
    """(nome, offset, tamanho, descricao do tipo) de cada campo."""
    out = []
    off = 0
    for nome, tipo in struct._fields_:
        tam = ctypes.sizeof(tipo)
        out.append((nome, off, tam, descricao(tipo)))
        off += tam
    return out, off


def descricao(tipo):
    """Um tipo do ctypes, escrito de forma legivel.

    Para uma STRUCT devolve a ASSINATURA DOS CAMPOS, nao o nome da
    classe. E' por isso que 'acsVehicleInfo' do leitor e 'CarInfo' da app
    comparam iguais: sao duas classes com nomes diferentes e a mesma
    disposicao de memoria -- que e' a unica coisa que interessa num
    contrato binario. Se as structs divergirem, as assinaturas divergem.
    """
    if hasattr(tipo, '_length_'):
        base = tipo._type_
        if hasattr(base, '_fields_'):
            dentro = ','.join('%s:%s' % (n, descricao(t))
                              for n, t in base._fields_)
            return 'struct{%s} x %d' % (dentro, tipo._length_)
        return '%s x %d' % (base.__name__, tipo._length_)
    if hasattr(tipo, '_fields_'):
        dentro = ','.join('%s:%s' % (n, descricao(t))
                          for n, t in tipo._fields_)
        return 'struct{%s}' % dentro
    return tipo.__name__


def main():
    problemas = []

    # ---- 1. o nome da pagina ------------------------------------------
    print('--- nome da pagina partilhada ---')
    print('  acshm.py            : %s' % acshm.Opponents.NAME)
    print('  actelemetry_shm.py  : %s' % shm.PAGE_NAME)
    if acshm.Opponents.NAME != shm.PAGE_NAME:
        problemas.append(
            'O NOME DA PAGINA e' ' diferente nos dois lados! O leitor vai abrir '
            'uma pagina que ninguem escreve, e o dashboard fica sem adversarios '
            'sem dar erro nenhum. Escreve: acshm.py %r vs a app %r'
            % (acshm.Opponents.NAME, shm.PAGE_NAME))

    # ---- 2. o numero de setores ---------------------------------------
    print()
    print('--- MAX_SECTORS ---')
    print('  acshm.py            : %d' % acshm.MAX_SECTORS)
    print('  actelemetry_shm.py  : %d' % shm.MAX_SECTORS)
    if acshm.MAX_SECTORS != shm.MAX_SECTORS:
        problemas.append(
            'MAX_SECTORS diferente (%d vs %d): a struct fica com tamanhos '
            'diferentes e os offsets a partir dai nao batem.'
            % (acshm.MAX_SECTORS, shm.MAX_SECTORS))

    # ---- 3. o numero de carros ----------------------------------------
    print()
    print('--- numero de carros ---')
    n_ficheiros = len(acshm.acsVehicleInfo._fields_)
    # no acshm.py o array e' literal (128); na app vem de MAX_CARS
    campos_pagina_visor = [c[0] for c in acshm.SPageFileSimHub._fields_]
    campos_pagina_app = [c[0] for c in shm.CarPage._fields_]
    n_visor = None
    for nome in campos_pagina_visor:
        if nome == 'vehicleInfo':
            n_visor = 128
    print('  acshm.py            : vehicleInfo x 128')
    print('  actelemetry_shm.py  : carInfo x %d' % shm.MAX_CARS)
    if n_visor != shm.MAX_CARS:
        problemas.append(
            'A app escreve %d carros e o leitor le %d. Os carros a partir do indice '
            'indice %d sao lidos a partir de bytes que nao existem.'
            % (shm.MAX_CARS, n_visor, min(shm.MAX_CARS, n_visor)))

    # ---- 4. os campos, um a um ----------------------------------------
    print()
    print('--- campos do carro: nome, offset, tipo ---')
    a_visor, tam_visor = descrever(acshm.acsVehicleInfo)
    a_app, tam_app = descrever(shm.CarInfo)

    larg = max(len(c[0]) for c in a_visor + a_app)
    n_max = max(len(a_visor), len(a_app))
    for i in range(n_max):
        v = a_visor[i] if i < len(a_visor) else None
        p = a_app[i] if i < len(a_app) else None
        nome_v = v[0].ljust(larg) if v else '(nao existe)'.ljust(larg)
        nome_p = p[0].ljust(larg) if p else '(nao existe)'.ljust(larg)
        if v and p:
            dv = '%s @%d' % (v[3], v[1])
            dp = '%s @%d' % (p[3], p[1])
        else:
            dv = '-'
            dp = '-'
        marca = ' '
        if not v or not p:
            problemas.append('campo %d: existe de um lado so (leitor=%s, app=%s)'
                             % (i, v[0] if v else '?', p[0] if p else '?'))
            marca = 'X'
        elif v[0] != p[0]:
            problemas.append('campo %d: nome diferente -- leitor %r, app %r'
                             % (i, v[0], p[0]))
            marca = 'X'
        elif v[3] != p[3]:
            problemas.append('campo %d (%s): tipo diferente -- leitor %s, app %s'
                             % (i, v[0], v[3], p[3]))
            marca = 'X'
        elif v[1] != p[1]:
            problemas.append('campo %d (%s): OFFSET diferente -- leitor @%d, '
                             'app @%d. Tudo a partir daqui e lido do sitio '
                            'errado.' % (i, v[0], v[1], p[1]))
            marca = 'X'
        print('  %s %2d  %s | %-18s | %s' % (marca, i, nome_v, dv, dp))

    print()
    print('  tamanho do carro: leitor %d bytes, app %d bytes' % (tam_visor, tam_app))
    if tam_visor != tam_app:
        problemas.append('tamanho do carro diferente: leitor %d, app %d'
                         % (tam_visor, tam_app))

    # ---- 5. a pagina toda --------------------------------------------
    print()
    print('--- tamanho da pagina inteira ---')
    total_visor = ctypes.sizeof(acshm.SPageFileSimHub)
    total_app = ctypes.sizeof(shm.CarPage)
    print('  acshm.py            : %d bytes' % total_visor)
    print('  actelemetry_shm.py  : %d bytes' % total_app)
    if total_visor != total_app:
        problemas.append('a pagina inteira tem tamanhos diferentes: leitor %d, app '
                         '%d. O leitor pode ir ler %d bytes a seguir ao fim.'
                         % (total_visor, total_app, total_app - total_visor))

    # ---- 6. os cabecalhos da pagina ----------------------------------
    print()
    print('--- cabecalhos da pagina ---')
    # os nomes podem diferir (vehicleInfo vs carInfo) -- o que nao pode
    # diferir e' a POSICAO. Compara so' o tipo e o offset.
    p_visor, _ = descrever(acshm.SPageFileSimHub)
    p_app, _ = descrever(shm.CarPage)
    n_max = max(len(p_visor), len(p_app))
    for i in range(n_max):
        v = p_visor[i] if i < len(p_visor) else None
        p = p_app[i] if i < len(p_app) else None
        if not v or not p:
            problemas.append('cabecalho %d: existe de um lado so' % i)
            print('  X %2d  %s' % (i, (v or p)[0]))
            continue
        # Os NOMES dos cabecalhos podem diferir a vontade -- 'vehicleInfo'
        # do lado do leitor e 'carInfo' do lado da app sao a mesma coisa com
        # nomes diferentes. O que nao pode diferir e' o TIPO e o OFFSET,
        # porque e' isso que decide onde cada valor vai parar.
        ok = v[3] == p[3] and v[1] == p[1]
        if not ok:
            problemas.append('cabecalho %d: leitor %s (%s) @%d, app %s (%s) @%d'
                             % (i, v[0], v[3], v[1], p[0], p[3], p[1]))
        print('  %s %2d  %-22s %-18s @%-6d | %-22s %s'
              % (' ' if ok else 'X', i, v[0], v[3], v[1], p[0], p[3]))

    # ---- resultado ---------------------------------------------------
    print()
    print('=' * 68)
    if problemas:
        for p in problemas:
            print('FALHA: ' + p)
        print()
        print('%d PROBLEMA(S) no contrato. A app e o leitor nao falam a mesma'
              ' linguagem -- o dashboard vai ler do sitio errado.' % len(problemas))
        return 1
    print('ok: a app e o acshm.py falam a mesma linguagem.')
    print('    pagina %s, %d bytes, %d carros, %d bytes por carro, '
          '%d setores por volta.'
          % (shm.PAGE_NAME, total_app, shm.MAX_CARS, tam_app, shm.MAX_SECTORS))
    return 0


if __name__ == '__main__':
    sys.exit(main())
