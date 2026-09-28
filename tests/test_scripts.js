/* A ORDEM DOS SCRIPTS E O NOME DOS GLOBAIS, sem browser.
 *
 * Corre com `node tests/test_scripts.js`.
 *
 * O QUE ESTE TESTE EXISTE PARA APANHAR
 *
 * Este repo tem scripts que se registam num global e scripts que leem
 * esse global. O `ac.js` abre com
 *
 *     const U = global.NucleoUnidades;
 *     const T = global.Tempo;
 *
 * e o `app.js` chama `Tempo.cenaDe(...)` na pintura. Se o script que
 * cria o global nao for carregado, ou se o criar com outro nome, o
 * painel nao avisa: rebenta com
 *
 *     TypeError: Cannot read properties of undefined
 *
 * e so no browser, e so no ecra, e so quando a SSE primeira vez chega.
 *
 * Ja aconteceu duas vezes, e as duas vezes o `require` do
 * `test_jogos.js` tapou o buraco:
 *
 *   - `nucleo/tempo.js` foi movido de `static/` para `nucleo/` e ficou
 *     de fora da lista do `index.html`. O `ac.js` tem guarda,
 *     `if (!T) return null`, e isso engana: a guarda existe e o
 *     caminho que pinta o ecra nao passa por ela. O `app.js` chama o
 *     `Tempo` directamente, sem guarda nenhuma.
 *
 *   - `nucleo/tyres.js` publica `root.Pneus` e o `ac.js` le
 *     `global.Tyres`. Aqui nao rebenta (ha' guarda) e por isso e' pior:
 *     a vida do pneu mostra "a medir" para sempre, e nada diz que o
 *     modulo nao carregou.
 *
 * POR QUE ISTO PASSA NUM TESTE E NAO NO OUTRO
 *
 * Um modulo carregado por `require` traz as dependencias que o FICHEIRO
 * declara. Um modulo carregado por `<script>` so' tem as que o HTML
 * LISTA. Sao worlds diferentes. O `test_jogos.js` vive no primeiro e
 * por isso passou com um `global.Tempo` que o browser nunca vai ter --
 * o proprio `tempo.js` e' puxado para dentro pelo `require`, o que
 * esconde precisamente o bug que este teste procura.
 *
 * Por isso aqui NAO se executa nada. Le-se o `index.html`, ve-se a
 * lista, e le-se cada script a ver que globais escreve e que globais
 * le. E' estatico, por isso funciona sem browser, sem node_modules e
 * sem o jogo.
 *
 * A ORDEM NAO E' VERIFICADA, e e' de proposito. O `app.js` publica
 * `globalThis.RepintarTudo` no fim do ficheiro e chama, antes disso,
 * funcoes que o `seletor.js` invoca so' quando o utilizador troca de
 * jogo. Uma regra de ordem fio-fino daria falsos positivos nesses
 * ganchos de execucao. O que interessa e' o nome: um global lido sem
 * guarda tem de ser escrito por ALGUM script da lista.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const HTML = path.join(RAIZ, 'static', 'index.html');

/* O apostrofo. Nao e' vaidade: o projecto escreve o portugues sem
 * acentos e com apostrofos, e um apostrofo dentro de uma string
 * simples fecha-a. */
const AP = "'";

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

/* Os quatro nomes que um modulo usa para se registar num global. Nao
 * e' uma lista de permitidos a mais: e' o lexico que o codigo usa, e
 * mudar um destes nomes sem mudar o outro lado e' exactamente o bug do
 * `Tyres`/`Pneus`. */
const AMOSTRAS = ['global', 'globalThis', 'window', 'root'];

