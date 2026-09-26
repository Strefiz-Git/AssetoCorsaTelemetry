/* Telemetria do Assetto Corsa - recebe os snapshots por Server-Sent Events
   e actualiza o DOM a 60 fps. Sem bibliotecas externas.                      */
'use strict';

const $ = (id) => document.getElementById(id);

const S = {
  path: [],            // pontos ja desenhados no mapa [x, y]
  minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9,
  lapPct: [],          // [pct, segundos] da volta actual
  refLap: null,        // melhor volta registada, para o delta
  lastLapPct: 0,
  frames: 0, fpsAt: performance.now(), fps: 0,
  lastPacket: null,
  bestMs: null,
  seenEver: false,
};

// ------------------------------------------------------------ rede
let es = null;
function connect() {
  es = new EventSource('/events');
  es.onmessage = (ev) => {
    let d;
    try { d = JSON.parse(ev.data); } catch (e) { return; }
    render(d);
  };
  es.onerror = () => {
    // o EventSource volta a ligar-se sozinho; so escondemos se parou
    if (es.readyState === EventSource.CLOSED) {
      setTimeout(connect, 1500);
    }
  };
}

// ------------------------------------------------------------ texto
const SECONDS = { '-': null };
function toSec(t) {
  if (!t || t.indexOf('--') === 0) return null;
  const m = t.match(/^(?:(\d+):)?(\d{2})\.(\d{3})$/);
  if (!m) return null;
  return (+(m[1] || 0)) * 60 + (+m[2]) + (+m[3]) / 1000;
}
function setTxt(id, v) { const e = $(id); if (e && e.textContent !== v) e.textContent = v; }

// ------------------------------------------------------------ delta
/* O AC nao da delta pronto. Comparamos a volta actual com a melhor volta
   registada, interpolando no mesmo ponto da pista (trackPct).            */
function computeDelta(pct, nowSec) {
  if (!S.refLap || S.refLap.length < 4) return null;
  const ref = S.refLap;
  if (pct < ref[0][0] - 0.01 || pct > ref[ref.length - 1][0] + 0.01) return null;
  // vizinho mais proximo em trackPct
  let lo = ref[0], hi = ref[ref.length - 1];
  for (let i = 1; i < ref.length; i++) {
    if (ref[i][0] >= pct) { lo = ref[i - 1]; hi = ref[i]; break; }
  }
  if (hi[0] === lo[0]) return nowSec - lo[1];
  const f = (pct - lo[0]) / (hi[0] - lo[0]);
  return nowSec - (lo[1] + f * (hi[1] - lo[1]));
}

function onLapComplete(pct, timeSec) {
  // a volta fechou: se foi a melhor, guardar como referencia
  if (timeSec != null && timeSec > 20) {
    if (S.bestMs == null || timeSec < S.bestMs) {
      S.bestMs = timeSec;
      S.refLap = S.lapPct.slice();
    }
  }
  S.lapPct = [];
}

// ------------------------------------------------------------ mapa
const MAP_KEY = 'acmap.v1';

function saveMap() {
  // nao vale a pena guardar a cada ponto: o traço muda de forma lenta
  if (Date.now() - (S.lastSave || 0) < 4000) return;
  S.lastSave = Date.now();
  try {
    // arredonda para nao encher o localStorage
    const pts = S.path.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
    localStorage.setItem(MAP_KEY, JSON.stringify({ t: S.trackName, p: pts }));
  } catch (e) { /* quota cheia: ignora */ }
}

