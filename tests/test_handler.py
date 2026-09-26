# -*- coding: utf-8 -*-
"""
Teste do Servidor: um cliente que cancela a ligacao nao pode encher a
consola de traceback.

PORQUE ISTO EXISTE
------------------
Reiniciar o servidor com o browser aberto enchia a consola com quatro
ou cinco ConnectionAbortedError (WinError 10053), um traceback completo
por cada ligacao cancelada. O servidor estava bem; o socketserver imprime
o erro todo porque nao sabe que um cliente que se vai embora e' normal.

Onde a correccao tem de estar e' o ponto deste teste. A primeira
tentativa foi posta no Handler, com try/except a volta do handle() e do
handle_one_request(). NAO FUNCIONOU - 6 tracebacks de 6 - porque o
socketserver apanha a excepcao em process_request_thread, que fica
ACIMA de qualquer try dentro do handle(), e chama handle_error. O
Handler nunca via o erro. Este teste foi o que dixitou isso.

Este teste mede a REGRA, nao o HTTP: chama o handle_error com cada
excepcao e ve o que sai. E' deterministico - uma versao anterior tentou
subir um servidor de verdade e contar as threads, e dava 0 nos dois
casos porque as threads escribiam no stderr depois de a captura estar
fechada. Um teste que "passa" sem provar nada e' pior do que nenhum.

Verificado tambem a serio, a mao: reiniciar o servidor com o browser
aberto nao escreve nada no stderr.
"""
import io
import os
import socketserver
import sys
import traceback
from contextlib import redirect_stderr

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8")

import server as srv


def erro_de(classe, excecao):
    """Invoca o handle_error da classe com a excecao dada e devolve o que
    saiu no stderr. E' este o caminho que o socketserver percorre quando
    uma ligacao morre a meio.

    A instancia e' criada sem o constructor: o __init__ do TCPServer
    abre o socket, e aqui nao se quer um servidor nenhum, so a regra."""
    instancia = object.__new__(classe)
    capturado = io.StringIO()
    try:
        raise excecao
    except BaseException:
        with redirect_stderr(capturado):
            instancia.handle_error(None, ("127.0.0.1", 51249))
    return capturado.getvalue()


def main():
    problemas = []

    # --- 1) o que o cliente cancela tem de ser calado ------------------
    silenciosos = [
        ConnectionAbortedError(10053, "aborted by host"),
        ConnectionResetError(104, "reset by peer"),
        BrokenPipeError(32, "broken pipe"),
        ConnectionError("qualquer coisa de ligacao"),
        TimeoutError("tempo esgotado"),
    ]
    for exc in silenciosos:
        saida = erro_de(srv.Servidor, exc)
        if saida.strip():
            problemas.append("%s devia ser silencioso, mas imprimiu %d linhas"
                             % (type(exc).__name__, len(saida.splitlines())))

    # --- 2) um erro a serio tem de continuar a aparecer -----------------
    # Se engolisse tudo, um bug verdadeiro passava despercebido.
    falados = [
        (AttributeError("'NoneType' object has no attribute 'get'"), "AttributeError"),
        (ValueError("valor estragado"), "ValueError"),
        (RuntimeError("o hub morreu"), "RuntimeError"),
    ]
    for exc, nome in falados:
        saida = erro_de(srv.Servidor, exc)
        if "Traceback" not in saida:
            problemas.append("%s devia imprimirse (um erro a serio nao se "
                             "esconde), e nao imprimiu nada" % nome)
        if nome not in saida:
            problemas.append("o traceback de %s nao traz o nome da excecao" % nome)

    # --- 3) a contra-prova: o comportamento original faz barulho -------
    #
    # Se o handle_error original NAO imprimisse nada, o teste acima
    # estaria a medir uma coisa que nunca existiu e nao provava nada.
    for exc in silenciosos[:2]:
        original = erro_de(socketserver.BaseServer, exc)
        if "Traceback" not in original:
            problemas.append(
                "a contra-prova falhou: o handle_error original tambem nao "
                "imprimiu nada para %s, por isso o cenario nao reproduz o "
                "problema" % type(exc).__name__)

    # --- 4) o que se queria silenciar tem mesmo de ser o que acontece -
    # Confirma-se que as classes listadas sao mesmo as do erro real, e
    # nao outros parecidos.
    reais = [ConnectionAbortedError, ConnectionResetError, BrokenPipeError]
    for cls in reais:
        if cls not in srv.Servidor.DESLIGUE_ESPERADO:
            problemas.append("%s devia estar em DESLIGUE_ESPERADO" % cls.__name__)

    print()
    if problemas:
        print("!!! %d PROBLEMA(S) !!!" % len(problemas))
        for p in problemas:
            print("  - %s" % p)
        return 1

    print("OK: %d tipos de ligacao cortada ficam em silencio, e %d erros a"
          % (len(silenciosos), len(falados)))
    print("    serio continuam a aparecer com o traceback completo.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
