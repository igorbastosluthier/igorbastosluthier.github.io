/* O diâmetro interno acompanha o tom (pífano) / a nota grave (NAF) até a pessoa digitar o dela; "Voltar aos tamanhos sugeridos" volta ao
   automático. E a ordem dos campos é a mesma nas duas abas: tom / nota grave primeiro, depois furos e escala.
   node tests/browser/cdp.js tests/browser/tubo_auto.test.js [url-base] */
"use strict";
module.exports = async (p, base) => {
  let falhas = 0;
  const ok = (cond, nome, extra) => { console.log((cond ? "  ok  " : "FALHA ") + nome + (cond ? "" : "  -> " + extra)); if (!cond) { falhas++; process.exitCode = 1; } };
  const ev = (x) => p.eval(x);
  const evento = (id, v, tipo) => ev("(()=>{const e=document.getElementById('" + id + "');e.value='" + v + "';e.dispatchEvent(new Event('" + (tipo || "input") + "',{bubbles:true}));})()");
  const val = (id) => ev("document.getElementById('" + id + "').value");
  const abrir = async (url) => { await p.goto(base + url); await ev("localStorage.clear()"); await p.goto(base + url); await p.send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false }); await p.sleep(300); };

  /* ordem dos campos */
  await abrir("/calculadora.html");
  const ordP = await ev("[...document.querySelectorAll('#modo-pife fieldset:first-of-type .pc-campo>label')].slice(0,3).map(l=>l.getAttribute('for')).join(',')");
  ok(ordP === "pc-tom,pc-nfuros,pc-escala", "pífano: tom, furos, escala nessa ordem", ordP);
  await abrir("/calculadora.html?modo=naf");
  const ordN = await ev("[...document.querySelectorAll('#modo-naf fieldset:first-of-type .pc-campo>label')].slice(0,3).map(l=>l.getAttribute('for')).join(',')");
  ok(ordN === "naf-fund,naf-furos,naf-escala", "NAF: nota grave, furos, escala nessa ordem (igual ao pífano)", ordN);

  /* pífano */
  await abrir("/calculadora.html");
  const sug = (tom) => ev("PifeCalc.tuboSugerido('" + tom + "')");
  const tons = JSON.parse(await ev("JSON.stringify([...document.getElementById('pc-tom').options].map(o=>o.value))"));
  const outro = tons.find(t => t !== "sol");
  await evento("pc-tom", outro, "input"); await p.sleep(150);
  ok(parseFloat(await val("pc-D")) === await sug(outro), "pífano: trocar o tom muda o diâmetro interno para o indicado (" + outro + ")", await val("pc-D") + " vs " + await sug(outro));
  await evento("pc-D", "21"); await evento("pc-tom", "sol", "input"); await p.sleep(150);
  ok(parseFloat(await val("pc-D")) === 21, "pífano: depois de digitar o diâmetro, trocar o tom respeita o valor digitado", await val("pc-D"));
  await ev("document.getElementById('pc-sugerir').click()"); await p.sleep(150);
  ok(parseFloat(await val("pc-D")) === await sug("sol"), "pífano: Voltar aos tamanhos sugeridos volta ao automático", await val("pc-D"));
  await evento("pc-tom", outro, "input"); await p.sleep(150);
  ok(parseFloat(await val("pc-D")) === await sug(outro), "pífano: e volta a acompanhar o tom", await val("pc-D"));

  /* NAF */
  await abrir("/calculadora.html?modo=naf");
  const od0 = await val("naf-od");
  await evento("naf-fund", "C4", "change"); await p.sleep(200);
  const od1 = await val("naf-od");
  ok(od1 !== od0 && parseFloat(od1) > parseFloat(od0), "NAF: nota mais grave pede tubo maior (" + od0 + " -> " + od1 + ")", od0 + " " + od1);
  await evento("naf-od", "33"); await evento("naf-fund", "A4", "change"); await p.sleep(200);
  ok(parseFloat(await val("naf-od")) === 33, "NAF: depois de digitar o diâmetro, trocar a nota respeita o valor digitado", await val("naf-od"));
  await ev("document.getElementById('naf-sugerir').click()"); await p.sleep(200);
  ok(parseFloat(await val("naf-od")) !== 33, "NAF: Voltar aos tamanhos sugeridos volta ao automático", await val("naf-od"));
  const odA4 = await val("naf-od");
  await evento("naf-fund", "C4", "change"); await p.sleep(200);
  ok((await val("naf-od")) !== odA4, "NAF: e volta a acompanhar a nota grave", odA4 + " " + await val("naf-od"));
  console.log(falhas ? "RESULTADO: falhas" : "RESULTADO: tudo OK");
};