function loadMap() {
  try {
    const raw = localStorage.getItem(MAP_KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    if (!o || !Array.isArray(o.p) || o.p.length < 2) return;
    S.path = o.p;
    S.trackName = o.t || '';
    for (const [x, y] of S.path) {
      if (x < S.minX) S.minX = x; if (x > S.maxX) S.maxX = x;
      if (y < S.minY) S.minY = y; if (y > S.maxY) S.maxY = y;
    }
  } catch (e) { /* ignora */ }
}

function pushMapPoint(x, y) {
  if (!isFinite(x) || !isFinite(y)) return;
  if (x === 0 && y === 0) return;                 // sem posicao ainda
  const p = S.path[S.path.length - 1];
  if (p && Math.abs(p[0] - x) + Math.abs(p[1] - y) < 0.35) return;  // dedupe
  S.path.push([x, y]);
  if (S.path.length > 20000) S.path.splice(0, 5000);
  if (x < S.minX) S.minX = x; if (x > S.maxX) S.maxX = x;
  if (y < S.minY) S.minY = y; if (y > S.maxY) S.maxY = y;
  saveMap();
}

function resetMap(clearStorage) {
  S.path = []; S.minX = 1e9; S.maxX = -1e9; S.minY = 1e9; S.maxY = -1e9;
  S.lapPct = []; S.refLap = null; S.bestMs = null;
  if (clearStorage) { try { localStorage.removeItem(MAP_KEY); } catch (e) { } }
}

function drawMap() {
  const cv = $('map');
  if (!cv) return;
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== w * dpr || cv.height !== h * dpr) {
    cv.width = w * dpr; cv.height = h * dpr;
  }
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);

  if (S.path.length < 2) {
    c.fillStyle = '#555C5D';
    c.font = '600 12px Titillium, sans-serif';
    c.textAlign = 'center';
    c.fillText('a rodar, o mapa desenha-se sozinho', w / 2, h / 2);
    return;
  }

  const spanX = Math.max(S.maxX - S.minX, 1);
  const spanY = Math.max(S.maxY - S.minY, 1);
  const pad = 26;
  const sc = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
  const ox = (w - spanX * sc) / 2 - S.minX * sc;
  const oy = (h - spanY * sc) / 2 - S.minY * sc;

  // traco da pista
  c.lineWidth = 4;
  c.strokeStyle = '#151C1D';
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath();
  c.moveTo(S.path[0][0] * sc + ox, -S.path[0][1] * sc + oy);
  for (let i = 1; i < S.path.length; i++) {
    c.lineTo(S.path[i][0] * sc + ox, -S.path[i][1] * sc + oy);
  }
  c.stroke();

  // contorno fino para se ver sobre fundo escuro
  c.lineWidth = 1.2;
  c.strokeStyle = 'rgba(85,92,93,.75)';
  c.stroke();

  // carro
  const p = S.path[S.path.length - 1];
  const cx = p[0] * sc + ox, cy = -p[1] * sc + oy;
  c.beginPath(); c.arc(cx, cy, 5.5, 0, Math.PI * 2);
  c.fillStyle = '#FFD700'; c.fill();
  c.lineWidth = 1.5; c.strokeStyle = '#fff'; c.stroke();
}

// ------------------------------------------------------- barras de pneu
function drawTyreBar(id, mid) {
  const cv = $(id);
  if (!cv) return;
  const w = cv.width, h = cv.height;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, w, h);
  // escala 40..130 C
  const lo = 40, hi = 130;
  const f = Math.max(0, Math.min(1, (mid - lo) / (hi - lo)));
  // verde -> laranja -> vermelho
  const g = c.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#23CF16'); g.addColorStop(0.55, '#23CF16');
  g.addColorStop(0.78, '#F58020'); g.addColorStop(1, '#FF0000');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // marcador da posicao actual
  c.fillStyle = '#fff';
  c.fillRect(Math.max(0, Math.min(w - 3, f * w - 1.5)), 0, 3, h);
  c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 1;
  c.strokeRect(.5, .5, w - 1, h - 1);
}

function tempColor(t) {
  if (t >= 105) return '#FF0000';
  if (t >= 95) return '#F58020';
  return '#FFFFFF';
}

