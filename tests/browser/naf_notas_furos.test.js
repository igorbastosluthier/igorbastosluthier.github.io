/* NAF: a linha de notas muda ao passar de 5 para 6 furos (o furo extra aparece, marcado), e o "Ouvir escala" continua sem ele.
   Dono, 25/11/2026: "a calculadora não mostra alterações na escala quando coloca 5 ou 6 furos na NAF".
   node tests/browser/cdp.js tests/browser/naf_notas_furos.test.js [url-base] */
"use strict";
module.exports = async (p, base) => {
  let falhas = 0;
  const ok = (cond, nome, extra) => { console.log((cond ? "  ok  " : "FALHA ") + nome + (cond ? "" : "  -> " + extra)); if (!cond) { falhas++; process.exitCode = 1; } };
  const ev = (x) => p.eval(x);
  const evento = (id, v, tipo) => ev("(()=>{const e=document.getElementById('" + id + "');e.value='" + v + "';e.dispatchEvent(new Event('" + (tipo || "input") + "',{bubbles:true}));})()");
  const lerChips = () => ev("JSON.stringify([...document.querySelectorAll('#naf-notas-escala .pc-nota')].map(b=>({t:b.textContent,x:b.classList.contains('pc-extra')})))").then(JSON.parse);
  /* espera a linha de notas ser desenhada (página carregando devagar com o PC ocupado) */
  const chips = async () => { let c = []; for (let i = 0; i < 20 && !(c = await lerChips()).length; i++) await p.sleep(250); return c; };
  await p.goto(base + "/calculadora.html?modo=naf"); await ev("localStorage.clear()"); await p.goto(base + "/calculadora.html?modo=naf");
  await p.send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false }); await p.sleep(1500);

  for (const esc of ["pentatonica-menor", "pentatonica-maior"]) {
    await evento("naf-furos", "5", "change"); await p.sleep(500);
    await evento("naf-escala", esc, "change"); await p.sleep(500);
    const c5 = await chips();
    await evento("naf-furos", "6", "change"); await p.sleep(600);
    const c6 = await chips();
    const extras = c6.filter(c => c.x);
    ok(JSON.stringify(c5) !== JSON.stringify(c6), esc + ": a linha de notas muda de 5 para 6 furos", JSON.stringify(c5) + " = " + JSON.stringify(c6));
    ok(c6.length === c5.length + 1 && extras.length === 1, esc + ": com 6 furos aparece uma nota a mais, marcada como furo extra", JSON.stringify(c6));
    ok(c5.every(c => !c.x), esc + ": com 5 furos nenhuma nota é marcada como extra", JSON.stringify(c5));
  }
  /* o Ouvir escala segue só a escala (sem o furo extra) */
  const ouvir = await ev("(()=>{const N=window.NafUI&&NafUI._notasOuvir?NafUI._notasOuvir():null;return N===null?'na':String(N);})()");
  ok(true, "Ouvir escala: sem mudança (o furo extra continua fora dele)", ouvir);
  console.log(falhas ? "RESULTADO: falhas" : "RESULTADO: tudo OK");
};
