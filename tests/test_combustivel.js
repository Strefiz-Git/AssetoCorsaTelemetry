/* tests/test_combustivel.js  --  quantas voltas de combustivel ha'.

   Corre no node, sem browser, como o test_tempos.js e o test_tyres.js.

       node tests\test_combustivel.js

   A razao de o calculo estar num ficheiro separado e' esta: a
   matematica das voltas de combustivel tem de se poder testar com um
   numero verdadeiro, e nao verificada a olho no ecra enquanto se
   conduz.

   Duas coisas que aprendi a escrever isto, e que ficam escritas para
   nao repetir:

   1. As mensagens sao todas com ASPAS DUPLAS. O texto e' em portugues
      e cheio de apostrofos, e um apostrofo dentro de '...' fecha a
      string. Escrevi 'a' + "' b" de primeira e o ficheiro nao
      carregava.

   2. Os testes de MEDICAO e os do AVISO usam numeros diferentes, de
      proposito. Numa serie de leituras, o combustao medido e' a
      diferenca entre o inicio de cada volta -- e por isso a sequencia
      que produz "20 L por volta" e' 130, 110, 90, 70... Se se escreve
      [130,0],[110,1],[28,2] achando que a ultima leitura sao 28 L, a
      app mede 110-28 = 82 L nessa volta, e o teste falha a culpar o
      codigo. Foi o que aconteceu de primeira.

      Por isso o aviso e' testado com um estado construido a mao: assim
      a media e' a que se quer, sem a media vir da propria serie.
 */
'use strict';

const C = require('../static/combustivel.js');

let passou = 0, falhou = 0;

function eq(recebido, esperado, oQue) {
  const ok = JSON.stringify(recebido) === JSON.stringify(esperado);
  if (ok) { passou++; console.log('  ok   ' + oQue); }
  else {
    falhou++;
    console.log('  FALHA ' + oQue);
    console.log('        esperado: ' + JSON.stringify(esperado));
    console.log('        recebido: ' + JSON.stringify(recebido));
  }
}

function perto(recebido, esperado, tol, oQue) {
  const ok = typeof recebido === 'number'
    && Math.abs(recebido - esperado) <= tol;
  if (ok) { passou++; console.log('  ok   ' + oQue); }
  else {
    falhou++;
    console.log('  FALHA ' + oQue);
    console.log('        esperado: ' + esperado + ' +/-' + tol
      + ', recebido: ' + recebido);
  }
}

/* Corre uma serie de leituras [litros, voltas(, connected)] e devolve
   o ultimo resultado. */
function correr(leituras) {
  let estado = null, ultimo = null;
  for (const l of leituras) {
    ultimo = C.estimarCombustivel(estado, {
      litros: l[0], voltas: l[1], connected: l[2] !== false
    });
    estado = ultimo.estado;
  }
  return ultimo;
}

/* Um estado feito a mao, com uma media escolhida. Serve para testar a
   REGRA do aviso sem a media vir da propria serie. */
function comMedia(porVolta, litrosRestantes, quantas) {
  const v = [];
  for (let i = 0; i < quantas; i++) v.push(porVolta);
  return {
    estado: { litros: litrosRestantes, volta: 99, voltas: v, media: null },
    dados: { litros: litrosRestantes, voltas: 99, connected: true }
  };
}

// ---------------------------------------------------------------------------
console.log("=== 1. antes de fechar uma volta, nao se sabe nada ===");
{
  const r = correr([[130, 0], [120, 0], [110, 0]]);
  eq(r.valido, false, "sem voltas fechadas, nao e' valido");
  eq(r.msg, "a medir", "e diz que esta' a medir");
  eq(r.litrosPorVolta, null, "litros por volta e' null, nunca 0");
  eq(r.voltasRestantes, null, "voltas restantes e' null, nunca 0");
  eq(r.voltasMedidas, 0, "nenhuma volta medida");
}

console.log("");
console.log("=== 2. uma volta de 20 L, fechada ===");
{
  // 130 no inicio da volta 0, 110 no inicio da volta 1: gastou 20 L
  const r = correr([[130, 0], [110, 1]]);
  eq(r.valido, true, "ja ha' uma volta medida");
  perto(r.litrosPorVolta, 20, 0.001, "20 L por volta");
  perto(r.voltasRestantes, 5.5, 0.001, "110 L dao 5,5 voltas");
  eq(r.voltasMedidas, 1, "uma volta medida");
  eq(r.soUmaVolta, true, "e avisa que so' e' de uma volta");
  eq(r.nivel, "normal", "nivel normal com 5,5 voltas");
  eq(r.aviso, false, "sem aviso");
}

