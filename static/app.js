/* =========================================================================
   Assetto Corsa Telemetry - cliente
   Recebe telemetria por SSE e adversarios por um segundo canal.
   Sem dependencias externas.
   ========================================================================= */
'use strict';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/* ------------------------------------------------------------------ i18n */
const I18N = {
  'pt-PT': {
    'app.title': 'Telemetria AC',
    'boot.waiting': 'A aguardar o Assetto Corsa',
    'boot.reading': 'A ler a telemetria directamente do jogo…',
    'boot.closed': 'Jogo fechado. A abrir o AC, ou a verificar se está a correr.',
    'menu.title': 'O que queres ver?',
    'menu.sub': 'Podes mudar a qualquer momento nas definições.',
    'menu.telemetry': 'Telemetria',
    'menu.telemetryDesc': 'Velocidade, rpm, pedais, pneus, combustível',
    'menu.leaderboard': 'Leaderboard',
    'menu.leaderboardDesc': 'Classificação de todos os carros',
    'menu.both': 'Misto',
    'menu.bothDesc': 'Telemetria e leaderboard ao mesmo tempo',
    'set.title': 'Definições', 'set.mode': 'Vista', 'set.units': 'Unidades',
    'set.lang': 'Idioma', 'set.map': 'Mapa', 'set.mapOn': 'Mostrar',
    'set.mapOff': 'Esconder', 'set.clearMap': 'Apagar o mapa desenhado',
    'set.mapViewFull': 'Pista inteira', 'set.mapViewRel': 'Vista relativa',
    'set.mapViewWhy': 'Na vista relativa o mapa fica centrado no carro e o zoom acompanha a velocidade: paradoxo, abre; a acelerar, fecha. É o que se quer quando se está a conduzir.',
    'set.acPathWhy': 'Para o mapa aparecer completo desde o início (em vez de descoberto a conduzir), indica a pasta onde o Assetto Corsa está instalado.',
    'set.acPathSave': 'Guardar', 'set.mapFlipX': 'Inverter X', 'set.mapFlipZ': 'Inverter Z',
    'set.acPathAuto': 'Detetada automaticamente: {p}', 'set.acPathOk': 'Pasta válida: {p}',
    'set.acPathBad': 'Não encontrei "content/tracks" nessa pasta — confirma o caminho.',
    'set.acPathNone': 'Ainda não configurada. Sem ela, o mapa é desenhado a conduzir.',
    'set.acPathSaving': 'A verificar...',
    'set.drsZone': 'Zona de DRS', 'set.drsMark': 'Marcar a zona', 'set.drsMarking': 'A marcar... clica para parar', 'set.drsClear': 'Apagar a zona de DRS',
    'set.drsZoneWhy': 'O jogo nao diz onde acaba a zona: o drsAvailable fica a 1 quase sempre, por isso o mapa teria a pista toda a verde. Marca-se a zona a conduzir, com o tracado real.',
    'set.drsVerdictZona': 'O drsAvailable marca a zona nesta pista - pintado automaticamente.',
    'set.drsVerdictSempre': 'O drsAvailable ficou ligado quase sempre nesta pista, por isso NAO marca a zona. Pinta-se a mao.',
    'set.drsVerdictNunca': 'O drsAvailable nunca ficou ligado nesta pista, por isso NAO marca a zona.',
    'set.drsAMedir': 'A medir o drsAvailable numa volta inteira...',
    'set.fps': 'Envio de dados', 'set.about': 'Sobre',
    'set.aboutBody': 'Telemetria lida directamente da memória do Assetto Corsa. Sem SimHub.',
    'drs.short': 'DRS', 'gear.label': 'CAIXA', 'unit.kmh': 'km/h',
    'unit.mph': 'mph', 'unit.rpm': 'rpm',
    'ers.short': 'ERS', 'pit.short': 'PIT', 'state.off': 'OFF',
    'state.on': 'ON', 'state.lim': 'LIM',
    'map.title': 'MAPA DA PISTA', 'pedals.title': 'PEDAIS',
    'wheel.title': 'VOLANTE', 'wheel.note': 'Angulo do volante, de -1 a 1. O alcance do valor esta'
    + ' por confirmar a conduzir.',
    'map.drsKey': 'zona de DRS',
    'pedals.throttle': 'ACEL.', 'pedals.brake': 'TRAVA',
    'pedals.clutch': 'EMBRAIAGEM', 'pedals.handbrake': 'FREIO DE MÃO',
    'pedals.pequeno': 'pouco espaco', 'pedals.agora': 'agora',
    'laps.title': 'VOLTAS', 'laps.current': 'ATUAL', 'laps.best': 'MELHOR',
    'laps.last': 'ANTERIOR', 'laps.delta': 'DELTA',
    'tyres.title': 'PNEUS E TRAVÕES', 'tyres.worn': 'gasto',
    'brakes.title': 'TRAVÕES', 'fuel.title': 'COMBUSTÍVEL',
    'wx.air': 'AR', 'wx.road': 'PISTA', 'wx.wind': 'VENTO', 'wx.density': 'DENSIDADE', 'wx.grip': 'ADERENCIA', 'unit.c': '°C',
    'fuel.inTank': 'Na reserva', 'fuel.lapsLeft': 'Voltas',
    'fuel.ambient': 'Ar / pista', 'fuel.penalty': 'Penalidade',
    'fuel.ersUsed': 'ERS na volta', 'fuel.none': 'nenhuma',
    'lb.title': 'CLASSIFICAÇÃO', 'lb.telTitle': 'TEU CARRO',
    'lb.pos': 'P', 'lb.name': 'PILOTO', 'lb.lap': 'VOLTA',
    'lb.time': 'TEMPO', 'lb.best': 'MELHOR', 'lb.gap': 'DIF.',
    'lb.penalty': 'Penalidade', 'lb.drs': 'DRS',
    'foot.src': 'memória do AC, sem SimHub',
    'status.live': 'AO VIVO', 'status.paused': 'EM PAUSA',
    'status.closed': 'JOGO ENCERRADO', 'status.stale': 'últimos valores',
    'sector': 'SETOR', 'lapCount': 'VOLTA',
    'drs.off': 'OFF', 'drs.avail': 'LIVRE', 'drs.open': 'ABERTO',
    'opp.waiting': 'A aguardar os dados dos adversários.',
    'opp.how': 'A app Python do SimHub escreve a página de memória com os carros. Confirma que está activa no Content Manager (<b>Settings → Python Apps → SimHub</b>) e que o AC está numa sessão com outros carros.',
    'opp.none': 'Nenhum carro na sessão.',
    'lb.pit': 'PIT',
  },
  'pt-BR': {
    'app.title': 'Telemetria AC', 'boot.waiting': 'Aguardando o Assetto Corsa',
    'boot.reading': 'Lendo a telemetria direto do jogo…',
    'boot.closed': 'Jogo fechado. Abra o AC, ou verifique se está rodando.',
    'menu.title': 'O que você quer ver?', 'menu.sub': 'Dá para mudar a qualquer momento nas configurações.',
    'menu.telemetry': 'Telemetria', 'menu.telemetryDesc': 'Velocidade, rpm, pedais, pneus, combustível',
    'menu.leaderboard': 'Leaderboard', 'menu.leaderboardDesc': 'Classificação de todos os carros',
    'menu.both': 'Misto', 'menu.bothDesc': 'Telemetria e leaderboard ao mesmo tempo',
    'set.title': 'Configurações', 'set.mode': 'Tela', 'set.units': 'Unidades',
    'set.lang': 'Idioma', 'set.map': 'Mapa', 'set.mapOn': 'Mostrar',
    'set.mapOff': 'Esconder', 'set.clearMap': 'Apagar o mapa desenhado',
    'set.mapViewFull': 'Pista inteira', 'set.mapViewRel': 'Vista relativa',
    'set.mapViewWhy': 'Na vista relativa o mapa fica centralizado no carro e o zoom acompanha a velocidade: parado, abre; acelerando, fecha. É o que se quer quando se está dirigindo.',
    'set.acPathWhy': 'Para o mapa aparecer completo desde o início (em vez de descoberto dirigindo), informe a pasta onde o Assetto Corsa está instalado.',
    'set.acPathSave': 'Salvar', 'set.mapFlipX': 'Inverter X', 'set.mapFlipZ': 'Inverter Z',
    'set.acPathAuto': 'Detectada automaticamente: {p}', 'set.acPathOk': 'Pasta válida: {p}',
    'set.acPathBad': 'Não encontrei "content/tracks" nessa pasta — confira o caminho.',
    'set.acPathNone': 'Ainda não configurada. Sem ela, o mapa é desenhado dirigindo.',
    'set.acPathSaving': 'Verificando...',
    'set.drsZone': 'Zona de DRS', 'set.drsMark': 'Marcar a zona', 'set.drsMarking': 'Marcando... clique para parar', 'set.drsClear': 'Apagar a zona de DRS',
    'set.drsZoneWhy': 'O jogo nao diz onde termina a zona: o drsAvailable fica em 1 quase sempre, por isso o mapa teria a pista toda verde. Marque a zona dirigindo, com o tracado real.',
    'set.drsVerdictZona': 'O drsAvailable marca a zona nesta pista - pintado automaticamente.',
    'set.drsVerdictSempre': 'O drsAvailable ficou ligado quase sempre nesta pista, por isso NAO marca a zona. Pinta-se na mao.',
    'set.drsVerdictNunca': 'O drsAvailable nunca ficou ligado nesta pista, por isso NAO marca a zona.',
    'set.drsAMedir': 'Medindo o drsAvailable numa volta inteira...',
    'set.fps': 'Envio de dados', 'set.about': 'Sobre',
    'set.aboutBody': 'Telemetria lida direto da memória do Assetto Corsa. Sem SimHub.',
    'drs.short': 'DRS', 'gear.label': 'MARCHA', 'unit.kmh': 'km/h',
    'unit.mph': 'mph', 'unit.rpm': 'rpm', 'ers.short': 'ERS', 'pit.short': 'BOX',
    'state.off': 'OFF', 'state.on': 'ON', 'state.lim': 'LIM',
    'map.title': 'MAPA DA PISTA', 'pedals.title': 'PEDAIS',
    'wheel.title': 'VOLANTE', 'wheel.note': 'Angulo do volante, de -1 a 1. O alcance do valor esta'
    + ' por confirmar dirigindo.',
    'map.drsKey': 'zona de DRS',
    'pedals.throttle': 'ACEL.', 'pedals.brake': 'FREIO',
    'pedals.clutch': 'EMBREAGEM', 'pedals.handbrake': 'FREIO DE MÃO',
    'pedals.pequeno': 'pouco espaco', 'pedals.agora': 'agora',
    'laps.title': 'VOLTAS', 'laps.current': 'ATUAL', 'laps.best': 'MELHOR',
    'laps.last': 'ANTERIOR', 'laps.delta': 'DELTA',
    'tyres.title': 'PNEUS E FREIOS', 'tyres.worn': 'usado',
    'brakes.title': 'FREIOS', 'fuel.title': 'COMBUSTÍVEL',
    'wx.air': 'AR', 'wx.road': 'PISTA', 'wx.wind': 'VENTO', 'wx.density': 'DENSIDADE', 'wx.grip': 'ADERENCIA', 'unit.c': '°C',
    'fuel.inTank': 'No tanque', 'fuel.lapsLeft': 'Voltas',
    'fuel.ambient': 'Ar / pista', 'fuel.penalty': 'Penalty',
    'fuel.ersUsed': 'ERS na volta', 'fuel.none': 'nenhuma',
    'lb.title': 'CLASSIFICAÇÃO', 'lb.telTitle': 'SEU CARRO',
    'lb.pos': 'P', 'lb.name': 'PILOTO', 'lb.lap': 'VOLTA',
    'lb.time': 'TEMPO', 'lb.best': 'MELHOR', 'lb.gap': 'DIF.',
    'lb.penalty': 'Penalty', 'lb.drs': 'DRS',
    'foot.src': 'memória do AC, sem SimHub',
    'status.live': 'AO VIVO', 'status.paused': 'EM PAUSA',
    'status.closed': 'JOGO ENCERRADO', 'status.stale': 'últimos valores',
    'sector': 'SETOR', 'lapCount': 'VOLTA',
    'drs.off': 'OFF', 'drs.avail': 'LIVRE', 'drs.open': 'ABERTO',
    'opp.waiting': 'Aguardando os dados dos adversários.',
    'opp.how': 'O app Python do SimHub escreve a página de memória com os carros. Confirme que está ativo no Content Manager (<b>Settings → Python Apps → SimHub</b>) e que o AC está numa sessão com outros carros.',
    'opp.none': 'Nenhum carro na sessão.', 'lb.pit': 'BOX',
  },
  'es': {
    'app.title': 'Telemetría AC', 'boot.waiting': 'Esperando al Assetto Corsa',
    'boot.reading': 'Leyendo la telemetría directamente del juego…',
    'boot.closed': 'Juego cerrado. Abre el AC, o comprueba si está en marcha.',
    'menu.title': '¿Qué quieres ver?', 'menu.sub': 'Puedes cambiarlo cuando quieras en los ajustes.',
    'menu.telemetry': 'Telemetría', 'menu.telemetryDesc': 'Velocidad, rpm, pedales, neumáticos, combustible',
    'menu.leaderboard': 'Leaderboard', 'menu.leaderboardDesc': 'Clasificación de todos los coches',
    'menu.both': 'Mixto', 'menu.bothDesc': 'Telemetría y leaderboard a la vez',
    'set.title': 'Ajustes', 'set.mode': 'Vista', 'set.units': 'Unidades',
    'set.lang': 'Idioma', 'set.map': 'Mapa', 'set.mapOn': 'Mostrar',
    'set.mapOff': 'Ocultar', 'set.clearMap': 'Borrar el mapa dibujado',
    'set.mapViewFull': 'Pista completa', 'set.mapViewRel': 'Vista relativa',
    'set.mapViewWhy': 'En la vista relativa el mapa se centra en el coche y el zoom sigue a la velocidad: parado, se abre; acelerando, se cierra. Es lo que se quiere mientras se conduce.',
    'set.acPathWhy': 'Para que el mapa aparezca completo desde el principio (en vez de descubrirse conduciendo), indica la carpeta donde está instalado Assetto Corsa.',
    'set.acPathSave': 'Guardar', 'set.mapFlipX': 'Invertir X', 'set.mapFlipZ': 'Invertir Z',
    'set.acPathAuto': 'Detectada automáticamente: {p}', 'set.acPathOk': 'Carpeta válida: {p}',
    'set.acPathBad': 'No encontré "content/tracks" en esa carpeta — revisa la ruta.',
    'set.acPathNone': 'Aún no configurada. Sin ella, el mapa se dibuja conduciendo.',
    'set.acPathSaving': 'Comprobando...',
    'set.drsZone': 'Zona de DRS', 'set.drsMark': 'Marcar la zona', 'set.drsMarking': 'Marcando... pulsa para parar', 'set.drsClear': 'Borrar la zona de DRS',
    'set.drsZoneWhy': 'El juego no dice donde acaba la zona: el drsAvailable se queda en 1 casi siempre, por eso el mapa tendria el circuito todo en verde. Marcala conduciendo, con el trazado real.',
    'set.drsVerdictZona': 'El drsAvailable marca la zona en esta pista - pintado automaticamente.',
    'set.drsVerdictSempre': 'El drsAvailable se quedo encendido casi siempre en esta pista, asi que NO marca la zona. Se pinta a mano.',
    'set.drsVerdictNunca': 'El drsAvailable nunca se encendio en esta pista, asi que NO marca la zona.',
    'set.drsAMedir': 'Midiendo el drsAvailable en una vuelta entera...',
    'set.fps': 'Envío de datos', 'set.about': 'Acerca de',
    'set.aboutBody': 'Telemetría leída directamente de la memoria del Assetto Corsa. Sin SimHub.',
    'drs.short': 'DRS', 'gear.label': 'MARCHA', 'unit.kmh': 'km/h',
    'unit.mph': 'mph', 'unit.rpm': 'rpm', 'ers.short': 'ERS', 'pit.short': 'PIT',
    'state.off': 'OFF', 'state.on': 'ON', 'state.lim': 'LIM',
    'map.title': 'MAPA DE LA PISTA', 'pedals.title': 'PEDALES',
    'wheel.title': 'VOLANTE', 'wheel.note': 'Angulo del volante, de -1 a 1. El alcance del valor esta'
    + ' por confirmar conduciendo.',
    'map.drsKey': 'zona de DRS',
    'pedals.throttle': 'ACEL.', 'pedals.brake': 'FRENO',
    'pedals.clutch': 'EMBRAGUE', 'pedals.handbrake': 'FRENO DE MANO',
    'pedals.pequeno': 'poco espacio', 'pedals.agora': 'ahora',
    'laps.title': 'VUELTAS', 'laps.current': 'ACTUAL', 'laps.best': 'MEJOR',
    'laps.last': 'ANTERIOR', 'laps.delta': 'DELTA',
    'tyres.title': 'NEUMÁTICOS Y FRENOS', 'tyres.worn': 'gastado',
    'brakes.title': 'FRENOS', 'fuel.title': 'COMBUSTIBLE',
    'wx.air': 'AIRE', 'wx.road': 'PISTA', 'wx.wind': 'VIENTO', 'wx.density': 'DENSIDAD', 'wx.grip': 'ADHERENCIA', 'unit.c': '°C',
    'fuel.inTank': 'En el depósito', 'fuel.lapsLeft': 'Vueltas',
    'fuel.ambient': 'Aire / pista', 'fuel.penalty': 'Penalización',
    'fuel.ersUsed': 'ERS en la vuelta', 'fuel.none': 'ninguna',
    'lb.title': 'CLASIFICACIÓN', 'lb.telTitle': 'TU COCHE',
    'lb.pos': 'P', 'lb.name': 'PILOTO', 'lb.lap': 'VUELTA',
    'lb.time': 'TIEMPO', 'lb.best': 'MEJOR', 'lb.gap': 'DIF.',
    'lb.penalty': 'Penalización', 'lb.drs': 'DRS',
    'foot.src': 'memoria del AC, sin SimHub',
    'status.live': 'EN VIVO', 'status.paused': 'EN PAUSA',
    'status.closed': 'JUEGO CERRADO', 'status.stale': 'últimos valores',
    'sector': 'SECTOR', 'lapCount': 'VUELTA',
    'drs.off': 'OFF', 'drs.avail': 'LIBRE', 'drs.open': 'ABIERTO',
    'opp.waiting': 'Esperando los datos de los rivales.',
    'opp.how': 'La app Python de SimHub escribe la página de memoria con los coches. Comprueba que está activa en el Content Manager (<b>Settings → Python Apps → SimHub</b>) y que el AC está en una sesión con otros coches.',
    'opp.none': 'Ningún coche en la sesión.', 'lb.pit': 'PIT',
  },
  'en': {
    'app.title': 'AC Telemetry', 'boot.waiting': 'Waiting for Assetto Corsa',
    'boot.reading': 'Reading telemetry straight from the game…',
    'boot.closed': 'Game closed. Start AC, or check that it is running.',
    'menu.title': 'What do you want to see?',
    'menu.sub': 'You can change this later in the settings.',
    'menu.telemetry': 'Telemetry',
    'menu.telemetryDesc': 'Speed, rpm, pedals, tyres, fuel',
    'menu.leaderboard': 'Leaderboard',
    'menu.leaderboardDesc': 'Standings for every car',
    'menu.both': 'Both', 'menu.bothDesc': 'Telemetry and leaderboard at once',
    'set.title': 'Settings', 'set.mode': 'View', 'set.units': 'Units',
    'set.lang': 'Language', 'set.map': 'Map', 'set.mapOn': 'Show',
    'set.mapOff': 'Hide', 'set.clearMap': 'Clear the drawn map',
    'set.mapViewFull': 'Full track', 'set.mapViewRel': 'Relative view',
    'set.mapViewWhy': 'In the relative view the map is centred on the car and the zoom follows the speed: stopped, it opens up; accelerating, it closes in. That is what you want while driving.',
    'set.acPathWhy': 'For the map to appear complete from the start (instead of being discovered while driving), point this at your Assetto Corsa install folder.',
    'set.acPathSave': 'Save', 'set.mapFlipX': 'Flip X', 'set.mapFlipZ': 'Flip Z',
    'set.acPathAuto': 'Auto-detected: {p}', 'set.acPathOk': 'Valid folder: {p}',
    'set.acPathBad': 'Could not find "content/tracks" in that folder — check the path.',
    'set.acPathNone': 'Not set yet. Without it, the map is drawn while driving.',
    'set.acPathSaving': 'Checking...',
    'set.drsZone': 'DRS zone', 'set.drsMark': 'Mark the zone', 'set.drsMarking': 'Marking... click to stop', 'set.drsClear': 'Clear the DRS zone',
    'set.drsZoneWhy': 'The game does not say where the zone ends: drsAvailable stays at 1 almost everywhere, so the map would be green all the way round. Mark it while driving, on the real line.',
    'set.drsVerdictZona': 'drsAvailable does mark the zone on this track - painted automatically.',
    'set.drsVerdictSempre': 'drsAvailable stayed on almost all the way round, so it does NOT mark the zone. Mark it by hand.',
    'set.drsVerdictNunca': 'drsAvailable never came on on this track, so it does NOT mark the zone.',
    'set.drsAMedir': 'Measuring drsAvailable over a full lap...',
    'set.fps': 'Data rate', 'set.about': 'About',
    'set.aboutBody': 'Telemetry read straight from Assetto Corsa memory. No SimHub.',
    'drs.short': 'DRS', 'gear.label': 'GEAR', 'unit.kmh': 'km/h',
    'unit.mph': 'mph', 'unit.rpm': 'rpm', 'ers.short': 'ERS', 'pit.short': 'PIT',
    'state.off': 'OFF', 'state.on': 'ON', 'state.lim': 'LIM',
    'map.title': 'TRACK MAP', 'pedals.title': 'PEDALS',
    'wheel.title': 'STEERING', 'wheel.note': 'Steering angle, from -1 to 1. The range of the value is'
    + ' not confirmed yet, measured while driving.',
    'map.drsKey': 'DRS zone',
    'pedals.throttle': 'THROTTLE', 'pedals.brake': 'BRAKE',
    'pedals.clutch': 'CLUTCH', 'pedals.handbrake': 'HANDBRAKE',
    'pedals.pequeno': 'not enough room', 'pedals.agora': 'now',
    'laps.title': 'LAPS', 'laps.current': 'CURRENT', 'laps.best': 'BEST',
    'laps.last': 'LAST', 'laps.delta': 'DELTA',
    'tyres.title': 'TYRES AND BRAKES', 'tyres.worn': 'worn',
    'brakes.title': 'BRAKES', 'fuel.title': 'FUEL',
    'wx.air': 'AIR', 'wx.road': 'TRACK', 'wx.wind': 'WIND', 'wx.density': 'DENSITY', 'wx.grip': 'GRIP', 'unit.c': '°C',
    'fuel.inTank': 'In tank', 'fuel.lapsLeft': 'Laps',
    'fuel.ambient': 'Air / track', 'fuel.penalty': 'Penalty',
    'fuel.ersUsed': 'ERS this lap', 'fuel.none': 'none',
    'lb.title': 'STANDINGS', 'lb.telTitle': 'YOUR CAR',
    'lb.pos': 'P', 'lb.name': 'DRIVER', 'lb.lap': 'LAP',
    'lb.time': 'TIME', 'lb.best': 'BEST', 'lb.gap': 'GAP',
    'lb.penalty': 'Penalty', 'lb.drs': 'DRS',
    'foot.src': 'AC memory, no SimHub',
    'status.live': 'LIVE', 'status.paused': 'PAUSED',
    'status.closed': 'GAME CLOSED', 'status.stale': 'last values',
    'sector': 'SECTOR', 'lapCount': 'LAP',
    'drs.off': 'OFF', 'drs.avail': 'READY', 'drs.open': 'OPEN',
    'opp.waiting': 'Waiting for opponent data.',
    'opp.how': 'The SimHub Python app writes the memory page with the cars. Check it is enabled in Content Manager (<b>Settings → Python Apps → SimHub</b>) and that AC is in a session with other cars.',
    'opp.none': 'No cars in the session.', 'lb.pit': 'PIT',
  },
};

