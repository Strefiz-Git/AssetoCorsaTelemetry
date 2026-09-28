/* Testes dos modulos de jogo do browser, sem browser e sem jogo a correr.
 *
 * Corre com `node tests/test_jogos.js`.
 *
 * ---------------------------------------------------------------------------
 * O QUE ISTO PROVA, E O QUE NAO PROVA
 * ---------------------------------------------------------------------------
 * Prova que os dois modulos obedecem ao MESMO contrato e que as suas
 * regras dao os numeros certos. Nao prova nada sobre o jogo: nenhum
 * destes testes abre o F1 25 nem o Assetto Corsa.
 *
 * E e' por isso que estes testes existem. As regras de um jogo estavam
 * dentro da IIFE do `app.js`, e uma regra dentro do `app.js` so se pode
 * testar com o jogo a correr e olhando para o ecra. Os cortes do clima
 * estavam errados assim durante meses: so' se via o resultado, e ver
 * catorze valores no ecra a cada alteracao nao e' um teste. As regras
 * que mudam com o jogo nao podem estar no sitio onde so ha' um ecra.
 *
 * O que estes testes apanharam da primeira vez:
 *   - as temperaturas dos travões saiam pela ordem errada das rodas, e
 *     a versao anterior do receptor tinha exactamente o mesmo bug. As
 *     outras tres traduções estavam feitas e esta ficou de fora, e quatro
 *     números muito parecidos nao denunciam nada;
 *   - o `pct` do volante do F1 25 vinha a null, e o do AC tambem, o que
 *     fazia os dois paineis iguais onde deviam diferir;
 *   - a chuva do F1 25 sem amostra de previsao dava 0 em vez de null,
 *     e 0 e' "nao chove".
 */
'use strict';
const path = require('path');
const RAIZ = path.join(__dirname, '..', 'static');

/* Carrega os modulos como o browser faria, pela ordem dos <script> do
 * index.html. A ordem importa: `unidades.js` nao depende de nada, e os
 * modulos de jogo dependem dele e do `jogo-base.js`. */
global.globalThis.window = undefined;
require(path.join(RAIZ, 'nucleo', 'unidades.js'));
require(path.join(RAIZ, 'nucleo', 'jogo-base.js'));
/* A escala do Pure Planner e' uma TABELA de dados, e por isso vive em
 * `nucleo/`. O `ac.js` e' que decide usa-la, porque o AC e' o unico
 * dos dois com cenas de tempo. Um modulo que rebentasse ao carregar por
 * depender de uma tabela que o `app.js` carrega a seguir seria um
 * modulo dependente da ordem dos `<script>`, que e' uma forma de
 * falhar so no browser. */
require(path.join(RAIZ, 'nucleo', 'tempo.js'));
require(path.join(RAIZ, 'nucleo', 'tyres.js'));
require(path.join(RAIZ, 'jogos', 'ac.js'));
require(path.join(RAIZ, 'jogos', 'f125.js'));
const U = globalThis.NucleoUnidades;
const AC = globalThis.JogoAC;
const F1 = globalThis.JogoF125;

let passou = 0, falhou = 0;
function eq(a, b, msg) {
  if (a === b) { passou++; console.log('  ok   %s', msg); }
  else { falhou++; console.log('  FALHA  %s', msg);
         console.log('          esperava %j, obtive %j', b, a); }
}
function ok(c, msg) {
  if (c) { passou++; console.log('  ok   %s', msg); }
  else { falhou++; console.log('  FALHA  %s', msg); }
}
/* Comparar ARRAYS com `===` compara a IDENTIDADE, e por isso dois arrays
 * com o mesmo conteudo davam sempre diferente.
 *
 * Nao e' um detalhe: metade deste ficheiro e' sobre a ordem das rodas, e
 * todos esses testes devolvem arrays novos. Com `===` falhavam os seis de
 * uma vez -- e a primeira reacao a ver seis testes de uma vez a falhar e'
 *suspeitar do codigo. Numa versao anterior deste ficheiro foi o que
 * aconteceu, e o "bug" estava aqui no teste.
 *
 * Por isso a comparacao e' por conteudo. O `F1._ordem`, que e' um array
 * congelado com `Object.freeze`, tambem passa por aqui. */
function eqArr(a, b, msg) {
  const x = Array.isArray(a) ? a : null;
  const y = Array.isArray(b) ? b : null;
  if (x && y && x.length === y.length && x.every((v, i) => v === y[i])) {
    passou++; console.log('  ok   %s', msg);
  } else {
    falhou++; console.log('  FALHA  %s', msg);
    console.log('          esperava %s, obtive %s', JSON.stringify(b), JSON.stringify(a));
  }
}
function perto(a, b, tol, msg) {
  ok(Math.abs(a - b) <= tol, msg + '  (' + a + ' vs ' + b + ')');
}

