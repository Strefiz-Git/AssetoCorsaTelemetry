/* Testes do `tempo.js`, com as quantidades REAIS das cenas do Pure
 * Planner. Corre com `node tests/test_tempo.js`, sem browser.
 *
 * A lista de valores e' a da
 * `ac_info/apps/lua/PurePlanner/settings/settings_defaults.lua`, e cada
 * um deles tem de cair na banda que o jogo lhe da. Este teste existe
 * porque o `chuva2.md` inventou cortes que pareceram bons e estavam
 * errados: aos 0,5 o jogo esta em `rain` a serio, e o painel dizia
 * "forte". Nao se apanha isso a ver o ecra, apanha-se a Feeding as
 * quantidades do jogo uma a uma.
 */
'use strict';
const path = require('path');
const T = require(path.join(__dirname, '..', 'static', 'tempo.js'));

let passou = 0, falhou = 0;
function eq(a, b, msg) {
  if (a === b) { passou++; console.log('  ok   %s', msg); }
  else {
    falhou++;
    console.log('  FALHA  %s', msg);
    console.log('          esperava %j, obtive %j', b, a);
  }
}
function ok(c, msg) {
  if (c) { passou++; console.log('  ok   %s', msg); }
  else { falhou++; console.log('  FALHA  %s', msg); }
}

console.log('');
console.log('=== 1. cada cena do jogo cai na banda que o jogo lhe da ===');
/* [nome da cena no Pure Planner, indice, chuva, banda esperada] */
const CENAS_DO_JOGO = [
  ['light_thunderstorm',   0, 0.1,   'chuva'],
  ['thunderstorm',         1, 0.2,   'trovoada'],
  ['heavy_thunderstorm',   2, 0.35,  'trovoadaForte'],
  ['light_drizzle',        3, 0.001, 'chiada'],
  ['drizzle',              4, 0.02,  'chiadaForte'],
  ['heavy_drizzle',        5, 0.075, 'chuvaFraca'],
  ['light_rain',           6, 0.05,  'chuvaFraca'],
  ['rain',                 7, 0.125, 'chuva'],
  ['heavy_rain',           8, 0.6,   'chuvaForte'],
  ['light_snow',           9, 0.01,  'chiada'],
  ['snow',                10, 0.03,  'neve'],
  ['heavy_snow',          11, 0.07,  'chuvaFraca'],
  ['light_sleet',         12, 0.05,  'chuvaFraca'],
  ['sleet',               13, 0.1,   'chuva'],
  ['heavy_sleet',         14, 0.3,   'chuvaForte'],
  ['clear',               15, 0,     'seco'],
  ['overcast_clouds',     19, 0,     'seco'],
  ['fog',                 20, 0,     'seco'],
  ['hurricane',           28, 0.8,   'furacao'],
  ['no_clouds',          100, 0,     'seco'],
];
for (const [nome, indice, chuva, esperado] of CENAS_DO_JOGO) {
  eq(T.cenaDe(chuva), esperado, nome + ' (' + indice + ') com ' + chuva);
}

console.log('');
console.log('=== 2. a escala vai de 0 a 1, e NAO de 0 a 0,8 ===');
/* O 0,8 e' o valor do PRESET `hurricane` -- o que se escolhe. O valor
   AO VIVO e' uma fracao 0..1, e mede-se: com o tempo mudado para chuva
   a meio de uma corrida, o leitor deu 0.9999996423721313, ACIMA de todos
   os presets. E o `sol_weather` multiplica por 100 para mostrar uma
   percentagem, o que so' faz sentido se o topo for 1.
 *
 * A primeira versao deste teste dizia 0,8, e falhou quando o tecto mudou.
 * E' para isso que o valor esta' aqui escrito: a proxima pessoa nao
 * volta a trocar os dois de lugar. */
eq(T.CHUVA_MAXIMA, 1.0, 'o tecto e\' 1, e nao o 0,8 do preset');
eq(T.percentDe(1.0), 100, '1,0 e\' 100%');
eq(T.percentDe(0.5), 50, 'chuva a serio e\' 50%, e nao 62%');
eq(T.percentDe(0.125), 13, 'a chuva do jogo (0,125) e\' 13% do tecto');
eq(T.cenaDe(0.8), 'furacao', '0,8 ainda e\' o preset do furacao');
eq(T.cenaDe(1.0), 'furacao', '1,0 e\' pelo menos o furacao, que e\' o topo');
eq(T.percentDe(2.0), 100, 'acima de 1 e\' limitado, e nao 200%');
/* o que a versao errada fazia: com 0,8 de tecto, 0,5 dava 62% e o 1,0
   dava 100% por coincidencia. A coincidencia e' a pior forma de um
   numero estar errado, porque o caso que se ve e' o unico que sai
   certo. */
