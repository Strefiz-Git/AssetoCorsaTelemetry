# -*- coding: utf-8 -*-
"""Confere que o HTML fecha, que nenhum ecra esta dentro de outro, e que a
espera tem saida.

PORQUE ISTO E' UM TESTE
-----------------------
Uma insercao comeu o `</div>` que fechava a `.boot-box`, e o `div#jogos`
-- o ecra de escolha de jogo -- passou a ser FILHO de `div#boot`. Com o
`#boot` a `display:none`, o ecra de escolha media 0x0 e nao se via nada.

**Os 31 grupos da suite passaram.** O `auditar_frontend.py` confere ids,
traducoes, contraste e chaves de CSS; nao confirma que o HTML fecha, porque
isso e' trabalho de um analisador de HTML e nao de uma lista de ids.

E o que engana e' o seguinte: com o HTML partido, o `getElementById`
encontra TUDO. Nao falta elemento nenhum -- estao todos la, so' aninhados
no sitio errado. Um teste de "existe este id?" passa, e o ecra nao aparece.

POR QUE UM PARSER E NAO UMA EXPRESSAO REGULAR
---------------------------------------------
A primeira versao deste ficheiro contou as etiquetas com uma pilha
escrita a mao, e deu tres falsos positivos num HTML que o browser lia
bem. Depois tentou o "esta' dentro de" com

    (?:(?!<div id=)[\\s\\S])*?

que depende do texto entre as etiquetas e erra com o primeiro `</div>` a
mais. Um parser e' o que responde a pergunta, e nao uma expressao que a
imita.
"""
import io
import os
import re
import sys
from html.parser import HTMLParser

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
H = os.path.join(RAIZ, 'static', 'index.html')
JS = os.path.join(RAIZ, 'static', 'app.js')

falhou = []


def ok(cond, msg, extra=''):
    if cond:
        print('  ok   %s' % msg)
    else:
        falhou.append(msg)
        print('  FALHA  %s' % msg)
        if extra:
            print('          %s' % extra)


class Arvore(HTMLParser):
    """A arvore que o BROWSER constroi, e o pai de cada elemento com id."""

    def __init__(self):
        HTMLParser.__init__(self, convert_charrefs=True)
        self.pilha = []          # (tag, id, linha)
        self.pai = {}            # id -> id do pai (None se o pai nao tem id)
        self.paiTag = {}         # id -> ETIQUETA do pai immediate
        self.fora = []           # etiquetas fechadas sem estar abertas
        self.ficaram = []        # nunca fechadas

    VOZIOS = ('area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
              'link', 'meta', 'param', 'source', 'track', 'wbr')

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        self._abre(tag, d.get('id'), self.getpos()[0])

    def handle_startendtag(self, tag, attrs):
        return                        # `<br/>`: nao abre nem fecha

    def handle_endtag(self, tag):
        if tag in self.VOZIOS:
            return
        if not self.pilha:
            self.fora.append((tag, self.getpos()[0]))
            return
        if self.pilha[-1][0] != tag:
            # O browser tolera e corrige. Registado, nao rebentado: o que
            # interessa e' que a ARVORE que ele constroi esta' como se
            # espera, e essa e' a pergunta da seccao 2.
            self.fora.append((tag, self.getpos()[0]))
            self.pilha.pop()
            return
        self.pilha.pop()

    def _abre(self, tag, eid, linha):
        if eid:
            pai = next((p for _, p, _ in self.pilha if p), None)
            self.pai[eid] = pai
            # A ETIQUETA do pai imediato, e nao o seu id: o `<body>` nao
            # tem id, e sem isto todos os ecras davam "pai: None" e o
            # teste acusava HTML bom.
            if self.pilha:
                self.paiTag[eid] = self.pilha[-1][0]
            else:
                self.paiTag[eid] = '(raiz)'
        if tag not in self.VOZIOS:
            self.pilha.append((tag, eid, linha))

    def fecha(self):
        self.ficaram = [(t, e, n) for t, e, n in self.pilha]


bruto = io.open(H, encoding='utf-8', newline='').read()
nlinhas = len(re.split(r'\r\n|\n', bruto))

a = Arvore()
a.feed(bruto)
a.fecha()

print('')
print('=== 1. o HTML fecha o que abre ===')
ok(not a.fora,
   'nenhuma etiqueta fecha fora de sitio (%d linhas)' % nlinhas,
   '; '.join('linha %d: `</%s>`' % (n, t) for t, n in a.fora[:3]))
ok(not a.ficaram,
   'nenhuma etiqueta fica aberta',
   '; '.join('`<%s id=%s>` da linha %d' % (t, e, n) for t, e, n in a.ficaram[:3]))