let LANG = 'pt-PT';
function t(k) { return (I18N[LANG] && I18N[LANG][k]) || k; }

/* ------------------------------------------------------------ definicoes */
const DEF_KEY = 'acdef.v1';
const DEFAULTS = { mode: null, temp: 'C', speed: 'kmh', lang: 'pt-PT', map: 'on', fps: 60, mapFlipX: false, mapFlipZ: false, mapView: 'inteira' };
let DEF = Object.assign({}, DEFAULTS);

function loadDef() {
  try {
    const raw = localStorage.getItem(DEF_KEY);
    if (raw) DEF = Object.assign({}, DEFAULTS, JSON.parse(raw));
  } catch (e) { /* ignora */ }
}
function saveDef() {
  try { localStorage.setItem(DEF_KEY, JSON.stringify(DEF)); } catch (e) { /* ignora */ }
}

/* ------------------------------------------------------------ unidades */
const toSpeed = (kmh) => DEF.speed === 'mph' ? kmh / 1.609344 : kmh;
const toTemp = (c) => DEF.temp === 'F' ? c * 9 / 5 + 32 : c;
const spUnit = () => DEF.speed === 'mph' ? t('unit.mph') : t('unit.kmh');
const tUnit = () => DEF.temp === 'F' ? '°F' : '°C';

