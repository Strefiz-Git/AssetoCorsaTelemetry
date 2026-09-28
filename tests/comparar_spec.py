# -*- coding: utf-8 -*-
"""Compara TODOS os campos da spec de 2026 contra o nosso protocolo.

O `resources/docs/f125/` tem a spec em TEXTO SIMPLES, e nao so em PDF:

    2026 Season Pack Telemetry Output Structures (1).txt

E isso muda o que se pode verificar. Um PDF nao se abre; um txt abre-se, e
entao da para fazer a coisa que devia ter sido feita sempre: **comparar
campo a campo o que a EA publica com o que o nosso protocolo le**.

A razao de ser um script e nao uma leitura a olho: sao 17 pacotes e alguns
têm 40 campos. Uma diferenca passa despercebida, e um campo que o jogo
publica e o protocolo nao tem da `KeyError` -- ou pior, da zero.

O QUE ISTO NAO VERIFICA, e esta escrito em letra grande
-----------------------------------------------------
Os TIPOS. O `protocolo.py` tem `u8`/`u16`/`f32` e a spec tem `uint16`/
`float`, e a ponte entre os dois e' um dicionario dentro do ficheiro. Este
script compara os NOMES dos campos, e diz quantos `m_` da spec nao existem
no nosso protocolo. Os tamanhos ja estao verificados a byte pelo
`test_f125_parser.py`, que e' o teste certo para isso.

E `test_f125_parser.py` valida o nosso protocolo contra si proprio -- a
Regra no 4. Esta comparacao e' a outra metade: contra a FONTE.
"""
import io
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC = os.path.join(RAIZ, 'resources', 'docs', 'f125',
                    '2026 Season Pack Telemetry Output Structures (1).txt')
PROT = os.path.join(RAIZ, 'actelemetry', 'jogos', 'f125', 'protocolo.py')

# a spec escreve `uint16          m_driverId;` e o protocolo `"driverId", idt`
CAMPO_SPEC = re.compile(r'\b(?:u?int(?:8|16|32|64)|float|char|unsigned \w+)\s+(m_\w+)\s*[;\[]')
NOSSO = re.compile(r'\(\s*"([A-Za-z]\w*)"\s*,')

# --- O MAPA DAS RENOMEAÇÕES -------------------------------------------
# A primeira versao deste script deu "38 campos que a spec publica e o
# protocolo nao tem", e esse numero ERA MENTIRA. Quase todos eram o mesmo
# campo com outro nome:
#
#     m_worldPositionX      ->  posX
#     m_gForceLateral       ->  gLat
#     m_airTemperature      ->  airTemp
#     m_2026Regulations     ->  regulations2026
#
# O protocolo usa nomes curtos de proposito -- cabem na linha e leem-se no
# `snapshot()`. Sem este mapa, a ferramenta acusa 38 buracos onde nao ha
# um, e uma ferramenta que da um numero errado e' pior do que nenhuma: da
# a impressao de um trabalho que nao existe (a Regra no 28, e o `inert` no
# sitio errado).
#
# O mapa e' a unica parte deste ficheiro que se escreve a mao, e escreve-se
# uma vez. Cada entrada e' um nome da spec e o nome nosso, com o mesmo
# campo. Um nome que aqui NAO esteja e' um buraco a investigate.
RENOMEACOES = {
    'worldPositionX': 'posX', 'worldPositionY': 'posY', 'worldPositionZ': 'posZ',
    'worldForwardDirX': 'fwdX', 'worldForwardDirY': 'fwdY', 'worldForwardDirZ': 'fwdZ',
    'worldRightDirX': 'rightX', 'worldRightDirY': 'rightY', 'worldRightDirZ': 'rightZ',
    'worldVelocityX': 'velX', 'worldVelocityY': 'velY', 'worldVelocityZ': 'velZ',
    'gForceLateral': 'gLat', 'gForceLongitudinal': 'gLong', 'gForceVertical': 'gVert',
    'airTemperature': 'airTemp', 'airTemperatureChange': 'airTempChange',
    'trackTemperature': 'trackTemp', 'trackTemperatureChange': 'trackTempChange',
    'rainPercentage': 'rainPct',
    '2026Regulations': 'regulations2026',
    'DRSAssist': 'drsAssist', 'ERSAssist': 'ersAssist',
    'gamePaused': 'paused', 'isSpectating': 'spectating',
    'eventStringCode': 'code', 'eventString': 'details',
    'numWeatherForecastSamples': 'numWeatherSamples',
    'positionForVehicleIdx': 'positions',
    # Estas cinco eram entradas do mapa que apontavam para o nome que a
    # SPEC usa e nao para o nosso. `sessionTimeLeft` nao existe no nosso
    # protocolo: chama-se `timeLeft`. As de unidades chamam-se `...Player`
    # e `...Player2`, e nao `...LeadPlayer`.
    'sessionTimeLeft': 'timeLeft',
    'speedUnitsLeadPlayer': 'speedUnitsPlayer',
    'speedUnitsSecondaryPlayer': 'speedUnitsPlayer2',
    'temperatureUnitsLeadPlayer': 'temperatureUnitsPlayer',
    'temperatureUnitsSecondaryPlayer': 'temperatureUnitsPlayer2',
    'sessionDuration': 'duration',
    'sessionLinkIdentifier': 'sessionLinkId',
    'seasonLinkIdentifier': 'seasonLinkId',
    'weekendLinkIdentifier': 'weekendLinkId',
    'sector1TimeInMS': 'sector1TimeInMS',
}

