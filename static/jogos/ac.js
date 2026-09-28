/* O Assetto Corsa, como o painel o ve.
 *
 * PURO. Nenhuma funcao toca no DOM, nenhuma le estado global, todas
 * devolvem um valor ou um objecto pequeno que o `app.js` pinta. E' o que
 * permite correr isto no node e testar as regras do AC sem browser e
 * sem o AC a correr -- ao contrario do `pintarClima` que vivia dentro
 * da IIFE do `app.js`, onde os cortes errados so' se viam no ecra.
 *
 * ---------------------------------------------------------------------------
 * O QUE E' ESPECIFICO DO AC, E PORQUE
 * ---------------------------------------------------------------------------
 * As diferencas que interessam nao' sa' de estilo. Cada uma delas e' um
 * facto medido, e cada uma delas e' o que faz o painel do AC nao poder
 * ser o painel do F1 25 com os numeros trocados:
 *
 *   a embraiagem e' uma FRACAO de 0 a 1, e 1.0 e' EMBRAIADA. A
 *   documentacao oficial diz "Value of clutch pedal: 0 to 1 (fully
 *   pressed)", e isso faz ler "1.0 = o pedal esta' premido" -- que e' o
 *   contrario do que acontece. Medido: fica em 1.0 a conduzir e desce a
 *   ~0,63 a travar forte. E' a EMBRAIAGEM, e nao o pedal.
 *
 *   o ABS e' `tc` sao o NIVEL a que o sistema esta' a trabalhar. Medido
 *   em 4502 amostras de travagens duras e aceleracao a fundo: `abs` em
 *   0,13 e `tc` em 0,08, sem variarem uma unica vez. Por isso o painel
 *   escreve "ABS 13%", que e' a verdade. Um ON/OFF a partir de um
 *   limiar de 0,5 diria ao piloto que nao tinha ABS quando tem 13%.
 *
 *   o `tyreWear` e' 0 a 100, e 100 e' NOVO. Nao e' uma fracao.
 *   Multiplicar por 100 dava 9994%, que foi o que aconteceu.
 *
 *   as tres zonas do pneu (interior, meio, exterior) NAO seguem uma
 *   ordem unica: medido em 4502 amostras, a roda ESQUERDA tem sempre
 *   I < M < O e a DIREITA tem sempre I > M > O, 4502 de 4502. A regra
 *   "interior < meio < exterior" so vale para FL e RL, e nao se usa
 *   para diagnosticar offsets.
 *
 *   o clima nao existe. A pagina de fisica tem 60 campos e sobre o
 *   tempo so' ha' airTemp, roadTemp e airDensity -- contado, nao deduzido.
 *   A chuva vem da API Python dentro do jogo, que so' existe se o Custom
 *   Shaders Patch estiver instalado.
 *
 * ---------------------------------------------------------------------------
 * O QUE NAO ESTA AQUI
 * ---------------------------------------------------------------------------
 * A matematica das voltas e do delta, a vida do pneu a partir do
 * desgaste, e as voltas de combustivel. Sao as MESMAS para os dois
 * jogos e por isso vivem em `nucleo/`. O que muda e' o que se lhes da
 * para comer, e isso e' deste modulo.
 */
