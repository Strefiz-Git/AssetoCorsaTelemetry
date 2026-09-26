/* Testes da estimativa da vida do pneu (static/tyres.js).
 *
 * Corre com node, sem browser:  node tests\test_tyres.js
 *
 * Aqui testam-se as aritmeticas e os reinicios de stint. O que NAO se
 * testa aqui e se a estimativa bate com a realidade -- isso mede-se a
 * conduzir, e o veredito fica visivel no site.
 */
'use strict';
const path = require('path');
const P = require(path.join(__dirname, '..', 'static', 'tyres.js'));

let ok = 0, n = 0;
function eq(recebido, esperado, msg) {
  n++;
  const a = JSON.stringify(recebido), b = JSON.stringify(esperado);
  if (a === b) { ok++; console.log('  OK     ' + msg); }
  else { console.log('  FALHA  ' + msg + '\n          esperado ' + b + '\n          recebido ' + a); }
}
function perto(recebido, esperado, tol, msg) {
  n++;
  if (recebido != null && Math.abs(recebido - esperado) <= tol) {
    ok++; console.log('  OK     ' + msg);
  } else {
    console.log('  FALHA  ' + msg + '\n          esperado ~' + esperado + ' (+-' + tol + ')\n          recebido ' + recebido);
  }
}
function hdr(t) { console.log('\n' + t); }

const quatro = (v) => [v, v, v, v];

/* ------------------------------------------------------------- sem dados */
hdr('sem dados suficientes');
let e = null;
let r = P.estimarPneus(null, { compound: 'M', volta: 0, restantePorPneu: quatro(100) });
eq(r.valido, false, 'um so ponto nao dá estimativa');
eq(r.voltasRestantes, null, 'e o numero de voltas e null, nunca 0');
eq(r.confiavel, false, 'e diz que nao confia');

r = P.estimarPneus(e, { compound: 'M', volta: 0, restantePorPneu: quatro(100) });
eq(r.valido, false, 'ainda um ponto so apos guardar o estado');
e = r.estado;

/* -------------------------------------------------------------- desgaste */
hdr('com o desgaste medido');
// um stint que gasta 2% por volta
e = P.estimarPneus(null, { compound: 'M', volta: 0, restantePorPneu: quatro(100) }).estado;
r = P.estimarPneus(e, { compound: 'M', volta: 1, restantePorPneu: quatro(98) });
perto(r.porVolta, 2, 0.001, 'gasta 2% por volta');
perto(r.voltasRestantes, 49, 0.5, 'faltam 49 voltas de vida');
eq(r.confiavel, false, 'com uma volta medida ainda nao se confia');
eq(r.voltasNoStint, 1, 'conta a volta do stint');

e = r.estado;
r = P.estimarPneus(e, { compound: 'M', volta: 2, restantePorPneu: quatro(96) });
perto(r.porVolta, 2, 0.001, 'continua a 2% por volta');
perto(r.voltasRestantes, 48, 0.5, 'faltam 48');
eq(r.confiavel, true, 'com duas voltas medidas já confia');
eq(r.voltasNoStint, 2, 'duas voltas no stint');

/* --------------------------------------------------- o pneu mais gasto */
hdr('o pneu mais gasto manda');
e = P.estimarPneus(null, { compound: 'M', volta: 0, restantePorPneu: quatro(100) }).estado;
r = P.estimarPneus(e, { compound: 'M', volta: 1, restantePorPneu: [100, 100, 100, 90] });
perto(r.restante, 90, 0.001, 'o restante e' + ' o do pior pneu');
perto(r.porVolta, 10, 0.001, 'e o desgaste medido pelo mesmo');
perto(r.voltasRestantes, 9, 0.5, 'e as voltas sao as desse');

// so tres valores: o que falta nao pode estragar
r = P.estimarPneus(e, { compound: 'M', volta: 2, restantePorPneu: [null, 96, 96, null] });
perto(r.restante, 96, 0.001, 'com valores em falta usa os que chegaram');

