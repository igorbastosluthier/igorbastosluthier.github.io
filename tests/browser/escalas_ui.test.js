/* Escalas, quantidade de furos e "Ouvir escala" na tela (Pífano e NAF), em navegador real.
   Rodar: node tests/browser/cdp.js tests/browser/escalas_ui.test.js [url-base] */
"use strict";
module.exports = async (p, base) => {
  let falhas = 0;
  const ok = (cond, nome, extra) => { console.log((cond ? "  ok  " : "FALHA ") + nome + (cond ? "" : "  -> " + extra)); if (!cond) { falhas++; process.exitCode = 1; } };
  const ev = (x) => p.eval(x);
  /* clique como gesto do usuário (o áudio do navegador só liga com um toque) */
  const clicar = async (id) => { await p.send("Runtime.evaluate", { expression: "document.getElementById('" + id + "').click()", userGesture: true }); await p.sleep(150); };
  const set = (id, v) => ev("(()=>{const e=document.getElementById('" + id + "');e.value='" + v + "';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  const txt = (id) => ev("document.getElementById('" + id + "').textContent");
  const opcoes = (id) => ev("[...document.getElementById('" + id + "').options].map(o=>o.value)");
  await p.send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });

  /* ---- Pífano ---- */
  await p.goto(base + "/calculadora.html"); await ev("localStorage.clear()"); await p.goto(base + "/calculadora.html");
  ok((await ev("document.getElementById('pc-nfuros').value")) === "6" && (await ev("document.getElementById('pc-escala').value")) === "diatonica-maior-jonia", "pífano abre com 6 furos na escala maior");
  let o6 = await opcoes("pc-escala");
  ok(o6.includes("nordestina-lidio-7-baiao-pifano") && !o6.includes("pentatonica-menor"), "pífano 6 furos: tem a nordestina, não tem pentatônica", o6.join(","));
  ok((await ev("document.querySelectorAll('#pc-tabela tbody tr').length")) === 6 && !(await ev("document.getElementById('digitacao').hidden")), "6 furos: tabela com 6 linhas e tabela de digitação visível");
  await set("pc-escala", "nordestina-lidio-7-baiao-pifano"); await p.sleep(150);
  const notasN = await ev("[...document.querySelectorAll('#pc-tabela tbody tr td:nth-child(2)')].map(t=>t.textContent).join(',')");
  ok(notasN === "Lá 4,Si 4,Dó# 5,Ré 5,Mi 5,Fá 5", "Sol nordestina: Lá Si Dó# Ré Mi Fá", notasN);
  ok(await ev("document.getElementById('digitacao').hidden"), "escala diferente da maior: esconde a tabela de digitação (é a do pife comum)");
  ok(/nordestina/.test(decodeURIComponent(await ev("location.hash"))), "escala vai para o link");
  await set("pc-nfuros", "5"); await p.sleep(150);
  const o5 = await opcoes("pc-escala");
  ok(o5.includes("pentatonica-menor") && !o5.includes("diatonica-maior-jonia"), "5 furos: só escalas de 5 ou 6 notas", o5.join(","));
  ok((await ev("document.querySelectorAll('#pc-furos input').length")) === 5 && (await ev("document.querySelectorAll('#pc-tabela tbody tr').length")) === 5, "5 furos: 5 campos e 5 linhas na tabela");
  ok((await ev("document.querySelector('#pc-desenho svg') !== null")), "desenho com 5 furos");
  await set("pc-nfuros", "7"); await p.sleep(150);
  ok((await ev("document.querySelectorAll('#pc-tabela tbody tr').length")) === 7, "7 furos: 7 linhas");
  /* reabrir pelo link mantém escala e furos */
  const link = await ev("location.href");
  await p.goto(base + "/index.html"); await p.goto(link);
  ok((await ev("document.getElementById('pc-nfuros').value")) === "7" && (await ev("document.querySelectorAll('#pc-tabela tbody tr').length")) === 7, "link reabre com 7 furos e a mesma escala", await ev("document.getElementById('pc-escala').value"));
  /* link antigo (sem escala) = pife de 6 furos na escala maior */
  await p.goto(base + "/index.html");
  await p.goto(base + "/calculadora.html#" + encodeURIComponent(JSON.stringify({ tom: "sol", la: 440, temp: 25, D: 18, parede: 4, emb: 10, embForma: "redondo", furos: [8, 10, 7, 10, 10, 10] })));
  ok((await ev("document.getElementById('pc-escala').value")) === "diatonica-maior-jonia" && (await ev("document.querySelectorAll('#pc-tabela tbody tr').length")) === 6, "link antigo: 6 furos, escala maior");

  /* ouvir: botão alterna Ouvir / Pausar / Continuar; o som segue as notas calculadas */
  await ev("(()=>{window.__freqs=[];const C=window.AudioContext;const o=C.prototype.createOscillator;C.prototype.createOscillator=function(){const x=o.call(this);const s=x.start.bind(x);x.start=function(t){window.__freqs.push(x.frequency.value);return s(t)};return x}})()");
  ok((await txt("pc-ouvir")) === "▶ Ouvir escala", "botão começa em Ouvir escala");
  await ev("document.querySelector('input[name=pc-ouvir-modo][value=subir]').checked=true");
  await clicar("pc-ouvir");
  ok((await txt("pc-ouvir")) === "⏸ Pausar", "tocando: botão vira Pausar", await txt("pc-ouvir"));
  const fund = await ev("window.__freqs.filter((f,i)=>i%3===0)");
  ok(fund.length === 8 && Math.abs(fund[0] - 392) < 0.01 && Math.abs(fund[7] - 784) < 0.01, "Subir: 8 notas, Sol 4 até Sol 5 (Lá 440)", fund.join(","));
  await clicar("pc-ouvir");
  ok((await txt("pc-ouvir")) === "▶ Continuar" && (await ev("Escalas.estado()")) === "pausado", "Pausar: pausa e o botão vira Continuar");
  await clicar("pc-ouvir");
  ok((await txt("pc-ouvir")) === "⏸ Pausar", "Continuar: volta a tocar");
  await ev("Escalas.parar()");
  await ev("document.querySelector('input[name=pc-ouvir-modo][value=ida-e-volta]').checked=true; window.__freqs=[]");
  await set("pc-la", "432"); await p.sleep(100);
  await clicar("pc-ouvir");
  const iv = await ev("window.__freqs.filter((f,i)=>i%3===0)");
  ok(iv.length === 15 && Math.abs(iv[0] - 432 * Math.pow(2, -2 / 12)) < 0.01 && Math.abs(iv[14] - iv[0]) < 1e-6, "Ida e volta com Lá 432: 15 notas, volta à tônica", iv.length + " " + iv[0]);
  await ev("Escalas.parar()");

  /* ---- NAF ---- */
  await p.goto(base + "/calculadora.html?modo=naf"); await ev("localStorage.clear()"); await p.goto(base + "/calculadora.html?modo=naf");
  ok((await ev("document.getElementById('naf-escala').value")) === "pentatonica-menor", "NAF abre na pentatônica menor");
  const n5 = await opcoes("naf-escala");
  ok(n5.includes("yo-japonesa") && n5.includes("personalizada") && !n5.includes("dorica"), "NAF 5 furos: pentatônicas e hexatônicas + Personalizada", n5.join(","));
  await set("naf-furos", "6"); await p.sleep(200);
  const n6 = await opcoes("naf-escala");
  ok(n6.includes("dorica") && !n6.includes("yo-japonesa"), "NAF 6 furos: tem dórica, não tem Yo", n6.join(","));
  await set("naf-escala", "dorica"); await p.sleep(200);
  const nd = await ev("[...document.querySelectorAll('#naf-linhas [data-c=\"nota\"]')].map(e=>e.value).join(',')");
  ok(nd === "Lá 4,Si♭ 4,Dó 5,Ré 5,Mi 5,Fá 5" && (await ev("document.getElementById('naf-erros').innerText")) === "", "Sol dórica 6 furos: notas certas, sem erro", nd + " | " + (await ev("document.getElementById('naf-erros').innerText")));
  ok(/dorica/.test(decodeURIComponent(await ev("location.hash"))), "NAF: escala vai para o link");
  await ev("(()=>{const e=document.querySelector('#naf-linhas [data-k=\"4\"][data-c=\"nota\"]');e.value='Mi♭ 5';e.dispatchEvent(new Event('input',{bubbles:true}));})()");
  ok((await ev("document.getElementById('naf-escala').value")) === "personalizada" && /dórica/.test(await txt("naf-voltar-pent")), "editar nota: personalizada, botão volta à dórica", await txt("naf-voltar-pent"));
  await clicar("naf-voltar-pent");
  ok((await ev("document.getElementById('naf-escala').value")) === "dorica", "voltar: dórica de novo");
  await set("naf-escala", "pentatonica-menor"); await p.sleep(200);
  await ev("(()=>{window.__freqs=[];const C=window.AudioContext;const o=C.prototype.createOscillator;C.prototype.createOscillator=function(){const x=o.call(this);const s=x.start.bind(x);x.start=function(t){window.__freqs.push(x.frequency.value);return s(t)};return x}})()");
  await ev("document.querySelector('input[name=naf-ouvir-modo][value=subir]').checked=true");
  await clicar("naf-ouvir");
  const nf = await ev("window.__freqs.filter((f,i)=>i%3===0).map(f=>Math.round(1200*Math.log2(f/392)))");
  ok(nf.join(",") === "0,300,500,700,1000,1200" && (await txt("naf-ouvir")) === "⏸ Pausar", "NAF 6 furos pentatônica: toca a escala sem o furo extra", nf.join(","));
  await ev("Escalas.parar()");

  /* ---- página do afinador (cópia da calculadora do pife) ---- */
  await p.goto(base + "/afinador.html");
  ok((await ev("document.querySelectorAll('#pc-escala option').length")) > 10 && (await ev("document.querySelectorAll('#pc-tabela tbody tr').length")) === 6, "afinador.html: escala e tabela funcionam");
  await p.shot(require("path").join(process.env.TEMP, "escalas_pife.png"), 1200, 900);
  console.log(falhas ? "RESULTADO: " + falhas + " falha(s)" : "RESULTADO: tudo OK");
};
