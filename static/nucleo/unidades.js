/* Unidades, e so' unidades.
 *
 * As unidades sao a coisa que mais engana neste painel, e a razao de
 * ficarem aqui e nao em cada modulo de jogo: a CONVERSAO e' a mesma
 * para os dois, e o que muda e' o VALOR que entra. Um F1 25 manda o
 * combustivel em quilos e o bias de trava em percentagem; um AC manda
 * litros e uma fracao. A conta e' a mesma.
 *
 * O que este ficheiro NAO faz, e o que e' importante: nao decide o que
 * e' uma unidade. Quem decide e' o modulo do jogo, porque so' ele sabe
 * de que campo o numero veio. Aqui so' se converte.
 */
(function (global) {
  'use strict';

  const NUCLEO = (global.Nucleo = global.Nucleo || {});

  /* O tempo. O AC e o F1 25 mandam tempos em MILISSEGUNDOS, e ambos
   *Lead escrevem "M:SS.mmm" no ecra. A mesma funcao nos dois e' o que
   * evita um tempo que se mostra de duas maneiras -- e um tempo que se
   * mostra de duas maneiras e' um tempo que se compara mal.
   *
   * O "--" quando o valor nao serve e' deliberado: `null`, `0` e
   * `NaN` dao todos o mesmo resultado, e da-lo de outra forma seria
   * pintar "--" com um zero atras. */
  NUCLEO.ms = function (v) {
    const n = Number(v);
    if (!isFinite(n) || n <= 0) return '--:--.---';
    const m = Math.floor(n / 60000);
    const resto = n - m * 60000;
    const s = Math.floor(resto / 1000);
    return m + ':' + String(s).padStart(2, '0') + '.' +
      String(Math.floor(resto - s * 1000)).padStart(3, '0');
  };

  /* Um delta. A diferenca para `ms` e' o SINAL: um delta negativo
   * significa que estamos a GANHAR, e o painel pinta-o a verde. O
   * valor devolve-se em SEGUNDOS, com sinal, porque e' assim que a
   * conta do delta se faz. */
  NUCLEO.deltaSeg = function (ms) {
    const n = Number(ms);
    if (!isFinite(n) || n === 0) return null;
    return n / 1000;
  };

  NUCLEO.kmhParaMph = function (kmh) { return kmh / 1.609344; };
  NUCLEO.cParaF = function (c) { return c * 9 / 5 + 32; };
  NUCLEO.psiParaBar = function (psi) { return psi * 0.0689476; };

  /* Um valor, ou "--" quando nao se sabe.
   *
   * E' a funcao mais chamada do painel, e existe por causa da Regra no 19:
   * onde o jogo nao publica um dado, o valor chega a `null` e escreve-se
   * "--". Um zero e' um zero, e nao se confunde com "--". E' a diferenca
   * entre "sei que o ERS esta' a zero" e "nao se o que o ERS esta' a
   * fazer", e sao coisas que nao se escrevem igual. */
  NUCLEO.ou = function (v, s) {
    const n = Number(v);
    if (v === null || v === undefined || !isFinite(n)) return s || '--';
    return String(n);
  };

  /* A resposta a "mostrar este numero": o que se escreve, o que se pinta,
   * e o que se diz quando se passa o rato por cima.
   *
   * `pct` e' SEPARADO de `txt` de proposito, e esta e' a parte
   * importante. Ha' dois casos em que o painel escreve um numero e nao
   * consegue pintar uma barra:
   *
   *   - o numero existe mas o MAXIMO nao e' publicado. O ERS do F1 25
   *     manda o que esta' guardado, em joules, e nao diz quanto cabe. Um
   *     4 MJ fixo seria uma constante do jogo e nao um dado da
   *     telemetria, e um "100%" inventado e' pior do que uma barra sem
   *     numero ao lado;
   *   - o valor e' um ESTADO e nao uma quantidade. O ABS do F1 25 e'
   *     ligado ou desligado, e nao 0% a 100%, e o TC e' um modo (off,
   *     medio, cheio). Escrever "ABS 100%" seria inventar um numero que o
   *     jogo nao da -- e no AC essa percentagem e' a verdade, porque ali
   *     `abs` e' o nivel a que o sistema esta' a trabalhar.
   *
   * Nesses casos `pct` fica `null`, e uma barra a meio com um numero ao
   * lado seria uma barra que mente sobre o que se sabe. */
  NUCLEO.Metrica = function (txt, pct, dica) {
    return { txt: (txt === undefined || txt === null) ? '--' : String(txt),
             pct: (pct === undefined) ? null : pct,
             dica: dica || '' };
  };

  /* "Nao se sabe". E' diferente de zero, e por isso e' uma funcao e nao
   * um valor: `Nulo()` marca com `semDados: true`, e e' essa marca que
   * impede o painel de pintar uma barra vazia como se fosse um zero
   * honesto. E o que a Regra no 19 pede: um zero e' plausivel e ninguem
   * o questiona, e por isso a distincao tem de viajar com o valor. */
  NUCLEO.Nulo = function (dica) {
    return { txt: '--', pct: null, dica: dica || '', semDados: true };
  };


  /* Mesma coisa, mas com casas decimais. `nulo` e' separado de `0.0`
   * porque o `ou(0, 0)` tem de dar "0" e nao "--". */
  NUCLEO.ouN = function (v, casas, s) {
    const n = Number(v);
    if (v === null || v === undefined || !isFinite(n)) return s || '--';
    return n.toFixed(casas === undefined ? 1 : casas);
  };

  /* Clamp, porque um valor de telemetria pode chegar a 120% e uma barra
   * com 120% e' pior do que uma barra sem valor. */
  NUCLEO.limita = function (v, a, b) {
    const n = Number(v);
    if (!isFinite(n)) return a;
    return n < a ? a : n > b ? b : n;
  };

  global.NucleoUnidades = NUCLEO;
})(typeof globalThis !== 'undefined' ? globalThis : this);
