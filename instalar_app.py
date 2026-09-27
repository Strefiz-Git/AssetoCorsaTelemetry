# -*- coding: utf-8 -*-
"""Instala a app dentro do Assetto Corsa, com o `ctypes` certo.

PORQUE ISTE SCRIPT EXISTE

A app mete `stdlib64/` a frente do `sys.path` para carregar o `ctypes` do
JOGO, e nao o do sistema. O comentario dela diz que sem isso a struct
fica com o tamanho errado.

Os `_ctypes.pyd` NAO estao no git. Um `git archive` do repositorio traz
dois ficheiros em `python_app/actelemetry_strefiz/` e nenhuma pasta
`stdlib`. E o `.gitignore` apanha-os por ACCIDENTE: `*.py[cod]`, e o
`[cod]` inclui o `d` de `.pyd`.

Ou seja: quem faz clone e copia a pasta a mao fica com a proteccao
exactamente a ausente que o comentario proibe, e sem um unico sinal --
porque uma entrada de `sys.path` que nao existe e' ignorada em silencio
pelo Python. A app agora VERIFICA o que carregou e avisa no log; este
script e' a outra metade, que resolve em vez de avisar.

DE ONDE VEM O `_ctypes.pyd`

Nao esta' em `apps/python/system/` -- la so' ha' o `acsys.py` e uma
pasta `setup`. O AC traz o Python embebido, e cada app do Content
Manager que precisa do ctypes certo traz **o seu proprio exemplar** numa
pasta `stdlib`/`stdlib64` ao lado.

Confirmado nesta instalacao: o exemplar do SimHub, o do `sol_weather` e
o nosso temem todos o SHA-256

    A5C393C03D48430E74768DE97E0B1598FA087F624FB5B142A567A3E54E2ED853

e' o mesmo ficheiro. Por isso a busca e' por qualquer app vizinho, e nao
por um caminho fixo que dependa da versao do Content Manager.

O QUE ESTE SCRIPT NAO FAZ

Nao toca nas paginas de memoria partilhada do jogo, e nao mexe em
nada de `content/`. Copia so' a nossa pasta para
`apps/python/actelemetry_strefiz/`, que e' a pasta que o jogo carrega.

    python instalar_app.py            instala
    python instalar_app.py --verificar  so' diz o que esta em falta
"""
import argparse
import hashlib
import os
import shutil
import sys

RAIZ = os.path.dirname(os.path.abspath(__file__))
FONTE = os.path.join(RAIZ, 'python_app', 'actelemetry_strefiz')
DESTINO_REL = os.path.join('apps', 'python', 'actelemetry_strefiz')

# o que tem de ir para o jogo, e o que e' nosso
FICHEIROS_NOSSO = ('actelemetry_strefiz.py', 'actelemetry_shm.py')


def cor(*partes):
    """Imprime. Aceita varias partes porque metade das linhas se escreve
    em duas, quando a segunda e' uma concatenacao com `chr(39)` para
    meter um apostrofo dentro de um texto em aspas."""
    sys.stdout.reconfigure(encoding='utf-8')
    print(''.join(str(p) for p in partes))


def caminho_do_ac():
    """Reusa a deteccao do server.py, que ja' varre as pastas da Steam."""
    sys.path.insert(0, RAIZ)
    import server
    caminho, automatico = server._current_ac_path()
    if caminho and server._is_ac_root(caminho):
        return caminho, automatico
    caminho = server.autodetect_ac_path()
    if caminho and server._is_ac_root(caminho):
        return caminho, True
    return caminho, automatico


def sha(caminho):
    h = hashlib.sha256()
    with open(caminho, 'rb') as f:
        for bloco in iter(lambda: f.read(65536), b''):
            h.update(bloco)
    return h.hexdigest()