function fmtSpeed(kmh, dec) {
  const v = toSpeed(kmh);
  return DEF.speed === 'mph' ? v.toFixed(1) : v.toFixed(0);
}
function fmtTemp(c) {
  return Math.round(toTemp(c));
}

/* ------------------------------------------------------------ estado */
const S = {
  path: [],            // [x, y, drs, sector]
  minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9,
  lapPct: [], refLap: null, bestMs: null, lastLapPct: 0,
  lastSector: null, sectorTimes: [], bestSectorTimes: [],
  seenEver: false, trackName: '', lastSave: 0, lastTrackConfig: '',
  // velocidade amortecida, so' para o zoom da vista relativa. A
  // instantanea faz a imagem saltar a cada travagem e fica ilegivel.
  velSuave: 0,
  frames: 0, fpsAt: performance.now(), fps: 0,
  trace: { t: [], th: [], br: [], cl: [], hb: [] },
  lastSample: 0, traceHz: 0,
  wasLive: false,          // para detectar reinicio/pausa->corrida (novo troco no mapa)
  forceBreak: false,       // proximo ponto do mapa nao liga ao anterior
  marking: false,          // a marcar a zona de DRS a mao
  // Verificacao do drsAvailable como flag de zona. Fica a medir uma volta
  // antes de dizer que serve: um campo que esta ligado quase sempre nao
  // e' um campo de zona, e' decoracao.
  drsAuto: false,          // aceite como flag de zona
  drsVeredito: null,       // 'zona' | 'sempre ligado' | null (a medir)
  drsConta: 0,             // pontos contados na volta a medir
  drsAceso: 0,             // quantos estavam com drsAvailable a 1
  drsPctMin: 0.02,         // abaixo disto, a pista toda a verde e' uma zona
  drsPctMax: 0.60,         // acima disto, o campo esta sempre ligado

  // Mapa real (lido dos ficheiros do jogo em vez de tracado a conduzir)
  realMap: null,           // {img, width, height, scale, offsetX, offsetZ} quando pronto
  realMapTrack: null,      // 'pista||config' a que o realMap pertence, p/ nao pedir 2x
  realMapPending: null,    // 'pista||config' que esta a ser pedido ao servidor
  opponents: null,         // ultimo snapshot de /events/opponents (p/ desenhar no mapa)
};
const TRACE_N = 420;              // ~7 s a 60 Hz
const TRACE_MAXHZ = 60;

function setTxt(id, v) { const e = $(id); if (e && e.textContent !== v) e.textContent = v; }
function setHtml(id, v) { const e = $(id); if (e && e.innerHTML !== v) e.innerHTML = v; }

/* Um numero pode faltar no primeiro payload (antes de chegar dados). Sem
   este guarda, "undefined + 1" da NaN e aparece um "NaN" na faixa. */
function num(v, def) { return (typeof v === 'number' && isFinite(v)) ? v : (def || 0); }

/* "--:--.---" em Titillium Web Black desenha-se como um bloco pesado.
   Quando esta vazio, fica mais leve e apagado. */
function setTime(id, v) {
  const e = $(id);
  if (!e) return;
  const empty = !v || v.indexOf('--') === 0;
  const txt = v || '--:--.---';
  if (e.textContent !== txt) e.textContent = txt;
  e.classList.toggle('empty', empty);
}

/* ------------------------------------------------------------ tempos */
/* A matematica vive em tempos.js, sem estado e sem DOM, para poder ser
   testada sozinha (tests/test_tempos.html). Aqui so fica o estado. */

function computeDelta(pct, nowSec) {
  return deltaParaRef(S.refLap, pct, nowSec);
}

/* Escreve a delta e pinta-a. Perto de zero fica neutra: um "+0.000" a
   vermelho logo no inicio da volta era enganador, e o numero salta 60
   vezes por segundo, portanto uma zona morta evita tambem o cintilar. */
const DELTA_NEUTRA = 0.05;
function pintarDelta(el, dl) {
  if (!el) return;
  if (dl == null) {
    el.textContent = '+0.000';
    el.style.color = '';
    return;
  }
  el.textContent = (dl >= 0 ? '+' : '') + dl.toFixed(3);
  el.style.color = Math.abs(dl) < DELTA_NEUTRA ? ''
    : dl < 0 ? 'var(--green)' : 'var(--red)';
}

function onLapComplete(timeSec) {
  const melhor = melhorTempo(S.bestMs, timeSec);
  if (melhor != null) {
    S.bestMs = melhor;
    S.refLap = S.lapPct.slice();
  }
  S.lapPct = [];
  S.sectorTimes = [];
  fecharVoltaDrs();
}

/* ------------------------------------------------------------- veredito DRS
   Decide se o drsAvailable serve para pintar a zona, depois de uma volta
   inteira. Criterio: a percentagem do tracado com o campo ligado tem de
   ser uma minoria clara. Se for quase tudo, o campo esta sempre ligado e
   nao marca zona nenhuma - e pintar com ele e' pior do que nao pintar. */
function fecharVoltaDrs() {
  if (S.drsVeredito) return;            // ja decidido, nao se mexe
  if (S.drsConta < 400) return;         // volta ainda curta demais
  const frac = S.drsAceso / S.drsConta;
  S.drsFrac = frac;
  if (frac >= S.drsPctMax) {
    S.drsVeredito = 'sempre ligado';
    S.drsAuto = false;
  } else if (frac <= S.drsPctMin) {
    S.drsVeredito = 'nunca ligado';
    S.drsAuto = false;
  } else {
    S.drsVeredito = 'zona';
    S.drsAuto = true;
    // Repintar o que ja foi gravado, agora que se sabe que o campo serve.
    // Cada ponto guarda tambem o drsAvailable original (indice 4), para
    // isto ser possivel mais tarde sem voltar a conduzir.
    let n = 0;
    for (const p of S.path) {
      if (p[4] && !p[2]) { p[2] = 1; n++; }
    }
    S.drsRepintados = n;
  }
  S.drsConta = 0;
  S.drsAceso = 0;
  guardarVereditoDrs();
  syncDrsMarkUI();
}

/* ------------------------------------------------------------ mapa */
/* IMPORTANTE: no AC o eixo Y e' a ALTITUDE. O plano da pista e' X-Z.
   Medido em Spa com 19 adversarios: X 997 m, Y 88 m, Z 2012 m - e o
   desnivel de Spa e' de ~100 m, logo Y nao serve para desenhar a pista.
   Mapear X contra Y dava um rabisco achatado sem ser a pista. */
const MAP_KEY = 'acmap.v3';   // v3: um mapa por pista + cortes de teletransporte
const MAP_MAX_TRACKS = 15;   // quantas pistas ficam guardadas ao mesmo tempo

/* Cada ponto e' [x, z, pintado, sector, drsAvailableOriginal].
   O quinto elemento e' o drsAvailable tal como veio do jogo, guardado para
   poder pintar a zona mais tarde, quando uma volta inteira disser que o
   campo serve. Mapas gravados antes disso tem so quatro: e' aceite, mas
   esses pontos nao podem ser repintados. */
// Acima disto (em metros) o ponto novo NAO liga ao anterior: e' um
// teletransporte (reinicio de sessao, carro posto de novo na grelha,
// voltar aos boxes pelo menu) e nao uma curva apertada a serio. Sem
// isto, o mapa ficava com uma reta a atravessar a pista toda sempre
// que se reiniciava a corrida - o "bug" da imagem partida.
const MAP_JUMP_M = 40;

function pushMapPoint(x, y, drs, sector, drsOriginal) {
  if (!isFinite(x) || !isFinite(y)) return;
  if (x === 0 && y === 0) return;
  const p = S.path[S.path.length - 1];
  let brk = 0;
  if (p) {
    const dist = Math.abs(p[0] - x) + Math.abs(p[1] - y);
    if (dist < 0.3) return;                 // parado: nao vale a pena novo ponto
    if (dist > MAP_JUMP_M) brk = 1;         // salto grande -> novo troco
  } else {
    brk = 1;
  }
  if (S.forceBreak) { brk = 1; S.forceBreak = false; }
  S.path.push([x, y, drs ? 1 : 0, sector | 0, drsOriginal ? 1 : 0, brk]);
  if (S.path.length > 24000) S.path.splice(0, 6000);
  if (x < S.minX) S.minX = x; if (x > S.maxX) S.maxX = x;
  if (y < S.minY) S.minY = y; if (y > S.maxY) S.maxY = y;
  if (!S.drsVeredito) { S.drsConta++; if (drsOriginal) S.drsAceso++; }
  saveMap();
}

// Guarda-se um mapa POR PISTA (nao um unico global): trocar de pista e
// voltar a ela nao obriga a redesenhar tudo outra vez.
function loadAllMaps() {
  try {
    const raw = localStorage.getItem(MAP_KEY);
    return raw ? (JSON.parse(raw) || {}) : {};
  } catch (e) { return {}; }
}
function saveMap(force) {
  if (!force && Date.now() - S.lastSave < 5000) return;
  S.lastSave = Date.now();
  if (!S.trackName) return;
  try {
    const all = loadAllMaps();
    const pts = S.path.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10, p[2], p[3], p[4] || 0, p[5] || 0]);
    all[S.trackName] = { p: pts, d: S.drsVeredito, da: S.drsAuto ? 1 : 0, ts: Date.now() };
    // nao deixar crescer para sempre: guarda so as ultimas MAP_MAX_TRACKS pistas
    const keys = Object.keys(all);
    if (keys.length > MAP_MAX_TRACKS) {
      keys.sort((a, b) => (all[a].ts || 0) - (all[b].ts || 0));
      delete all[keys[0]];
    }
    localStorage.setItem(MAP_KEY, JSON.stringify(all));
  } catch (e) { /* quota */ }
}
// Carrega o mapa desta pista, se ja tiver sido percorrida antes: aparece
// completo de imediato, em vez de ter de se descobrir outra vez a andar.
function loadMapFor(trackName) {
  if (!trackName) return false;
  const o = loadAllMaps()[trackName];
  if (!o || !Array.isArray(o.p) || o.p.length < 2) return false;
  S.path = o.p;
  S.drsVeredito = o.d || null;
  S.drsAuto = !!o.da;
  S.minX = 1e9; S.maxX = -1e9; S.minY = 1e9; S.maxY = -1e9;
  for (const p of S.path) {
    if (p[0] < S.minX) S.minX = p[0]; if (p[0] > S.maxX) S.maxX = p[0];
    if (p[1] < S.minY) S.minY = p[1]; if (p[1] > S.maxY) S.maxY = p[1];
  }
  return true;
}
function guardarVereditoDrs() { saveMap(true); }

/* ------------------------------------------------------- mapa real (ficheiros do jogo) */
/* Em vez de descobrir a pista a conduzir, tenta buscar o map.png + a
   escala (map.ini) diretamente da instalacao do Assetto Corsa (o server
   e' que sabe onde isso esta, ver /api/settings). Se nao houver caminho
   configurado, ou a pista nao for encontrada, fica-se com o tracado
   feito a conduzir (comportamento antigo) sem qualquer erro visivel. */
function fetchRealMap(track, trackConfig) {
  const key = track + '||' + (trackConfig || '');
  if (S.realMapTrack === key || S.realMapPending === key) return;
  S.realMapPending = key;
  const url = '/api/track-map?track=' + encodeURIComponent(track)
    + '&config=' + encodeURIComponent(trackConfig || '');
  fetch(url).then((r) => r.json()).then((cfg) => {
    if (S.realMapPending !== key) return; // trocou de pista entretanto
    S.realMapPending = null;
    if (!cfg || !cfg.available || cfg.trusted === false) {
      S.realMap = null; S.realMapTrack = key; return;
    }
    const img = new Image();
    img.onload = () => {
      S.realMap = {
        img, width: cfg.width, height: cfg.height,
        // pixels por METRO, que e' 1 / SCALE_FACTOR do map.ini. Medido com
        // um trajecto real de Monza: com 1/1,4 a distancia mediana a linha
        // da pista e' 0 px; sem dividir, e' 132 m -- o carro aparece fora da
        // pista. Ver Regra nº 17, e o engano do WIDTH/HEIGHT estar em
        // pixEIS da imagem e nao em metros.
        pxPerMetre: cfg.pxPerMetre || 1,
        imageWidth: cfg.imageWidth || img.naturalWidth,
        imageHeight: cfg.imageHeight || img.naturalHeight,
        offsetX: cfg.offsetX || 0, offsetZ: cfg.offsetZ || 0,
      };
      S.realMapTrack = key;
    };
    img.onerror = () => { S.realMap = null; S.realMapTrack = key; };
    img.src = cfg.imageUrl;
  }).catch(() => { S.realMapPending = null; S.realMap = null; S.realMapTrack = key; });
}

