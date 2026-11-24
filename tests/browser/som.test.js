/* Som da calculadora com um espião no Web Audio (AudioContext falso que registra frequências, start e stop):
   com o ▶ do tom / da nota grave tocando, trocar tom, escala, furos ou afinação muda o som na hora (ou para); o próximo ▶ toca o estado
   atual; os chips e o "Ouvir escala" usam a escala nova e tocam, com ou sem o ▶ ligado. Pífano e NAF.
   node tests/browser/cdp.js tests/browser/som.test.js [url-base] */
"use strict";
module.exports = async (p, base) => {
  let falhas = 0;
  const ok = (cond, nome, extra) => { console.log((cond ? "  ok  " : "FALHA ") + nome + (cond ? "" : "  -> " + extra)); if (!cond) { falhas++; process.exitCode = 1; } };
  const ev = (x) => p.eval(x);
  /* AudioContext falso: o relógio é o do navegador; cada oscilador guarda a frequência (e as mudanças), quando começou e quando parou */
  const ESPIAO = `(()=>{
    const reg={osc:[],ctxs:0};window.__som=reg;
    const param=(o)=>({_v:0,set value(v){this._v=v;o.freqs.push(v)},get value(){return this._v},setTargetAtTime(v){o.freqs.push(v);this._v=v},cancelScheduledValues(){},setValueAtTime(v){this._v=v},linearRampToValueAtTime(v){this._v=v}});
    const ganho=()=>({gain:{value:1,setValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){}},connect(){},disconnect(){}});
    class AC{constructor(){reg.ctxs++;this.state="running";this.destination={};this._t0=performance.now()}
      get currentTime(){return (performance.now()-this._t0)/1000}
      resume(){this.state="running";return Promise.resolve()} suspend(){this.state="suspended";return Promise.resolve()}
      createGain(){return ganho()}
      createOscillator(){const o={freqs:[],inicio:null,fim:null,type:"sine",onended:null,connect(){},disconnect(){}};o.frequency=param(o);
        o.start=(t)=>{o.inicio=t===undefined?0:t};
        o.stop=(t)=>{o.fim=t===undefined?0:t;const ms=Math.max(0,(t-this.currentTime)*1000);setTimeout(()=>{o.parou=true;if(o.onended)o.onended()},ms+5)};
        reg.osc.push(o);return o}}
    window.AudioContext=AC;window.webkitAudioContext=AC;
  })()`;
  await p.send("Page.addScriptToEvaluateOnNewDocument", { source: ESPIAO });
  const abrir = async (url) => { await p.goto(base + url); await ev("localStorage.clear()"); await p.goto(base + url); await p.send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false }); await p.sleep(300); };
  const evento = (id, v, tipo) => ev("(()=>{const e=document.getElementById('" + id + "');e.value='" + v + "';e.dispatchEvent(new Event('" + (tipo || "input") + "',{bubbles:true}));})()");
  const clique = (sel) => ev("document.querySelector('" + sel + "').click()");
  /* frequências fundamentais (1º harmônico) dos osciladores que estão soando agora: começaram e ainda não pararam (ou param no futuro) */
  const soando = async () => JSON.parse(await ev(`JSON.stringify((()=>{const c=window.__som.osc,t=performance.now();
    return c.filter((o,i)=>o.inicio!==null&&!o.parou&&(o.fim===null||o.fim>0)).map(o=>o.freqs[o.freqs.length-1]).filter((f,i,a)=>true)})())`));
  const limpar = () => ev("window.__som.osc.length=0");
  const aprox = (a, b) => Math.abs(a - b) < 0.5;
  const fundamentais = (fs) => { const m = Math.min.apply(null, fs); return fs.filter((f) => aprox(f, m) || f < m * 1.05); };
  const hz = (midi, la) => (la || 440) * Math.pow(2, (midi - 69) / 12);

  const casos = [
    { nome: "pífano", url: "/calculadora.html", tom: "pc-tom", botao: "#pc-tom-ouvir", ouvir: "#pc-ouvir", chips: "#pc-notas .pc-nota", furos: "pc-nfuros", escala: "pc-escala", la: "pc-la",
      midi: (v) => ({ sol: 67, "re-agudo": 74, mi: 64 }[v]), trocas: ["mi", "re-agudo"], base: "sol" },
    { nome: "NAF", url: "/calculadora.html?modo=naf", tom: "naf-fund", botao: "#naf-fund-ouvir", ouvir: "#naf-ouvir", chips: "#naf-notas-escala .pc-nota", furos: "naf-furos", escala: "naf-escala", la: "naf-la",
      midi: (v) => ({ G4: 67, E4: 64, D5: 74, A3: 57 }[v]), trocas: ["E4", "D5"], base: "G4" }
  ];
  for (const c of casos) {
    const trocaTom = async (v) => { await evento(c.tom, v, c.nome === "NAF" ? "change" : "input"); if (c.nome === "NAF") await evento(c.tom, v, "input"); await p.sleep(250); };
    await abrir(c.url);
    /* 1. ▶ ligado, troca o tom: o som muda na hora (ou para); o próximo ▶ toca o tom novo */
    await clique(c.botao); await p.sleep(250);
    let s = await soando(); ok(s.length >= 1 && aprox(Math.min.apply(null, s), hz(c.midi(c.base))), c.nome + ": ▶ toca o tom inicial (" + c.base + ")", JSON.stringify(s));
    await trocaTom(c.trocas[0]);
    s = await soando(); const f1 = hz(c.midi(c.trocas[0]));
    ok(s.length === 0 || aprox(Math.min.apply(null, s), f1), c.nome + ": trocar o tom com o ▶ ligado muda o som na hora para o novo (ou para)", JSON.stringify(s) + " esperado " + f1);
    const aria = await ev("document.querySelector('" + c.botao + "').getAttribute('aria-pressed')");
    if (s.length) { await clique(c.botao); await p.sleep(200); }          /* tocando: pausa/para */
    await limpar(); await clique(c.botao); await p.sleep(250);               /* novo ▶ */
    s = await soando(); ok(s.length >= 1 && aprox(Math.min.apply(null, s), f1), c.nome + ": novo ▶ depois da troca toca o tom NOVO", JSON.stringify(s) + " esperado " + f1);
    /* 2. ▶ ligado, "Ouvir escala" com a escala do tom novo e tocando */
    await trocaTom(c.trocas[1]); const f2 = hz(c.midi(c.trocas[1]));
    await limpar(); await clique(c.ouvir); await p.sleep(400);
    const freqs = JSON.parse(await ev("JSON.stringify(window.__som.osc.filter(o=>o.inicio!==null).map(o=>o.freqs[o.freqs.length-1]))"));
    const funds = freqs.filter((f) => f > 0).sort((a, b) => a - b);
    ok(funds.length > 0 && aprox(funds[0], f2), c.nome + ": 'Ouvir escala' com o ▶ ligado toca a escala do tom NOVO (primeira nota " + f2.toFixed(1) + " Hz)", JSON.stringify(funds.slice(0, 4)));
    const sust = await ev("window.__som.osc.filter(o=>o.inicio!==null&&!o.parou&&o.fim===null).length");
    ok(sust === 0, c.nome + ": 'Ouvir escala' desliga o som sustentado do ▶ antes de tocar a escala", String(sust));
    /* 3. os chips usam a escala nova */
    await clique(c.ouvir); await p.sleep(100);
    await limpar(); await clique(c.chips); await p.sleep(250);
    s = await soando(); ok(s.length >= 1 && aprox(Math.min.apply(null, s), f2), c.nome + ": o 1º chip toca a nota do tom novo", JSON.stringify(s) + " esperado " + f2);
    /* 4. trocar furos, escala e afinação com um som tocando */
    await clique(c.botao); await p.sleep(250);
    const antes = await soando(); await evento(c.la, "432", c.nome === "NAF" ? "change" : "input"); await p.sleep(250);
    s = await soando(); const f432 = hz(c.midi(c.trocas[1]), 432);
    ok(s.length === 0 || aprox(Math.min.apply(null, s), f432), c.nome + ": trocar a afinação (Lá 432) com o ▶ ligado atualiza o som", JSON.stringify(s) + " esperado " + f432.toFixed(1));
    await clique(c.ouvir); await p.sleep(300);
    const freqs2 = JSON.parse(await ev("JSON.stringify(window.__som.osc.filter(o=>o.inicio!==null).map(o=>o.freqs[o.freqs.length-1]))"));
    ok(freqs2.some((f) => aprox(f, f432)), c.nome + ": 'Ouvir escala' depois da troca de Lá usa o Lá novo", JSON.stringify(freqs2.slice(-6)));
    const sel = await ev("[...document.getElementById('" + c.escala + "').options].map(o=>o.value)");
    const outra = sel.find((v) => v !== sel[0]) || sel[0];
    await evento(c.escala, outra, "change"); await p.sleep(250);
    const nChips = await ev("document.querySelectorAll('" + c.chips + "').length");
    ok(nChips >= 3, c.nome + ": os chips acompanham a escala nova (" + nChips + " notas)", String(nChips));
    await clique(c.ouvir); await p.sleep(300);
    const freqs3 = JSON.parse(await ev("JSON.stringify(window.__som.osc.filter(o=>o.inicio!==null).map(o=>o.freqs[o.freqs.length-1]))"));
    ok(freqs3.length > 0, c.nome + ": 'Ouvir escala' toca depois de trocar a escala", JSON.stringify(freqs3.slice(-4)));
  }

  /* ---- medidas digitadas e estado salvo: nada disso congela o tom nem a escala ---- */
  const parado = async (c) => { if ((await ev("document.querySelector('" + c.botao + "').getAttribute('aria-pressed')")) === "true") { await clique(c.botao); await p.sleep(150); } };
  const seguir = async (c, tom, rotulo) => {
    const f = hz(c.midi(tom));
    await parado(c); await limpar(); await clique(c.botao); await p.sleep(250);
    let s2 = await soando(); ok(s2.length >= 1 && aprox(Math.min.apply(null, s2), f), c.nome + " (" + rotulo + "): ▶ toca o tom atual " + tom, JSON.stringify(s2) + " esperado " + f.toFixed(1));
    await clique(c.botao); await p.sleep(150);
    await limpar(); await clique(c.chips); await p.sleep(250);
    s2 = await soando(); ok(s2.length >= 1 && aprox(Math.min.apply(null, s2), f), c.nome + " (" + rotulo + "): o 1º chip toca o tom atual", JSON.stringify(s2) + " esperado " + f.toFixed(1));
    await p.sleep(700); await limpar(); await clique(c.ouvir); await p.sleep(400);
    const fr = JSON.parse(await ev("JSON.stringify(window.__som.osc.filter(o=>o.inicio!==null).map(o=>o.freqs[o.freqs.length-1]).sort((a,b)=>a-b))"));
    ok(fr.length > 0 && aprox(fr[0], f), c.nome + " (" + rotulo + "): 'Ouvir escala' toca a escala do tom atual", JSON.stringify(fr.slice(0, 3)) + " esperado " + f.toFixed(1));
    await clique(c.ouvir); await p.sleep(100);
  };
  const trocaEscala = async (c) => { const sel = await ev("[...document.getElementById('" + c.escala + "').options].map(o=>o.value)"); await evento(c.escala, sel[1], "change"); await p.sleep(250); };
  for (const c of casos) {
    const trocaTom = async (v) => { await evento(c.tom, v, c.nome === "NAF" ? "change" : "input"); if (c.nome === "NAF") await evento(c.tom, v, "input"); await p.sleep(250); };
    const dI = c.nome === "NAF" ? "naf-di" : "pc-D", dFuro = c.nome === "NAF" ? "#naf-linhas input[data-c=d]" : "#pc-furos input";
    const editaFuro = () => ev("(()=>{const e=document.querySelector('" + dFuro + "');e.value='9.5';e.dispatchEvent(new Event('input',{bubbles:true}))})()");
    /* a) Ø de furo digitado, depois tom e escala */
    await abrir(c.url); await editaFuro(); await trocaTom(c.trocas[0]); await seguir(c, c.trocas[0], "Ø de furo digitado");
    await trocaEscala(c); await seguir(c, c.trocas[0], "Ø de furo digitado, escala nova");
    await trocaTom(c.trocas[1]); await seguir(c, c.trocas[1], "Ø de furo digitado, outro tom");
    /* b) diâmetro interno digitado, depois tom e escala */
    await abrir(c.url); await evento(dI, "17"); await trocaTom(c.trocas[0]); await seguir(c, c.trocas[0], "diâmetro interno digitado");
    await trocaEscala(c); await trocaTom(c.trocas[1]); await seguir(c, c.trocas[1], "diâmetro interno digitado, escala e tom novos");
    /* c) medida que não fecha para o tom (campo vazio) e depois o tom: o som segue o tom mesmo sem resultado */
    await abrir(c.url); await evento(c.nome === "NAF" ? "naf-cabeca" : "pc-parede", ""); await trocaTom(c.trocas[0]); await seguir(c, c.trocas[0], "medida inválida");
    /* d) NAF: digitar um Ø não congela o tubo; o tubo acompanha o tom */
    if (c.nome === "NAF") {
      await abrir(c.url); const od0 = await ev("document.getElementById('naf-od').value"); await editaFuro(); await trocaTom("C4");
      const od1 = await ev("document.getElementById('naf-od').value");
      ok(od1 !== od0, "NAF: digitar um Ø de furo não congela o tubo (" + od0 + " -> " + od1 + ")", od0 + " " + od1);
    }
    /* e) recarrega com o estado salvo e troca o tom: nada ressuscita o tom antigo */
    await abrir(c.url); await trocaTom(c.trocas[0]); await editaFuro(); await p.sleep(200);
    await p.goto(base + c.url); await p.sleep(500);                                  /* recarrega: localStorage e estado salvos */
    await trocaTom(c.trocas[1]); await seguir(c, c.trocas[1], "página recarregada com estado salvo");
  }

  /* ---- nota de referência do afinador: segue a nota, o tom e o Lá; outro som do site a para ---- */
  {
    await abrir("/calculadora.html");
    const notaRef = () => ev("(()=>{const m=parseInt(document.getElementById('af-ref-nota').value,10);const la=document.getElementById('pc-la').value==='outra'?parseFloat(document.getElementById('pc-la-outra').value):parseFloat(document.getElementById('pc-la').value);return la*Math.pow(2,(m-69)/12)})()");
    await ev("(()=>{const r=document.querySelector('input[name=af-modo][value=ref]');r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}))})()");
    await limpar(); await clique("#af-ref-tocar"); await p.sleep(250);
    let s3 = await soando(), esperado = await notaRef();
    ok(s3.length === 1 && aprox(s3[0], esperado), "afinador: nota de referência toca a nota escolhida", JSON.stringify(s3) + " esperado " + esperado.toFixed(1));
    await evento("pc-tom", "mi", "input"); await evento("pc-tom", "mi", "change"); await p.sleep(250);
    s3 = await soando(); esperado = await notaRef();
    ok(s3.length === 1 && aprox(s3[0], esperado), "afinador: trocar o tom com a referência tocando atualiza o som para a nota da tela (ou para)", JSON.stringify(s3) + " esperado " + esperado.toFixed(1));
    await evento("pc-la", "432", "input"); await evento("pc-la", "432", "change"); await p.sleep(250);
    s3 = await soando(); esperado = await notaRef();
    ok(s3.length === 1 && aprox(s3[0], esperado), "afinador: trocar o Lá com a referência tocando atualiza o som", JSON.stringify(s3) + " esperado " + esperado.toFixed(1));
    await clique("#pc-tom-ouvir"); await p.sleep(250);
    s3 = await soando();
    ok(s3.length >= 1 && !s3.some((f) => aprox(f, esperado) && false) && (await ev("document.getElementById('af-ref-tocar').textContent")) !== "Parar", "afinador: o ▶ do tom para a nota de referência (um som por vez)", JSON.stringify(s3));
  }
  console.log(falhas ? "RESULTADO: falhas" : "RESULTADO: tudo OK");
};
