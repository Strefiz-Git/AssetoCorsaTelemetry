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

  /* A COR do aviso, em funcao da percentagem que resta.
   *
   * Nao sao tres zonas com tres nomes: e' UMA rampa, entre duas cores, e
   * os pontos intermedios sao o que sai da interpolacao.
   *
   *     15%  ->  #FFD700  (o dourado do painel)
   *      0%  ->  #FF3C3C  (o vermelho do painel)
   *
   * A meio -- 7,5% -- a mistura da' #FF8A1E, que e' o laranja. Nao foi
   * posto de proposito: e' o que está no meio das duas, e e' a
   *_confirmation de que a rampa esta' certa. Se se escrever
   * 'laranja' a mao, sao tres constantes que divergem; a rampa e' uma so.
   *
   * Porquê uma rampa e nao tres degraus: o piloto ve o combustivel a
   * descer. Com degraus, a cor salta de amarelo para laranja de repente
   * e nao se sabe se piorou ou se foi um erro de leitura. Com a rampa, a
   * cor DESCE com o numero, e o olho ve as duas coisas a andar juntas.
   *
   * Devolve null fora do aviso: acima de AVISO_PCT nao ha cor nenhuma,
   * porque a carta esta' normal e pintar o normal de amarelo seria um
   * alarme falso. */
  var COR_ALTO = [255, 215, 0];    // #FFD700, aos AVISO_PCT
  var COR_BAIXO = [255, 60, 60];   // #FF3C3C, aos 0

  function corDe(pctRestante) {
    var c = _mistura(pctRestante);
    return c ? _rgb(c) : null;
  }


  function _mistura(pctRestante) {
    if (pctRestante == null) return null;
    if (pctRestante >= AVISO_PCT) return null;
    if (pctRestante <= 0) return COR_BAIXO.slice();
    // t vai de 1 (no limiar do aviso) a 0 (sem nada)
    var t = pctRestante / AVISO_PCT;
    var c = [];
    for (var i = 0; i < 3; i++) {
      c.push(Math.round(COR_BAIXO[i] + (COR_ALTO[i] - COR_BAIXO[i]) * t));
    }
    return c;
  }

  function _rgb(c) {
    return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  }

  /* O NIVEL DE AVISO, calculado com o que estiver disponivel.
   *
   * Deliberadamente SEPARADO de `valido`, e essa separacao e' a
   * correccao de um erro meu.
   *
   * `valido` quer dizer "sei quantas voltas restam", e so' passa a ser
   * verdadeiro depois de uma volta fechada. Isso e' o que faz a linha
   * Voltas mostrar 'a medir' -- e e' o honesto.
   *
   * O aviso e' outra coisa, e nao tem nada a ver com `valido`. A
   * percentagem vem do jogo e existe desde a primeira leitura. Comecar
   * uma corrida com 7% de combustivel e' exactamente o momento em que o
   * alerta e' para quem conduz, e era esse o momento em que nao
   * aparecia: o frontend fazia `r.valido && r.aviso`, e na primeira
   * volta `valido` e' falso por definicao.
   *
   * A razao de ter acrescentado o limiar em percentagem era nao
   * depender de nenhuma medicao. Prende-lo a uma medicao e' desfazer a
   * razao -- e foi o que fiz.
   *
   * Sem nenhum dos dois dados, o nivel e' 'desconhecido' e a interface
   * pinta de neutro. Nunca de vermelho: um alerta sem base nenhuma e'
   * como se trains o piloto a ignorar o alerta. */
  function nivelDe(porVoltas, porPct) {
    if (porVoltas === 'critico' || porPct === 'critico') return 'critico';
    if (porVoltas === 'aviso' || porPct === 'aviso') return 'aviso';
    return 'normal';
  }

  /* O nivel a partir do estado e da percentagem, sem cuidar de saber se
     as voltas estao medidas. E' isto que o frontend deve usar para
     PISCAR. */
  function _aviso(estado, pctRestante) {
    var n = (estado && estado.voltas && estado.voltas.length) || 0;
    var media = n > 0 ? _media(estado.voltas) : null;

    var porVoltas = 'normal';
    if (media != null && media > 0) {
      var restantes = estado.litros / media;
      porVoltas = restantes < AVISO_VOLTAS
        ? (restantes < CRITICO_VOLTAS ? 'critico' : 'aviso') : 'normal';
    }

    var porPct = (pctRestante == null) ? 'normal'
      : (pctRestante <= 5 ? 'critico'
          : (pctRestante <= AVISO_PCT ? 'aviso' : 'normal'));

    // 'desconhecido' so' quando NAO HINGUEM dos dois: nem percentagem
    // nenhuma, nem uma volta medida. Com um dos dois, ja' se sabe
    // alguma coisa, e o nivel normal e' uma resposta -- a que se o
    // combustivel esta' bem.
    var nada = (porVoltas === 'normal' && porPct === 'normal'
      && media == null && pctRestante == null);

    return {
      nivel: nada ? 'desconhecido' : nivelDe(porVoltas, porPct),
      aviso: nada ? false : nivelDe(porVoltas, porPct) !== 'normal',
      porVoltas: porVoltas,
      porPct: porPct
    };
  }

  function vazio(estado, msg, pctRestante) {
    var a = _aviso(estado, pctRestante);
    return {
      valido: false,
      litrosPorVolta: null,
      voltasRestantes: null,
      // .length, e nao a propria lista: uma lista vazia e' truthy em
      // JavaScript, portanto '(estado.voltas || 0)' devolvia [] em vez
      // de 0, e o contador de voltas mediava mostrava um array.
      voltasMedidas: (estado && estado.voltas && estado.voltas.length) || 0,
      estado: estado || null,
      nivel: a.nivel,
      aviso: a.aviso,
      porVoltas: a.porVoltas,
      porPct: a.porPct,
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
      return vazio(estado, null, pctRestante);
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
      return Object.assign(vazio(novo, null, pctRestante), {
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

    // Sem voltas medidas: 'a medir' para o TEXTO da linha Voltas, mas o
    // AVISO continua a ser calculado. Sao coisas diferentes -- e era
    // aqui que o aviso se perdia, porque esta devolvia um 'vazio' sem
    // olhar para a percentagem.
    if (media == null) {
      return vazio(estado, 'a medir', pctRestante);
    }

    var restantes = litros / media;
    var a = _aviso(estado, pctRestante);

    // Uma media de uma volta e' melhor do que nada, mas e' uma amostra
    // de uma. Diz-se isso em vez de fingir que ja' se mediu o ritmo.
    if (n < MIN_VOLTAS_MEDIA) {
      return {
        valido: true,
        litrosPorVolta: media,
        voltasRestantes: restantes,
        voltasMedidas: n,
        estado: estado,
        nivel: a.nivel,
        aviso: a.aviso,
        porVoltas: a.porVoltas,
        porPct: a.porPct,
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
      nivel: a.nivel,
      aviso: a.aviso,
      porVoltas: a.porVoltas,
      porPct: a.porPct,
      msg: null,
      soUmaVolta: false
    };
  }

  var api = {
    estimarCombustivel: estimarCombustivel,
    nivelDe: nivelDe,
    corDe: corDe,
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