console.log('');
console.log('=== 1. os dois modulos existem e cumprem o contrato ===');
ok(!!AC, 'o modulo do AC carregou');
ok(!!F1, 'o modulo do F1 25 carregou');
eq(AC.id, 'ac', 'o AC diz-se AC');
eq(F1.id, 'f125', 'o F1 25 diz-se F1 25');

/* As funcoes que o `app.js` chama em CADA frame. Uma que falte e' um
 * `undefined is not a function` na consola e um painel meio pintado, e
 * a Regra no 14 do `AGENTS.md` e' exactamente sobre isso: uma coisa que
 * falta e' uma coisa que desaparece em silencio. */
const CONTRATO = ['capacidades', 'embraiagem', 'volante', 'abs', 'tc', 'drs',
                  'vidaPneu', 'tempPneu', 'combustivel', 'clima', 'delta'];
for (const nome of CONTRATO) {
  ok(typeof AC[nome] === 'function', 'o AC tem ' + nome + '()');
  ok(typeof F1[nome] === 'function', 'o F1 25 tem ' + nome + '()');
}

console.log('');
console.log('=== 2. a embraiagem: 0 a 1 no AC, 0 a 100 no F1 25 ===');
/* O painel mostra o INVERSO -- quanto esta' solta. */
eq(AC.embraiagem({ clutchRaw: 1.0 }).txt, 0, 'AC a 1,0 = embraiada, 0 solta');
eq(AC.embraiagem({ clutchRaw: 0.63 }).txt, 37, 'AC a 0,63 da 37% solta (a medida)');
eq(F1.embraiagem({ clutchRaw: 100 }).txt, 0, 'F1 a 100 = embraiada, 0 solta');
eq(F1.embraiagem({ clutchRaw: 63 }).txt, 37, 'F1 a 63 da 37% solta');
/* A mesma embraiagem fisica da o mesmo numero nos dois, apesar das
 * escalas diferentes. E' o teste que prova que a divisao por 100 esta
 * no sitio certo: se estivesse no `app.js`, trocar de jogo trocava um
 * factor de 100 em silencio. */
eq(F1.embraiagem({ clutchRaw: 63 }).txt, AC.embraiagem({ clutchRaw: 0.63 }).txt,
   'a mesma embraiagem da o mesmo numero nos dois jogos');
ok(AC.embraiagem({ clutchRaw: undefined }).semDados,
   'sem embraiagem e\' "sem dados", nao 0');

console.log('');
console.log('=== 3. o volante: radianos no AC, -1 a 1 no F1 25 ===');
eq(AC.volante({ steer: -0.5 }).txt, '-0.50', 'o AC da o numero do angulo');
eq(AC.volante({ steer: -0.5 }).pct, null,
   'e NAO da percentagem: o limite do AC nao esta escrito em lado nenhum');
eq(F1.volante({ steer: -0.5 }).txt, '-0.50', 'o F1 25 da o numero');
eq(F1.volante({ steer: -0.5 }).pct, 50,
   'e DA a percentagem, porque o limite esta na documentacao');
eq(F1.volante({ steer: 1.0 }).pct, 100, 'a fundo a direita e\' 100%');
eq(F1.volante({ steer: -1.0 }).pct, 100, 'a fundo a esquerda tambem');
/* Uma percentagem acima de 100 seria uma barra a transbordar. */
eq(F1.volante({ steer: 1.4 }).pct, 100, 'e limita aos 100% mesmo que o numero passe');

console.log('');
console.log('=== 4. o ABS: nivel no AC, ON/OFF no F1 25 ===');
/* Medido: 0,13 durante 4502 amostras de travagens duras. Mostrar
 * "OFF" a partir de um limiar de 0,5 diria ao piloto que nao tinha ABS
 * quando tem 13%. */
eq(AC.abs({ abs: 0.13 }).txt, 13, 'no AC, abs 0,13 escreve 13%');
eq(AC.abs({ abs: 0.13 }).pct, 13, 'e a barra vai a 13%');
ok(AC.abs({ abs: 0.13 }).txt !== 'OFF', 'e nunca "OFF" com 13% de ABS');
eq(AC.tc({ tc: 0.08 }).txt, 8, 'no AC, tc 0,08 escreve 8%');

