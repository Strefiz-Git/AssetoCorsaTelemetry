/* ===========================================================================
 * test_defs.js — o esquema das definições.
 *
 * Corre com `node tests/test_defs.js`, sem browser e sem o jogo.
 *
 * A mesma razão do `tempo.js`: a lógica está num ficheiro puro para se
 * poder testar a sério, em vez de se olhar para o ecrã e_adivinhar. A
 * diferença entre um valor aceite e um recusado aqui é uma linha de
 * `console`; no painel é um número que não muda e ninguém sabe porque.
 */
'use strict';
const path = require('path');
const D = require(path.join(__dirname, '..', 'static', 'defs.js'));

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
function grupo(t) { console.log('\n=== %s ===', t); }

console.log('');

/* =========================================================================
 * 1. o esquema é bem formado
 * ====================================================================== */
grupo('1. o esquema é bem formado');

ok(D.LISTA.length > 0, 'há definições declaradas (%d)', D.LISTA.length);

const semChave = D.LISTA.filter(d => !d.chave);
ok(semChave.length === 0, 'todas têm `chave`', semChave.map(d => JSON.stringify(d)));

const chavesRepetidas = D.LISTA
  .map(d => d.chave)
  .filter((c, i, a) => a.indexOf(c) !== i);
ok(chavesRepetidas.length === 0, 'nenhuma chave repetida', chavesRepetidas);

for (const d of D.LISTA) {
  if (!('omissao' in d)) ok(false, `${d.chave} tem omissao`);
  if (!d.rotulo) ok(false, `${d.chave} tem rotulo`);
  if (!d.grupo) ok(false, `${d.chave} tem grupo`);
  if (!('ordem' in d)) ok(false, `${d.chave} tem ordem`);
}
ok(true, 'todas têm omissao, rotulo, grupo e ordem');

const gruposOrfaos = D.LISTA
  .map(d => d.grupo)
  .filter((g, i, a) => a.indexOf(g) === i)
  .filter(g => !D.GRUPOS.some(x => x.chave === g));
ok(gruposOrfaos.length === 0, 'todo o grupo de uma definição está em GRUPOS', gruposOrfaos);

const gruposVazios = D.GRUPOS.filter(g => D.porGrupo(g.chave).length === 0);
ok(gruposVazios.length === 0, 'nenhum grupo declarado está vazio',
   gruposVazios.map(g => g.chave));

const ordensRepetidas = {};
let colisoes = [];
for (const g of D.GRUPOS) {
  for (const d of D.porGrupo(g.chave)) {
    const k = g.chave + '/' + d.ordem;
    if (ordensRepetidas[k]) colisoes.push(k + ' (' + d.chave + ')');
    ordensRepetidas[k] = true;
  }
}
ok(colisoes.length === 0, 'nenhuma colisão de ordem dentro de um grupo', colisoes);

/* =========================================================================
 * 2. tipos: enum, bool, acao — e nada mais
 * ====================================================================== */
grupo('2. só existem os três tipos que se decidiram');

const tipos = [...new Set(D.LISTA.map(d => d.tipo))].sort();
eq(JSON.stringify(tipos), JSON.stringify(['acao', 'bool', 'enum']),
   'os tipos existentes são exactamente enum, bool e acao');

ok(!tipos.includes('texto'), 'não há tipo "texto livre" — foi excluído de propósito');
ok(!tipos.includes('num'), 'não há tipo "número" — foi excluído de propósito');

const enums = D.LISTA.filter(d => d.tipo === 'enum');
ok(enums.every(d => Array.isArray(d.valores) && d.valores.length >= 2),
   'todo enum tem pelo menos dois valores');

/* A omissão de um enum tem de estar na lista — EXCETO quando é `null`,
 * que é um valor declarado à sua maneira: "ainda não se escolheu". E só
 * o `mode` pode usar essa folga, porque é a única definição em que
 * "nenhum" é um estado legítimo em vez de um esquecimento. */
{
  const foraDaLista = enums.filter(d =>
    d.omissao !== null && d.valores.indexOf(d.omissao) < 0);
  ok(foraDaLista.length === 0,
     'a omissão de todo enum está na lista de valores, ou é null',
     foraDaLista.map(d => d.chave));
  const comNull = enums.filter(d => d.omissao === null);
  eq(JSON.stringify(comNull.map(d => d.chave)), JSON.stringify(['mode']),
     'só a vista tem omissão nula, que quer dizer "perguntar"');
}

