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

/* Expoe para os testes quando corre no browser, e para o Node se um dia
   alguem quiser. No browser, load-bearing: o app.js usa estes nomes. */
if (typeof window !== 'undefined') {
  window.toSec = toSec;
  window.deltaParaRef = deltaParaRef;
  window.melhorTempo = melhorTempo;
  window.VOLTA_MINIMA_S = VOLTA_MINIMA_S;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { toSec, deltaParaRef, melhorTempo, VOLTA_MINIMA_S };
}
