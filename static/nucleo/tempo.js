/* ===========================================================================
 * tempo.js — as CENAS do tempo, e a escala delas.
 *
 * PURO. Sem DOM, sem estado, sem nada de fora. E' por isso que corre no
 * node e se testa, ao contrario do `pintarChuva` que vive dentro da IIFE
 * do `app.js` -- que foi como se descobriu que os cortes estavam errados
 * tarde demais: so' se via o resultado no ecra, e ver catorze valores no
 * ecra a cada alteração nao e' um teste.
 *
 * ---------------------------------------------------------------------------
 * DE ONDE VEM A ESCALA
 *
 * Do Pure Planner, em
 * `ac_info/apps/lua/PurePlanner/settings/settings_defaults.lua`, que tem
 * 39 cenas com nome, indice e as quantidades do proprio Assetto Corsa.
 * Cada limiar desta tabela e' a quantidade de uma cena REAL:
 *
 *     light_drizzle        3    0,001          drizzle          4    0,02
 *     light_snow           9    0,01           snow            10    0,03
 *     light_rain           6    0,05           heavy_drizzle    5    0,075
 *     sleet               13    0,1            rain             7    0,125
 *     thunderstorm         1    0,2            heavy_sleet     14    0,3
 *     heavy_thunderstorm   2    0,35           heavy_rain       8    0,6
 *     hurricane           28    0,8
 *
 * A PRIMEIRA VERSAO DESTE PAINEL inventou os cortes -- seco ate 0,05,
 * fraca ate 0,35, forte acima -- e eles estavam errados contra esta
 * escala: aos 0,5 o jogo esta em `rain` a serio, e o painel dizia
 * "forte". A 0,3, que o jogo chama `heavy_sleet`, os cortes inventados
 * chamavam "chuva". Eram um palpite honesto, e o `chuva2.md` dizia-o --
 * mas havia uma fonte que nao era palpite, e estava a tres pastas de
 * distancia.
 *
 * A ESCALA VAI DE 0 A 0,8, E NAO DE 0 A 1
 *
 * Porque `hurricane` e' 0,8. Um valor de 1,0 nao existe no vocabulario,
 * e o painel mostrava-o como "100%", que e' um estado que o AC nao tem.
 * Por isso a percentagem e' `chuva / 0.8`, e nao `chuva * 100`.
 * ======================================================================== */
