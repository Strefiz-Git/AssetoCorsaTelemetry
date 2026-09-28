/* ===========================================================================
 * A ESCOLHA DO JOGO
 * ===========================================================================
 *
 * Este bloco e' a ponte entre o nucleo e o modulo do jogo, e e' a unica
 * parte do `app.js` que sabe que ha' mais do que um.
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTE FICHEIRO NAO SABE
 * ---------------------------------------------------------------------------
 * Nao sabe o que e' o Assetto Corsa, nem o que e' o F1 25. Nao sabe que
 * o primeiro manda o combustivel em litros e o segundo em quilos, nem
 * que o primeiro tem de decidir se o flag do DRS e' de confianca e o
 * segundo nao. Essas coisas estao em `jogos/ac.js` e `jogos/f125.js`, e
 * cada uma delas esta' escrita ao lado da medicao que a justifica.
 *
 * O que este ficheiro sabe e': que ha' dois modulos, que um deles esta'
 * activo, e que a lista de jogos vem do servidor. Tudo o resto e'
 * perguntar ao modulo activo.
 *
 * ---------------------------------------------------------------------------
 * POR QUE A ESCOLHA E' O PRIMEIRO ECL
 * ---------------------------------------------------------------------------
 * Trocar de jogo troca o modulo carregado, o que o painel consegue
 * mostrar, e a instrucao de arranque. Se a escolha da vista viesse
 * primeiro, trocar de jogo obrigaria a recarregar a pagina -- e recarregar
 * nao apaga o mapa (esta' no `localStorage`), nao apaga as voltas de
 * referencia, e nao devolve o painel ao estado inicial. Parecia a coisa
 * mais simples do mundo e era a pior.
 *
 * ---------------------------------------------------------------------------
 * A REGRA DO "JA ESCOLHEU"
 * ---------------------------------------------------------------------------
 * A escolha vive em DOIS sítios, e e' a mesma escolha: o ficheiro de
 * definicoes do servidor, que e' o que o `Hub` le ao arrancar, e o
 * `localStorage`, que e' o que o painel usa para nao mostrar o ecra de
 * escolha a cada F5.
 *
 * Sao os dois necessarios e porem nao podia ser so' um. Se fosse so' o
 * servidor, trocar de jogo obriga a reiniciar. Se fosse so' o
 * `localStorage`, o servidor continua a ler o jogo antigo enquanto o
 * painel mostra o novo -- e o painel fica a dizer "F1 25" com a
 * telemetria do AC, o que e' a forma maisBars uma confusao possivel.
 *
 * A ordem de autoridade e' o servidor. O `localStorage` e' so' a cache
 * que evita o ecra de escolha, e por isso `aplicarJogo` reenvia sempre a
 * escolha ao servidor e espera pela resposta antes de pintar o painel
 * novo. Um painel que troca de nome antes de o servidor trocar e' um
 * painel a mentir sobre o que esta' a mostrar.
 */
