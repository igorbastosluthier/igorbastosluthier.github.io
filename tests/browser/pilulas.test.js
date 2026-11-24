/* Pílulas e rótulos de rádio/caixa no celular: o texto fica na mesma linha do botão, em todo grupo do site (afinador, escala, "Mostrar no desenho"...).
   Defeito de 24/11/2026: "Detalhada" quebrava para baixo do botão, "Calma" e "Normal" não.
   node tests/browser/cdp.js tests/browser/pilulas.test.js [url-base] */
"use strict";
module.exports = async (p, base) => {
  let falhas = 0;
  const ok = (cond, nome, extra) => { console.log((cond ? "  ok  " : "FALHA ") + nome + (cond ? "" : "  -> " + extra)); if (!cond) { falhas++; process.exitCode = 1; } };
  const checagem = `(()=>{
    const ruins=[];let n=0;
    document.querySelectorAll('label').forEach(l=>{
      const inp=l.querySelector('input[type=radio],input[type=checkbox]'); if(!inp||!l.offsetParent) return;
      const ri=inp.getBoundingClientRect(); if(!ri.width) return;
      const r=document.createRange();r.selectNodeContents(l);
      let t=null;const w=document.createTreeWalker(l,NodeFilter.SHOW_TEXT);
      while(w.nextNode()){const x=w.currentNode;if(!x.textContent.trim())continue;const q=document.createRange();q.selectNodeContents(x);const rc=q.getBoundingClientRect();if(!rc.width)continue;
        t=t?{top:Math.min(t.top,rc.top),bottom:Math.max(t.bottom,rc.bottom),right:Math.max(t.right,rc.right)}:{top:rc.top,bottom:rc.bottom,right:rc.right};}
      if(!t) return; n++;
      const cy=ri.top+ri.height/2;
      if(cy<t.top-3||cy>t.bottom+3) ruins.push((l.textContent.trim().slice(0,30))+' (botão y '+Math.round(cy)+', texto '+Math.round(t.top)+'-'+Math.round(t.bottom)+')');
      if(t.right>document.documentElement.clientWidth+1) ruins.push('estoura a largura: '+l.textContent.trim().slice(0,30));
    });
    return JSON.stringify({n,ruins});
  })()`;
  for (const w of [360, 390]) {
    for (const pag of ["afinador.html", "calculadora.html", "calculadora.html?modo=naf"]) {
      await p.send("Emulation.setDeviceMetricsOverride", { width: w, height: 800, deviceScaleFactor: 1, mobile: true });
      await p.goto(base + "/" + pag); await p.sleep(500);
      const r = JSON.parse(await p.eval(checagem));
      ok(r.n > 5 && r.ruins.length === 0, pag + " em " + w + " px: " + r.n + " rótulos, botão e texto na mesma linha", r.ruins.join(" | "));
      const sens = JSON.parse(await p.eval(`JSON.stringify([...document.querySelectorAll('input[name=af-sens]')].map(i=>Math.round(i.getBoundingClientRect().top)+'/'+Math.round(i.closest('label').getBoundingClientRect().height)))`));
      if (sens.length) ok(new Set(sens).size === 1, pag + " em " + w + " px: as três pílulas de sensibilidade com a mesma altura e linha", sens.join(","));
    }
  }
  console.log(falhas ? "RESULTADO: falhas" : "RESULTADO: tudo OK");
};