/* Mundo (x, z) -> pixel da imagem map.png, com as inversoes das definicoes. */
function worldToMapImg(rm, x, z) {
  const k = rm.pxPerMetre || 1;
  let ix = (x + rm.offsetX) * k;
  let iy = (z + rm.offsetZ) * k;
  if (DEF.mapFlipX) ix = rm.imageWidth - ix;
  if (DEF.mapFlipZ) iy = rm.imageHeight - iy;
  return [ix, iy];
}

function resetMap(clearStorage) {
  S.path = []; S.minX = 1e9; S.maxX = -1e9; S.minY = 1e9; S.maxY = -1e9;
  S.lapPct = []; S.refLap = null; S.bestMs = null; S.sectorTimes = [];
  S.drsVeredito = null; S.drsAuto = false; S.drsConta = 0; S.drsAceso = 0;
  S.forceBreak = true;
  // "clearStorage" apaga so o guardado DESTA pista, nunca das outras
  if (clearStorage && S.trackName) {
    try {
      const all = loadAllMaps();
      delete all[S.trackName];
      localStorage.setItem(MAP_KEY, JSON.stringify(all));
    } catch (e) { /* ignora */ }
  }
}

/* Enquadramento do mapa, partilhado pelas DUAS vistas.
 *
 * Regra nº 16: quando há mais do que uma vista para o mesmo plano do
 * mundo, a convenção de eixos e o enquadramento são um só, escritos num
 * sítio só. As duas vistas divergiram uma vez (o traçado invertia o Z e a
 * imagem não) e o resultado foi um mapa espelhado que ninguém notou.
 *
 * O 'espaço' é a mesma unidade nas duas vistas — píxeis da imagem no mapa
 * real, metros no traçado — e quem chama é que decide. Aqui só se decide
 * o enquadramento: a pista toda dentro da caixa, ou centrado no carro com
 * zoom.
 */
function mapaEnquadramento(w, h, espW, espH, carroX, carroZ) {
  const pad = 14;
  const inteira = Math.min((w - pad * 2) / espW, (h - pad * 2) / espH);

  if (DEF.mapView !== 'relativa' || carroX == null) {
    const ox = (w - espW * inteira) / 2, oy = (h - espH * inteira) / 2;
    return { sc: inteira, px: (x) => ox + x * inteira, py: (y) => oy + y * inteira, relativa: false };
  }

  // Vista relativa: quão longe se ve, em metros, consoante a velocidade.
  // Lento => perto (ampliado), rápido => longe (fechado). A velocidade é
  // amortecida (S.velSuave) porque a instantânea faz a imagem saltar a
  // cada travagem e fica ilegível.
  const v = clamp(S.velSuave || 0, 0, 320);
  const t = v / 320;                       // 0 parado .. 1 no limite
  const perto = Math.max(inteira, Math.min((w - pad * 2) / 70, (h - pad * 2) / 70));
  const longe = inteira;
  const sc = perto + (longe - perto) * t;
  return {
    sc,
    px: (x) => w / 2 + (x - carroX) * sc,
    py: (y) => h / 2 + (y - carroZ) * sc,
    relativa: true,
  };
}

function drawMap(canvasId) {
  const cv = $(canvasId);
  if (!cv || DEF.map === 'off') { if (cv) cv.style.visibility = 'hidden'; return; }
  cv.style.visibility = 'visible';
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  }
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);

  const rm = S.realMap;
  if (rm && rm.img && rm.img.complete && rm.width > 0 && rm.height > 0) {
    drawMapReal(c, w, h, rm);
  } else {
    drawMapTraced(c, w, h);
  }
}

/* Mapa lido dos ficheiros do jogo: a imagem e' a propria pista, so' e'
   preciso encaixa-la no canvas e converter (x,z) do carro/adversarios
   para pixels da imagem. Nao ha "descoberta": aparece completa logo
   na primeira vez que se entra na pista. */
function drawMapReal(c, w, h, rm) {
  const iw = rm.imageWidth || rm.width, ih = rm.imageHeight || rm.height;
  // a posicao do carro, para a vista relativa poder centrar-se nela
  const ult = S.path.length ? S.path[S.path.length - 1] : null;
  const [carX, carZ] = ult ? worldToMapImg(rm, ult[0], ult[1]) : [null, null];
  const q = mapaEnquadramento(w, h, iw, ih, carX, carZ);
  const sc = q.sc, px = q.px, py = q.py;

  c.save();
  // na vista relativa a imagem e' muito maior do que a caixa: sem isto
  // o drawImage pintava a imagem toda, nao o que esta dentro da vista
  if (q.relativa) {
    c.beginPath(); c.rect(0, 0, w, h); c.clip();
  }
  c.globalAlpha = 0.92;
  c.drawImage(rm.img, px(0), py(0), iw * sc, ih * sc);
  c.globalAlpha = 1;

  // zona de DRS marcada a mao, sobre a imagem real (mesmos pontos que o
  // tracado manual usa, so' que projectados na imagem em vez do canvas)
  if (S.path.length > 1) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = '#23CF16'; c.lineWidth = 6;
    c.beginPath();
    let drawing = false, hasZone = false;
    for (let i = 0; i < S.path.length; i++) {
      const pt = S.path[i];
      const [ix, iy] = worldToMapImg(rm, pt[0], pt[1]);
      if (pt[2]) {
        hasZone = true;
        if (!drawing || pt[5]) c.moveTo(px(ix), py(iy));
        else c.lineTo(px(ix), py(iy));
        drawing = true;
      } else { drawing = false; }
    }
    c.stroke();
    if (S.marking) {
      c.save();
      c.globalAlpha = 0.35 + 0.35 * Math.abs(Math.sin(performance.now() / 260));
      c.strokeStyle = '#23CF16'; c.lineWidth = 12;
      c.stroke();
      c.restore();
    }
    const key = $('map-drs-key'); if (key) key.classList.toggle('hidden', !hasZone);
    const key2 = $('map-drs-key2'); if (key2) key2.classList.toggle('hidden', !hasZone);
  }

  // adversarios: pontos cinzentos com o numero de posicao
  const opp = S.opponents;
  if (opp && opp.available && Array.isArray(opp.cars)) {
    // as bolas crescem com o zoom: na vista relativa ha' 6x mais pixeis por
    // metro, e um circulo de 5 px ficava do tamanho de uma casa
    const rOpp = q.relativa ? 9 : 5;
    for (const car of opp.cars) {
      if (car.id === myCarId) continue;
      if (typeof car.x !== 'number' || typeof car.z !== 'number') continue;
      const [ix, iy] = worldToMapImg(rm, car.x, car.z);
      const x = px(ix), y = py(iy);
      c.beginPath(); c.arc(x, y, rOpp, 0, Math.PI * 2);
      c.fillStyle = car.inPit ? 'rgba(255,255,255,.35)' : '#8C9394';
      c.fill();
      if (car.pos) {
        c.fillStyle = '#0A0E0E';
        c.font = '700 ' + (q.relativa ? 12 : 8) + 'px Titillium, sans-serif';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(String(car.pos), x, y + 0.5);
      }
    }
  }

  // o proprio carro, por cima de tudo
  if (ult) {
    const x = px(carX), y = py(carZ);
    const rMeu = q.relativa ? 11 : 6;
    c.beginPath(); c.arc(x, y, rMeu, 0, Math.PI * 2);
    c.fillStyle = '#FFD700'; c.fill();
    c.lineWidth = q.relativa ? 2.4 : 1.6; c.strokeStyle = '#fff'; c.stroke();
  }

  c.restore();
}

/* Mapa tracado a conduzir: usado enquanto nao ha mapa real (pista nao
   encontrada nos ficheiros do jogo, ou pasta do AC nao configurada). */
function drawMapTraced(c, w, h) {
  if (S.path.length < 2) {
    c.fillStyle = '#555C5D'; c.font = '600 12px Titillium, sans-serif';
    c.textAlign = 'center';
    c.fillText(t('map.title'), w / 2, h / 2);
    return;
  }

  const spanX = Math.max(S.maxX - S.minX, 1), spanZ = Math.max(S.maxY - S.minY, 1);
  // O Y do canvas CRESCE com o Z. Nao se inverte.
  //
  // Invertia-se, e o mapa saia espelhado: o loop grande de Baku ficava em
  // cima-esquerca em vez de baixo-esquerca, e o piloto notava-o a conduzir
  // ("virei a direita e o mapa virou a esquerda"). Confirmado de tres
  // maneiras: a forma desenhada foi comparada com o mapa oficial da
  // pista, com a imagem real do jogo, e com o relato de quem conduz.
  // As tres dizem o mesmo.
  // Ver Regra nº 16 (as duas vistas tem de usar a mesma convencao) e a
  // imagem em tests/forma_Z_normal.png.
  //
  // O enquadramento vem de mapaEnquadramento, o mesmo que o mapa real usa:
  // as duas vistas nao podem divergir outra vez.
  const ult = S.path[S.path.length - 1];
  const q = mapaEnquadramento(w, h, spanX, spanZ, ult ? ult[0] : null, ult ? ult[1] : null);
  const sc = q.sc;
  const px = (p) => q.px(p[0] - S.minX);
  const py = (p) => q.py(p[1] - S.minY);

  c.save();
  if (q.relativa) { c.beginPath(); c.rect(0, 0, w, h); c.clip(); }

  // pista, em duas passagens: contorno claro por baixo, cor por cima.
  // Desenhada em TROÇOS: sempre que um ponto vem marcado como corte
  // (path[i][5], ver pushMapPoint), comeca-se um troco novo em vez de
  // ligar ao ponto anterior. E' isto que evita a reta a atravessar a
  // pista quando a corrida reinicia ou o carro e' teletransportado.
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath();
  for (let i = 0; i < S.path.length; i++) {
    const pt = S.path[i];
    if (i === 0 || pt[5]) c.moveTo(px(pt), py(pt));
    else c.lineTo(px(pt), py(pt));
  }
  c.strokeStyle = 'rgba(85,92,93,.85)'; c.lineWidth = 5.5; c.stroke();
  c.strokeStyle = '#151C1D'; c.lineWidth = 3.5; c.stroke();

  // zona de DRS: os trocos que o utilizador marcou a mao
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = '#23CF16'; c.lineWidth = 7;
  c.beginPath();
  let drawing = false, hasZone = false;
  for (let i = 0; i < S.path.length; i++) {
    const pt = S.path[i];
    if (pt[2]) {
      hasZone = true;
      if (!drawing || pt[5]) c.moveTo(px(pt), py(pt));
      else c.lineTo(px(pt), py(pt));
      drawing = true;
    } else { drawing = false; }
  }
  c.stroke();
  if (S.marking) {
    // a marcar: um halo a pulsing para se ver onde se esta a pintar
    c.save();
    c.globalAlpha = 0.35 + 0.35 * Math.abs(Math.sin(performance.now() / 260));
    c.strokeStyle = '#23CF16'; c.lineWidth = 13;
    c.stroke();
    c.restore();
  }

  // fronteiras de sector (nunca num corte: um teletransporte muda de
  // sector sem ser uma fronteira a serio)
  c.strokeStyle = '#FFD700'; c.lineWidth = 2;
  for (let i = 1; i < S.path.length; i++) {
    if (S.path[i][3] !== S.path[i - 1][3] && !S.path[i][5]) {
      c.beginPath();
      c.arc(px(S.path[i]), py(S.path[i]), 3.5, 0, Math.PI * 2);
      c.stroke();
    }
  }

  // carro
  const p = S.path[S.path.length - 1];
  c.beginPath(); c.arc(px(p), py(p), q.relativa ? 10 : 6, 0, Math.PI * 2);
  c.fillStyle = '#FFD700'; c.fill();
  c.lineWidth = q.relativa ? 2.4 : 1.6; c.strokeStyle = '#fff'; c.stroke();

  // a legenda só aparece quando há zona marcada
  const key = $('map-drs-key');
  if (key) key.classList.toggle('hidden', !hasZone);
  const key2 = $('map-drs-key2');
  if (key2) key2.classList.toggle('hidden', !hasZone);

  c.restore();
}

/* ------------------------------------------------- grafico dos pedais */
function pushTrace(d) {
  const now = performance.now();
  if (now - S.lastSample < 1000 / TRACE_MAXHZ) return;
  S.lastSample = now;
  const tr = S.trace;
  tr.t.push(now);
  tr.th.push(clamp(d.throttle || 0, 0, 100));
  tr.br.push(clamp(d.brake || 0, 0, 100));
  // O AC reporta clutch com 1.0 = totalmente encaixada (conducao normal)
  // e a descer quando se solta. A documentacao diz "1 = totalmente
  // premida", o que e' enganador. Mostra-se o inverso: quanto esta
  // solta, que e' o que interessa - pontas de embraiagem e kicking.
  tr.cl.push(clamp(100 - (d.clutchRaw != null ? d.clutchRaw : 1) * 100, 0, 100));
  tr.hb.push(d.handbrake != null ? d.handbrake : null);
  while (tr.t.length > TRACE_N) { tr.t.shift(); tr.th.shift(); tr.br.shift(); tr.cl.shift(); tr.hb.shift(); }
}

