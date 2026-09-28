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
    # Todos os alertas que PISCAM, e nao so' o do combustivel. Cada um
    # com a sua animacao, porque cada um tem o seu nome -- e a razao de
    # ser uma lista e nao uma busca solta: quando se acrescenta um
    # alerta novo, esta lista e' o que lembra de o meter aqui. Sem ela,
    # o alerta novo entra a piscar para quem pediu para nao ver
    # movimento, e ninguem da por isso.
    #
    # Os dois motivos que podem falhar sao diferentes e os dois Here:
    # a animacao nao existe (o alerta ficou sem nada) ou esta FORA do
    # no-preference (vai piscar a quem nao quer).
    for nome, decl in (("combustivel", "animation:fuelaviso"),
                       ("DRS na carta", "animation:drscarta")):
        k = s.find(decl)
        if k < 0:
            ko("o piscar do %s nao existe no CSS -- o alerta desapareceu" % nome)
        elif k > i:
            ok("o piscar do %s esta dentro do no-preference" % nome)
        else:
            ko("o piscar do %s esta FORA do no-preference -- vai piscar a "
               "quem pediu para nao ver movimento" % nome)

# A REGRA GERAL, e nao so' os dois alertas nomeados acima
#
# Ate aqui a auditoria so' verificava DUAS animacoes pelo nome. O
# `check_acessibilidade.js` -- que corre no browser, colado na consola --
# faz a conta geral: quantas animacoes infinitas estao declaradas, e
# alguma delas esta fora de um bloco `prefers-reduced-motion`. E' a regra
# 2.3.3.
#
# O problema e' que essa conta geral nao corria na suite, porque precisa
# do DOM. E uma regra que so se pode correr com o browser e' uma regra
# que ninguem corre. Acrescentada aqui, acusou QUATRO animacoes que
# estavam a correr para quem pediu para nao ver movimento:
#
#     .spinner               a roda do arranque
#     .wide-btn.mark.on      o pulso do botao que marca a posicao
#     .drs.avail             a caixa do DRS
#     .drs.avail .drs-dot    o ponto do DRS
#
# As duas do DRS eram as mais sérias, porque a carta inteira e o
# combustivel -- feitos na mesma sessao, para o mesmo fim -- estavam bem
# feitos dentro do no-preference. A zona de DRS era a unica a ficar de
# fora, e por isso era a unica a piscar para quem nao quer.
#
# Aqui a mesma regra em forma ESTATICA, que e' melhor do que a do
# browser: apanha a animacao sem a folha estar ligada e sem a pagina
# aberta. E' o que permite ao `mutacao_acessibilidade.py` entrar na
# suite, coisa que antes era impossivel.
#
# DOIS ERROS QUE A PRIMEIRA VERSAO DESTA REGRA TEVE, ambos sobre a MESMA
# coisa: contar as chavetas noutro texto.
#
#   - media o texto SEM COMENTARIOS. As linhas desse texto nao sao as
#     linhas do ficheiro, e o browser le o ficheiro COM os comentarios.
#     Resultado: acusava seis animacoes legitimas, cujas linhas nao
#     correspondiam a nada.
#   - media so' o PRIMEIRO bloco no-preference. Ha' dois neste CSS --
#     um para o DRS, outro para o combustivel -- e o combustivel estava
#     no segundo. Resultado: as animacoes do combustivel davam por
#     fora do bloco.
#
# Por isso a contagem e' feita no texto tal e qual, e sobre TODOS os
# blocos.


def _blocos_media(css, condicao):
    """(inicio, fim) de cada bloco @media que casa `condicao`."""
    acc = []
    for m in re.finditer(r"@media \(" + re.escape(condicao) + r"\)\{", css):
        prof = 1
        for k in range(m.end(), len(css)):
            if css[k] == "{":
                prof += 1
            elif css[k] == "}":
                prof -= 1
                if prof == 0:
                    acc.append((m.start(), k))
                    break
    return acc


_np = _blocos_media(s, "prefers-reduced-motion:no-preference")
infinitas = list(re.finditer(r"animation(-name)?\s*:[^;}]*infinite", s))
dentro = [m for m in infinitas if any(a < m.start() < b for a, b in _np)]
fora = [m for m in infinitas if m not in dentro]
if not fora:
    ok("as %d animacoes infinitas estao todas dentro de um no-preference"
       % len(infinitas))