def achar_ctypes(ac_path, sub):
    """Procura o `_ctypes.pyd` em qualquer app do Content Manager.

    NAO fica pelo primeiro que encontrar: VOTA.

    Medido nesta instalacao, a pasta `apps/python/` tem seis apps com
    `_ctypes.pyd` dentro, e eles nao sao iguais:

        A5C393C0...   SimHub, sol_config, sol_custom_weather,
                      sol_planner, sol_weather          (cinco apps)
        5CDAA693...   RacelabLib                        (um so)

    Os dois tem 108 032 bytes, e diferem em 65 355 -- 60,5% do
    ficheiro. Nao e' uma data nem um bit de versao: sao compilacoes
    diferentes.

    Escolher pelo primeiroalfabeticamente dava `RacelabLib`, que e'
    **o dissidente**. E' a Regra nº 11 pelo avesso: uma amostra que nao
    consegue discordar. `RacelabLib` e' a unica que discorda, e
    perder por ser a primeira da lista e' exactamente a maneira de
    escolher mal sem dar por isso.

    Por isso: recolhe todos, agrupa por hash, e escolhe o maior grupo.
    Quando nao há maioria, diz que nao ha' -- melhor pedir-se o ficheiro
    a mao do que escolher o binario errado em silencio.

    Devolve (caminho, de_quem, acordo, [(hash, [apps...])]).
    """
    base = os.path.join(ac_path, 'apps', 'python')
    if not os.path.isdir(base):
        return None, None, 0, []

    candidatos = []
    for app in sorted(os.listdir(base)):
        p = os.path.join(base, app, sub, '_ctypes.pyd')
        if os.path.isfile(p):
            candidatos.append((p, app, sha(p)))

    # a nossa propria pasta conta, mas sem voto: e' o que esta a instalar
    for p, app, h in candidatos:
        if app == 'actelemetry_strefiz':
            candidatos.remove((p, app, h))
            break

    if not candidatos:
        return None, None, 0, []

    grupos = {}
    for p, app, h in candidatos:
        grupos.setdefault(h, {'caminhos': [], 'apps': []})
        grupos[h]['caminhos'].append(p)
        grupos[h]['apps'].append(app)

    resumo = sorted(((h, g['apps']) for h, g in grupos.items()),
                    key=lambda kv: -len(kv[1]))
    melhor_h, melhor_apps = resumo[0]
    n = len(candidatos)
    if len(melhor_apps) * 2 <= n:
        # nao ha' maioria: dois binarios diferentes com o mesmo peso
        return None, None, 0, resumo

    return grupos[melhor_h]['caminhos'][0], melhor_apps[0], len(melhor_apps), resumo


