# -*- coding: utf-8 -*-
"""
Verifica que o snapshot() sobrevive a campos NAO FINITOS.

O AC publica infinito em varios campos quando a sessao nao tem limite de
tempo. Isso chegou a rebentar o /api/state inteiro:

    OverflowError: cannot convert float infinity to integer

E nao era um caso raro: era sempre, em qualquer treino ou qualifying sem
cronometro -- ou seja, o painel ficava cego exactamente quando se esta' a
treinar. Este script le a memoria a serio, se o jogo estiver vivo, e
confirma que nao ha' nenhum valor nao finito a passar.

Corre com o jogo aberto (e' leitura, nunca escrita -- Regra nº 1).
"""
import math
import sys

sys.path.insert(0, ".")
sys.stdout.reconfigure(encoding="utf-8")
import acshm  # noqa: E402


def nao_finito(x):
    return isinstance(x, float) and (math.isnan(x) or math.isinf(x))


def main():
    print("a ler a telemetria...")
    d = acshm.ACTelemetry().snapshot()
    if d.get("error"):
        print("FALHA: o proprio snapshot rebentou: %s" % d["error"])
        return 1
    print("o snapshot passou. connected=%s live=%s pista=%s"
          % (d.get("connected"), d.get("live"), d.get("track")))
    print("sessionLeft = %r  (None = sem limite de tempo, o que e' correto)"
          % d.get("sessionLeft"))
    print()

    print("--- todos os campos, a procura de nao-finitos ---")
    maus = []
    for k, v in sorted(d.items()):
        vals = v if isinstance(v, list) else [v]
        for i, x in enumerate(vals):
            if nao_finito(x):
                maus.append("%s[%s] = %r" % (k, i, x) if isinstance(v, list)
                            else "%s = %r" % (k, x))
    if not maus:
        print("  nenhum. Todos os valores sao finitos.")
    else:
        print("  %d valor(es) nao finito(s) a passar para o browser:" % len(maus))
        for m in maus:
            print("    " + m)
        print()
        print("  Isto nao rebenta o panel, mas o browser recebe NaN/Infinity,")
        print("  que o JSON nao representa. Vale a pena investigar cada um.")
        return 1

    print()
    print("--- os inimigos classicos: os tempos em ms ---")
    for k in ("currentTime", "bestTime", "lastTime", "sessionLeft",
              "lastSectorTime", "penaltyTime"):
        v = d.get(k)
        print("  %-18s %r" % (k, v))
    print()
    print("OK: o snapshot sobrevive e nao ha' nao-finitos a passar.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
