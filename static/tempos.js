/* =========================================================================
   Tempos de volta - sem dependencias, sem DOM, sem estado global.
   Vive num ficheiro proprio para poder ser testado sozinho
   (tests/test_tempos.html). Tudo o que aqui esta e' funcao pura: recebe
   o que precisa e devolve o resultado. Nao toca em S nem no DOM.
   ========================================================================= */
'use strict';

/* O AC escreve os tempos em milissegundos e formata como "M:SS.mmm".
   Uma volta nunca passa de 59:59.999, portanto o formato e' esse e nao
   H:MM:SS.mmm. O que vier fora do formato devolve null em vez de
   adivinhar - um delta com um tempo mal lido e' pior do que sem delta. */
function toSec(t) {
  if (!t || t.indexOf('--') === 0) return null;
  const m = t.match(/^(?:(\d+):)?(\d{2})\.(\d{3})$/);
  if (!m) return null;
  return (+(m[1] || 0)) * 60 + (+m[2]) + (+m[3]) / 1000;
}

/* Diferenca para a melhor volta, em segundos. Negativo = mais rapido.
 *
 * 'ref' e' a volta de referencia: uma lista de [percentagem, segundos]
 * por ordem crescente. A percentagem e' a posicao na pista (0..1) e os
 * segundos sao o tempo decorrido nessa posicao.
 *
 * Devolve null quando nao ha referencia, quando a referencia tem de
 * menos de 4 pontos para valer alguma coisa, ou quando o carro esta
 * fora do percurso da referencia (antes do inicio ou depois do fim).
 * Nesses casos e' melhor mostrar "+0.000" do que um numero errado.
 */
function deltaParaRef(ref, pct, nowSec) {
  if (!ref || ref.length < 4) return null;
  if (pct < ref[0][0] - 0.01 || pct > ref[ref.length - 1][0] + 0.01) return null;
  let lo = ref[0], hi = ref[ref.length - 1];
  for (let i = 1; i < ref.length; i++) {
    if (ref[i][0] >= pct) { lo = ref[i - 1]; hi = ref[i]; break; }
  }
  if (hi[0] === lo[0]) return nowSec - lo[1];
  const f = (pct - lo[0]) / (hi[0] - lo[0]);
  return nowSec - (lo[1] + f * (hi[1] - lo[1]));
}

/* Abaixo deste valor a volta nao vira referencia. Numa sessao nova o
   iLastTime pode trazer o tempo de um sector ou de uma volta que foi
   abandonada, e um "melhor tempo" de 3 s estragaria o delta de todo o
   resto da sessao. */
const VOLTA_MINIMA_S = 20;

/* Qual das duas voltas e' a melhor. Devolve null quando nenhuma das
   duas serve, para o chamador nao limpar a referencia que ja tinha.
   'atual' pode ser null (ainda nao ha melhor volta). */
function melhorTempo(atual, novo) {
  if (novo == null || !(novo > VOLTA_MINIMA_S)) return null;
  if (atual == null || novo < atual) return novo;
  return null;
}

/* Junta um ponto [percentagem, segundos] a uma volta em curso.
 *
 * Quando a volta fica maior que 'max', em vez de deitar fora os pontos
 * mais antigos, REDUZ-SE A RESOLUCAO: fica um ponto em cada dois. Perder
 * o inicio da volta e' muito pior do que perder metade da resolucao,
 * porque a delta passa a devolver null em todo o comeco da pista e ainda
 * da um degrau no ponto onde a referencia comeca.
 *
 * Isto aconteceu a serio: uma volta de 116 s a 60 Hz da 6960 pontos, o
 * limite era 4000, e a referencia comecava em 22.6% da pista. Metade da
 * volta sem delta, e um salto de -4.9 s na fronteira.
 *
 * Devolve o array, porque reduzir a resolucao cria um array novo.
 */
function empilharPonto(volta, pct, seg, max) {
  volta.push([pct, seg]);
  let n = volta.length;
  while (n > max) {
    // de dois em dois, comecando no primeiro: o inicio da volta fica
    // sempre representado, que e' o ponto que interessa
    let m = 0;
    for (let i = 0; i < volta.length; i += 2) volta[m++] = volta[i];
    volta.length = m;
    n = m;
  }
  return volta;
}

/* Expoe para os testes quando corre no browser, e para o Node se um dia
   alguem quiser. No browser, load-bearing: o app.js usa estes nomes. */
if (typeof window !== 'undefined') {
  window.toSec = toSec;
  window.deltaParaRef = deltaParaRef;
  window.melhorTempo = melhorTempo;
  window.empilharPonto = empilharPonto;
  window.VOLTA_MINIMA_S = VOLTA_MINIMA_S;
}
/* ============================================================ leaderboard
 *
 * O INTERVALO AO VIVO. A coluna "Dif." que a leaderboard mostrava era a
 * diferenca entre as melhores voltas -- um numero que so muda quando
 * alguem improve o melhor tempo. Nao responde a pergunta que se faz
 * durante a corrida: "quanto tempo me falta para o apanhar".
 *
 * A ideia vem do leaderboard do Content Manager (CSP), que calcula o
 * intervalo a partir da posicao na pista e do ritmo, e nao das melhores
 * voltas. A logica e' a mesma; o que muda e' o dado que se usa para o
 * ritmo, e aqui ele tem de ser honesto.
 */

/* Abaixo desta velocidade a divisao da' tempos enormes. E' o mesmo
   piso de 18 m/s (65 km/h) que o CSP usa. */
const VEL_MIN = 18;

