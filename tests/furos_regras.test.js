/* Tamanho sugerido dos furos por regras (assets/furos-regras.js), pífano e NAF.
   Varredura tom × quantidade de furos × escala: reprova furo fora dos limites de voz e de fechamento do dedo, furos encostados, posições fora
   de ordem, tubo que muda com a quantidade de furos/escala, dedos da mesma mão mais longe do que o ponto de partida deixava, e
   5 -> 6 furos da NAF que embaralha tubo e furos. Determinístico. */
"use strict";
const assert = require("assert"), path = require("path");
const A = (f) => require(path.join(__dirname, "..", "assets", f));
const FR = A("furos-regras.js"), N = A("naf-calc.js"), P = A("pife-calc.js"), M = A("pife-modo.js"), E = A("escalas.js"), Aj = A("ajuste-furos.js");
let ok = 0;
const t = (nome, fn) => { fn(); ok++; console.log("  ok  " + nome); };

/* quanto cada disposição passa do alcance das mãos (mm somados nos pares da mesma mão) */
const alcance = (pos, n) => FR.paresMesmaMao(n).reduce((s, i) => { const g = pos[i] - pos[i - 1]; return s + Math.max(0, FR.ALCANCE_MIN - g) + Math.max(0, g - FR.ALCANCE_MAX); }, 0);

/* ---- NAF: o caminho da calculadora (sugerir, ajuste automático, conta) ---- */
function naf(n, midi, esc, temp) {
  const sg = N.sugerir({ furos: n, midi, escala: esc, temp: temp === undefined ? 20 : temp }), semis = E.layout(esc, n, "naf").furos;
  const e = { furos: n, escala: esc, fundamental: N.nomeEn(midi), a4: 440, temperatura: temp === undefined ? 20 : temp, diametroExterno: sg.diametroExterno, parede: sg.parede,
    janelaCompr: sg.janelaCompr, janelaLarg: sg.janelaLarg, janelaAltura: sg.janelaAltura, cabeca: sg.cabeca, ponta: 0,
    linhas: semis.map((st, i) => ({ nota: N.nomeEn(midi + st), diametro: sg.diametros[i] })) };
  const a = N.ajustarFuros(e), e2 = Object.assign({}, e, { linhas: e.linhas.map((l, i) => Object.assign({}, l, { diametro: a.diametros[i] })) });
  return { sg, e, e2, r: N.calcular(e2), semis };
}
/* escalas de saltos largos que não fecham no tubo do tom (o tubo não encolhe): ficam com o aviso do motor */
const NAO_FECHA = ["hirajoshi-japonesa", "ryukyu-okinawa", "jonia-5-ionian-5", "cigana-hungara-menor", "cigana-hungara-hungarian-gypsy", "dorica-4-dorian-4", "locria-6-locrian-6", "frigia-dominante-hijaz", "dupla-harmonica-hijaz-kar-arabe"];

t("NAF: varredura tom × 5/6 furos × escala: Ø nos limites, sem encostados, em ordem, tubo só do tom, alcance das mãos nunca pior que o ponto de partida", () => {
  let tot = 0, semFlauta = 0, pior = 0, longe = 0; const tubo = {};
  [5, 6].forEach((n) => E.aplicaveis("naf", n).forEach((es) => {
    for (let m = N.MIDI_MIN; m <= N.MIDI_MAX; m++) {
      const c = naf(n, m, es.id), nome = n + " furos " + es.nome + " " + N.nomePt(m);
      assert.strictEqual(c.sg.diametroExterno, tubo[m] ? tubo[m].de : c.sg.diametroExterno, nome + ": o tubo mudou com a escala/furos");
      tubo[m] = { de: c.sg.diametroExterno };
      if (!c.r.ok) { assert.ok(NAO_FECHA.indexOf(es.id) >= 0, nome + ": " + JSON.stringify(c.r.erros)); semFlauta++; continue; }
      const bore = c.r.diametroInterno, lim = FR.limites(bore);
      /* o que o gerador sugere cabe nos limites de voz (ou, se a conta só fecha com furo menor, até 20% do tubo) e de fechamento do dedo */
      c.sg.diametros.forEach((d) => assert.ok(d >= Math.max(3.5, 0.2 * bore) - 1e-9 && d <= lim.max + 1e-9, nome + ": Ø " + d + " fora de " + JSON.stringify(lim)));
      c.r.furos.forEach((f, i) => {
        assert.ok(f.diametro <= 0.72 * bore + 1e-9, nome + ": furo grande demais para o tubo");
        if (i) assert.ok(f.doPe > c.r.furos[i - 1].doPe, nome + ": posições fora de ordem");
      });
      assert.deepStrictEqual(N.apertos(c.r), [], nome + ": furos encostados");
      const pos = c.r.furos.map((f) => f.doPe), base = FR.padrao("naf", n, c.semis, bore);
      const rb = N.calcular(Object.assign({}, c.e, { linhas: c.e.linhas.map((l, i) => Object.assign({}, l, { diametro: base[i] })) }));
      if (rb.ok) { const a1 = alcance(pos, n), a0 = alcance(rb.furos.map((f) => f.doPe), n); assert.ok(a1 <= a0 + 0.5, nome + ": alcance das mãos pior (" + a1.toFixed(1) + " > " + a0.toFixed(1) + ")"); }
      if (alcance(pos, n) > 0.5) longe++;
      tot++;
    }
  }));
  console.log("      NAF: " + tot + " flautas (todas fecham; as de escalas de saltos largos precisam do ajuste automático dos furos), " + longe + " com algum vão fora do alcance das mãos (tons graves)");
  assert.ok(tot > 1300 && semFlauta === 0);
});

