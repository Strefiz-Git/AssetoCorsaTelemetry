# -*- coding: utf-8 -*-
"""Passa a maos nas mensagens de commit.

Duas coisas que ja correram mal nesta sessao e que nao se apanham a
ler o `git log` no terminal:

  - um BOM no inicio, porque o `Out-File -Encoding utf8` do PowerShell 5.1
    escreve um e o `git commit -F` le-o como parte do texto;
  - caracteres CJK de outra escrita, que aparecem no meio de uma frase
    portuguesa e que ninguem nota a ler.

O `verificar_texto.py` trata dos ficheiros do disco. Nao trata das
mensagens, porque nao estao no disco. Por isso este script le os bytes do
objecto de commit -- que e' onde a mensagem esta' de facto -- e ve o
que o terminal mostra.
"""
import re
import subprocess
import sys

CJK = re.compile('[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]')
n = int(sys.argv[1]) if len(sys.argv) > 1 else 4

commits = subprocess.run(['git', 'log', '--format=%H', '-n', str(n)],
                         capture_output=True, text=True).stdout.split()
mau = 0
for c in commits:
    bruto = subprocess.run(['git', 'cat-file', 'commit', c],
                           capture_output=True).stdout
    i = bruto.find(b'\n\n')
    msg = bruto[i + 2:].decode('utf-8', 'replace')
    titulo = msg.split('\n')[0]
    problemas = []
    if msg[:3] == '﻿':
        problemas.append('BOM no inicio')
    achado = CJK.search(msg)
    if achado:
        problemas.append('CJK: %r' % msg[max(0, achado.start() - 18):achado.start() + 8])
    if problemas:
        mau += 1
        print('  %s  %s' % (c[:8], titulo[:52]))
        for p in problemas:
            print('      %s' % p)
    else:
        print('  %s  ok   %s' % (c[:8], titulo[:60]))

if mau:
    raise SystemExit('  %d mensagem(s) com problema' % mau)
print('  as %d mensagens estao limpas.' % len(commits))