(function (root) {
  'use strict';

  /* O tecto da escala e' 1, e NAO o 0,8 do `hurricane`.
   *
   * Sao duas coisas que se baralham com ease. O valor de um PRESET e' o
   * que se ESCOLHE -- e o `hurricane` tem 0,8 porque e' essa a quantidade
   * que a cena pede. O valor AO VIVO e' o que a simulacao esta' a fazer
   * AGORA, e esse vai de 0 a 1.
   *
   * MEDIDO, numa corrida a meio da qual o tempo foi mudado para chuva: o
   * leitor deu `rainAmount = 0.9999996423721313`, que esta' ACIMA de todos
   * os presets. E o `sol_weather` faz `int(RainParams[0] * 100.0)` para
   * mostrar uma percentagem: se o valor fosse 0..0,8, aquela conta
   * nunca passaria de 80%, e nao e' caso.
   *
   * O que fica a 0,8 sao os limiares das bandas, que sao as quantidades
   * que o jogo reconhece: 0,001 e' chcada, 0,125 e' chuva, 0,6 e' chuva
   * forte. Sao pontos de corte significativos no mesmo espaco.
   *
   * O ERRO que o tecto errado produzia: com 0,8 como maximo, uma chuva de
   * 0,5 -- chuva a serio -- mostrava 62%. E o 1,0 era cortado para 0,8 e
   * dava 100%, por COINCIDENCIA certo, que e' a pior forma de um numero
   * estar errado. */
  var CHUVA_MAXIMA = 1.0;

  /* A banda de cada cena, da chuva mais fraca para a mais forte. Cada
     limiar e' a quantidade de uma cena real -- por isso 0,001 e 0,030
     estao la, e sao a chcada e a neve. Nao ha' numeros redondos. */
  var CENAS = [
    { limiar: 0.000, chave: 'seco' },
    { limiar: 0.001, chave: 'chiada' },          // light_drizzle, 3
    { limiar: 0.010, chave: 'chiada' },          // light_snow,    9
    { limiar: 0.020, chave: 'chiadaForte' },     // drizzle,       4
    { limiar: 0.030, chave: 'neve' },            // snow,         10
    { limiar: 0.050, chave: 'chuvaFraca' },      // light_rain,    6
    { limiar: 0.075, chave: 'chuvaFraca' },      // heavy_drizzle, 5
    { limiar: 0.100, chave: 'chuva' },           // sleet,        13
    { limiar: 0.125, chave: 'chuva' },           // rain,          7
    { limiar: 0.200, chave: 'trovoada' },        // thunderstorm,  1
    { limiar: 0.300, chave: 'chuvaForte' },      // heavy_sleet,  14
    { limiar: 0.350, chave: 'trovoadaForte' },   // heavy_thunder, 2
    { limiar: 0.600, chave: 'chuvaForte' },      // heavy_rain,    8
    { limiar: 0.800, chave: 'furacao' }          // hurricane,    28
  ];

  /* O EIXO DO VENTO, e a metade da tabela que estava a ser ignorada.
   *
   * A tabela de 37 cenas tem TREZE colunas, nao nove -- o comentario de
   * cabecalho do Pure Planner esta' desatualizado e omite `mist`, `sun`,
   * `air_temp` e `road_temp`. Ate aqui so' se usava a terceira, a `rain`.
   * A oitava e' o `wind`, e o `windSpeed` JA' ERA LIDO: esta' no
   * cabecalho da pagina, em m/s, e a API e a memoria partilhada batem
   * (22,0 contra 22,5 medidos). Estava a ser lido e nao usado.
   *
   * A razao de ser preciso: DUAS cenas da tabela tem a MESMA chuva e
   * ventos que nao se confundem.
   *
   *     tornado       0,300 de chuva    100 de vento
   *     heavy_sleet   0,300 de chuva      0 de vento
   *
   * Com so' chuva as duas dizem "CHUVA FORTE" -- e uma e' um tornado e a
   * outra e' grao. E na secura o caso e' ainda mais limpo: `windy` tem
   * chuva zero e vento 50, e o painel dizia "SECO", que e' mentira.
   *
   * Nenhum limiar aqui e' redondo por escolha: todos sao o valor de `wind`
   * de uma cena real da tabela.
   *
   * A UNIDADE NAO ESTA' CONFIRMADA, e e' o unico buraco Known desta
   * tabela. A documentacao do AC diz que o `windSpeed` e' em m/s; a
   * tabela nao diz nada, e `hurricane` a 120 tanto pode ser 120 m/s
   * (432 km/h, furacao de verdade) como 120 km/h (33 m/s, vento forte mas
   * nao furacao). Nao se pode decidir a partir da tabela, porque a tabela
   * nao tem unidades. A medicao que resolve e' uma so': escolher `windy`
   * no Pure Planner e ler o `windSpeed` -- se der perto de 50, a coluna e'
   * m/s; se der perto de 14, e' km/h. Esta' escrito no `chuva2.md`.
   *
   * ate essa medicao, o erro e' para o lado seguro: um limiar alto demais
   * nunca dispara, e uma cena errada por vento a mais nunca aparece. O
   * que nao e' aceitavel e' o inverso -- disparar `ventoso` com brisa. */
  var CENAS_VENTO = [
    // `hurricane`, 28: 0,8 de chuva e 120 de vento. Sem restricao de
    // chuva, porque 120 e' o topo da tabela e nao ha' cena acima disso --
    // e porque um vento de furacao e' um furacao com chuva ou sem.
    { vento: 120.0, chave: 'furacao' },
    // `tornado`, 27: 0,3 de chuva e 100 de vento. A chuva minima e' a
    // do proprio preset arredondada para baixo (0,25), porque sem ela
    // qualquer vento de 100 com chuva zero seria chamado tornado, e a
    // tabela nao tem isso.
    { vento: 100.0, chave: 'tornado', chuvaMin: 0.25 },
    // `squalls`, 26: 0,025 de chuva e 70 de vento. Com chuva zero NAO e'
    // aguaceiro -- cai para `ventoso`, que e' o que a secao de vento da
    // tabela diz a 50. Por isso a chuva minima e' 0,001 e nao 0.
    { vento: 70.0, chave: 'aguaceiro', chuvaMin: 0.001, chuvaMax: 0.10 },
    // `windy`, 31: chuva zero e 50 de vento. A chuva maxima e' a do
    // limiar da chcada, que e' 0,001 -- abaixo disso nao ha' chuva.
    { vento: 50.0, chave: 'ventoso', chuvaMax: 0.001 }
  ];

  /* O vento chega a definir a cena? Devolve a chave, ou null para nao
   * se meter.
   *
   * A ORDEM E' QUE FAZ O TRABALHO, e da' um bug que o teste apanhou na
   * primeira versao. A lista esta' por ordem DECRESCENTE de vento
   * (120, 100, 70, 50) e o `return` no primeiro que serve e' o que
   * escolhe a cena mais forte que o vento justify.
   *
   * O que estava errado era o `break`. Escrevi `if (vento < r.vento)
   * break` com o comentario "a lista e' decrescente, portanto e' o mesmo
   * que um `while` sem ecra". Nao e' o mesmo, e o raciocinio estava
   * invertido: numa lista DECRESCENTE, falhar um limiar alto nao
   * desiste nada, porque todos os que vem a seguir sao MAIS BAIXOS. Com
   * 50 de vento, a primeira linha pedia 120, o `break` parava ali, e a
   * quarta -- que e' exactamente a do `windy` -- nunca era olhada. O
   * resultado era "seco" com 50 de vento, que e' o erro exacto que este
   * eixo veio corrigir.
   *
   * O `continue` e' que esta' certo, e o `return` e' o que escolhe. */
  function cenaDeVento(chuva, vento) {
    // sem vento medido, o comportamento e' o de sempre: so' a chuva decide
    if (vento == null || vento < 0) return null;
    for (var i = 0; i < CENAS_VENTO.length; i++) {
      var r = CENAS_VENTO[i];
      // ainda nao chega a este limiar -- tenta o seguinte, que e' menor
      if (vento < r.vento) continue;
      if (r.chuvaMin != null && chuva < r.chuvaMin) continue;
      if (r.chuvaMax != null && chuva > r.chuvaMax) continue;
      return r.chave;
    }
    return null;
  }

  /* Que cena da' esta carga de chuva?
   *
   * A lista esta ordenada, por isso e' um varrimento com `break`. E nao
   * um `while` sobre os indices, nem um `c = x` dentro do laco sem o
   * `break` -- que so' dariam o mesmo resultado se a lista estivesse ao
   * contrario. Um dia alguem ordena isto sem querer, e o `break` continua
   * a dar a cena correcta. */
  function cenaDe(chuva, vento) {
    if (chuva == null || chuva < 0) return null;
    // O primeiro paragrafo e' o que mudou. Com o vento a -1 -- que e' o
    // que a app escreve quando nao ha `ac.getWindSpeed` -- isto devolve
    // null e cai nas bandas de chuva, exactamente como antes. Por isso
    // os 57 casos do `test_tempo.js` continuam a passar sem mudar um.
    var doVento = cenaDeVento(chuva, vento);
    if (doVento) return doVento;
    var v = Math.min(chuva, CHUVA_MAXIMA);
    var c = CENAS[0];
    for (var i = 0; i < CENAS.length; i++) {
      if (v < CENAS[i].limiar) break;
      c = CENAS[i];
    }
    return c.chave;
  }

  /* A percentagem que se mostra. E' `chuva * 100`, porque o valor e' uma
     fracao 0..1 -- o mesmo que o `sol_weather` multiplica por 100 para
     mostrar. */
  function percentDe(chuva) {
    if (chuva == null || chuva < 0) return null;
    return Math.round((Math.min(chuva, CHUVA_MAXIMA) / CHUVA_MAXIMA) * 100);
  }

  /* O nivel de cor. Recebe a mesma coisa que `cenaDe` -- a chuva e o
   * vento -- e nao a chave, para que quem chama nao tenha de a calcular
   * duas vezes e o risco de as duas contas divergirem.
   *
   * A razao e' a regra nº 16 aplicada a uma cor: enquanto a palavra e a
   * cor sairam de duas contas diferentes, `chuva` a dizer uma coisa e a
   * cor outra, e nenhum teste apanha -- porque os dois estavam certos
   * individualmente. Passando a chave, e' impossivel divergirem: a cor
   * vem da cena que a palavra mostra.
   *
   * Os niveis de vento nao sao novos. Sao os mesmos nomes, escolhidos
   * por ordem do `wind` da tabela -- 50, 70, 100, 120 -- para nao
   * inventar uma escala de cor nova quando a escala da chuva ja
   * responde. */
  var NIVEL_DE_VENTO = {
    ventoso: 'fraca',       // 50
    aguaceiro: 'moderada',  // 70
    tornado: 'forte',       // 100
    furacao: 'muiforte'     // 120
  };

  function nivelDe(chuva, vento) {
    if (chuva == null || chuva < 0) return 'desconhecido';
    var doVento = cenaDeVento(chuva, vento);
    if (doVento && NIVEL_DE_VENTO[doVento]) return NIVEL_DE_VENTO[doVento];
    if (chuva < 0.001) return 'seco';
    if (chuva < 0.05) return 'muitofraca';
    if (chuva < 0.125) return 'fraca';
    if (chuva < 0.35) return 'moderada';
    if (chuva < 0.6) return 'forte';
    return 'muiforte';
  }

  var api = {
    CHUVA_MAXIMA: CHUVA_MAXIMA,
    CENAS: CENAS,
    CENAS_VENTO: CENAS_VENTO,
    cenaDe: cenaDe,
    percentDe: percentDe,
    nivelDe: nivelDe
  };

  // nos dois sitios, como o tyres.js: o browser precisa de window, e o
  // node precisa de module.exports. So' um dos dois e' teste nenhum.
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Tempo = api;
})(typeof window !== 'undefined' ? window : globalThis);
