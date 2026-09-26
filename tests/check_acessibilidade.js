/* ===========================================================================
 * check_acessibilidade.js
 *
 * Como correr: abrir http://localhost:8765/ e colar isto na consola.
 * (Igual ao check_layout.js -- nao ha nada que o sirva, e o node nao tem DOM.)
 *
 * O que mede, e o que cada numero significa:
 *
 *   - CONTRASTE. Percorre todas as folhas de texto das tres vistas
 *     visiveis, compoe a cor real (com a transparencia sobre o fundo que
 *     lhe esta por baixo, e nao a cor declarada) e compara com o WCAG AA:
 *     4,5:1 para texto normal, 3:1 para texto grande (>=24 px, ou >=18,66
 *     px com peso 700). A regra e' 1.4.3.
 *
 *   - FOCO. Se nenhum botao mostrar um anel de foco, ou se o :focus-visible
 *     nao bater em lado nenhum, a pagina nao e' usavel de teclado.
 *     A regra e' 2.4.7.
 *
 *   - ALVOS. Nenhum botao abaixo de 24x24 px. A regra e' 2.5.8.
 *
 *   - DIALOGOS. O menu e a gaveta tem de ter role=dialog e aria-modal.
 *     A regra e' 4.1.2.
 *
 *   - MOVIMENTO. Quantas animacoes infinitas estao declaradas. Devem ser
 *     zero dentro de um bloco prefers-reduced-motion. A regra e' 2.3.3.
 *
 * Porque existe: em 2026-09-26 havia 26 folhas de texto abaixo do minimo,
 * a pior a 1,63:1, por causa de um unico token (--grey) em 43 regras.
 * Passou despercebido durante semanas porque o contraste nao da erro --
 * da' um ecr'a um pouco mais escuro e mais nada. Um teste que so olha para
 * "a pagina abriu sem erros" nao apanha nada disto.
 * ========================================================================= */
