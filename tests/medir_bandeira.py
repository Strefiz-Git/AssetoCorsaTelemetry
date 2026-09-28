# -*- coding: utf-8 -*-
"""A MEDICAO QUE RESOLVE A BANDEIRA DO F1 25.

Corre com o JOGO A CORRER:  python tests\\medir_bandeira.py

O QUE ESTA MAL, E O QUE FALTA
-----------------------------
O painel mostra "Nenhuma" com uma bandeira AZUL no ecra. A razao:

    FIA = {-1: "Desconhecida", 0: "Nenhuma", 1: "Verde", 2: "Azul",
           3: "Amarela"}

    FIA = {-1: "Desconhecida", 0: "Nenhuma", 1: "Verde", 2: "Azul",
           3: "Amarela"}

A tabela esta' certa. O receptor publica `vehicleFIAFlags`, que e' a
bandeira **DO PROPRIO CARRO** -- a que se aplica a um carro especifico,
como a de penalizacao. Verde, azul e amarela sao as bandeiras DE PISTA, e
vivem no bitfield `m_vehicleFlags`, que **nao esta' no struct**.

Por isso uma bandeira azul nunca pode aparecer: o painel esta' a mostrar
outra coisa, e a coisa que devia mostrar nao e' lida.

PORQUE ISTE ESTA FORA DA SUITE, E NAO DENTRO
--------------------------------------------
Acrescentar `m_vehicleFlags` ao struct e' mexer num CONTRATO BINARIO. O
campo e' um `uint16`, e se entrar na posicao errada desloca TUDO o que
vem a seguir: as pressoes, as temperaturas, o ERS, a posicao no mapa. E
nao da' erro nenhum -- o leitor le bytes a partir do sitio errado e
devolve numeros plausiveis. E' a Regra no 19, que e' a razao de este
ficar a mao.

A mediacao que resolve e' UMA, e e' a da Regra no 15: mudar uma coisa e
ver o que muda. Este script le o mesmo packet de duas maneiras -- com o
campo onde a documentacao o poe, e com os campos de depois -- e so' aceita
a posicao se os campos de DEPOIS derem os mesmos valores que dao agora.
E' essa a prova, e nao a documentacao.

O QUE ESTE SCRIPT FAZ
----------------------
1. Le um packet de Car Status ao vivo, pela MESMA porta que o receptor
   usa, sem mexer no receptor.
2. Calcula onde o `uint16` cairia, com a posicao da documentacao da EA.
3. Le esse `uint16` e diz o valor e que bits estao acesos.
4. Le os campos de DEPOIS com e sem a insercao, e compara.

Se o passo 4 der iguais, a posicao esta' certa. Se der diferentes, esta'
errada -- e o script diz quais.
"""
import io
import os
import socket
import struct
import sys
import time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

from actelemetry.jogos.f125 import protocolo as P  # noqa: E402

# O id do packet de Car Status, e a porta que o jogo manda.
PACKET_CAR_STATUS = getattr(P.PacketId, 'CAR_STATUS', 4)
PORTA = 20777

# Onde a documentacao da EA poe o `m_vehicleFlags` dentro do bloco de
# Car Status: depois de `m_visualTyreCompound` e antes de `m_tyresAgeLaps`.
#
# A documentacao do projecto (docs/f1-25.md) lista `m_tyresAgeLaps` e
# `m_vehicleFIAFlags` seguidos, e NAO lista o `m_vehicleFlags`. Ou a doc
# esta' incompleta, ou o struct foi feito a partir dela. Este script
# pressupoe a posicao da documentacao DA EA e PROVA-A pelo passo 4, que
# e' o unico sitio onde a prova existe.

print('=' * 68)
print(' A BANDEIRA DE PISTA DO F1 25')
print('=' * 68)
print('')
print(' Este script precisa do JOGO A CORRER e com UDP ligado.')
print(' Se nao houver pacotes, sai com codigo 2 -- que nao e\' falha.')
print('')

# --- 1. apanha um packet de Car Status ao vivo -----------------------
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
try:
    sock.bind(('127.0.0.1', PORTA))
except OSError as e:
    print('  nao consegui abrir a porta %d: %s' % (PORTA, e))
    print('  o jogo ja esta\' a enviar? Se sim, o receptor tem a porta.')
    sys.exit(2)
sock.settimeout(6.0)

bruto = None
formato = None
t0 = time.time()
while time.time() - t0 < 8.0:
    try:
        dados = sock.recv(4096)
    except socket.timeout:
        break
    if len(dados) < 29:
        continue
    pid = dados[0]
    fmt = struct.unpack_from('<H', dados, 24)[0]
    if pid == PACKET_CAR_STATUS:
        bruto = dados
        formato = fmt
        break
sock.close()

if bruto is None:
    print('  nao chegou nenhum packet de Car Status em 8 segundos.')
    print('')
    print('  O jogo esta\' a correr com o UDP ligado? Em Settings >')
    print('  Telemetry Settings: UDP Telemetry On, IP 127.0.0.1, porta 20777.')
    print('  E so\' ha\' telemetria a CONDUZIR -- nos menus nao sai nada (Regra no 23).')
    sys.exit(2)

