/* ===========================================================================
 * defs.js — as DEFINIÇÕES, declaradas uma vez cada uma.
 *
 * PURO. Sem DOM, sem localStorage, sem nada de fora. E' por isso que corre
 * no node e se testa sozinho, ao contrario do resto do `app.js`, que vive
 * dentro de uma IIFE de 3000 linhas.
 *
 * ---------------------------------------------------------------------------
 * PORQUE ISTO EXISTE
 *
 * Antes de haver esquema, cada definição vivia em seis sítios ao mesmo
 * tempo, e três deles falhavam em silêncio se os esquecesses:
 *
 *     static/index.html   a marcação do botão
 *     static/app.js:391   a linha no DEFAULTS
 *     static/app.js:1909  a linha no syncSettingsUI()
 *     static/app.js:2047  o handler do clique
 *     static/app.js       as leituras de DEF.<chave> pelo painel
 *     static/app.js       as traduções, em quatro idiomas
 *
 * E o `loadDef` era isto:
 *
 *     DEF = Object.assign({}, DEFAULTS, JSON.parse(raw));
 *
 * Que aceita o que vier. Medido, no browser, com valores inventados:
 *
 *     temp: 'banana'    -> o painel fica em Celsius, sem dizer nada
 *     speed: 'knots'    -> o painel fica em km/h, sem dizer nada
 *     lang: 'fr'        -> cai para portugues, com aviso (isto simTratado)
 *     chaveInventada:42 -> sobrevive, e volta a ser gravada em cada save
 *
 * Um utilizador que escolha uma opção e ela não mude de nada não tem
 * como saber que o valor não foi aceite. Aqui isso não é possível: o que
 * não está declarado não entra.
 *
 * ---------------------------------------------------------------------------
 * OS TIPOS
 *
 * `enum`   um valor de uma lista. O `data-v` do botão é o valor.
 * `bool`   um interruptor. Vale `true`/`false`; nada mais.
 * `acao`   um botão que NÃO guarda nada — limpar o mapa, marcar a zona de
 *          DRS. Entra no esquema porque a gaveta vai ser gerada a partir
 *          dele, e um botão sem esquema é um botão que ninguém encontra
 *          quando se acrescentar outro.
 *
 * Não há tipo "número livre" nem "texto livre", por decisão: um número
 * que se escreve livre é uma fonte de valores absurdos, e o que se
 * quer mais do que quatro valores faz-se com um `enum` de numeros. A
 * lista de valores do `fps` é `[10, 20, 30, 60]` e o `data-v` é texto,
 * por isso a leitura converte — ver `normalizar()`.
 *
 * ---------------------------------------------------------------------------
 * CADA DEFINIÇÃO PODE TRAZER
 *
 *   omissao   o valor quando não há nenhum. OBRIGATÓRIO.
 *   rotulo    a chave de tradução do nome. OBRIGATÓRIO.
 *   nota      a chave de tradução de uma frase de ajuda, se a houver.
 *   grupo     a secção da gaveta. OBRIGATÓRIO.
 *   ordem     dentro do grupo. OBRIGATÓRIO.
 *   manterNoReset  se a reposição de predefinições deixa esta intacta.
 *   migrar    normaliza o valor guardado, antes da validação. É para
 *             quando o SIGNIFICADO muda e o valor antigo tem de ser
 *             lido de outra maneira — renomear um valor, trocar 'psi'
 *             por 'PSI'. Ver o comentário de `normalizar()`.
 *   unidade   para as que têm conversão. Ver UNIDADES, mais abaixo.
 *
 * ---------------------------------------------------------------------------
 * UNIDADES: NÚMERO E ETIQUETA JUNTOS
 *
 * Havia um bug, medido no browser, antes disto:
 *
 *     Celsius     AR: 20°C    PISTA: 25°C    PNEU: 24°C
 *     Fahrenheit  AR: 68°C    PISTA: 77°C    PNEU: 75°F
 *
 * O número estava certo e a etiqueta errada. A causa: os
 * `<i data-i18n="unit.c">` da carta do clima são preenchidos pelo
 * `applyLang()` com a tradução literal, e nada os trocava. Os pneus
 * escapavam porque são escritos em JS com `unidadeTemp()`.
 *
 * Por isso a conversão mora AQUI, e não no painel: `Defs.apresentar()`
 * devolve o número JÁ convertido e a etiqueta correspondente, e o painel
 * escreve os dois. Não há caminho em que um mude e o outro não, porque
 * não há duas funções que decidir em separado.
 *
 * ---------------------------------------------------------------------------
 * A UNIDADE QUE O JOGO MANDA VEM DO MÓDULO DO JOGO
 *
 * Duas definições dependem do jogo, e a razão delas é a mais importante
 * do projecto:
 *
 *     combustível   o AC publica LITROS. O F1 25 publica QUILOS.
 *     vento         o AC publica m/s. O F1 25 não publica vento.
 *
 * Quilos e litros não são a mesma grandeza, e convertê-los exigiria uma
 * densidade — a do combustível, que muda com a temperatura e com a
 * mistura. Escolher 42,5 kg e escrever "42,5 L" é o número plausível e
 * errado, que é o pior resultado possível (Regra nº 24). E um F1 25 sem
 * vento não tem o que converter: oferecer m/s e km/h para um número que
 * nunca chega é oferecer uma opção que não muda nada.
 *
 * Então quem decide é o MÓDULO DO JOGO, e diz de forma **estática**:
 *
 *     global.JogoAC.UNIDADES   = { fuel: 'L',  vento: 'ms'  }
 *     global.JogoF125.UNIDADES = { fuel: 'kg', vento: null }
 *
 * Estática, e não tirada de uma medição, porque as definições são
 * validadas no arranque — antes de haver um único packet. Uma unidade que
 * só se sabe depois de o jogo começar não serve para validar o que está
 * guardado.
 *
 * O que este esquema sabe, e é tudo o que lhe compete, são FACTOS SOBRE
 * UNIDADES — e factos não são do jogo:
 *
 *     L   e gal   são a mesma grandeza. 1 galão imperial = 4,54609 L.
 *     kg  e lb    são a mesma grandeza. 1 libra = 0,45359237 kg.
 *     L   e kg    NÃO são a mesma grandeza, e por isso nunca se cruzam.
 *
 * Daí a lista de valores de cada opção não se escreve: deriva-se. A base
 * que o jogo manda é o primeiro valor, e as alternativas são as que a
 * tabela diz serem da mesma grandeza. Se um dia o AC passar a publicar
 * BTU, o esquema não tem lista nenhuma para actualizar — tem uma entrada
 * nova, e é o módulo do AC que muda.
 */