/* ---------------------------------------------------------- caixa nova */
hdr('pneus novos (box)');
// cenario real: 3 voltas gastas (100 -> 88) e depois uma troca
e = P.estimarPneus(null, { compound: 'M', volta: 0, restantePorPneu: quatro(100) }).estado;
e = P.estimarPneus(e, { compound: 'M', volta: 1, restantePorPneu: quatro(96) }).estado;
e = P.estimarPneus(e, { compound: 'M', volta: 2, restantePorPneu: quatro(92) }).estado;
e = P.estimarPneus(e, { compound: 'M', volta: 3, restantePorPneu: quatro(88) }).estado;
r = P.estimarPneus(e, { compound: 'M', volta: 3, restantePorPneu: quatro(88) });
perto(r.porVolta, 4, 0.001, 'antes da box: 4% por volta');
perto(r.voltasRestantes, 22, 0.5, 'faltavam 22 voltas');

// a box: o desgaste salta de 88 para 100
r = P.estimarPneus(r.estado, { compound: 'M', volta: 4, restantePorPneu: quatro(100) });
eq(r.valido, false, 'a troca de pneus reinicia a medicao');
eq(r.voltasNoStint, 0, 'o stint recomeca a zero');
perto(r.estado.restante0, 100, 0.001, 'e a referencia volta a 100');

// e o estado tem de ser o novo, senao a proxima volta mede a partir do velho
e = r.estado;
r = P.estimarPneus(e, { compound: 'M', volta: 5, restantePorPneu: quatro(98) });
perto(r.porVolta, 2, 0.001, 'a volta seguinte mede a partir dos pneus novos');
eq(r.voltasNoStint, 1, 'e conta a volta desde a box');

/* ----------------------------------------------------- fim de sessao */
hdr('mudanca de sessao');
e = P.estimarPneus(null, { compound: 'M', volta: 8, restantePorPneu: quatro(84) }).estado;
r = P.estimarPneus(e, { compound: 'M', volta: 0, restantePorPneu: quatro(84) });
eq(r.valido, false, 'a volta a andar para tras reinicia');
eq(r.voltasNoStint, 0, 'stint a zero');

/* -------------------------------------------------------- composto novo */
hdr('composto diferente');
e = P.estimarPneus(null, { compound: 'M', volta: 0, restantePorPneu: quatro(100) }).estado;
r = P.estimarPneus(e, { compound: 'S', volta: 1, restantePorPneu: quatro(80) });
eq(r.valido, false, 'mudar de composto reinicia a medicao');
eq(r.estado.compound, 'S', 'e guarda o composto novo');

/* -------------------------------------------------------------- ruido */
hdr('pneus que nao gastam (so testes)');
e = P.estimarPneus(null, { compound: 'M', volta: 0, restantePorPneu: quatro(100) }).estado;
r = P.estimarPneus(e, { compound: 'M', volta: 3, restantePorPneu: quatro(100) });
eq(r.valido, false, 'sem desgaste medido nao há estimativa');
eq(r.voltasRestantes, null, 'e nunca se divide por zero');

// desgaste abaixo do ruido de arredondamento
e = P.estimarPneus(null, { compound: 'M', volta: 0, restantePorPneu: quatro(100) }).estado;
r = P.estimarPneus(e, { compound: 'M', volta: 10, restantePorPneu: quatro(99.9) });
eq(r.valido, false, '0,01% por volta esta dentro do ruido');

/* ------------------------------------------------------------- entradas */
hdr('entradas a mais ou a menos');
r = P.estimarPneus(null, { compound: 'M', volta: 0, restantePorPneu: [] });
eq(r.valido, false, 'lista vazia');
r = P.estimarPneus(null, { compound: 'M', volta: 0, restantePorPneu: [null, null, null, null] });
eq(r.valido, false, 'tudo nulo');
r = P.estimarPneus(null, null);
eq(r.valido, false, 'sem dados de todo');
r = P.estimarPneus(null, { compound: 'M', volta: 0, restantePorPneu: [NaN, 50, 50, 50] });
perto(r.restante, 50, 0.001, 'NaN e ignorado, os outros contam');

