/* O F1 25, como o painel o ve.
 *
 * PURO, como o modulo do AC. Nenhuma funcao toca no DOM, e por isso
 * corre no node e as regras testam-se sem browser e sem o jogo a correr.
 *
 * ---------------------------------------------------------------------------
 * AS DIFERENCAS QUE IMPORTAM
 * ---------------------------------------------------------------------------
 * Este jogo da MUITO mais do que o AC, e o que segue sao as diferencas
 * em que o painel fica MELHOR e nao so' diferente. Cada uma delas e' um
 * facto da documentacao da EA ou uma medicao, e nenhuma foi escolhida
 * porque ficava mais bonita:
 *
 *   a embraiagem e' uma PERCENTAGEM de 0 a 100, e nao uma fracao de 0 a
 *   1. O sentido e' o mesmo nos dois jogos (100 = embraiada), a escala
 *   nao. Um painel que mostrava "8" com o AC tem de mostrar "8" e nao
 *   "0,08" com o F1.
 *
 *   o volante vem NORMALIZADO, de -1 a 1, com o limite escrito na
 *   documentacao. O AC da' um angulo em radianos sem escala conhecida, e
 *   o painel do AC tem de usar uma constante adivinhada. Aqui nao ha' o
 *   que adivinhar, e por isso o `pct` enche-se.
 *
 *   o ABS e' um 0 ou 1 e o TC e' um MODO (0 off, 1 medio, 2 cheio). NAO
 *   ha' percentagem. O AC da' o nivel a que o sistema esta' a trabalhar
 *   e mediu-se 0,13 durante 4502 amostras de travagens duras -- ali a
 *   percentagem e' a verdade, e aqui nao ha' nada para mostrar. Por isso
 *   `txt` se preenche e `pct` fica a null: uma barra a 100% seria um
 *   numero que o jogo nao da.
 *
 *   o DRS e' um dado a serio: `drsAllowed` e' um 0/1 e
 *   `drsActivationDistance` e' os METROS que faltam. O AC da' dois flags
 *   que mediram 98,9% e 18,5% em dois carros diferentes, e o painel teve
 *   de conduzir uma volta inteira para decidir se eram de confianca. Aqui
 *   nao ha' duvida, e por isso `vereditoNecessario` e' FALSE.
 *
 *   a VIDA DO PNEU e' lida. O `lifeSpan` do pacote Tyre Sets e' o numero
 *   de voltas que faltam, e e' a diferenca mais grande entre os dois
 *   paineis: no AC este numero nao existe e e' estimado a partir de duas
 *   voltas medidas de desgaste, e o piloto decide a estrategia com ele.
 *
 *   o clima e' lido. `m_weather`, as temperaturas, e uma previsao de 64
 *   amostras com a chuva em percentagem. O AC nao publica nada disso.
 *
 *   o DELTA vem do jogo. O AC nao manda delta para ninguem e o painel
 *   calcula-o contra uma volta gravada, que e' mais trabalho e menos
 *   precisa. Aqui e' o numero que o jogo tem.
 *
 * ---------------------------------------------------------------------------
 * A ORDEM DAS RODAS, E O ERGO QUE MAIS CUSTA
 * ---------------------------------------------------------------------------
 * O F1 25 manda TODOS os arrays de quatro nesta ordem:
 *
 *     0 = RL   1 = RR   2 = FL   3 = FR
 *
 * E o AC usa FL, FR, RL, RR, que e' a ordem interna do painel.
 *
 * A traducao acontece AQUI, uma vez, e nunca dentro da logica de
 * desenho. As duas ordens desenham uma grelha 2x2 quase simetrica, e um
 * painel ao contrario nao da erro nenhum -- descobre-se a conduzir, a
 * comparar com o carro, e depois de estragar um stint. E' a Regra no 22
 * do `docs/f1-25.md`, e a razao de cada teste deste modulo poe um valor
 * DIFERENTE em cada canto: com os quatro iguais, uma ordem errada e'
 * indistinguivel de uma ordem certa, e o teste passaria.
 */
