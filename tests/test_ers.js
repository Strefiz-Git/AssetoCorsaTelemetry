/* Testes da decisao do ERS (static/nucleo/ers.js).
 *
 * Corre com `node tests\test_ers.js`, sem browser.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ISTE FICOU NUM FICHEIRO
 *
 * A decisao "percentagem com maximo, joules sem" estava dentro da IIFE do
 * `app.js`, numa linha de pintura:
 *
 *     setLight("l-ers", hasE ? Math.round(d.ersPct || 0) + "%" : "-", ...)
 *
 * E `d.ersPct || 0` escrevia "ERS 0%" com 1 105 744 joules guardados.
 * Ninguem reparou, porque um numero plausivel e errado nao se denuncia
 * sozinho (Regra no 19) -- e porque, presa no `app.js`, a funcao nao se
 * conseguia chamar de lado nenhum para a testar.
 *
 * Este ficheiro existe para a proxima vez em que alguem escrever
 * `|| 0` num valor que pode nao existir, o teste apanhar. E a regra do
 * projecto ja' o dizia: o que e' verdade nos dois jogos vai para
 * `static/nucleo/`, e ai corre no node.
 *
 * ---------------------------------------------------------------------------
 * UMA NOTA SOBRE AS ASPAS
 *
 * O portugues do projecto escreve-se sem acentos e COM apostrofos, e um
 * apostrofo dentro de uma string simples fecha-a. Todas as frases deste
 * ficheiro estao em aspas duplas por isso. Nao e' estilo: e' o que
 * aconteceu quatro vezes a escrever este mesmo ficheiro.
 */
"use strict";
const E = require("../static/nucleo/ers.js");

let passou = 0, falhou = 0;
function eq(a, b, msg) {
  if (a === b) { passou++; console.log("  ok   %s", msg); }
  else {
    falhou++;
    console.log("  FALHA  %s", msg);
    console.log("          esperava %j, obtive %j", b, a);
  }
}
function ok(c, msg) {
  if (c) { passou++; console.log("  ok   %s", msg); }
  else { falhou++; console.log("  FALHA  %s", msg); }
}

/* O payload REAL do F1 25, medido com o jogo a correr em Abu Dhabi, com o
 * ERS ligado. Nao e' um caso inventado: e' o que o receptor mandou no
 * momento em que o painel escrevia "0%". */
const F125_REAL = {
  hasERS: true,
  ersJ: 1105744.0,
  ersMaxJ: null,
  ersPct: null,
};

console.log("");
console.log("=== 1. o caso que errou: o F1 25 nao diz quanto cabe ===");
{
  const e = E.estadoErs(F125_REAL);
  ok(!/^0%$/.test(e.texto), "nunca escreve 0% com bateria dentro");
  eq(e.texto, "1.11 MJ", "escreve os joules que existem, em megajoules");
  eq(e.pct, null, "e NAO devolve uma percentagem inventada");
  eq(e.estado, "", "e sem cor, porque nao ha limiar para aplicar");
  ok(e.temValor, "mas diz que tem valor: o numero existe");
}

console.log("");
console.log("=== 2. com maximo, a percentagem e a percentagem ===");
{
  const d = { hasERS: true, ersJ: 2500, ersMaxJ: 10000 };
  const e = E.estadoErs(d);
  eq(e.texto, "25%", "a percentagem");
  eq(Math.round(e.pct), 25, "e o numero que a percentagem diz");
  eq(e.estado, "", "a 25% ainda nao e pouca");
}
{
  const d = { hasERS: true, ersJ: 8000, ersMaxJ: 10000 };
  eq(E.estadoErs(d).texto, "80%", "perto do maximo");
  eq(E.estadoErs(d).estado, "on", "e com a cor de bateria boa");
}
{
  const d = { hasERS: true, ersJ: 1000, ersMaxJ: 10000 };
  eq(E.estadoErs(d).texto, "10%", "em baixo");
  eq(E.estadoErs(d).estado, "warn", "e com a cor de aviso");
}

console.log("");
console.log("=== 3. os casos em que nao se sabe nada ===");
{
  eq(E.estadoErs({ hasERS: false, ersJ: null, ersMaxJ: null }).texto, "—",
     "um carro sem ERS mostra um travessao");
  eq(E.estadoErs({ hasERS: true, ersJ: null, ersMaxJ: null }).texto, "—",
     "com ERS mas sem numero, tambem");
  eq(E.estadoErs(null).texto, "—", "e sem payload nenhum");
  eq(E.estadoErs({ hasERS: false }).pct, null, "nunca um zero inventado");
}
{
  /* O AC manda o `ersPct` e nao o `ersJ`. A funcao tem de servir os
   * dois, e nao partir o AC a dar null. */
  const d = { hasERS: true, ersPct: 62, ersJ: null, ersMaxJ: null };
  const e = E.estadoErs(d);
  ok(e.temValor, "com ersPct e sem ersJ ainda ha valor");
  eq(e.pct, 62, "o AC nao se parte");
}

console.log("");
console.log("=== 4. numeros absurdos NAO se escrevem ===");
{
  /* Um pacote mal lido pode dar 10^12 joules. Escrever isso e' pior do
   * que nao escrever nada: e' um numero que ninguem questiona. */
  const d = { hasERS: true, ersJ: 1e12, ersMaxJ: null };
  const e = E.estadoErs(d);
  eq(e.texto, "—", "acima do maximo plausivel, nao se escreve o numero");
  eq(e.pct, null, "e nao se inventa percentagem");
  ok(!e.temValor, "e diz que nao tem valor");
}
{
  const d = { hasERS: true, ersJ: 0, ersMaxJ: null };
  const e = E.estadoErs(d);
  eq(e.texto, "0.00 MJ", "zero SIM e' um zero legitimo, e escreve-se");
  ok(e.temValor, "porque zero joules e' um numero, e nao uma ausencia");
}
{
  eq(E.estadoErs({ hasERS: true, ersJ: 1105744, ersMaxJ: -5 }).pct, null,
     "um maximo negativo nao conta como maximo");
  eq(E.estadoErs({ hasERS: true, ersJ: 1105744, ersMaxJ: NaN }).pct, null,
     "e um NaN tambem");
  eq(E.estadoErs({ hasERS: true, ersJ: 1105744, ersMaxJ: 0 }).pct, null,
     "e um zero");
}

console.log("");
console.log("=== 5. a regra que este ficheiro existe para guardar ===");
{
  /* Escrita como teste: sem maximo NUNCA se escreve 0%. E' a forma de o
   * `|| 0` nao voltar. */
  const semMaximo = [
    { hasERS: true, ersJ: 1105744, ersMaxJ: null },
    { hasERS: true, ersJ: 1, ersMaxJ: null },
    { hasERS: true, ersJ: 0, ersMaxJ: null },
    { hasERS: true, ersJ: 999999, ersMaxJ: undefined },
    { hasERS: true, ersJ: 250, ersMaxJ: 0 },
  ];
  let todosBem = true;
  for (const d of semMaximo) {
    const e = E.estadoErs(d);
    if (e.pct !== null) todosBem = false;
    if (e.texto === "0%") todosBem = false;
  }
  ok(todosBem, "sem maximo nunca ha percentagem nem 0%");
}

console.log("");
console.log("=".repeat(60));
if (falhou) {
  console.log("!!! " + falhou + " FALHA(S) de " + (passou + falhou));
  process.exit(1);
}
console.log("ok: " + passou + " casos. O ERS diz o que sabe, e nada mais.");
