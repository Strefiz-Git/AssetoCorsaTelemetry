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
  ok(enums.every(d => D.declarados(d).length >= 2 || D.baseDoJogo(d.unidadeChave) === null),
     'todo enum tem pelo menos dois valores, ou o jogo nao publica a grandeza');

/* A omissão de um enum tem de estar na lista — EXCETO quando é `null`,
 * que é um valor declarado à sua maneira: "ainda não se escolheu". E só
 * o `mode` pode usar essa folga, porque é a única definição em que
 * "nenhum" é um estado legítimo em vez de um esquecimento. */
{
  const foraDaLista = enums.filter(d =>
     d.omissao !== null && D.declarados(d).indexOf(d.omissao) < 0);
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

/* A conversao tem de ser a mesma nos dois sentidos, porque o esquema
 * e' a unica fonte: se o numero e a etiqueta desemparelhassem, o painel
 * escrevia um numero com a etiqueta do outro. E por isso que se prova o
 * `apresentar`, e nao a funcao interna de cada unidade -- o `apresentar`
 * e' o que o painel chama. */
{
  for (const chave of ['temp', 'speed', 'press', 'fuel', 'vento']) {
    const def = D.porChave[chave];
    const temTabela = (def.unidadeChave !== undefined);
    ok(temTabela || !!def.unidade, `${chave} tem conversao declarada`);

    for (const alvo of D.declarados(def)) {
      const r = D.apresentar(chave, 1, { [chave]: alvo });
      ok(r && typeof r.numero === 'string' && r.numero.indexOf('NaN') < 0,
         `${chave} escreve 1 como ${alvo} sem virar NaN`);
      ok(r && typeof r.sufixo === 'string' && r.sufixo.length > 0,
         `${chave} tem etiqueta para ${alvo}`);
      eq(D.sufixo(chave, { [chave]: alvo }), r ? r.sufixo : null,
         `${chave}: a etiqueta sozinha e' a mesma do par`);
    }

    /* Converter para a unidade que a medida ja vem e' a identidade, e
     * e' isso que garante que voltar ao jogo anterior nao muda o numero
     * que esta' no ecra. */
    const base = D.declarados(def)[0];
    const identidade = D.apresentar(chave, 7, { [chave]: base });
    ok(identidade && Math.abs(Number(identidade.numero) - 7) < 1e-9,
       `${chave}: converter para a base e' a identidade`);
  }
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
/* =========================================================================
 * 11. as unidades sao DO JOGO, e nao do esquema
 *
 * O que o modulo do jogo publica, e que e' a unica fonte disto:
 *
 *     JogoAC.UNIDADES    = { fuel: 'L',  vento: 'ms'  }
 *     JogoF125.UNIDADES = { fuel: 'kg', vento: null }
 *
 * O esquema nao tem uma tabela "unidades por jogo" -- seria um segundo
 * sitio a saber o que cada jogo publica, ao lado do modulo que ja' o
 * diz. Ele sabe so' os FACTOS: que L e gal sao a mesma grandeza, que
 * kg e lb sao, e que L e kg nao sao. A lista de valores de cada opcao
 * deriva-se dai.
 * ====================================================================== */
grupo('11. as unidades vêm do módulo do jogo, e o esquema só sabe a conta');

const AC = { fuel: 'L', vento: 'ms' };
const F125 = { fuel: 'kg', vento: null };

{
  D.usarJogo('ac', AC);
  const d = D.porChave;

  eq(JSON.stringify(D.declarados(d.fuel)), JSON.stringify(['L', 'gal']),
     'o AC, que publica litros, oferece litros e galões');
  eq(JSON.stringify(D.declarados(d.vento)), JSON.stringify(['ms', 'kmh']),
     'o AC publica vento, e por isso a opção existe');

  /* A base e' sempre o que o jogo manda. O `gal` é uma ESCOLHA de quem
   * está a ler, não o que o campo traz. */
  eq(D.validar({}).fuel, 'L', 'a omissão do combustível é a unidade do AC');
  eq(D.validar({ fuel: 'gal' }).fuel, 'gal', 'e uma escolha do utilizador entra');
  eq(D.validar({ fuel: 'kg' }).fuel, 'L',
     'mas quilos no AC dão a omissão: o AC não publica quilos');

  /* 40 litros em galões. 1 galão imperial = 4,54609 L, e o factor e' o
   * inverso, que e' a conta que a tabela faz. */
  const r = D.apresentar('fuel', 40, { fuel: 'gal' });
  eq(r.sufixo, 'gal', 'a etiqueta é a da escolha, não a do jogo');
  eq(r.numero, (40 / 4.54609).toFixed(2), 'e o número é o dos 40 litros');
  eq(D.apresentar('fuel', 40, { fuel: 'L' }).numero, '40.0',
     'na unidade do jogo o número não se mexe');

  /* Um galão nunca vira quilos, em lado nenhum. Se isto passasse, o
   * painel escrevia "1.0 lb" a partir de um galão, e o número seria
   * plausível e errado. */
  eq(D.apresentar('fuel', 1, { fuel: 'L' }).sufixo, 'L',
     'litros não se convertem em quilos');
}

{
  D.usarJogo('f125', F125);
  const d = D.porChave;

  eq(JSON.stringify(D.declarados(d.fuel)), JSON.stringify(['kg', 'lb']),
     'o F1 25, que publica quilos, oferece quilos e libras');
  eq(JSON.stringify(D.declarados(d.vento)), JSON.stringify([]),
     'e NÃO oferece vento, porque o F1 25 não publica vento');
  eq(D.validar({}).fuel, 'kg', 'a omissão do combustível passa a ser quilos');
  eq(D.validar({}).vento, null,
     'e a do vento é null: não há unidade para escolher');
  eq(D.apresentar('vento', 12, { vento: 'ms' }), null,
     'pedir o vento a um jogo que não o publica devolve null');
  eq(D.sufixo('vento', { vento: 'ms' }), '',
     'e a etiqueta é vazia, e não "m/s"');

  /* 42,5 quilos em libras. Uma libra são 0,45359237 kg. */
  const r = D.apresentar('fuel', 42.5, { fuel: 'lb' });
  eq(r.sufixo, 'lb', 'a etiqueta é a da escolha');
  eq(r.numero, (42.5 * 2.2046226).toFixed(2), 'e o número sai em libras');
}

{
  /* Guardado de um jogo, aberto no outro. E' asituação que acontece a
   * cada vez que se troca de jogo, e é a que produz "1.0 lb" a partir de
   * um número em litros. */
  const guardado = { fuel: 'gal', vento: 'ms' };

  D.usarJogo('f125', F125);
  const noF125 = D.validar(guardado);
  eq(noF125.fuel, 'kg', 'os galões do AC dão a omissão do F1 25');
  eq(noF125.vento, null, 'e o vento que o AC tinha dá null');

  D.usarJogo('ac', AC);
  const noAC = D.validar(noF125);
  eq(noAC.fuel, 'L', 'e a omissão do F1 25 volta a ser válida no AC');
  eq(noAC.vento, 'ms', 'o vento reaparece no AC, que o publica');
  eq(D.apresentar('fuel', 40, noAC).numero, '40.0',
     'e o número volta ao que era, sem Conversão herdada');
}

{
  /* Uma chave que o jogo NÃO FALOU é diferente de uma que ele disse
   * `null`. A primeira ainda não se sabe; a segunda é um "não existe".
   * Confundir as duas fazia o vento aparecer no F1 25, que nao o
   * publica, ou desaparecer no AC, que o publica. */
  D.usarJogo('ac', {});
  eq(JSON.stringify(D.declarados(D.porChave.vento)), JSON.stringify(['ms', 'kmh']),
     'ainda sem o jogo dizer nada, o vento oferece-se como no AC');

  D.usarJogo('f125', { fuel: 'kg' });
  eq(JSON.stringify(D.declarados(D.porChave.vento)), JSON.stringify(['ms', 'kmh']),
     'o F1 25 que não MENCIONA o vento ainda não sabe: oferece-se');
  eq(JSON.stringify(D.declarados(D.porChave.fuel)), JSON.stringify(['kg', 'lb']),
     'e o combustível, que declarou, já é em quilos');
}

{
  /* A tabela não tem `L` contra `kg`, e é de propósito. */
  eq(D.UNIDADES.L.para.filter(p => p.unidade === 'kg').length, 0,
     'litros e quilos nunca se cruzam: não são a mesma grandeza');
  eq(D.UNIDADES.gal.para.filter(p => p.unidade === 'L').length, 1,
     'e o caminho inverso existe, porque são a mesma');
}

D.usarJogo(null, {});

console.log('='.repeat(60));
if (falhou) { console.log('!!! ' + falhou + ' FALHA(S) de ' + (passou + falhou)); process.exit(1); }
console.log('ok: ' + passou + ' casos. Só entra o que está declarado.');
