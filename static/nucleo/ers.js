/* O ERS, e o facto de um dos jogos NAO dizer quanto cabe.
 *
 * Puro: sem DOM, sem estado, sem temporizadores. Corre no node e e'
 * testado em `tests/test_ers.js`, porque a decisao "percentagem ou
 * joules" e' a que se errou, e uma decisao que so' se prova no ecra'
 * nao se prova.
 *
 * ---------------------------------------------------------------------------
 * O QUE O PAINEL NAO PODE FAZER
 *
 * O AC publica a percentagem do ERS. O F1 25 publica os JOULES
 * GUARDADOS (`ersJ`) e **nao publica o maximo** -- medido com o jogo a
 * correr, em Abu Dhabi, com o ERS ligado:
 *
 *     ersJ      1105744.0     ha' bateria dentro
 *     ersMaxJ   (nulo)        e nao diz quanto cabe
 *     ersPct    (nulo)        e por isso nao ha' percentagem
 *
 * O codigo antigo fazia `d.ersPct || 0`, e escrevia **"ERS 0%"**.
 *
 * Isso e' o pior resultado possivel, e nao um pequeno: e' um numero
 * PLAUSIVEL. Quem conduz um F1 25 com o ERS ligado le "0%", acredita que
 * nao tem bateria, e conduz a sprint toda a harvestar. E o ERS e' recurso
 * de pista -- e' a diferenca entre fazer e nao fazer a volta a seguir.
 *
 * Um numero plausivel e errado nao se denuncia sozinho, que e' a Regra
 * no 19 e a razao de isto ser uma funcao com testes em vez de uma
 *expressao numa linha de pintura.
 *
 * ---------------------------------------------------------------------------
 * AS TRES RESPOSTAS, E NAO DUAS
 *
 *     com maximo     a percentagem, e a barra pintada
 *     sem maximo     os joules, e SEM barra
 *     sem nada       um travessao
 *
 * O `pct` e' `null` e nao `0` no caso do meio, e e' por isso que a barra
 * se ESCONDE. Uma barra a 0% afirma que a bateria esta' a zeros, que e'
 * precisamente o que se deixou de afirmar. Uma barra escondida tambem nao
 * afirma nada, e por isso e' a mesma coisa -- mas uma delas mente.
 *
 * E o porque de os JOULES aparecerem: quando nao ha' percentagem, o que
 * resta e' o numero que SE SABE. Um ERS de F1 tem alguns megajoules, e
 * em megajoules le-se de relance; em joules sao sete algarismos e nao se
 * ve nada. O numero que existe e' melhor que o numero que nao existe.
 */
(function (root) {
  'use strict';

  /* Acima disto o numero ja' nao cabe no painel, e um valor absurdo
   * queimado nascia de um pacote mal lido. */
  var MJJ_MAX = 10;
  var J_MAX = MJJ_MAX * 1e6;

  function numero(v) {
    return (typeof v === 'number' && isFinite(v)) ? v : null;
  }

  function limita(v, a, b) {
    return v < a ? a : (v > b ? b : v);
  }

  /* O que o painel escreve, o que pinta, e de que cor.
   *
   * Nunca devolve `pct: 0` para "nao sei". Devolve `null`, que e' a
   * diferença entre "a bateria esta' a zeros" -- que e' uma afirmação -- e
   * "nao ha' percentagem" -- que e' uma ausência. */
  function estadoErs(d) {
    if (!d) return { texto: '—', pct: null, estado: '', temValor: false };
    if (!(d.hasERS || d.hasKERS)) {
      return { texto: '—', pct: null, estado: '', temValor: false };
    }

    var guardado = numero(d.ersJ);
    var maximo = (typeof d.ersMaxJ === 'number' && d.ersMaxJ > 0) ? d.ersMaxJ : null;

    /* O AC MANDA A PERCENTAGEM PRONTA, e nao os joules. E' o primeiro
     * caso a tentar, e nao o ultimo: quando se le so' o `ersJ`, o AC
     * aparece sem ERS nenhum, que e' o inverso do bug que se veio
     * corrigir. Os dois jogos publicam coisas diferentes, e a funcao tem
     * de servir os dois. */
    var pctPronto = numero(d.ersPct);
    if (pctPronto !== null) {
      var p1 = limita(pctPronto, 0, 100);
      return {
        texto: Math.round(p1) + '%',
        pct: p1,
        estado: p1 > 25 ? 'on' : (p1 <= 20 ? 'warn' : ''),
        temValor: true
      };
    }

    if (maximo !== null && guardado !== null) {
      var p = limita(guardado / maximo * 100, 0, 100);
      return {
        texto: Math.round(p) + '%',
        pct: p,
        estado: p > 25 ? 'on' : (p <= 20 ? 'warn' : ''),
        temValor: true
      };
    }

    if (guardado !== null) {
      /* Sem maximo: os joules, e nada mais. Acima de `J_MAX` o numero
       * nao cabe, e nesse caso NAO SE ESCREVE NADA -- porque um numero
       * absurdo queimado nao e' melhor que um numero em falta. */
      if (guardado > J_MAX) {
        return { texto: '—', pct: null, estado: '', temValor: false, absurdo: true };
      }
      return {
        texto: (guardado / 1e6).toFixed(2) + ' MJ',
        pct: null,
        estado: '',
        temValor: true
      };
    }

    return { texto: '—', pct: null, estado: '', temValor: false };
  }

  var api = {
    estadoErs: estadoErs,
    MJJ_MAX: MJJ_MAX,
    J_MAX: J_MAX
  };
  // nos dois sitios, como o tyres.js: o browser precisa de window, e o
  // node precisa de module.exports. So' um dos dois e' teste nenhum.
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Ers = api;
})(typeof window !== 'undefined' ? window : globalThis);
