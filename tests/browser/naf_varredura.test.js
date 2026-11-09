/* Varredura em navegador real: nenhuma saída visível (tabela, cartões, avisos, resumo, desenho, molde) com NaN/null/indisponível/jargão.
   node tests/browser/cdp.js tests/browser/naf_varredura.test.js [url-base] */
"use strict";
module.exports = async (p, base) => {
  const ev = (x) => p.eval(x);
  const set = (id, v, evt) => ev("(()=>{const e=document.getElementById('" + id + "');e.value='" + v + "';e.dispatchEvent(new Event('" + (evt || "input") + "',{bubbles:true}));})()");
  await p.goto(base + "/calculadora.html?modo=naf"); await ev("localStorage.clear()"); await p.goto(base + "/calculadora.html?modo=naf");
  const PROIBIDO = /Bracker|Flute ?Lab|Flutopedia|cutoff|estimad[oa]|modelo|\bNaN\b|Infinity|undefined|\bnull\b|indispon|\b[RL][123]\b|topologia|sem estimativa/i;
  const nomes = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
  let total = 0, erros = 0; const ruins = [];
  for (const n of ["5", "6"]) {
    await set("naf-furos", n, "change");
    for (let m = 48; m <= 79; m++) {
      const nome = nomes[m % 12] + (Math.floor(m / 12) - 1);
      for (const t of ["10", "20", "35"]) {
        await set("naf-fund", nome, "change"); await set("naf-temp", t);
        const r = JSON.parse(await ev("JSON.stringify({err:document.getElementById('naf-erros').innerText,txt:document.getElementById('naf-saida').innerText+' '+document.getElementById('naf-cartoes').innerText,form:document.getElementById('modo-naf').innerText+' '+[...document.querySelectorAll('#modo-naf [title],#modo-naf [placeholder]')].map(e=>(e.title||'')+' '+(e.placeholder||'')).join(' '),svg:document.getElementById('naf-desenho').innerHTML.replace(/<[^>]*>/g,' ')+' '+document.getElementById('naf-molde').innerHTML.replace(/<[^>]*>/g,' ')})"));
        total++;
        if (r.err) { erros++; ruins.push(n + "f " + nome + " " + t + " erro: " + r.err.slice(0, 80)); continue; }
        const j = r.txt + " " + r.svg + " " + r.form;
        if (PROIBIDO.test(j)) ruins.push(n + "f " + nome + " " + t + " texto ruim: " + (j.match(PROIBIDO) || [""])[0]);
      }
    }
  }
  /* Pedido do Igor: QUALQUER escala × 5/6 furos × todas as notas mostra uma flauta válida, sem furos encostados
     (os tamanhos sugeridos se ajustam sozinhos) e sem erro */
  await set("naf-temp", "20");
  const esc = JSON.parse(await ev(`(()=>{
    const $=id=>document.getElementById(id), ch=(id,v)=>{const e=$(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));};
    let tot=0,ajust=0,ruins=[],ex=[];
    for(const n of ['5','6']){ ch('naf-furos',n);
      for(const es of [...$('naf-escala').options].map(o=>o.value).filter(v=>v!=='personalizada')){ ch('naf-escala',es);
        for(const fu of [...$('naf-fund').options].map(o=>o.value)){ ch('naf-fund',fu); tot++;
          const err=$('naf-erros').innerText, av=$('naf-avisos').innerText, aj=$('naf-ajuste').innerText;
          if(err) ruins.push(n+' '+es+' '+fu+' erro: '+err.slice(0,100));
          else if(/cruza|muito perto|encosta/.test(av)||/Não deu|NaN|null|undefined/.test(av+' '+aj)) ruins.push(n+' '+es+' '+fu+': '+(av+' '+aj).slice(0,160));
          if(aj){ajust++; if(ex.length<3) ex.push(n+' furos, '+es+', '+fu+': '+aj); if(!document.querySelector('#naf-tabela tr.pc-aj')) ruins.push(n+' '+es+' '+fu+': ajuste sem destaque');}
        }}}
    return JSON.stringify({tot,ajust,ruins:ruins.slice(0,10),nr:ruins.length,ex});})()`));
  console.log("escalas × furos × notas:", esc.tot, "| com ajuste:", esc.ajust, "| problemas:", esc.nr);
  esc.ruins.forEach((x) => console.log("  " + x)); esc.ex.forEach((x) => console.log("  exemplo: " + x));
  if (esc.nr || esc.tot < 1300) ruins.push("varredura de escalas: " + esc.nr + " problema(s)");
  /* diâmetro digitado: vale o da pessoa; com furos encostados aparece "Ajustar sozinho" */
  await set("naf-furos", "6", "change"); await set("naf-escala", "pentatonica-menor", "change"); await set("naf-fund", "G4", "change");
  await ev("(()=>{const e=document.querySelector('#naf-linhas [data-k=\"3\"][data-c=\"d\"]');e.value='14';e.dispatchEvent(new Event('input',{bubbles:true}));})()");
  const dig = await ev("document.getElementById('naf-ajuste').innerText");
  if (!/encostados/.test(dig) || (await ev("document.querySelector('#naf-linhas [data-k=\"3\"][data-c=\"d\"]').value")) !== "14") ruins.push("digitado: esperado aviso com Ajustar sozinho e 14 mantido: " + dig);
  else {
    await ev("document.getElementById('naf-ajustar').click()");
    const dep = await ev("document.getElementById('naf-ajuste').innerText"), er2 = await ev("document.getElementById('naf-erros').innerText");
    if (!/^Ajustamos/.test(dep) || er2) ruins.push("Ajustar sozinho (NAF): " + dep + " | " + er2);
    else console.log("  ok  NAF digitado + Ajustar sozinho: " + dep);
  }
  console.log("combinações:", total, "| com erro de cálculo:", erros, "| saídas ruins:", ruins.length);
  ruins.slice(0, 12).forEach((x) => console.log("  " + x));
  if (ruins.length) process.exitCode = 1;
  console.log(ruins.length ? "RESULTADO: falhas" : "RESULTADO: tudo OK");
};
