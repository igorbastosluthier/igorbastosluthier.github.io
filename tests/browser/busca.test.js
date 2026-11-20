/* Busca no navegador (Chrome headless via cdp.js):
     python -m http.server 8765   (na raiz do site, em outro terminal)
     node tests/browser/cdp.js tests/browser/busca.test.js
   Fotos da tela: defina BUSCA_FOTOS=<pasta> para gravar busca-desktop.png e busca-celular.png. */
const path = require("path"), fs = require("fs");
module.exports = async (page, base) => {
  const fotos = process.env.BUSCA_FOTOS;
  if (fotos) fs.mkdirSync(fotos, { recursive: true });
  let falhas = 0;
  const confere = (ok, msg) => { console.log((ok ? "  ok   " : "  FALHOU ") + msg); if (!ok) falhas++; };
  const tamanho = (w, h) => page.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 });
  const espera = async (expr, ms = 4000) => { for (let t = 0; t < ms; t += 100) { if (await page.eval(expr)) return true; await page.sleep(100); } return false; };

  /* 1. todas as paginas: botao no cabecalho, sem rolagem lateral no celular, cabecalho cabe no computador */
  const paginas = ["index.html", "pifanos.html", "irlandesa.html", "nativas.html", "estojos.html", "galeria.html", "valores.html",
    "perguntas.html", "monte.html", "tabelas.html", "afinador.html", "calculadora.html", "sobre.html", "privacidade.html", "busca.html"];
  for (const w of [1600, 1440, 1366, 1280, 1200, 1024, 390]) {
    await tamanho(w, 900);
    for (const p of paginas) {
      await page.goto(base + "/" + p);
      await espera("document.readyState==='complete'", 8000);
      const r = await page.eval(`(function(){var b=document.querySelector('header.site [data-busca]');if(!b)return 'sem botao';var r=b.getBoundingClientRect();
        if(r.width<30||r.right>innerWidth+0.5||r.left<0)return 'botao fora: '+JSON.stringify(r);
        var inn=document.querySelector('header.site .in');if(inn.scrollWidth>inn.clientWidth+1)return 'cabecalho estourou '+inn.scrollWidth+'>'+inn.clientWidth;
        if(document.documentElement.scrollWidth>innerWidth+1)return 'rolagem lateral '+document.documentElement.scrollWidth;
        if(!document.querySelector('footer a[href="https://www.siterastreio.com.br/"]'))return 'sem Rastreamento no rodape';return 'ok'})()`);
      if (r !== "ok") confere(false, `${p} @${w}px: ${r}`);
    }
  }
  confere(true, "botao da busca em " + paginas.length + " paginas x 7 larguras (falhas acima, se houver)");

  /* 2. painel: tecla "/", digitar "aguia" (sem acento), resultados com a peca do totem de aguia */
  await tamanho(1440, 900);
  await page.goto(base + "/index.html");
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "/", code: "Slash", text: "/" });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "/", code: "Slash" });
  confere(await espera("document.activeElement && document.activeElement.id==='busca-q'"), "tecla / abre a busca com o foco no campo");
  await page.send("Input.insertText", { text: "aguia" });
  confere(await espera("document.querySelectorAll('#busca-res .busca-it').length>0"), "resultados aparecem enquanto digita");
  const info = await page.eval(`(function(){var a=[].map.call(document.querySelectorAll('#busca-res .busca-it'),function(x){return x.textContent});
    return {n:a.length,primeiro:a[0],grupos:[].map.call(document.querySelectorAll('#busca-res .busca-g h3'),function(h){return h.textContent}),
    marcado:!!document.querySelector('#busca-res mark'),sel:!!document.querySelector('#busca-res .busca-it.sel')}})()`);
  console.log("  resultados para 'aguia':", JSON.stringify(info));
  confere(/[aá]guia/i.test(info.primeiro), "primeiro resultado fala de aguia");
  confere(info.marcado && info.sel, "palavra destacada e primeiro resultado selecionado");
  if (fotos) await page.shot(path.join(fotos, "busca-desktop.png"), 1440, 900);
  await tamanho(390, 844);
  await page.sleep(300);
  const cel = await page.eval(`(function(){var c=document.querySelector('.busca-caixa').getBoundingClientRect();return {w:c.width,h:c.height,lateral:document.querySelector('.busca-res').scrollWidth>document.querySelector('.busca-res').clientWidth+1}})()`);
  confere(cel.w === 390 && !cel.lateral, "no celular o painel ocupa a tela toda, sem rolagem lateral " + JSON.stringify(cel));
  if (fotos) await page.shot(path.join(fotos, "busca-celular.png"), 390, 844);

  /* 3. Enter abre o primeiro resultado; chega na peca destacada e visivel */
  await tamanho(1440, 900);
  const destino = await page.eval("document.querySelector('#busca-res .busca-it').getAttribute('href')");
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await page.sleep(800);
  await espera("document.readyState==='complete'", 8000);
  await page.sleep(300);
  const chegou = await page.eval(`(function(){var id=location.hash.slice(1),el=document.getElementById(id);if(!el)return 'sem alvo '+location.href;var r=el.getBoundingClientRect();
    return {url:location.pathname.split('/').pop()+location.hash,visivel:r.top<innerHeight&&r.bottom>0&&!el.closest('[hidden]'),destaque:el.classList.contains('busca-alvo')}})()`);
  console.log("  Enter ->", JSON.stringify(chegou));
  confere(chegou.url === destino && chegou.visivel && chegou.destaque, "Enter abre o primeiro resultado e mostra a peca");

  /* 4. peca guardada em "Trabalhos anteriores" e peca na galeria com filtro */
  const antigo = await page.eval("fetch('assets/busca.json').then(r=>r.json()).then(d=>d.itens.filter(i=>i.g==='p'&&/^pifanos/.test(i.u)).map(i=>i.u))");
  for (const u of [antigo[antigo.length - 1], "galeria.html#" + antigo[0].split("#")[1]]) {
    await page.goto(base + "/" + u);
    await page.sleep(500);
    const r = await page.eval(`(function(){var el=document.getElementById(location.hash.slice(1));if(!el)return 'sem alvo';var r=el.getBoundingClientRect();
      return (r.height>0&&r.top<innerHeight&&r.bottom>0&&!el.closest('[hidden]'))?'ok':'escondido '+JSON.stringify(r)})()`);
    confere(r === "ok", "link direto " + u + ": " + r);
  }

  /* 5. Esc fecha; nada encontrado sugere o WhatsApp; busca.html?q= funciona */
  await page.goto(base + "/sobre.html");
  await page.eval("var b=document.querySelector('[data-busca]');b.focus();b.click()");
  await page.send("Input.insertText", { text: "xyzqwk" });
  confere(await espera("!!document.querySelector('#busca-res .busca-nada a[href*=\"wa.me\"]')"), "nenhum resultado: mensagem com o WhatsApp");
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await page.sleep(200);
  confere(await page.eval("document.getElementById('busca').hidden && document.activeElement===document.querySelector('[data-busca]')"), "Esc fecha e devolve o foco ao botao");
  await page.goto(base + "/busca.html?q=roxinho%20sol");
  confere(await espera("document.querySelectorAll('#busca-pg-res .busca-it').length>3"), "busca.html?q=roxinho sol lista resultados");

  if (falhas) { console.log(falhas + " falha(s)"); process.exitCode = 1; } else console.log("OK: busca no navegador");
};
