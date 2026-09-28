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
const T = require(path.join(__dirname, '..', 'static', 'nucleo', 'tempos.js'));

const { toSec, deltaParaRef, melhorTempo, empilharPonto, VOLTA_MINIMA_S,
        intervaloAoVivo, novoRastreadorPosicoes, corridaArranca, registarPosicoes,
        diferencaPosicao, novoRastreadorTracos, registarTraco, intervaloPreciso } = T;

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

/* --- 4) empilharPonto: a volta tem de ficar INTEIRA -------------------- */
/* Este e' o bug que a captura ao vivo apanhou. Uma volta de 116 s a 60 Hz
   da 6960 pontos. Com um limite de 4000 e a deitar fora os mais antigos,
   a referencia ficava a comecar em 22.6% da pista: sem delta no primeiro
   quarto, e um degrau de -4.9 s na fronteira. Aqui o limite e' largo de
   PROPOSITO, para o caso geral ficar testado. */
const MAX = 12000;

/* 4a) uma volta normal cabe inteira, sem mexer */
let v = [];
for (let i = 0; i <= 3000; i++) v = empilharPonto(v, i / 3000, i * 0.03, MAX);
ok('volta de 3001 pontos fica com 3001', v.length, 3001);
ok('volta comeca em 0', v[0][0], 0);
ok('volta acaba em 1', v[v.length - 1][0], 1);

/* 4b) uma volta enorme e' reduzida, mas o inicio continua la */
v = [];
for (let i = 0; i <= 24000; i++) v = empilharPonto(v, i / 24000, i * 0.005, MAX);
ok('nunca passa do limite', v.length <= MAX, true);
ok('o inicio da volta sobrevive', v[0][0], 0);
ok('o fim da volta sobrevive', v[v.length - 1][0], 1);
ok('ainda ha pontos suficientes', v.length > MAX / 4, true);

/* 4c) o que interessa mesmo: a delta responde em TODO o percurso.
   Nao se pode verificar em TODOS os pontos: a deltaParaRef procura o
   intervalo com um varrimento linear, portanto chamar-lhe uma vez por
   ponto de uma referencia de 12 000 sao 144 milhoes de iteracoes e o
   teste nao acaba. Aqui vai uma amostra de 200. */
let cur = [];
for (let i = 0; i <= 24000; i++) cur = empilharPonto(cur, i / 24000, i * 0.005, MAX);
ok('a delta responde no inicio da pista', deltaParaRef(cur, 0.02, 2.4) !== null, true);
ok('a delta responde a meio', deltaParaRef(cur, 0.5, 60) !== null, true);
ok('a delta responde no fim', deltaParaRef(cur, 0.98, 117.6) !== null, true);
ok('a propria volta da delta 0 numa amostra de 200 pontos', (() => {
  let pior = 0, n = 0;
  for (let k = 0; k < 200; k++) {
    const p = cur[Math.floor(k * (cur.length - 1) / 199)];
    const d = deltaParaRef(cur, p[0], p[1]);
    if (d !== null) { n++; pior = Math.max(pior, Math.abs(d)); }
  }
  return n === 200 && Math.abs(pior) < 1e-6;
})(), true);

/* 4d) a reducao tem de ser por metades, nao por saltinhos */
let contagens = [];
v = [];
for (let i = 0; i <= 5000; i++) {
  v = empilharPonto(v, i / 5000, i * 0.03, 4000);
  if (v.length !== contagens[contagens.length - 1]) contagens.push(v.length);
}
ok('ao passar de 4000, o tamanho cai para cerca de metade',
   contagens[1] <= 2600, true);
ok('e fica sempre dentro do limite', Math.max(...contagens) <= 4000, true);

/* ================================================== intervalo ao vivo */
console.log('\n--- intervalo ao vivo (leaderboard) ---');

const TL = 5000; // metros, so' para o teste
const ritmo30 = 30 / TL; // 30 s por volta => 0,006 s por metro

function intervalo(o) { return intervaloAoVivo(Object.assign({ trackLength: TL }, o)); }
function intTxt(r) {
  if (r == null) return 'null';
  if (r.voltas !== 0) return 'L ' + (r.voltas > 0 ? '+' : '') + r.voltas;
  return (r.seg >= 0 ? '+' : '-') + r.seg.toFixed(1);
}

ok('dez por cento da pista, a 30 s por volta, da 3 segundos',
   intTxt(intervalo({ lapF: 2, pctF: 0.50, lapT: 2, pctT: 0.40, ritmoF: ritmo30 })), '+3.0');
ok('mesmo ponto da zero', intTxt(intervalo({ lapF: 2, pctF: 0.50, lapT: 2, pctT: 0.50, ritmoF: ritmo30 })), '+0.0');

ok('uma volta de vantagem mostra L +1',
   intTxt(intervalo({ lapF: 3, pctF: 0.10, lapT: 2, pctT: 0.10, ritmoF: ritmo30 })), 'L +1');
ok('tres voltas de vantagem',
   intTxt(intervalo({ lapF: 5, pctF: 0.10, lapT: 2, pctT: 0.10, ritmoF: ritmo30 })), 'L +3');
ok('uma volta de atraso mostra L -1',
   intTxt(intervalo({ lapF: 1, pctF: 0.10, lapT: 2, pctT: 0.10, ritmoF: ritmo30 })), 'L -1');

ok('da frente atras mas ja cruzou a meta: de 90% a 10% sao 20% da pista',
   intTxt(intervalo({ lapF: 2, pctF: 0.10, lapT: 2, pctT: 0.90, ritmoF: ritmo30 })), '+6.0');

