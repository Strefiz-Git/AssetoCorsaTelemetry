/* Testa static/tempos.js sem browser. Corre com:  node tests/test_tempos.js
 *
 * A matematica das voltas e' o que o olho do utilizador mais olha (o
 * delta anda ou nao anda?), e ate agora nao tinha nenhum teste. Esta
 * ficheiro e' o mesmo conjunto de casos que tests/test_tempos.html, para
 * quem prefira abrir no browser.
 *
 * Os valores esperados foram calculados a mao. Ja aconteceu de a
 * expectativa estar errada e o codigo certo (duas vezes), por isso cada
 * caso esta escrito com a conta ao lado.
 */
'use strict';

const path = require('path');
const T = require(path.join(__dirname, '..', 'static', 'tempos.js'));

const { toSec, deltaParaRef, melhorTempo, VOLTA_MINIMA_S } = T;

let n = 0;
const falhas = [];

function ok(nome, obtido, esperado) {
  n++;
  const bom = (typeof esperado === 'number')
    ? Math.abs(obtido - esperado) < 1e-6
    : obtido === esperado;
  if (!bom) falhas.push(nome + ': esperava ' + esperado + ', obtive ' + obtido);
  console.log('  ' + (bom ? 'OK   ' : 'FALHOU') + '  ' + nome +
    (bom ? '' : '   <<< ' + obtido));
}
const nulo = (nome, v) => ok(nome, v === null ? 'null' : v, 'null');

/* --- 1) toSec: o AC formata "M:SS.mmm", volta nunca passa de 59:59 --- */
ok('toSec 01:23.456  (83 + 456/1000)', toSec('01:23.456'), 83.456);
ok('toSec 00:00.000', toSec('00:00.000'), 0);
ok('toSec 59:59.999  (3599 + 999/1000)', toSec('59:59.999'), 3599.999);
ok('toSec 9:05.500   (minutos de 1 digito)', toSec('9:05.500'), 545.5);
ok('toSec 10:00.001  (10 min + 1 ms)', toSec('10:00.001'), 600.001);
nulo('toSec vazio', toSec(''));
nulo('toSec null', toSec(null));
nulo('toSec sem tempos (--:--.---)', toSec('--:--.---'));
nulo('toSec lixo', toSec('abc'));
nulo('toSec sem milissegundos', toSec('01:23'));
nulo('toSec com horas (formato que o AC nao usa)', toSec('1:01:05.250'));

/* --- 2) delta contra uma referencia que NAO e' linear ------------------ */
/* duas rectas com ritmos diferentes, para nao testar so o caso facil */
function refNaoLinear(nPontos) {
  const r = [];
  for (let i = 0; i <= nPontos; i++) {
    const p = i / nPontos;                                    // 0..1
    const t = p < 0.5 ? p * 120 : 60 + (p - 0.5) * 80;        // 0..60 s, depois 60..100 s
    r.push([p, t]);
  }
  return r;
}
const ref = refNaoLinear(400);

/* a referencia reproduzida tem de dar exactamente zero em todo o sitio */
let pior = 0;
for (const p of ref) {
  const d = deltaParaRef(ref, p[0], p[1]);
  if (d !== null && Math.abs(d) > Math.abs(pior)) pior = d;
}
ok('a propria referencia da delta 0 (pior erro em 401 pontos)', pior, 0);

/* um offset constante da sempre o mesmo delta, seja onde for */
ok('0.4 s mais lento na 1a recta', deltaParaRef(ref, 0.25, ref[100][1] + 0.4), 0.4);
ok('0.4 s mais lento na 2a recta', deltaParaRef(ref, 0.75, ref[300][1] + 0.4), 0.4);
ok('0.4 s mais lento na viragem', deltaParaRef(ref, 0.5, 60.0 + 0.4), 0.4);
ok('1.9 s mais rapido', deltaParaRef(ref, 0.25, ref[100][1] - 1.9), -1.9);

/* entre dois pontos tem de interpolar, nao devolver o valor de um vertex.
   A referencia tem 401 pontos, espacados de 0.0025. Entre ref[100] e
   ref[101]: p = 0.25 -> 30.0 s e p = 0.2525 -> 30.3 s. A meio
   (p = 0.25125) o tempo da referencia e' 30.15 s. Passando 30.65 s o
   delta tem de ser +0.5 s. */
const MEIO_P = (ref[100][0] + ref[101][0]) / 2;              // 0.25125
const MEIO_T = (ref[100][1] + ref[101][1]) / 2;              // 30.15
ok('o ponto de teste esta no sitio certo', MEIO_T, 30.15);
ok('interpola entre dois pontos', deltaParaRef(ref, MEIO_P, MEIO_T + 0.5), 0.5);
ok('interpola, mais rapido', deltaParaRef(ref, MEIO_P, MEIO_T - 2.25), -2.25);

/* fora da referencia: null em vez de um numero inventado */
nulo('antes do inicio da referencia', deltaParaRef(ref, -0.02, 1.0));
nulo('depois do fim da referencia', deltaParaRef(ref, 1.02, 1.0));
nulo('sem referencia nenhuma', deltaParaRef(null, 0.5, 50));
nulo('referencia vazia', deltaParaRef([], 0.5, 50));
nulo('referencia com 3 pontos (de menos)', deltaParaRef([[0, 0], [0.5, 50], [1, 100]], 0.5, 50));

/* referencia com os 4 pontos de minimum. p = 0.5 esta entre 0.33 e 0.66,
   therefore f = 0.17/0.33 e o tempo da referencia e' 30 + 40*f. */
const fMin = (0.5 - 0.33) / (0.66 - 0.33);
ok('referencia no minimo de 4 pontos',
   deltaParaRef([[0, 0], [0.33, 30], [0.66, 70], [1, 100]], 0.5, 51),
   51 - (30 + 40 * fMin));

/* --- 3) a melhor volta so pode melhorar ------------------------------- */
/* O limite e' EXCLUSIVO: uma volta tem de passar dos 20 s para valer.
   Coincide com o que o app.js fazia antes (timeSec > 20), e 20.0 s
   exactos sao de qualquer forma um outlier. */
ok('sem melhor volta ainda, aceita 95 s', melhorTempo(null, 95), 95);
ok('volta mais rapida passa a melhor', melhorTempo(100, 95), 95);
ok('volta mais lenta nao mexe', melhorTempo(95, 100), null);
ok('volta igual nao mexe', melhorTempo(95, 95), null);
ok('volta de 20.1 s aceite', melhorTempo(null, 20.1), 20.1);
nulo('volta de 20.0 s recusada (limite exclusivo)', melhorTempo(null, 20.0));
nulo('volta de 19.9 s recusada', melhorTempo(90, 19.9));
nulo('volta de 3 s recusada (sessao nova, sector solto)', melhorTempo(90, 3));
nulo('volta nula nao mexe', melhorTempo(90, null));
ok('o limite esta documentado no codigo', VOLTA_MINIMA_S, 20);

/* --- fecho ------------------------------------------------------------- */
console.log();
if (falhas.length) {
  console.log('!!! ' + falhas.length + ' de ' + n + ' FALHARAM !!!');
  process.exit(1);
}
console.log('OK: ' + n + '/' + n + ' testes de tempos e delta passaram.');