/* O F1 25 e' um 0 ou 1. Mostrar "100%" seria inventar um numero. */
eq(F1.abs({ absOnOff: 1 }).txt, 'ABS', 'no F1 25, ligado escreve ABS');
eq(F1.abs({ absOnOff: 1 }).pct, null, 'e NAO escreve 100%');
eq(F1.abs({ absOnOff: 0 }).txt, 'abs.off', 'e desligado escreve off');
eq(F1.tc({ tcModo: 2 }).txt, 'f1.tcCheio', 'o TC no F1 25 e\' um modo: cheio');
eq(F1.tc({ tcModo: 1 }).txt, 'f1.tcMedio', 'e medio');
eq(F1.tc({ tcModo: 0 }).txt, 'abs.off', 'e off, com a MESMA chave que o ABS');
ok(F1.tc({ tcModo: 2 }).pct === null, 'e o TC tambem nao tem percentagem');

console.log('');
console.log('=== 5. o DRS ===');
/* O AC precisa de um veredito medido; o F1 25 nao. */
const drsAC = AC.drs({ drsAvailable: 1, drsEnabled: 0 });
eq(drsAC.vereditoNecessario, true,
   'o AC diz que precisa de medir uma volta antes de pintar');
const drsF1 = F1.drs({ drsAvailable: 1, drsEnabled: 0, drsDistancia: 340 });
eq(drsF1.vereditoNecessario, false,
   'o F1 25 nao precisa: o jogo diz os metros que faltam');
eq(drsF1.txt, '340 m', 'e escreve os metros, que e\' o que o piloto quer');
eq(F1.drs({ drsAvailable: 1, drsEnabled: 1, drsDistancia: 0 }).txt, 'drs.on',
   'ligado escreve ligado');
eq(F1.drs({ drsAvailable: 0, drsEnabled: 0 }).txt, '--',
   'sem zona e sem estar ligado nao escreve nada inventado');
/* O painel do AC sabe o valor de `drs` float tambem, porque a
 * documentacao o da' como 0 ou 1 mas em float. */
eq(AC.drs({ drs: 1, drsEnabled: 0 }).ligado, 1, 'o AC le tambem o `drs` float');
eq(AC.drs({ drsAvailable: 1, drsEnabled: 0 }).ligado, 0,
   'com o flag a zero e o `drs` a zero, o DRS nao esta ligado');

console.log('');
console.log('=== 6. a ORDEM DAS RODAS ===');
/* Este e' o teste mais importante do ficheiro. O F1 25 manda
 * RL, RR, FL, FR; o painel e' FL, FR, RL, RR. As duas ordens desenham
 * uma grelha 2x2 quase simetrica, e um painel ao contrario nao da erro.
 *
 * E os valores sao DIFERENTES em cada canto de proposito: com os quatro
 * iguais, uma ordem errada e' indistinguivel de uma ordem certa, e o
 * teste passaria com o painel ao contrario. */
const JOGO = [11, 22, 33, 44];          /* RL, RR, FL, FR */
const PAINEL = [33, 44, 11, 22];       /* FL, FR, RL, RR */
eqArr(F1._quatro(JOGO), PAINEL, 'a traducao da ordem das rodas');
eqArr(F1._quatro([0, 0, 0, 0]), [0, 0, 0, 0], 'e com os quatro iguais da o mesmo');
eqArr(F1._ordem, ['FL', 'FR', 'RL', 'RR'], 'a ordem do painel esta escrita');

const tF1 = F1.tempPneu({ tyreTempSurface: JOGO, tyreTempInner: JOGO });
eqArr(tF1.superficie, PAINEL, 'a temperatura de superficie sai na ordem do painel');
eqArr(tF1.interior, PAINEL, 'e a interior tambem');
eq(tF1.meio, null, 'o F1 25 nao tem zona "meio"');
eq(tF1.nucleo, null, 'nem zona "nucleo"');

/* O AC ja vem na ordem do painel, e por isso nao traduz. */
const tAC = AC.tempPneu({ tyreTempO: JOGO, tyreTempI: JOGO, tyreTempM: JOGO,
                          tyreCore: JOGO });
eqArr(tAC.superficie, JOGO, 'no AC nao ha traducao: ja vem na ordem do painel');
eqArr(tAC.meio, JOGO, 'e o AC tem a zona do meio, que o F1 25 nao tem');
eqArr(tAC.nucleo, JOGO, 'e a do nucleo');

/* Um array de tamanho errado nao pode rebentar nem devolver lixo. */
eqArr(F1._quatro([1, 2]), [null, null, 1, 2],
   'um array curto nao rebenta: so a RL e a RR, que vao para os sitios 2 e 3');