def estado(ac_path, sub):
    """O que falta, para o modo --verificar."""
    problemas = []
    destino = os.path.join(ac_path, DESTINO_REL)

    for f in FICHEIROS_NOSSO:
        if not os.path.isfile(os.path.join(FONTE, f)):
            problemas.append('o projecto nao tem %s' % f)
        if not os.path.isfile(os.path.join(destino, f)):
            problemas.append('o jogo nao tem %s' % f)

    pyd = os.path.join(destino, sub, '_ctypes.pyd')
    if not os.path.isfile(pyd):
        problemas.append('falta o _ctypes.pyd em %s -- e' % sub
                         + ' a proteccao que a struct precisa')
    return problemas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--verificar', action='store_true',
                    help='nao escreve nada; diz o que falta')
    ap.add_argument('--ac', help='pasta do Assetto Corsa, se a auto-'
                                  'deteccao falhar')
    args = ap.parse_args()

    cor('', '=' * 62)
    cor('', ' Assetto Corsa Telemetry -- instalar a app no jogo')
    cor('', '=' * 62)
    cor('', '')

    ac_path = args.ac
    automatico = False
    if not ac_path:
        ac_path, automatico = caminho_do_ac()
    if not ac_path or not os.path.isdir(ac_path):
        cor('', '  NAO ENCONTREI o Assetto Corsa.' if not ac_path
            else '  A pasta %s nao parece um Assetto Corsa.' % ac_path)
        cor('', '  Indica a pasta a mao:')
        cor('', '      python instalar_app.py --ac "D:\\...\\assettocorsa"')
        return 1
    cor('  Jogo     : %s%s' % (ac_path, '  (detectado)' if automatico else ''))
    cor('  Projecto : %s' % RAIZ)
    cor('', '')

    # --- 64 ou 32 bits, como a app decide -----------------------
    import platform
    if platform.architecture()[0] == '64bit':
        sub = 'stdlib64'
    else:
        sub = 'stdlib'
    cor('  Python   : %d bits, pasta %s' % (64 if sub == 'stdlib64' else 32, sub))
    cor('', '')

    if args.verificar:
        problemas = estado(ac_path, sub)
        if not problemas:
            cor('  Tudo no sitio. A app esta instalada e com o ctypes certo.',
                '')
            cor('', '')
            return 0
        cor('  FALTA:', '')
        for p in problemas:
            cor('    - %s' % p, '')
        cor('', '')
        cor('  Para instalar:  python instalar_app.py', '')
        return 1

    destino = os.path.join(ac_path, DESTINO_REL)
    os.makedirs(destino, exist_ok=True)

    # --- os .py -------------------------------------------------
    for f in FICHEIROS_NOSSO:
        origem = os.path.join(FONTE, f)
        alvo = os.path.join(destino, f)
        shutil.copy2(origem, alvo)
        cor('  copiado  %s' % f, '')

    # --- o ctypes ------------------------------------------------
    pyd_destino = os.path.join(destino, sub, '_ctypes.pyd')
    os.makedirs(os.path.dirname(pyd_destino), exist_ok=True)

    origem, de_quem, acordo, grupos = achar_ctypes(ac_path, sub)
    if origem is None:
        cor('', '')
        cor('  NAO ENCONTREI um _ctypes.pyd para a pasta %s,' % sub, '')
        if grupos:
            cor('  ou encontrei versoes diferentes sem maioria:', '')
            for h, apps in grupos:
                cor('    %s...  %s' % (h[:16], ', '.join(apps)), '')
            cor('', '')
            cor('  Copia a mao o de uma app que ja' + chr(39) + ' funcione, para', '')
            cor('    %s' % os.path.join(destino, sub, '_ctypes.pyd'), '')
        else:
            cor('  Onde se vai buscar, a mao:', '')
            cor('    %s' % os.path.join(ac_path, 'apps', 'python'))
            cor('  Procura <qualquer app>\\%s\\_ctypes.pyd' % sub, '')
        return 1

    shutil.copy2(origem, pyd_destino)
    cor('  copiado  %s\\_ctypes.pyd  (de %s; %d app(es) concordam)'
        % (sub, de_quem, acordo), '')
    for h, apps in grupos:
        if len(apps) > 1:
            cor('             %s... tambem em: %s'
                % (h[:16], ', '.join(apps)), '')
        else:
            cor('             %s... SO em: %s -- discordante, ficou de fora'
                % (h[:16], apps[0]), '')

    # a outra architecture tambem, se a houver -- serve para quem
    # testem a mesma instalacao noutro sistema
    outro = 'stdlib' if sub == 'stdlib64' else 'stdlib64'
    origem_outro, de_quem_outro, _, _ = achar_ctypes(ac_path, outro)
    if origem_outro:
        d2 = os.path.join(destino, outro)
        os.makedirs(d2, exist_ok=True)
        shutil.copy2(origem_outro, os.path.join(d2, '_ctypes.pyd'))
        cor('  copiado  %s\\_ctypes.pyd  (de %s, para o outro Python)'
            % (outro, de_quem_outro), '')

    cor('', '')
    cor('  _ctypes.pyd, como ficou instalado:', '')
    cor('    de     %s' % origem, '')
    cor('    sha256 %s' % sha(pyd_destino), '')
    cor('', '')

    # --- confirmar ----------------------------------------------
    problemas = estado(ac_path, sub)
    if problemas:
        cor('', '  AINDA FALTA:', '')
        for p in problemas:
            cor('    - %s' % p, '')
        return 1

    cor('  Instalado. Agora so falta ligar no Content Manager:', '')
    cor('    Settings -> Python Apps ->-actelemetry_strefiz -> Start', '')
    cor('', '')
    cor('  E depois ligar o servidor, com INICIAR.bat.', '')
    cor('', '')
    return 0


if __name__ == '__main__':
    sys.exit(main())
