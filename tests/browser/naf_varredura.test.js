/* Varredura em navegador real: nenhuma saída visível (tabela, cartões, avisos, resumo, desenho, molde) com NaN/null/indisponível/jargão.
   node tests/browser/cdp.js tests/browser/naf_varredura.test.js [url-base] */
"use strict";
module.exports = async (p, base) => {
  const ev = (x) => p.eval(x);
  const set = (id, v, evt) => ev("(()=>{const e=document.getElementById('" + id + "');e.value='" + v + "';e.dispatchEvent(new Event('" + (evt || "input") + "',{bubbles:true}));})()");
  await p.goto(base + "/calculadora.html?modo=naf"); await ev("localStorage.clear()"); await p.goto(base + "/calculadora.html?modo=naf");
  const nomes = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
  let total = 0, erros = 0; const ruins = [];
  for (const n of ["5", "6"]) {
    await set("naf-furos", n, "change");
    for (let m = 48; m <= 79; m++) {
      const nome = nomes[m % 12] + (Math.floor(m / 12) - 1);
      for (const t of ["10", "20", "35"]) {
        await set("naf-fund", nome, "change"); await set("naf-temp", t);
        const r = JSON.parse(await ev("JSON.stringify({err:document.getElementById('naf-erros').innerText,txt:document.getElementById('naf-saida').innerText+' '+document.getElementById('naf-cartoes').innerText,svg:document.getElementById('naf-desenho').innerHTML.replace(/<[^>]*>/g,' ')+' '+document.getElementById('naf-molde').innerHTML.replace(/<[^>]*>/g,' ')})"));
        total++;
        if (r.err) { erros++; ruins.push(n + "f " + nome + " " + t + " erro: " + r.err.slice(0, 80)); continue; }
        const j = r.txt + " " + r.svg;
        if (/NaN|Infinity|undefined|\bnull\b|indispon|\bR[123]\b|\bL[123]\b|sem estimativa/.test(j)) ruins.push(n + "f " + nome + " " + t + " texto ruim: " + (j.match(/.{0,40}(NaN|Infinity|undefined|\bnull\b|indispon|\bR[123]\b|\bL[123]\b|sem estimativa).{0,40}/) || [""])[0]);
      }
    }
  }
  console.log("combinações:", total, "| com erro de cálculo:", erros, "| saídas ruins:", ruins.length);
  ruins.slice(0, 12).forEach((x) => console.log("  " + x));
  if (ruins.length) process.exitCode = 1;
  console.log(ruins.length ? "RESULTADO: falhas" : "RESULTADO: tudo OK");
};