else:
    for m in fora:
        ln = s[:m.start()].count("\n") + 1
        ko("animacao INFINITA fora do no-preference, linha %d do CSS: %r "
           "-- a regra 2.3.3" % (ln, m.group(0)[:44]))
    ok("(%d de %d dentro; ha' %d bloco(s) no-preference, e ha' que os "
       "contar todos)" % (len(dentro), len(infinitas), len(_np)))


red = bloco_media(s, "prefers-reduced-motion:reduce")
if red is None:
    ko("nao existe o media query reduce")
else:
    if "fuel-aviso" in red or "fuel-critico" in red:
        ok("o aviso de combustivel tem forma alternativa no reduce "
           "(tracejado vs inteiro)")
    else:
        ko("o aviso de combustivel nao tem regra nenhuma no reduce")
    if "drs-alert" in red:
        ok("o alerta do DRS tem forma alternativa no reduce")
    else:
        ko("o alerta do DRS nao tem regra nenhuma no reduce -- quem nao "
           "quer movimento fica sem qualquer aviso de que ha' zona")

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
             "lb.posTitle", "opp.errTitle", "opp.err",
             "wx.rain", "wx.rainTitle", "wx.rainUnknown",
             "tyres.gripWhat",
             # As do tempo. Substituem a antiga `wx.dry`, que era um
             # "seco" solto, por uma cena por banda da escala do jogo.
             "wx.seco", "wx.chiada", "wx.chiadaForte", "wx.chuvaFraca",
             "wx.chuva", "wx.chuvaForte", "wx.neve", "wx.trovoada",
             "wx.trovoadaForte", "wx.furacao", "wx.topoDoCartao"]
    emFalta = [k for k in NOVAS if k not in I18N["pt-PT"]]
    if emFalta:
        ko("chaves novas em falta: %s" % emFalta)
    else:
        ok("as %d chaves novas desta sessao estao nas 4 linguas" % len(NOVAS))

    # Uma chave e' usada de QUATRO maneiras, e as primeiras versoes deste
    # teste viam menos. Duas davam 83 chaves "mortas" que nao estavam:
    #
    #   - 83 chaves sao postas pelo applyLang() a partir de um atributo
    #     data-i18n no HTML, e nao por t();
    #   - ha' chaves montadas em RUNTIME, que nenhuma busca estatica pode
    #     ver: t('fuel.' + nivel + 'Why') e
    #     const key = info.autodetected ? 'set.acPathAuto' : 'set.acPathOk';
    #   - e ha' chaves que vivem numa TABELA, escritas como texto simples
    #     e passadas ao t() depois: a lista CENAS do tempo tem
    #     { limiar: 0.001, chave: 'wx.chiada' }, e o t(c.chave) que a
    #     segue nao deixa rasto nenhum para uma busca estatica.
    #
    # A tabela e' o caso novo, e apareceu porque a lista do tempo trocou
    # um texto solto por catorze cenas -- e o teste passou a acusar catorze
    # chaves mortas que estavam em uso. Nao se corrigiu com uma lista de
    # excecoes, que e' o que se fez com as de runtime e que envelhece sem
    # ninguem dar por isso: procura-se a chave em qualquer string do
    # ficheiro.
    #
    # As de runtime continuam a nao se poder verificar, e sao listadas a
    # parte, como 'nao verificavel'. Um teste que as chama mortas obriga
    # a depois a 'limpar' chaves que estao em uso.
    usadas = set(re.findall(r"t\(\s*['\"]([^'\"]+)['\"]", js))
    usadas |= set(re.findall(r'data-i18n(?:-aria|-title)?="([^"]+)"', h))
    # a chave numa tabela: `chave: 'tal'` ou `chave = "tal"`
    usadas |= set(re.findall(r"chave\s*[:=]\s*['\"]([^'\"]+)['\"]", js))
    # E A QUE VEM DE OUTRO FICHEIRO, com o prefixo juntado depois.
    #
    # As catorze cenas do tempo vivem em `static/tempo.js`, e o `app.js`
    # escreve `t('wx.' + cena)`. Para uma busca estatica isso e' uma
    # concatenacao em runtime, e a resposta normal seria meter as catorze
    # na lista de 'nao provavel' -- que e' o mesmo que nao as vigiar.
    #
    # Mas elas SAO verificaveis, porque o `tempo.js` tem os sufixos
    # literalmente: `{ limiar: 0.001, chave: 'chiada' }`. Logo a chave
    # `wx.chiada` conta como usada se e' `chave: 'chiada'` no modulo. E
    # a DIFFERENCA entre 'nao provavel' e 'provavel por outra via': estas
    # catorze continuam vigiadas, e se uma delas desaparecer do modulo
    # este teste acusa.
    # Os MODULOS PUROS, que vivem em `static/nucleo/`.
    #
    # Estecodigo estava escrito para um ficheiro so, `static/tempo.js`, e o
    # nome estava HARD-CODED. Quando os modulos puros foram para
    # `nucleo/`, o ficheiro desapareceu deste sitio, `os.path.exists`
    # deu falso, e o teste passou a accusing catorze chaves do tempo de
    # mortas -- com o `wx.seco` e' etc. em uso, dentro do modulo que tinha
    # acabado de mudar de pasta.
    #
    # E' a forma mais enganadora de um teste falhar: a CAUSA e' uma mudanca
    # de pasta, o SINTOMA e' "ha' catorze chaves mortas", e a reacao
    # natural -- que e' a que eu tive -- e' ir ao `app.js` apagar a
    # traducao. Isso parte uma coisa que funciona, e o problema real
    # (o caminho) fica exactamente igual. A Regra no 9 outra vez: a
    # mensagem nao apontava para a causa.
    #
    # Por isso agora varre-se a PASTA, e nao um ficheiro. E a razao de o
    # fazer assim e nao apontar para `nucleo/tempo.js`: um ficheiro novo em
    # `nucleo/` com uma tabela de chaves tem de ser visto sem que este
    # teste saiba o nome dele. Um teste que grownece para cada ficheiro
    # novo e' um teste que alguem vai esquecer de actualizar.
    # E o mesmo para static/jogos/, onde vivem as regras de cada jogo.
    #
    # As chaves de um modulo de jogo sao escritos no modulo e traduzidas
    # no pp.js, na hora de as pintar. Uma busca estatica no pp.js
    # nao as ve -- e sem esta linha o teste acusava dezenove chaves mortas
    # que estavam em uso, todas do genero 1.absDica. E o mesmo
    # problema pelo mesmo motivo, e a correccao e' a mesma: varrer a pasta
    # em vez de um ficheiro.
    nucleo = os.path.join(ST, "nucleo")
    entradas = []
    for pasta in (nucleo, os.path.join(ST, "jogos")):
        if not os.path.isdir(pasta):
            continue
        for n in sorted(os.listdir(pasta)):
            if n.endswith(".js"):
                entradas.append(os.path.join(pasta, n))
    if not entradas:
        ko("a pasta static/nucleo/ nao existe ou esta' vazia. A matematica "
           "partilhada pelos dois jogos vive la, e sem ela nao ha' o que "
           "testar sem browser")
    cenas = 0
    for caminho in entradas:
        nome = os.path.basename(caminho)
        txt = io.open(caminho, encoding="utf-8").read()
        # a chave numa tabela: `chave: 'tal'`
        sufixos = re.findall(r"chave\s*:\s*'([^']+)'", txt)
        if nome == "tempo.js":
            cenas += len(sufixos)
            usadas |= set("wx." + x for x in sufixos)
        # e as chaves escritas por extenso, para qualquer modulo poder
        # usar a mesma convencao sem ficar dependente do `tempo.js`
        usadas |= set(re.findall(r"'((?:ac|f1|jog|drs|abs|tyres)\.\w+)'", txt))
    if os.path.isdir(nucleo):
        if cenas < 10:
            ko("o nucleo/tempo.js so' da' %d cenas; eram 14. A lista de "
               "cenas encolheu sem ninguem dar por isso" % cenas)
        else:
            ok("as %d cenas do tempo estao em nucleo/tempo.js" % cenas)
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