(async () => {
  const problemas = [];
  const notas = [];

  /* ------------------------------------------------------------- contraste */
  const lum = (r, g, b) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parseCor = (s) => {
    const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const compoe = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1
  });
  const razao = (a, b) => {
    const l1 = lum(a.r, a.g, a.b), l2 = lum(b.r, b.g, b.b);
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  };
  // o fundo e' o primeiro antepado com cor opaca. Se nao houver, preto.
  const fundoDe = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parseCor(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.95) return c;
      n = n.parentElement;
    }
    return { r: 0, g: 0, b: 0, a: 1 };
  };

  const vistos = new Set();
  const maus = [];
  let folhas = 0, pior = 99;
  document.querySelectorAll('#app .view:not(.hidden) *, #app .head *, #app .foot *')
    .forEach((el) => {
      // so folhas: um elemento com filhos nao tem uma cor de texto propria
      if (el.children.length) return;
      const txt = Array.from(el.childNodes)
        .filter((x) => x.nodeType === 3).map((x) => x.textContent.trim()).join('');
      if (!txt) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return;
      const fg0 = parseCor(cs.color);
      if (!fg0) return;
      const rr = el.getBoundingClientRect();
      if (rr.width < 1 || rr.height < 1) return;

      const bg = fundoDe(el);
      const fg = compoe(fg0, bg);
      const tam = parseFloat(cs.fontSize);
      const peso = parseInt(cs.fontWeight, 10) || 400;
      const grande = tam >= 24 || (tam >= 18.66 && peso >= 700);
      const minimo = grande ? 3.0 : 4.5;
      const cr = razao(fg, bg);

      folhas++;
      pior = Math.min(pior, cr);
      // agrupa por cor+tamanho+classe, para nao repetir o mesmo problema 14 vezes
      const chave = cs.color + '|' + Math.round(tam) + '|' + el.className;
      if (cr < minimo && !vistos.has(chave)) {
        vistos.add(chave);
        maus.push({
          texto: txt.slice(0, 22), cor: cs.color, tam: Math.round(tam),
          razao: +cr.toFixed(2), minimo, classe: (el.className || '').toString().slice(0, 28)
        });
      }
    });
  maus.sort((a, b) => a.razao - b.razao);
  if (maus.length) {
    problemas.push(maus.length + ' texto(s) abaixo do minimo AA. O pior: '
      + maus[0].texto + ' a ' + maus[0].razao + ':1 (minimo ' + maus[0].minimo + ':1)');
  }
  notas.push('contraste: ' + folhas + ' folhas de texto, pior ' + pior.toFixed(2)
    + ':1, ' + maus.length + ' abaixo do minimo');

  /* ------------------------------------------------------------------ foco
   *
   * Nao se pode medir isto com el.focus(). O :focus-visible so dispara com
   * foco de TECLADO, por definicao -- um .focus() programatico nao conta, e
   * da "0 controlos com anel" numa pagina perfeitamente correcta. Foi
   * exactamente o que aconteceu na primeira versao deste teste.
   *
   * Como nao se pode premir Tab a partir de um script colado na consola, a
   * verificacao e' estrutural: existe alguma regra de :focus / :focus-visible
   * no CSS que mude o aspeto, e o browser mantem o anel por omissao nos
   * controlos que nao tem nenhuma? */
  let comRegra = 0, comAnelPorOmissao = 0, totalBotoes = 0;
  const folhaFoco = Array.from(document.styleSheets)
    .find((s) => (s.href || '').indexOf('style.css') >= 0);
  if (folhaFoco) {
    const verFoco = (lista) => {
      for (const r of lista) {
        if (r.type === CSSRule.MEDIA_RULE) { verFoco(r.cssRules); continue; }
        if (!r.selectorText) continue;
        if (!/:focus/.test(r.selectorText)) continue;
        // uma regra de foco so conta se mudar o aspeto
        if (r.style.outline || r.style.boxShadow || r.style.border
          || r.style.background || r.style.color) comRegra++;
      }
    };
    try { verFoco(folhaFoco.cssRules); } catch (e) { /* folha de outra origem */ }
  }
  document.querySelectorAll('button, input, a[href]').forEach((el) => {
    const rr = el.getBoundingClientRect();
    if (rr.width < 1 && rr.height < 1) return;
    totalBotoes++;
    // se o CSS nao tira o outline a este elemento, o browser desenha o
    // anel por omissao e o control conta como marcado
    if (!/outline\s*:\s*(none|0)/.test(el.className || '')) comAnelPorOmissao++;
  });
  if (totalBotoes && !comRegra && !comAnelPorOmissao) {
    problemas.push('nem uma regra de :focus no CSS, e nao ha como confirmar '
      + 'anel por omissao. Quem usa teclado nao sabe onde esta.');
  }
  notas.push('foco: ' + comRegra + ' regra(s) de :focus no CSS, '
    + comAnelPorOmissao + ' de ' + totalBotoes + ' controlos com anel por omissao');

  /* ---------------------------------------------------------------- alvos */
  const pequenos = [];
  document.querySelectorAll('button, input, a[href]').forEach((el) => {
    const rr = el.getBoundingClientRect();
    if (rr.width < 1 && rr.height < 1) return;
    if (rr.width < 24 || rr.height < 24) {
      pequenos.push((el.id || el.className || el.tagName).toString().slice(0, 24)
        + ' ' + Math.round(rr.width) + 'x' + Math.round(rr.height));
    }
  });
  if (pequenos.length) {
    problemas.push(pequenos.length + ' alvo(s) de toque abaixo de 24x24: ' + pequenos.join(', '));
  }
  notas.push('alvos de toque: ' + pequenos.length + ' abaixo de 24x24');

  /* ------------------------------------------------------------- dialogos */
  [['menu', 'menu inicial'], ['settings', 'gaveta de definicoes']].forEach(([id, nome]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.getAttribute('role') !== 'dialog') {
      problemas.push('o ' + nome + ' nao tem role="dialog" -- um leitor de ecra '
        + 'nao o anuncia como janela, e continua a ler o que esta atras.');
    }
    if (el.getAttribute('aria-modal') !== 'true') {
      problemas.push('o ' + nome + ' nao tem aria-modal="true" -- o leitor de ecra '
        + 'continua a ler o conteudo coberto.');
    }
  });
  notas.push('dialogos: menu e gaveta verificados');

  /* ------------------------------------------------------------ movimento
   *
   * A pergunta util nao e' "existe um bloco prefers-reduced-motion?" -- e'
   * "cada animacao infinita tem alguma regra que a desligue?". Por isso
   * emparelham-se os dois lados: recolhem-se os selectors com animacao
   * infinita e ve-se se cada um aparece dentro do bloco a dizer
   * animation:none. A primeira versao contava as animacoes infinitas que
   * houvesse DENTRO do bloco, e como la escrevo "animation:none" -- que
   * nao tem a palavra "infinite" -- contava zero e acusava uma falha que
   * nao existia. */
  const comInfinita = [];       // { seletor, animacao }
  const neutralizadas = [];     // seletores que o bloco reduce apaga
  const folha = Array.from(document.styleSheets)
    .find((s) => (s.href || '').indexOf('style.css') >= 0);
  if (folha) {
    const apanhar = (lista, dentroDeReduce) => {
      for (const r of lista) {
        if (r.type === CSSRule.MEDIA_RULE) {
          apanhar(r.cssRules, dentroDeReduce || /reduced-motion/.test(r.conditionText || ''));
          continue;
        }
        if (!r.style) continue;
        const anim = r.style.animation || '';
        if (!dentroDeReduce) {
          if (/infinite/.test(anim)) comInfinita.push({ seletor: r.selectorText, animacao: anim });
        } else if (r.style.animationName === 'none') {
          // Tem de se ler animationName, e nao animation. O CSSOM
          // NORMALIZA a declaracao `animation:none` para a cadeia
          // "auto ease 0s 1 normal none running none", por isso uma
          // expressao contra `animation` nunca casa. Duas versoes deste
          // teste falharam por causa deste detalhe.
          neutralizadas.push(r.selectorText);
        }
      }
    };
    try { apanhar(folha.cssRules, false); } catch (e) { /* folha de outra origem */ }
  }
  // Emparelhar nao e' igualdade de string. A animacao pode estar no
  // selector `.wide-btn.mark.on` e a alternativa em `.wide-btn.mark`: e' o
  // mesmo elemento, so que a regra mais estreita. Vale um prefixo seguido
  // de um separador -- espaco, ponto, dois pontos,>,+ ou virgula.
  const mesmoElemento = (animado, redutor) => {
    const a = animado.split(',')[0].trim();
    const b = redutor.split(',')[0].trim();
    if (a === b) return true;
    if (a.indexOf(b) === 0 && /[ .:>+]/.test(a.charAt(b.length))) return true;
    // e o inverso: a regra do bloco e' mais estreita e o animated mais largo
    if (b.indexOf(a) === 0 && /[ .:>+]/.test(b.charAt(a.length))) return true;
    return false;
  };
  const semCobrir = comInfinita.filter((a) =>
    !neutralizadas.some((s) => mesmoElemento(a.seletor, s)));
  if (semCobrir.length) {
    problemas.push(semCobrir.length + ' animacao(oes) infinita(s) sem alternativa '
      + 'em prefers-reduced-motion: ' + semCobrir.map((a) => a.seletor).join(', ')
      + '. Quem pede menos movimento nao tem forma de as desligar.');
  }
  notas.push('movimento: ' + comInfinita.length + ' animacoes infinitas, '
    + (comInfinita.length - semCobrir.length) + ' com alternativa em prefers-reduced-motion');

  /* ------------------------------------------------------------- resultado */
  const linhas = notas.concat(problemas.length ? [''] : []);
  problemas.forEach((p) => linhas.push('FALHA: ' + p));
  console.log('%c' + linhas.join('\n'), 'font-family:monospace');
  console.log(problemas.length
    ? '%c' + problemas.length + ' PROBLEMA(S) de acessibilidade'
    : '%cok: nenhuma falha de acessibilidade medida');
  return problemas.length;
})();
