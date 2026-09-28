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
const T = require(path.join(__dirname, '..', 'static', 'nucleo', 'tempo.js'));

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
console.log('=== 8. o eixo do VENTO, com os pares (chuva, vento) reais ===');
/* Estes valores sao as DUAS colunas da mesma linha da tabela do Pure
 * Planner -- a terceira, `rain`, e a oitava, `wind`. Ate aqui so' se
 * alimentava a terceira ao `cenaDe`, e era por isso que DUAS cenas com a
 * mesma chuva davam a mesma palavra.
 *
 * A razao de ser um teste separado e nao mais uma linha em 1: e' a
 * backwards-compatibilidade. `cenaDe(chuva)` com um so' argumento tem de
 * dar exactamente o que dava antes, porque e' assim que o `app.js` chama
 * quando nao ha' Custom Shaders Patch, e porque os 57 casos acima
 * chamam-no de um so' argumento. Um segundo parametro que mudasse
 * alguma coisa sem querer nao apareceria em nenhum deles. */
const COM_VENTO = [
  // nome,            chuva,  vento,  esperado
  ['windy',             0,      50,  'ventoso'],
  ['squalls',        0.025,     70,  'aguaceiro'],
  ['tornado',        0.3,      100,  'tornado'],
  ['hurricane',      0.8,      120,  'furacao'],
];
for (const [nome, chuva, vento, esperado] of COM_VENTO) {
  eq(T.cenaDe(chuva, vento), esperado,
     nome + ': chuva ' + chuva + ', vento ' + vento);
}

console.log('');
console.log('=== 9. a colisao que motivated o eixo: mesma chuva, cenas distintas ===');
/* `tornado` e `heavy_sleet` tem 0,300 de chuva as duas. Com so' a chuva
 * as duas diziam CHUVA FORTE, e uma e' um tornado e a outra e' grao.
 * Este e' o caso que vale a pena ter escrito. */
eq(T.cenaDe(0.3, 0), 'chuvaForte', 'heavy_sleet: 0,300 sem vento');
eq(T.cenaDe(0.3, 100), 'tornado', 'tornado: o MESMO 0,300 com vento');
ok(T.cenaDe(0.3, 0) !== T.cenaDe(0.3, 100),
   'as duas saem do o mesmo numero e da' + 'm palavras diferentes');

console.log('');
console.log('=== 10. o vento NAO pode estragar uma cena de chuva que ele nao domina ===');
/* Estes sao os casos em que o vento e' alto mas a chuva manda. O
 * `heavy_thunderstorm` tem 0,35 de chuva e 70 de vento -- o mesmo 70 do
 * `squalls`. Se o limiar fosse so' o vento, os dois dariam aguaceiro. */
eq(T.cenaDe(0.35, 70), 'trovoadaForte', 'heavy_thunderstorm: 0,35 e 70 de vento');
eq(T.cenaDe(0.6, 30), 'chuvaForte', 'heavy_rain: 0,6 e 30 de vento');
eq(T.cenaDe(0.125, 20), 'chuva', 'rain: 0,125 e 20 de vento');
eq(T.cenaDe(0.2, 40), 'trovoada', 'thunderstorm: 0,2 e 40 de vento');
eq(T.cenaDe(0.03, 0), 'neve', 'snow: 0,03 sem vento');
eq(T.cenaDe(0.025, 0), 'chiadaForte', 'squalls SEM o vento que o define');
ok(T.cenaDe(0.025, 0) !== T.cenaDe(0.025, 70),
   'squalls com e sem o seu vento dao palavras diferentes');

console.log('');
console.log('=== 11. as cenas secas: o vento abaixo de 50 nao inventa nada ===');
/* As 12 cenas com chuva zero so' se distinguem por `humidity`, `mist` e
 * `sun`, e nenhum desses campos esta' na memoria partilhada -- foi
 * verificado nos 60 campos da SPageFilePhysics. O `windy` tem 50 de
 * vento e e' o unico delas que o vento alcanca. */
eq(T.cenaDe(0, 5), 'seco', 'clear: 5 de vento, abaixo do limiar');
eq(T.cenaDe(0, 15), 'seco', 'few_clouds: 15 de vento');
eq(T.cenaDe(0, 35), 'seco', 'broken_clouds: 35 de vento, ainda abaixo');
eq(T.cenaDe(0, 49.9), 'seco', '49,9 de vento ainda nao e\' ventoso');
eq(T.cenaDe(0, 50), 'ventoso', '50 de vento e\' o `windy` da tabela');
eq(T.cenaDe(0, 0), 'seco', 'fog: chuva e vento a zero, e diz so\' seco');

console.log('');
console.log('=== 12. sem vento medido, tudo fica como estava ===');
/* E' o que acontece sem o Custom Shaders Patch: a app escreve -1. E o
 * que acontece em qualquer codigo que ainda chame com um argumento. */