# --- OS CAMPOS QUE A SPEC PUBLICA E NOS NAO LEMOS, DE PROPOSITO -------
# Um campo da spec que o protocolo nao tem aparece como FALHA deste
# script, para se ver. A primeira versao deu 37, e 36 eram renomeacoes mal
# escritas no mapa. Ficou este.
#
# Nao se acrescenta, e o motivo fica aqui para que a proxima pessoa nao o
# acrescente sem o pensar: e' o suporte do jogo para o SLI Pro, um ecra de
# LEDs externo da Strematics. O painel nao escreve para LEDs, e nao ha como
# este campo mudar o que se mostra. A skill `jogos-e-capacidades` diz o
# mesmo por outro nome: um numero que nunca chega e' uma opcao que nao muda nada.
#
# A alternativa -- deixa-lo a dar falha -- e' pior. Um teste vermelho para
# sempre acaba ignorado, e um teste ignorado e' pior do que nenhum (Regra no 4).
# Aqui o vermelho tem de significar buraco NOVO.
ACEITOS = {
    'sliProNativeSupport': 'ecra de LEDs externo (Strematics SLI Pro); '
                           'o painel nao escreve para LEDs',
}


def main():
    spec = io.open(SPEC, encoding='utf-8', errors='replace').read()
    prot = io.open(PROT, encoding='utf-8', errors='replace').read()

    da_spec = CAMPO_SPEC.findall(spec)
    nossos = set(NOSSO.findall(prot))

    print('  a spec: %d campos m_ declarados' % len(da_spec))
    print('  o protocolo: %d nomes de campo' % len(nossos))

    # a spec usa o prefixo m_; o protocolo nao
    da_spec_sem = set(f[2:] for f in da_spec)

    # O MAPA TRABALHA NESSE SENTIDO: nome-da-spec -> nome-nosso. A primeira
    # versaoEDIA `da_spec_sem - nossos`, ou seja, comparava `worldPositionX`
    # com um conjunto onde esta `posX` e acusava 37 buracos que nao existem.
    # A traducao tem de acontecer ANTES da subtraccao, nao depois.
    traduzidos = {}
    for f in sorted(da_spec_sem):
        traduzidos[f] = RENOMEACOES.get(f, f)
    nao_temos = sorted(f for f, n in traduzidos.items()
                       if n not in nossos and f not in ACEITOS)
    print()
    print('  LIDOS DE PROPOSITO NAO: %d' % len(ACEITOS))
    for f in sorted(ACEITOS):
        print('     m_%-30s %s' % (f, ACEITOS[f]))

    # o que o protocolo tem e que NAO e' a spec renomeada nem um nome interno
    internos = {'FL', 'RL', 'FR', 'RR', 'X', 'Y', 'Z', 'cars', 'header', 'laps',
                'details', 'positions', 'code', 'personalBest', 'playerBest',
                'rival', 'sliPro'}
    temos_a_mais = sorted(nossos - set(traduzidos.values()) - internos)

    print('  CAMPOS QUE A ESPEC PUBLICA E O NOSSO PROTOCOLO NAO TEM: %d' % len(nao_temos))
    for f in nao_temos:
        print('     m_%-32s (nosso: %s)' % (f, traduzidos[f]))
    print('')
    print('  renomeacoes no mapa, todas confirmadas pelo protocolo: %d'
          % sum(1 for f, n in traduzidos.items() if n != f and n in nossos))
    print('')
    print('  CAMPOS DO NOSSO QUE NAO SAO DA SPEC NEM RENOMEACOES: %d' % len(temos_a_mais))
    for f in temos_a_mais[:40]:
        print('     %s' % f)
    if len(temos_a_mais) > 40:
        print('     ... e mais %d' % (len(temos_a_mais) - 40))
    print('')
    print('  ' + '=' * 70)
    if nao_temos:
        print("  %d campos da spec NAO estao no protocolo, e nenhum deles e'"
               " aceite de proposito." % len(nao_temos))
        print('  mao, portanto um buraco novo aparece aqui como falha -- e e\' para')
        print('  isso que ele existe.')
        print('')
        print('  Nao e\' a mesma coisa que estar errado: o painel mostra o que LEM.')
        print('  Mas um campo que o jogo envia e nao lemos e\' uma porta fechada')
        print('  a informacao que o jogo ja esta a pagar para mandar.')
    else:
        print('  Todos os campos que a EA publica estao no nosso protocolo.')
        print('  Nao ha nenhum buraco.')
    sys.exit(1 if nao_temos else 0)


if __name__ == '__main__':
    main()
