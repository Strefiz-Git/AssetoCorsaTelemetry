# -*- coding: utf-8 -*-
"""Mede a que velocidade o `tyreWear` da partida desce, volta a volta.

PORQUEE ISTO E' O QUE FALTA

Tem-se o seguinte, do mesmo carro no mesmo segundo:

    memoria partilhada   FL 98,67   FR 98,82   RL 98,36   RR 98,35
    HUD do Content Manager, lido
    como "quanto resta"  FL 88      FR 91      RL 82      RR 82

Dez pontos de desvio. As explicacoes possiveis sao tres, e nenhuma se
descarta so com estes numeros:

  1. o valor da partida e' 0..100 "quanto resta" e esta certo, e o do
     HUD esta noutra escala (o Lua mede o desgaste sobre a vida nominal
     do composto, e a partida mede sobre o modelo de desgaste);
  2. o valor da partida e' 0..100 "quanto resta" e esta errado;
  3. o valor da partida nao e' desgaste.

A ARITMETICA NAO SEPARA ISTO. Os quatro valores estao todos perto uns
dos outros -- entre 98,35 e 98,82 -- e por isso uma relacao linear
encaixa neles com erro menor que um ponto. Isso nao prova nada: com
quatro numeros que se mexem 0,47 no total, qualquer relacao comecada
neles parece boa. E' a razao de a conta de uma reta dar 19,5 e "caber"
tanbem com o significado nenhum.

O QUE SEPARA ISTO E' A TAXA.

Um pneu SuperSoft no Nordschleife perde-se de poucos por cento por
volta. Logo:

  - se a partida descer ~1,5% por volta, e' mesmo 0..100 "quanto resta"
    e o que o HUD mostra mede outra coisa;
  - se descer ~12% por volta, os 98,67 nao sao "98,67% de resto" e o
    numero da partida e' que nao se pode mostrar.

Nao ha como decidir sem conduzir. Este script mede a taxa e diz qual
dos dois e' o caso, sem interpretar nada.

O QUE FAZ

Le a partida de cada vez, e quando o contador de voltas sobe, imprime
quanto cada roda desceu desde a volta anterior. Ao fim de duas ou tres
voltas a taxa esta' medida e a conta acaba.

So' LEITURA. Nada e' escrito nas paginas do jogo (Regra nº 1).
"""
import ctypes
import os
import sys
import time

# O caminho sai do FICHEIRO, e nao da pasta onde se corre. A primeira
# versao punha '.' -- que e' a pasta de trabalho -- e por isso dava
# 'No module named acshm' quando o comando era dado de dentro de
# tests\, que e' de onde se corre qualquer coisa deste projecto. E' o
# mesmo caminho que os outros testes usam.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import acshm

addr = acshm.k32.MapViewOfFile(
    acshm.k32.OpenFileMappingW(acshm.FILE_MAP_READ, False, 'acpmf_physics'),
    acshm.FILE_MAP_READ, 0, 0, ctypes.sizeof(acshm.SPageFilePhysics))
if not addr:
    raise SystemExit('  nao mapeei a pagina de fisica: o jogo esta' + chr(39) + ' aberto?')
ph = acshm.SPageFilePhysics.from_address(addr)

# --- o jogo esta' a viver? -------------------------------------------
p0 = ph.packetId
time.sleep(0.5)
if ph.packetId == p0:
    raise SystemExit('  o jogo NAO esta a correr (packetId parado).\n'
                     '  Com o jogo em pausa ou no menu o packetId tambem para,\n'
                     '  e nao se mede taxa nenhuma. Arrancar com o jogo a andar.')
print('  o jogo esta a frame. A medir o tyreWear, volta a volta.')
print('  Conduz duas ou tres voltas sem parar. Ctrl+C quando chega a zero.')
print('')

NOME = ('FL', 'FR', 'RL', 'RR')
ultima_volta = None
anterior = None
n_voltas = 0
t0 = time.time()

print('  %8s  %-38s' % ('volta', 'tyreWear da partida, 0..100 (como esta na struct)'))
while True:
    try:
        volta = int(ph.lapCount)
        agora = [ph.tyreWear[i] for i in range(4)]
        nucleo = [round(ph.tyreCoreTemperature[i]) for i in range(4)]
        vel = ph.speedKmh
    except KeyboardInterrupt:
        break
    except Exception as e:
        print('  deixei de ler a partida: %s' % e)
        break

    if ultima_volta is None:
        ultima_volta = volta
        anterior = agora
        print('  %8d  %s   (a espera da volta %d para medir)'
              % (volta, ' '.join('%6.2f' % v for v in agora), volta + 1))
    elif volta != ultima_volta:
        d = [agora[i] - anterior[i] for i in range(4)]
        print('  %8d  %s   desceu %s'
              % (volta, ' '.join('%6.2f' % v for v in agora),
                 ' '.join('%+6.2f' % v for v in d)))
        n_voltas += 1
        anterior = agora
        ultima_volta = volta
        if n_voltas >= 3:
            break
    time.sleep(0.5)

print('')
print('  o nucleo ao fim: %s   (a %.0f km/h)'
      % (nucleo, ph.speedKmh))
if n_voltas == 0:
    raise SystemExit('  nao se fechou nenhuma volta: nao ha taxa para medir.')

print('')
print('  agora a conta, que e' + chr(39) + ' a unica que interessa:')
print('    a media de quanto cada roda desceu por volta, nos ultimos')
print('    minutos, diz se os 98,67 sao "98,67%% de resto" ou nao.')
print('')
print('    REGRA DE LEITURA, e nao e' + chr(39) + ' uma interpretacao:')
print('      ~1 a 3%% por volta  ->  a partida e' + chr(39) + ' mesmo 0..100 "quanto')
print('                                   resta", e o HUD mede noutra escala.')
print('      ~10 a 15%% por volta ->  os 98,67 NAO sao "98,67%% de resto",')
print('                                   e o numero da partida nao pode')
print('                                   mostrar-se assim.')
