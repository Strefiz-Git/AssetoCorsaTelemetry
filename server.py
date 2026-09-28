"""
Telemetria do Assetto Corsa e do F1 25.

Este ficheiro e' so' a linha de comando. O trabalho esta' em
`actelemetry/`, e o que esta aqui e' o que o utilizador ve no terminal --
que jogo esta' activo, a que horas se le, e como fechar o servidor.

    python server.py                  -> escolhe o jogo nas definicoes
    python server.py --jogo f125      -> F1 25
    python server.py --jogo ac        -> Assetto Corsa
    python server.py --porta 9000
    python server.py --abrir          -> abre o browser

O nucleo (em `actelemetry/`) nao sabe qual e' o jogo: ele pede um leitor ao
registo de `actelemetry/jogos/` e le dicionarios. Por isso acrescentar um
terceiro jogo e' um modulo novo, e nao uma alteracao ao servidor.
"""

import argparse
import sys
import threading
import time

from actelemetry import __version__, defs, hub as hub_mod, http, jogos


def main():
    ap = argparse.ArgumentParser(
        description="Painel de telemetria do Assetto Corsa e do F1 25")
    ap.add_argument("--porta", "--port", type=int, default=8765, dest="porta",
                    help="porta HTTP (preguicosa: --porta)")
    ap.add_argument("--jogo", choices=list(jogos.ORDEM), default=None,
                    help="forca um jogo, sem gravar nas definicoes")
    ap.add_argument("--rate", type=int, default=200,
                    help="amostras por segundo a ler do jogo")
    ap.add_argument("--abrir", action="store_true",
                    help="abre o browser quando o servidor ja esta a ouvir")
    ap.add_argument("--bind", default="0.0.0.0",
                    help="endereco a que se liga. 0.0.0.0 e' a rede toda; "
                         "127.0.0.1 so' neste PC")
    args = ap.parse_args()

    # A precedencia e' deliberada: a linha de comando ganha sobre as
    # definicoes, porque quem a escreve esta' a ver o que faz. E nao se
    # grava: `--jogo f125` e' para experimentar, e nao para trocar o
    # painel dePermanente sem dar conta.
    jogo = args.jogo or defs.jogo_escolhido()
    if not jogo:
        jogo = jogos.PADRAO

    hub = hub_mod.Hub(jogo_id=jogo, rate_hz=args.rate)
    hub.start()
    http.Handler.hub = hub

    srv = http.Servidor((args.bind, args.porta), http.Handler)
    srv.daemon_threads = True

    _ecra_inicial(hub, args, srv.server_address[1])

    if args.abrir:
        def abrir():
            time.sleep(0.2)
            try:
                import webbrowser
                webbrowser.open("http://localhost:%d/" % args.porta)
            except Exception:
                pass          # sem browser registado no sistema: nao e' fatal
        threading.Thread(target=abrir, daemon=True).start()

    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nparado.")
    finally:
        hub.stop()
        srv.shutdown()
    return 0


def _ecra_inicial(hub, args, porta):
    """O que se mostra no terminal ao arrancar.

    O que importa aqui e' que o texto diga a instrucao do JOGO QUE ESTA
    ACTIVO. No AC, sem a app instalada nao ha' adversarios; no F1 25, sem o
    UDP ligado nao ha' nada. Sao instrucoes completamente diferentes, e
    trocar uma pela outra e' a forma mais rapida de perder a confianca de
    quem esta' a tentar usar isto.
    """
    jogo = hub.jogo
    diag = hub.diagnostico()
    ip = http.lan_ip()
    so_local = args.bind in ("127.0.0.1", "localhost", "::1")

    print("=" * 60)
    print("  Telemetria  \u2014  %s" % (jogo.nome if jogo else "?"))
    print("=" * 60)
    if so_local:
        print("  Neste PC : http://localhost:%d/" % porta)
        print("  Nao aceita ligacoes de fora. Para as aceitar:")
        print("    python server.py --bind 0.0.0.0 --porta %d" % porta)
    else:
        print("  Neste PC : http://localhost:%d/" % porta)
        print("  Rede     : http://%s:%d/" % (ip, porta))
        print()
        print("  AVISO: qualquer pessoa na mesma rede pode ver os teus")
        print("  dados de telemetria e mudar as definicoes em")
        print("  /api/definicoes. Nao ha palavra-passe. Numa rede de casa")
        print("  ou de trabalho isso e' aceitavel; numa rede de hotel,")
        print("  de cafetaria ou de faculdade, nao.")
        print("  Para fechar: python server.py --bind 127.0.0.1 --porta %d" % porta)

    if diag.get("erro"):
        print()
        print("  AVISO: %s" % diag["erro"])
    if diag.get("instrucao"):
        print("  %s" % diag["instrucao"])
    if diag.get("nota"):
        print("  %s" % diag["nota"])
    if diag.get("porta"):
        print("  UDP: a escutar na porta %d" % diag["porta"])
    print("  leitura : %d amostras/s" % args.rate)
    print("  versao  : %s" % __version__)
    print("  Ctrl+C para parar")
    print("=" * 60)


if __name__ == "__main__":
    sys.exit(main())
