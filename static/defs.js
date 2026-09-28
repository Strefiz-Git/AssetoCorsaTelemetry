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
      valores: ['L', 'gal'],
      omissao: 'L',
      rotulo: 'set.fuel', grupo: 'unidades', ordem: 40,
      nota: null,
      unidade: {
        sufixo: { L: 'L', gal: 'gal' },
        // 1 galão imperial = 4,54609 L. O galão americano são 3,78541 L,
        // e a diferença de 20% é grande demais para ser um arredondamento.
        de: function (v) { return v; },
        para: function (v, alvo) { return alvo === 'gal' ? v / 4.54609 : v; },
        casas: function (alvo) { return alvo === 'gal' ? 2 : 1; }
      }
    },
    {
      chave: 'vento', tipo: 'enum',
      valores: ['ms', 'kmh'],
      omissao: 'ms',
      rotulo: 'set.vento', grupo: 'unidades', ordem: 50,
      nota: null,
      unidade: {
        sufixo: { ms: 'm/s', kmh: 'km/h' },
        de: function (v) { return v; },
        para: function (v, alvo) { return alvo === 'kmh' ? v * 3.6 : v; },
        casas: function (alvo) { return 1; }
      }
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
    return def.valores;
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
      saida[def.chave] = (v === null || v === undefined) ? def.omissao : v;
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
      saida[def.chave] = def.manterNoReset ? actual[def.chave] : def.omissao;
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
  function apresentar(chave, medida, definicoes) {
    const def = porChave[chave];
    if (!def || !def.unidade) return null;
    if (medida === null || medida === undefined) return null;
    const numero = Number(medida);
    if (!isFinite(numero)) return null;

    const alvo = (definicoes && definicoes[chave] !== undefined)
      ? definicoes[chave] : def.omissao;
    const sufixo = def.unidade.sufixo[alvo];
    if (sufixo === undefined) return null;

    return {
      numero: def.unidade.para(numero, alvo).toFixed(def.unidade.casas(alvo)),
      sufixo: sufixo
    };
  }

  /* A etiqueta sozinha, para os `<i data-unidade="...">` que estão no
   * HTML ao lado do número. É a segunda metade do mesmo par — e chama o
   * mesmo código, para não haver um sítio que saiba a unidade e outro
   * que não saiba. */
  function sufixo(chave, definicoes) {
    const def = porChave[chave];
    if (!def || !def.unidade) return '';
    const alvo = (definicoes && definicoes[chave] !== undefined)
      ? definicoes[chave] : def.omissao;
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
    validar: validar,
    repor: repor,
    apresentar: apresentar,
    sufixo: sufixo,
    porChave: porChave,
    porGrupo: porGrupo,
    guarda: guarda
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Defs = api;
})(typeof window !== 'undefined' ? window : globalThis);
