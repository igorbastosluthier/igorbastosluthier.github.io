/* Varredura do Pífano em navegador real (pedido do Igor): qualquer escala × 5/6/7 furos × todos os tons mostra uma flauta
   sem furos encostados e sem erro; furo digitado à mão é respeitado e o botão "Ajustar sozinho" resolve.
   node tests/browser/cdp.js tests/browser/pife_varredura.test.js [url-base] */
"use strict";
module.exports = async (p, base) => {
  let falhas = 0;
  const ok = (cond, nome, extra) => { console.log((cond ? "  ok  " : "FALHA ") + nome + (cond ? "" : "  -> " + extra)); if (!cond) { falhas++; process.exitCode = 1; } };
  const ev = (x) => p.eval(x);
  await p.send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  await p.goto(base + "/calculadora.html"); await ev("localStorage.clear()"); await p.goto(base + "/calculadora.html");
  /* tudo numa chamada só (rápido): troca furos, escala e tom como a pessoa faria, e lê a tela */
  const res = JSON.parse(await ev(`(()=>{
    const $=id=>document.getElementById(id), set=(id,v)=>{const e=$(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));};
    const PROIB=/muito perto|NaN|undefined|null|Infinity|Não deu/;let tot=0,ajust=0,ruins=[],ex=[];
    for(const n of ['5','6','7']){ set('pc-nfuros',n);
      const escalas=[...$('pc-escala').options].map(o=>o.value);
      for(const es of escalas){ set('pc-escala',es);
        for(const t of [...$('pc-tom').options].map(o=>o.value)){
          set('pc-tom',t);
          const usar=$('pc-usar-tubo'); if(usar) usar.click(); /* tubo indicado do tom */
          tot++;
          const linhas=document.querySelectorAll('#pc-tabela tbody tr').length, av=$('pc-avisos').innerText, aj=$('pc-ajuste').innerText;
          if(linhas!==+n) ruins.push(n+' '+es+' '+t+' linhas '+linhas);
          if(PROIB.test(av+' '+aj)) ruins.push(n+' '+es+' '+t+': '+(av+' '+aj).slice(0,160));
          if(aj){ajust++; if(ex.length<3) ex.push(n+' furos, '+es+', '+t+': '+aj);}
          if(aj && !document.querySelector('#pc-tabela tr.pc-aj')) ruins.push(n+' '+es+' '+t+': ajuste sem destaque na tabela');
        }}}
    return JSON.stringify({tot,ajust,ruins:ruins.slice(0,10),nr:ruins.length,ex});})()`));
  ok(res.nr === 0 && res.tot > 1400, "pífano: " + res.tot + " combinações (escala × furos × tom), " + res.ajust + " com ajuste, 0 problemas", res.ruins.join(" || "));
  res.ex.forEach((x) => console.log("      exemplo: " + x));

  /* furo digitado à mão: vale o da pessoa; aviso com botão "Ajustar sozinho" */
  await p.goto(base + "/calculadora.html"); await ev("localStorage.clear()"); await p.goto(base + "/calculadora.html");
  await ev("(()=>{const i=document.querySelectorAll('#pc-furos input');[2,3].forEach(k=>{i[k].value='14';i[k].dispatchEvent(new Event('input',{bubbles:true}));});})()");
  const antes = await ev("document.getElementById('pc-ajuste').innerText");
  ok(/encostados/.test(antes) && (await ev("document.querySelectorAll('#pc-furos input')[2].value")) === "14", "digitado: respeita 14 mm e avisa furos encostados", antes);
  await ev("document.getElementById('pc-ajustar').click()"); await p.sleep(100);
  const depois = await ev("document.getElementById('pc-ajuste').innerText"), av = await ev("document.getElementById('pc-avisos').innerText");
  ok(/^Ajustamos o tamanho dos furos/.test(depois) && /afinação continua certa/.test(depois) && !/muito perto/.test(av), "Ajustar sozinho: separa os furos e explica", depois + " | " + av);
  ok((await ev("document.querySelectorAll('#pc-tabela tr.pc-aj').length")) > 0 && (await ev("document.querySelectorAll('#pc-desenho circle[stroke=\"#D9A33A\"]').length")) > 0, "furos ajustados destacados na tabela e no desenho");
  await p.shot(require("path").join(process.env.TEMP, "pife_ajuste.png"), 1200, 900);
  console.log(falhas ? "RESULTADO: falhas" : "RESULTADO: tudo OK");
};