/* O codigo de uma linha, sem comentarios e sem strings.
 *
 * A regra e' a mesma do resto do projecto: um comentario pode dizer
 * `global.Tempo` para explicar, e nao e' uma leitura. Uma string tambem
 * nao e' -- `window.X` dentro de uma string e' so' uma frase.
 *
 * O estado (`dentro`, e o `delimitador` de uma string aberta) viaja de
 * uma linha para a seguinte, porque um comentario abre numa linha e
 * fecha tres linhas mais abaixo. A primeira versao deste stripper nao o
 * fazia, e o vazamento era invisivel ate um comentario aparecer com um
 * apostrofo E um nome de global na mesma linha -- que e' exactamente o
 * que a nota do `tyres.js` faz, e o que a mutacao deste teste
 * descortinou.
 *
 * E a condicao das strings tem de estar agrupada. Escrita sem parenteses,
 *
 *     if (!dentro && c === '"' || c === "'")
 *
 * le-se como `(!dentro && c === '"') || (c === "'")`, e entao um
 * APOSTROFO dentro de um comentario abre uma string, engole o resto da
 * linha, e o fecho que fecha o comentario passa batido. O comentario
 * continua "aberto" ate ao fim do ficheiro e o codigo real deixa de ser
 * lido -- que e' o pior dos dois defeitos, porque o teste passa a
 * falhar menos e ninguem sabe porque.
 */
function semComentario(linha, estado) {
  let fora = '';
  let i = 0;
  let dentro = estado.dentroDe;
  let delim = estado.delimitador;

  while (i < linha.length) {
    const dois = linha.substr(i, 2);

    if (dentro) {
      /* Dentro de um comentario so interessa o fim. */
      if (dois === '*/') { dentro = false; i += 2; }
      else { fora += ' '; i++; }
      continue;
    }

    /* Dentro de uma string so interessa a aspa que a fecha. */
    if (delim) {
      if (linha[i] === '\\') { fora += '  '; i += 2; continue; }
      if (linha[i] === delim) { delim = null; }
      fora += ' ';
      i++;
      continue;
    }

    if (dois === '//') break;                    /* commentario ate ao fim */
    if (dois === '/*') { dentro = true; i += 2; continue; }
    if (linha[i] === '"' || linha[i] === "'") {
      delim = linha[i];                         /* abre string */
      fora += ' ';
      i++;
      continue;
    }
    fora += linha[i];
    i++;
  }

  estado.dentroDe = dentro;
  estado.delimitador = delim;
  return fora;
}

console.log('');
console.log('=== 0. o stripper de comentarios le o codigo certo ===');
/* A parte mais fragil deste ficheiro e' a que decide o que e' codigo.
 * Sem isto, um erro aqui nao dá uma falha: dá um teste que passa a
 * falhar menos, ou mais, sem ninguem saber porque.
 *
 * Os casos sao os que apareceram no codigo real a escrever este
 * ficheiro, e o terceiro e' o que_DESCUBRIU o defeito.
 *
 * As assercoes sao sobre o QUE SOBREVIVE, e nao sobre a contagem de
 * espacos: o que interessa e' se um nome de global esta' la ou nao, e
 * um teste que conta espacos parte a cada reformatação. */
function limpo(codigo) {
  const e = { dentroDe: false, delimitador: null };
  return codigo.split('\n').map(l => semComentario(l, e)).join('\n');
}

eq(limpo('const T = global.Tempo;'), 'const T = global.Tempo;',
   'codigo normal passa intacto');
ok(limpo('/* global.Tempo */').indexOf('global.Tempo') < 0,
   'comentario de uma linha desaparece');
eq(limpo("// global.Tempo\nconst a = 1;"), '\nconst a = 1;',
   'comentario de ate ao fim da linha');

/* O caso que quebrou. O apostrofo de "Ha' guarda" abria uma string
 * dentro do comentario, o fecho deixava de contar, e o `global.Tyres`
 * de dentro vazava para a lista de leituras. A falha apontava para o
 * comentario, nao para o `ac.js` que le o global a serio -- que e' o
 * pior sitio para uma mensagem estar errada, porque aponta para o
 * ficheiro errado. */
{
  const e = { dentroDe: false, delimitador: null };
  const original = [
    '/* nota',
    " * O `ac.js` lia `global.Tyres` e Ha' guarda, uma linha a seguir.",
    ' * o modulo nao carregou.',
    ' */',
    'root.Tyres = api;',
  ];
  const lido = original.map(l => semComentario(l, e)).join('\n');
  ok(lido.indexOf('global.Tyres') < 0,
     'um apostrofo dentro de um comentario nao abre uma string');
  ok(lido.indexOf('root.Tyres') >= 0,
     'o codigo a seguir ao comentario continua a ser lido');
  ok(e.dentroDe === false && e.delimitador === null,
     'o comentario fecha e o stripper volta a zero');
}

