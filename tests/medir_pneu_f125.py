# -*- coding: utf-8 -*-
r"""Mede o desgaste do pneu do F1 25, e decide se o numero e' USADO ou RESTA.

# PORQUEE ISTO E' O QUE FALTA
---------------------------

O painel mostra o `m_tyresWear` do F1 25 tal como vem, e o `receptor.py`
afirma num comentario que ele e' "0 a 100 com 100 = NOVO" -- ou seja, QUANTO
RESTA. Esse comentario nunca foi medido. E' a unica coisa em toda a cadeia
do F1 25 que decide o sentido de um numero que o piloto le, e nao ha' nada
que o confirme.

Um estado observado, com o jogo em pausa (valores do ultimo frame vivo):

    desgaste por roda   12,8   12,6    9,6   11,5
    vida do conjunto    23 voltas que faltam, de 26 usaveis

Duas leituras, e a aritmetica nao separa:

    se 12,8 e' QUANTO RESTA  ->  87% gasto, e o pneu estava a acabar
    se 12,8 e' QUANTO USOU   ->  87% de gauche, e ainda havia muito

Por isso nao se decide por conta. Decide-se conduzindo.

O QUE SEPARA, E E' MELHOR DO QUE UMA FOTOGRAFIA
------------------------------------------------

O MFD do jogo mostra uma percentagem, e uma fotografia resolvia. Mas o
`receptor.py` ja publica **outro** numero do mesmo pneu, com a direcao
declarada: o `m_lifeSpan` e' "VOLTAS QUE FALTAM" (linha 704). Se isso for
verdade, o `lifeSpan` **desce** a cada volta.

E nao se pode descer e subir ao mesmo tempo. Se o desgaste **sobe** enquanto
as voltas que faltam **descem**, so ha uma leitura possivel:

    desgaste = QUANTO USOU

Um numero de desgaste que sobe e um contador de vida que desce, no mesmo
pneu, na mesma volta, sao a mesma informacao vista de dois lados. E se
descerem os dois, e' o contrario: desgaste = quanto resta.

Isto e' melhor do que a fotografia por duas razoes:

  1. nao depende de o MFD estar legivel, nem de se ver a percentagem;
  2. **e' falsificavel pelos dois lados.** Se os dois numeros andarem para o
     mesmo lado, esta medicao esta errada -- e o `lifeSpan` nao e' o que o
     comentario diz. A experiencia tambem da a resposta, e nesse caso.

A fotografia do MFD fica como a segunda confirmacao, a que diz a MESMA
coisa por outra via. Concordancia entre as duas e' o que fecha a Regra.

O QUE FAZ
---------

Le o `/api/state` do servidor -- o F1 25 chega por UDP e nao pela memoria
partilhada, portanto nao ha' struct para mapear e nao ha' nada para
escrever (Regra no 1). A cada mudanca de volta guarda uma amostra e
imprime os dois numeros lado a lado.

Sem nada, cinco.

    python tests\medir_pneu_f125.py [voltas]

Sai com codigo 2 -- e nao 1 -- se o jogo nao estiver a conduzir. A pagina
fica congelada, e a "medicao" seria uma reta entre dois numeros velhos, que
e' exactamente o que nao se quer. O 2 e' o que o `medir_bandeira.py` ja usa
pelo mesmo motivo: 1 e' FALHA, e recusar de medir nao e' falha. A primeira
versao prometia 2 no texto e devolvia 1, que e' pior do que nao prometer
nada: quem le o valor passa a crer que a medicao foi tentada e falhou, em
vez de nunca ter comecado.

O `r` antes das aspas do docstring e' obrigatorio, e nao um detalhe: sem
ele o `\m` do caminho acima e' um escape invalido, e o Python avisa a cada
corrida sobre uma linha que nao tem nada de errado com a logica.
"""
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORTA = int(os.environ.get('ACTELEMETRY_PORTA', '8765'))
URL = 'http://127.0.0.1:%d/api/state' % PORTA
SAIDA = os.path.join(RAIZ, 'tests', 'pneu_f125.json')
AP = chr(39)


