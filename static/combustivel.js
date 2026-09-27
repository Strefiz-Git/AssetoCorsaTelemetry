/*static/combustivel.js  --  quantas voltas de combustivel ainda ha'.

   Puro, sem DOM e sem estado global, como o tyres.js: e' por isso que
   da' para correr no node e ser testado a serio. O app.js guarda o
   estado (S) e delega.

   PORQUE MEDIR E NAO CALCULAR
   ----------------------------
   O AC da `fuelL` (litros no deposito), `fuelPct` e `maxFuelL`. Nao da'
   litros por volta, e `Fuel_LastLapConsumption` nao existe na memoria
   partilhada -- ver AGENTS.md Regra no 7, a tabela do que nao existe.

   Logo, mede-se: a diferenca entre o inicio e o fim de cada volta. E'
   exactamente o que se faz com o desgaste do pneu, e pelo mesmo motivo
   -- o numero que o jogo nao da' e' medido em vez de inventado.

   MEDIA, E NAO A ULTIMA VOLTA
   ----------------------------
   Uma volta com safety car, ou com o-packed field, gasta muito menos do
   que uma volta limpa. Se a estimativa vier da ultima volta, um unico
   safety car faz o numero de voltas saltitar. A media de todas as
   voltas fechadas dilui isso, e e' por isso que se guarda a lista em
   vez de um unico valor.

   INVALIDAR
   ---------
   Se o deposito SUbe (box, delta de seguranca), a diferenca e' negativa
   e nao quer dizer nada. Descarta-se essa volta em vez de dar um
   "litros por volta" negativo, que apareceria como um numero enorme de
   voltas restantes e que seria o pior sitio para estar errado.

   Devolve SEMPRE a mesma forma, com todos os campos, para o consumidor
   nao ter de tratar o "ainda nao sei" como um caso especial.
 */
