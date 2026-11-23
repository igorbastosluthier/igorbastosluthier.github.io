/* Modo Básico | Avançado na tela (pedido do Igor, 23/11/2026): o Básico abre só com o essencial e sem frases fixas; o "?"
   abre e fecha; avisos aparecem só fora da faixa e somem; o Avançado muda a conta e o Básico volta aos padrões; alcance dos
   dedos com botão; sem "começar de um modelo"; link antigo abre no Avançado; celular sem rolagem para o lado.
   node tests/browser/cdp.js tests/browser/pife_modo_ui.test.js [url-base] */
"use strict";
module.exports = async (p, base) => {
  let falhas = 0;
  const ok = (cond, nome, extra) => { console.log((cond ? "  ok  " : "FALHA ") + nome + (cond ? "" : "  -> " + extra)); if (!cond) { falhas++; process.exitCode = 1; } };
  const ev = (x) => p.eval(x);
  const J = async (x) => JSON.parse(await ev("JSON.stringify((()=>{" + x + "})())"));
  const PRE = "const $=id=>document.getElementById(id),vis=el=>!!(el&&el.offsetParent!==null&&getComputedStyle(el).display!=='none')," +
    "set=(id,v)=>{const e=$(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},pe=()=>$('pc-resumo').querySelector('li b').textContent;";
  await p.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await p.goto(base + "/calculadora.html"); await ev("localStorage.clear()"); await p.goto(base + "/calculadora.html");

  let r = await J(PRE + `return {basico:$('pc-form').classList.contains('pc-basico'),
    avVis:['pc-la','pc-temp','pc-parede','pc-cone','pc-emb-forma','pc-lip-sim','pc-sugerir'].filter(id=>vis($(id))),
    baseVis:['pc-tom','pc-nfuros','pc-escala','pc-ouvir','pc-D','pc-emb'].filter(id=>!vis($(id))),
    alertas:[...document.querySelectorAll('.pc-alerta')].filter(vis).length, ajudas:[...document.querySelectorAll('#pc-form .pc-ajuda-txt')].filter(vis).length,
    linhas:document.querySelectorAll('#pc-tabela tbody tr').length, ok:$('pc-avisos').innerText, larg:document.documentElement.scrollWidth, w:innerWidth}`);
  ok(r.basico && !r.avVis.length && !r.baseVis.length, "abre no Básico: só tom, furos, escala, ouvir, tubo e sopro", JSON.stringify(r));
  ok(r.alertas === 0 && r.ajudas === 0 && /Tudo dentro do normal/.test(r.ok) && r.linhas === 6, "sem aviso nem explicação aberta; resultado normal", JSON.stringify(r));
  ok(r.larg <= r.w, "celular: sem rolagem para o lado (Básico)", r.larg + " > " + r.w);
  await p.shot(require("path").join(process.env.TEMP, "pife_modo_basico.png"), 390, 844);

  r = await J(PRE + `const b=document.querySelector('[aria-controls="aj-tom"]');b.click();const a1=vis($('aj-tom'))&&b.getAttribute('aria-expanded');b.click();return {a1,a2:vis($('aj-tom')),t:$('aj-tom').innerText}`);
  ok(r.a1 === "true" && !r.a2 && /todos os furos fechados/.test(r.t), "\"?\" do tom abre e fecha", JSON.stringify(r));

  const pe0 = await J(PRE + "return pe()");
  r = await J(PRE + `set('pc-D','25');const a=vis($('pc-al-D'))?$('pc-al-D').innerText:'';const u=$('pc-usar-tubo');if(u)u.click();return {a,depois:vis($('pc-al-D')),D:$('pc-D').value,emb:$('pc-emb').value}`);
  ok(/^Tubo largo para Sol 4/.test(r.a) && /usar 18,0 mm/.test(r.a) && !r.depois && r.D === "18" && r.emb === "10", "tubo largo: aviso com 'usar 18,0 mm', some ao usar", JSON.stringify(r));
  r = await J(PRE + `set('pc-emb','6');const a=vis($('pc-al-emb'))?$('pc-al-emb').innerText:'';set('pc-emb','10');return {a,depois:vis($('pc-al-emb'))}`);
  ok(/pequeno/.test(r.a) && !r.depois, "furo do sopro pequeno: aviso aparece e some", JSON.stringify(r));

  r = await J(PRE + `$('pc-modo-avancado').click();const v=['pc-la','pc-temp','pc-parede','pc-cone','pc-emb-forma','pc-lip-sim','pc-sugerir'].filter(id=>!vis($(id)));
    set('pc-temp','35');const p35=pe();$('pc-modo-basico').click();return {v,p35,pb:pe(),nota:!!document.getElementById('pc-modo-nota')}`);
  ok(!r.v.length, "Avançado mostra afinação, temperatura, parede, cone, formato, porta-lábios e furos", JSON.stringify(r.v));
  ok(r.p35 !== pe0 && r.pb === pe0 && !r.nota, "35 °C muda a conta no Avançado; o Básico volta aos 25 °C sem nenhuma frase sobre isso (Igor 23/11)", JSON.stringify(r) + " | " + pe0);
  r = await J(PRE + `$('pc-modo-avancado').click();const p=pe();set('pc-temp','25');return {av:!$('pc-form').classList.contains('pc-basico'),p,t:$('pc-temp').value}`);
  ok(r.av && r.p !== pe0, "voltar ao Avançado mantém os 35 °C guardados", JSON.stringify(r));

  r = await J(PRE + `$('pc-la').value='outra';$('pc-la').dispatchEvent(new Event('input',{bubbles:true}));const box=vis($('pc-la-outra-box'));set('pc-la-outra','500');
    const a=vis($('pc-al-la'))?$('pc-al-la').innerText:'';set('pc-la-outra','442');return {box,a,la:window.PifeUI.la(),depois:vis($('pc-al-la'))}`);
  ok(r.box && /380 a 480 Hz/.test(r.a) && r.la === 442 && !r.depois, "afinação 'Outra': campo de Hz, faixa avisada e o afinador usa 442", JSON.stringify(r));
  r = await J(PRE + `$('pc-la').value='440';$('pc-la').dispatchEvent(new Event('input',{bubbles:true}));set('pc-parede','2.5');const a=vis($('pc-al-parede'))?$('pc-al-parede').innerText:'';
    const u=$('pc-usar-parede');if(u)u.click();return {a,par:$('pc-parede').value,depois:vis($('pc-al-parede'))}`);
  ok(/^Parede fina/.test(r.a) && r.par === "4" && !r.depois, "parede fina: aviso; 'usar' volta à parede ideal", JSON.stringify(r));

  r = await J(PRE + `return {modelo:!!document.querySelector('[data-modelo],.pc-modelos')}`);
  ok(!r.modelo, "sem 'Começar de um modelo' (pedido do Igor, 23/11)", JSON.stringify(r));

  /* alcance dos dedos no Básico (Ré 4 grave): aviso com botão; o botão leva ao Avançado com o furo menor */
  r = await J(PRE + `$('pc-modo-basico').click();set('pc-tom','re-grave');const u=$('pc-usar-tubo');if(u)u.click();const a=$('pc-avisos').innerText;
    const b=document.querySelector('[data-alcance]');const txt=b?b.textContent:'';if(b)b.click();
    return {a,txt,av:!$('pc-form').classList.contains('pc-basico'),f1:document.querySelectorAll('#pc-furos input')[0].value,depois:$('pc-avisos').innerText}`);
  ok(/Furos 1 e 2: 50,\d mm entre os centros/.test(r.a) && /usar 9,5 mm no 1º furo/.test(r.txt), "Ré 4 grave: aviso de alcance com 'usar 9,5 mm no 1º furo'", JSON.stringify(r));
  ok(r.av && r.f1 === "9.5" && !/alcance confortável/.test(r.depois), "o botão passa ao Avançado com o 1º furo de 9,5 mm e o aviso some", JSON.stringify(r));
  r = await J(PRE + `return {larg:document.documentElement.scrollWidth,w:innerWidth}`);
  ok(r.larg <= r.w, "celular: sem rolagem para o lado (Avançado)", JSON.stringify(r));
  await p.shot(require("path").join(process.env.TEMP, "pife_modo_avancado.png"), 390, 844);

  /* link antigo (sem modo) com parede digitada abre no Avançado; o mesmo cálculo do link */
  const antigo = encodeURIComponent(JSON.stringify({ tom: "sol", la: 440, temp: 25, D: 18, parede: 3, emb: 10, embForma: "redondo", embL: 9, embC: 11, cone: false, lip: 0, nf: 6, escala: "diatonica-maior-jonia", furos: [8, 10, 7, 10, 10, 10], manual: false }));
  await p.goto("about:blank"); await p.goto(base + "/calculadora.html#" + antigo);
  r = await J(PRE + `return {av:!$('pc-form').classList.contains('pc-basico'),par:$('pc-parede').value}`);
  ok(r.av && r.par === "3", "link antigo com parede 3 abre no Avançado com a parede do link", JSON.stringify(r));

  /* afinador.html usa o mesmo formulário */
  await p.goto(base + "/afinador.html"); await ev("localStorage.clear()"); await p.goto(base + "/afinador.html");
  r = await J(PRE + `return {basico:$('pc-form').classList.contains('pc-basico'),la:window.PifeUI.la(),linhas:document.querySelectorAll('#pc-tabela tbody tr').length,larg:document.documentElement.scrollWidth,w:innerWidth}`);
  ok(r.basico && r.la === 440 && r.linhas === 6 && r.larg <= r.w, "afinador.html: mesmo Básico, Lá 440, sem rolagem para o lado", JSON.stringify(r));
  console.log(falhas ? "RESULTADO: falhas" : "RESULTADO: tudo OK");
};