ok('sem volta conhecida usa a velocidade (500 m a 50 m/s)',
   intTxt(intervalo({ lapF: 2, pctF: 0.50, lapT: 2, pctT: 0.40, velT: 50 })), '+10.0');
ok('parado usa o piso de 18 m/s (500 m / 18)',
   intTxt(intervalo({ lapF: 2, pctF: 0.50, lapT: 2, pctT: 0.40, velT: 0 })), '+27.8');
ok('a 2 m/s tambem usa o piso: dividir por 2 daria 250 s',
   intTxt(intervalo({ lapF: 2, pctF: 0.50, lapT: 2, pctT: 0.40, velT: 2 })), '+27.8');
ok('velocidade negativa conta o valor absoluto',
   intTxt(intervalo({ lapF: 2, pctF: 0.50, lapT: 2, pctT: 0.40, velT: -50 })), '+10.0');

nulo('pista de comprimento zero', intervalo({ trackLength: 0, lapF: 1, pctF: 0.5, lapT: 1, pctT: 0.4 }));
nulo('faltam dados da posicao', intervalo({ trackLength: TL, lapF: null, pctF: 0.5, lapT: 1, pctT: 0.4 }));
nulo('NaN na posicao', intervalo({ trackLength: TL, lapF: 1, pctF: NaN, lapT: 1, pctT: 0.4 }));
nulo('sem argumentos', intervaloAoVivo(null));

/* -------------------------------------------------- setas de posicao */
console.log('\n--- setas de posicao ---');

// A largada e' um instante, nao um estado. Sem isto, guardar a posicao de
// largada em todos os frames repunha a referencia 60 vezes por segundo e
// as setas nunca apareciam -- que e' o que se passou na primeira versao.
let rast = novoRastreadorPosicoes(40);
ok('antes da largada nao ha\' subida', corridaArranca(rast, false), false);
ok('a largada e\' detectada', corridaArranca(rast, true), true);
ok('e so\' uma vez, nao a cada frame', corridaArranca(rast, true), false);

registarPosicoes(rast, 7, 5, 100);
ok('acabei de largar: sem seta', diferencaPosicao(rast, 7, 5), 0);
ok('ganhei duas posicoes', diferencaPosicao(rast, 7, 3), 2);
ok('perdi tres posicoes', diferencaPosicao(rast, 7, 8), -3);
ok('carro que nunca vi: sem seta', diferencaPosicao(rast, 99, 3), 0);
ok('posicao zero (a volta ainda nao conta)', diferencaPosicao(rast, 7, 0), 0);

// uma segunda largada limpa as referencias: e' o que acontece quando se
// reinicia a corrida
corridaArranca(rast, false);
ok('a corrida parou', corridaArranca(rast, true), true);
rast.inicio = {};
registarPosicoes(rast, 7, 2, 200);
ok('apos reiniciar, a contagem recomeca', diferencaPosicao(rast, 7, 2), 0);

/* ------------------------------------------------ intervalo exacto (CMRT) */
console.log('\n--- intervalo exacto (traco por carro) ---');

/* carro 5 faz uma volta de 100 s a ritmo constante: 1 s por cada 1% */
let tr = novoRastreadorTracos();
for (let i = 0; i <= 100; i++) registarTraco(tr, 5, i / 100, i, 1);

ok('a 60% da pista o carro 5 ia aos 60 s', intervaloPreciso(tr, 5, 0.60), 100 - 60);
ok('a 10% da pista o carro 5 ia aos 10 s', intervaloPreciso(tr, 5, 0.10), 100 - 10);
ok('interpola entre amostras (25.5%)', intervaloPreciso(tr, 5, 0.255), 100 - 25.5);
nulo('carro que nunca se viu', intervaloPreciso(tr, 99, 0.5));
nulo('sem tracos nenhuns', intervaloPreciso(novoRastreadorTracos(), 5, 0.5));

/* uma nova volta (lap muda) apaga o traco antigo - com so' 2 pontos ainda
   nao chega para responder, tem de cair para a estimativa por ritmo */
registarTraco(tr, 5, 0.01, 0.2, 2);
registarTraco(tr, 5, 0.02, 0.4, 2);
nulo('volta nova ainda tem poucos pontos', intervaloPreciso(tr, 5, 0.5));

/* o traco de um carro nao mistura com o de outro */
for (let i = 0; i <= 100; i++) registarTraco(tr, 6, i / 100, 999 + i, 2);
ok('carros diferentes tem tracos independentes',
   intervaloPreciso(tr, 6, 0.5) !== null && intervaloPreciso(tr, 5, 0.5) === null, true);

/* recuar mais de meia pista sem o 'lap' ainda ter mudado tambem conta como
   volta nova (o mesmo sintoma que a propria volta do jogador trata) */
let tr2 = novoRastreadorTracos();
for (let i = 0; i <= 50; i++) registarTraco(tr2, 1, i / 100, i, 3); // 0% a 50%, ainda no lap 3
registarTraco(tr2, 1, 0.02, 200, 3); // "voltou" a 2% sem o lap mudar: e' volta nova
ok('recuo grande de posicao reinicia o traco mesmo com o mesmo lap',
   intervaloPreciso(tr2, 1, 0.30), null);

/* --- fecho ------------------------------------------------------------- */
console.log();
if (falhas.length) {
  console.log('!!! ' + falhas.length + ' de ' + n + ' FALHARAM !!!');
  process.exit(1);
}
console.log('OK: ' + n + '/' + n + ' testes de tempos e delta passaram.');