/* --------------------------------------------------------- plausibilidade */
/* O caso REAL medido no Mugello com um Alpine A424: o campo tyreWear
   dava 0,17% de desgaste ao fim de duas voltas. Projetado, isso dava 588
   voltas de vida, e um stint e' da ordem das 10 a 30. O numero e' sem
   sentido, e o que o sitio escreve tem de ser "nao da" e nao 588. */
hdr('numeros que nao sao plausiveis para um stint');
e = P.estimarPneus(null, { compound: 'Medium (M)', volta: 0, restantePorPneu: [100, 100, 100, 100] }).estado;
e = P.estimarPneus(e, { compound: 'Medium (M)', volta: 1, restantePorPneu: [99.9, 99.9, 99.9, 99.9] }).estado;
r = P.estimarPneus(e, { compound: 'Medium (M)', volta: 2, restantePorPneu: [99.83, 99.83, 99.83, 99.83] });
eq(r.valido, false, 'com 0,17% por volta NAO da um numero');
eq(r.impossivel, true, 'e diz que o numero e\' impossivel');
eq(r.voltasRestantes, null, 'e nao devolve 588 voltas');
perto(r.porVolta, 0.085, 0.001, 'mas o desgaste medido fica visivel para diagnostico');

// um desgaste de 3% por volta, que e' plausivel, continua a passar
e = P.estimarPneus(null, { compound: 'M', volta: 0, restantePorPneu: quatro(100) }).estado;
e = P.estimarPneus(e, { compound: 'M', volta: 1, restantePorPneu: quatro(97) }).estado;
r = P.estimarPneus(e, { compound: 'M', volta: 2, restantePorPneu: quatro(94) });
eq(r.valido, true, '3% por volta e\' plausivel');
perto(r.voltasRestantes, 31, 0.5, 'e da 31 voltas');

// um stint de resistencia: 1,2% por volta ainda passa
e = P.estimarPneus(null, { compound: 'M', volta: 0, restantePorPneu: quatro(100) }).estado;
e = P.estimarPneus(e, { compound: 'M', volta: 1, restantePorPneu: quatro(98.8) }).estado;
r = P.estimarPneus(e, { compound: 'M', volta: 2, restantePorPneu: quatro(97.6) });
eq(r.valido, true, '1,2% por volta ainda e\' um stint');

// o limite de 150 voltas: 0,5% por volta projetaria 200
e = P.estimarPneus(null, { compound: 'M', volta: 0, restantePorPneu: quatro(100) }).estado;
e = P.estimarPneus(e, { compound: 'M', volta: 1, restantePorPneu: quatro(99.5) }).estado;
r = P.estimarPneus(e, { compound: 'M', volta: 2, restantePorPneu: quatro(99.0) });
eq(r.valido, false, '0,5% por volta projetaria 200 voltas: acima do limite');
eq(r.impossivel, true, 'e marcado como impossivel');

// 0,7% por volta da 142 voltas: passa o teste do ritmo, e cabe no limite
e = P.estimarPneus(null, { compound: 'M', volta: 0, restantePorPneu: quatro(100) }).estado;
e = P.estimarPneus(e, { compound: 'M', volta: 1, restantePorPneu: quatro(99.3) }).estado;
r = P.estimarPneus(e, { compound: 'M', volta: 2, restantePorPneu: quatro(98.6) });
eq(r.valido, true, '0,7% por volta, 142 voltas: ainda dentro do razoavel');

/* --------------------------------------------------------------------- */
console.log('\n' + (ok === n ? 'OK' : 'FALHA') + ': ' + ok + '/' + n + ' testes da vida do pneu passaram.');
process.exit(ok === n ? 0 : 1);