t("NAF: de 5 para 6 furos (pentatônica menor, Lá 3 a Sol 5) o tubo é o mesmo e os furos não se embaralham", () => {
  let casos = 0;
  for (let m = 57; m <= 79; m++) {
    const a = naf(5, m, "pentatonica-menor"), b = naf(6, m, "pentatonica-menor"), nome = N.nomePt(m);
    if (!a.r.ok || !b.r.ok) continue;
    assert.strictEqual(a.sg.diametroExterno, b.sg.diametroExterno, nome + ": tubo");
    assert.strictEqual(a.sg.parede, b.sg.parede, nome + ": parede");
    /* os furos da escala (sem o extra) do 6 contra os 5 do 5 */
    const idx = b.r.furos.map((f, i) => (f.extra ? -1 : i)).filter((i) => i >= 0);
    assert.strictEqual(idx.length, 5, nome);
    idx.forEach((i, k) => {
      assert.ok(Math.abs(b.r.furos[i].diametro - a.r.furos[k].diametro) <= Math.max(2.5, 0.12 * b.r.diametroInterno) + 1e-9, nome + ": Ø do furo " + (k + 1) + " mudou " + a.r.furos[k].diametro + " -> " + b.r.furos[i].diametro);
      assert.ok(Math.abs(b.r.furos[i].doPe - a.r.furos[k].doPe) <= 10, nome + ": posição do furo " + (k + 1));
    });
    casos++;
  }
  assert.ok(casos >= 18, String(casos));
  console.log("      " + casos + " tons");
});

t("determinístico: a mesma entrada dá sempre os mesmos tamanhos", () => {
  for (const [n, m, es] of [[6, 67, "pentatonica-menor"], [5, 64, "pentatonica-maior"], [6, 60, "diatonica-maior-jonia"]]) {
    assert.deepStrictEqual(N.sugerir({ furos: n, midi: m, escala: es }).diametros, N.sugerir({ furos: n, midi: m, escala: es }).diametros);
  }
  const l = E.layout("diatonica-maior-jonia", 6, "pife"), e = { tom: "sol", la: 440, temp: 25, D: 18, parede: 4, emb: 10, embForma: "redondo", semitons: l.furos, aux: l.aux, furos: [] };
  assert.deepStrictEqual(P.sugerirFuros(e), P.sugerirFuros(e));
});

/* ---- pífano: o caminho da calculadora (sugeridos = gerador + ajuste automático) ---- */
t("pífano: varredura tom × 5/6/7 furos × escala: Ø nos limites, passo de 0,5 mm, sem encostados, em ordem, alcance das mãos nunca pior que o ponto de partida", () => {
  let tot = 0, longe = 0, fino = 0;
  [5, 6, 7].forEach((n) => E.aplicaveis("pife", n).forEach((es) => P.TONS.forEach((tom) => {
    const D = P.tuboSugerido(tom.id), l = E.layout(es.id, n, "pife"), nome = n + " furos " + es.nome + " " + tom.nome;
    const e = { tom: tom.id, la: 440, temp: 25, D, parede: P.paredeIdeal(D), emb: Math.round(D * 0.53), embForma: "redondo", semitons: l.furos, aux: l.aux };
    const furos = M.sugeridos(e).furos, r = P.calcular(Object.assign({}, e, { furos }));
    const lim = FR.limites(D);
    furos.forEach((d, i) => {
      assert.ok(d >= lim.min - 1e-9 && d <= Math.max(lim.max, 0.8 * D) + 1e-9, nome + ": Ø " + d + " fora de " + JSON.stringify(lim));
      if (Math.abs(d * 2 - Math.round(d * 2)) > 1e-9) fino++;
      if (i) assert.ok(r.furos[i].daBoca < r.furos[i - 1].daBoca, nome + ": posições fora de ordem");
    });
    assert.deepStrictEqual(P.apertos(Object.assign({}, e, { furos }), r.furos), [], nome + ": furos encostados");
    const base = FR.padrao("pifano", n, l.furos, D), rb = P.calcular(Object.assign({}, e, { furos: base }));
    const a1 = alcance(r.furos.map((f) => f.doPe), n), a0 = alcance(rb.furos.map((f) => f.doPe), n);
    assert.ok(a1 <= a0 + 1, nome + ": alcance das mãos pior (" + a1.toFixed(1) + " > " + a0.toFixed(1) + ")");
    if (a1 > 0.5) longe++;
    tot++;
  })));
  console.log("      pífano: " + tot + " combinações, " + longe + " com algum vão fora do alcance das mãos (tons agudos/graves), " + fino + " tamanhos em décimos (acerto fino de furos encostados)");
  assert.ok(tot > 1400);
});

t("pífano: Sol 4 de 6 furos na escala maior segue o tamanho de costume (8, 10, 7, 10, 10, 10 em tubo de 18 mm)", () => {
  const l = E.layout("diatonica-maior-jonia", 6, "pife"), e = { tom: "sol", la: 440, temp: 25, D: 18, parede: 4, emb: 10, embForma: "redondo", semitons: l.furos, aux: l.aux };
  assert.deepStrictEqual(M.sugeridos(e).furos, [8, 10, 7, 10, 10, 10]);
});

t("nenhum nome de oficina, de pessoa ou 'modelo' no código novo do gerador", () => {
  const fs = require("fs"), src = fs.readFileSync(path.join(__dirname, "..", "assets", "furos-regras.js"), "utf8");
  assert.ok(!/oficina|Igor|modelo|preset|luthier/i.test(src), "texto proibido no gerador");
});

console.log(ok + " verificações dos furos sugeridos por regras");
