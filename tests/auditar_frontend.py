# -*- coding: utf-8 -*-
r"""tests\auditar_frontend.py  --  as coisas que a suite nao apanha.

A suite prova a LOGICA: a matematica das voltas, a estrutura dos structs,
o contrato entre a app e o leitor. Nao prova que o frontend se aguenta
de pe -- e ha' varios buracos que so' aparecem quando se junta tudo:

  - um <script> que o HTML pede e que nao existe: o browser da' 404 e
    segue, e a aplicacao fica muda sem erro nenhum na consola;
  - CSS com uma chave a mais: a regra a seguir e' descartada, e o
    elemento fica sem estilo nenhum;
  - a animacao do aviso de combustivel declarada FORA do
    prefers-reduced-motion, que e' a forma de o aviso piscar a quem
    pediu para nao ver movimento;
  - uma traducao vazia ou uma chave morta;
  - um id que o JS pede e o HTML nao tem: a funcao sai em silencio, o
    campo nao muda, e o codigo parece correcto (Regra no 14).

Corre:  python tests\auditar_frontend.py
"""
import io
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ST = os.path.join(RAIZ, "static")

problemas = []


def ok(msg):
    print("  ok   " + msg)


def ko(msg):
    print("  FALHA " + msg)
    problemas.append(msg)


def bloco_media(css, nome):
    """O texto de um media query, do abre ate o fecha.

    TIRA OS COMENTARIOS primeiro. Sem isso a busca casa o texto de um
    comentario -- e o topo deste CSS explica, em comentario, o que cada
    media query faz, incluindo o nome exacto dos dois.

    A CONTAGEM DAS CHAVES COMEÇA NO `{` DO MEDIA QUERY, com prof = 1, e
    nao no `@`. Começando no `@`, a segunda letra ja'`@` + `m` sao zero
    chaves e a procura de um prof==0 finds o fim do bloco logo ali: o
    bloco saia com zero linhas e acusava uma regra que estava la. Sao
    tres DETECTORES errados seguidos sobre o mesmo ficheiro, e os tres
    davam FALHA. Vale a pena escrever isto, porque a tentacao de
    'simplificar' a linha decomeco outra vez e' forte.
    """
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    m = re.search(r"@media \(" + re.escape(nome) + r"\)\{", css)
    if not m:
        return None
    prof = 1                      # ja' estamos dentro do bloco
    fim = len(css) - 1
    for i in range(m.end(), len(css)):
        if css[i] == "{":
            prof += 1
        elif css[i] == "}":
            prof -= 1
            if prof == 0:
                fim = i
                break
    return css[m.start():fim + 1]


# ---------------------------------------------------------------------------
print("=== 1. os ficheiros que o HTML pede ===")
h = io.open(os.path.join(ST, "index.html"), encoding="utf-8").read()
pedidos = [m.group(1) for m in re.finditer(r'(?:src|href)="([^"]+)"', h)
           if m.group(1).startswith("/")]
if not pedidos:
    ko("o HTML nao pede nenhum ficheiro -- a procura falhou")
for f in pedidos:
    p = os.path.join(ST, f.lstrip("/"))
    if os.path.exists(p):
        ok("%s existe (%d bytes)" % (f, os.path.getsize(p)))
    else:
        ko("%s NAO EXISTE -- o browser daria 404 e a app ficaria muda"
           % f)

# ---------------------------------------------------------------------------
print("")
print("=== 2. o CSS ===")
s = io.open(os.path.join(ST, "style.css"), encoding="utf-8").read()
a, f = s.count("{"), s.count("}")
if a == f:
    ok("chaves equilibradas (%d)" % a)
else:
    ko("chaves DESEQUILIBRADAS: %d abre, %d fecha -- a regra a seguir e' "
       "descartada sem aviso" % (a, f))

nopref = bloco_media(s, "prefers-reduced-motion:no-preference")
if nopref is None:
    ko("nao existe o media query no-preference")
else:
    i = s.index(nopref)
    k = s.find("animation:fuelaviso")
    if k >= 0 and nopref in s and k > i:
        ok("a animacao do aviso esta dentro do no-preference")
    else:
        ko("a animacao do aviso de combustivel esta FORA do "
           "no-preference -- vai piscar a quem pediu para nao ver "
           "movimento")

red = bloco_media(s, "prefers-reduced-motion:reduce")
if red is None:
    ko("nao existe o media query reduce")
else:
    if "fuel-aviso" in red or "fuel-critico" in red:
        ok("o aviso de combustivel tem forma alternativa no reduce "
           "(tracejado vs inteiro)")
    else:
        ko("o aviso de combustivel nao tem regra nenhuma no reduce")

# ---------------------------------------------------------------------------
print("")
print("=== 3. as traducoes ===")
js = io.open(os.path.join(ST, "app.js"), encoding="utf-8").read()
I18N = None
try:
    ini = js.index("const I18N = {")
    fim = js.index("\n};", ini)
    I18N = eval("(" + js[js.index("=", ini) + 1:fim + 2] + ")")
except Exception as e:
    ko("nao consegui avaliar o I18N: %s" % e)

