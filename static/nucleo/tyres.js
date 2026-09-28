/* Estimativa da vida do pneu, a partir do desgaste MEDIDO.
 *
 * Puro: sem DOM, sem estado global, sem temporizadores. Recebe o estado
 * do stint e devolve o estado novo com a estimativa. E' por isso que vive
 * aqui e nao no app.js -- assim corre no node e e' testavel
 * (tests/test_tyres.js).
 *
 * PORQUE MEDIR E NAO USAR UMA TABELA
 *
 * O Assetto Corsa nao publica a vida do composto na memoria partilhada.
 * Nos ficheiros do jogo cada carro pode ter um data/tyres.ini com
 * WEAR_CURVE=<composto>.lut, mas o modelo e' uma tabela de recurso por
 * canto e nem todas as pistas o tem (o alpine_a424_2024, medido, nao tem
 * tyres.ini nenhum). E mesmo quando existe, e' recurso -- nao desgaste.
 *
 * O que a memoria da e' o desgaste REAL, ja feito, corner a corner. Medir
 * o que ja aconteceu e mais honesto do que prognosticar a partir de uma
 * curva que ninguem sabe aplicar ao teu estilo de conducao. E o unico
 * numero que responde a pergunta que importa: "quantas voltas me faltam".
 *
 * SEM DADOS SUFICIENTES NAO SE INVENTA NADA
 *
 * No inicio de um stint so ha uma amostra, e nao da para saber o
 * desgaste por volta. A funcao devolve confiavel:false e o site escreve
 * "a medir". Preferimos um "--" honesto a um numero inventado.
 */