(function (root) {
  'use strict';

  /* Abaixo disto, uma "media" e' ruido. Numa corrida de resistencia o
     consumo por volta muda com o jogo dos pneus e com o trafego, mas
     nao muda por ordem de grandeza. */
  var MIN_L = 0.05;

  /* Acima disto, os litros que sobram nao servem para um descento nem
     para uma paragem. Nao e' um palpite: um F1 consome mais de 100 L
     por volta, e o que fica e' a margem de seguranca. */
  var MAX_L = 400;

  /* Quantas voltas medidas antes de a media deixar de ser uma amostra de
     uma. Duas e' o minimo honesto para um numero que decide se se entra
     ou nao no box. */
  var MIN_VOLTAS_MEDIA = 2;

  /* A MEDIA e' de todas, ou das ultimas? Todas. Mas nao infinitas: a
     partir de 8, as mais antigas sao de uma fase da corrida que nao
     existe, e a media deixa de reagir. */
  var MAX_VOLTAS_MEDIDAS = 8;

  /* Acima de 1,5 voltas nao ha' por que avisar. Abaixo de 1,0 esta' no
     critico -- uma curva perde-se entre a saida do box e a primeira
     volta. */
  var AVISO_VOLTAS = 1.5;
  var CRITICO_VOLTAS = 1.0;

  /* E o mesmo alerta, medido de outra maneira.
   *
   * As voltas dependem de um ritmo que so' existe depois de uma volta
   * fechada. A percentagem nao depende de nada: e' o valor que o jogo
   * da directamente. Ha' casos em que so' a percentagem ajuda -- um
   * limite muito longo, onde "voltas" e' um numero grande e "percentagem"
   * e' um numero pequeno, e vice-versa num limite muito curto.
   *
   * Sao DOIS limiares independentes, e o alerta dispara com qualquer um
   * deles. Um 'ou' e' mais honesto do que um 'e': nenhum dos dois tem
   * razao para calar o outro. */
  var AVISO_PCT = 15;

  function vazio(estado, msg) {
    return {
      valido: false,
      litrosPorVolta: null,
      voltasRestantes: null,
      // .length, e nao a propria lista: uma lista vazia e' truthy em
      // JavaScript, portanto '(estado.voltas || 0)' devolvia [] em vez
      // de 0, e o contador de voltas mediava mostrava um array.
      voltasMedidas: (estado && estado.voltas && estado.voltas.length) || 0,
      estado: estado || null,
      nivel: 'desconhecido',
      aviso: false,
      msg: msg || null
    };
  }

  /* Um numero de que se pode fazer uma conta. */
  function num(v) {
    return typeof v === 'number' && isFinite(v);
  }

  /* Estimativa a partir do que ja foi medido.

     dados: { litros: Number, voltas: Number, connected: Boolean }

     connected false = o jogo nao esta' a correr, ou o carro esta' no
     box sem telemetria. Nao se mede nada disso: o deposito enche-se com
     o motor ligado e sem conduzir, e isso nao e' consumo de corrida. */
  function estimarCombustivel(estado, dados, pctRestante) {
    if (!dados || !num(dados.litros) || !dados.connected) {
      return vazio(estado, null);
    }
    var litros = dados.litros;
    var volta = dados.voltas;

    // --- stint novo ---------------------------------------------------
    // Mudanca de sessao (o contador vai para tras), primeira leitura, ou
    // o estado que veio de outro sitio.
    if (!estado || !num(estado.litros) || !num(estado.volta)
        || volta < estado.volta) {
      var novo = {
        litros: litros,
        volta: volta,
        voltas: [],
        media: null
      };
      return Object.assign(vazio(novo, null), {
        msg: volta === 0 ? 'a medir' : null
      });
    }

    // --- a mesma volta que da ultima vez: nada a fazer ---------------
    if (volta === estado.volta) {
      return _resultado(estado, litros, null, pctRestante);
    }

    // --- fechou uma ou mais voltas -----------------------------------
    // Mede-se do inicio DESTA volta ate agora. Perdemos o inicio
    // anterior quando o contador saltou mais do que uma volta (faltou
    // uma leitura); nesse caso a medicao e' de um bocado maior do que
    // uma volta e nao da' para usar. Fica registado como "saltou", e
    // descarta-se.
    if (volta === estado.volta + 1) {
      var gasto = estado.litros - litros;
      if (gasto > MIN_L && gasto < MAX_L) {
        estado.voltas.push(gasto);
        while (estado.voltas.length > MAX_VOLTAS_MEDIDAS) {
          estado.voltas.shift();
        }
      }
      // fora da faixa = nao medido, descartado em silencio. Registar
      // porque a media tem de reflectir so' o que foi medido a serio.
    }

    estado.litros = litros;
    estado.volta = volta;
    return _resultado(estado, litros, null, pctRestante);
  }

  function _media(voltas) {
    if (!voltas || voltas.length === 0) return null;
    var s = 0;
    for (var i = 0; i < voltas.length; i++) s += voltas[i];
    return s / voltas.length;
  }

  function _resultado(estado, litros, _ignorado, pctRestante) {
    var media = _media(estado.voltas);
    var n = estado.voltas.length;

    if (media == null) {
      return vazio(estado, 'a medir');
    }

    var restantes = litros / media;

    /* O nivel e' o MAIS ALARMANTE dos dois limiares, nao o primeiro que
     * dispara. Um alerta a piscar a vermelho enquanto o outro so' pede
     * laranja seria mostrar o estado errado. */
    var porVoltas = restantes < AVISO_VOLTAS
      ? (restantes < CRITICO_VOLTAS ? 'critico' : 'aviso') : 'normal';
    var pct = (pctRestante != null) ? pctRestante : null;
    var porPct = pct == null ? 'normal'
      : (pct <= 5 ? 'critico' : (pct <= AVISO_PCT ? 'aviso' : 'normal'));
    var nivel = (porVoltas === 'critico' || porPct === 'critico') ? 'critico'
      : ((porVoltas === 'aviso' || porPct === 'aviso') ? 'aviso' : 'normal');

    // Uma media de uma volta e' melhor do que nada, mas e' uma amostra
    // de uma. Diz-se isso em vez de fingir que ja' se mediu o ritmo.
    if (n < MIN_VOLTAS_MEDIA) {
      return {
        valido: true,
        litrosPorVolta: media,
        voltasRestantes: restantes,
        voltasMedidas: n,
        estado: estado,
        nivel: nivel,
        aviso: nivel !== 'normal',
        porVoltas: porVoltas,
        porPct: porPct,
        msg: null,
        // a media so' e' de uma volta -- o consumidor mostra-o
        soUmaVolta: true
      };
    }

    return {
      valido: true,
      litrosPorVolta: media,
      voltasRestantes: restantes,
      voltasMedidas: n,
      estado: estado,
      nivel: nivel,
      aviso: nivel !== 'normal',
      porVoltas: porVoltas,
      porPct: porPct,
      msg: null,
      soUmaVolta: false
    };
  }

  var api = {
    estimarCombustivel: estimarCombustivel,
    AVISO_VOLTAS: AVISO_VOLTAS,
    CRITICO_VOLTAS: CRITICO_VOLTAS,
    AVISO_PCT: AVISO_PCT,
    MIN_VOLTAS_MEDIA: MIN_VOLTAS_MEDIA,
    MAX_VOLTAS_MEDIDAS: MAX_VOLTAS_MEDIDAS
  };
  // nos dois sitios, como o tyres.js: o browser precisa de window, e o
  // node precisa de module.exports. So' um dos dois e' teste nenhum.
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Combustivel = api;
})(typeof window !== 'undefined' ? window : globalThis);