# --- os ids montados com um prefixo ---------------------------------
# O app.js desenha varias coisas NAS DUAS VISTAS, e faz isso com um
# laco: `for (const pfx of ['', 'b-']) setTxt(pfx + 'wx-rain', ...)`. Uma
# busca de ids literais nao ve nenhuma dessas -- e foi assim que o
# b-wx-rain faltou no modo misto sem ninguem dar por isso, a mesma
# classe do map-drs-key2.
#
# A busca e' por `prefixo + 'literal'`, e verifica-se que existem as
# DUAS versoes. Sem o segundo, o laco desenha metade e a outra metade
# fica vazia em silencio.
#
# Os prefixos sao os que aparecem no proprio laco do app.js, e nao uma
# lista escrita aqui: se um dia mudar o prefixo, muda-se la e este
# teste ve.
prefijos = []
for m in re.finditer(r"for \(const (\w+) of \[([^\]]*)\]\)", js):
    for pref in re.findall(r"'([^']*)'", m.group(2)):
        prefijos.append((m.group(1), pref))

n_pref = 0
for var, pref in prefijos:
    for m in re.finditer(re.escape(var) + r" \+ '([^']*)'", js):
        lit = m.group(1)
        # So' interessam os que viram ID. `pfx + ' button'` e' uma
        # classe e nao um id -- a primeira versao acusava a falta de um
        # elemento chamado " button". E `id + '-u'` e' um SUFIXO de um id
        # que ja'e completo, nao um id novo: a expansao de
        # 'b-wx-rain' + '-u' e' 'b-wx-rain-u', e nao 'b-' + '-u', que da
        # 'b--u'. Os sufixos tem a sua verificacao, em baixo.
        if not lit or " " in lit or lit.startswith("-"):
            continue
        n_pref += 1
        falta = [p + lit for p in ("", "b-") if p + lit not in ids_html]
        if falta:
            ko("o laco desenha o id %r nas duas vistas, mas falta(m): %s"
               % (lit, falta))