(function (root) {
  'use strict';

  /* Abaixo deste desgaste ainda medido, a estimativa nao vale nada: e'
     dentro do ruido de arredondamento (o valor chega com 1 casa decimal). */
  var MIN_POR_VOLTA = 0.05;

  /* PLAUSIBILIDADE. Um stint de um F1 ou de um Hypercar e' da ordem das
     10 a 30 voltas; numa resistencia, mais. Medido no Mugello com um
     Alpine A424, o campo tyreWear dava 0,17% de desgaste ao fim de DUAS
     voltas -- o que projetava 588 voltas de vida. Esse numero nao e' um
     stint, e' um campo que nao esta' a medir a banda de rodagem.
     *
     * E' melhor escrever "nao da" do que um numero que ninguem deve levar
     * a serio. Da' dois limites:
     *   RATEIO_MIN  0,5% por volta. Abaixo disso o stint duraria 200
     *               voltas, e nenhum composto numa pista dura tanto.
     *   MAX_VOLTAS  150. Rede de seguranca para a faixa entre 0,5% e
     *               0,67% por volta, que passa no teste do ritmo mas
     *               projecta mais de 150 voltas. A 1,2% por volta (83
     *               voltas) ainda passa, porque isso ja' e' um stint de
     *               resistencia plausivel.
     */
  var RATEIO_MIN = 0.5;
  var MAX_VOLTAS = 150;

  /* Um stint NUNCA ganha vida. Se o desgaste restante subir dois ou mais
     pontos face a referencia, o que aconteceu foi uma troca de pneus --
     nao "o pneu ficou novo". Detectar por um limiar absoluto nao
     funciona: depois de uma volta a Remaining ja esta' a 98, que num
     limiar de 90 parece "pneu novo" e o stint reiniciava sempre, sem
     chegar a medir nada. */
  var SALTO_DE_VIDA = 2;

  function estadoNovo(compound, volta, restante) {
    return { compound: compound, lap0: volta, restante0: restante, restanteUlt: restante };
  }

  /* Devolve SEMPRE a mesma forma, com todos os campos, para o consumidor
     nunca ler um undefined. A forma ser variavel e' a origem de uma
     classe inteira de bugs: o codigo do desenho le, recebe undefined e
     pinta um numero sem querer. */
  function vazio(estado, restante, voltasNoStint) {
    return {
      estado: estado,
      valido: false,
      confiavel: false,
      // 'impossivel' = ha' desgaste medido, mas o numero nao e'
      // plausivel para um stint. O site escreve que nao da, em vez de
      // mostrar 588 voltas.
      impossivel: false,
      restante: restante == null ? null : restante,
      voltasNoStint: voltasNoStint || 0,
      porVolta: 0,
      voltasRestantes: null
    };
  }

  /* restantePorPneu: os 4 valores de 100 - tyreWear, ou null se algum
     nao veio. Devolve valido:false quando nao ha' dados suficientes --
     e um "nao sei", que o site tem de pintar a neutro, nunca de zero. */
  function estimarPneus(estado, dados) {
    if (!dados || !dados.restantePorPneu) return vazio(estado, null, 0);
    var vals = dados.restantePorPneu.filter(function (v) { return typeof v === 'number' && isFinite(v); });
    if (vals.length === 0) return vazio(estado, null, 0);

    // o pneu mais gasto e' que manda: e' esse que obriga a trocar
    var restante = Math.min.apply(null, vals);
    var volta = dados.volta;
    var compound = dados.compound || '';

    // stint novo: sem estado, composto diferente, troca de pneus, ou o
    // contador de voltas a andar para tras (mudanca de sessao)
    //
    // A troca de pneus compara-se com o ULTIMO valor visto, nao com a
    // referencia do inicio do stint. Com a referencia, um stint que
    // comecou a 100 nunca detectaria a troca: 100 >= 100 + 2 da' falso
    // para sempre. E o caso mais comum -- trocar pneus a meio da corrida.
    if (!estado
        || estado.compound !== compound
        || typeof volta !== 'number' || volta < estado.lap0
        || restante >= (estado.restanteUlt != null ? estado.restanteUlt : estado.restante0) + SALTO_DE_VIDA) {
      return vazio(estadoNovo(compound, volta, restante), restante, 0);
    }

    var voltas = volta - estado.lap0;
    // o estado e' imutavel: devolve-se um novo, com o ultimo valor
    // actualizado, e o consumidor guarda-o. Sem isto, o salto de vida
    // nunca era visto porque o estado ficava parado no inicio do stint.
    var seguido = {
      compound: estado.compound,
      lap0: estado.lap0,
      restante0: estado.restante0,
      restanteUlt: restante
    };
    var res = vazio(seguido, restante, voltas);
    if (voltas < 1) return res;

    res.porVolta = (estado.restante0 - restante) / voltas;
    if (res.porVolta < MIN_POR_VOLTA) {
      // ou o pneu nao gasta (so testes), ou ainda nao medimos nada
      // util. Nao se divide por um valor que e' zero.
      return res;
    }
    res.voltasRestantes = restante / res.porVolta;
    res.valido = true;
    // duas voltas medidas e' o minimo para o numero significar alguma
    // coisa. Com uma so, um unico ponto manda no resultado.
    res.confiavel = voltas >= 2;
    // plausibilidade: se o numero nao cabe num stint, o campo nao esta'
    // a medir desgaste e o resultado nao se mostra
    if (res.porVolta < RATEIO_MIN || res.voltasRestantes > MAX_VOLTAS) {
      res.valido = false;
      res.confiavel = false;
      res.impossivel = true;
      res.voltasRestantes = null;
    }
    return res;
  }

  var api = {
    estimarPneus: estimarPneus,
    SALTO_DE_VIDA: SALTO_DE_VIDA,
    MIN_POR_VOLTA: MIN_POR_VOLTA,
    RATEIO_MIN: RATEIO_MIN,
    MAX_VOLTAS: MAX_VOLTAS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  /* O nome e' `Tyres`, e era `Pneus`.
   *
   * Os quatro modulos do nucleo publicam pelo nome do proprio ficheiro:
   *
   *     tempo.js        -> Tempo
   *     combustivel.js  -> Combustivel
   *     jogo-base.js    -> JogoBase
   *     tyres.js        -> Tyres        <-- este
   *
   * O `ac.js` lia `global.Tyres` e por isso `T_` era `undefined`. Ha'
   * guarda, uma linha a seguir, e por isso nao rebentou: a vida do pneu
   * mostrava "a medir" para sempre, e nada dizia que o modulo nao tinha
   * carregado. Um `--` que parece uma medida.
   *
   * O `test_scripts.js` e' que apanha isto. Ver a Regra no `AGENTS.md`.
   */
  root.Tyres = api;
})(typeof window !== 'undefined' ? window : globalThis);