/* Intervalo, em segundos, do carro de tras para o da frente.
 *
 * Devolve {voltas, seg}: com voltas > 0 o carro da frente tem mais de
 * uma volta de vantagem e so interessa o numero de voltas. Com voltas 0,
 * seg e' o tempo.
 *
 * posF/posT sao posicoes na pista, 0..1 (o spLineLength que o AC
 * publica para cada carro). lapF/lapT sao as voltas ja completadas.
 *
 * ritmoF e' o ritmo do carro da frente em SEGUNDOS POR METRO -- a sua
 * ultima volta dividida pelo comprimento da pista. E' o que substitui o
 * que o CSP tem e' eu nao tenho: o CSP guarda a volta completa de cada
 * carro e sabe quanto tempo ele demorou a ir de um ponto a outro. Aqui
 * so' se pode assumir o ritmo medio da ultima volta, que e' uma
 * aproximacao honesta e nao exacta. Sem volta conhecida, recurso a
 * velocidade actual -- que e' o que o CSP faz quando os dois carros
 * estao perto um do outro.
 */
function intervaloAoVivo(o) {
  if (!o) return null;
  const tl = o.trackLength;
  if (typeof tl !== 'number' || !(tl > 0)) return null;
  const { lapF, pctF, lapT, pctT, velT, ritmoF } = o;
  if (![lapF, pctF, lapT, pctT].every((v) => typeof v === 'number' && isFinite(v))) return null;

  /* As voltas contam-se INTEIRAS, e so' a fracao e' que se subtrai em
     virgula flutuante. Somar as duas coisas primeiro
     (5.10 - 2.10) da 2.9999999999999996, e o floor disso e' 2 em vez de
     3: perdia-se uma volta de vantagem. Foi o que o teste apanhou.
   *
   * E' O CHAMADOR QUE PASSA O CARRO DA FRENTE -- o que estiver a serio
   * mais perto na pista. Por isso, quando a fracao da frente e' menor
   * (ele ja cruzou a meta e eu ainda nao), so' a fracao se corrige: as
   * voltas nao se mexem, porque ele esta' no mesmo instante de volta que
     eu. Se se mexessem, um carro a 10% contra um a 90% apareceria como
     "L -1" em vez de "faltam 20% da pista". */
  const voltas = Math.round(lapF) - Math.round(lapT);
  let frac = pctF - pctT;
  if (frac < 0) frac += 1;

  // uma volta ou mais de vantagem, ou de atraso: o numero que interessa
  // e' quantas, COM SINAL, como o CSP escreve ("L +1", "L -1")
  if (voltas !== 0) return { voltas: voltas, seg: null };

  const dist = frac * tl;
  let seg;
  if (typeof ritmoF === 'number' && ritmoF > 0) {
    seg = dist * ritmoF;
  } else {
    const v = Math.max(Math.abs(typeof velT === 'number' ? velT : 0), VEL_MIN);
    seg = dist / v;
  }
  if (!isFinite(seg) || seg < 0) return null;
  return { voltas: 0, seg: seg };
}

/* Onde a corrida comecou, para as setas de posicao ganha/perdida.
 *
 * O jogo da' a posicao a cada instante (livePos), mas nao a posicao no
 * momento da largada. Registra-se a primeira que se ve de cada carro e
 * compara-se. Como no CSP, um carro que nao muda de posicao durante
 * alguns segundos deixa de ter seta: uma seta que fica a piscar para
 * quem ganhou posicao e' pior do que nenhuma.
 */
function novoRastreadorPosicoes(limiteSegundos) {
  // 'marca' e' a ultima vez que o carro mudou de posicao. Sem ela o
  // codigo rebenta em Property 'marca' of undefined -- apanhado pelo
  // teste logo na primeira chamada.
  // 'corridaAntes' e' o estado da corrida no frame anterior: e' o que
  // permite saber que a corrida ARRANCOU agora e nao ha' 200 frames.
  return { inicio: {}, marca: {}, corridaAntes: false, limite: limiteSegundos || 40 };
}

/* Devolve true no frame em que a corrida passa de parada a corrida. E'
   esse o unico momento em que vale a pena guardar a posicao de largada:
   guardar em todos os frames repunha a referencia 60 vezes por segundo e
   as setas nunca apareciam. Foi o que o teste no browser apanhou. */
function corridaArranca(rast, corridaAtiva) {
  if (!rast) return false;
  const agora = !!corridaAtiva;
  const houve = agora && !rast.corridaAntes;
  rast.corridaAntes = agora;
  return houve;
}

function registarPosicoes(rast, id, pos, agoraSeg) {
  if (!rast || id == null || typeof pos !== 'number' || !(pos > 0)) return;
  if (rast.inicio[id] == null) rast.inicio[id] = pos;
  if (agoraSeg - (rast.marca[id] || 0) > rast.limite) {
    // parou de mexer: deixa de ter seta, e a proxima volta ao lugar
    // passa a contar a partir daqui
    rast.inicio[id] = pos;
    rast.marca[id] = agoraSeg;
  }
}

function diferencaPosicao(rast, id, pos) {
  if (!rast || id == null || typeof pos !== 'number') return 0;
  // posicao 0 nao e' uma posicao: e' "ainda nao ha' classificacao". Sem
  // esta guarda, um carro que aparece com 0 dava uma seta de 5 posicoes
  // ganhos do nada -- foi o que o teste apanhou.
  if (!(pos > 0)) return 0;
  const inicio = rast.inicio[id];
  if (inicio == null || !(inicio > 0)) return 0;
  return inicio - pos;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    toSec, deltaParaRef, melhorTempo, empilharPonto, VOLTA_MINIMA_S,
    intervaloAoVivo, VEL_MIN,
    novoRastreadorPosicoes, corridaArranca, registarPosicoes, diferencaPosicao
  };
}
