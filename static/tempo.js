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

  /* O topo da escala do jogo. `hurricane` e' 0,8. */
  var CHUVA_MAXIMA = 0.8;

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

  /* Que cena da' esta carga de chuva?
   *
   * A lista esta ordenada, por isso e' um varrimento com `break`. E nao
   * um `while` sobre os indices, nem um `c = x` dentro do laco sem o
   * `break` -- que so' dariam o mesmo resultado se a lista estivesse ao
   * contrario. Um dia alguem ordena isto sem querer, e o `break` continua
   * a dar a cena correcta. */
  function cenaDe(chuva) {
    if (chuva == null || chuva < 0) return null;
    var v = Math.min(chuva, CHUVA_MAXIMA);
    var c = CENAS[0];
    for (var i = 0; i < CENAS.length; i++) {
      if (v < CENAS[i].limiar) break;
      c = CENAS[i];
    }
    return c.chave;
  }

  /* A percentagem que se mostra. E' `chuva / 0.8` e nao `chuva * 100`,
     e a razao esta' em cima: a escala do jogo acaba em 0,8. */
  function percentDe(chuva) {
    if (chuva == null || chuva < 0) return null;
    return Math.round((Math.min(chuva, CHUVA_MAXIMA) / CHUVA_MAXIMA) * 100);
  }

  /* A cena tem uma cor? A escala e' a do jogo, e as bandas de cor sao
     as mesmas que os limiares -- verde para o seco, e a subir. */
  function nivelDe(chuva) {
    if (chuva == null || chuva < 0) return 'desconhecido';
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
    cenaDe: cenaDe,
    percentDe: percentDe,
    nivelDe: nivelDe
  };

  // nos dois sitios, como o tyres.js: o browser precisa de window, e o
  // node precisa de module.exports. So' um dos dois e' teste nenhum.
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Tempo = api;
})(typeof window !== 'undefined' ? window : globalThis);
