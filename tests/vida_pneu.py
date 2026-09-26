# -*- coding: utf-8 -*-
"""
Verifica a estimativa da vida do pneu com dados REAIS de uma sessao a
correr, usando a mesma matematica do static/tyres.js.

Nao e' um teste de unidade -- e' a confirmacao de que a medida bate com o
que acontece. Corre enquanto se conduz.

  python tests\\vida_pneu.py 90 1
"""
import json
import math
import sys
import time
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

MIN_POR_VOLTA = 0.05
SALTO_DE_VIDA = 2


def estado():
    r = urllib.request.urlopen("http://localhost:8765/api/state", timeout=8)
    return json.loads(r.read().decode())


def estimar(estado, compound, volta, restante):
    """A mesma matematica do static/tyres.js, em Python."""
    if (estado is None or estado["compound"] != compound
            or volta < estado["lap0"]
            or restante >= estado["restanteUlt"] + SALTO_DE_VIDA):
        return {"compound": compound, "lap0": volta,
                "restante0": restante, "restanteUlt": restante}, None
    voltas = volta - estado["lap0"]
    novo = {"compound": compound, "lap0": estado["lap0"],
            "restante0": estado["restante0"], "restanteUlt": restante}
    if voltas < 1:
        return novo, None
    por_volta = (estado["restante0"] - restante) / voltas
    if por_volta < MIN_POR_VOLTA:
        return novo, None
    return novo, {"voltas": restante / por_volta, "porVolta": por_volta,
                  "voltasNoStint": voltas}


def main():
    segundos = float(sys.argv[1]) if len(sys.argv) > 1 else 90.0
    hz = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0

    d = estado()
    if not d.get("live"):
        print("O jogo nao esta' a correr. Nao ha' stint para medir.")
        return 1

    print("pista %s | composto %r | volta %s" % (d["track"], d["compound"], d["lap"]))
    print("a medir durante %.0f s -- conduz." % segundos)
    print()
    print("%-6s %-5s %-9s %-10s %-9s %-9s %s"
          % ("volta", "t", "restante", "por volta", "faltam", "restante", "origem"))
    print("-" * 74)

    st = None
    t0 = time.time()
    ultima = None
    while time.time() - t0 < segundos:
        try:
            d = estado()
        except Exception:
            time.sleep(0.3)
            continue
        if not d.get("live"):
            time.sleep(0.3)
            continue
        # o resto do pneu e' 100 - usado. O 'usado' vem com 2 casas
        # decimais e o 'restante' com 1: para MEDIR, o usado e' melhor.
        usado = d.get("tyreWearUsed") or []
        if len(usado) < 4 or any(u is None for u in usado):
            time.sleep(1.0 / hz)
            continue
        restante = 100.0 - min(usado)
        volta = d.get("lap")
        st, est = estimar(st, d.get("compound") or "", volta, restante)
        linha = (volta, round(time.time() - t0, 1), restante,
                 round(est["porVolta"], 2) if est else "-",
                 math.floor(est["voltas"]) if est else "-",
                 round(100 - min(usado), 2), "")
        if linha != ultima:
            print("%-6s %-5s %-9.3f %-10s %-9s %-9s %s" % linha)
            ultima = linha
        time.sleep(1.0 / hz)

    print()
    if st and est:
        print("Medido: %d voltas de stint a %.2f%% por volta." %
              (est["voltasNoStint"], est["porVolta"]))
        print("Faltam ~%d voltas de vida a este ritmo." % math.floor(est["voltas"]))
        print()
        print("Isto e' extrapolacao linear a partir do que ja aconteceu. Se")
        print("aguentar a pista toda a este ritmo, o numero bate. Travar mais")
        print("ou sujar a pista muda a taxa, e o numero muda com ela.")
    else:
        print("Ainda nao ha' medidas suficientes (precisa de 2 voltas de stint).")
        print("O sitio escreve 'a medir' ate la -- de proposito.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
