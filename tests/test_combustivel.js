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
console.log("=== 11. o limiar de PERCENTAGEM, e a prioridade entre os dois ===");
// A percentagem e' o valor que o jogo da directamente. As voltas so'
// existem depois de uma volta fechada -- e ha' casos em que so' a
// percentagem acerta: num limite muito longo, "voltas" e' um numero
// grande e "percentagem" e' um numero pequeno.
{
  // media de 20 L por volta, 3 voltas medidas, 100 L de capacidade:
  // o que resta em L determina a percentagem que o jogo daria.
  const com = (litrosRestantes, pct) => {
    const m = comMedia(20, litrosRestantes, 3);
    return C.estimarCombustivel(m.estado, m.dados, pct);
  };

  // 80 L com media de 20 L por volta sao 4 voltas: o limiar das voltas
  // fica neutro e so' a percentagem se mexe. Sem isto, os dois limiares
  // falam ao mesmo tempo e o teste nao diz qual deles foi.
  eq(com(80, 80).nivel, "normal", "80%: normal");
  eq(com(80, 16).nivel, "normal", "16%: normal, acima do limiar");
  eq(com(80, 15).nivel, "aviso", "15% exactos: aviso (e' <= 15, como pedido)");
  eq(com(80, 15).porPct, "aviso", "e foi o limiar da percentagem");
  eq(com(80, 15).porVoltas, "normal", "as voltas nao mandaram nada");
  eq(com(80, 6).nivel, "aviso", "6%: aviso");
  eq(com(80, 5).nivel, "critico", "5% ou menos: critico");

  // E o caso em que os DADOS discordam: 16 L com media de 20 sao 0,8
  // voltas. Num deposito de 100 L isso daria 16%, que esta' acima do
  // limiar -- mas 0,8 voltas e' critico. Mandam as voltas, porque e' o
  // que decide se se chega ao fim da volta.
  eq(com(16, 16).nivel, "critico",
     "16% mas so' 0,8 voltas: mandam as voltas");
  eq(com(16, 16).porVoltas, "critico", "e foram as voltas");
  eq(com(16, 16).porPct, "normal", "a percentagem estava neutra");
}

console.log("");
console.log("=== 12. os dois limiares ao mesmo tempo: o mais alarmente ganha ===");
// O nivel e' o MAIS ALARMANTE dos dois, nao o primeiro que dispara. Um
// alerta a piscar a vermelho enquanto o outro limiar so' pede laranja
// seria mostrar o estado errado.
{
  // 20% (normal) mas so' 0,4 voltas -> o das voltas e' critico
  const critico = (() => {
    const m = comMedia(20, 8, 3);
    return C.estimarCombustivel(m.estado, m.dados, 20);
  })();
  eq(critico.nivel, "critico", "0,4 voltas com 20%: critico");
  eq(critico.porVoltas, "critico", "mandou o limiar das voltas");
  eq(critico.porPct, "normal", "a percentagem nao mandou");

  // 10% (aviso) mas 6 voltas -> a percentagem e' que manda
  const porPct = (() => {
    const m = comMedia(20, 120, 3);
    return C.estimarCombustivel(m.estado, m.dados, 10);
  })();
  eq(porPct.nivel, "aviso", "10% com 6 voltas: aviso");
  eq(porPct.porPct, "aviso", "mandou o limiar da percentagem");
  eq(porPct.porVoltas, "normal", "as voltas nao mandaram");
}

console.log("");
console.log("=== 13. sem percentagem, o aviso das voltas continua a funcionar ===");
// Se o jogo nao der a percentagem, o aviso das voltas tem de continuar
// a funcionar. O nao e' "falta de dados" e' "isto nao se aplica".
{
  const m = comMedia(20, 28, 3);
  const r = C.estimarCombustivel(m.estado, m.dados, null);
  eq(r.nivel, "aviso", "sem percentagem, 1,4 voltas ainda da' aviso");
  eq(r.porPct, "normal", "e o limiar da percentagem fica neutro");
}

console.log("");
console.log("=== 14. o aviso funciona SEM nenhuma volta medida ===");
// Este e' o caso que me foi dito: comeca-se a corrida com 7,4% e nada
// pisca. A causa era o frontend fazer `r.valido && r.aviso`, e `valido`
// so' ser verdadeiro depois de uma volta fechada -- ou seja, o aviso
// estava preso ao limiar das voltas, que e' o unico dos dois que
// precisa de medicao.
{
  const r = C.estimarCombustivel(null,
    { litros: 9.65, voltas: 0, connected: true }, 7.4);
  eq(r.valido, false, "'a medir' para o texto: nao sabemos as voltas");
  eq(r.aviso, true, "MAS o aviso esta' ligado");
  eq(r.nivel, "aviso", "e o nivel e' aviso");
  eq(r.porPct, "aviso", "foi o limiar da percentagem");
  eq(r.porVoltas, "normal", "as voltas nao mandaram: nao ha' media");
  eq(r.msg, "a medir", "e a linha Voltas continua a dizer 'a medir'");
}