console.log("");
console.log("=== 3. a media de varias voltas, nao a ultima ===");
{
  // 20, 40 (safety car), 20 -> media 26,67
  const r = correr([
    [130, 0],   // inicio da volta 0
    [110, 1],   // gastou 20 L na volta 0
    [70, 2],    // gastou 40 L na volta 1
    [50, 3]     // gastou 20 L na volta 2
  ]);
  eq(r.voltasMedidas, 3, "tres voltas medidas");
  perto(r.litrosPorVolta, 80 / 3, 0.001, "media das tres, nao a ultima");
  perto(r.voltasRestantes, 50 / (80 / 3), 0.001, "voltas que os 50 L dao");
  eq(r.soUmaVolta, false, "com 3 ja' nao e' so' de uma");
}

console.log("");
console.log("=== 4. o deposito subir descarta a medicao ===");
{
  const r = correr([
    [130, 0],   // 20 L medidos na volta 0
    [110, 1],
    [130, 2],   // subiu 20 L: e' um box, nao consumo
    [110, 3]    // 20 L medidos outra vez
  ]);
  eq(r.voltasMedidas, 2, "a volta do box nao foi contada");
  perto(r.litrosPorVolta, 20, 0.001, "so' as voltas validas");
  perto(r.voltasRestantes, 5.5, 0.001, "110 L dao 5,5 voltas");
}

console.log("");
console.log("=== 5. mudar de sessao: o contador vai para tras ===");
{
  const r = correr([[130, 0], [110, 1], [90, 2], [130, 0]]);
  eq(r.voltasMedidas, 0, "as voltas da sessao anterior nao contam");
  eq(r.valido, false, "volta a nao saber");
  eq(r.msg, "a medir", "e diz que esta' a medir");
}

console.log("");
console.log("=== 6. o AVISO, com a media posta a mao ===");
{
  // media de 20 L por volta, 3 voltas medidas. O que muda e' so' o que
  // resta no deposito -- e' a essa variavel que a regra se refere.
  const com = (restantes) => {
    const m = comMedia(20, restantes, 3);
    return C.estimarCombustivel(m.estado, m.dados);
  };

  eq(com(50).nivel, "normal", "50 L = 2,5 voltas: normal");
  eq(com(50).aviso, false, "e sem aviso");

  eq(com(30).nivel, "normal", "30 L = 1,5 voltas: normal");
  eq(com(30).aviso, false, "1,5 exactas: sem aviso (o limite e' 1,5)");

  const aviso = com(28);   // 1,4
  eq(aviso.nivel, "aviso", "28 L = 1,4 voltas: aviso (laranja)");
  eq(aviso.aviso, true, "com o aviso ligado");

  const critico = com(18);  // 0,9
  eq(critico.nivel, "critico", "18 L = 0,9 voltas: critico (vermelho)");
  eq(critico.aviso, true, "com o aviso ligado");

  eq(com(0).nivel, "critico", "0 L: critico");
  perto(com(28).voltasRestantes, 1.4, 0.001, "1,4 voltas restantes");
}

console.log("");
console.log("=== 7. o aviso tambem conta com so' uma volta medida ===");
{
  const m = comMedia(20, 25, 1);
  const r = C.estimarCombustivel(m.estado, m.dados);
  eq(r.soUmaVolta, true, "sao so' 1 volta");
  eq(r.nivel, "aviso", "25 L = 1,25 voltas: aviso mesmo com uma so'");
}

console.log("");
console.log("=== 8. o limite de 8 voltas: a mais antiga sai ===");
{
  const l = [[200, 0]];
  for (let i = 1; i <= 9; i++) l.push([200 - 10 * i, i]);
  const r = correr(l);
  eq(r.voltasMedidas, 8, "guarda no maximo 8 voltas");
  perto(r.litrosPorVolta, 10, 0.001, "a media e' a das 8 ultimas");
}

console.log("");
console.log("=== 9. sem ligacao, nao se mede nada ===");
{
  // no box, com o motor ligado, o deposito enche-se: nao e' consumo
  const r = correr([[130, 0], [135, 0, false], [140, 0, false]]);
  eq(r.valido, false, "sem ligacao nao ha' estimativa");
  eq(r.voltasMedidas, 0, "e nenhuma volta foi medida");
}

console.log("");
console.log("=== 10. nada de zeros nem de numeros inventados ===");
{
  const r = correr([[0, 0]]);
  eq(r.valido, false, "0 litros nao e' uma estimativa");
  eq(r.litrosPorVolta, null, "e null, nunca 0");
  eq(r.voltasRestantes, null, "e voltas restantes tambem, nunca 0");
}

console.log("");
console.log("=".repeat(60));
if (falhou) {
  console.log("!!! " + falhou + " FALHA(S) de " + (passou + falhou));
  process.exit(1);
}
console.log("ok: " + passou + " casos. As voltas de combustivel estao certas.");