def recusa(mensagem):
    """Nao se pode medir. Sai com 2, e nao com 1.

    1 e' FALHA: o script correu e deu Wrong. 2 e' "a condicao nao se
    cumpre", e e' o codigo que o `medir_bandeira.py` ja usa. A
    distincao importa porque quem orchestration chama isto num `if` e
    trata o 2 como "agora nao", e o 1 como "isto esta' partido".
    """
    sys.stdout.write(mensagem.rstrip() + '\n')
    sys.exit(2)


def estado():
    try:
        with urllib.request.urlopen(URL, timeout=6) as f:
            return json.loads(f.read().decode('utf-8'))
    except urllib.error.URLError as e:
        recusa('  o servidor nao respondeu em %s: %s\n'
               '  Arrancar com INICIAR.bat antes de medir.' % (URL, e))
    except ValueError as e:
        raise SystemExit('  o servidor respondeu, mas nao em JSON: %s\n'
                         '  Isto e\' uma falha, nao uma recusa: o servidor esta\' a servir'
                         ' outra coisa nesse endereco.' % e)


def num(v):
    """Um numero, ou None. `None` nunca vira 0: ver a Regra no 19."""
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    return float(v) if v == v and v not in (float('inf'), float('-inf')) else None


def linha(v):
    return '     --  ' if v is None else '%7.1f  ' % v


# --- o jogo esta' a viver? -------------------------------------------
d = estado()
if not d.get('connected'):
    recusa('  o servidor diz que nao ha jogo ligado. Arranca-o.')
if d.get('estadoJogo') != 'a_correr':
    recusa("  o jogo esta' em %r, e nao a conduzir.\n"
'  O painel mostra o ultimo estado, congelado: medir aqui daria\n'
'  uma reta entre dois numeros velhos. Arranca uma sessao e vem\n'
'  quando o carro estiver em pista.'
% d.get('estadoJogo'))

# As chaves do payload nao estao escritas a mao. Este script tem de mostrar
# o que o jogo manda, e nao o que alguem lembrou que mandava -- que e' a
# Regra no 15 pelo avesso.
CHAVES = sorted(k for k in d if k.lower().startswith(('tyre', 'pneu', 'compound', 'lap', 'best', 'last')))
print('  o jogo esta a conduzir. As chaves que este script vai usar, e todas')
print('  as de pneu que o payload traz, sao estas:')
for k in CHAVES:
    v = d[k]
    if isinstance(v, list):
        v = '[' + '  '.join(str(x) for x in v) + ']'
    print('    %-22s %s' % (k, v))
print('')

for k in ('lap', 'tyreWear', 'tyreAge', 'tyreLifeMax'):
    if k not in d:
        recusa('  o payload nao tem %r. Sem ele esta medicao nao mede nada,\n'
               '  e o que falta e' + AP + ' a mudanca, nao a semantica do sinal.' % k)

try:
    VOLTAS = max(1, int(sys.argv[1])) if len(sys.argv) > 1 else 5
except ValueError:
    raise SystemExit('  o numero de voltas tem de ser um inteiro: %r' % (sys.argv[1],))

print('  %-6s  %-34s  %-10s  %-10s' % ('volta', 'desgaste por roda (FL FR RL RR)', 'que faltam', 'do conjunto'))
print('  ' + '-' * 74)

amostras = []
volta = int(num(d.get('lap')) or 0)
print('  %-6d  %s  %-10s  %-10s  (a espera da volta %d)'
      % (volta, ''.join(linha(num(v)) for v in (d.get('tyreWear') or [])),
         d.get('tyreAge'), d.get('tyreAge'), volta + 1))

t0 = time.time()
try:
    while True:
        time.sleep(0.25)
        d = estado()
        agora = int(num(d.get('lap')) or 0)
        if agora == volta:
            continue
        des = [num(v) for v in (d.get('tyreWear') or [])]
        reg = {
            'volta': agora,
            'desgaste': des,
            'queFaltam': num(d.get('tyreAge')),
            'vidaMax': num(d.get('tyreLifeMax')),
            'doConjunto': num(d.get('tyreConjuntoWear', d.get('pneuDesgasteConjunto'))),
            'composto': d.get('compound'),
            'emSegundos': round(time.time() - t0, 1),
        }
        amostras.append(reg)
        print('  %-6d  %s  %-10s  %-10s'
              % (agora, ''.join(linha(v) for v in des),
                 reg['queFaltam'], reg['doConjunto'] if reg['doConjunto'] is not None else '--'))
        volta = agora
        if len(amostras) >= VOLTAS:
            break