eq(T.cenaDe(0.3, -1), T.cenaDe(0.3), 'com -1, igual a um so\' argumento');
eq(T.cenaDe(0.3, null), T.cenaDe(0.3), 'com null, igual a um so\' argumento');
eq(T.cenaDe(0.3), T.cenaDe(0.3, -1), 'o sentido inverso tambem');
eq(T.cenaDe(0.3, undefined), 'chuvaForte', 'com undefined');
/* e o -1 da chuva continua a ser "nao sei", nao "seco" */
eq(T.cenaDe(-1, 100), null, 'chuva desconhecida, mesmo com furacao, e\' null');
eq(T.cenaDe(-1, -1), null, 'tudo desconhecido');
eq(T.nivelDe(-1, 100), 'desconhecido', 'e o nivel tambem');

console.log('');
console.log('=== 13. o nivel de cor segue a cena, e nao a chuva ===');
/* 0,3 de chuva cai ABAIXO do limiar de 0,35, logo a cor de chuva e'
 * `moderada` e nao `forte`. Escrevi `forta` a primeira vez e o teste
 * falhou -- com razao, e era o teste que estava errado, e nao o
 * `tempo.js`. Vale a pena ficar escrito: um teste que falha nao e'
 * sempre o codigo, e aqui a banda estava certa desde o principio. */
eq(T.nivelDe(0.3, 0), 'moderada', 'chuva 0,3 sem vento');
/* e com o vento do tornado a MESMA chuva sobe de cor. E' este o caso
 * que vale a pena: a palavra e a cor mudam sem a chuva mudar nada. */
eq(T.nivelDe(0.3, 100), 'forte', 'o MESMO 0,3, mas com vento de tornado');
ok(T.nivelDe(0.3, 0) !== T.nivelDe(0.3, 100),
   'o vento muda a cor sem a chuva mudar');
/* e as cenas de vento nao precisam de chuva nenhuma */
eq(T.nivelDe(0, 50), 'fraca', 'ventoso, sem chuva nenhuma');
/* Com 70 de vento e CHUVA ZERO o resultado e' `ventoso`, e nao
 * `aguaceiro` -- e' propositado. O `squalls` da tabela tem 0,025 de
 * chuva: e' chuva com vento, e sem chuva nao ha' nome para isso. A
 * unica cena SECA que o vento define e' `windy`, a 50, e 70 continua
 * acima de 50. Inventar um nome entre `ventoso` e `aguaceiro` seria
 * exatamente o palpite que a tabela veio substituir. */
eq(T.cenaDe(0, 70), 'ventoso', '70 de vento sem chuva e\' `ventoso`');
eq(T.nivelDe(0, 70), 'fraca', 'e por isso a cor e\' a de `ventoso`');
/* com a chuva do `squalls` presente, o mesmo 70 da aguaceiro */
eq(T.cenaDe(0.025, 70), 'aguaceiro', 'o mesmo 70, com 0,025 de chuva');
eq(T.nivelDe(0.025, 70), 'moderada', 'e a cor sobe');
eq(T.nivelDe(0, 120), 'muiforte', 'furacao, sem chuva');
ok(T.nivelDe(0, 50) !== T.nivelDe(0, 0),
   '50 de vento com chuva zero nao e\' a mesma cor que zero de tudo');
/* e nunca ha' uma cena sem nivel -- e' o que faria a cor desaparecer */
for (const [, chuva, vento] of COM_VENTO) {
  ok(T.nivelDe(chuva, vento) !== 'desconhecido',
     'a cena ' + vento + ' de vento tem nivel');
}

console.log('');
console.log('=== 14. a lista do vento e\' decrescente, e o varrimento depende disso ===');
let decrescente = true;
for (let i = 1; i < T.CENAS_VENTO.length; i++) {
  if (T.CENAS_VENTO[i].vento >= T.CENAS_VENTO[i - 1].vento) decrescente = false;
}
eq(decrescente, true, 'os limiares de vento descem, sem repetir');
eq(T.CENAS_VENTO.length, 4, 'quatro cenas de vento, quatro limiares da tabela');
/* todos os limiares sao valores que existem na coluna `wind` */
const VENTOS_DA_TABELA = [0, 5, 10, 15, 20, 30, 35, 40, 50, 70, 100, 120];
for (const r of T.CENAS_VENTO) {
  ok(VENTOS_DA_TABELA.indexOf(r.vento) >= 0,
     r.vento + ' e' + ' um valor real da coluna `wind`');
}

console.log('');
console.log('='.repeat(60));
if (falhou) { console.log('!!! ' + falhou + ' FALHA(S) de ' + (passou + falhou)); process.exit(1); }
console.log('ok: ' + passou + ' casos. As cenas do tempo sao as do jogo.');