/* ------------------------------------------------------------ pedais
 *
 * Cada sinal tem a SUA faixa. Antes os quatro sinais eram desenhados
 * uns por cima dos outros no mesmo rectangulo, e o resultado era um
 * lenco de linhas que nao se percebia.
 *
 * E o bug mais serio: 0% e 100% eram desenhados exactamente na borda do
 * canvas (y = h e y = 0), pelo que metade da linha ficava cortada
 * fora. Ou seja, os valores extremes - acelerador a fundo, travagem a
 * fundo, embraiagem solta - que sao os que mais importam a conduzir,
 * eram os que se viam menos. Medido antes da correccao: 320 colunas de
 * 1 px de altura, e o vermelho e o azul a desenharem zero colunas,
 * porque estavam fora do recorte.
 *
 * Agora cada faixa tem a zona de 0% a 100% dentro do canvas, com
 * moldura, area preenchida por baixo da curva e o valor actual escrito.
 */

const JANELA_SEG = 6;          // quantos segundos se veem
const FAIXA_TOPO = 13;        // altura da tira do nome e do valor
const EIXO_ALTURA_MAX = 15;   // altura da regua do tempo, quando ha espaco
const PEDIDO_MINIMO = 1.6;    // largura minima da linha
// Tempo sem amostra nenhuma a partir do qual se admite que o sinal
// acabou. 150 ms e' folgado para o jitter do SSE (que vai ate ~66 ms
// medidos) e muito mais curto do que uma pausa do jogo, que sao
// segundos. Serve para o traço nao inventar uma linha recta atravessada
// no ecra quando o jogo esta parado.
const FALTA_REAL = 150;

const FAIXAS = [
  { key: 'th', color: '#23CF16', fill: 'rgba(35,207,22,0.16)', rot: 'pedals.throttle' },
  { key: 'br', color: '#FF0000', fill: 'rgba(255,0,0,0.14)', rot: 'pedals.brake' },
  { key: 'cl', color: '#2B6CFF', fill: 'rgba(43,108,255,0.14)', rot: 'pedals.clutch' },
  { key: 'hb', color: '#FFD700', fill: 'rgba(255,215,0,0.14)', rot: 'pedals.handbrake' },
];

function preparandoCanvas(id) {
  const cv = $(id);
  if (!cv) return null;
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return null;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  }
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  return { cv: cv, c: c, w: w, h: h };
}

function drawPedals(canvasId) {
  const g = preparandoCanvas(canvasId);
  if (!g) return;
  const c = g.c, w = g.w, h = g.h;
  const areaHReal = h;

  const tr = S.trace;
  const n = tr.t.length;

  // O travão de mão só ganha faixa se alguma vez tiver havido dado.
  // Senão fica uma faixa sempre vazia, que parece um erro.
  let comDados = false;
  for (const a of [tr.hb]) {
    for (let i = 0; i < a.length; i++) if (a[i] != null) { comDados = true; break; }
    if (comDados) break;
  }
  const faixas = comDados ? FAIXAS : FAIXAS.slice(0, 3);

  // A regua do tempo e' a primeira coisa a sair quando o rectangulo
  // fica baixo: e' a menos indispensavel das tres. Cada faixa precisa
  // de ~34 px para a curva e o nome caberem; abaixo disso nao ha grafico
  // que preste e e' melhor dizer isso.
  const EIXO_ALTURA = areaHReal >= 170 ? EIXO_ALTURA_MAX : 0;
  const areaH = h - EIXO_ALTURA;
  const faixaH = areaH / faixas.length;
  if (faixaH < 30) {
    c.fillStyle = '#3c4344';
    c.font = '700 10px Titillium, sans-serif';
    c.textAlign = 'center';
    c.fillText(t('pedals.pequeno'), w / 2, h / 2);
    return;
  }

  if (n < 2) {
    c.fillStyle = '#3c4344';
    c.font = '700 11px Titillium, sans-serif';
    c.textAlign = 'center';
    c.fillText('—', w / 2, areaH / 2);
    return;
  }

  const agora = tr.t[n - 1];
  const inicio = agora - JANELA_SEG * 1000;
  const colOf = (i) => Math.floor(((tr.t[i] - inicio) / (JANELA_SEG * 1000)) * w);
  const y = (faixaY, v) => faixaY + FAIXA_TOPO + (1 - clamp(v, 0, 100) / 100) * (faixaH - FAIXA_TOPO - 3);
  const baseY = (faixaY) => faixaY + FAIXA_TOPO + (faixaH - FAIXA_TOPO - 3);

  // ---- regua do tempo, em baixo -------------------------------------
  if (EIXO_ALTURA > 0) {
  c.strokeStyle = '#1e2526';
  c.lineWidth = 1;
  c.fillStyle = '#4a5152';
  c.font = '700 8px Titillium, sans-serif';
  c.textAlign = 'center';
  for (let s = 0; s <= JANELA_SEG; s++) {
    const x = Math.round((s / JANELA_SEG) * w) + 0.5;
    c.beginPath(); c.moveTo(x, areaH); c.lineTo(x, areaH + 3); c.stroke();
    if (s % 2 === 0) {
      const txt = s === 0 ? t('pedals.agora') : '-' + s + 's';
      c.fillText(txt, s === 0 ? w - 12 : Math.min(x + 10, w - 12), areaH + 11);
    }
  }
  }

  // Um for, e nao um forEach: o "continue" nao e' legal dentro de um
  // callback, e a leitura fica mais natural assim.
  for (let fi = 0; fi < faixas.length; fi++) {
    const F = faixas[fi];
    const fy = fi * faixaH;
    const arr = tr[F.key];

    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.fillRect(0, fy + 1, w, faixaH - 3);
    c.strokeStyle = '#1a2021';
    c.lineWidth = 1;
    c.strokeRect(0.5, fy + 1.5, w - 1, faixaH - 4);

    // nome a esquerda, valor actual a direita
    c.textAlign = 'left';
    c.fillStyle = '#5b6364';
    c.font = '700 8px Titillium, sans-serif';
    c.fillText(t(F.rot), 5, fy + 10);
    let ultimo = null;
    for (let k = n - 1; k >= 0; k--) if (arr[k] != null) { ultimo = arr[k]; break; }
    c.textAlign = 'right';
    c.fillStyle = ultimo == null ? '#3c4344' : F.color;
    c.font = '900 10px Titillium, sans-serif';
    c.fillText(ultimo == null ? '—' : Math.round(ultimo) + '%', w - 5, fy + 10);

    // marcas de 0, 50 e 100%
    c.strokeStyle = '#1e2526';
    c.lineWidth = 1;
    const meio = [0, 0.5, 1];
    for (let m = 0; m < meio.length; m++) {
      const yy = Math.round(y(fy, meio[m] * 100)) + 0.5;
      c.beginPath(); c.moveTo(0, yy); c.lineTo(w, yy); c.stroke();
    }

    // ---- a curva --------------------------------------------------
    // Uma passagem, com um cursor que so avanca. Para cada pixel fica o
    // VALOR REAL mais recente nessa coluna - nunca uma media, que
    // mostraria valores que nunca aconteceram.
    //
    // Uma coluna sem amostra NAO e' uma falha: a janela de 6 s num
    // rectangulo de ~330 px vale 18 ms por pixel, e o canal SSE entrega
    // a 30-50 Hz, ou seja 20 a 33 ms por amostra. Metade das colunas
    // fica entao sem amostra, e partir a linha ai dava uma linha
    // partida a cada dois pixels - que foi o que se via. Faltar amostra
    // nao e' faltar dado: o valor continua a ser o ultimo conhecido, e
    // e' esse que se desenha.
    //
    // A linha so parte quando passa mesmo tempo sem amostra nenhuma,
    // que e' o jogo em pausa. Antes disso, nao.
    const pontos = [];
    let i = 0, pendente = null, ultimoT = -1e9;
    for (let x = 0; x < w; x++) {
      const tCol = inicio + (x / w) * JANELA_SEG * 1000;
      while (i < n && colOf(i) <= x) {
        if (arr[i] != null) { pendente = arr[i]; ultimoT = tr.t[i]; }
        i++;
      }
      if (pendente == null) continue;             // nada a desenhar ainda
      if (tCol - ultimoT > FALTA_REAL) { pendente = null; continue; }  // falha a serio
      pontos.push(x, y(fy, pendente));
    }
    if (pontos.length < 4) continue;

    // area preenchida por baixo, um troco de cada vez
    const base = baseY(fy);
    let a = 0;
    while (a + 3 < pontos.length) {
      let b = a;
      while (b + 3 < pontos.length && pontos[b + 2] === pontos[b] + 1) b += 2;
      c.beginPath();
      c.moveTo(pontos[a], base);
      for (let k = a; k <= b; k += 2) c.lineTo(pontos[k], pontos[k + 1]);
      c.lineTo(pontos[b], base);
      c.closePath();
      c.fillStyle = F.fill;
      c.fill();
      a = b + 2;
    }

    // a linha, partida nos mesmos sitios
    c.beginPath();
    let anterior = null;
    for (let k = 0; k + 1 < pontos.length; k += 2) {
      if (anterior === null || pontos[k] !== anterior + 1) c.moveTo(pontos[k], pontos[k + 1]);
      else c.lineTo(pontos[k], pontos[k + 1]);
      anterior = pontos[k];
    }
    c.strokeStyle = F.color;
    c.lineWidth = PEDIDO_MINIMO;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.stroke();
  }
}

/* ------------------------------------------------------------ volante
 * O campo e' o 'steerAngle' da pagina de fisica. O ALCANCE nao esta
 * confirmado: o jogo esta fechado e o valor esta congelado a 0, e nao
 * se pode assumir que vaia de -1 a 1 (pode ser em radianos). Por isso o
 * factor esta numa constante isolada e o desenho satura - se um dia
 * rodar sempre ao batente, e' esta constante que esta errada, e
 * mede-se o alcance real a conduzir.
 *
 * Para medir: correr tests\capturar.py e ver o min e o max de 'steer'.
 */
const STEER_REF = 1.0;          // NAO CONFIRMADO - ver nota
const STEER_GIRO = Math.PI * 1.5;   // 1.5 radianos de volta, para leitura rápida

