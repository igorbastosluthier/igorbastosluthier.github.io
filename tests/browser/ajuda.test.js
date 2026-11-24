/* Todo "?" da calculadora (pífano e NAF) abre a explicação dele, com clique de mouse no computador e com toque no celular (1440 e 390 px).
   O clique é de verdade (Input.dispatchMouseEvent / dispatchTouchEvent no ponto do botão), então cobre também o que ficar por cima do botão.
   node tests/browser/cdp.js tests/browser/ajuda.test.js [url-base] */
"use strict";
module.exports = async (p, base) => {
  let falhas = 0;
  const ok = (cond, nome, extra) => { console.log((cond ? "  ok  " : "FALHA ") + nome + (cond ? "" : "  -> " + extra)); if (!cond) { falhas++; process.exitCode = 1; } };
  const ev = (x) => p.eval(x);
  const abrir = async (url, w) => {
    await p.send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 700 });
    await p.send("Emulation.setTouchEmulationEnabled", { enabled: w < 700 });
    await p.goto(base + url); await ev("localStorage.clear()"); await p.goto(base + url); await p.sleep(400);
  };
  /* o "?" que cada aba mostra (a outra aba fica escondida) */
  const lista = async (painel) => JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('${painel} .pc-ajuda')].filter(b=>b.offsetParent!==null).map((b,i)=>({i,id:b.getAttribute('aria-controls'),rot:b.getAttribute('aria-label')})))`));
  /* leva o botão ao meio da tela sem animação e só então lê onde ele está (o site rola suave; coordenadas lidas no meio da rolagem errariam o clique) */
  const centro = async (painel, i) => {
    await ev(`(()=>{document.documentElement.style.scrollBehavior='auto';const b=[...document.querySelectorAll('${painel} .pc-ajuda')].filter(b=>b.offsetParent!==null)[${i}];b.scrollIntoView({block:'center',behavior:'instant'})})()`);
    await p.sleep(200);
    return JSON.parse(await ev(`JSON.stringify((()=>{const b=[...document.querySelectorAll('${painel} .pc-ajuda')].filter(b=>b.offsetParent!==null)[${i}];const r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}})())`));
  };
  const toque = async (x, y, celular) => {
    if (celular) { await p.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] }); await p.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
    else { await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }); await p.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }); await p.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }); }
    await p.sleep(120);
  };
  const estado = async (painel, i) => JSON.parse(await ev(`JSON.stringify((()=>{const b=[...document.querySelectorAll('${painel} .pc-ajuda')].filter(b=>b.offsetParent!==null)[${i}];const t=document.getElementById(b.getAttribute('aria-controls'));
    const r=t?t.getBoundingClientRect():{width:0,height:0};return {exp:b.getAttribute('aria-expanded'),ha:!!t,hidden:t?t.hidden:null,visivel:!!t&&!t.hidden&&r.width>0&&r.height>0&&getComputedStyle(t).visibility!=='hidden'&&getComputedStyle(t).display!=='none',texto:t?t.textContent.trim().length:0}})())`));
  for (const w of [1440, 390]) {
    const celular = w < 700;
    for (const [nome, url, painel] of [["pífano", "/calculadora.html", "#modo-pife"], ["NAF", "/calculadora.html?modo=naf", "#modo-naf"], ["afinador.html", "/afinador.html", "body"]]) {
      await abrir(url, w);
      await ev("document.querySelectorAll('details').forEach(d=>d.open=true)"); await p.sleep(150); /* o ? de dentro de \"Mais medidas\" só se vê com ela aberta */
      const bs = await lista(painel);
      ok(bs.length >= 8, nome + " " + w + " px: " + bs.length + " botões ?", String(bs.length));
      let ruins = [];
      for (const b of bs) {
        const c = await centro(painel, b.i);
        await toque(c.x, c.y, celular);
        let st = await estado(painel, b.i);
        if (st.exp !== "true" || !st.visivel || st.texto < 5) ruins.push(b.rot + " (" + b.id + "): " + JSON.stringify(st));
        else { const c2 = await centro(painel, b.i); await toque(c2.x, c2.y, celular); const fe = await estado(painel, b.i); if (fe.exp !== "false" || fe.visivel) ruins.push(b.rot + ": não fecha " + JSON.stringify(fe)); }
      }
      ok(ruins.length === 0, nome + " " + w + " px: todo ? abre e fecha a explicação (" + (celular ? "toque" : "clique") + ")", ruins.join(" | "));
      /* o ? do resultado ("alcance") leva ao guia: o ponto existe e o clique de verdade leva até ele */
      const q = await ev("(()=>{const a=document.querySelector('" + painel + " .pc-q');return a?a.getAttribute('href'):null})()");
      if (q) {
        ok(await ev("!!document.querySelector('" + q + "')"), nome + " " + w + " px: o ? do alcance leva a um ponto que existe na página (" + q + ")", q);
        await ev("(()=>{window.scrollTo(0,0);document.documentElement.style.scrollBehavior='auto';const a=document.querySelector('" + painel + " .pc-q');a.scrollIntoView({block:'center',behavior:'instant'})})()"); await p.sleep(250);
        const c = JSON.parse(await ev("JSON.stringify((()=>{const r=document.querySelector('" + painel + " .pc-q').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,sy:scrollY}})())"));
        await toque(c.x, c.y, celular); await p.sleep(500);
        const dep = JSON.parse(await ev("JSON.stringify({sy:scrollY,hash:location.hash,topo:(document.querySelector('" + q + "')||{getBoundingClientRect:()=>({top:-9999})}).getBoundingClientRect().top})"));
        ok(dep.hash === q && Math.abs(dep.topo) < 400, nome + " " + w + " px: clicar no ? do alcance vai até o guia", JSON.stringify(dep) + " antes " + c.sy);
      }    }
  }

  /* ---- o ? não depende de a calculadora ter iniciado ---- */
  await p.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.__erros=[];window.addEventListener('error',e=>window.__erros.push(String(e.message)));" });
  await p.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await p.send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  const primeiro = async (painel) => { await ev("document.querySelectorAll('details').forEach(d=>d.open=true)"); const c = await centro(painel, 0); await toque(c.x, c.y, false); return estado(painel, 0); };
  /* scripts da calculadora que não carregam (rede, cache velho): o ? continua abrindo */
  await p.send("Network.enable"); await p.send("Network.setBlockedURLs", { urls: ["*pife-ui.js*", "*naf-ui.js*", "*pife-afinador.js*"] });
  for (const [nome, url, painel] of [["pífano", "/calculadora.html", "#modo-pife"], ["afinador.html", "/afinador.html", "body"]]) {
    await p.goto(base + url); await p.sleep(500);
    const st = await primeiro(painel);
    ok(st.exp === "true" && st.visivel, nome + ": com os scripts da calculadora bloqueados, o ? ainda abre a explicação", JSON.stringify(st));
  }
  await p.send("Network.setBlockedURLs", { urls: [] });
  /* estado salvo que não serve mais não derruba a calculadora nem o ? */
  for (const [nome, chave, est, url, painel, linhas] of [
    ["pífano com tom que não existe", "pifeCalc.v1", { tom: "mi-3", la: 440, temp: 25, D: 18, parede: 4, emb: 10, nf: 6, furos: [8, 10, 7, 10, 10, 10] }, "/calculadora.html", "#modo-pife", "#pc-tabela tbody tr"],
    ["pífano com valores fora do lugar", "pifeCalc.v1", { tom: "sol", la: "x", D: "abc", nf: 9, furos: "oi" }, "/calculadora.html", "#modo-pife", "#pc-tabela tbody tr"],
    ["NAF com nota grave que não existe", "nafCalc.v1", { f: 6, fu: "Z9", es: "pentatonica-menor", a4: "440", t: "20", od: "26", p: "3", jc: "10", jl: "11", ja: "3", c: "100", po: "0", m: 1, l: [] }, "/calculadora.html?modo=naf", "#modo-naf", "#naf-tabela tbody tr"],
    ["NAF com linhas sem sentido", "nafCalc.v1", { f: 6, fu: "G4", es: "nao-existe", a4: "440", t: "20", od: "26", p: "3", jc: "10", jl: "11", ja: "3", c: "100", po: "0", m: 1, dd: 1, l: [null, "x", [1]] }, "/calculadora.html?modo=naf", "#modo-naf", "#naf-tabela tbody tr"]]) {
    await p.goto(base + url); await ev("localStorage.clear()");
    await ev("localStorage.setItem(" + JSON.stringify(chave) + "," + JSON.stringify(JSON.stringify(est)) + ")");
    await p.goto(base + url); await p.sleep(500);
    const erros = JSON.parse(await ev("JSON.stringify(window.__erros)")), n = await ev("document.querySelectorAll('" + linhas + "').length");
    const st = await primeiro(painel);
    ok(erros.length === 0 && n >= 5 && st.exp === "true" && st.visivel, nome + ": a calculadora abre sem erro, mostra o resultado e o ? abre (" + n + " furos)", JSON.stringify({ erros, n, st }));
  }
  console.log(falhas ? "RESULTADO: falhas" : "RESULTADO: tudo OK");
};