eqArr(F1._quatro(null), [null, null, null, null], 'e um array ausente da quatro nulos');
eqArr(F1._quatro(undefined), [null, null, null, null], 'e undefined tambem');

console.log('');
console.log('=== 7. a vida do pneu: lida no F1 25, estimada no AC ===');
const vF1 = F1.vidaPneu({ tyreAge: 14, tyreLifeMax: 22 });
eq(vF1.voltas, 14, 'o F1 25 le as voltas que faltam');
eq(vF1.aMedir, false, 'e nao esta a medir: e\' o numero do jogo');
ok(/14/.test(vF1.texto), 'e o texto tem o numero');
const vAC = AC.vidaPneu({ tyreWear: [99, 99, 99, 99] });
ok(vAC.voltas === null || isFinite(vAC.voltas),
   'no AC a vida vem da conta, e pode ser null antes de haver medidas');
ok(vAC.aMedir === true,
   'e `aMedir` e\' verdadeiro com o desgaste intacto: escreve "a medir" e nao um numero');

console.log('');
console.log('=== 8. o combustivel: quilos no F1 25, litros no AC ===');
const cF1 = F1.combustivel({ fuelKg: 42.5, maxFuelKg: 110, fuelLaps: 4.7 });
eq(cF1.unidade, 'kg', 'o F1 25 e\' em quilos');
eq(cF1.txt, '42.5', 'e o numero e\' o do jogo');
perto(cF1.pct, 38.6, 0.1, 'a percentagem');
eq(cF1.laps, 4.7, 'e as voltas vem do MFD do jogo');
const cAC = AC.combustivel({ fuelL: 42.5, maxFuelL: 110 });
eq(cAC.unidade, 'L', 'o AC e\' em litros');
eq(cAC.txt, '42.5', 'e o mesmo numero com outra unidade');
/* O ponto do teste: 42,5 quilos NAO sao 42,5 litros. Sao ~45. */
ok(cF1.unidade !== cAC.unidade,
   'a unidade e\' diferente, e NAO se converte: 42,5 kg nao sao 42,5 L');
ok(AC.combustivel({ fuelL: 0, maxFuelL: 0 }).semDados !== undefined ||
   AC.combustivel({ fuelL: 0, maxFuelL: 0 }).txt === '--',
   'deposito a zero com maximo a zero da\' "--", e nao 0%');

console.log('');
console.log('=== 9. o clima: lido no F1 25, deduzido no AC ===');
const wF1 = F1.clima({ airTemp: 19, trackTemp: 28, weatherNome: 'Chuva fraca',
                       previsao: [{ minutos: 0, chuva: 60 }, { minutos: 30, chuva: 80 }] });
eq(wF1.chuva, 60, 'o F1 25 le a chuva da previsao de "agora"');
eq(wF1.pista, 28, 'e a temperatura da pista, que o AC tambem da');
eq(wF1.estado, 'Chuva fraca', 'e o estado do ceu, que o AC NAO tem');
ok(wF1.densidade === null, 'e nao ha densidade do ar');
/* Sem amostra de "agora", a chuva e' null. Um zero seria "nao chove". */
eq(F1.clima({ previsao: [{ minutos: 30, chuva: 80 }] }).chuva, null,
   'sem previsao de "agora" a chuva e\' null, e nao 0');
eq(F1.clima({}).chuva, null, 'e sem previsao nenhuma tambem');
eq(F1.clima({}).gripDesconhecido, true, 'e nao ha surfaceGrip neste jogo');

/* O AC nao publica chuva. O que publica e' o EFEITO. */
const wAC = AC.clima({ airTemp: 20, roadTemp: 24.9, windSpeed: 10,
                       airDensity: 1.1632, surfaceGrip: 0.92, rainAmount: 0.2 });
eq(wAC.ar, 20, 'o AC da a temperatura do ar');
eq(wAC.vento, 10, 'e o vento, em m/s');
eq(wAC.ventoUnidade, 'm/s', 'e a unidade, que a documentacao confirma');
eq(wAC.grip, 0.92, 'e a aderencia, que e\' o que diz que esta molhado');
eq(wAC.estado, undefined, 'e NAO ha estado do ceu: nao existe no AC');
/* A chuva do AC vem da API, e -1 quer dizer "nao se sabe". */
const wACsem = AC.clima({ airTemp: 20, surfaceGrip: 1, rainAmount: -1 });
eq(wACsem.chuva, null, 'com rainAmount -1 a chuva e\' null');
eq(wACsem.chuvaNegativa, true, 'e diz-se que foi o -1, para pintar a neutro');
/* O `surfaceGrip` a zero e' o jogo PARADO, nao gelo. */
eq(AC.clima({ surfaceGrip: 0 }).grip, null,
   'um grip a zero e\' null, e nao 0: o jogo esta parado');