function drawVolante(canvasId, steer) {
  const g = preparandoCanvas(canvasId);
  if (!g) return;
  const c = g.c, w = g.w, h = g.h;

  const cx = w / 2, cy = h / 2;
  const R = Math.min(w, h) / 2 - 2;
  if (R < 10) return;

  const v = clamp(num(steer) / STEER_REF, -1, 1);
  const ang = v * STEER_GIRO;

  c.save();
  c.translate(cx, cy);
  c.rotate(ang);

  // ---- o aro: um circulo com o fundo a direito ------------------------
  // Num volante de F1 o fundo e' plano, para se apoiarem as maos.
  //
  // ATENCAO aos angulos do canvas: o angulo 0 e' a DIREITA e os angulos
  // correm para BAIXO (o eixo do Y aponta para baixo), portanto o topo
  // e' 3pi/2, nao -pi/2. A primeira versao desenhava o arco de aFundo a
  // pi-aFundo, que em canvas e' a parte de BAIXO: o aro saia em cima de
  // uma linha recta e nao se lia como um volante. Foi medido - faltava
  // aro do lado esquerdo e sobrava em baixo.
  const CHAO = 0.70;                 // fracao do raio onde o fundo fica
  const aFundo = Math.asin(CHAO);   // onde o circulo encontra a linha de baixo
  const largura = Math.max(3, R * 0.26);

  // o arco, de um lado ao outro por cima (passa por 3pi/2, que e' o topo)
  c.strokeStyle = '#232a2b';
  c.lineWidth = largura;
  c.lineCap = 'butt';
  c.beginPath();
  c.arc(0, 0, R, Math.PI - aFundo, Math.PI * 2 + aFundo, false);
  c.stroke();

  // linha de baixo, a fechar a figura
  c.beginPath();
  c.moveTo(Math.cos(aFundo) * R, R * CHAO);
  c.lineTo(-Math.cos(aFundo) * R, R * CHAO);
  c.stroke();

  // brilho no aro, para dar volume
  c.strokeStyle = '#3c4445';
  c.lineWidth = Math.max(1, R * 0.07);
  c.beginPath();
  c.arc(0, 0, R - largura * 0.18, Math.PI - aFundo + 0.5, Math.PI * 2 + aFundo - 0.5, false);
  c.stroke();

  // ---- punhos, a esquerda e a direita ---------------------------------
  // Sao as zonas mais largas. Sem isto o desenho le-se como um anel.
  // O centro do punho e' 0 (direita) ou pi (esquerda). Com o sinal
  // invertido, o arco esquerdo saia com inicio maior que o fim e nao
  // desenhava nada - o volante ficava sem um dos punhos.
  for (const centro of [0, Math.PI]) {
    c.strokeStyle = '#1a2021';
    c.lineWidth = largura * 1.06;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(0, 0, R, centro - 0.42, centro + 0.42, false);
    c.stroke();
  }

  // ---- dois raios, de baixo para o cubo ------------------------------
  c.strokeStyle = '#2b3233';
  c.lineWidth = Math.max(2, R * 0.15);
  c.lineCap = 'round';
  for (const sinal of [-1, 1]) {
    c.beginPath();
    c.moveTo(sinal * Math.cos(aFundo) * R * 0.94, R * CHAO * 0.94);
    c.lineTo(sinal * R * 0.26, R * 0.16);
    c.stroke();
  }

  // ---- marca do topo: e' ela que diz para que lado rodou --------------
  const corMarca = v < -0.02 ? '#23CF16' : v > 0.02 ? '#F58020' : '#FFD700';
  c.fillStyle = corMarca;
  c.fillRect(-largura * 0.55, -R + largura * 0.12, largura * 1.1, largura * 0.8);
  // um traço fino a prolongar a marca para o centro
  c.fillRect(-largura * 0.12, -R + largura * 0.9, largura * 0.24, R * 0.34);

  // ---- cubo com ecra --------------------------------------------------
  c.fillStyle = '#14191a';
  c.strokeStyle = '#3c4445';
  c.lineWidth = 1.4;
  c.beginPath();
  if (c.roundRect) c.roundRect(-R * 0.34, -R * 0.20, R * 0.68, R * 0.40, 4);
  else c.rect(-R * 0.34, -R * 0.20, R * 0.68, R * 0.40);
  c.fill();
  c.stroke();

  // ecra aceso, com o valor
  c.fillStyle = '#0a2b1a';
  c.fillRect(-R * 0.28, -R * 0.15, R * 0.56, R * 0.22);
  c.fillStyle = corMarca;
  c.font = '900 ' + Math.max(7, Math.round(R * 0.20)) + 'px Titillium, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText((v >= 0 ? '+' : '-') + Math.abs(v * 100).toFixed(0), 0, -R * 0.04);

  c.restore();

  // eixo vertical, para se ver o desvio face ao volante
  c.strokeStyle = 'rgba(255,215,0,0.18)';
  c.lineWidth = 1;
  c.setLineDash([2, 3]);
  c.beginPath();
  c.moveTo(cx + 0.5, cy - R);
  c.lineTo(cx + 0.5, cy + R);
  c.stroke();
  c.setLineDash([]);
}

/* ------------------------------------------------------ barra dos pneus */
function drawTyreBar(id, mid) {
  const cv = $(id);
  if (!cv) return;
  const w = cv.width, h = cv.height;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, w, h);
  const lo = 40, hi = 130;
  const f = clamp((mid - lo) / (hi - lo), 0, 1);
  const g = c.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#23CF16'); g.addColorStop(.55, '#23CF16');
  g.addColorStop(.78, '#F58020'); g.addColorStop(1, '#FF0000');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = '#fff';
  c.fillRect(clamp(f * w - 1.5, 0, w - 3), 0, 3, h);
}
function tempColor(v, unit) {
  // os limites sao em Celsius, seja qual for a unidade mostrada
  const c = DEF.temp === 'F' ? (v - 32) * 5 / 9 : v;
  if (c >= 105) return '#FF0000';
  if (c >= 95) return '#F58020';
  return '#FFFFFF';
}

/* ------------------------------------------------------------ construir pneus */
const TYRE_TAGS = ['FL', 'FR', 'RL', 'RR'];
function buildTyres(hostId) {
  const host = $(hostId);
  if (!host || host.childElementCount === 4) return;
  host.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const d = document.createElement('div');
    d.className = 'tyre';
    d.innerHTML =
      '<span class="tyre-name">' + TYRE_TAGS[i] + '</span>' +
      '<span class="tyre-mid">' +
      '<b class="tyre-temp" id="' + hostId + '-t' + i + '">--</b>' +
      '<span class="tyre-worn" id="' + hostId + '-w' + i + '">--</span></span>' +
      '<span class="tyre-bar-wrap">' +
      '<canvas class="tyre-bar" id="' + hostId + '-b' + i + '" width="120" height="7"></canvas>' +
      '<span class="tyre-press" id="' + hostId + '-p' + i + '">--</span>' +
      '</span>';
    host.appendChild(d);
  }
}
function renderTyres(hostId, d) {
  for (let i = 0; i < 4; i++) {
    const mid = (d.tyreTempM && d.tyreTempM[i]) || 0;
    setTxt(hostId + '-t' + i, mid ? fmtTemp(mid) : '--');
    const te = $(hostId + '-t' + i);
    if (te) te.style.color = tempColor(mid);
    const worn = (d.tyreWearUsed && d.tyreWearUsed[i] != null) ? d.tyreWearUsed[i] : null;
    setTxt(hostId + '-w' + i, worn == null ? '--' : worn.toFixed(1) + '%');
    const we = $(hostId + '-w' + i);
    if (we) we.className = 'tyre-worn' + (worn != null && worn >= 30 ? ' bad' : worn != null && worn >= 15 ? ' warn' : '');
    drawTyreBar(hostId + '-b' + i, mid);
    const pr = (d.tyrePressure && d.tyrePressure[i] != null) ? d.tyrePressure[i].toFixed(1) : '--';
    // psi, e nao kPa. Medido num F1: 28.7 a 32.3. Se fossem kPa seriam
    // 0.29 a 0.32 bar, menos que a pressao atmosferica (1 atm = 101.3
    // kPa) - impossivel. Como psi da 1.98 a 2.23 bar, que e' o que um
    // F1 usa. A unidade nao vem escrita em lado nenhum, por isso fica aqui
    // escrito para nao se perder.
    setTxt(hostId + '-p' + i, pr === '--' ? pr : pr + ' psi');
  }
}

/* ------------------------------------------------------ travões por canto */
function renderBrakes(hostId, d) {
  const host = $(hostId);
  if (!host) return;
  if (host.childElementCount !== 4) {
    host.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const b = document.createElement('b');
      b.id = hostId + '-' + i;
      b.textContent = '--';
      host.appendChild(b);
    }
  }
  for (let i = 0; i < 4; i++) {
    const v = (d.brakeTemp && d.brakeTemp[i]) || 0;
    const e = $(hostId + '-' + i);
    if (!e) continue;
    e.textContent = v ? fmtTemp(v) : '--';
    // a cor e' sempre calculada em Celsius, mude a unidade nao muda a leitura
    e.style.color = !v ? '' : v > 600 ? '#FF0000' : v > 400 ? '#F58020' : '#fff';
  }
}

/* ------------------------------------------------------------ linguas */
function applyLang() {
  LANG = DEF.lang;
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach((e) => {
    e.textContent = t(e.getAttribute('data-i18n'));
  });
  document.title = t('app.title');
  applyUnits();
  if (typeof syncDrsMarkUI === 'function') syncDrsMarkUI();
  if (typeof loadAcPathSettings === 'function') loadAcPathSettings();
}

/* A unidade de velocidade depende de DEF.speed, nao do idioma: com o
   interface em portugues pode-se querer milhas. Por isso e' separado. */
function applyUnits() {
  document.querySelectorAll('.u-speed').forEach((e) => { e.textContent = spUnit(); });
}

/* ------------------------------------------------------------ modos */
function applyMode() {
  const mode = DEF.mode || 'telemetry';
  document.querySelectorAll('.view').forEach((v) => {
    v.classList.toggle('hidden', v.getAttribute('data-view') !== mode);
  });
  document.querySelectorAll('#set-mode button').forEach((b) => {
    b.classList.toggle('on', b.getAttribute('data-mode') === mode);
  });
}
function showMenu(first) {
  $('menu').classList.remove('hidden');
  if (first) $('app').classList.add('hidden');
  $('boot').classList.add('hidden');
}
function pickMode(mode) {
  DEF.mode = mode; saveDef(); applyMode();
  $('menu').classList.add('hidden');
  $('app').classList.remove('hidden');
  if (!S.seenEver) $('boot').classList.remove('hidden');
  connectTelemetry();
}

/* ------------------------------------------------------------ definicoes UI */
function syncSettingsUI() {
  const set = (id, v) => {
    document.querySelectorAll('#' + id + ' button').forEach((b) => {
      b.classList.toggle('on', b.getAttribute('data-v') === v);
    });
  };
  set('set-temp', DEF.temp);
  set('set-speed', DEF.speed);
  set('set-lang', DEF.lang);
  set('set-map', DEF.map);
  document.querySelectorAll('#set-map-flip button').forEach((b) => {
    const on = b.getAttribute('data-v') === 'flipx' ? !!DEF.mapFlipX : !!DEF.mapFlipZ;
    b.classList.toggle('on', on);
  });
  document.querySelectorAll('#set-map-view button').forEach((b) => {
    b.classList.toggle('on', b.getAttribute('data-v') === (DEF.mapView || 'inteira'));
  });
  document.querySelectorAll('#set-mode button').forEach((b) => {
    b.classList.toggle('on', b.getAttribute('data-mode') === (DEF.mode || 'telemetry'));
  });
}

/* ------------------------------------------------- pasta do AC (definicoes) */
function setAcPathStatus(msg, cls) {
  const el = $('set-ac-path-status');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('ok', 'bad');
  if (cls) el.classList.add(cls);
}
function applyAcPathInfo(info) {
  const input = $('set-ac-path');
  if (input && document.activeElement !== input) input.value = info.acPath || '';
  if (!info.acPath) {
    setAcPathStatus(t('set.acPathNone'), null);
  } else if (info.acPathValid) {
    const key = info.autodetected ? 'set.acPathAuto' : 'set.acPathOk';
    setAcPathStatus(t(key).replace('{p}', info.acPath), 'ok');
  } else {
    setAcPathStatus(t('set.acPathBad'), 'bad');
  }
}
function loadAcPathSettings() {
  fetch('/api/settings').then((r) => r.json()).then(applyAcPathInfo).catch(() => {});
}
function saveAcPath() {
  const input = $('set-ac-path');
  if (!input) return;
  setAcPathStatus(t('set.acPathSaving'), null);
  fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acPath: input.value.trim() }),
  }).then((r) => r.json()).then((info) => {
    applyAcPathInfo(Object.assign({ autodetected: false }, info));
    // caminho novo: esquece o que sabia da pista atual, para tentar outra vez
    S.realMapTrack = null; S.realMap = null;
    if (S.trackName) fetchRealMap(S.trackName, S.lastTrackConfig || '');
  }).catch(() => setAcPathStatus(t('set.acPathBad'), 'bad'));
}

function bindSettings() {
  $('btn-set').addEventListener('click', () => $('settings').classList.toggle('hidden'));
  $('set-close').addEventListener('click', () => $('settings').classList.add('hidden'));
  $('btn-menu').addEventListener('click', () => showMenu(false));

  document.querySelectorAll('#set-mode button').forEach((b) => {
    b.addEventListener('click', () => { DEF.mode = b.getAttribute('data-mode'); saveDef(); applyMode(); });
  });
  document.querySelectorAll('.menu-card').forEach((b) => {
    b.addEventListener('click', () => pickMode(b.getAttribute('data-mode')));
  });
  const seg = (id, key, after) => {
    document.querySelectorAll('#' + id + ' button').forEach((b) => {
      b.addEventListener('click', () => {
        DEF[key] = b.getAttribute('data-v'); saveDef();
        syncSettingsUI();
        if (after) after();
      });
    });
  };
  seg('set-temp', 'temp', applyLang);
  seg('set-speed', 'speed', applyUnits);
  seg('set-lang', 'lang', () => { applyLang(); syncSettingsUI(); });
  seg('set-map', 'map');

  // flips do mapa: cada botao e' um interruptor independente (nao e' um
  // grupo de escolha unica como os outros 'seg'), por isso nao usa o
  // helper seg() acima.
  document.querySelectorAll('#set-map-flip button').forEach((b) => {
    b.addEventListener('click', () => {
      const v = b.getAttribute('data-v');
      if (v === 'flipx') DEF.mapFlipX = !DEF.mapFlipX;
      else DEF.mapFlipZ = !DEF.mapFlipZ;
      saveDef();
      syncSettingsUI();
    });
  });
  // vista do mapa: pista inteira ou relativa (centrada no carro, com zoom
  // que acompanha a velocidade). Escolha unica, como os outros 'seg'.
  document.querySelectorAll('#set-map-view button').forEach((b) => {
    b.addEventListener('click', () => {
      DEF.mapView = b.getAttribute('data-v') || 'inteira';
      saveDef();
      syncSettingsUI();
    });
  });

  $('set-ac-path-save').addEventListener('click', saveAcPath);  $('set-ac-path').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') saveAcPath();
  });

  $('set-clear').addEventListener('click', () => { resetMap(true); });
  $('set-drs-mark').addEventListener('click', () => { setMarking(!S.marking); });
  $('set-drs-clear').addEventListener('click', () => {
    for (const p of S.path) p[2] = 0;
    S.marking = false;
    syncDrsMarkUI();
    saveMap(true);
  });
}