(function (root) {
  'use strict';

  /* Um interruptor: cada um com o seu valor. São dois botões e não um
   * `seg` porque não são escolha única — podem os dois estar ligada. */
  function onOff(valor, sim, nao) {
    return [
      { valor: sim, rotulo: 'sim' },
      { valor: nao, rotulo: nao === 'off' ? 'esconder' : nao }
    ];
  }

  /* ---------------------------------------------------------------------
   * FACTOS SOBRE UNIDADES
   *
   * Não é uma lista de opções, e essa é a diferença que importa. Uma
   * lista de opções diz "para este jogo valem estas"; isto diz "estas
   * grandezas são a mesma, e por que factor". A primeira tem de ser
   * mantida quando um jogo muda; a segunda só cresce.
   *
   * `fator` multiplica o número que está NA BASE para ficar na unidade de
   * destino. O caminho inverso é o mesmo factor à potência de menos um, e
   * por isso cada entrada escreve só um factor e não dois.
   *
   * `casas` são as casas decimais de CADA unidade deste par, e não são
   * simétricas: 20,0 L em galões são 4,4, e três algarismos que não
   * existem são três algarismos que a régua do depósito obriga a escrever.
   *
   * Não há entrada de `L` contra `kg`, e é de propósito: não são a mesma
   * grandeza. Quem a acrescentasse estaria a inventar uma densidade.
   * ------------------------------------------------------------------- */
  var UNIDADES = {
    L:   { rotulo: 'L',    casas: 1, para: [{ unidade: 'gal', fator: 1 / 4.54609,     casas: 2 }] },
    gal: { rotulo: 'gal',  casas: 2, para: [{ unidade: 'L',   fator: 4.54609,       casas: 1 }] },
    kg:  { rotulo: 'kg',   casas: 1, para: [{ unidade: 'lb',  fator: 2.2046226,    casas: 2 }] },
    lb:  { rotulo: 'lb',   casas: 2, para: [{ unidade: 'kg',  fator: 1 / 2.2046226, casas: 1 }] },

    /* A temperatura não cabe num factor: 0 °C não são 32 °F, e o
     * deslocamento é o que faz a conta ser `v * 9/5 + 32`. Por isso é a
     * única com `desloca`. */
    C:   { rotulo: '°C',   casas: 0, para: [{ unidade: 'F',   fator: 9 / 5, desloca: 32,  casas: 0 }] },
    F:   { rotulo: '°F',   casas: 0, para: [{ unidade: 'C',   fator: 5 / 9, desloca: -32, casas: 0 }] },
    ms:  { rotulo: 'm/s',  casas: 1, para: [{ unidade: 'kmh', fator: 3.6,          casas: 1 }] },
    kmh: { rotulo: 'km/h', casas: 1, para: [{ unidade: 'ms',  fator: 1 / 3.6,      casas: 1 }] }
  };

  /* O JOGO ACTIVO, e a unidade que ele manda.
   *
   * `defs.js` é puro — sem DOM, sem estado, sem `require` — e mesmo
   * assim tem de saber de que unidade é o número que o painel vai
   * pintar. A solução não é o `defs.js` ir buscar: é RECEBER. O `app.js`
   * é que tem o módulo do jogo activo, e é esse módulo que publica a
   * unidade (ver o cabeçalho).
   *
   * Sem isto, o esquema teria uma tabela de "unidades por jogo", e essa
   * tabela seria um segundo sítio a saber o que cada jogo publica, ao
   * lado do próprio módulo que já o diz. Dois sítios divergem em silêncio,
   * e o sintoma é um número com a etiqueta de outro jogo. */
  var JOGO = { id: null, unidades: {} };

  /* Diz a este esquema o que o jogo activo manda. Chamar outra vez ao
   * trocar de jogo, ANTES de voltar a validar. */
  function usarJogo(id, unidades) {
    JOGO.id = (id === undefined) ? null : id;
    JOGO.unidades = (unidades && typeof unidades === 'object') ? unidades : {};
    return JOGO;
  }

  function jogoAtual() { return JOGO; }

  /* A unidade que este jogo manda para esta chave, ou `null` se não
   * publica a grandeza. `null` é uma resposta útil: é o que some a
   * opção do painel, em vez de a oferecer à toa.
   *
   * E `sabidoDesteJogo` é uma função à parte de propósito, porque há uma
   * diferença que um `null` só não distingue:
   *
   *   - o jogo NÃO FALOU desta grandeza   -> ainda não se sabe, e a
   *     omissão do esquema serve. E é o caso normal no arranque, antes
   *     de o `app.js` dizer qual é o jogo.
   *   - o jogo FALOU, e disse `null`       -> o jogo não publica, e a
   *     opção não se oferece. É o `vento: null` do F1 25. */
  function baseDoJogo(chave) {
    const u = JOGO.unidades;
    if (!u || !Object.prototype.hasOwnProperty.call(u, chave)) return null;
    return u[chave];
  }

  function sabeDesteJogo(chave) {
    const u = JOGO.unidades;
    return !!(u && Object.prototype.hasOwnProperty.call(u, chave));
  }

  /* Os valores que uma opção oferece, NESTE jogo.
   *
   * O jogo não publica nada: `[]`, e a opção desaparece. Publica uma
   * unidade que a tabela não conhece: só essa, e sem conversão — que é
   * melhor do que inventar o factor. E uma definição que não é de jogo
   * devolve `null`, para o `declarados()` saber que há outra lei. */
  function valoresDoJogo(def) {
    if (!def || def.unidadeChave === undefined) return null;
    if (!sabeDesteJogo(def.unidadeChave)) {
      /* Ainda nao se sabe o jogo. A omissao do esquema e' a base. */
      const base = def.omissao;
      if (!Object.prototype.hasOwnProperty.call(UNIDADES, base)) return [base];
      return [base].concat(UNIDADES[base].para.map(function (p) { return p.unidade; }));
    }
    const base = baseDoJogo(def.unidadeChave);
    if (base === null || base === undefined) return [];
    if (!Object.prototype.hasOwnProperty.call(UNIDADES, base)) return [base];
    return [base].concat(UNIDADES[base].para.map(function (p) { return p.unidade; }));
  }

  /* O que se guarda é a UNIDADE QUE SE QUER VER — que é uma das que o
   * jogo permite, e por omissão a própria do jogo.
   *
   * A medida que chega do painel está sempre na unidade do jogo, e a
   * conversão acontece no momento de pintar, nunca no que fica guardado.
   * Regra nº 24: a unidade nunca se converte para ser guardada,
   * escreve-se a que o jogo manda. */
  function omissaoDoJogo(def) {
    if (def.omissao === undefined) return null;
    if (def.unidadeChave === undefined) return def.omissao;
    if (!sabeDesteJogo(def.unidadeChave)) return def.omissao;
    const base = baseDoJogo(def.unidadeChave);
    /* O jogo nao publica a grandeza: nao ha' unidade para escolher, e a
     * omissao e' `null` em vez de uma unidade que nao existe. */
    return (base === null || base === undefined) ? null : base;
  }

  /* O factor e as casas de um par. `null` quando o par não existe, que é
   * quando o número não pode ser convertido — e a resposta tem de ser o
   * número CRU, nunca um zero e nunca um `NaN`. */
  function parDeUnidade(de, para) {
    if (!de || !Object.prototype.hasOwnProperty.call(UNIDADES, de)) return null;
    const lista = UNIDADES[de].para;
    for (let i = 0; i < lista.length; i++) {
      if (lista[i].unidade === para) return lista[i];
    }
    return null;
  }

  /* ---------------------------------------------------------------------
   * O ESQUEMA
   * ------------------------------------------------------------------- */
  var LISTA = [

    /* ---- quem é o utilizador ---------------------------------------- */
    {
      chave: 'mode', tipo: 'enum',
      valores: ['telemetry', 'leaderboard', 'both'],
      omissao: null,
      rotulo: 'set.mode', grupo: 'vista', ordem: 1,
      manterNoReset: true,
      nota: null
    },
    {
      chave: 'lang', tipo: 'enum',
      valores: ['pt-PT', 'pt-BR', 'es', 'en'],
      omissao: 'pt-PT',
      rotulo: 'set.lang', grupo: 'idioma', ordem: 1,
      manterNoReset: true,
      nota: null
    },

    /* ---- unidades ----------------------------------------------------
     * Todas com a mesma forma: lista de valores, omissão, e a conversão.
     * A ordem dentro do grupo é a que se lê no ecrã: primeiro o que se lê
     * a correr, depois o que se configura uma vez. */
    {
      chave: 'temp', tipo: 'enum',
      valores: ['C', 'F'],
      omissao: 'C',
      rotulo: 'set.temp', grupo: 'unidades', ordem: 10,
      nota: null,
      unidade: {
        sufixo: { C: '°C', F: '°F' },
        de: function (c) { return c; },
        para: function (c, alvo) { return alvo === 'F' ? c * 9 / 5 + 32 : c; },
        casas: function (alvo) { return alvo === 'F' ? 0 : 0; }
      }
    },
    {
      chave: 'speed', tipo: 'enum',
      valores: ['kmh', 'mph'],
      omissao: 'kmh',
      rotulo: 'set.speed', grupo: 'unidades', ordem: 20,
      nota: null,
      unidade: {
        sufixo: { kmh: 'km/h', mph: 'mph' },
        // o jogo publica km/h. 1 mi = 1,609344 km.
        de: function (v) { return v; },
        para: function (v, alvo) { return alvo === 'mph' ? v / 1.609344 : v; },
        casas: function (alvo) { return alvo === 'mph' ? 1 : 0; }
      }
    },
    {
      chave: 'press', tipo: 'enum',
      valores: ['psi', 'bar'],
      omissao: 'psi',
      rotulo: 'set.press', grupo: 'unidades', ordem: 30,
      nota: 'set.pressNota',
      unidade: {
        sufixo: { psi: 'psi', bar: 'bar' },
        // 1 psi = 0,0689476 bar. Duas casas no bar, uma no psi: é a
        // diferença entre 2,07 e 2,068 — e o psi tem três algarismos
        // que interessam.
        de: function (v) { return v; },
        para: function (v, alvo) { return alvo === 'bar' ? v * 0.0689475729 : v; },
        casas: function (alvo) { return alvo === 'bar' ? 2 : 1; }
      }
    },
    {
      chave: 'fuel', tipo: 'enum',
      /* NAO ha' lista de valores aqui, e essa e' a parte nova.
       *
       * O AC publica litros e o F1 25 publica quilos, e as duas coisas nao
       * sao a mesma grandeza. Por isso a lista nao se escreve:
       * DERIVA-SE. A base que o modulo do jogo manda e' o primeiro valor,
       * e as alternativas sao as que a tabela `UNIDADES` diz serem da
       * mesma grandeza. `L -> gal` porque sao a mesma; `L -> kg` nunca,
       * porque nao sao.
       *
       * O F1 25, que manda quilos, nunca chega a oferecer galoes -- e isso
       * e' a verdade, nao uma limitacao. */
      unidadeChave: 'fuel',
      omissao: 'L',
      rotulo: 'set.fuel', grupo: 'unidades', ordem: 40,
      nota: null
    },
    {
      chave: 'vento', tipo: 'enum',
      /* O F1 25 NAO publica vento -- `vento: null` no `f125.js`. Nao e' um
       * dado em falta, e' um dado que nao existe, e por isso a opcao SOME
       * em vez de oferecer m/s e km/h para um numero que nunca chega. */
      unidadeChave: 'vento',
      omissao: 'ms',
      rotulo: 'set.vento', grupo: 'unidades', ordem: 50,
      nota: null
    },

    /* ---- envio -------------------------------------------------------- */
    {
      chave: 'fps', tipo: 'enum',
      valores: [10, 20, 30, 60],
      omissao: 60,
      rotulo: 'set.fps', grupo: 'envio', ordem: 1,
      nota: 'set.fpsNota'
    },

    /* ---- mapa --------------------------------------------------------- */
    {
      chave: 'map', tipo: 'enum',
      valores: ['on', 'off'],
      omissao: 'on',
      rotulo: 'set.map', grupo: 'mapa', ordem: 10,
      nota: null
    },
    {
      chave: 'mapView', tipo: 'enum',
      valores: ['inteira', 'relativa'],
      omissao: 'inteira',
      rotulo: 'set.mapView', grupo: 'mapa', ordem: 20,
      nota: 'set.mapViewWhy',
      // O nome do valor é o que se vê no botão e na tradução. Se um dia
      // passar a ser `inteira` → `completa`, é AQUI que se escreve o
      // detranslate, e o `validar` garante que o resto não entra.
      migrar: function (v) { return v; }
    },
    {
      chave: 'mapFlipX', tipo: 'bool',
      omissao: false,
      rotulo: 'set.mapFlipX', grupo: 'mapa', ordem: 30,
      nota: null
    },
    {
      chave: 'mapFlipZ', tipo: 'bool',
      omissao: false,
      rotulo: 'set.mapFlipZ', grupo: 'mapa', ordem: 40,
      nota: null
    },

    /* ---- acções: não guardam nada ------------------------------------ */
    {
      chave: 'limparMapa', tipo: 'acao',
      omissao: null,
      rotulo: 'set.clearMap', grupo: 'mapa', ordem: 50,
      nota: null
    },
    {
      chave: 'marcarDrs', tipo: 'acao',
      omissao: null,
      rotulo: 'set.drsMark', grupo: 'drs', ordem: 1,
      nota: null
    },
    {
      chave: 'apagarDrs', tipo: 'acao',
      omissao: null,
      rotulo: 'set.drsClear', grupo: 'drs', ordem: 2,
      nota: null
    }
  ];

  /* ---------------------------------------------------------------------
   * A TABELA
   * ------------------------------------------------------------------- */
  var porChave = {};
  for (var i = 0; i < LISTA.length; i++) porChave[LISTA[i].chave] = LISTA[i];

  /* Os grupos, pela ordem em que aparecem na gaveta. A ordem dos grupos é
   * esta lista e não a ordem do esquema: o esquema está por chave, e a
   * gaveta lê-se por secção. */
  var GRUPOS = [
    { chave: 'vista', rotulo: 'set.mode' },
    { chave: 'unidades', rotulo: 'set.units' },
    { chave: 'idioma', rotulo: 'set.lang' },
    { chave: 'envio', rotulo: 'set.send' },
    { chave: 'mapa', rotulo: 'set.map' },
    { chave: 'drs', rotulo: 'set.drsZone' }
  ];

  /* ---------------------------------------------------------------------
   * NORMALIZAR
   *
   * Corre o `migrar` da definição, se o tiver. Corre SEMPRE, e não só
   * quando o valor é inválido — é o que torna a migração um sítio só
   * para o que muda, em vez de uma lista de casos especiais que
   * envelhece sem ninguém dar por isso.
   *
   * A migração pode devolver qualquer coisa, ou falhar. Por isso vai
   * dentro de um try: uma migração que rebente tem de deixar a omissão
   * de pé, e não o esquema inteiro por um valor.
   * ------------------------------------------------------------------- */
  function normalizar(def, valor) {
    if (!def || def.migrar === undefined || def.migrar === null) return valor;
    try {
      return def.migrar(valor);
    } catch (e) {
      return def.omissao;
    }
  }

  /* O `data-v` de um botão é TEXTO, mesmo quando o valor é um número. O
   * `fps` é `[10, 20, 30, 60]` e o botão diz `data-v="60"`. Sem isto, o
   * `60` do esquema nunca casava com o `"60"` do DOM e o botão nunca
   * ficava aceso.
   *
   * E o inverso também: o que o `validar` devolve tem de ser o valor
   * DECLARADO, e não o que estava guardado. Um `fps: "30"` vindo do
   * `localStorage` é aceite — mas o que sai é o `30` do esquema, e não
   * a string. A primeira versão devolvia a string, e o `DEF.fps === 60`
   * do painel passava a ser falso, o botão do 60 deixava de ficar
   * aceso, e o `+DEF.fps` do SSE ia pedir 60 Hz ao servidor que não
   * dava. Três sítios, uma causa, e nada a dizer. */
  function declarados(def) {
    if (def.tipo !== 'enum') return [];
    /* Uma definição de unidade não tem lista: tem a base que o jogo
     * manda, e as alternativas saem da tabela de factos. Uma definição
     * normal tem lista, e a lista manda. */
    const doJogo = valoresDoJogo(def);
    return (doJogo === null) ? def.valores : doJogo;
  }

  function valoresDeclarados(def) {
    return declarados(def).map(String);
  }

  /* Devolve o valor DECLARADO, ou null se o que está guardado não for
   * nenhum deles. `null` é uma resposta válida para o `mode`: quer dizer
   * "ainda não se escolheu", e é por isso que o separador tem de
   * distinguir "valor não reconhecido" de "o valor é mesmo null". */
  function tipoDoValor(def, valor) {
    if (def.tipo === 'bool') {
      return typeof valor === 'boolean' ? valor : null;
    }
    if (def.tipo === 'enum') {
      if (valor === null || valor === undefined) return null;
      const alvo = String(valor);
      const i = valoresDeclarados(def).indexOf(alvo);
      return i >= 0 ? declarados(def)[i] : null;
    }
    return null;
  }

  /* ---------------------------------------------------------------------
   * validar
   *
   * Recebe o que veio do armazenamento — pode ser qualquer coisa, o
   * `JSON.parse` pode ter devolvido um array, e alguém pode ter
   * carregado à mão — e devolve um objecto com **exatamente** as chaves
   * declaradas, cada uma com um valor legal.
   *
   * Duas garantias, e são as duas que faltavam:
   *
   *   1. só entram valores declarados. Um `temp: 'banana'` dá a omissão,
   *      e a omissão é um valor que o painel sabe pintar.
   *   2. chaves que não estão no esquema não entram. Deixavam de ser
   *      lixo guardado, e a base deixa de crescer sozinha.
   * ------------------------------------------------------------------- */
  function validar(bruto) {
    var saida = {};
    var fonte = (bruto && typeof bruto === 'object' && !Array.isArray(bruto)) ? bruto : {};
    for (var i = 0; i < LISTA.length; i++) {
      var def = LISTA[i];
      if (def.tipo === 'acao') continue;          // não se guarda nada
      var guardado = Object.prototype.hasOwnProperty.call(fonte, def.chave)
        ? fonte[def.chave] : undefined;
      var v = tipoDoValor(def, normalizar(def, guardado));
      saida[def.chave] = (v === null || v === undefined) ? omissaoDoJogo(def) : v;
    }
    return saida;
  }

  /* A reposição de predefinições, com a excepção pedida: a VISTA e o
   * IDIOMA ficam. São escolha de quem está a conduzir, não configuração
   * — e repor tudo punha a pergunta "que vista queres?" outra vez a
   * quem acabou de responder a ela. */
  function repor() {
    var actual = validar(arguments[0]);
    var saida = {};
    for (var i = 0; i < LISTA.length; i++) {
      var def = LISTA[i];
      if (def.tipo === 'acao') continue;
      saida[def.chave] = def.manterNoReset ? actual[def.chave] : omissaoDoJogo(def);
    }
    return saida;
  }

  /* ---------------------------------------------------------------------
   * APRESENTAR
   *
   * O número JÁ convertido e a etiqueta que lhe corresponde. Sempre os
   * dois, sempre do mesmo sítio, para o número e a etiqueta não poderem
   * divergir — que é o bug do °C que está escrito no topo.
   *
   *     Defs.apresentar('temp', 20, DEF)   -> { numero: '68', sufixo: '°F' }
   *     Defs.apresentar('press', 30, DEF)  -> { numero: '2.07', sufixo: 'bar' }
   *
   * O terceiro argumento é o objecto de definições, e não a unidade
   * alvo. A primeira versão levava a unidade, e quem chamava tinha de
   * a ir buscar ao `DEF` — o que significa que um dia alguém passa o
   * número por engano onde devia passar a unidade, e o `sufixo` sai
   * `"20"` porque foi fazer `sufixo[20]`. Passar o objecto inteiro
   * torn isso impossível por construção: não há um terceiro argumento
   * onde se possa meter a medida.
   *
   * Devolve null quando a definição não tem conversão, ou quando a
   * medida não é um número — para o painel distinguir "não aplicável"
   * de "um número torto", sem repetir a lista das chaves com conversão.
   * ------------------------------------------------------------------- */
  /* A unidade que se QUER VER: a que esta' guardada, ou a omissao. */
  function alvoDe(def, definicoes) {
    if (definicoes && definicoes[def.chave] !== undefined
        && definicoes[def.chave] !== null) {
      return definicoes[def.chave];
    }
    return omissaoDoJogo(def);
  }

  /* A unidade de que a MEDIDA vem. Numa definicao normal e' a mesma que
   * a de ver; numa definicao de unidade e' a que o modulo do jogo manda,
   * e essa e' a unica forma de saber que 40 sao 40 LITROS ou 40
   * QUILOS. */
  function baseDe(def) {
    if (def.unidadeChave === undefined) return omissaoDoJogo(def);
    if (!sabeDesteJogo(def.unidadeChave)) return def.omissao;
    return baseDoJogo(def.unidadeChave);
  }

  function apresentar(chave, medida, definicoes) {
    const def = porChave[chave];
    if (!def) return null;
    if (medida === null || medida === undefined) return null;
    const numero = Number(medida);
    if (!isFinite(numero)) return null;

    const alvo = alvoDe(def, definicoes);
    if (alvo === null || alvo === undefined) return null;

    /* Uma definicao de unidade converte pela TABELA, e a base vem do
     * modulo do jogo. Uma definicao normal traz a conversao dentro de si,
     * porque a unidade dela e' igual nos dois jogos. */
    if (def.unidadeChave !== undefined) {
      const base = baseDe(def);
      if (base === null || base === undefined) return null;   /* nao publica */
      const par = parDeUnidade(base, alvo);
      const rotulo = UNIDADES[alvo] ? UNIDADES[alvo].rotulo : null;
      if (rotulo === null) return null;
      if (par === null) {
        /* O jogo manda em unidade que a tabela nao conhece. O numero CRU
         * e' a resposta honesta: melhor o numero sem etiqueta do que o
         * numero com a etiqueta de outra unidade. Regra no 19. */
        return { numero: numero.toFixed(UNIDADES[alvo].casas), sufixo: rotulo };
      }
      return {
        numero: (numero * par.fator + (par.desloca || 0)).toFixed(par.casas),
        sufixo: rotulo
      };
    }

    if (!def.unidade) return null;
    const sufixo = def.unidade.sufixo[alvo];
    if (sufixo === undefined) return null;
    return {
      numero: def.unidade.para(numero, alvo).toFixed(def.unidade.casas(alvo)),
      sufixo: sufixo
    };
  }

  /* A etiqueta sozinha, para os `<i data-unidade="...">` que estao no
   * HTML ao lado do numero. E' a segunda metade do mesmo par -- e chama o
   * mesmo codigo, para nao haver um sitio que saiba a unidade e outro
   * que nao sabe. */
  function sufixo(chave, definicoes) {
    const def = porChave[chave];
    if (!def) return '';
    const alvo = alvoDe(def, definicoes);
    if (alvo === null || alvo === undefined) return '';
    if (def.unidadeChave !== undefined) {
      /* A MESMA guarda do `apresentar`. Sem ela, um jogo que nao publica
       * a grandeza devolvia `null` para o numero e "m/s" para a etiqueta
       * -- e o painel escrevia uma unidade ao lado de nada. O par tem de
       * cair junto, que e' a razao de o `sufixo` existir. */
      const base = baseDe(def);
      if (base === null || base === undefined) return '';
      if (!UNIDADES[alvo]) return '';
      return UNIDADES[alvo].rotulo;
    }
    if (!def.unidade) return '';
    return def.unidade.sufixo[alvo] !== undefined ? def.unidade.sufixo[alvo] : '';
  }


  function porGrupo(grupo) {
    return LISTA
      .filter(function (d) { return d.grupo === grupo; })
      .sort(function (a, b) { return a.ordem - b.ordem; });
  }

  function guarda(chave) { return Object.prototype.hasOwnProperty.call(porChave, chave); }

  var api = {
    LISTA: LISTA,
    GRUPOS: GRUPOS,
    UNIDADES: UNIDADES,
    validar: validar,
    repor: repor,
    apresentar: apresentar,
    sufixo: sufixo,
    porChave: porChave,
    porGrupo: porGrupo,
    guarda: guarda,
    /* O que o painel precisa para oferecer as opções certas ao jogo
     * certo. `usarJogo` é o que o `app.js` chama quando escolhe um jogo,
     * e `declarados` é a lista de valores que esse jogo aceita. */
    usarJogo: usarJogo,
    jogoAtual: jogoAtual,
    declarados: declarados,
    baseDoJogo: baseDoJogo,
    sabeDesteJogo: sabeDesteJogo
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Defs = api;
})(typeof window !== 'undefined' ? window : globalThis);