const bools = D.LISTA.filter(d => d.tipo === 'bool');
ok(bools.every(d => d.omissao === true || d.omissao === false),
   'todo bool tem omissão booleana');

const accoes = D.LISTA.filter(d => d.tipo === 'acao');
ok(accoes.length > 0, 'há ações declaradas (%d)', accoes.length);
ok(accoes.every(d => d.omissao === null), 'nenhuma ação tem omissão — não se guardam');

/* =========================================================================
 * 3. validar: o que é válido passa
 * ====================================================================== */
grupo('3. os valores válidos passam tal e qual');

{
  const limpo = D.validar({});
  eq(limpo.temp, 'C', 'sem nada guardado, a temperatura é Celsius');
  eq(limpo.speed, 'kmh', 'sem nada guardado, a velocidade é km/h');
  eq(limpo.lang, 'pt-PT', 'sem nada guardado, o idioma é pt-PT');
  eq(limpo.fps, 60, 'sem nada guardado, 60 fps');
  eq(limpo.mode, null, 'a vista é null, para se perguntar');
  eq(limpo.mapFlipX, false, 'o invertimento X começa desligado');
}

{
  const guardado = {
    mode: 'both', lang: 'es', temp: 'F', speed: 'mph',
    press: 'bar', fuel: 'gal', vento: 'kmh', fps: 30,
    map: 'off', mapView: 'relativa', mapFlipX: true, mapFlipZ: true
  };
  const limpo = D.validar(guardado);
  for (const k of Object.keys(guardado)) {
    eq(limpo[k], guardado[k], `${k}: ${JSON.stringify(guardado[k])} passa intacto`);
  }
}

/* O fps é o caso especial: os valores do esquema são NÚMEROS e o
 * localStorage devolve o que se gravou, que também é número. Mas o
 * `data-v` do botão é texto. A validação tem de aceitar o número. */
eq(D.validar({ fps: 30 }).fps, 30, 'o fps guarda-se como número, não como texto');
eq(D.validar({ fps: '30' }).fps, 30, 'o fps vindo como texto também é aceite');

/* =========================================================================
 * 4. validar: o que NÃO é válido é recusado
 * ====================================================================== */
grupo('4. os valores inválidos dão a omissão, e não passam');

eq(D.validar({ temp: 'banana' }).temp, 'C', "temp: 'banana' dá Celsius");
eq(D.validar({ speed: 'knots' }).speed, 'kmh', "speed: 'knots' dá km/h");
eq(D.validar({ press: 'atm' }).press, 'psi', "press: 'atm' dá psi");
eq(D.validar({ fuel: 'galoes' }).fuel, 'L', "fuel: 'galoes' dá litros");
eq(D.validar({ vento: 'nós' }).vento, 'ms', "vento: 'nós' dá m/s");
eq(D.validar({ map: 'talvez' }).map, 'on', "map: 'talvez' dá 'on'");
eq(D.validar({ mapView: 'de cima' }).mapView, 'inteira', "mapView: 'de cima' dá 'inteira'");
eq(D.validar({ mode: 'turbo' }).mode, null, "mode: 'turbo' dá null — a vista pergunta-se");
eq(D.validar({ lang: 'fr' }).lang, 'pt-PT', "lang: 'fr' dá pt-PT");

eq(D.validar({ fps: 45 }).fps, 60, 'fps: 45 não está na lista e dá 60');
eq(D.validar({ fps: 120 }).fps, 60, 'fps: 120 dá 60');
eq(D.validar({ fps: -10 }).fps, 60, 'fps negativo dá 60');

/* O bool é onde é mais fácil passar um valorEstranho sem dar por isso:
 * a string "sim" é verdadeira em JavaScript, e um interruptor que fica
 * ligado sozinho é pior do que um que não faz nada. */
eq(D.validar({ mapFlipX: 'sim' }).mapFlipX, false, "mapFlipX: 'sim' dá false");
eq(D.validar({ mapFlipX: 1 }).mapFlipX, false, 'mapFlipX: 1 dá false');
eq(D.validar({ mapFlipX: 0 }).mapFlipX, false, 'mapFlipX: 0 dá false — e não true, que era o pior');
eq(D.validar({ mapFlipZ: true }).mapFlipZ, true, 'mapFlipZ: true passa');