/* Liga/desliga a marcacao da zona de DRS. O botao fica com aspecto
   diferente enquanto marca, para nao se esquecer ligado. */
function setMarking(on) {
  S.marking = !!on;
  syncDrsMarkUI();
  if (S.marking) saveMap(true);      // grava logo, para nao perder o que ja ha
}
function syncDrsMarkUI() {
  const b = $('set-drs-mark');
  if (b) {
    b.classList.toggle('on', S.marking);
    b.textContent = S.marking ? t('set.drsMarking') : t('set.drsMark');
  }
  // O veredito do drsAvailable tem de ser visivel. Se a interface decide
  // sozinha se o campo serve para pintar a zona, o piloto tem de poder
  // ver o que ela decidiu - e porque.
  const v = $('set-drs-verdict');
  if (v) {
    let txt;
    if (S.drsVeredito === 'zona') {
      txt = t('set.drsVerdictZona') + ' ' + Math.round((S.drsFrac || 0) * 100) + '%';
    } else if (S.drsVeredito === 'sempre ligado') {
      txt = t('set.drsVerdictSempre');
    } else if (S.drsVeredito === 'nunca ligado') {
      txt = t('set.drsVerdictNunca');
    } else {
      const pc = S.drsConta ? Math.round(100 * S.drsAceso / S.drsConta) : 0;
      txt = t('set.drsAMedir') + ' ' + pc + '%';
    }
    if (v.textContent !== txt) v.textContent = txt;
    v.className = 'set-note drs-verdict' + (S.drsVeredito === 'zona' ? ' bom' : '');
  }
}

/* ------------------------------------------------------------ clima e pneu */
/* O AC nao tem campo de chuva nem de estado do tempo em nenhuma das tres
   paginas. Nao se inventa: mostra-se o que o jogo publica, que e' o
   efeito do clima - ar, pista, densidade, vento - e a aderencia, que e'
   o unico sinal de pista molhada. */

function pintarClima(d) {
  // escrever nos dois modos, para o clima nao desaparecer ao mudar de vista
  for (const pfx of ['', 'b-']) {
    setTxt(pfx + 'wx-air', d.airTemp != null ? fmtTemp(d.airTemp) : '—');
    setTxt(pfx + 'wx-road', d.roadTemp != null ? fmtTemp(d.roadTemp) : '—');
    setTxt(pfx + 'wx-wind', d.windSpeed != null ? d.windSpeed.toFixed(0) : '—');
    pintarGrip(pfx + 'wx-grip', d.surfaceGrip);
  }

  // densidade do ar: 1.225 ao nivel do mar, menos um pouco por altitude
  // e por ar frio. Mostra-se com tres casas porque a diferenca entre dois
  // dias e' na terceira casa.
  const dens = $('wx-density');
  if (dens) {
    dens.textContent = d.airDensity != null ? d.airDensity.toFixed(3) : '—';
    // fora do plausivel (0.9 a 1.4) e' melhor cinzento do que um numero
    // acredivel mas errado
    const ok = d.airDensity != null && d.airDensity > 0.9 && d.airDensity < 1.4;
    dens.style.color = ok ? '' : 'var(--grey)';
  }
}

/* Aderencia: 1.0 e' o valor de seco. Só se pinta quando desce, que e'
   quando chove. Nao se escreve "molhado" com base numa suposicao - o
   numero fala por si. */
function pintarGrip(id, v) {
  const g = $(id);
  if (!g) return;
  g.textContent = v != null ? v.toFixed(2) : '—';
  g.style.color = v == null ? '' : v >= 0.98 ? '' : v >= 0.85 ? 'var(--orange)' : 'var(--red)';
}

/* O nome do pneu vem do jogo em varios formatos. Nos carros de 2025 e'
   "Pirelli P Zero 2025 C3 (C3)" - o codigo esta entre parenteses. No AC
   base pode ser "dry_compound", sem codigo nenhum. Só se mostra o badge
   quando ha codigo: nada de adivinhar uma sigla a partir de um nome. */
function codigoPneu(nome) {
  if (!nome) return '';
  const m = String(nome).match(/\(([^)]{1,12})\)\s*$/);
  return m ? m[1].trim() : '';
}
function pintarPneu(d) {
  const nome = d.compound || '';
  // o modo telemetria e o modo misto tem os seus cartoes, por isso escreve
  // nos dois senao o pneu so aparecia num dos modos
  setTxt('compound-name', nome || '—');
  setTxt('compound-name2', nome || '—');
  const codigo = codigoPneu(nome);
  for (const id of ['compound-code', 'compound-code2']) {
    const badge = $(id);
    if (!badge) continue;
    if (codigo) {
      badge.textContent = codigo;
      badge.hidden = false;
    } else if (nome && nome.indexOf('_') < 0) {
      // sem codigo entre parenteses, mas com um nome limpo: mostra o nome
      badge.textContent = nome.toUpperCase();
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }
}

/* ------------------------------------------------------------ widgets */
function setDrs(els, d) {
  const on = d.drsEnabled >= 1, avail = d.drsAvailable >= 1;
  // classList.toggle em vez de reescrever o className: assim mantem-se
  // qualquer classe de posicionamento (ex. "drs-inline") que o HTML ja
  // tenha, em vez de a apagar a cada frame.
  els.forEach((e) => {
    if (!e) return;
    e.classList.toggle('open', !!(d.hasDRS && on));
    e.classList.toggle('avail', !!(d.hasDRS && !on && avail));
  });
  return { on, avail };
}
function setLight(id, txt, cls) {
  const e = $(id);
  if (!e) return;
  e.querySelector('.l-val').textContent = txt;
  e.className = 'light' + (cls ? ' ' + cls : '');
}

/* ABS e TC: mostra o nivel de ajuste em percentagem, com barra. O valor
   vem do AC como 0..1. Acima de meio caminho a barra fica a salientar,
   porque e' ai que o assist comeca a mexer na travagem de verdade.
   Recebe o ELEMENTO, nao o id - como o setDrs. Passar o id aqui dava
   getElementById(elemento) = null e nao sevia nada, sem erro nenhum. */
function pintarNivel(card, bar, nivel) {
  if (!card) return;
  const v = clamp(num(nivel), 0, 1);
  const pc = Math.round(v * 100);
  const val = card.querySelector('.l-val');
  if (val) val.textContent = pc + '%';
  card.className = 'light' + (v <= 0.001 ? '' : v >= 0.5 ? 'warn' : 'on');
  if (bar) {
    bar.style.width = pc + '%';
    bar.classList.toggle('low', v < 0.25);
  }
}

function renderSectors(d) {
  const host = $('sectors');
  if (!host) return;
  const n = d.sectorCount || 0;
  if (!n) { host.innerHTML = ''; return; }
  if (host.childElementCount !== n) {
    host.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const b = document.createElement('div');
      b.className = 'sector-box';
      b.innerHTML = '<span>S' + (i + 1) + '</span><b>--</b>';
      host.appendChild(b);
    }
  }
  const last = d.lastSectorTime;
  const cur = (d.sector || 0);
  Array.prototype.forEach.call(host.children, (b, i) => {
    b.classList.toggle('cur', i === cur);
    b.classList.toggle('best', S.bestSectorTimes[i] != null &&
      last !== '--:--.---' && last <= S.bestSectorTimes[i]);
    const v = b.querySelector('b');
    if (i < cur && S.sectorTimes[i]) v.textContent = S.sectorTimes[i];
    else v.textContent = i === cur ? '·' : '--';
  });
}

/* ------------------------------------------------------------ telemetria */
let esTel = null, esOpp = null;

function connectTelemetry() {
  if (esTel) esTel.close();
  const url = '/events?fps=' + clamp(DEF.fps || 60, 5, 60);
  esTel = new EventSource(url);
  esTel.onmessage = (ev) => {
    let d; try { d = JSON.parse(ev.data); } catch (e) { return; }
    render(d);
  };
  esTel.onerror = () => {
    if (esTel && esTel.readyState === EventSource.CLOSED) {
      setTimeout(connectTelemetry, 1500);
    }
  };
}
function connectOpponents() {
  if (esOpp) esOpp.close();
  esOpp = new EventSource('/events/opponents?fps=10');
  esOpp.onmessage = (ev) => {
    let d; try { d = JSON.parse(ev.data); } catch (e) { return; }
    renderOpponents(d);
  };
}