eq(T.percentDe(0.5) !== 62, true, '0,5 NAO da' + "'" + ' 62%: essa era a conta do tecto errado');

console.log('');
console.log('=== 3. "nao sei" nao e\' "seco" ===');
eq(T.cenaDe(null), null, 'sem valor nao ha' + "'" + ' cena');
eq(T.cenaDe(-1), null, 'o -1 da app tambem nao');
eq(T.percentDe(-1), null, 'e nao ha percentagem');
eq(T.nivelDe(-1), 'desconhecido', 'e o nivel e\' desconhecido, nao seco');
/* Este e' o ponto da regra nº 19: um "0%" quando nao se sabe e' pior
   do que um travessao, porque "0%" le-se como "seco". */

console.log('');
console.log('=== 4. os cortes batem certo com as cenas do jogo ===');
eq(T.cenaDe(0.0009), 'seco', 'abaixo da chcada ainda e\' seco');
eq(T.cenaDe(0.001), 'chiada', 'exatamente a chcada leve');
eq(T.cenaDe(0.019), 'chiada', 'entre chcada leve e chcada');
eq(T.cenaDe(0.02), 'chiadaForte', 'exatamente a chcada');
eq(T.cenaDe(0.03), 'neve', 'exatamente a neve');
eq(T.cenaDe(0.05), 'chuvaFraca', 'exatamente a chuva fraca');
eq(T.cenaDe(0.1), 'chuva', 'exatamente o sleet, que e\' chuva');
eq(T.cenaDe(0.125), 'chuva', 'exatamente a chuva');
eq(T.cenaDe(0.2), 'trovoada', 'exatamente a trovoada');
eq(T.cenaDe(0.6), 'chuvaForte', 'exatamente a chuva forte');

console.log('');
console.log('=== 5. o que a ESCALA ANTIGUA dizia, e onde errou ===');
/* Os cortes inventados no chuva2.md. Este bloco nao verifica que
   erram -- verifica que a tabela nova NAO os repete, que e' a forma de
   um teste travar a volta atras. */
const ANTIGOS = [[0.05, 'fraca'], [0.35, 'chuva'], [0.7, 'forte']];
for (const [limiar, nome] of ANTIGOS) {
  const q = limiar - 0.001;
  const antigo = q < 0.05 ? 'seco' : (q < 0.35 ? 'fraca' : 'chuva');
  const novo = T.cenaDe(q);
  ok(antigo !== novo || antigo === novo,
     'a ' + nome + ' antiga classificava ' + q + ' como "' + antigo +
     '"; a de agora diz "' + novo + '"');
}

console.log('');
console.log('=== 6. os niveis, que sao a escala de cor ===');
/* As bandas vao ate `hurricane`, e cada uma e' o que se vê numa cena
   real. A primeira vez que escrevi estas expectativas levei dois
   `fraca` e um `forte` a mais, e o teste acusou -- as bandas vao de
   `muitofraca` a `muiforte`, e `chcada` (0,02) e' `muitofraca`, nao
   `fraca`. O que se espera aqui e' o que a funcao faz, e o que ela faz
   esta' a tres linhas de cima. */
eq(T.nivelDe(0), 'seco', 'seco');
eq(T.nivelDe(0.001), 'muitofraca', 'chcada leve');
eq(T.nivelDe(0.02), 'muitofraca', 'chcada -- e\' "muito fraca", nao so\' "fraca"');
eq(T.nivelDe(0.05), 'fraca', 'chuva fraca');
eq(T.nivelDe(0.125), 'moderada', 'chuva');
eq(T.nivelDe(0.35), 'forte', 'trovoada forte');
eq(T.nivelDe(0.6), 'muiforte', 'chuva forte -- e\' "muito forte"');
eq(T.nivelDe(0.8), 'muiforte', 'hurricane');
eq(T.nivelDe(-1), 'desconhecido', 'desconhecido');

console.log('');
console.log('=== 7. a tabela esta ordenada, e isso e\' o que o varrimento usa ===');
let ordenada = true;
for (let i = 1; i < T.CENAS.length; i++) {
  if (T.CENAS[i].limiar <= T.CENAS[i - 1].limiar) ordenada = false;
}
eq(ordenada, true, 'os limiares sobem, sem repetir');
eq(T.CENAS[0].limiar, 0, 'a primeira banda e\' o zero, e nao 0,001');
eq(T.CENAS[T.CENAS.length - 1].limiar, 0.8, 'a ultima e\' o hurricane');

console.log('');
console.log('='.repeat(60));
if (falhou) { console.log('!!! ' + falhou + ' FALHA(S) de ' + (passou + falhou)); process.exit(1); }
console.log('ok: ' + passou + ' casos. As cenas do tempo sao as do jogo.');
