/* =========================================================================
   Verifica o layout nos tres modos e em treze larguras, sem screenshots.

   COMO CORRER: abrir http://localhost:8765/ e colar isto na consola do
   browser (F12). Precisa de estar na propria pagina, porque vai buscar o
   markup a '/' e o CSS a '/style.css' - tem de ser a mesma origem.

   NAO E' um ficheiro que o servidor sirva, por isso vive em tests/ e
   nao em static/.

   O que faz, e porque e' taoIndirecto:
   Nao ha forma de redimensionar a janela do browser a partir daqui, e
   carregar a aplicacao verdadeira dentro de um iframe abre duas ligacoes
   SSE por iframe - que e' suficiente para o browser travar e o teste
   expirar. Por isso cada layout e' montado num iframe com o markup real
   e o CSS real, SEM NENHUM script: sem boot, sem SSE, sem temporizadores.
   As media queries respondem a largura do iframe, da mesma forma que
   respondem a largura da janela.

   O que considera um problema:
     - transbordo horizontal (scrollWidth maior que a largura)
     - um cartao com menos de 40x30 px, ou seja, esmagado
     - um cartao que sai do ecra a direita
     - o mapa ou os graficos dos pedais sem dimensao (ficariam vazios)
     - o cabecalho a transbordar
   ========================================================================= */
(async () => {
  const html = await (await fetch('/')).text();
  const corpo = html.slice(html.indexOf('<body'), html.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');

  const VISTAS = ['telemetry', 'leaderboard', 'both'];
  const LARGURAS = [1920, 1400, 1280, 1240, 1100, 1000, 900, 860, 760, 620, 520, 420, 360];
  const linhas = [];
  let problemas = 0;

  for (const vista of VISTAS) {
    for (const L of LARGURAS) {
      const f = document.createElement('iframe');
      f.style.cssText = 'position:absolute;left:-9999px;top:0;border:0;height:900px;width:' + L + 'px';
      document.body.appendChild(f);
      const d = f.contentDocument;
      d.open();
      d.write('<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">'
        + '<link rel="stylesheet" href="/style.css"></head>' + corpo
        + '<span id="tidy"></span><script>window.addEventListener("load",function(){'
        + 'document.querySelectorAll(".view").forEach(function(v){'
        + 'v.classList.toggle("hidden",v.getAttribute("data-view")!==' + JSON.stringify(vista) + ')});'
        + '["app"].forEach(function(i){var e=document.getElementById(i);if(e)e.classList.remove("hidden")});'
        + '["boot","menu","settings"].forEach(function(i){var e=document.getElementById(i);if(e)e.classList.add("hidden")});'
        + 'document.getElementById("tidy").textContent="pronto";});<\/script></body></html>');
      d.close();
      for (let i = 0; i < 60; i++) {
        const t = d.getElementById('tidy');
        if (t && t.textContent === 'pronto') break;
        await new Promise(r => setTimeout(r, 25));
      }

      const w = f.contentWindow;
      const maus = [];
      if (d.documentElement.scrollWidth > w.innerWidth + 1)
        maus.push('scrollWidth ' + d.documentElement.scrollWidth + '>' + w.innerWidth);
      let n = 0;
      d.querySelectorAll('.view:not(.hidden) .card').forEach(el => {
        n++;
        const r = el.getBoundingClientRect();
        const nome = el.className.replace('card ', '').replace('c-', '');
        if (r.width < 40 || r.height < 30)
          maus.push(nome + ' esmagado ' + Math.round(r.width) + 'x' + Math.round(r.height));
        if (r.right > w.innerWidth + 2)
          maus.push(nome + ' fora do ecra (' + Math.round(r.right) + '>' + w.innerWidth + ')');
      });
      ['map', 'pedals'].forEach(id => {
        const cv = d.getElementById(id);
        if (cv && (cv.clientWidth < 20 || cv.clientHeight < 20))
          maus.push(id + ' sem dimensao (' + cv.clientWidth + 'x' + cv.clientHeight + ')');
      });
      // Só o que está na vista visível. Uma consulta ao documento inteiro
      // apanha também as vistas escondidas, que têm tamanho zero, e dá
      // falsos positivos em tudo.
      d.querySelectorAll('.view:not(.hidden) .weather .wx').forEach(c => {
        const r = c.getBoundingClientRect();
        if (r.width < 25 || r.height < 18)
          maus.push('clima ' + Math.round(r.width) + 'x' + Math.round(r.height));
      });
      d.querySelectorAll('.view:not(.hidden) .compound').forEach(b => {
        if (b.hidden) return;
        const r = b.getBoundingClientRect();
        if (r.width < 20 || r.height < 14) maus.push('badge pneu ' + Math.round(r.width) + 'x' + Math.round(r.height));
        if (r.right > w.innerWidth + 2) maus.push('badge pneu fora do ecra');
      });
      d.querySelectorAll('.view:not(.hidden) .compound-name').forEach(nm => {
        if (nm.scrollWidth > nm.clientWidth + 2) maus.push('nome do pneu cortado');
      });
      const cab = d.querySelector('.head');
      if (cab && cab.scrollWidth > cab.clientWidth + 2)
        maus.push('cabecalho ' + cab.scrollWidth + '>' + cab.clientWidth);

      if (maus.length) problemas += maus.length;
      linhas.push(vista.padEnd(11) + String(L).padStart(5) + 'px  ' + String(n).padStart(2)
        + ' cartoes  ' + (maus.length ? 'FALHAS: ' + maus.join(' | ') : 'ok'));
      f.remove();
    }
  }

  console.log('%c' + linhas.join('\n'), 'font-family:monospace');
  console.log(problemas
    ? '%c' + problemas + ' PROBLEMA(S) no layout'
    : '%cok: ' + (VISTAS.length * LARGURAS.length) + ' layouts sem problemas');
  return problemas;
})();
