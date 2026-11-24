/* Janela do som, saída de ar e canal raso: cada campo mexe só na sua peça do desenho (medido no SVG, na vista ampliada e no desenho
   do tubo inteiro), em 1440 e 390 px; o ninho contém tudo; link/estado salvo antigo abre com o padrão; a afinação só muda com os campos
   da janela do som. node tests/browser/cdp.js tests/browser/janela.test.js [url-base] */
"use strict";
module.exports = async (p, base) => {
  let falhas = 0;
  const ok = (cond, nome, extra) => { console.log((cond ? "  ok  " : "FALHA ") + nome + (cond ? "" : "  -> " + extra)); if (!cond) { falhas++; process.exitCode = 1; } };
  const ev = (x) => p.eval(x);
  const evento = (id, v) => ev("(()=>{const e=document.getElementById('" + id + "');e.value='" + v + "';e.dispatchEvent(new Event('input',{bubbles:true}));})()");
  const val = async (id) => parseFloat(await ev("document.getElementById('" + id + "').value"));
  const abrir = async (w) => {
    await p.send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 700 });
    await p.goto(base + "/calculadora.html?modo=naf"); await ev("localStorage.clear()"); await p.goto(base + "/calculadora.html?modo=naf"); await p.sleep(400);
  };
  /* mede cada peça do desenho em mm: escala = altura do tubo na imagem ÷ diâmetro externo */
  const medir = async (seletor) => JSON.parse(await ev(`JSON.stringify((()=>{
    const svg=document.querySelector('${seletor}'); if(!svg) return null;
    const v=svg.classList.contains('pc-vert')||svg.classList.contains('naf-det-v');
    const od=parseFloat(document.getElementById('naf-od').value);
    const rs=[...svg.querySelectorAll('rect')].map(r=>({f:r.getAttribute('fill'),x:+r.getAttribute('x'),y:+r.getAttribute('y'),w:+r.getAttribute('width'),h:+r.getAttribute('height')}));
    const tubo=rs.find(r=>r.f==='#f0c56a'||r.f==='#D9A33A'); const esc=(v?tubo.w:tubo.h)/od;
    const along=(r)=>(v?r.h:r.w)/esc, across=(r)=>(v?r.w:r.h)/esc;
    const nest=rs.find(r=>r.f==='#dcae4f'), canal=rs.find(r=>r.f==='#cf9a3a'), pretos=rs.filter(r=>r.f==='#0f0b09');
    const caixa=(r)=>r?{c:+along(r).toFixed(2),l:+across(r).toFixed(2)}:null;
    return {nest:caixa(nest),canal:caixa(canal),sac:caixa(pretos[0]),tsh:caixa(pretos[1]),n:pretos.length,v:v};
  })())`));
  const perto = (a, b, t) => Math.abs(a - b) <= (t || 0.2);
  const alvos = [["detalhe", ".naf-det-svg"], ["tubo inteiro", "#naf-desenho > svg"]];
  for (const w of [1440, 390]) {
    await abrir(w);
    const sc0 = await val("naf-sc"), jc0 = await val("naf-jc"), cc0 = await val("naf-cc");
    ok(perto(sc0, jc0, 0.05) && cc0 >= 18, w + " px: valores iniciais: saída de ar do tamanho da janela do som e canal de pelo menos 18 mm", sc0 + " " + jc0 + " " + cc0);
    const campos = [
      { id: "naf-jc", nome: "comprimento da janela do som", mudaTsh: "c", delta: 3 },
      { id: "naf-jl", nome: "largura da janela do som", mudaTsh: "l", delta: 2 },
      { id: "naf-sc", nome: "comprimento da saída de ar", mudaSac: "c", delta: 3 },
      { id: "naf-sl", nome: "largura da saída de ar", mudaSac: "l", delta: 2 },
      { id: "naf-cc", nome: "comprimento do canal raso", mudaCanal: "c", delta: 4 }
    ];
    for (const campo of campos) {
      for (const [rot, sel] of alvos) {
        const celular = w < 700;
        if (rot === "tubo inteiro" && !celular && false) continue;
        console.log('      ...', w, campo.id, rot); await abrir(w);
        const antes = await medir(sel); if (!antes) { ok(false, w + " px " + rot + ": o desenho existe", sel); continue; }
        const v0 = await val(campo.id); await evento(campo.id, String(v0 + campo.delta)); await p.sleep(250);
        const depois = await medir(sel);
        const t = rot === "tubo inteiro" ? 0.5 : 0.2;                      /* no desenho do tubo inteiro a peça é pequena: tolerância maior */
        const igual = (a, b) => a && b && perto(a.c, b.c, t) && perto(a.l, b.l, t);
        /* o canal tem a largura da janela do som (é por onde o ar entra nela): só nisso a janela do som e o canal andam juntos */
        const larguraDoCanalSegue = campo.id === "naf-jl";
        const so = (peca, eixo) => {
          const r = {};
          ["tsh", "sac", "canal"].forEach((k) => {
            const mudou = k === "canal" && larguraDoCanalSegue ? !perto(antes.canal.c, depois.canal.c, t) : !igual(antes[k], depois[k]);
            r[k] = peca === k ? (eixo ? !perto(antes[k][eixo], depois[k][eixo], t) && (["c", "l"].filter((e) => e !== eixo).every((e) => perto(antes[k][e], depois[k][e], t))) : mudou) : !mudou;
          });
          return r;
        };
        const peca = campo.mudaTsh ? "tsh" : campo.mudaSac ? "sac" : "canal", eixo = campo.mudaTsh || campo.mudaSac || campo.mudaCanal;
        const r = so(peca, eixo);
        ok(r.tsh && r.sac && r.canal, w + " px, " + rot + ": " + campo.nome + " (+" + campo.delta + " mm) muda só a sua peça", JSON.stringify({ antes, depois }));
        if (rot === "detalhe") {
          const n = depois.nest, cabe = n.c + 0.01 >= depois.tsh.c && n.l + 0.01 >= Math.max(depois.tsh.l, depois.sac.l);
          ok(cabe, w + " px: o ninho contém as janelas depois de mexer no " + campo.nome, JSON.stringify(depois));
        }
      }
    }
    /* a afinação só muda com a janela do som */
    await abrir(w);
    const posicoes = () => ev("JSON.stringify([...document.querySelectorAll('#naf-tabela tbody tr')].map(t=>t.cells[3].textContent+'|'+t.cells[4].textContent+'|'+t.cells[1].textContent.slice(0,6)).concat([...document.querySelectorAll('#naf-resumo li b')].map(b=>b.textContent)))");
    const p0 = await posicoes();
    await evento("naf-sc", String((await val("naf-sc")) + 4)); await evento("naf-sl", String((await val("naf-sl")) + 3)); await evento("naf-cc", String((await val("naf-cc")) + 5)); await p.sleep(250);
    ok((await posicoes()) === p0, w + " px: saída de ar e canal não mudam as posições dos furos nem a afinação", p0 + " " + await posicoes());
    await evento("naf-jc", String((await val("naf-jc")) + 3)); await p.sleep(250);
    ok((await posicoes()) !== p0, w + " px: o comprimento da janela do som muda as posições (entra na conta)", await posicoes());
  }
  /* link e estado salvo antigos (sem os campos novos) abrem com o padrão */
  await abrir(1200);
  const antigo = { f: 5, fu: "G4", es: "pentatonica-menor", a4: "440", t: "20", od: "26.6", p: "2.9", jc: "10.4", jl: "11.4", ja: "2.9", c: "108", po: "0", m: 0, dd: 0,
    l: [["Sib 4", "", 9, 1, 9], ["Dó 5", "", 8, 1, 8], ["Ré 5", "", 8.5, 1, 8.5], ["Fá 5", "", 9.5, 1, 9.5], ["Sol 5", "", 8, 1, 8]] };
  await ev("localStorage.setItem('nafCalc.v1'," + JSON.stringify(JSON.stringify(antigo)) + ")");
  await p.goto(base + "/calculadora.html?modo=naf"); await p.sleep(500);
  ok((await val("naf-sc")) === 10.4 && (await val("naf-sl")) === 11.4 && (await val("naf-cc")) >= 18 && (await ev("document.querySelectorAll('#naf-tabela tbody tr').length")) === 5,
    "estado salvo antigo (sem saída de ar nem canal) abre com o padrão e o resultado", (await val("naf-sc")) + " " + (await val("naf-cc")));
  const hash = "#" + encodeURIComponent(JSON.stringify(antigo));
  await p.goto(base + "/calculadora.html?modo=naf" + hash); await p.sleep(500);
  ok((await val("naf-sc")) === 10.4 && (await val("naf-cc")) >= 18, "link antigo abre com o padrão", (await val("naf-sc")) + " " + (await val("naf-cc")));
  console.log(falhas ? "RESULTADO: falhas" : "RESULTADO: tudo OK");
};