/* =========================================================================
 * 5. validar: chaves desconhecidas não entram
 * ====================================================================== */
grupo('5. as chaves que não estão no esquema não entram');

{
  const limpo = D.validar({ chaveInventada: 42, outra: 'x', temp: 'F' });
  ok(!('chaveInventada' in limpo), 'a chave inventada não entra');
  ok(!('outra' in limpo), 'a segunda chave inventada também não');
  eq(limpo.temp, 'F', 'e a definição legítima ao lado passa na mesma');
}

{
  /* Uma chave que foi removida do esquema há meses não pode continuar
   * a ser gravada a cada `saveDef()`, senão o ficheiro no `localStorage`
   * cresce sozinho e nunca mais se limpa. */
  const guardadas = Object.keys(D.validar({ mapaVelho: 'x', drsAlvo: true, foo: 1 }));
  eq(guardadas.length, D.LISTA.filter(d => d.tipo !== 'acao').length,
     'saiem exactamente as definições guardáveis, nem mais uma');
}

/* =========================================================================
 * 6. validar: lixo não é uma definição válida
 * ====================================================================== */
grupo('6. o que vier de mais é como se não houver nada');

for (const [nome, entrada] of [
  ['null', null],
  ['undefined', undefined],
  ['um array', [1, 2, 3]],
  ['a string vazia', ''],
  ['o número 0', 0],
  ['o booleano true', true],
  ['uma função', () => {}],
]) {
  const limpo = D.validar(entrada);
  eq(limpo.temp, 'C', `${nome} dá as omissões`);
  eq(limpo.lang, 'pt-PT', `${nome} dá o idioma por omissão`);
}

/* O `JSON.parse` pode explodir. Não é o `validar` que apanha isso — é o
 * `try` à volta do parse no `loadDef`. Mas se o parse passar e devolver
 * um array, é o `validar` que tem de o tratar como lixo. */
{
  let explodiu = false;
  try { D.validar([1, 2, 3]); } catch (e) { explodiu = true; }
  ok(!explodiu, 'um array não faz o validar explodir');
}

/* =========================================================================
 * 7. a migração
 * ====================================================================== */
grupo('7. a migração corre antes de validar');

/* O caso que justifica existir a migração: o valor guardou-se com outro
 * nome, ou com outra grafia, e o esquema mudou. Sem a migração, o valor
 * antigo é inválido e o utilizador perde a escolha — sem aviso. */
{
  /* Uma migração de mentira, feita só para o teste: o esquema está
   * declarado acima e não tem migração nenhuma, por isso injecta-se
   * uma directamente, para se provar que o `validar` a respeita. */
  const alvo = 'mapView';
  const original = D.porChave[alvo];
  D.porChave[alvo].migrar = function (v) {
    return { completa: 'inteira', relativa: 'relativa' }[v] || v;
  };
  eq(D.validar({ mapView: 'completa' }).mapView, 'inteira',
     'a migração traduz um valor antigo para o novo');
  eq(D.validar({ mapView: 'relativa' }).mapView, 'relativa',
     'e um valor que não mudou passa direto');
  eq(D.validar({ mapView: 'nada' }).mapView, 'inteira',
     'um valor que a migração não conhece dá a omissão');
  D.porChave[alvo].migrar = original.migrar;
}

/* Uma migração que rebenta não pode levar o esquema inteiro. O valor
 * passa a ser a omissão e o resto continua a ser validado. */
{
  const alvo = 'speed';
  const original = D.porChave[alvo].migrar;
  D.porChave[alvo].migrar = function () { throw new Error('rebenta'); };
  eq(D.validar({ speed: 'mph', temp: 'F' }).speed, 'kmh',
     'uma migração que rebenta dá a omissão');
  eq(D.validar({ speed: 'mph', temp: 'F' }).temp, 'F',
     'e as outras definições continuam a ser validadas');
  D.porChave[alvo].migrar = original;
}

/* A migração corre SEMPRE, mesmo com um valor válido. É isso que a torna
 * um sítio só para o que muda, em vez de uma lista de casos especiais. */
{
  let vezes = 0;
  const alvo = 'map';
  const original = D.porChave[alvo].migrar;
  D.porChave[alvo].migrar = function (v) { vezes++; return v; };
  D.validar({ map: 'on' });
  D.validar({ map: 'off' });
  D.validar({});
  eq(vezes, 3, 'a migração corre mesmo quando o valor é válido');
  D.porChave[alvo].migrar = original;
}