ok(limpo("const s = 'global.Tempo';").indexOf('global.Tempo') < 0,
   'uma string com um nome de global nao conta como leitura');
ok(limpo('const s = "a"; const t = global.Tempo;').indexOf('global.Tempo') >= 0,
   'a string fecha e o codigo do lado ja conta');

/* Uma string que nao fecha. Em JavaScript isto e' um erro de sintaxe, e
 * o `verificar_js.py` ja o apanha -- por isso o caso nao acontece num
 * ficheiro que corra. Mesmo assim o stripper NAO inventa codigo: a
 * string aberta engole o que vem a seguir ate encontrar a aspa, e um
 * global depois dela nao e' lido. Fica para o lado seguro, que e' o
 * mesmo lado em que a Regra nº 19 manda falhar: melhor a leitura
 * faltando do que a leitura a mais. */
ok(limpo("const s = 'aberta;\nconst t = global.Tempo;\n';").indexOf('global.Tempo') < 0,
   'uma string aberta engole o resto, e nao inventa leituras');

console.log('');
console.log('=== 0b. um global consumido NU nao e' + AP + ' huerfano ===');
/* O segundo erro deste ficheiro, e o mais caro.
 *
 * A secção 3 diz que um global publicado e' huerfano quando ninguem o
 * le. A PRIMEIRA versao disso so' procurava `global.X`, e o `app.js`
 * consome o modulo dos pneus assim:
 *
 *     const r = Pneus.estimarPneus(S.pneuStint, { ... });
 *                    ^^^^^ sem `global.` a frente
 *
 * `root.Pneus = api` poe `Pneus` no objecto global, e uma propriedade
 * do objecto global E' uma variavel global. O consumo nu e' legal, e
 * e' o mais normal de todos.
 *
 * O relatorio disse que o `Pneus` nao tinha consumidor. Mudei o modulo
 * para `Tyres` com essa informacao, e a vida do pneu passou a dar
 * `Pneus is not defined` quando se pintava -- com a suite toda a
 * passar, trinta grupos verdes.
 *
 * Este caso esta' aqui para o `Pneus` voltar a ser procurado por
 * PALAVRA, e nao por `global.`. Se um dia o nome voltar a mudar, este
 * teste e' que diz. */
{
  /* Simula o que o `tyres.js` e' o `app.js` fazem. */
  const simulados = {
    'modulo.js': ['root.Pneus = { estimarPneus: function () {} };'],
    'app.js': ['const r = Pneus.estimarPneus(estado, {});'],
  };
  const escritas = { 'modulo.js': { 1: 'Pneus' }, 'app.js': {} };
  const usos = [];
  for (const rel of Object.keys(simulados)) {
    simulados[rel].forEach((linha, k) => {
      if (escritas[rel][k + 1] === 'Pneus') return;
      if (/\bPneus\b/.test(linha)) usos.push(rel + ':' + (k + 1));
    });
  }
  eq(usos.length, 1, 'um global usado sem `global.` conta como consumidor');
  eq(usos[0], 'app.js:1', 'e conta onde esta, para a mensagem ser util');
}

console.log('');
console.log('=== 1. a lista de scripts existe e nao tem repetidos ===');

const html = fs.readFileSync(HTML, 'utf8');
const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1]);

ok(scripts.length > 0, 'o index.html carrega scripts (' + scripts.length + ')');
for (const s of scripts) {
  eq(scripts.filter(x => x === s).length, 1, s + ' esta na lista uma vez so');
}
for (const s of scripts) {
  const p = path.join(RAIZ, 'static', s.replace(/^[/\\]/, ''));
  ok(fs.existsSync(p), s + ' existe no disco');
}

