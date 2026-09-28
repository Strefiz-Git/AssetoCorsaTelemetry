# -*- coding: utf-8 -*-
"""Regenera a tabela de testes do AGENTS.md a partir do run_all.py.

A ARVORE, QUE MUDOU
---------------------
Os modulos puros do browser estao em `static/nucleo/` (a matematica que e' igual nos dois jogos) e os modulos de jogo em `static/jogos/` (as regras de cada um). O `app.js` e' o frontend e nao tem regras de jogo dentro.

A tabela diz o que cada teste prova, e e' a parte do AGENTS.md que mais
se desatualiza: cresce de everytime que se acrescenta um teste, e ninguem
a reescreve porque ninguem a le para fazer testes. Citava doze ficheiros
quando a pasta tinha quarenta e cinco.

O QUE NAO E' AUTOMATICO, E PORQUE

A coluna "o que prova" esta escrita a mao, e e' a parte que importa. Um
script que a gerasse a partir do nome do ficheiro reduziria a tabela a
uma lista de nomes, e uma lista de nomes nao ensina ninguem nada. O que
se gera aqui e' so a **lista**, com o texto de cada um vindo de um mapa
que mora no proprio script -- para a lista e' sempre correcta e o texto
so' precisa de ser mantida aqui.

E' a divisao que o projecto ja usa: `test_contrato.py` verifica a
estrutura, o AGENTS.md explica porque. Um script nao sabe porque e' que
um teste existe.
"""
import io
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AG = os.path.join(RAIZ, 'AGENTS.md')
RUN = os.path.join(RAIZ, 'tests', 'run_all.py')

# o que cada teste prova, e a parte humana
DESCRICAO = {
    "test_layout.py": "os 3 structs, campo a campo (60 + 30 + 42)",
    "test_acshm.py": "a leitura de telemetria, 46 valores com unidades",
    "mutacao_grip.py": "que a regra da aderencia morde, partindo o codigo",
    "test_opponents.py": ("o struct de 128 carros: ordem dos campos, m/s para "
                          "km/h, tempos, filtro de carros vazios"),
    "compilar.py": ("que os `.py` compilam -- apanha erro de sintaxe"),
    "verificar_js.py": "que os 20 `.js` fazem parse no node",
    "test_contrato.py": "que a app e o leitor falam a mesma linguagem",
    "verificar_servidor.py": ("o SISTEMA ligado: arranca com os dois "
                              "jogos, a troca a quente, e as rotas"),
    "test_handler.py": "que um cliente que cancela nao enche a consola",
    "test_payload.py": ("que o `/api/state` tem o que o painel precisa, "
                        "clima incluido -- o meio da ligacao"),
    "test_f125_parser.py": ("o F1 25 nos DOIS formatos: os 33 tamanhos, a ordem "
                            "das rodas, o truque dos minutos, o /1000 das "
                            "forcas G, e o formato desconhecido recusado"),
    "test_jogos.js": ("as regras dos dois jogos no browser: embraiagem, ABS, "
                      "vida do pneu, combustivel, clima, delta e as 81 "
                      "capacidades -- sem nenhum jogo a correr"),
    "test_tempos.js": "35 casos de tempos e delta, sem browser",
    "test_tyres.js": "a vida do pneu e a escala dos valores",
    "test_combustivel.js": "voltas de combustivel e a percentagem",
    "auditar_frontend.py": ("o frontend inteiro: ids, traduccoes, contraste, "
                            "chaves CSS, movimento reduzido"),
    "verificar_html.py": ("que o HTML fecha, que cada ecra e' filho do "
                          "<body> e nao de outro ecra, e que o ecra de "
                          "espera tem saida -- o que ninguem media"),
    "mutacao_html.py": ("que essa verificacao morde: um `</div>` comido, o "
                        "botao da espera apagado, e o botao fora do ecra"),
    "mutacao_acessibilidade.py": "que a regra 2.3.3 morde, partindo o CSS",
    "mutacao_rodape.py": "que o rodape' nao fica a dizer o jogo errado",
    "verificar_finitos.py": "que nenhum valor chega a NaN ou infinito",
    "test_mutation.py": "que os testes de cima falham quando o codigo esta partido",
    "mutacao_contrato.py": "que o contrato entre a app e o leitor e' mesmo verificado",
    "test_loop_app.py": "que o loop da app nao engole uma excepcao",
    "mutacao_loop.py": "que esse teste morde, partindo o loop",
    "test_tempo.js": ("104 casos de clima, com os limiares das 37 cenas do "
                      "Pure Planner e o eixo do vento"),
    "test_defs.js": ("o esquema das definicoes: so' entra o que esta' "
                         "declarado, e a reposicao mantem a vista e o idioma"),
    "test_medir_tyrewear.py": "que a medicao do desgaste por volta faz sentido",
    "verificar_readme.py": ("que cada facto do README bate certo com o "
                              "codigo -- versao, porta, cadencia, nomes, escalas"),
    "mutacao_texto.py": ("que a regra do TAB dentro de uma palavra "
                            "morde, partindo o AGENTS.md"),
    "verificar_texto.py": "que nao entrou texto torto nem caracteres estranhos",
    "verificar_commits.py": "que as mensagens de commit nao tem BOM nem caracteres estranhos",
    "test_scripts.js": ("que os scripts que o index.html lista chegam ao "
                        "browser, e que cada global lido sem guarda e' "
                        "escrito -- sem browser, e sem executar nada"),
}