/* =========================================================================
 * 8. a reposição de predefinições
 * ====================================================================== */
grupo('8. a reposição mantém a vista e o idioma');

{
  const guardado = {
    mode: 'both', lang: 'es', temp: 'F', speed: 'mph',
    press: 'bar', fuel: 'gal', vento: 'kmh', fps: 30,
    map: 'off', mapView: 'relativa', mapFlipX: true, mapFlipZ: true
  };
  const limpo = D.validar(guardado);
  const reposto = D.repor(limpo);

  eq(reposto.mode, 'both', 'a VISTA fica — quem está a conduzir já escolheu');
  eq(reposto.lang, 'es', 'o IDIOMA fica — mudar para português do nada seria pior');

  eq(reposto.temp, 'C', 'a temperatura volta a Celsius');
  eq(reposto.speed, 'kmh', 'a velocidade volta a km/h');
  eq(reposto.press, 'psi', 'a pressão volta a psi');
  eq(reposto.fuel, 'L', 'o combustível volta a litros');
  eq(reposto.vento, 'ms', 'o vento volta a m/s');
  eq(reposto.fps, 60, 'os fps voltam a 60');
  eq(reposto.map, 'on', 'o mapa volta a aparecer');
  eq(reposto.mapView, 'inteira', 'a vista do mapa volta à pista inteira');
  eq(reposto.mapFlipX, false, 'o invertimento X desliga-se');
  eq(reposto.mapFlipZ, false, 'o invertimento Z desliga-se');
}

/* Repor quando não há nada guardado tem de dar o mesmo que repor depois
 * de mudar tudo — e não de partir. */
{
  const deNada = D.repor(D.validar({}));
  eq(deNada.lang, 'pt-PT', 'sem nada guardado, o idioma fica a omissão');
  eq(deNada.mode, null, 'e a vista fica a perguntar');
  eq(deNada.temp, 'C', 'e o resto vai às omissões');
}

/* `manterNoReset` é o que diz que uma definição sobrevive. Se ninguém a
 * marcar, tem de ser reposta — e a omissão de `manterNoReset` é
 * `undefined`, que é falso. */
{
  const marcadas = D.LISTA.filter(d => d.manterNoReset).map(d => d.chave).sort();
  eq(JSON.stringify(marcadas), JSON.stringify(['lang', 'mode']),
     'só a vista e o idioma estão marcados para sobreviver');
}

/* =========================================================================
 * 9. as unidades: número e etiqueta juntos
 * ====================================================================== */
grupo('9. apresentar() devolve o número E a etiqueta');

/* A assinatura é `apresentar(chave, medida, definicoes)`: o terceiro
 * argumento é o objecto de definições inteiro, e não a unidade. Assim não
 * há um sítio onde se possa meter a medida por engano onde se quer a
 * unidade — que era o defeito da primeira versão, onde
 * `sufixo[20]` devolvia "20". */
{
  const defs = { temp: 'C' };
  const a = D.apresentar('temp', 20, defs);
  eq(a.numero, '20', '20 °C são 20');
  eq(a.sufixo, '°C', 'e a etiqueta é °C');

  defs.temp = 'F';
  const b = D.apresentar('temp', 20, defs);
  eq(b.numero, '68', '20 °C são 68 °F');
  eq(b.sufixo, '°F', 'e a etiqueta é °F — NUNCA °C com o número de Fahrenheit');
}

{
  const defs = { press: 'psi' };
  const a = D.apresentar('press', 30, defs);
  eq(a.numero, '30.0', '30 psi sai com uma casa decimal');
  eq(a.sufixo, 'psi', 'e a etiqueta é psi');

  defs.press = 'bar';
  const b = D.apresentar('press', 30, defs);
  eq(b.numero, '2.07', '30 psi são 2,07 bar');
  eq(b.sufixo, 'bar', 'e a etiqueta é bar');
}

{
  const defs = { vento: 'ms' };
  const a = D.apresentar('vento', 12.5, defs);
  eq(a.numero, '12.5', '12,5 m/s com uma casa');
  eq(a.sufixo, 'm/s', 'e a etiqueta é m/s, a que o jogo documenta');

  defs.vento = 'kmh';
  const b = D.apresentar('vento', 12.5, defs);
  eq(b.numero, '45.0', '12,5 m/s são 45,0 km/h');
  eq(b.sufixo, 'km/h', 'e a etiqueta é km/h');
}