(function (global) {
  'use strict';

  const U = global.NucleoUnidades;
  const T = global.Tempo;             // nucleo/tempo.js, a escala do Pure Planner

  /* ==================================================================
   * O CARRO
   * ================================================================== */

  /* A embraiagem. Ver a nota do topo.
   *
   * O painel mostra o INVERSO -- quanto esta' solta -- porque e' isso que
   * interessa para uma ponta de embraiagem e para kicking. Inverter e'
   * JUSTIFICADO por uma medicao, e nao por gosto: numa captura de 4502
   * amostras houve 21 mergulhos maiores que 0,25, e os 21 coincidiram com
   * uma mudanca de caixa, a 96-203 km/h. Se fosse a posicao do pedal,
   * nao teria relacao nenhuma com as mudancas. */
  function embraiagem(d) {
    const v = Number(d.clutchRaw);
    if (!isFinite(v)) return U.Nulo();
    const solta = (1 - v) * 100;
    return { txt: Math.round(solta), pct: U.limita(solta, 0, 100),
             dica: t('ac.embraiagemDica') };
  }

  /* O volante. O AC manda `steerAngle`, que e' um ANGULO EM RADIÃOS, e
   * nada na documentacao diz o limite. O painel usa uma constante
   * propria (o `STEER_REF` do `app.js`) que continua marcada como nao
   * confirmada, e por isso o numero volta SEM percentagem: uma barra
   * cheia a dizer que se esta' a ir para o limite quando o limite nao
   * esta' confirmado seria pior do que nao ter barra.
   *
   * E o `STEER_REF` esta' aqui, e nao no `app.js`, porque e' uma regra
   * do AC. */
  const STEER_REF = 1.0;             // RADIANOS. NAO CONFIRMADO.
  function volante(d) {
    const v = Number(d.steer);
    if (!isFinite(v)) return U.Nulo();
    return { txt: v.toFixed(2), pct: null,
             dica: t('ac.volanteDica') };
  }

  /* O ABS e o TC: o NIVEL, em percentagem. Ver a nota do topo. */
  function nivel(v, dica) {
    const n = Number(v);
    if (v === null || v === undefined || !isFinite(n)) return U.Nulo(dica);
    const pct = n * 100;
    return { txt: Math.round(pct), pct: U.limita(pct, 0, 100), dica: dica };
  }
  function abs(d) { return nivel(d.abs, t('ac.absDica')); }
  function tc(d) { return nivel(d.tc, t('ac.tcDica')); }

  /* ==================================================================
   * DRS
   * ==================================================================
   *
   * Este e' o caso mais delicado dos dois, e a razao de o modulo do AC
   * ter mais codigo de comentario do que de logica.
   *
   * O `drsAvailable` e' um int e diz 1 quando a zona existe -- mas
   * MEDIU-SE DUAS VEZES E AS DUAS DERAM RESPOSTAS DIFERENTES:
   *
   *   num RB21 em Suzuka: 1 em 98,9% do tracado, por igual nos cinco
   *   quintos. A conclusao escrita na altura foi "este flag nao marca a
   *   zona".
   *   num Ferrari SF25 em Interlagos: 1 em 18,5% da volta, em DUAS
   *   zonas contiguas (0-30% e 85-100%), e so' a 262-312 km/h, quase
   *   sempre em 8a ou 9a caixa. Isto e' exactamente a forma de uma zona
   *   de DRS real.
   *
   * Portanto a primeira conclusao estava errada, ou era especifica
   * daquele carro. Um flag medido uma vez, num so' carro, e' uma regra
   * geral que nao existe.
   *
   * O que o modulo faz NAO e' decidir se o flag e' de confianca -- isso
   * e' do `app.js`, que mede a volta e guarda o veredito. O que este
   * modulo faz e' declarar que o veredito e' NECESSARIO, e por isso
   * devolve `vereditoNecessario: true`. Um modulo que devolvesse
   * `confiavel: true` sem medir seria inventar, e o F1 25 nao precisa de
   * nada disso. */
  function drs(d) {
    const disponivel = d.drsAvailable ? 1 : 0;
    const ligado = d.drsEnabled || (d.drs >= 0.5) ? 1 : 0;
    return {
      ligado: ligado,
      disponivel: disponivel,
      txt: ligado ? t('drs.on') : (disponivel ? t('drs.disp') : '--'),
      pct: null,                      // nao ha' percentagem de DRS
      vereditoNecessario: true,        // o app.js mede a volta
      dica: t('ac.drsDica'),
    };
  }

  /* ==================================================================
   * PNEUS
   * ================================================================== */

  /* As tres zonas, na ordem do AC: FL, FR, RL, RR.
   *
   * O AC e' o jogo em que esta ordem ja e' a do painel, por isso aqui
   * nao ha' traducao nenhuma. E o F1 25 e' o que traduz. Ver a Regra
   * no 22. */
  function tempPneu(d) {
    return {
      superficie: arr(d.tyreTempO),     // a "superficie" do AC e' a zona
      interior: arr(d.tyreTempI),
      meio: arr(d.tyreTempM),
      nucleo: arr(d.tyreCore),
    };
  }
  function arr(v) {
    return Array.isArray(v) ? v.slice(0, 4) : [null, null, null, null];
  }

  /* A vida do pneu NAO e' calculada aqui, e essa e' a resposta certa.
   *
   * O AC nao publica a vida do composto. Nem pela memoria partilhada,
   * nem pela API: o enum `CS` do `acsys.py` tem 73 campos e nenhum e' o
   * desgaste, foi contado um a um. A HUD em Lua le-o, mas pela API do
   * objecto carro, que e' OUTRA interface -- e da' ainda um numero
   * diferente, com dez pontos de diferenca medidos lado a lado no mesmo
   * instante.
   *
   * A conta existe e funciona, mas e' do `nucleo/tyres.js` e e'
   * ESTADAVEL: `estimarPneus(estado, dados)` devolve o estado novo, e
   * sem duas voltas medidas nao ha' nada a dizer. Por isso o estado do
   * stint vive em `S.pneuStint`, no `app.js`, e e' o `app.js` que
   * chama:
   *
   *     const r = Pneus.estimarPneus(S.pneuStint, { ... });
   *     S.pneuStint = r.estado;
   *
   * Este modulo e' puro e nao tem estado -- nao tem onde guardar o
   * `estado`, e por isso nao tem como fazer a conta. Logo NAO ha'
   * `vidaPneu` aqui.
   *
   * Havia, e era uma segunda copia do que o `app.js` faz, escrita contra
   * uma API com outro nome -- `vida(wear, sectors)` em vez de
   * `estimarPneus(estado, dados)` -- e outra forma de resposta:
   * `{voltas, pronto}` em vez de `{voltasRestantes, confiavel}`.
   * Duas copias de uma regra divergem em silencio: a Regra nº 19 com
   * outro nome. A segunda estava errada desde que o modulo foi escrito,
   * e nunca chegou a correr, porque o `app.js` nao a chama.
   *
   * O que fica e' a capacidade, declarada abaixo como `auto`: quem
   * decide se mostra e' a interface, e no AC a interface mede. No F1 25
   * o modulo traz o numero do jogo (`m_lifeSpan`) e por isso e' `on`.
   *
   * A funcao fica porque o `nucleo/jogo-base.js` exige que TODOS os
   * modulos a tenham, e um modulo sem ela falha o contrato. Devolve o
   * mesmo que a omissao do contrato devolveria -- e e' de proposito que
   * seja a mesma, e nao um numero: este modulo nao tem onde guardar o
   * estado do stint, e um numero aqui seria inventado. */
  function vidaPneu() {
    return { voltas: null, texto: '--', aMedir: true };
  }

  /* ==================================================================
   * COMBUSTIVEL
   * ================================================================== */

  /* O AC manda LITROS em `fuel`, e o maximo em `maxFuel`. Nao ha'
   * `fuelRemainingLaps`: as voltas que faltam sao estimadas a partir de
   * duas leituras do deposito, e o numero so' aparece depois disso.
   *
   * A UNIDADE NAO SE CONVERTE. Um F1 25 a 42,5 quilos e' 45 litros, e
   * escrever "42,5 L" seria um numero plausivel e errado -- que e' o
   * pior resultado possivel, porque ninguem o questiona. Ver a
   * `AGENTS.md`, Regra no 8. */
  function combustivel(d) {
    const atual = Number(d.fuelL);
    const max = Number(d.maxFuelL);
    if (!isFinite(atual) || !isFinite(max) || max <= 0) {
      return { txt: '--', pct: null, laps: '--', unidade: 'L' };
    }
    const pct = atual / max * 100;
    return {
      txt: atual.toFixed(1),
      pct: U.limita(pct, 0, 100),
      laps: d.fuelLaps || '--',
      unidade: 'L',
      dica: t('ac.combustivelDica'),
    };
  }

  /* ==================================================================
   * O TEMPO
   * ================================================================== */

  /* O AC nao publica chuva nem estado do ceu. Isto foi CONTADO: sao 60
   * campos na pagina de fisica, e sobre o tempo so' ha' `airTemp`,
   * `roadTemp` e `airDensity`. Regra no 15: uma lista de campos que
   * escreveste prova o que tem, nunca o que nao tem -- e por isso a
   * ausencia foi verificada de outra maneira, com o `tests/chuva.py`, que
   * muda o tempo e ve o que aparece.
   *
   * O que o AC tem e' o EFEITO: a aderencia desce quando esta molhado.
   * E e' por isso que o painel do AC tem de mostrar uma ESTIMATIVA
   * enquanto o F1 25 mostra o numero.
   *
   * A chuva que o painel mostra vem da API Python dentro do jogo, via
   * `ac.ext_rainParams()`, e so' existe se o Custom Shaders Patch
   * estiver instalado. Quando nao existe, a app publica -1, e -1 e'
   * "nao se sabe" e nao "seco". */
  function clima(d) {
    const chuvaBruta = Number(d.rainAmount);
    const grip = Number(d.surfaceGrip);
    /* A chuva do AC e' uma FRACCAO de 0 a 1, e o valor de "nao se sabe"
     * e' -1 e nao `null`: a app dentro do jogo publica -1, e mudar isso
     * para `null` no caminho seria trocar uma sentinela que o AC ja
     * publication por outra.
     *
     * A razao do -1 e' a Regra no 19. `ac.ext_rainParams()` so' existe
     * se o Custom Shaders Patch estiver instalado, e sem ela nao ha' o
     * que chamar. A alternativa -- publicar 0 -- seria escrever "nao
     * chove" sempre que a funcao nao existe, e o painel mostrava "seco"
     * com o carro parado num garage, a chover, ou sem Custom Shaders
     * Patch, e as tres coisas eram o mesmo ecra.
     *
     * Por isso o negativo vira `null` AQUI, na fronteira, e o painel
     * nunca ve um -1. */
    const semChuva = !(isFinite(chuvaBruta)) || chuvaBruta < 0;
    return {
      ar: Number.isFinite(Number(d.airTemp)) ? d.airTemp : null,
      pista: Number.isFinite(Number(d.roadTemp)) ? d.roadTemp : null,
      // m/s. A documentacao oficial do ACC concorda, e o numero certo
      // com a unidade errada e' um factor de 3,6 que ninguem nota.
      vento: Number.isFinite(Number(d.windSpeed)) ? d.windSpeed : null,
      ventoUnidade: 'm/s',
      chuva: semChuva ? null : chuvaBruta,
      chuvaNegativa: semChuva,             // o painel pinta a neutro
      densidade: Number.isFinite(Number(d.airDensity)) ? d.airDensity : null,
      // O `surfaceGrip` e' 0 quando o jogo esta' PARADO -- no menu, ou
      // numa pagina que ninguem escreve. A aderencia real nunca e'
      // exactamente 0. E o 0 e' o pior resultado possivel, porque e'
      // plausivel: uma barra a vermelho abaixo de 0,85 com um "0.00"
      // ao lado diz ao piloto que o carro esta' sobre gelo. Medido numa
      // sessao parada: `surfaceGrip 0` com o carro no Nordschleife a
      // tracao e os pneus a 39-42 graus.
      grip: grip > 0 ? grip : null,
      gripDesconhecido: !(grip > 0),
      // A ESCALA do Pure Planner. Vive no `nucleo/tempo.js` porque e' uma
      // TABELA -- os valores que o jogo usa -- e nao uma regra deste
      // jogo. A DECISAO de a usar e' que e' do AC, e e' a funcao
      // `cenaDeChuva` logo abaixo.
      cenaDeChuva: cenaDeChuva,
    };
  }

  /* A cena do tempo, a partir das duas fontes que o AC tem.
   *
   * A chuva vem da API e a escala vem das 37 cenas do Pure Planner. Sao
   * 37 cenas e DOZE delas tem chuva zero, em que com so' a chuva o
   * painel dizia "seco" a todas. Das doze, uma se distingue: `windy`,
   * com vento 50. As outras diferenciam-se por `humidity`, `mist` e
   * `sun`, que NAO estao na memoria partilhada.
   *
   * E o `m_rainPercentage` do F1 25 nao entra aqui, porque este modulo
   * e' do AC e o AC nao tem esse campo. */
  function cenaDeChuva(d) {
    if (!T) return null;
    const chuva = Number(d.rainAmount);
    const vento = Number(d.windSpeedApi);
    if (!isFinite(chuva) || chuva < 0) return null;
    return T.cenaDe(chuva, isFinite(vento) ? vento : 0);
  }

  /* ==================================================================
   * VOLTAS
   * ================================================================== */

  /* O delta do AC tem de ser CALCULADO, porque o AC nao manda delta
   * para ninguem. O calculo e' do `nucleo/tempos.js`, e a referencia
   * vive no `app.js` -- que e' quem a vai medindo volta a volta. Aqui
   * limita-se a dizer que o numero e' em SEGUNDOS e que null e' "nao se
   * sabe". */
  function delta(segundos) {
    if (segundos === null || segundos === undefined) return null;
    const n = Number(segundos);
    return isFinite(n) ? n : null;
  }

  /* ==================================================================
   * AS CAPACIDADES
   * ==================================================================
   *
   * As MESMAS 81 chaves que o servidor manda em `/api/capabilities`, e
   * com os mesmos valores. A lista canonica esta' em
   * `actelemetry/jogos/base.py`, e o `test_f125_parser.py` confere o
   * lado do servidor. Este lado e' conferido pelo `test_jogos.js`.
   *
   * Duas listas em vez de uma e' de proposito: o servidor sabe o que o
   * jogo PUBLICA, e isto sabe o que o painel sabe PINTAR. Um dado que o
   * jogo publica e que o painel nao sabe mostrar nao e' um cartao
   * escondivel, e' um botao por fazer. */
  const CAPACIDADES = {
    /* o carro */
    velocidade: 'on', caixa: 'on', rpm: 'on', pedais: 'on', embraiagem: 'on',
    volante: 'auto', luzesRotacao: 'off', caixaSugerida: 'off',
    /* energia */
    ers: 'on', ersJoules: 'off', ersQuilojoules: 'on', ersRecuperacao: 'on',
    potenciaWatts: 'off', turbo: 'on', combustivel: 'on', consumoMedia: 'off',
    balastro: 'on', limitador: 'on',
    /* DRS */
    drs: 'on', drsDistancia: 'off', zonasDrs: 'auto', assistencias: 'off',
    /* pneus */
    pneus: 'on', tempPneuZonas: 'on', tempPneuDuas: 'off',
    tempNucleoPneu: 'on', pressaoPneu: 'on', vidaPneu: 'auto',
    idadePneu: 'off', bolhas: 'off', pneuSujo: 'on', compoundId: 'off',
    compoundActual: 'off', compoundTexto: 'on', pneusDisponiveis: 'off',
    /* travões e danos */
    'travões': 'on', danos: 'on', danoSuspensao: 'on', asa: 'off',
    componentesMotor: 'off', biasTrava: 'on', nivelAbs: 'on', nivelTc: 'on',
    absOnOff: 'off', tcModo: 'off',
    /* física */
    gLateral: 'on', gRelativo: 'on', escorregamentoRatio: 'off',
    escorregamentoAngulo: 'off', anguloRoda: 'off', forcasRoda: 'off',
    camber: 'off', rideHeight: 'on', cgHeight: 'on', finalFF: 'on',
    /* o mundo */
    mapa: 'on', mapaFicheiro: 'on', spline: 'on', sectorCount: 'on',
    superficieRoda: 'off', aderencia: 'on',
    /* o tempo */
    tempo: 'off', estadoTempo: 'off', chuva: 'auto', previsao: 'off',
    densidadeAr: 'on', ventoVelocidade: 'on', ventoDireccao: 'auto',
    /* a sessao */
    voltas: 'on', setores: 'on', deltaJogo: 'off', deltaLider: 'off',
    posicao: 'on', posicaoAoVivo: 'on', classificacao: 'on',
    penalidadeTipo: 'off', safetyCar: 'off', setup: 'off',
    coloridaLivery: 'off', bandeiras: 'on', 'travãoDeMão': 'off',
  };

  /* A traducao. Este modulo e' puro e nao pode chamar a funcao `t()` do
   * `app.js` sem criar uma dependencia circular, e sem DOM nao ha' onde
   * ler as traducoes. As dicas vao por uma MESMA chave, que o `app.js`
   * passa ao montar o objecto. Ver `app.js`, `JogoAtual.dica()`. */
  function t(chave) { return chave; }

  global.JogoAC = {
    id: 'ac',
    nome: 'Assetto Corsa',
    capacidades: function () { return CAPACIDADES; },
    embraiagem: embraiagem,
    volante: volante,
    abs: abs,
    tc: tc,
    drs: drs,
    vidaPneu: vidaPneu,
    tempPneu: tempPneu,
    combustivel: combustivel,
    clima: clima,
    delta: delta,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