(function (global) {
  'use strict';

  const U = global.NucleoUnidades;

  /* A traducao da ordem do jogo para a ordem do painel.
   *
   *     indice no jogo (RL RR FL FR)  ->  indice no painel (FL FR RL RR)
   *
   * Escrita como uma tabela e nao como contas, porque uma conta seria
   * um sitio onde se pode errar a ordem duas vezes. E `Object.freeze`,
   * porque um array que alguem muda em silencio e' uma regra que deixa
   * de valer sem ninguem dar conta. */
  const TRADUCAO = Object.freeze([2, 3, 0, 1]);
  const ORDEM = Object.freeze(['FL', 'FR', 'RL', 'RR']);

  /* Um array de quatro do jogo, na ordem do painel.
   *
   * E' a UNICA funcao deste modulo que sabe qual e' a ordem, e por isso
   * e' a unica a poder ser corrida por qualquer lado: temperatura,
   * pressao, desgaste, dano, bolhas, forcas, camber, escorregamento.
   * Passar o array ja traduzido e' o que garante que nao ha' um segundo
   * sitio a fazer a traducao. */
  function quatroDa(v) {
    const saida = [null, null, null, null];
    if (!Array.isArray(v)) return saida;
    for (let i = 0; i < 4; i++) {
      const v2 = v[i];
      saida[TRADUCAO[i]] = (v2 === undefined || v2 === null) ? null : v2;
    }
    return saida;
  }

  /* ==================================================================
   * O CARRO
   * ================================================================== */

  /* A embraiagem: 0 a 100, e o painel mostra o inverso como no AC.
   *
   * O sentido e' o mesmo nos dois jogos -- 100 e' EMBRAIADA --, e por isso
   * a conta e' a mesma. O que muda e' a escala de entrada, e e' por isso
   * que a divisao por 100 esta' aqui e nao no `app.js`: se estivesse la,
   * trocar de jogo seria trocar um factor de 100 em silencio. */
  function embraiagem(d) {
    const v = Number(d.clutchRaw);
    if (!isFinite(v)) return U.Nulo();
    const solta = 100 - v;
    return { txt: Math.round(solta), pct: U.limita(solta, 0, 100),
             dica: 'f1.embraiagemDica' };
  }

  /* O volante: -1 a 1, normalizado, com o limite na documentacao.
   *
   * O `pct` enche-se aqui e so' aqui. No AC nao se pode, porque o limite
   * nao esta escrito em lado nenhum -- e uma barra a dizer "100% do
   * limite" com um limite inventado seria uma barra que mente sobre a
   * unica coisa que um piloto quer saber a meio de uma curva. */
  function volante(d) {
    const v = Number(d.steer);
    if (!isFinite(v)) return U.Nulo();
    const pct = Math.abs(v) * 100;
    return { txt: v.toFixed(2), pct: U.limita(pct, 0, 100),
             dica: 'f1.volanteDica' };
  }

  /* O ABS: ligado ou desligado, e NAO uma percentagem.
   *
   * `m_antiLockBrakes` e' um uint8 que e' 0 ou 1. Escrever "ABS 100%"
   * seria inventar um numero que o jogo nao da, e o AC mostra "ABS 13%"
   * porque ali `abs` e' o nivel. Sao dois paineis com a mesma pintura e
   * numeros de coisas diferentes, e e' por isso que o texto e' separado
   * da percentagem. */
  function abs(d) {
    const v = d.absOnOff;
    if (v === null || v === undefined) return U.Nulo();
    return { txt: v ? 'ABS' : t('abs.off'), pct: null, dica: 'f1.absDica' };
  }

  /* O TC: um MODO, nao uma percentagem. 0 off, 1 medio, 2 cheio.
   *
   * O valor e' a CHAVE de traducao e nao o texto, pelas mesmas razoes
   * que o ABS: um modulo puro nao pode chamar a funcao de traducoes do
   * `app.js` sem uma dependencia circular. E por isso que o `off` e' a
   * MESMA chave que o do ABS -- "desligado" e' "desligado", e escrever
   * duas chaves para a mesma palavra e' como uma delas fica por
   * traduzir. */
  const TC_MODO = { 0: 'abs.off', 1: 'f1.tcMedio', 2: 'f1.tcCheio' };
  function tc(d) {
    const v = d.tcModo;
    if (v === null || v === undefined) return U.Nulo();
    return { txt: TC_MODO[v] || t('abs.off'), pct: null, dica: 'f1.tcDica' };
  }

  /* ==================================================================
   * DRS
   * ==================================================================
   *
   * O F1 25 da' o que o AC nao da: os METROS que faltam para a zona.
   *
   * E' a razao de `vereditoNecessario` ser FALSE aqui e TRUE no AC. No
   * AC, o `drsAvailable` mediu 98,9% num carro e 18,5% noutro, e o
   * painel teve de conduzir uma volta para decidir. Aqui o jogo diz
   * "faltam 340 metros", e nao ha' o que decidir.
   *
   * O `dica` leva os metros, e e' o que o painel mostra ao lado da luz
   * quando a zona existe e ainda nao foi ligado -- que e' o momento em
   * que o numero e' util. */
  function drs(d) {
    const disponivel = d.drsAvailable ? 1 : 0;
    const ligado = d.drsEnabled ? 1 : 0;
    let txt = '--';
    if (ligado) txt = t('drs.on');
    else if (disponivel) {
      const m = Number(d.drsDistancia);
      txt = isFinite(m) && m > 0 ? (Math.round(m) + ' m') : t('drs.disp');
    }
    return {
      ligado: ligado,
      disponivel: disponivel,
      txt: txt,
      pct: null,
      vereditoNecessario: false,       // o jogo diz, e' para confiar
      dica: 'f1.drsDica',
    };
  }

  /* ==================================================================
   * PNEUS
   * ================================================================== */

  /* As DUAS zonas do F1 25: superficie e interior. O AC tem TRES
   * (interior, meio, exterior) e sao coisas diferentes -- nao e' melhor
   * nem pior. */
  function tempPneu(d) {
    return {
      superficie: quatroDa(d.tyreTempSurface),
      interior: quatroDa(d.tyreTempInner),
      meio: null,                 // nao existe no F1 25
      nucleo: null,               // nao existe no F1 25
    };
  }

  /* A VIDA DO PNEU: O NUMERO.
   *
   * `m_tyresAgeLaps` e' a idade do stint e `lifeSpan` (do pacote Tyre
   * Sets) e' as VOLTAS QUE FALTAM. Este e' o numero de que o piloto
   * precisa para a estrategia, e no AC nao existe de forma nenhuma -- nem
   * pela memoria partilhada, nem pela API, cujo enum de 73 campos nao
   * tem o desgaste.
   *
   * `aMedir` e' FALSE sempre, e a diferenca em relacao ao AC e' o
   * resumo de tudo o que este par de ficheiros diz. */
  function vidaPneu(d) {
    const faltam = d.tyreAge;
    const max = d.tyreLifeMax;
    if (faltam === null || faltam === undefined) {
      return { voltas: null, texto: '--', aMedir: false,
               dica: 'f1.vidaSemDados' };
    }
    let texto = String(faltam);
    if (max) texto += ' / ' + max;
    return {
      voltas: faltam,
      texto: texto,
      aMedir: false,          // lido, nunca estimado
      dica: max ? 'f1.vidaDica' : '',
    };
  }

  /* ==================================================================
   * COMBUSTIVEL
   * ================================================================== */

  /* O F1 25 manda QUILOGRAMAS, e o AC manda LITROS. A 42,5 quilos sao
   * uns 45 litros, e escrever "42,5 L" seria um numero plausivel e
   * errado -- o pior resultado possivel, porque ninguem o questiona.
   * Por isso a unidade vai no texto e nao se converte.
   *
   * E ha' uma vantagem que o AC nao tem: `m_fuelRemainingLaps` e' o
   * numero que o MFD DO JOGO mostra. No AC as voltas que faltam sao
   * estimadas a partir de duas leituras do deposito. */
  function combustivel(d) {
    const atual = Number(d.fuelKg);
    const max = Number(d.maxFuelKg);
    const laps = d.fuelLaps;
    if (!isFinite(atual) || !isFinite(max) || max <= 0) {
      return { txt: '--', pct: null, laps: (laps == null ? '--' : laps),
               unidade: 'kg' };
    }
    const pct = atual / max * 100;
    return {
      txt: atual.toFixed(1),
      pct: U.limita(pct, 0, 100),
      laps: (laps == null) ? '--' : laps,
      unidade: 'kg',
      dica: 'f1.combustivelDica',
    };
  }

  /* ==================================================================
   * O TEMPO
   * ================================================================== */

  /* O F1 25 PUBLICA o tempo, e o AC nao. E' a diferenca que mais se ve
   * no ecra: aqui ha' um estado do ceu, uma previsao, e a percentagem
   * de chuva, e no AC o painel tem de deduzir a chuva de uma
   * aderencia que desce.
   *
   * A chuva vem de `m_rainPercentage` na amostra de previsao com
   * `minutes == 0`, que e' o "agora". Sem essa amostra, o valor e' null
   * e o painel pinta a neutro -- um zero seria "nao chove", e nao chove
   * nao e' o mesmo que nao se saber. */
  function clima(d) {
    const prev = Array.isArray(d.previsao) ? d.previsao : [];
    let chuva = null;
    for (let i = 0; i < prev.length; i++) {
      if (prev[i] && prev[i].minutos === 0) { chuva = prev[i].chuva; break; }
    }
    return {
      ar: (d.airTemp === null || d.airTemp === undefined) ? null : d.airTemp,
      pista: (d.trackTemp === null || d.trackTemp === undefined) ? null : d.trackTemp,
      vento: null,                       // o F1 25 nao publica vento
      ventoUnidade: null,
      chuva: (chuva === null || chuva === undefined) ? null : chuva,
      chuvaNegativa: false,              // a chuva e' um numero, nao -1
      estado: d.weatherNome || null,      // "CHUVA FRACA", seis estados
      previsao: prev,
      densidade: null,                   // o F1 25 nao publica arDensity
      // O `surfaceType` e' MELHOR do que o `surfaceGrip` do AC: diz o que
      // a roda tocou, em vez de estimar a aderencia. E o 8 e' AGUA, que
      // num F1 e' um safety car -- o painel pode dizer isso em vez de
      // desenhar uma barra a zero que ninguem questiona.
      superficie: Array.isArray(d.surfaceNames) ? d.surfaceNames.slice(0, 4) : null,
      grip: null,                        // nao ha' surfaceGrip neste jogo
      gripDesconhecido: true,
      // O escorregamento e' o indice de aderencia de verdade, e vem do
      // Motion Ex. O `wheelSlip` do AC e' uma percentagem, que e' outra
      // coisa, e comparar os dois numeros seria comparar coisas
      // diferentes.
      escorregamentoRatio: d.slipRatio || null,
      escorregamentoAngulo: d.slipAngle || null,
      cenaDeChuva: null,                 // nao ha' Pure Planner no F1 25
    };
  }

  /* ==================================================================
   * VOLTAS E DELTA
   * ================================================================== */

  /* O delta vem DO JOGO: `m_deltaToCarInFront` e `m_deltaToRaceLeader`,
   * em milissegundos, ja positivos quando se esta' atrasado.
   *
   * O receptor ja os converteu de "milissegundos + parte dos minutos"
   * para milissegundos, e o `nucleo/unidades.js` converte para segundos
   * com sinal. O AC nao tem nada disto: o `app.js` calcula o delta contra
   * uma volta de referencia, e e' por isso que la `deltaJogo` esta' a
   * "off".
   *
   * O zero e' um caso a parte: zero e' "estamos exactamente tao rapido
   * quanto quem esta' a frente", e `null` e' "nao se sabe". Sao coisas
   * diferentes e nao se escrevem igual. */
  function delta(d) {
    const v = d.deltaJogo;
    if (v === null || v === undefined || v === 0) return null;
    return U.deltaSeg(v);
  }

  /* O delta para o lider, a parte de cima. Mesmo treatment. */
  function deltaLider(d) {
    const v = d.deltaLider;
    if (v === null || v === undefined || v === 0) return null;
    return U.deltaSeg(v);
  }

  /* ==================================================================
   * AS CAPACIDADES
   * ==================================================================
   *
   * As MESMAS 81 chaves que o `jogos/ac.js`, com os mesmos valores que
   * o servidor manda em `/api/capabilities`. A lista canonica esta' em
   * `actelemetry/jogos/base.py`; os dois lados sao conferidos, e e'
   * por isso que nao se escreve um `<div>` condicional no HTML para cada
   * caso: um cartao escondido por uma regra escrita no sitio errado e'
   * um cartao que aparece vazio. */
  const CAPACIDADES = {
    /* o carro */
    velocidade: 'on', caixa: 'on', rpm: 'on', pedais: 'on', embraiagem: 'on',
    volante: 'on', luzesRotacao: 'on', caixaSugerida: 'on',
    /* energia */
    ers: 'on', ersJoules: 'on', ersQuilojoules: 'off', ersRecuperacao: 'on',
    potenciaWatts: 'on', turbo: 'off', combustivel: 'on', consumoMedia: 'on',
    balastro: 'on', limitador: 'on',
    /* DRS */
    drs: 'on', drsDistancia: 'on', zonasDrs: 'on', assistencias: 'on',
    /* pneus */
    pneus: 'on', tempPneuZonas: 'off', tempPneuDuas: 'on',
    tempNucleoPneu: 'off', pressaoPneu: 'on', vidaPneu: 'on',
    idadePneu: 'on', bolhas: 'on', pneuSujo: 'off', compoundId: 'on',
    compoundActual: 'on', compoundTexto: 'off', pneusDisponiveis: 'on',
    /* travões e danos */
    'travões': 'on', danos: 'on', danoSuspensao: 'on', asa: 'on',
    componentesMotor: 'on', biasTrava: 'on', nivelAbs: 'off', nivelTc: 'off',
    absOnOff: 'on', tcModo: 'on',
    /* física */
    gLateral: 'on', gRelativo: 'on', escorregamentoRatio: 'on',
    escorregamentoAngulo: 'on', anguloRoda: 'on', forcasRoda: 'on',
    camber: 'on', rideHeight: 'on', cgHeight: 'on', finalFF: 'off',
    /* o mundo */
    mapa: 'on', mapaFicheiro: 'off', spline: 'on', sectorCount: 'on',
    superficieRoda: 'on', aderencia: 'on',
    /* o tempo */
    tempo: 'on', estadoTempo: 'on', chuva: 'on', previsao: 'on',
    densidadeAr: 'off', ventoVelocidade: 'off', ventoDireccao: 'off',
    /* a sessao */
    voltas: 'on', setores: 'on', deltaJogo: 'on', deltaLider: 'on',
    posicao: 'on', posicaoAoVivo: 'off', classificacao: 'on',
    penalidadeTipo: 'on', safetyCar: 'on', setup: 'on', coloridaLivery: 'on',
    bandeiras: 'on', 'travãoDeMão': 'off',
  };

  /* As traducoes nao estao aqui: este modulo e' puro e nao pode chamar a
   * funcao `t()` do `app.js` sem uma dependencia circular. As dicas vao
   * por CHAVE, e o `app.js` traduz na hora de as pintar. */
  function t(chave) { return chave; }

  global.JogoF125 = {
    id: 'f125',
    nome: 'F1 25',
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
    deltaLider: deltaLider,
    /* Exposto para o teste. A ordem das rodas e' a coisa que este par
     * de ficheiros tem de provar, e a razao de ela ser exportada e'
     * poder ser testada directamente em vez de se ver o resultado no
     * ecra. */
    _traducao: TRADUCAO,
    _ordem: ORDEM,
    _quatro: quatroDa,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