{
  const defs = { fuel: 'L' };
  const a = D.apresentar('fuel', 40, defs);
  eq(a.numero, '40.0', '40 litros com uma casa');
  eq(a.sufixo, 'L', 'e a etiqueta é L');

  defs.fuel = 'gal';
  const b = D.apresentar('fuel', 40, defs);
  eq(b.numero, '8.80', '40 litros são 8,80 galões');
  eq(b.sufixo, 'gal', 'e a etiqueta é gal');
}

{
  eq(D.apresentar('lang', 'pt-PT', { lang: 'es' }), null,
     'uma definição sem conversão devolve null, não um número torto');
}

/* Sem o objecto de definições, usa a omissão. É o que torna `sufixo()`
 * utilizável a partir do `applyLang`, que nem sempre tem o DEF à mão. */
eq(D.apresentar('temp', 20).sufixo, '°C', 'sem definições, usa a unidade por omissão');
eq(D.sufixo('temp'), '°C', 'sufixo() sem definições devolve a omissão');
eq(D.sufixo('temp', { temp: 'F' }), '°F', 'sufixo() com definições devolve a escolhida');
eq(D.sufixo('lang', { lang: 'es' }), '', 'sufixo() de uma sem conversão dá vazio');

{
  for (const [nome, entrada] of [['null', null], ['undefined', undefined],
                                 ['NaN', NaN], ['infinito', Infinity],
                                 ['texto', 'vinte']]) {
    eq(D.apresentar('temp', entrada, { temp: 'C' }), null,
       `${nome} não vira "NaN °C"`);
  }
}

/* A conversão tem de ser a mesma nos dois sentidos, porque o esquema
 * é a única fonte: se `para` e `sufixo` desemparelhassem, o painel
 * escrevia um número com a etiqueta do outro. */
{
  for (const chave of ['temp', 'speed', 'press', 'fuel', 'vento']) {
    const def = D.porChave[chave];
    ok(!!def.unidade, `${chave} tem conversão declarada`);
    for (const alvo of def.valores) {
      const n = def.unidade.para(1, alvo);
      ok(typeof n === 'number' && isFinite(n), `${chave} converte 1 para ${alvo}`);
      const s = def.unidade.sufixo[alvo];
      ok(typeof s === 'string' && s.length > 0, `${chave} tem etiqueta para ${alvo}`);
    }
    const identidade = def.unidade.para(7, def.omissao);
    ok(Math.abs(identidade - 7) < 1e-9, `${chave}: converter para a omissão é a identidade`);
  }
}

/* =========================================================================
 * 10. a ordem, que é o que faz a gaveta ler-se
 * ====================================================================== */
grupo('10. a ordem dentro de cada grupo é a declarada');

for (const g of D.GRUPOS) {
  const defs = D.porGrupo(g.chave);
  const ordens = defs.map(d => d.ordem);
  const crescente = ordens.every((o, i) => i === 0 || o > ordens[i - 1]);
  ok(crescente, `${g.chave}: ${ordens.join(', ')}`);
  /* e que devolvem as DEFINIÇÕES, não as chaves. Uma lista de
   * strings passava no `ordem` acima e nao dava para a gaveta,
   * que precisa do `rotulo` e do `tipo` de cada uma. */
  ok(defs.every(d => d.chave && d.rotulo && d.tipo),
     `${g.chave}: as ${defs.length} devolvidas têm chave, rótulo e tipo`);
}

{
  const unidades = D.porGrupo('unidades').map(d => d.chave);
  eq(JSON.stringify(unidades), JSON.stringify(['temp', 'speed', 'press', 'fuel', 'vento']),
     'as unidades vêm por ordem: temperatura, velocidade, pressão, combustível, vento');
}

{
  const mapa = D.porGrupo('mapa').map(d => d.tipo);
  ok(mapa.includes('acao'), 'o mapa tem a ação de limpar, no mesmo esquema');
}

console.log('');
console.log('='.repeat(60));
if (falhou) { console.log('!!! ' + falhou + ' FALHA(S) de ' + (passou + falhou)); process.exit(1); }
console.log('ok: ' + passou + ' casos. Só entra o que está declarado.');
