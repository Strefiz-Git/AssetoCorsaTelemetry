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

for (const s of scripts) {
  const rel = s.replace(/^[/\\]/, '');
  const p = path.join(RAIZ, 'static', rel);
  if (!fs.existsSync(p)) continue;
  const L = fs.readFileSync(p, 'utf8').split(/\r?\n/);

  /* O estado do stripper e' por SCRIPT, nao por linha: um `/*` que
   * abre numa linha fecha noutra, e o ficheiro recomeca limpo. */
  const estado = { dentroDe: false, delimitador: null };

  L.forEach((crua, k) => {
    const linha = semComentario(crua, estado);
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
   * falha: `Tyres`/`Pneus` nao se parecenc em nada, mas `Combustivel`/
   * `Combustivel` differem so' numa letra e `Tempo`/`Tempos` e' o
   * singular e o plural. */
  const ult3a = a.slice(-3).toLowerCase();
  const ult3b = b.slice(-3).toLowerCase();
  if (ult3a === ult3b) return true;
  return a.toLowerCase().indexOf(b.toLowerCase()) >= 0 ||
         b.toLowerCase().indexOf(a.toLowerCase()) >= 0;
}

/* Um global e' huerfano se NINGUEM o le -- nem sem guarda, nem com
 * guarda. Os ganchos que o `seletor.js` chama sob `if (global.X)` sao
 * consumidores a serio, e foram eles que apareceram como onze falsos
 * positivos na primeira versao. */
const huerfanos = Object.keys(escritos).filter(
  n => !lidos.some(r => r.nome === n) && !lidosComGuarda.some(r => r.nome === n));

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
                  ' lido por ninguem. O nome nao bate certo.',
                  s, escritos[s][0]);
    }
  }
}

console.log('');
console.log('=== 3. relatorio: globais publicados e nunca lidos no browser ===');
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
 * pode publicar um global e ainda nao ter consumidor no browser, e
 * isso e' trabalho por fazer e nao' um erro. O que e' sempre verdade e'
 * que merece estar escrito: o `Pneus` publicado pelo `tyres.js` nao e'
 * lido por ninguem, e o `Tyres` que o `ac.js` pede nao existe. Sao as
 * duas metades do mesmo bug, e sem esta lista so se via metade. */
if (huerfanos.length === 0) {
  console.log('  (nenhum: todos os globais publicados sao lidos)');
} else {
  for (const n of huerfanos.sort()) {
    console.log('  ' + n.padEnd(24) + 'publicado em ' + escritos[n][0] +
                ', sem consumidor no browser');
  }
  console.log('');
  console.log('  Isto nao falha o teste. Um modulo pode publicar e ficar a');
  console.log('  espera de consumidor. Mas se um destes nomes SHOULD ser lido');
  console.log('  e o outro lado le um nome parecido, e' + AP + ' isso.');
}

console.log('');
console.log('='.repeat(60));
if (falhou) {
  console.log('!!! ' + falhou + ' FALHA(S) de ' + (passou + falhou));
  process.exit(1);
}
console.log('ok: ' + passou + ' casos. Os scripts chegam todos ao browser.');
