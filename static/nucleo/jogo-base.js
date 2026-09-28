/* O que um modulo de jogo tem de ter, no browser.
 *
 * E' a mesma ideia da interface em Python (`actelemetry/jogos/base.py`) e
 * pelo mesmo motivo: o `app.js` nao sabe nada sobre nenhum dos dois
 * jogos, e o que ele sabe e' esta lista. Sem ela escrita, os dois modulos
 * divergem em silencio -- o `app.js` pede `combustivel(d)` a um e a
 * outro devolve outra coisa, e o painel do F1 25 acaba a mostrar uma
 * regra do AC sem ninguem dar conta.
 *
 * PORQUE ISTO E' SEPARADO DO `app.js`
 * -----------------------------------
 * O `app.js` e' o frontend: DOM, canvas, traducoes, ligacoes. Nao tem
 * nenhuma regra de jogo dentro, e nao deve ter. Uma regra de jogo no
 * `app.js` e' uma regra que so se pode testar com o jogo correspondente
 * a correr, e uma regra que so se pode testar com o jogo a correr nao e'
 * uma regra testada -- e' uma regra em que se confia.
 *
 * Por isso os modulos de jogo sao PUROS: nenhuma funcao toca no DOM,
 * todas devolvem um valor ou um objecto pequeno, e o `app.js` limita-se
 * a pintar o que recebe. Isso permite correr os dois no node e testar as
 * regras sem browser, que e' o que os testes `test_*.js` fazem.
 *
 * O QUE UM JOGO TEM DE RESPONDER
 * ------------------------------
 * Cada funcao recebe o payload JA ACHATADO pelo servidor, e devolve o
 * que o painel escreve. As unidades sao decididas AQUI, dentro do
 * modulo do jogo, e nao no `app.js` -- porque e' o unico sitio onde se
 * sabe de que campo o numero veio. Um painel que mostra "ABS 13%" num
 * jogo e "ABS ON" no outro nao e' um painel com uma regra: sao dois
 * paineis com a mesma pintura.
 */