console.log("");
console.log("=== 15. o critico tambem, e sem voltas medidas ===");
{
  const r = C.estimarCombustivel(null,
    { litros: 4, voltas: 0, connected: true }, 3);
  eq(r.nivel, "critico", "3% sem voltas medidas: critico");
  eq(r.aviso, true, "com aviso ligado");
}

console.log("");
console.log("=== 16. a MEIRA volta medida, e nao so' a primeira ===");
// A segunda volta e' onde a media deixa de ser uma amostra de uma. O
// aviso tem de continuar a funcionar em todas.
{
  let estado = null, ultimo = null;
  const ler = (litros, voltas, pct) => {
    ultimo = C.estimarCombustivel(estado,
      { litros, voltas, connected: true }, pct);
    estado = ultimo.estado;
    return ultimo;
  };
  ler(60, 0, 46);                 // abertura
  const v1 = ler(40, 1, 31);       // gastou 20 L
  eq(v1.voltasMedidas, 1, "primeira volta medida");
  const v2 = ler(20, 2, 15);       // gastou 20 L
  eq(v2.voltasMedidas, 2, "segunda volta medida");
  eq(v2.soUmaVolta, false, "ja' nao e' so' uma");
  eq(v2.nivel, "aviso", "15% ainda da' aviso");
  eq(v2.porPct, "aviso", "pela percentagem");
}

console.log("");
console.log("=== 17. o alarme falso: sem NENHUM dado, nao ha' aviso ===");
// A razao que me levou a prender o aviso era o alarme falso. Essa
// razao e' valida -- mas so' no caso em que nao ha' nenhum dado, e nao
// no caso em que falta uma medicao. Com 7% o combustivel esta' a 7%:
// avisar e' dizer a verdade.
{
  // sem percentagem e sem voltas medidas
  const r = C.estimarCombustivel(null,
    { litros: 9.65, voltas: 0, connected: true }, null);
  eq(r.aviso, false, "sem nenhum dado, sem aviso");
  eq(r.nivel, "desconhecido", "e o nivel e' desconhecido, nao normal");

  // com percentagem boa: normal, e isso e' uma RESPOSTA
  const bom = C.estimarCombustivel(null,
    { litros: 100, voltas: 0, connected: true }, 77);
  eq(bom.aviso, false, "77% sem voltas medidas: sem aviso");
  eq(bom.nivel, "normal", "e o nivel e' normal, porque sabemos que esta' bem");
}

console.log("");
console.log("=== 18. nivelDe: o mais alarmente dos dois ===");
{
  eq(C.nivelDe("normal", "normal"), "normal", "normal + normal");
  eq(C.nivelDe("aviso", "normal"), "aviso", "aviso + normal");
  eq(C.nivelDe("normal", "aviso"), "aviso", "normal + aviso");
  eq(C.nivelDe("critico", "aviso"), "critico", "critico ganha ao aviso");
  eq(C.nivelDe("aviso", "critico"), "critico",
     "critico ganha, e a ordem dos argumentos nao importa");
}

console.log("");
console.log("=== 19. corDe: a rampa do aviso, de amarelo a vermelho ===");
{
  // Os tres pontos que o pedido fixou: 15% amarelo, 7,5% laranja,
  // 0% vermelho. O do meio NAO esta escrito no codigo -- e' o que a
  // interpolacao da. E' por isso que o teste o mede: se alguem mudar
  // uma das cores das pontas, o meio deixa de ser laranja e este
  // teste acusa.
  eq(C.corDe(15), null, "aos 15% nao ha cor: o aviso comeca AQUI");
  eq(C.corDe(15.1), null, "acima do aviso continua sem cor");
  eq(C.corDe(null), null, "sem percentagem nao ha cor");
  eq(C.corDe(undefined), null, "undefined tambem nao ha cor");

  eq(C.corDe(15 - 1e-9), "rgb(255,215,0)",
     "imediatamente abaixo de 15% e' o dourado do painel");
  eq(C.corDe(7.5), "rgb(255,138,30)",
     "a meio da rampa sai o LARANJA, sem ninguem o ter escrito");
  eq(C.corDe(0), "rgb(255,60,60)", "a zero e' o vermelho do painel");
  eq(C.corDe(-3), "rgb(255,60,60)", "abaixo de zero nao da' a volta ao topo");

  // e a rampa e' mesmo uma rampa: a cada passo o verde desce, sem degraus
  var anterior = null;
  var desce = true;
  for (var p = 14.5; p > 0; p -= 0.5) {
    var n = C.corDe(p).match(/\d+/g).map(Number);
    if (anterior !== null && n[1] >= anterior[1]) desce = false;
    anterior = n;
  }
  eq(desce, true, "o verde desce em todos os passos: e' uma rampa, nao degraus");

  // e o canal vermelho nao mexe -- so' escurece. Se mexe-se, a
  // interpolacao esta' a fazer outra coisa.
  eq(C.corDe(15 - 1e-9).split(",")[0], C.corDe(0).split(",")[0],
     "o vermelho fica nos 255 nos dois extremos: o que desce e' a cor");
}

console.log("");
console.log("=".repeat(60));
if (falhou) {
  console.log("!!! " + falhou + " FALHA(S) de " + (passou + falhou));
  process.exit(1);
}
console.log("ok: " + passou + " casos. As voltas de combustivel estao certas.");