if n_pref:
    ok("%d ids escritos com prefixo, todos existem nas duas vistas" % n_pref)
else:
    print("  nota  nao encontrei ids com prefixo -- a procura mudou?")

# --- os ids DERIVADOS de um id ja prefixado --------------------------
# `pintarChuva(id)` recebe o id JA prefixado e pede o da unidade com
# `$(id + '-u')`. A expansao correcta de 'b-wx-rain' + '-u' e'
# 'b-wx-rain-u' -- e nao 'b-' + '-u', que daria 'b--u'.
#
# A PRIMEIRA VERSAO dsta verificacao procurava `id(...)` -- ou seja, uma
# CHAMADA a `id`, que nunca acontece: `id` e' um parametro, e quem o
# recebe e' pintarChuva. A procurar nao encontrava origem nenhuma, o
# laco nao corria nenhuma vez, e a verificacao passava SEM VER NADA --
#Inclusive depois de eu apagar o id do HTML a proposito para a testar.
# Foi a unica forma de o descobrir: fazer a mutacao e ver se accuses.
#
# Agora: acha-se a funcao que FAZ o id derivado, e depois os sítios onde
# ela e' chamada.
n_der = 0
der_problemas = 0
for fm in re.finditer(r"function (\w+)\(([^)]*)\)\s*\{", js):
    nome, params = fm.group(1), fm.group(2)
    corpo = js[fm.end():fm.end() + 2000]
    for dm in re.finditer(r"\$\((\w+) \+ '([^']+)'\)", corpo):
        param, sufixo = dm.group(1), dm.group(2)
        if param not in params.split(","):
            continue
        # onde e' que esta funcao e' chamada com um id prefixado?
        for cm in re.finditer(r"\b" + re.escape(nome)
                              + r"\((\w+) \+ '([^']*)'", js):
            lit = cm.group(2)
            if " " in lit:
                continue
            n_der += 1
            falta = [p + lit + sufixo for p in ("", "b-")
                     if p + lit + sufixo not in ids_html]
            if falta:
                der_problemas += 1
                ko("o id derivado %r+%r (de %s) falta: %s"
                   % (lit, sufixo, nome, falta))
# O "ok" so' quando nao houve nenhuma. Imprimir os dois ao mesmo tempo
# -- uma FALHA e um ok logo a seguir -- e' a forma de um relatório
# ficar ambíguo, e quem o lê depressa só vê o ultimo.
if n_der and not der_problemas:
    ok("%d ids derivados, todos existem nas duas vistas" % n_der)