// ------------------------------------------------------------ render
function render(d) {
  const app = $('app'), off = $('offline');

  // so escondemos tudo se nunca houve shared memory. Se o jogo esta em
  // pausa ou no menu, packetId para - mas os dados continuam a ser uteis,
  // por isso mostramos e assinamos o estado.
  const firstEver = S.seenEver === true;
  if (!d.connected && firstEver) {
    app.classList.add('hidden'); off.classList.remove('hidden');
    $('offline-msg').textContent = 'À espera da telemetria do Assetto Corsa…';
    return;
  }
  S.seenEver = true;
  if (app.classList.contains('hidden')) {
    app.classList.remove('hidden'); off.classList.add('hidden');
  }

  // estado: ao vivo / em pausa / jogo encerrado
  const sp = d.sincePacket || 0;
  const lbl = d.live ? 'AO VIVO'
    : sp < 90 ? 'EM PAUSA'
      : 'JOGO ENCERRADO';
  setTxt('src', lbl + (d.live ? '' : '  ·  ultimos valores')
    + '  ·  fonte: shared memory do AC, sem SimHub');
  document.body.classList.toggle('paused', !d.live);

  // mudar de pista invalida o mapa guardado
  if (S.trackName && d.track && d.track !== S.trackName) resetMap(true);
  S.trackName = d.track || S.trackName;

  // reiniciar o mapa quando o jogo reinica a sessao
  if (S.lastPacket != null && d.packetId < S.lastPacket) resetMap(false);
  S.lastPacket = d.packetId;

  S.frames++;
  const now = performance.now();
  if (now - S.fpsAt >= 1000) {
    S.fps = Math.round(S.frames * 1000 / (now - S.fpsAt));
    S.frames = 0; S.fpsAt = now;
    setTxt('fps', S.fps + ' fps');
  }

  // cabecalho
  setTxt('track', d.track || '—');
  setTxt('car', d.car || '—');
  setTxt('session', (d.session || '—') + (d.compound ? '  ·  ' + d.compound.replace('_', ' ') : ''));
  setTxt('pos', d.position > 0 ? 'P' + d.position : '—');
  setTxt('lap', d.totalLaps ? 'VOLTA ' + (d.lap + 1) + '/' + d.totalLaps : 'VOLTA ' + (d.lap + 1));

  const fl = $('flag');
  fl.textContent = d.flag || '—';
  fl.className = 'flag' + (
    d.flagId === 2 ? ' f-yellow' : d.flagId === 3 ? ' f-red'
      : d.flagId === 1 ? ' f-blue' : d.flagId === 5 ? ' f-checkered' : '');

  // velocidade / caixa / rpm
  setTxt('speed', Math.round(d.speed || 0));
  setTxt('gear', d.gear || 'N');
  const maxRpm = d.maxRpm || 12000;
  setTxt('rpm', d.rpm || 0);
  // a barra e' uma "mascara" escura que cobre a parte ja usada
  $('rpm-fill').style.width = Math.max(0, 100 - Math.min(100, (d.rpm || 0) / maxRpm * 100)) + '%';
  $('throttle-bar').style.width = (d.throttle || 0) + '%';
  $('brake-bar').style.width = (d.brake || 0) + '%';

  // chips
  const chip = (id, txt, cls) => {
    const e = $(id); if (!e) return;
    e.querySelector('b').textContent = txt;
    e.className = 'chip' + (cls ? ' ' + cls : '');
  };
  const drsOn = d.drsEnabled >= 1, drsOk = d.drsAvailable >= 1;
  chip('chip-drs', !d.hasDRS ? 'N/A' : drsOn ? 'ATIVO' : drsOk ? 'LIVRE' : 'OFF',
       !d.hasDRS ? '' : drsOn ? 'on' : drsOk ? 'warn' : '');
  const hasE = d.hasERS || d.hasKERS;
  chip('chip-ers', hasE ? Math.round(d.ersPct || 0) + '%' : 'N/A',
       hasE ? ((d.ersPct || 0) > 25 ? 'on' : 'warn') : '');
  chip('chip-pen', d.penaltyTime > 0 ? '+' + d.penaltyTime + 's' : (d.penaltyFlag ? 'FLAG' : 'OK'),
       d.penaltyTime > 0 ? 'bad' : '');
  chip('chip-abs', d.abs >= 0.5 ? 'ON' : 'OFF', d.abs >= 0.5 ? 'warn' : '');
  chip('chip-tc', d.tc >= 0.5 ? 'ON' : 'OFF', d.tc >= 0.5 ? 'warn' : '');
  chip('chip-pit', d.pitLimiter ? 'LIM' : (d.isInPit ? 'PIT' : '—'), d.pitLimiter ? 'bad' : (d.isInPit ? 'warn' : ''));

  // tempos
  setTxt('t-current', d.currentTime || '--:--.---');
  setTxt('t-best', d.bestTime || '--:--.---');
  setTxt('t-last', d.lastTime || '--:--.---');

  const curSec = toSec(d.currentTime);
  if (curSec != null) {
    const pct = d.trackPct || 0;
    // virada de volta: o pct volta a zero
    if (pct < S.lastLapPct - 0.3) onLapComplete(S.lastLapPct, toSec(d.lastTime));
    S.lastLapPct = pct;
    S.lapPct.push([pct, curSec]);
    if (S.lapPct.length > 4000) S.lapPct.shift();

    const dl = computeDelta(pct, curSec);
    const e = $('t-delta');
    if (dl == null) { e.textContent = '+0.000'; e.className = 'val'; }
    else {
      e.textContent = (dl >= 0 ? '+' : '') + dl.toFixed(3);
      e.className = 'val' + (dl < 0 ? ' neg' : '');
    }
    $('lap-progress').style.width = Math.min(100, pct * 100) + '%';
  }

  // mapa
  pushMapPoint(d.x, d.y);
  setTxt('trackpct', ((d.trackPct || 0) * 100).toFixed(1) + '%  da volta');
  setTxt('sector', 'SETOR ' + ((d.sector || 0) + 1) + (d.sectorCount ? '/' + d.sectorCount : ''));
  drawMap();

  // pneus
  for (let i = 0; i < 4; i++) {
    const mid = (d.tyreTempM && d.tyreTempM[i]) || 0;
    const inn = (d.tyreTempI && d.tyreTempI[i]) || mid;
    const out = (d.tyreTempO && d.tyreTempO[i]) || mid;
    setTxt('tt-' + i, mid || '--');
    const e = $('tt-' + i); if (e) e.style.color = tempColor(mid);
    drawTyreBar('tb-' + i, mid);
    // 'tyreWear' vem em 0..100 (100 = novo); mostramos o desgaste
    const worn = (d.tyreWearUsed && d.tyreWearUsed[i] != null)
      ? d.tyreWearUsed[i] : null;
    setTxt('tw-' + i, worn == null ? '--' : worn.toFixed(1) + '%');
    e.title = 'int ' + inn + '  meio ' + mid + '  ext ' + out + ' °C';
  }

  // travões
  for (let i = 0; i < 4; i++) {
    const t = Math.round((d.brakeTemp && d.brakeTemp[i]) || 0);
    setTxt('bt-' + i, t || '--');
    const e = $('bt-' + i);
    if (e) e.style.color = !t ? '' : t > 600 ? '#FF0000' : t > 400 ? '#F58020' : '#fff';
  }

  // combustivel
  setTxt('fuel-pct', Math.round(d.fuelPct || 0));
  $('fuel-bar').style.width = Math.min(100, d.fuelPct || 0) + '%';
  setTxt('fuel-l', (d.fuelL || 0).toFixed(1) + ' L');
  setTxt('fuel-max', (d.maxFuelL || 0).toFixed(0) + ' L');
  setTxt('temps', Math.round(d.airTemp || 0) + ' / ' + Math.round(d.roadTemp || 0) + ' °C');
  const pe = $('pen-time');
  pe.textContent = d.penaltyTime > 0 ? '+' + d.penaltyTime + ' s' : (d.penaltiesEnabled ? 'nenhuma' : 'desativadas');
  pe.className = d.penaltyTime > 0 ? 'alert' : '';
}

let raf = 0;
function loop() { drawMap(); raf = requestAnimationFrame(loop); }

window.addEventListener('resize', () => { /* o canvas reajusta no proximo frame */ });

const clearBtn = $('map-clear');
if (clearBtn) clearBtn.addEventListener('click', () => { resetMap(true); drawMap(); });

loadMap();
connect();
loop();
