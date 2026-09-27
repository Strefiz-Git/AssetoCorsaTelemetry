# -*- coding: utf-8 -*-
r"""
tests\caixa.py  --  diagnosticar o bug da caixa.

O que se reporta: a caixa mostra "N" quando o jogo esta em reveso, e "2"
quando o jogo esta na 1a. Os dois sintomas somam +1, o que cheira a
deslocamento de offset.

O que JA esta verificado, e que descarta essa hipotese:

  - o offset. A `gear` esta no indice 4, a 16 bytes, e os vizinhos
   immediateos fazem sentido: fuel 4,17 L, rpms 4000, speedKmh. Se
    estivesse deslocada, um deles seria absurdo. Regra no 4.
  - o mapeamento. O HUD do Content Manager, que le a API Lua e nao a
    memoria partilhada, escreve exactamente:
        if car_gear ==  0 then gear_string = 'N' end
        if car_gear == -1 then gear_string = 'R' end
    E o acshm.py faz  0 -> "N",  < 0 -> "R". Os dois concordam.
  - o frontend. Sao tres linhas, todas setTxt(elemento, d.gear || 'N').
    Nao ha nenhuma comparacao numerica, nada que possa converter a
    string "R" em NaN.

O que falta, e que este script tira: o valor CRU, a correr, com o
contexto. Sem o jogo a vivo nao ha forma de distinguir um valor
errado de uma diferenca entre a memoria partilhada e o que o jogo
mostra no ecra.

Como correr, com o jogo aberto e a conduzir:

    python tests\\caixa.py 30

grava 30 segundos em tests\\caixa_captura.json, e depois:

    python tests\\caixa.py ver

So' LE. Nunca escreve nas paginas do jogo (Regra no 1).
"""
import ctypes
import json
import os
import sys
import time
from ctypes import wintypes

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import acshm

FICHEIRO = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'caixa_captura.json')


def _mapeia():
    k = ctypes.WinDLL('kernel32', use_last_error=True)
    k.OpenFileMappingW.restype = wintypes.HANDLE
    k.OpenFileMappingW.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.LPCWSTR]
    k.MapViewOfFile.restype = ctypes.c_void_p
    k.MapViewOfFile.argtypes = [wintypes.HANDLE, wintypes.DWORD,
                               ctypes.c_ulong, ctypes.c_ulong, ctypes.c_size_t]
    return k


def vivo():
    """O jogo esta a escrever? O packetId e' o unico sinal (Regra no 2)."""
    k = _mapeia()
    h = k.OpenFileMappingW(0x0004, False, 'acpmf_physics')
    if not h:
        return False
    a = k.MapViewOfFile(h, 0x0004, 0, 0, 4096)
    v1 = ctypes.c_int32.from_address(a).value
    time.sleep(0.35)
    return ctypes.c_int32.from_address(a).value != v1


def capturar(segundos, hz=200):
    if not vivo():
        print('O jogo nao esta a correr. Nao ha nada para capturar --')
        print('a pagina fica com o ultimo estado congelado e qualquer')
        print('conclusao seria sobre nada (Regra no 2).')
        return None

    t = acshm.ACTelemetry()
    t.snapshot()
    _, _, ph = t._views['acpmf_physics']

    intervalo = 1.0 / hz
    amostras = []
    mudanças = []
    anterior = None
    fim = time.time() + segundos
    while time.time() < fim:
        # uma so leitura, coerente: o struct e' lido inteiro de seguida
        g = ph.gear
        r = ph.rpms
        v = ph.speedKmh
        agora = time.time()
        reg = {'t': round(agora - (fim - segundos), 3),
               'gearCru': g, 'gear': acshm._gear(g),
               'rpm': int(r), 'kmh': round(v, 1)}
        amostras.append(reg)
        if g != anterior:
            mudancas.append(reg)
            anterior = g
        tempo = intervalo - ((time.time() - agora) % intervalo)
        if tempo > 0:
            time.sleep(tempo)

    dados = {'segundos': segundos, 'hz': hz,
             'pista': (t.snapshot() or {}).get('track'),
             'carro': (t.snapshot() or {}).get('car'),
             'amostras': amostras, 'mudancas': mudancas}
    with open(FICHEIRO, 'w', encoding='utf-8') as f:
        json.dump(dados, f, indent=1)
    return dados


def ver():
    if not os.path.exists(FICHEIRO):
        print('ainda nao ha captura. Corre primeiro:  python tests\\caixa.py 30')
        return
    with open(FICHEIRO, encoding='utf-8') as f:
        d = json.load(f)

    print('pista %s | carro %s | %d s a %d Hz'
          % (d.get('pista'), d.get('carro'), d['segundos'], d['hz']))
    print()
    print('--- valores crus que apareceram ---')
    vistos = {}
    for a in d['amostras']:
        vistos[a['gearCru']] = vistos.get(a['gearCru'], 0) + 1
    for g, n in sorted(vistos.items()):
        print('   gearCru = %-4s  (%-2s no ecra)  %6d amostras  %5.1f%%'
              % (g, acshm._gear(g), n, 100.0 * n / len(d['amostras'])))
    print()
    print('--- mudancas de caixa (as transicoes) ---')
    print('   %-8s %-6s %-6s %-8s %s' % ('t', 'cru', 'mostra', 'rpm', 'km/h'))
    for m in d['mudancas'][:80]:
        print('   %-8.3f %-6s %-6s %-8d %s'
              % (m['t'], m['gearCru'], m['gear'], m['rpm'], m['kmh']))
    if len(d['mudancas']) > 80:
        print('   ... mais %d' % (len(d['mudancas']) - 80))
    print()
    print('AGORA: compara cada transicao com o que o JOGO mostra no ecra.')
    print('Se o jogo mostrar -1/R e aqui der 0/N no mesmo instante, o valor')
    print('chega err -- e entao o suspecto passa a ser a leitura, nao o offset.')
    print('Se o jogo tambem mostrar 0, entao o jogo e a memoria concordam e')
    print('o problema e de outro sitio.')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else '30'
    if cmd == 'ver':
        ver()
    else:
        d = capturar(int(cmd))
        if d:
            print()
            print('gravado em %s' % FICHEIRO)
            ver()