# o que corre FORA da suite, e porque
FORA = {
    "test_tempos.html": "os mesmos casos de tempos, para abrir no browser",
    "check_layout.js": "medidas no browser, para colar na consola",
    "check_acessibilidade.js": ("as 5 regras de acessibilidade, no browser. A "
                                "regra 2.3.3 tambem esta na `auditar_frontend.py`, "
                                "em forma estatica, e e' essa que a suite usa"),
    "verificar_combustivel.py": "precisa do jogo a correr e do deposito a descer",
    "mapa.py": "grava um trajecto conduzido e desenha o mapa",
    "mapa_todas_pistas.py": "mede o `map.ini` das 76 pistas",
    "forma_mapa.py": "desenha as duas formas de transformar o mapa, para comparar",
    "clima.py": "lista os campos do `acshm` e procura mais candidatos a clima",
    "chuva.py": "compara a memoria antes e depois de mudar o tempo, campo a campo",
    "tamanho_real.py": "mede o tamanho real das paginas. O resultado fica registado de proposito",
    "probe_layout.py": "despeja os valores e procura grupos de 4 -- a assinatura de uma temperatura",
    "diff_offsets.py": "compara duas leituras para achar um offset deslocado",
    "verify_real.py": "os valores reais, so' com o jogo aberto",
    "diag_drs.py": "agrupa o que encontra no canal SSE, para nao concluir de duas amostras",
    "capturar.py": "grava a serie de N segundos num JSON",
    "analisar.py": "responde as perguntas sobre essa serie",
    "medir_tyrewear.py": "mede a queda do desgaste por volta, a conduzir",
    "vida_pneu.py": "a vida do pneu a partir de uma serie ja gravada",
    "caixa.py": "a cinemática da caixa e as reacções",
    "run_all.py": "NAO E' UM TESTE -- e' o que corre todos os outros, por ordem",
    "tabela_testes.py": "NAO E' UM TESTE -- e' o que escreve esta tabela",
}


def main():
    run = io.open(RUN, encoding='utf-8').read()
    grupos = re.findall(r'\("([^"]+)",\s*"(\w+)",\s*"([^"]+)"\)', run)
    if not grupos:
        raise SystemExit('  nao encontrei os grupos da suite')

    pasta = os.path.join(RAIZ, 'tests')
    no_disco = set(f for f in os.listdir(pasta)
                   if f.endswith(('.py', '.js', '.html')) and not f.startswith('_'))

    linhas = []
    for _, tipo, ficheiro in grupos:
        desc = DESCRICAO.get(ficheiro)
        if desc is None:
            raise SystemExit('  sem descricao para %r -- escreve uma' % ficheiro)
        # Sem coluna a parte. Uma coluna que fica vazia em vinte das
        # vinte e tres linhas nao e' uma coluna, e' ruido -- e o que
        # interessava dizer (que precisa do node) cabe em tres letras
        # no fim da frase.
        if tipo == 'node':
            desc += ' (node)'
        linhas.append('| `%s` | %s |' % (ficheiro, desc))

    citados = {g[2] for g in grupos}
    fora = []
    for f in sorted(no_disco - citados):
        f = f.strip()
        if f in DESCRICAO:
            desc = DESCRICAO[f]
        elif f in FORA:
            desc = FORA[f]
        else:
            desc = '**sem descricao** -- escreve uma'
        fora.append('| `%s` | %s |' % (f, desc))

    tabela = [
        '### A suite',
        '',
        'Corre com `python tests\\run_all.py`. Sai com codigo diferente de zero se',
        'algo falhar, e com codigo 2 (que nao e' + chr(39) + ' falha) se o AC',
        'estiver a correr e os testes de memoria forem saltados. Sao %d grupos.'
        % len(grupos),
        '',
        '| Ficheiro | O que prova |',
        '|---|---|',
    ] + linhas + [
        '',
        '### Fora da suite, e porque',
        '',
        'Estes correm a mao porque **precisam de uma condicao que a suite',
        'nao cria**: o jogo aberto, o browser, ou uma serie ja gravada. Nao e',
        'esquecimento -- e' + chr(39) + ' que um teste que precisa do jogo para',
        'correr tambem nao prova nada quando o jogo nao esta a abrir.',
        '',
        '| Ficheiro | Porque e' + chr(39) + ' a mao |',
        '|---|---|',
    ] + fora

    # substituir a secao actual
    s = io.open(AG, encoding='utf-8').read()
    i = s.find('### A suite')
    if i < 0:
        raise SystemExit('  nao encontrei "### A suite" no AGENTS.md')
    j = s.find('\n## ', i)
    if j < 0:
        raise SystemExit('  a secao da suite nao tem fim -- ha' + chr(39) + ' '
                         'nenhum "## " depois dela')

    s = s[:i] + '\n'.join(tabela) + '\n' + s[j:]

    if '**sem descricao**' in '\n'.join(tabela):
        raise SystemExit('  ha' + chr(39) + ' um ficheiro sem descricao; '
                         'acrescenta-o ao script antes de correr outra vez')

    io.open(AG, 'w', encoding='utf-8', newline='').write(s)
    print('  a tabela passou de 12 para %d na suite e %d fora dela'
          % (len(grupos), len(fora)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