except KeyboardInterrupt:
    print('')
    print('  interrompido a meio. A conta abaixo e' + AP + ' feita com o que houve.')
except SystemExit:
    raise
except Exception as e:
    raise SystemExit('  a leitura falhou a meio: %s: %s' % (type(e).__name__, e))

# --- a conta ---------------------------------------------------------
print('')
print('  ' + '=' * 74)
if len(amostras) < 2:
    recusa("  so' se fechou uma volta. Nao ha sentido a medir, e escolher\n"
           '  um sentido sem duas amostras seria inventar.\n'
           '  Conduz pelo menos duas voltas sem trocar de pneu.')

# As diferencas entre a primeira e a ultima amostra, por roda. Medir no
# primeiro e no ultimo ponto e' o que interessa: o que aconteceu pelo meio,
# na sua totalidade, e nao um instante escolhido.
def taxa(chave, i):
    a, b = amostra(chave, i)
    if a is None or b is None:
        return None
    return b - a


def amostra(chave, i):
    ps = [r[chave][i] for r in amostras if r[chave] and i < len(r[chave]) and r[chave][i] is not None]
    if len(ps) < 2:
        return None, None
    return ps[0], ps[-1]


d_desg = [taxa('desgaste', i) for i in range(4)]
d_rest = taxa('queFaltam', 0)

print('  de %d para %d voltas, por roda:' % (amostras[0]['volta'], amostras[-1]['volta']))
for i in range(4):
    print('    %s  desgaste %+.1f' % ('FL FR RL RR'.split()[i], d_desg[i] if d_desg[i] is not None else float('nan')))
print('    voltas que faltam  %+.1f' % d_rest)

sobe = [x for x in d_desg if x is not None]
veredito = None
if not sobe:
    print('')
    print('  O DESGASTE NAO SE MEXEU. Nao ha resposta: um valor que nao muda')
    print('  durante %d voltas nao diz nada, e escolher um sentido asez' % len(amostras))
    print('  seria inventar. (Isto acontece se o jogo congela.)')
elif d_rest is not None and all(x > 0.5 for x in sobe) and d_rest < -0.5:
    print('')
    print('  O desgaste SOBE e as voltas que faltam DESCEM.')
    print('')
    print('    => o desgaste e\' QUANTO USOU.')
    print('       Um numero de desgaste que sobe e um contador de vida que desce,')
    print('       no mesmo pneu, sao a mesma informacao dos dois lados.')
    veredito = 'usado'
elif d_rest is not None and all(x < -0.5 for x in sobe) and d_rest > 0.5:
    print('')
    print('  O desgaste DESCE e as voltas que faltam SUBEM.')
    print('')
    print('    => o desgaste e\' QUANTO RESTA.')
    print('       E entao o `lifeSpan` NAO e\' "voltas que faltam", e o comentario')
    print('       da linha 704 do receptor.py esta errado pelo avesso.')
    veredito = 'resta'
else:
    print('')
    print('  Os dois numeros nao andaram em sentidos opostos, ou um deles')
    print('  ficou quieto. Nao da para decidir com isto, e a medicao fica por')
    print('  fazer -- ver `docs/f1-25.md`.')

print('')
print('  A CONFIRMACAO QUE FALTA, e que e\' a tua fotografia: o MFD do jogo')
print('  mostra a MESMA percentagem. Se o MFD disser 87 e o desgaste medido')
print('  estiver perto de 13, sao o mesmo numero com os dois sentidos, e')
print('  confirms "usado". Se o MFD disser 13 e o desgaste estiver perto de')
print('  13, confirma "resta".')
print('')
print('  as %d amostras ficaram em %s' % (len(amostras), SAIDA))
with io.open(SAIDA, 'w', encoding='utf-8') as f:
    json.dump({'veredito': veredito, 'voltas': amostras}, f, indent=1, ensure_ascii=False)