(function (global) {
  'use strict';

  const JOGOS = {
    ac: () => global.JogoAC,
    f125: () => global.JogoF125,
  };

  const lista = {
    jogos: [],
    servidor: null,        // o que o servidor disse que esta' activo
    escolha: null,         // a nossa escolha, ou null se nunca houve
    modulos: {},           // id -> modulo, construido a espera
  };

  function modulo(id) {
    if (id && JOGOS[id]) {
      if (!lista.modulos[id]) {
        const m = JOGOS[id]();
        if (m) lista.modulos[id] = m;
      }
      return lista.modulos[id] || null;
    }
    return null;
  }

  /* O modulo ACTIVO. E' este que o resto do painel chama, e nunca um
   * modulo nomeado a mao -- um `if (jogo === 'f125')` espalhado pelo
   * `app.js` seria um segundo sitio a saber de jogos, e os dois
   * divergiam. */
  function atual() {
    return modulo(lista.escolha) || modulo(lista.servidor) || modulo('ac');
  }

  function idAtivo() {
    const m = atual();
    return m ? m.id : 'ac';
  }

  /* ------------------------------------------------------------------------
   * AS CAPACIDADES
   * ---------------------------------------------------------------------- */
  function cap(chave) {
    const m = atual();
    if (!m) return 'on';
    const c = m.capacidades();
    return c[chave] === undefined ? 'on' : c[chave];
  }
  function tem(chave) { return cap(chave) !== 'off'; }
  function auto(chave) { return cap(chave) === 'auto'; }

  /* Esconder o que o jogo nao tem.
   *
   * Isto e' o que impede o painel de prometer um numero que o jogo nao
   * publica, que e' a Regra no 19. Um cartao a mostrar zeros e' pior do
   * que um cartao a mais: os zeros sao plausiveis e ninguem os
   * questiona, enquanto um cartao a mais nota-se.
   *
   * E' por isso que a lista vem do modulo e nao esta escrita aqui: a
   * lista canonica esta' em `nucleo/jogo-base.js` (o que o painel sabe
   * pintar) e em `actelemetry/jogos/base.py` (o que o jogo publica), e o
   * `test_jogos.js` e o `test_f125_parser.py` conferem os dois lados. */
  function aplicarCapacidades() {
    /* Um `data-cap="chave"` no elemento, e o elemento desaparece se o
     * jogo nao publicar isso.
     *
     * E' a CHAVE que vai no HTML e nao um `id`, e a razao e' de
     * sincronizacao: um `id` obrigava a escrever aqui o nome de cada
     * elemento, e esse nome seria uma segunda copia da estrutura do
     * painel. Divergia do HTML no primeiro `id` que se renomeasse, e
     * divergia em silencio -- o elemento nunca mais aparecia, sem erro
     * nenhum. O `data-cap` esta' AO LADO do elemento que governa, e por
     * isso nao ha' nada para manter em dia.
     *
     * A lista canonica esta' escrita a mao em dois sítios e conferida
     * nos dois: `actelemetry/jogos/base.py` diz o que o JOGO publica, e
     * `nucleo/jogo-base.js` diz o que o PAINEL sabe pintar. Sao 81
     * chaves, e 50 delas diferem entre os dois jogos. Um dado que o jogo
     * publica e que o painel nao sabe mostrar nao e' um cartao a
     * esconder, e' um botao por fazer. */
    document.querySelectorAll('[data-cap]').forEach((el) => {
      const estado = cap(el.getAttribute('data-cap'));
      el.classList.toggle('hidden', estado === 'off');
      /* O "auto" fica esbatido em vez de escondido, e a razao e' que o
       * dado EXISTE mas nao e' de confianca: a vida do pneu no AC e' uma
       * estimativa a partir de duas voltas medidas, e o flag do DRS so
       * se sabe depois de conduzir uma volta inteira.
       *
       * Esconder o "auto" seria mentir por omissao -- o piloto via um
       * painel sem o campo e concluia que o jogo nao o manda, quando o
       * que acontece e' que o manda e o painel ainda nao tem certeza. */
      el.classList.toggle('cap-auto', estado === 'auto');
    });
  }

  /* ------------------------------------------------------------------------
   * A LISTA DE JOGOS
   * ---------------------------------------------------------------------- */
  function lerLista() {
    return fetch('/api/games')
      .then(r => r.json())
      .then(d => {
        lista.jogos = Array.isArray(d.jogos) ? d.jogos : [];
        lista.servidor = d.jogo || null;
        if (!lista.escolha) lista.escolha = doLocalStorage();
        return lista;
      })
      .catch(() => {
        /* O servidor nao respondeu. Nao e' razao para esconder o painel:
         * ele mostra o que souber e o resto a neutro. Inventar uma lista
         * aqui seria mostrar um jogo que o servidor nao tem. */
        lista.jogos = [];
        return lista;
      });
  }

  function doLocalStorage() {
    try {
      return localStorage.getItem('acjogo') || null;
    } catch (e) { return null; }
  }
  function paraLocalStorage(id) {
    try { localStorage.setItem('acjogo', id); } catch (e) { /* ignora */ }
  }

  /* ------------------------------------------------------------------------
   * TROCAR DE JOGO
   * ---------------------------------------------------------------------- */
  function escolher(id) {
    if (!id || !JOGOS[id]) return Promise.resolve(idAtivo());
    /* A resposta do servidor vem primeiro. So' depois de saber que o
     * servidor trocou e' que o painel muda de nome -- um painel que
     * escrevesse "F1 25" com a telemetria do AC seria uma mentira na
     * barra de estado, e uma mentira que dura ate o proximo frame. */
    return fetch('/api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jogo: id }),
    })
      .then(r => r.json())
      .then(d => {
        lista.escolha = (d && d.jogoActivo) || id;
        lista.servidor = lista.escolha;
        paraLocalStorage(lista.escolha);
        aplicar();
        return lista.escolha;
      })
      .catch(() => {
        /* O servidor nao respondeu. Fica a escolha local, e o painel
         * mostra o que o `Hub` tiver -- que e' o jogo antigo. E melhor
         * mostrar o jogo antigo com a verdade do que o novo com uma
         * mentira. */
        lista.escolha = id;
        paraLocalStorage(id);
        aplicar();
        return id;
      });
  }

  /* O que muda quando o jogo muda. */
  function aplicar() {
    aplicarCapacidades();
    if (global.AplicarIdioma) global.AplicarIdioma();
    if (global.AplicarUnidades) global.AplicarUnidades();
    if (global.RepintarTudo) global.RepintarTudo();
    if (global.AplicarJogoNaInterface) global.AplicarJogoNaInterface();
    /* E AS DEFINICOES DO JOGO, que faltavam.
     *
     * O `app.js` publica `MontarDefinicoesJogo` e este `aplicar()` nunca o
     * chamava. O grupo de jogo na gaveta ficava com o que o jogo
     * anterior tinha -- e o que o jogo publica e' diferente: o AC da
     * litros e o F1 25 da quilos, e o F1 25 nao publica vento. Trocar de
     * jogo deixava a gaveta a oferecer galoes a um jogo que manda
     * quilos, ou vento a um jogo que nao o publica.
     *
     * A ordem e' a do esquema: as capacidades primeiro, para o resto do
     * `app.js` ja' saber o que o jogo activo tem. */
    if (global.MontarDefinicoesJogo) global.MontarDefinicoesJogo();
  }

  global.Jogos = {
    lerLista: lerLista,
    escolher: escolher,
    modulo: modulo,
    atual: atual,
    idAtivo: idAtivo,
    lista: lista,
    cap: cap,
    tem: tem,
    auto: auto,
    aplicar: aplicar,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