eq(AC.clima({ surfaceGrip: 0 }).gripDesconhecido, true, 'e marca como desconhecido');

console.log('');
console.log('=== 10. o delta: do jogo no F1 25, calculado no AC ===');
eq(F1.delta({ deltaJogo: -1250 }), -1.25, 'o F1 25 da o delta do jogo, em segundos');
eq(F1.delta({ deltaJogo: 0 }), null, 'e zero e\' null: nao e\' o mesmo que atrasado');
eq(F1.delta({}), null, 'e sem delta e\' null');
eq(F1.deltaLider({ deltaLider: 34567 }), 34.567, 'e ha um delta separado para o lider');
eq(U.deltaSeg(1250), 1.25, 'a conversao de ms para segundos');
eq(U.deltaSeg(0), null, 'e zero da\' null');

console.log('');
console.log('=== 11. as capacidades dos dois lados ===');
const capsAC = AC.capacidades();
const capsF1 = F1.capacidades();
ok(Object.keys(capsAC).length === 81, 'o AC declara as 81 capacidades (' +
   Object.keys(capsAC).length + ')');
ok(Object.keys(capsF1).length === 81, 'o F1 25 declara as 81 (' +
   Object.keys(capsF1).length + ')');
const soAC = Object.keys(capsAC).filter(k => !(k in capsF1));
const soF1 = Object.keys(capsF1).filter(k => !(k in capsAC));
ok(soAC.length === 0, 'nao ha' + " '" + ' capacidades so no AC: ' + soAC);
ok(soF1.length === 0, 'nao ha capacidades so no F1 25: ' + soF1);
const maus = Object.keys(capsF1).filter(k =>
  !['on', 'off', 'auto'].includes(capsF1[k]));
ok(maus.length === 0, 'e so\' on, off e auto: ' + maus);

/* As diferencas que o painel ve. Cada linha e' uma coisa que o F1 25 faz
 * e o AC nao, ou o contrario. */
const DIFERENCAS = {
  vidaPneu: ['auto', 'on'],           // lido contra estimado
  nivelAbs: ['on', 'off'],             // nivel contra ON/OFF
  nivelTc: ['on', 'off'],
  estadoTempo: ['off', 'on'],          // o AC nao publica o ceu
  chuva: ['auto', 'on'],
  previsao: ['off', 'on'],
  zonasDrs: ['auto', 'on'],            // medido contra dado
  drsDistancia: ['off', 'on'],
  deltaJogo: ['off', 'on'],            // calculado contra dado
  deltaLider: ['off', 'on'],
  turbo: ['on', 'off'],                // o AC tem turbo, um F1 nao
  'travãoDeMão': ['off', 'off'],       // nao existe em nenhum dos dois
};
for (const [chave, [ac, f1]] of Object.entries(DIFERENCAS)) {
  eq(capsAC[chave], ac, 'AC ' + chave + ' = ' + ac);
  eq(capsF1[chave], f1, 'F1 ' + chave + ' = ' + f1);
}

console.log('');
console.log('=== 12. as unidades ===');
eq(U.ms(83456), '1:23.456', 'milissegundos para M:SS.mmm');
eq(U.ms(0), '--:--.---', 'zero da\' "--", e nao 0:00.000');
eq(U.ms(null), '--:--.---', 'e null tambem');
eq(U.ms(NaN), '--:--.---', 'e NaN, que a telemetria traz quando o campo nao existe');
eq(U.ou(null, '--'), '--', 'null escreve o que se lhe diz');
eq(U.ou(0, '--'), '0', 'e zero escreve "0", que nao e\' "--"');
eq(U.ouN(null, 1), '--', 'ouN tambem distingue null de zero');
eq(U.ouN(0, 1), '0.0', 'e zero com casas da\' "0.0"');
eq(U.limita(120, 0, 100), 100, 'o limite trava em 100');
eq(U.limita(-5, 0, 100), 0, 'e em 0');
eq(U.limita(NaN, 0, 100), 0, 'e um NaN da\' o minimo, e nao NaN');

console.log('');
if (falhou) {
  console.log(falhou + ' FALHA(S) de ' + (passou + falhou));
  process.exit(1);
}
console.log('ok: ' + passou + ' casos. Os dois modulos de jogo falam a mesma linguagem.');
