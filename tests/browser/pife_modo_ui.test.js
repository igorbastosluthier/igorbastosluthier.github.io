/* Calculadora de Pife na tela (pedido do Igor, 23/11/2026): um formulário só, com todos os campos e sem nome de modo;
   o "?" abre e fecha; avisos aparecem só fora da faixa e somem; ▶ ao lado do tom toca a nota (troca na hora quando o tom
   muda, para ao sair); notas e saltos da escala embaixo da escala (tocar numa nota toca a nota); alcance dos dedos com
   botão; link e estado salvo antigos com modo "basico" abrem o formulário inteiro; celular sem rolagem para o lado.
   node tests/browser/cdp.js tests/browser/pife_modo_ui.test.js [url-base] */
"use strict";
module.exports = async (p, base) => {
  let falhas = 0;
  const ok = (cond, nome, extra) => { console.log((cond ? "  ok  " : "FALHA ") + nome + (cond ? "" : "  -> " + extra)); if (!cond) { falhas++; process.exitCode = 1; } };
  const ev = (x) => p.eval(x);
  const J = async (x) => JSON.parse(await ev("JSON.stringify((()=>{" + x + "})())"));
  /* clique como gesto do usuário (o áudio do navegador só liga com um toque) */
  const gesto = async (expr) => { await p.send("Runtime.evaluate", { expression: expr, userGesture: true }); await p.sleep(150); };
  const PRE = "const $=id=>document.getElementById(id),vis=el=>!!(el&&el.offsetParent!==null&&getComputedStyle(el).display!=='none')," +
    "set=(id,v)=>{const e=$(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},pe=()=>$('pc-resumo').querySelector('li b').textContent," +
    "notas=()=>[...$('pc-notas').querySelectorAll('.pc-nota')].map(b=>b.textContent).join(' ')," +
    "saltos=()=>[...$('pc-notas').querySelectorAll('.pc-salto')].map(s=>s.querySelector('b').textContent+':'+s.querySelector('i').textContent).join(' ');";
  const TODOS = "['pc-tom','pc-tom-ouvir','pc-nfuros','pc-escala','pc-notas','pc-ouvir','pc-la','pc-temp','pc-D','pc-parede','pc-cone','pc-emb-forma','pc-emb','pc-lip-sim','pc-sugerir']";
  const excecoes = () => p.events.filter((e) => e.method === "Runtime.exceptionThrown").length;
  await p.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await p.goto(base + "/calculadora.html"); await ev("localStorage.clear()"); await p.goto(base + "/calculadora.html");

  let r = await J(PRE + `return {modo:!!document.querySelector('.pc-nivel,#pc-modo-basico,#pc-modo-avancado,.pc-basico,[data-avancado]'),
    palavra:/b[aá]sico|avan[cç]ado/i.test(document.body.innerText+' '+[...document.querySelectorAll('[aria-label],[title]')].map(x=>(x.getAttribute('aria-label')||'')+' '+(x.title||'')).join(' ')),
    escondidos:${TODOS}.filter(id=>!vis($(id))), radios:[...document.querySelectorAll('input[name=pc-ouvir-modo]')].filter(x=>vis(x.parentNode)).length,
    alertas:[...document.querySelectorAll('.pc-alerta')].filter(vis).length, ajudas:[...document.querySelectorAll('#pc-form .pc-ajuda-txt')].filter(vis).length,
    linhas:document.querySelectorAll('#pc-tabela tbody tr').length, ok:$('pc-avisos').innerText, larg:document.documentElement.scrollWidth, w:innerWidth, ui:!!window.PifeUI}`);
  ok(!r.modo && !r.palavra, "sem seletor de modo e sem a palavra do modo na página (Igor 23/11)", JSON.stringify(r));
  ok(!r.escondidos.length && r.radios === 2, "abre com todos os campos à mostra (afinação, temperatura, parede, cone, sopro, porta-lábios, furos)", JSON.stringify(r.escondidos));
  ok(r.alertas === 0 && r.ajudas === 0 && /Tudo dentro do normal/.test(r.ok) && r.linhas === 6, "sem aviso nem explicação aberta; resultado normal", JSON.stringify(r));
  ok(r.larg <= r.w, "celular: sem rolagem para o lado", r.larg + " > " + r.w);
  /* 646e753 deixou um "raw" sem declarar no fim de atualizar(): a tela parava ali (sem link, sem salvar, sem PifeUI) */
  await J(PRE + "set('pc-D','18.5');set('pc-D','18');return 1");
  r = await J(PRE + `return {ui:!!window.PifeUI,hash:location.hash.length,salvo:!!localStorage.getItem('pifeCalc.v1')}`);
  ok(r.ui && r.hash > 10 && r.salvo && excecoes() === 0, "a conta vai até o fim: link atualizado, estado salvo, sem exceção", JSON.stringify(r) + " exceções " + excecoes());
  r = await J(PRE + `const t=$('pc-tom').getBoundingClientRect(),b=$('pc-tom-ouvir').getBoundingClientRect();return {mesma:Math.abs((t.top+t.bottom)/2-(b.top+b.bottom)/2)<4,dir:b.left>=t.right-1,dentro:b.right<=innerWidth,w:b.width,h:b.height,
    lab:$('pc-tom-ouvir').getAttribute('aria-label'),pr:$('pc-tom-ouvir').getAttribute('aria-pressed'),notasR:$('pc-notas').getBoundingClientRect().right<=innerWidth,abaixo:$('pc-notas').getBoundingClientRect().top>=$('pc-escala').getBoundingClientRect().bottom}`);
  ok(r.mesma && r.dir && r.dentro && r.w >= 40 && r.h >= 40, "▶ ao lado da janela do tom, na mesma linha, com 44 px para o dedo", JSON.stringify(r));
  ok(r.lab === "Ouvir a nota do tom" && r.pr === "false" && r.notasR && r.abaixo, "▶ com aria-label e aria-pressed; notas logo abaixo da escala, dentro da tela", JSON.stringify(r));
  await p.shot(require("path").join(process.env.TEMP, "pife_form_unico.png"), 390, 844);

  /* notas e saltos da escala, ao vivo */
  r = await J(PRE + `const a={n:notas(),s:saltos()};set('pc-tom','re-grave');const b={n:notas(),s:saltos()};set('pc-nfuros','5');set('pc-escala','pentatonica-menor');const c={n:notas(),s:saltos()};
    set('pc-nfuros','6');set('pc-escala','blues-menor-pentatonica-5');const d={n:notas(),s:saltos()};set('pc-tom','sol');const e={n:notas(),s:saltos(),aria:$('pc-notas').getAttribute('aria-label'),
    falado:$('pc-notas').querySelector('.pc-salto').getAttribute('aria-label')};return {a,b,c,d,e,larg:document.documentElement.scrollWidth,w:innerWidth}`);
  ok(r.a.n === "Sol Lá Si Dó Ré Mi Fá# Sol" && r.a.s === "T:2 T:2 ST:1 T:2 T:2 T:2 ST:1", "Sol maior: Sol –T– Lá –T– Si –ST– Dó ... Fá# –ST– Sol, com os semitons", JSON.stringify(r.a));
  ok(r.b.n === "Ré Mi Fá# Sol Lá Si Dó# Ré" && r.b.s === r.a.s, "trocou o tom: Ré maior na hora", JSON.stringify(r.b));
  ok(r.c.n === "Ré Fá Sol Lá Dó Ré" && r.c.s === "1½T:3 T:2 T:2 1½T:3 T:2", "Ré pentatônica menor (5 furos)", JSON.stringify(r.c));
  ok(r.d.n === "Ré Fá Sol Sol# Lá Dó Ré" && r.d.s === "1½T:3 T:2 ST:1 ST:1 1½T:3 T:2", "Ré blues menor (6 furos)", JSON.stringify(r.d));
  ok(r.e.n === "Sol Lá# Dó Dó# Ré Fá Sol" && /em Sol 4, até a oitava/.test(r.e.aria) && r.e.falado === "1 tom e meio (3 semitons)" && r.larg <= r.w, "Sol blues; leitor de tela ouve os saltos por extenso; sem rolagem", JSON.stringify(r.e));
  await p.shot(require("path").join(process.env.TEMP, "pife_notas_blues.png"), 390, 844);
  await J(PRE + "set('pc-escala','diatonica-maior-jonia');return 1");

  /* ▶ do tom: toca contínuo, troca na hora com o tom e o Lá, para no ▶ de novo, no "Ouvir escala", numa nota, ao sair e na aba NAF */
  await ev("(()=>{window.__freqs=[];const C=window.AudioContext;const o=C.prototype.createOscillator;C.prototype.createOscillator=function(){const x=o.call(this);const s=x.start.bind(x);x.start=function(t){window.__freqs.push(x.frequency.value);return s(t)};return x}})()");
  await gesto("document.getElementById('pc-tom-ouvir').click()");
  const est = "const bt=$('pc-tom-ouvir');const st=()=>({pr:bt.getAttribute('aria-pressed'),es:Escalas.estado(bt),hz:Escalas.notaAtual()});";
  r = await J(PRE + est + `return st()`);
  ok(r.pr === "true" && r.es === "tocando" && Math.abs(r.hz - 392) < 0.01, "▶: toca o Sol 4 (392 Hz) e fica apertado", JSON.stringify(r));
  await p.sleep(1500);
  r = await J(PRE + est + `const a=st();set('pc-tom','re-grave');const b=st();$('pc-la').value='432';$('pc-la').dispatchEvent(new Event('input',{bubbles:true}));const c=st();return {a,b,c,osc:window.__freqs.length}`);
  ok(r.a.es === "tocando", "continua tocando depois de 1,5 s (nota sustentada)", JSON.stringify(r.a));
  ok(r.b.es === "tocando" && Math.abs(r.b.hz - 293.665) < 0.01 && r.c.es === "tocando" && Math.abs(r.c.hz - 432 * Math.pow(2, -7 / 12)) < 0.01 && r.osc === 3,
    "trocou o tom e o Lá tocando: a nota muda na hora, sem recomeçar (Ré 4 293,7 Hz; com Lá 432, 288,3 Hz)", JSON.stringify(r));
  await gesto("document.getElementById('pc-tom-ouvir').click()");
  r = await J(PRE + est + `return st()`);
  ok(r.pr === "false" && r.es === "parado" && r.hz === null, "▶ de novo: para", JSON.stringify(r));
  await gesto("document.getElementById('pc-tom-ouvir').click()");
  await gesto("document.getElementById('pc-ouvir').click()");
  r = await J(PRE + est + `return Object.assign(st(),{esc:$('pc-ouvir').textContent})`);
  ok(r.pr === "false" && r.esc === "⏸ Pausar", "\"Ouvir escala\" com o tom tocando: o tom para e a escala toca", JSON.stringify(r));
  await gesto("document.getElementById('pc-tom-ouvir').click()");
  r = await J(PRE + est + `return Object.assign(st(),{esc:$('pc-ouvir').textContent})`);
  ok(r.pr === "true" && r.esc === "▶ Ouvir escala", "e o contrário: o tom para a escala, e o botão da escala volta", JSON.stringify(r));
  await ev("window.__freqs=[]");
  await gesto("document.querySelectorAll('#pc-notas .pc-nota')[1].click()");
  r = await J(PRE + est + `return Object.assign(st(),{f:window.__freqs[0],acesa:document.querySelectorAll('#pc-notas .pc-tocando').length,nota:document.querySelectorAll('#pc-notas .pc-nota')[1].textContent})`);
  ok(r.nota === "Mi" && Math.abs(r.f - 432 * Math.pow(2, -5 / 12)) < 0.01 && r.pr === "false" && r.acesa === 1, "tocar numa nota (Mi, Lá 432): toca essa nota, acesa; o ▶ do tom solta", JSON.stringify(r));
  await p.sleep(1300);
  r = await J(PRE + `return {acesa:document.querySelectorAll('#pc-notas .pc-tocando').length,es:Escalas.estado()}`);
  ok(r.acesa === 0 && r.es === "parado", "a nota acaba sozinha e apaga", JSON.stringify(r));
  await gesto("document.getElementById('pc-tom-ouvir').click()");
  r = await J(PRE + est + `window.dispatchEvent(new Event('pagehide'));return st()`);
  ok(r.pr === "false" && r.es === "parado", "saiu da página (pagehide): o som para", JSON.stringify(r));
  await gesto("document.getElementById('pc-tom-ouvir').click()");
  await ev("document.getElementById('modo-aba-naf').click()"); await p.sleep(200);
  r = await J(PRE + est + `const s=st();$('modo-aba-pife').click();return s`);
  ok(r.pr === "false" && r.es === "parado", "trocou para a aba NAF: o som do pife para", JSON.stringify(r));
  await p.sleep(200);
  await J(PRE + "$('pc-la').value='440';$('pc-la').dispatchEvent(new Event('input',{bubbles:true}));set('pc-tom','sol');return 1");

  r = await J(PRE + `const b=document.querySelector('[aria-controls="aj-tom"]');b.click();const a1=vis($('aj-tom'))&&b.getAttribute('aria-expanded');b.click();return {a1,a2:vis($('aj-tom')),t:$('aj-tom').innerText}`);
  ok(r.a1 === "true" && !r.a2 && /todos os furos fechados/.test(r.t) && /▶/.test(r.t), "\"?\" do tom abre e fecha (e explica o ▶)", JSON.stringify(r));

  const pe0 = await J(PRE + "return pe()");
  r = await J(PRE + `set('pc-D','25');const a=vis($('pc-al-D'))?$('pc-al-D').innerText:'';const u=$('pc-usar-tubo');if(u)u.click();return {a,depois:vis($('pc-al-D')),D:$('pc-D').value,emb:$('pc-emb').value}`);
  ok(/^Tubo largo para Sol 4/.test(r.a) && /usar 18,0 mm/.test(r.a) && !r.depois && r.D === "18" && r.emb === "10", "tubo largo: aviso com 'usar 18,0 mm', some ao usar", JSON.stringify(r));
  r = await J(PRE + `set('pc-emb','6');const a=vis($('pc-al-emb'))?$('pc-al-emb').innerText:'';set('pc-emb','10');return {a,depois:vis($('pc-al-emb'))}`);
  ok(/pequeno/.test(r.a) && !r.depois, "furo do sopro pequeno: aviso aparece e some", JSON.stringify(r));

  r = await J(PRE + `set('pc-temp','35');const p35=pe();set('pc-temp','25');return {p35,p25:pe()}`);
  ok(r.p35 !== pe0 && r.p25 === pe0, "temperatura entra na conta direto (35 °C muda; 25 °C volta)", JSON.stringify(r) + " | " + pe0);
  r = await J(PRE + `$('pc-la').value='outra';$('pc-la').dispatchEvent(new Event('input',{bubbles:true}));const box=vis($('pc-la-outra-box'));set('pc-la-outra','500');
    const a=vis($('pc-al-la'))?$('pc-al-la').innerText:'';set('pc-la-outra','442');return {box,a,la:window.PifeUI.la(),depois:vis($('pc-al-la'))}`);
  ok(r.box && /380 a 480 Hz/.test(r.a) && r.la === 442 && !r.depois, "afinação 'Outra': campo de Hz, faixa avisada e o afinador usa 442", JSON.stringify(r));
  r = await J(PRE + `$('pc-la').value='440';$('pc-la').dispatchEvent(new Event('input',{bubbles:true}));set('pc-parede','2.5');const a=vis($('pc-al-parede'))?$('pc-al-parede').innerText:'';
    const u=$('pc-usar-parede');if(u)u.click();return {a,par:$('pc-parede').value,depois:vis($('pc-al-parede'))}`);
  ok(/^Parede fina/.test(r.a) && r.par === "4" && !r.depois, "parede fina: aviso; 'usar' volta à parede ideal", JSON.stringify(r));
  /* mesmo resultado de antes para as mesmas entradas (referência do motor, tests/pife_modo.test.js) */
  r = await J(PRE + `$('pc-la').value='432';$('pc-la').dispatchEvent(new Event('input',{bubbles:true}));set('pc-temp','35');set('pc-parede','3');set('pc-emb-forma','oval');set('pc-emb-l','9');set('pc-emb-c','11');
    $('pc-lip-sim').checked=true;$('pc-lip-sim').dispatchEvent(new Event('input',{bubbles:true}));set('pc-lip','2');$('pc-cone').checked=true;$('pc-cone').dispatchEvent(new Event('input',{bubbles:true}));
    return {pe:pe(),furos:[...document.querySelectorAll('#pc-furos input')].map(i=>i.value).join(',')}`);
  ok(r.pe === "408,3 mm" && r.furos === "8,10,7,10,10,10", "Lá 432, 35 °C, parede 3, oval 9 × 11, porta-lábios 2, cone: 408,3 mm, igual à referência", JSON.stringify(r));

  r = await J(PRE + `return {modelo:!!document.querySelector('[data-modelo],.pc-modelos')}`);
  ok(!r.modelo, "sem 'Começar de um modelo' (pedido do Igor, 23/11)", JSON.stringify(r));

  /* alcance dos dedos (Ré 4 grave, com os furos digitados 10/12/9/12/12/12: os sugeridos já ficam dentro do alcance): aviso com botão; o botão muda o 1º furo e o aviso some */
  await p.goto(base + "/calculadora.html"); await ev("localStorage.clear()"); await p.goto("about:blank"); await p.goto(base + "/calculadora.html");
  r = await J(PRE + `set('pc-tom','re-grave');const u=$('pc-usar-tubo');if(u)u.click();[10,12,9,12,12,12].forEach((v,i)=>{const e=document.querySelectorAll('#pc-furos input')[i];e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))});const a=$('pc-avisos').innerText;
    const b=document.querySelector('[data-alcance]');const txt=b?b.textContent:'';if(b)b.click();
    return {a,txt,f1:document.querySelectorAll('#pc-furos input')[0].value,depois:$('pc-avisos').innerText}`);
  ok(/Furos 1 e 2: 50,\d mm entre os centros/.test(r.a) && /usar 9,5 mm no 1º furo/.test(r.txt), "Ré 4 grave: aviso de alcance com 'usar 9,5 mm no 1º furo'", JSON.stringify(r));
  ok(r.f1 === "9.5" && !/alcance confortável/.test(r.depois), "o botão põe o 1º furo de 9,5 mm e o aviso some", JSON.stringify(r));
  r = await J(PRE + `return {larg:document.documentElement.scrollWidth,w:innerWidth}`);
  ok(r.larg <= r.w, "celular: sem rolagem para o lado (com aviso)", JSON.stringify(r));

  /* link antigo do modo básico: abre o formulário inteiro com os campos do link, e a conta é a dos campos */
  const antigo = encodeURIComponent(JSON.stringify({ tom: "sol", la: 440, temp: 25, D: 18, parede: 3, emb: 10, embForma: "redondo", embL: 9, embC: 11, cone: false, lip: 0, nf: 6, escala: "diatonica-maior-jonia", furos: [8, 10, 7, 10, 10, 10], manual: false, modo: "basico" }));
  await p.goto("about:blank"); await p.goto(base + "/calculadora.html#" + antigo);
  r = await J(PRE + `const s=JSON.parse(decodeURIComponent(location.hash.slice(1)));return {par:$('pc-parede').value,vis:vis($('pc-parede'))&&vis($('pc-temp')),modo:'modo' in s,
    igual:pe()===PifeCalc.calcular(s).bocaAoPe.toFixed(1).replace('.',',')+' mm',mod:!!document.querySelector('.pc-nivel,.pc-basico')}`);
  ok(r.par === "3" && r.vis && !r.modo && r.igual && !r.mod, "link antigo com modo 'basico': formulário inteiro, parede 3 do link, conta dos campos, link novo sem 'modo'", JSON.stringify(r));
  /* estado salvo antigo do modo básico */
  await ev("localStorage.setItem('pifeCalc.v1',JSON.stringify({tom:'sol',la:440,temp:35,D:18,parede:4,emb:10,embForma:'redondo',embL:9,embC:11,cone:false,lip:0,nf:6,escala:'diatonica-maior-jonia',furos:[8,10,7,10,10,10],manual:false,modo:'basico'}))");
  await p.goto("about:blank"); await p.goto(base + "/calculadora.html");
  r = await J(PRE + `return {t:$('pc-temp').value,pe:pe(),vis:vis($('pc-temp'))}`);
  ok(r.t === "35" && r.vis && r.pe !== pe0, "estado salvo do modo básico: abre inteiro, com os 35 °C que estavam guardados valendo", JSON.stringify(r));

  /* afinador.html usa o mesmo formulário */
  await p.goto(base + "/afinador.html"); await ev("localStorage.clear()"); await p.goto(base + "/afinador.html");
  r = await J(PRE + `return {modo:!!document.querySelector('.pc-nivel,#pc-modo-basico,.pc-basico,[data-avancado]'),palavra:/b[aá]sico|avan[cç]ado/i.test(document.body.innerText),
    escondidos:${TODOS}.filter(id=>!vis($(id))),n:notas(),la:window.PifeUI.la(),linhas:document.querySelectorAll('#pc-tabela tbody tr').length,larg:document.documentElement.scrollWidth,w:innerWidth}`);
  ok(!r.modo && !r.palavra && !r.escondidos.length && r.n === "Sol Lá Si Dó Ré Mi Fá# Sol" && r.la === 440 && r.linhas === 6 && r.larg <= r.w,
    "afinador.html: mesmo formulário inteiro, ▶ do tom, notas da escala, Lá 440, sem rolagem para o lado", JSON.stringify(r));
  await gesto("document.getElementById('pc-tom-ouvir').click()");
  r = await J(PRE + `const b=$('pc-tom-ouvir'),a=Escalas.estado(b);b.click();return {a,depois:Escalas.estado(b),pr:b.getAttribute('aria-pressed')}`);
  ok(r.a === "tocando" && r.depois === "parado" && r.pr === "false", "afinador.html: o ▶ do tom toca e para", JSON.stringify(r));
  ok(excecoes() === 0, "nenhuma exceção de JavaScript em todo o teste", String(excecoes()));
  console.log(falhas ? "RESULTADO: falhas" : "RESULTADO: tudo OK");
};