print('  apanhei um packet de Car Status: %d bytes, formato %s'
      % (len(bruto), formato))

# --- 2. o struct actual, e onde o campo cairia -----------------------
try:
    bloco = P.construir(formato)
except Exception as e:                      # noqa: BLE001
    sys.exit('  o formato %s nao e\' conhecido: %s' % (formato, e))

car = None
for campo, valor in (bloco or {}).items():
    if 'tyre' in campo.lower() or 'engine' in campo.lower() or 'ers' in campo.lower():
        car = campo
        break
if car is None:
    print('  o bloco nao tem nenhum campo de Car Status reconhecido: %s'
          % list(bloco or {})[:12])
    sys.exit(2)

print('  o bloco de Car Status chama-se %s' % car)
linhas = P.__dict__[car]
campos = list(linhas[0]) if isinstance(linhas, tuple) else list(linhas)
print('  %d campos declarados' % len(campos))

# --- 3. as leituras, com e sem a insercao ---------------------------
def offset_de(nome, campos):
    """O offset, em bytes, do campo `nome` dentro do bloco."""
    off = 0
    for nome_campo, (_nome, formato_campo) in campos:
        if nome_campo == nome:
            return off, formato_campo
        off += struct.calcsize(formato_campo)
    return None, None


def campos_com_flags(campos):
    """Os campos COM o `vehicleFlags` no sitio da documentacao da EA."""
    fora = []
    inserido = False
    for c in campos:
        if c[0] == 'tyresAgeLaps' and not inserido:
            fora.append(('vehicleFlags', ('vehicleFlags', 'H')))
            inserido = True
        fora.append(c)
    return fora, inserido


base_inicio = offset_de('tyresAgeLaps', campos)
novos, inseriu = campos_com_flags(campos)
novo_inicio = offset_de('vehicleFlags', novos) if inseriu else (None, None)
if not inseriu:
    sys.exit("  nao encontrei `tyresAgeLaps`, que e' onde a insercao seria feita")
if novo_inicio[0] is None:
    sys.exit('  o campo inserido nao ficou com offset')

print('')
print('  `tyresAgeLaps` hoje em:        byte %d' % base_inicio[0])
print('  `vehicleFlags` ficaria em:      byte %d' % novo_inicio[0])
print('')

# O valor lido no sitio novo.
vflags = struct.unpack_from('<H', bruto, novo_inicio[0])[0]
print('  VALOR LIDO em `vehicleFlags`:   %d  (0x%04X)' % (vflags, vflags))
print('')
print('  os bits acesos, pela ordem da documentacao da EA:')
BITS = [
    (0, 'GreenFlag', 'Verde'),
    (1, 'BlueFlag', 'Azul'),
    (2, 'YellowFlag', 'Amarela'),
    (3, 'RedFlag', 'Vermelha'),
]
for bit, nome, pt in BITS:
    if vflags & (1 << bit):
        print('    bit %d  %-12s -> %s' % (bit, nome, pt))
if not any(vflags & (1 << b) for b, _, _ in BITS):
    print('    (nenhum dos quatro bits de bandeira esta aceso)')

# --- 4. A PROVA: os campos de depois batem certo? --------------------
print('')
print('=' * 68)
print(' A PROVA: os campos de DEPOIS dao os mesmos valores?')
print('=' * 68)
print('')

# O inicio do bloco dentro do packet. O `construir` ja' devolve os
# valores lidos, que e' a referencia.
referencia = bloco.get(car) or {}
diferencas = []
for nome, _formato in novos:
    if nome == 'vehicleFlags':
        continue
    # so' os campos a seguir ate ao fim do bloco
    if nome in ('tyresAgeLaps', 'vehicleFIAFlags', 'enginePowerICE',
                'enginePowerMGUK', 'ersStoreEnergy', 'ersDeployMode'):
        off_rel, fmt = offset_de(nome, novos)
        off_real = off_rel
        try:
            novo_valor = struct.unpack_from('<' + fmt.lstrip('<'), bruto, off_real)[0]
        except struct.error:
            continue
        velho = referencia.get(nome)
        if velho is not None and novo_valor != velho:
            diferencas.append((nome, velho, novo_valor))
        print('    %-22s antes=%-14s com a insercao=%s'
              % (nome, velho, novo_valor))

print('')
if diferencas:
    print('  %d campo(s) mudaram de valor.' % len(diferencas))
    print('')
    print('  >>> A INSERCAO ESTA ERRADA. O `vehicleFlags` NAO esta onde a')
    print('      documentacao da EA o poe, e o bloco inteiro ficaria a ler')
    print('      a partir do sitio errado. Nao se acrescenta o campo.')
    for nome, velho, novo in diferencas:
        print('        %s: %s -> %s' % (nome, velho, novo))
    sys.exit(1)

print('  Nenhum campo mudou de valor. A insercao esta no sitio certo.')
print('')
print("  O valor em `vehicleFlags` e' %d, com os bits acima." % vflags)
print('  Se a bandeira do ecra for a azul e o bit 1 estiver aceso, esta e')
print('  a prova de que a posicao esta certa, e o campo pode ser adicionado.')