(function (global) {
  'use strict';

  /* A resposta de uma metrica: o que se escreve, e o que se pinta.
   *
   * `pct` e' separado de `txt` de proposito. Ha' dois casos em que o
   * painel escreve um numero e NAO consegue pintar uma barra:
   *   - o numero existe mas o maximo nao e' publicado (o ERS do F1 25
   *     nao diz quanto cabe);
   *   - o valor e' um estado, nao uma quantidade (o ABS do F1 25 e' ON
   *     ou OFF, e nao 0% a 100%).
   * Nesses casos `txt` leva o numero ou o estado, e `pct` fica `null` --
   * e uma barra a meio com um numero ao lado e' uma barra que mente
   * sobre o que se sabe. */
  function Metrica(txt, pct, dica) {
    return { txt: txt === undefined || txt === null ? '--' : String(txt),
             pct: pct === undefined ? null : pct,
             dica: dica || '' };
  }

  function Nulo(dica) {
    return { txt: '--', pct: null, dica: dica || '', semDados: true };
  }

  const Base = {
    id: '',
    nome: '',

    /* ------------------------------------------------------------------
     * O QUE ESTE JOGO TEM
     * ------------------------------------------------------------------ */

    /* Quais cartoes mostrar. O servidor tambem manda isto, em
     * `/api/capabilities`, com 81 chaves; o modulo declara as MESMAS
     * chaves para o que o painel precisa de esconder. As duas listas
     * tem de concordar, e o `test_f125_parser.py` confere a parte do
     * servidor -- este lado e' conferido pelo `test_jogos.js`.
     *
     * Por que dois lados e nao um: o servidor sabe o que o jogo publica,
     * e o modulo sabe o que o painel sabe pintar. Um dado que o jogo
     * publica e que o painel nao sabe mostrar nao e' um cartao
     * escondivel, e' um botao por fazer. */
    capacidades: function () { return {}; },

    /* ------------------------------------------------------------------
     * O CARRO
     * ------------------------------------------------------------------ */

    /* A embraiagem. O AC manda 0.0 a 1.0 e 1.0 e' EMBRAIADA -- a
     * documentacao diz "pedal" e mente. O F1 25 manda 0 a 100, e 100 e'
     * embraiada. O sentido e' o mesmo nos dois; a escala nao. E o
     * painel mostra o INVERSO, que e' quanto esta' solta, que e' o que
     * interessa para uma ponta de embraiagem. */
    embraiagem: function (d) { return Nulo(); },

    /* O volante. O AC manda um angulo em radianos sem escala
     * conhecida, e o painel do AC tem de usar uma constante adivinhada.
     * O F1 25 manda -1 a 1 normalizado, e nao ha' o que adivinhar. Por
     * isso o AC devolve o numero com a ressalva e o F1 25 devolve o
     * numero sem. */
    volante: function (d) { return Nulo(); },

    /* O ABS e o TC.
     *
     * Aqui e' onde os dois jogos mais divergem, e onde a diferenca
     * NAO e' de estilo. No AC sao o NIVEL a que o sistema esta' a
     * trabalhar: medido 0,13 e 0,08 durante 4502 amostras de travagens
     * duras, sem variar uma vez. Mostrar "ABS 13%" e' a verdade. No F1
     * 25 o `m_antiLockBrakes` e' um 0 ou 1 e o `m_tractionControl` e'
     * um modo (0 off, 1 medio, 2 cheio): nao ha' percentagem, e
     * mostrar "ABS 100%" seria inventar um numero que o jogo nao da.
     *
     * Por isso `txt` e' separado de `pct`: o AC preenche os dois, o
     * F1 25 so o `txt`. */
    abs: function (d) { return Nulo(); },
    tc: function (d) { return Nulo(); },

    /* ------------------------------------------------------------------
     * DRS
     * ------------------------------------------------------------------ */

    /* O DRS, e o que o painel precisa de saber para pintar a luz.
     *
     * No AC ha' dois flags e NENHUM deles e' de confianca. O
     * `drsAvailable` esteve a 1 em 98,9% do tracado num RB21 em Suzuka e
     * a 1 em 18,5% num Ferrari SF25 em Interlagos, com duas zonas
     * contiguas e so' a 262-312 km/h -- que e' exactamente a forma de
     * uma zona real. Um flag medido uma vez, num so' carro, e' uma
     * regra geral que nao existe, e por isso o painel do AC mede uma
     * volta inteira antes depaintar e mostra o veredito ao piloto.
     *
     * No F1 25 nao ha' duvida: `m_drsAllowed` e' um 0/1 e
     * `m_drsActivationDistance` e' os METROS que faltam. E' o
     * `txt` que faz a diferenca: o painel do F1 25 pode dizer "340 m",
     * e isso e' mais util do que um ponto verde. */
    drs: function (d) { return { ligado: false, disponivel: false, txt: '--', pct: null }; },

    /* ------------------------------------------------------------------
     * PNEUS
     * ------------------------------------------------------------------ */

    /* A vida do pneu, em VOLTAS QUE FALTAM.
     *
     * Esta e' a diferenca mais grande entre os dois paineis. O F1 25
     * manda o `lifeSpan` no pacote Tyre Sets: o numero, lido. O AC nao
     * publica a vida do composto, e o painel estima-a a partir do
     * desgaste medido em duas voltas -- uma conta, que depende do carro,
     * do piloto e da pista.
     *
     * Da' por isso `aMedir`: enquanto nao ha' medidas suficientes, o
     * painel escreve "a medir" e NAO um numero inventado. Um numero
     * inventado aqui e' o pior sitio possivel para inventar um numero,
     * porque o piloto decide a estrategia com ele. */
    vidaPneu: function (d) { return { voltas: null, texto: '--', aMedir: true }; },

    /* A temperatura de cada pneu, ja na ordem FL, FR, RL, RR.
     *
     * A ORDEM E' A REGRA. O jogo do F1 25 manda RL, RR, FL, FR e o do
     * AC manda FL, FR, RL, RR. As duas desenham uma grelha 2x2 quase
     * simetrica, e um painel ao contrario nao da erro nenhum: descobre-se
     * a conduzir, a comparar com o carro, e depois de estragar um stint.
     *
     * Por isso a traducao e' feita AQUI, na fronteira, e nunca dentro
     * da logica de desenho. E cada teste deste ficheiro poe um valor
     * DIFERENTE em cada canto, porque com os quatro iguais uma ordem
     * errada e' indistinguivel de uma ordem certa. */
    tempPneu: function (d) { return { superficie: [0, 0, 0, 0], interior: null, nucleo: null }; },

    /* ------------------------------------------------------------------
     * COMBUSTIVEL
     * ------------------------------------------------------------------ */

    /* O AC manda LITROS e o maximo em `maxFuel`. O F1 25 manda
     * QUILOGRAMAS e o maximo em `fuelCapacity`, e ainda da' o
     * `fuelRemainingLaps`, que e' o numero que o MFD do jogo mostra e
     * que o AC nao tem de forma nenhuma.
     *
     * A unidade vai no texto, e nao se converte: mostrar "42.5 kg" e
     * "42.5 L" e' mais honesto do que escolher uma unidade e mentir
     * nela, e a diferença entre 42.5 quilos e 42.5 litros nao e' uma
     * diferença de unidade, e' um numero completamente diferente. */
    combustivel: function (d) { return Nulo(); },

    /* ------------------------------------------------------------------
     * O TEMPO
     * ------------------------------------------------------------------ */

    /* O clima.
     *
     * O F1 25 PUBLICA o tempo: `m_weather`, as temperaturas e a previsao
     * de chuva. O AC nao publica nada disso -- a pagina de fisica tem 60
     * campos e sobre o tempo so ha' `airTemp`, `roadTemp` e `airDensity`,
     * o que foi contado e nao deduzido. O que o AC tem e' o EFEITO: a
     * aderencia desce quando esta molhado.
     *
     * E a chuva do AC vem da API Python dentro do jogo, e so' existe se
     * o Custom Shaders Patch estiver instalado. Quando nao existe, o
     * valor e' -1, e -1 e' "nao se sabe" e nao "seco". Um zero seria
     * mentira sempre que a funcao nao existir. Regra no 19. */
    clima: function (d) { return { ar: null, pista: null, vento: null, chuva: null, densidade: null, grip: null }; },

    /* ------------------------------------------------------------------
     * VOLTAS E DELTA
     * ------------------------------------------------------------------ */

    /* O delta contra uma volta de referencia.
     *
     * O F1 25 manda o delta do JOGO -- para quem esta' a frente e para o
     * lider -- e nao ha' nada para calcular. O AC nao manda delta para
     * ninguem, e o painel calcula-o contra uma volta gravada.
     *
     * Devolve um numero em SEGUNDOS com sinal, ou null. O `null` e'
     * "nao se sabe" e pinta-se neutro; o zero e' "estamos exactamente na
     * referencia" e pinta-se sem cor. Sao coisas diferentes, e a Regra
     * no 13 do `AGENTS.md` e' sobre nao as misturar. */
    delta: function (d) { return null; },

    /* ------------------------------------------------------------------ */
    Metrica: Metrica,
    Nulo: Nulo,
  };

  global.JogoBase = Base;
})(typeof globalThis !== 'undefined' ? globalThis : this);