/* O caminho tem de servir-se do ficheiro que existe. Um `/defs.js`
 * apagado dao `null` e nao da' erro nenhum: e' um 404 silencioso que
 * so' se ve no browser. */
for (const s of scripts) {
  const limpo = s.replace(/^[/\\]/, '');
  ok(limpo.indexOf('..') < 0 && limpo.indexOf('\\') < 0,
     s + ' nao sai da pasta static/');
}

console.log('');
console.log("=== 2. cada global lido sem guarda " + AP + " escrito por um script da lista ===");

/* O que cada script da lista faz. */
const escritos = {};   /* nome -> quem escreve */
const lidos = [];      /* leituras SEM guarda: estas sao a asserção */
const lidosComGuarda = [];  /* leituras com guarda: nao falham, mas contam
                              * como consumidor para o relatorio */
const codigo = {};     /* rel -> o codigo, sem comentarios nem strings */

/* As linhas onde o nome e' ESCRETO, para as excluir da contagem de
 * menções. Sem isto, `root.Pneus = api` conta como um uso de `Pneus` e
 * nenhum global aparece nunca como orfao -- o relatorio deixava de
 * dizer nada. */
const linhaDaEscrita = {};   /* rel -> { linha: nome } */

for (const s of scripts) {
  const rel = s.replace(/^[/\\]/, '');
  const p = path.join(RAIZ, 'static', rel);
  if (!fs.existsSync(p)) continue;
  const L = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  codigo[rel] = [];
  linhaDaEscrita[rel] = {};

  /* O estado do stripper e' por SCRIPT, nao por linha: um `/*` que
   * abre numa linha fecha noutra, e o ficheiro recomeca limpo. */
  const estado = { dentroDe: false, delimitador: null };

  L.forEach((crua, k) => {
    const linha = semComentario(crua, estado);
    codigo[rel].push(linha);
    if (!linha.trim()) return;

    /* Um `if (global.X)` e' uma LEITURA COM GUARDA: o codigo esta' a
     * dizer que pode nao existir, e por isso e' exactamente o que a
     * guarda existe para. O `seletor.js` usa este padrao para os
     * ganchos que o `app.js` publica. */
    const temGuarda = /(^|[^.\w])(if|while)\s*\(/.test(linha);

    for (const nome of AMOSTRAS) {
      const re = new RegExp('\\b' + nome + '\\.([A-Z][A-Za-z0-9_]*)', 'g');
      let m;
      while ((m = re.exec(linha)) !== null) {
        const chave = m[1];
        const depois = linha.substr(m.index + m[0].length);
        /* `X = ` e' escrita. `X ==`, `X ===` e `X =>` nao sao. */
        const escreve = /^\s*=(?!=)/.test(depois);

        if (escreve) {
          if (!escritos[chave]) escritos[chave] = [];
          escritos[chave].push(rel + ':' + (k + 1));
          linhaDaEscrita[rel][k + 1] = chave;
        } else if (!temGuarda) {
          lidos.push({ nome: chave, ficheiro: rel, linha: k + 1,
                       texto: crua.trim() });
        } else {
          lidosComGuarda.push({ nome: chave, ficheiro: rel, linha: k + 1 });
        }
      }
    }
  });
}

/* O mesmo global lido em varias linhas conta uma vez, e a mensagem
 * aponta para a primeira: seis linhas do `app.js` a ler `Jogos` sao um
 * problema, nao seis. */
const vistos = {};
const unicos = [];
for (const r of lidos) {
  if (vistos[r.nome]) continue;
  vistos[r.nome] = true;
  unicos.push(r);
}

/* Nomes que se suspectam uns dos outros. Um global lido sem escrita e'
 * um nome trocado; o culpado costuma ser o global que ficou publicado
 * e' nao e' lido por ninguem, e que se parece com o procurado. */
function parecidos(a, b) {
  if (a.length < 4 || b.length < 4) return false;
  if (a === b) return false;
  /* Compara as tres ultimas letras, que e' onde um nome traduzido
   * falha: `Tyres`/`Pneus` nao se parecem em nada, mas `Combustivel`/
   * `Combustiveis` diferem so' numa letra, e `Tempo`/`Tempos` e' o
   * singular e o plural. */
  const ult3a = a.slice(-3).toLowerCase();
  const ult3b = b.slice(-3).toLowerCase();
  if (ult3a === ult3b) return true;
  return a.toLowerCase().indexOf(b.toLowerCase()) >= 0 ||
         b.toLowerCase().indexOf(a.toLowerCase()) >= 0;
}

/* Onde e' que um nome e' USADO, e nao so' onde e' escrito.
 *
 * Isto e' a correccao de um erro que este ficheiro cometeu, e que vale
 * mais do que o bug que ele caçou.
 *
 * A primeira versao só via `global.X` / `window.X` / `root.X`. E o
 * `app.js` consome o modulo dos pneus ASSIM:
 *
 *     const r = Pneus.estimarPneus(S.pneuStint, { ... });
 *                    ^^^^^ nu, sem `global.` a frente
 *
 * que e' legal -- `root.Pneus = api` cria uma propriedade do objecto
 * global, e uma propriedade do objecto global e' uma variavel global.
 *
 * O relatorio de orfaos disse que o `Pneus` nao era lido por ninguem.
 * Mudei o modulo para `Tyres` com essa informacao, e a vida do pneu
 * passou a dar `Pneus is not defined` na pintura -- com a suite toda a
 * passar, trinta grupos verdes.
 *
 * Por isso o nome e' procurado por PALAVRA. E por isso a resposta
 * distingue DUAS coisas que nao e' a mesma:
 *
 *   - usado noutro ficheiro: o global e' mesmo consumido.
 *   - usado so' no ficheiro que o publica: e' o `VOLTA_MINIMA_S`, que o
 *     `tempos.js` usa nas suas proprias contas e publica no `window` sem
 *     ninguem ir buscar la. A publicacao e' morta, mesmo que o nome
 *     apareca muitas vezes no ficheiro. */
function usos(nome) {
  const re = new RegExp('\\b' + nome + '\\b', 'g');
  const noutros = [];
  const noProprio = [];
  const dono = escritos[nome][0].split(':')[0];

  for (const rel of Object.keys(codigo)) {
    codigo[rel].forEach((linha, k) => {
      const n = (linha.match(re) || []).length;
      if (n === 0) return;
      /* A linha em que o nome e' escrito conta como uso SE o nome
       * aparece mais do que uma vez nela. E' o caso do
       * `global.Nucleo = global.Nucleo || {}`: escreve e le na mesma
       * linha, e sem esta contagem o `Nucleo` aparecia como huerfano
       * sendo o namespace onde o `unidades.js` pendura tudo. */
      if (linhaDaEscrita[rel][k + 1] === nome && n < 2) return;
      if (rel === dono) noProprio.push(rel + ':' + (k + 1));
      else noutros.push(rel + ':' + (k + 1));
    });
  }
  return { noutros: noutros, noProprio: noProprio };
}

/* Um global e' huerfano se NINGUEM o menciona -- nem sem guarda, nem
 * com guarda, nem nu. Os ganchos que o `seletor.js` chama sob
 * `if (global.X)` sao consumidores a serio, e foram eles que apareceram
 * como onze falsos positivos na primeira versao. */
const huerfanos = Object.keys(escritos).filter(n => usos(n).noutros.length === 0);

for (const r of unicos) {
  const quem = escritos[r.nome];
  ok(!!quem, r.nome + " e" + AP + " lido sem guarda em " + r.ficheiro + ":" + r.linha +
           (quem ? "" : ", e NENHUM script da lista o escreve"));
  if (quem) {
    console.log('          escrito por %s', quem.join(', '));
  } else {
    console.log('          %s', r.texto.slice(0, 78));
    const suspeitos = huerfanos.filter(n => parecidos(n, r.nome));
    for (const s of suspeitos) {
      console.log('          suspeito: %s e' + AP + ' publicado em %s e nao e' +
                  ' mencionado em nenhum script. O nome nao bate certo.',
                  s, escritos[s][0]);
    }
  }
}

console.log('');
console.log('=== 3. relatorio: globais publicados e nunca mencionados ===');
/* ISTO NAO FALHA, e e' de proposito.
 *
 * A primeira versao desta seccao fazia `ok()` em cada global publicado
 * e' nao lido, e dava ONZE falsos positivos: os ganchos que o
 * `seletor.js` chama sob `if (global.X)`, e que por isso nunca entram
 * na lista de leituras. Um teste que apita doze vezes quando ha' um
 * problema e' um teste que se ignora -- e um teste ignorado e' pior do
 * que nenhum, porque da' a impressao de que o ficheiro esta' cuidado.
 *
 * E' um relatorio porque a resposta NAO E' SEMPRE UM BUG. Um modulo
 * pode publicar um global e ainda nao ter consumidor no browser, e isso
 * e' trabalho por fazer, nao um erro.
 *
 * E a segunda versao falhava pelo outro lado: so' via `global.X`, e
 * tambem nao via um global consumido NU. Disse que o `Pneus` nao tinha
 * consumidor -- e nao tinha, por esse teste. O `app.js` chama
 * `Pneus.estimarPneus(...)` sem `global.` a frente, que e' legal e
 * normal. Mudar o nome por causa disso partiu a vida do pneu no
 * browser, com a suite toda a passar. */
if (huerfanos.length === 0) {
  console.log('  (nenhum: todos os globais publicados sao mencionados)');
} else {
  for (const n of huerfanos.sort()) {
    const u = usos(n);
    console.log('  ' + n.padEnd(24) + 'publicado em ' + escritos[n][0] +
                ', sem consumidor noutro ficheiro');
    if (u.noProprio.length) {
      console.log('  ' + ''.padEnd(24) + '(usado so' + AP + ' dentro de ' +
                  escritos[n][0].split(':')[0] + ', em ' + u.noProprio.length +
                  ' sitio(s) -- a publicacao no global e' + AP + ' morta)');
    }
  }
  console.log('');
  console.log('  Isto nao falha o teste. Um modulo pode publicar e ficar a');
  console.log('  espera de consumidor.');
}

console.log('');
console.log('=== 4. o que este ficheiro NAO apanha ===');
/* A honestidade conta mais que a cobertura, e este teste ja fooled me
 * uma vez. Duas coisas ficam de fora, e as duas precisam do browser.
 *
 * A. **Uma leitura NU de um global que nao existe.** A seccao 2 so' ve
 *    `global.X`, e por isso nao ve `Pneus.estimarPneus(...)`. Se o
 *    `tyres.js` deixar de publicar `Pneus`, este teste passa a_calado e
 *    o browser da' `Pneus is not defined` na pintura. Foi o que
 *    aconteceu: mudei o nome a partir de um relatorio errado, e a suite
 *    ficou verde com a vida do pneu partida.
 *
 * B. **Uma funcao que existe mas tem outro nome.** `node --check` diz
 *    que o ficheiro faz parse; nao diz que a funcao pedida existe. O
 *    `ac.js` pedia `T_.vida(...)` a uma API que se chamava
 *    `estimarPneus`, e fazia parse na mesma.
 *
 * As duas sao a mesma coisa pelo avesso, e e' a Regra nº 19: um valor
 * plausivel e errado nao se denuncia sozinho. Aqui o "valor" e' um
 * `undefined` que rebenta -- o que e' melhor do que um zero, e nao
 * chega.
 *
 * A unica camada que apanha as duas e' abrir o browser. */
console.log('  A. leitura NU de um global inexistente: nao detectada. So `global.X` e\' visto.');
console.log('  B. funcao com o nome trocado: parse passa. So abrir o browser diz.');
console.log('');
console.log('='.repeat(60));
if (falhou) {
  console.log('!!! ' + falhou + ' FALHA(S) de ' + (passou + falhou));
  process.exit(1);
}
console.log('ok: ' + passou + ' casos. Os scripts chegam todos ao browser.');