let lastD = null;
function render(d) {
  S.frames++;
  const now = performance.now();
  if (now - S.fpsAt >= 1000) {
    S.fps = Math.round(S.frames * 1000 / (now - S.fpsAt));
    S.frames = 0; S.fpsAt = now;
    setTxt('fps', S.fps + ' fps');
  }

  const live = d.live;
  if (d.connected) {
    S.seenEver = true;
    if (DEF.mode) { $('boot').classList.add('hidden'); $('app').classList.remove('hidden'); }
  }
  document.body.classList.toggle('paused', !live);
  const sp = d.sincePacket || 0;
  setTxt('status', (live ? t('status.live') : (sp < 90 ? t('status.paused') : t('status.closed')))
    + (live ? '' : '  ·  ' + t('status.stale')));

  // troca de pista: guarda o que tinhamos, limpa o traçado em memoria
  // (sem apagar o que ja esta guardado de OUTRAS pistas) e, se ja
  // tivermos mapeado esta pista antes, carrega-a completa de imediato -
  // e' isto que faz o mapa "estar la" em vez de ser descoberto outra
  // vez sempre que se entra numa pista ja conhecida.
  if (d.track && d.track !== S.trackName) {
    if (S.trackName) saveMap(true);
    S.trackName = d.track;
    S.lastTrackConfig = d.trackConfig || '';
    resetMap(false);
    loadMapFor(d.track);
    S.realMap = null;                 // nao mostrar o mapa da pista anterior
    fetchRealMap(d.track, d.trackConfig || '');
  }

  // cabecalho
  setTxt('track', d.track || '—');
  setTxt('car', d.car || '—');
  setTxt('session', d.session || '—');
  setTxt('compound', (d.compound || '').replace(/_/g, ' '));
  setTxt('pos', d.position > 0 ? 'P' + d.position : '—');
  setTxt('lap', t('lapCount') + ' ' + (num(d.lap) + 1) +
    (d.totalLaps ? '/' + d.totalLaps : ''));
  const fl = $('flag');
  if (fl) {
    fl.textContent = d.flag || '—';
    fl.className = 'h-flag' + (d.flagId === 2 ? ' f-yellow' : d.flagId === 3 ? ' f-red'
      : d.flagId === 1 ? ' f-blue' : d.flagId === 5 ? ' f-checkered' : '');
  }
  const dr = setDrs([$('drs-light'), $('b-drs-light')], d);

  // central (modo telemetria)
  setTxt('speed', fmtSpeed(d.speed || 0));
  setTxt('gear', d.gear || 'N');
  const maxRpm = d.maxRpm || 12000;
  const pct = clamp((d.rpm || 0) / maxRpm * 100, 0, 100);
  setTxt('rpm', d.rpm || 0);
  $('rpm-fill').style.width = (100 - pct) + '%';
  setTxt('shift-hint', pct > 92 ? '▲' : '');

  const hasE = d.hasERS || d.hasKERS;
  setLight('l-ers', hasE ? Math.round(d.ersPct || 0) + '%' : '—',
    hasE ? ((d.ersPct || 0) > 25 ? 'on' : 'warn') : '');
  const eb = $('ers-bar');
  if (eb) { eb.style.width = clamp(d.ersPct || 0, 0, 100) + '%'; eb.classList.toggle('low', (d.ersPct || 0) <= 20); }
  // ABS e TC sao o NIVEL de ajuste, nao "esta a actuar". Medido: em 4502
  // amostras com travagens duras e aceleracao a fundo, os dois ficaram
  // constantes (0.13 e 0.08). Antes isto mostrava "OFF" sempre que o
  // nivel era menor que 0.5, o que faz dizer ao piloto que nao tem
  // nada de ABS quando tem 13%.
  pintarNivel($('l-abs'), $('abs-bar'), d.abs);
  pintarNivel($('l-tc'), $('tc-bar'), d.tc);
  setLight('l-pit', d.pitLimiter ? t('state.lim') : d.isInPit ? t('lb.pit') : '—',
    d.pitLimiter ? 'bad' : d.isInPit ? 'warn' : '');

  // tempos
  setTime('t-current', d.currentTime);
  setTime('t-best', d.bestTime);
  setTime('t-last', d.lastTime);
  const curSec = toSec(d.currentTime);
  if (curSec != null) {
    const p = d.trackPct || 0;
    if (p < S.lastLapPct - 0.3) onLapComplete(toSec(d.lastTime));
    S.lastLapPct = p;
    // sem shift(): empilharPonto reduz a resolucao em vez de descartar o
    // inicio da volta, que e' o que fazia a delta desaparecer no primeiro
    // quarto da pista. Ver static/tempos.js.
    S.lapPct = empilharPonto(S.lapPct, p, curSec, 12000);
    if (d.lastSectorTime && d.lastSectorTime !== '--:--.---') {
      const st = toSec(d.lastSectorTime);
      const si = (d.sector || 1) - 1;
      if (si >= 0 && (S.sectorTimes[si] == null || st < S.sectorTimes[si])) {
        S.sectorTimes[si] = d.lastSectorTime;
        if (S.bestSectorTimes[si] == null || st < S.bestSectorTimes[si]) S.bestSectorTimes[si] = st;
      }
    }
    const dl = computeDelta(p, curSec);
    pintarDelta($('t-delta'), dl);
    $('lap-progress').style.width = clamp(p * 100, 0, 100) + '%';
  }
  renderSectors(d);

  // clima e pneu
  pintarClima(d);
  pintarPneu(d);

  // pedais
  pushTrace(d);
  setTxt('v-throttle', Math.round(d.throttle || 0));
  setTxt('v-brake', Math.round(d.brake || 0));
  setTxt('v-clutch', Math.round(100 - (d.clutchRaw != null ? d.clutchRaw : 1) * 100));
  const hb = $('v-handbrake');
  if (hb) hb.textContent = d.handbrake != null ? Math.round(d.handbrake) : '—';
  // o volante e' desenhado no loop, a partir deste valor
  S.steer = num(d.steer);
  setTxt('v-steer', S.steer.toFixed(2));
  setTxt('v-steer2', S.steer.toFixed(2));

  // pneus e travões
  renderTyres('tyres', d);
  renderBrakes('brake-temp', d);

  // combustivel
  setTxt('fuel-pct', Math.round(d.fuelPct || 0));
  $('fuel-bar').style.width = clamp(d.fuelPct || 0, 0, 100) + '%';
  setTxt('fuel-l', (d.fuelL || 0).toFixed(1) + ' L');
  setTxt('fuel-laps', d.fuelLaps != null ? d.fuelLaps.toFixed(1) : '—');
  setTxt('temps', fmtTemp(d.airTemp || 0) + ' / ' + fmtTemp(d.roadTemp || 0) + ' ' + tUnit());
  const pe = $('pen-time');
  if (pe) {
    pe.textContent = d.penaltyTime > 0 ? '+' + d.penaltyTime + ' s'
      : d.penaltyFlag ? '!' : (d.penaltiesEnabled ? t('fuel.none') : '—');
    pe.className = (d.penaltyTime > 0 || d.penaltyFlag) ? 'alert' : '';
  }
  setTxt('ers-used', d.ersUsedThisLapKJ ? Math.round(d.ersUsedThisLapKJ) + ' kJ' : '—');

  // mapa: o plano da pista e' X-Z (ver nota acima).
  // Zona de DRS: o drsAvailable E' um flag de zona nalguns carros, mas
  // noutros fica a 1 quase sempre. Medido:
  //   Ferrari SF25 em Interlagos  -> 1 em 18.5% da volta, em duas zonas
  //                                  contiguas, e so a 262-312 km/h
  //   Red Bull RB21 em Suzuka     -> 1 em 98.9% do tracado, por igual
  //                                  nos cinco quintos (ou seja, nao e'
  //                                  flag de zona nenhuma)
  // Pintar sem confirmar dava a pista toda a verde num caso e a zona
  // certa no outro. Por isso o drsAvailable so e' aceite se ao fim de
  // uma volta parecer mesmo uma zona; ate la, pinta-se a mao.
  // So' grava o mapa com a sessao MESMO a correr.
  //
  // Sem esta guarda, com o jogo fechado o site continuava a encher o mapa:
  // mediram-se 7383 pontos quase todos a tremer meio metro em torno da
  // mesma posicao congelada, mais uns quantos teletransportes. A posicao
  // parada passa o filtro dos 0,3 m do pushMapPoint porque a telemetria
  // publication tremula, e o traçado enche-se de ruido.
  //
  // Em PAUSA e no menu o packetId tambem para, portanto 'live' e' falso e o
  // mapa fica como estava -- que e' o que se quer ver.
  if (d.connected && d.live) {
    pushMapPoint(d.x, d.z, S.marking ? 1 : (S.drsAuto ? (d.drsAvailable ? 1 : 0) : 0),
      d.sector, d.drsAvailable);
  }
  // velocidade amortecida para o zoom da vista relativa. So' quando ha'
  // telemetria a serio: com o jogo fechado a velocidade e' 0 e a media
  // puxaria o zoom para o estado parado, em vez de o deixar como esta.
  if (d.connected) {
    const v = Math.abs(d.speed || 0);
    S.velSuave = S.velSuave + (v - S.velSuave) * 0.06;
  }
  setTxt('trackpct', (clamp(d.trackPct || 0, 0, 1) * 100).toFixed(1) + '%');
  setTxt('sector', t('sector') + ' ' + ((d.sector || 0) + 1) + (d.sectorCount ? '/' + d.sectorCount : ''));

  // modo misto
  setTxt('b-speed', fmtSpeed(d.speed || 0));
  setTxt('b-gear', d.gear || 'N');
  setTxt('b-rpm', d.rpm || 0);
  $('b-rpm-fill').style.width = (100 - clamp((d.rpm || 0) / (d.maxRpm || 12000) * 100, 0, 100)) + '%';
  setLight('b-l-ers', hasE ? Math.round(d.ersPct || 0) + '%' : '—', hasE ? 'on' : '');
  $('b-ers-bar').style.width = clamp(d.ersPct || 0, 0, 100) + '%';
  setLight('b-l-pit', d.pitLimiter ? t('state.lim') : d.isInPit ? t('lb.pit') : '—',
    d.pitLimiter ? 'bad' : d.isInPit ? 'warn' : '');
  setTxt('b-trackpct', (clamp(d.trackPct || 0, 0, 1) * 100).toFixed(1) + '%');
  setTxt('b-sector', t('sector') + ' ' + ((d.sector || 0) + 1) + (d.sectorCount ? '/' + d.sectorCount : ''));
  renderTyres('tyres2', d);
  renderBrakes('brake-temp2', d);

  // modo leaderboard: faixa do teu carro
  setTxt('m-speed', fmtSpeed(d.speed || 0));
  setTxt('m-gear', d.gear || 'N');
  $('m-rpm').style.width = pct + '%';
  setTxt('m-current', d.currentTime || '--:--.---');
  $('m-current').classList.toggle('empty', !d.currentTime || d.currentTime.indexOf('--') === 0);
  pintarDelta($('m-delta'), computeDelta(d.trackPct || 0, curSec == null ? 0 : curSec));
  setTxt('m-pen', d.penaltyTime > 0 ? '+' + d.penaltyTime + ' s' : (d.penaltiesEnabled ? t('fuel.none') : '—'));
  setTxt('m-drs', !d.hasDRS ? '—' : dr.on ? t('drs.open') : dr.avail ? t('drs.avail') : t('drs.off'));
  setTxt('m-brake', (d.brakeTemp || []).map((v) => fmtTemp(v)).join(' ') || '—');
  setTxt('m-fuel', Math.round(d.fuelPct || 0) + '% · ' + (d.fuelL || 0).toFixed(0) + ' L');
  renderTyres('tyres3', d);

  lastD = d;
}

/* ------------------------------------------------------------ adversarios */
let myCarId = null;
function renderOpponents(o) {
  if (!o) return;
  S.opponents = o;
  const rows1 = $('lb-rows'), rows2 = $('lb-rows2');
  const note1 = $('lb-note'), note2 = $('lb-note2');
  const compact = !!rows2;

  if (!o.available || !o.cars || o.cars.length === 0) {
    const msg = '<b>' + t('opp.waiting') + '</b><br>' + t('opp.how');
    [rows1, rows2].forEach((r) => { if (r) r.innerHTML = ''; });
    [note1, note2].forEach((n) => {
      if (n) { n.innerHTML = o.available ? t('opp.none') : msg; n.classList.remove('hidden'); }
    });
    return;
  }
  [note1, note2].forEach((n) => { if (n) n.classList.add('hidden'); });

  myCarId = o.focus;
  // o melhor tempo do jogador, para calcular diferencas
  let leaderBest = 0;
  for (const c of o.cars) {
    const s = toSec(c.best);
    if (s != null && (leaderBest === 0 || s < leaderBest)) leaderBest = s;
  }
  const me = o.cars.find((c) => c.id === myCarId) || null;
  const html = o.cars.map((c) => {
    const best = toSec(c.best);
    let gap = '';
    if (c.id !== myCarId && best != null && leaderBest > 0) {
      const d = best - leaderBest;
      gap = (d >= 0 ? '+' : '') + d.toFixed(3);
    }
    const isMe = c.id === myCarId;
    const cols = compact
      ? '<span class="lb-pos">' + (c.pos || '-') + '</span>' +
        '<span class="lb-name">' + esc(c.name) + '<small>' + esc(c.car) + '</small></span>' +
        '<span class="lb-lap">' + (c.lap + 1) + '</span>' +
        '<span class="lb-best">' + (c.best || '--') + '</span>'
      : '<span class="lb-pos">' + (c.pos || '-') + '</span>' +
        '<span class="lb-name">' + esc(c.name) + '<small>' + esc(c.car) + '</small></span>' +
        '<span class="lb-lap">' + (c.lap + 1) + '</span>' +
        '<span class="lb-time">' + (c.last || '--') + '</span>' +
        '<span class="lb-best">' + (c.best || '--') + '</span>' +
        '<span class="lb-gap' + (gap ? (gap[0] === '-' ? ' neg' : ' pos') : '') + '">' + gap + '</span>';
    return '<div class="lb-row' + (isMe ? ' me' : '') + (c.inPit ? ' pit' : '') + '">' + cols + '</div>';
  }).join('');

  if (rows1) rows1.innerHTML = html;
  if (rows2) rows2.innerHTML = html;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ------------------------------------------------------------ loop */
function loop() {
  const mode = DEF.mode || 'telemetry';
  if (DEF.map !== 'off') {
    if (mode === 'telemetry') drawMap('map');
    else if (mode === 'both') drawMap('map2');
  }
  if (mode === 'telemetry') { drawPedals('pedals'); drawVolante('wheel', S.steer); }
  else if (mode === 'both') { drawPedals('pedals2'); drawVolante('wheel2', S.steer); }
  requestAnimationFrame(loop);
}

/* ------------------------------------------------------------ arranque */
function boot() {
  loadDef();
  applyLang();
  buildTyres('tyres');
  buildTyres('tyres2');
  buildTyres('tyres3');
  bindSettings();
  syncSettingsUI();
  applyMode();
  document.body.classList.remove('booting');
  connectOpponents();
  connectTelemetry();
  loop();

  if (DEF.mode) {
    // ja escolheu antes: nao mostrar o menu, so acionar a vista
    applyMode();
  } else {
    showMenu(true);
  }
  addFpsControl();
}

function addFpsControl() {
  const host = document.getElementById('set-fps-host');
  if (!host) return;
  host.innerHTML =
    '<h3>' + t('set.fps') + '</h3>' +
    '<div class="seg" id="set-fps">' +
    [10, 20, 30, 60].map((v) =>
      '<button data-v="' + v + '">' + v + ' fps</button>').join('') +
    '</div>';
  document.querySelectorAll('#set-fps button').forEach((b) => {
    b.classList.toggle('on', +b.getAttribute('data-v') === +DEF.fps);
    b.addEventListener('click', () => {
      DEF.fps = +b.getAttribute('data-v');
      saveDef(); syncFpsUI();
      connectTelemetry();          // reabre com o novo ritmo
    });
  });
}
function syncFpsUI() {
  document.querySelectorAll('#set-fps button').forEach((b) => {
    b.classList.toggle('on', +b.getAttribute('data-v') === +DEF.fps);
  });
}

window.addEventListener('resize', () => { /* os canvas reajustam no proximo frame */ });
document.addEventListener('DOMContentLoaded', boot);