elif not n_der:
    print("  nota  nao encontrei ids derivados -- a procura mudou?")

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
print("=== 6. MOJIBAKE: uma ida e volta pelo PowerShell ===")
# Aconteceu nesta sessao, e a um ficheiro com a meta charset="utf-8" e
# texto correcto. O PowerShell 5.1 le com a codificacao do sistema, nao
# UTF-8: cada byte vira dois caracteres Latin-1, e sao gravados em UTF-8
# outra vez.
#
#     o 'í' (0xC3 0xAD)  ->  U+00C3 U+00AD
#
# O ficheiro CONTINUA A DECODIFICAR como UTF-8. Por isso nenhuma
# verificacao de sintaxe o apanha, nenhum browser mostra um erro, e a
# pagina fica com 'combustA-vel' no sitio de 'combustível' sem dizer
# nada. O que o apanha e' ler o texto.
#
# O QUE DISTINGUE. Nao e' a letra: e' o caractere a SEGUIR. 'Ã' e' uma
# letra portuguesa legitima -- o ficheiro tem 'MÃO' no travão de mão --
# e uma guarda que procure 'Ã' acusa um ficheiro perfeitamente limpo.
# Ja aconteceu, e o resultado foi quase restaurar uma versao boa por
# causa disso.
#
#     Ã seguida de letra, espaco, ou nada  ->  a letra Ã
#     Ã seguida de pontuacao ou controlo    ->  mojibake
MOJIBAKE = re.compile("[ÃÂâ][\u0080-¿­]")
# Os ficheiros de teste entram na lista porque dois deles TEM BOM, e
# ninguem os apanhou. A forma como se descobriu foi a mais honesta
# possível: nao foi uma verificação, foi um `git diff` a mostrar 82
# linhas alteradas onde se tinham acrescentado 8. A verificação que
# devia ter dito algo nao dizia, porque o problema nao era encoding.
Ficheiros = ["static/index.html", "static/app.js", "static/style.css",
             "acshm.py", "AGENTS.md", "README.md",
             "tests/test_acshm.py", "tests/test_layout.py",
             "tests/auditar_frontend.py", "tests/run_all.py"]
for caminho in Ficheiros:
    p2 = os.path.join(RAIZ, caminho)
    if not os.path.exists(p2):
        continue
    # O BOM primeiro, e em BYTES. Um BOM antes do <!DOCTYPE> e' a mesma
    # classe de dano do mojibake e pela mesma razao nao aparece: o
    # ficheiro continua a decodificar, o Python continua a aceitar, e o
    # browser continua a mostrar a pagina. Ficam os os ficheiros que o
    # PowerShell escreve com 'Out-File -Encoding utf8'.
    tem_bom = io.open(p2, "rb").read(3) == b"\xef\xbb\xbf"
    # 'utf-8-sig' em vez de 'utf-8': se o BOM estiver la, o 'utf-8'
    # punha-lo no primeiro U+FEFF do texto e a busca do mojibake
    #-passava a ler a partir de uma posicao errada.
    txt = io.open(p2, encoding="utf-8-sig").read()
    m = MOJIBAKE.search(txt)
    if tem_bom:
        ko("BOM no inicio de %s -- o PowerShell escreveu-o e nada o "
           "apanha: o ficheiro continua a decodificar" % caminho)
    if m:
        i = m.start()
        ko("MOJIBAKE em %s, perto de: %r"
           % (caminho, txt[max(0, i - 25):i + 12]))
    if not tem_bom and not m:
        ok("%s sem BOM e sem mojibake" % caminho)

# e os acentos que tem de estar: uma lista de palavras ENVELHECE, e ja
#peaker de uma: 'travão' foi posto aqui sem estar no ficheiro, e a
# verificacao acusou um ficheiro limpo. As de baixo foram confirmadas
# uma a uma antes de ficarem.
sentinela = io.open(os.path.join(ST, "index.html"),
                    encoding="utf-8").read()
perdidas = [w for w in ("combustível", "Classificação", "MÃO",
                        "definições", "Voltas")
            if w not in sentinela]
if perdidas:
    ko("palas acentuadas que o index.html devia ter e nao tem: %s"
       % perdidas)
else:
    ok("os acentos do index.html estao todos no sitio")

print("")
print("=" * 60)
if problemas:
    print("!!! %d PROBLEMA(S) !!!" % len(problemas))
    sys.exit(1)
print("ok: o frontend aguenta-se de pe.")