print('')
print('=== 2. cada ecra tem o pai que deve ===')
# Os ecras sao `position:fixed; inset:0`. Um ecra aninhado noutro
# desaparece quando o pai ganha `hidden` -- e o `getElementById` continua
# a encontra-lo, que e' o que faz o bug parecer impossivel.
PAIS = {
    'boot': 'body',
    'jogos': 'body',
    'menu': 'body',
    'app': 'body',
}
for eid, esperado in PAIS.items():
    got = a.paiTag.get(eid)
    ok(got == esperado,
       '`#%s` e filho directo do <%s>' % (eid, esperado),
       'pai real: %s' % got)

print('')
print('=== 3. os ids que o JS pede sao os que o HTML tem ===')
js = io.open(JS, encoding='utf-8').read()
pedidos = set(re.findall(r"\$\('([a-zA-Z0-9_-]+)'\)", js))
ids = set(re.findall(r'id="([a-zA-Z0-9_-]+)"', bruto))
faltam = sorted(pedidos - ids)
ok(not faltam, 'os %d ids que o JS pede existem todos' % len(pedidos),
   'faltam: %s' % faltam)

print('')
print('=== 4. o ecra de espera tem uma saida ===')
# Um ecra de espera sem saida e' um beco sem saida, e o botao e' a saida.
# E o que o utilizador pediu: em "A aguardar o jogo" tem de dar para
# escolher o jogo.
ok('boot-jogo' in ids, 'o ecra de espera tem um botao para escolher o jogo')
ok(a.pai.get('boot-jogo') == 'boot',
   'e esse botao esta DENTRO do ecra de espera',
   'pai real: %s' % a.pai.get('boot-jogo'))
ok(a.pai.get('jogos') != 'boot',
   'e o ecra de escolha nao esta dentro do ecra de espera',
   'pai real: %s' % a.pai.get('jogos'))

print('')
print("=== 5. um ecra modal nunca e' posto a `inert` ===")
# O BUG QUE ESTA REGRA APANHA
#
# Escrevi `$('jogos').inert = true;` dentro de `abrirEcraJogos()`, e o ecra
# de escolha ficou INUTILIZAVEL: os cartoes tinham 453x181 e um clique no
# centro acertava o `<body>`.
#
# `inert` NAO e' "isto e' modal". E' "isto nao aceita cliques nem foco". O
# ecra que tem os botoes tem de ser INTERACTIVEL, e o que nao entra na
# tabulacao e' o que esta' POR BAIXO -- que e' o que o `showMenu()` faz,
# com `$('app').inert = true`.
#
# E nao da' erro nenhum, que e' o que faz isto passar sem o dizer: os ids
# existem todos, o ecra tem tamanho, e os 33 grupos da suite passam. Um
# `inert` no sitio errado so se ve a clicar. Mas a CONFUSAO fica escrita, e
# e' verificavel sem browser: o `aria-modal` esta' no HTML, o `inert` esta'
# no JS, e a regra e' "nunca os dois no mesmo elemento".
modais = set()
for m in re.finditer(r'<[^>]*\bid="([^"]+)"[^>]*>', bruto):
    if 'aria-modal="true"' in m.group(0):
        modais.add(m.group(1))
ok(modais, 'o HTML marca %d ecra(s) como modal: %s'
   % (len(modais), ', '.join(sorted(modais))))

alvos = {}
for k, linha in enumerate(js.split('\n'), 1):
    sem = re.sub(r'/\*.*?\*/', '', linha)
    sem = re.sub(r'//.*', '', sem)
    for m in re.finditer(r"\$\('([\w-]+)'\)\.inert\s*=\s*true", sem):
        alvos.setdefault(m.group(1), []).append(k)

for mid in sorted(modais):
    if mid in alvos:
        ok(False, '`#%s` e modal e nao pode ficar inert' % mid,
           'JS linha(s) %s -- o ecra fica sem cliques, e sem erro nenhum'
           % ', '.join(str(n) for n in alvos[mid]))
    else:
        ok(True, '`#%s` e modal e nunca fica inert' % mid)

for mid in sorted(modais):
    falado = bool(re.search(r"\$\('%s'\)" % re.escape(mid), js))
    ok(falado, '`#%s` e falado pelo JS, que e o que o fecha' % mid)

print('')
print('=' * 60)
if falhou:
    print('!!! %d FALHA(S)' % len(falhou))
    sys.exit(1)
print('ok: o HTML fecha, ninguem esta dentro de ninguem, a espera tem saida, '
      'e nenhum modal fica inert.')