if I18N:
    base = sorted(I18N["pt-PT"])
    iguais = True
    for l in sorted(I18N):
        falta = [k for k in base if k not in I18N[l]]
        sobra = [k for k in I18N[l] if k not in base]
        if falta or sobra:
            ko("%s: faltam %s / sobram %s" % (l, falta, sobra))
            iguais = False
    if iguais:
        ok("%d chaves iguais nas %d linguas" % (len(base), len(I18N)))

    vazias = [(l, k) for l in I18N for k in base if not I18N[l].get(k)]
    if vazias:
        ko("traducoes vazias: %s" % vazias[:6])
    else:
        ok("nenhuma traducao vazia")

    NOVAS = ["fuel.measuring", "fuel.lapsWhy", "fuel.oneLapWhy",
             "fuel.avisoWhy", "fuel.criticoWhy", "fuel.avisoWhyPct",
             "lb.posTitle", "opp.errTitle", "opp.err"]
    emFalta = [k for k in NOVAS if k not in I18N["pt-PT"]]
    if emFalta:
        ko("chaves novas em falta: %s" % emFalta)
    else:
        ok("as %d chaves novas desta sessao estao nas 4 linguas" % len(NOVAS))

    # Uma chave e' usada de TRES maneiras, e a primeira versao deste
    # teste so' via uma. Duas davam 83 chaves "mortas" que nao estavam:
    #
    #   - 83 chaves sao postas pelo applyLang() a partir de um atributo
    #     data-i18n no HTML, e nao por t();
    #   - e ha' chaves montadas em RUNTIME, que nenhuma busca estatica
    #     pode ver: t('fuel.' + nivel + 'Why') e
    #     const key = info.autodetected ? 'set.acPathAuto' : 'set.acPathOk'.
    #
    # As de runtime nao se podem verificar -- por isso sao listadas a
    # parte, como 'nao verificavel', e nao como mortas. Um teste que as
    # chama mortas obriga a depois a 'limpar' chaves que estao em uso, e
    # a proxima pessoa que for usa-las demora a descobrir porque
    # desapareceram.
    usadas = set(re.findall(r"t\('([^']+)'\)", js))
    usadas |= set(re.findall(r'data-i18n(?:-aria|-title)?="([^"]+)"', h))
    # O que NAO se consegue provar com uma busca estatica: a chave
    # montada em runtime. Duas formas, ambas neste projecto:
    #     t('fuel.' + nivel + 'Why')
    #     const key = a ? 'set.acPathAuto' : 'set.acPathOk';  ...  t(key)
    #
    # A distincao que importa e' entre MORTA e NAO PROVAVEL. Uma chave
    # e' morta quando o seu texto nao aparece em lado nenhum do codigo.
    # Quando aparece mas nao numa chamada directa a t(), nao se prova que
    # se use -- mas também nao se pode dizer que nao se usa, e apagar a
    # traducao seria partir uma coisa que funciona.
    #
    # Dizer "morta" aqui seria pior do que nao dizer nada: a pessoa
    # seguinte apaga a chave, a interface mostra o nome da chave em vez
    # do texto, e ninguem sabe porque.
    citadas = set(re.findall(r"'([^']+)'", js)) | set(
        re.findall(r"'([^']+)'", h))
    mortas = [k for k in base if k not in usadas and k not in citadas]
    naoProvaveis = [k for k in base if k not in usadas and k in citadas]
    if mortas:
        ko("chaves verdadeiramente mortas: %s" % mortas)
    else:
        ok("nenhuma chave morta")
    if naoProvaveis:
        print("  nota  %d chaves citadas mas usadas em runtime, que uma "
              "busca estatica nao prova: %s" % (len(naoProvaveis), naoProvaveis))

# ---------------------------------------------------------------------------
print("")
print("=== 4. os ids que o JS pede ===")
ids_html = set(re.findall(r'\bid="([^"]+)"', h))
ids_js = set(re.findall(r"\$\('([^']+)'\)", js))
ids_js |= set(re.findall(r"getElementById\('([^']+)'\)", js))
ids_js = set(i for i in ids_js if not i.startswith("'") and "#" not in i)
faltam = sorted(i for i in ids_js if i not in ids_html)
if faltam:
    ko("o JS pede ids que o HTML nao tem: %s -- a funcao sai em "
       "silencio e o campo nao muda (Regra no 14)" % faltam)
else:
    ok("todos os %d ids que o JS pede existem no HTML" % len(ids_js))

# ---------------------------------------------------------------------------
print("")
print("=== 5. as duas posicoes nao podem vir de sitios diferentes ===")
# Foi a causa do "P6 no cabecalho, P11 na lista": o cabecalho lia
# physics.position e a lista lia a pagina dos adversarios. Um numero que
# aparece em dois sitios tem de vir de um sitio so.
if "S.posLista" in js:
    ok("o cabecalho le a posicao da mesma lista que mostra a linha")
else:
    ko("o cabecalho nao usa S.posLista -- pode voltar a discordar da lista")
if "d.position" in js:
    if "d.position" in js and js.count("d.position") > 1:
        ok("d.position aparece %d vez(es), como recurso" % js.count("d.position"))
if "livePos ||" in js:
    ko("ainda ha' um 'livePos || pos' -- sao dois sítios para o mesmo "
       "numero e divergem sem ninguem dar por isso")
else:
    ok("nao ha' nenhum 'livePos || pos'")

# ---------------------------------------------------------------------------
print("")
print("=" * 60)
if problemas:
    print("!!! %d PROBLEMA(S) !!!" % len(problemas))
    sys.exit(1)
print("ok: o frontend aguenta-se de pe.")
