/* Escalas da calculadora (assets/escalas.js) + escala escolhida no cálculo do pífano e da NAF.
   Rodar: node tests/escalas.test.js
   A referência das escalas é o app da oficina (tests/fixtures/escalas_app.json, gerado por tests/gen_escalas_app.py). */
"use strict";
const assert = require("assert");
const E = require("../assets/escalas.js"), P = require("../assets/pife-calc.js"), N = require("../assets/naf-calc.js");
const APP = require("./fixtures/escalas_app.json");
let n = 0;
const ok = (nome, fn) => { fn(); n++; console.log("  ok  " + nome); };
const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, msg + ": " + a + " vs " + b);
const ids = (l) => l.map((x) => x.id);

ok("mesmos nomes e graus do app; sinônimos (mesmas notas) aparecem uma vez, com o primeiro nome", () => {
  const vistos = {};
  Object.keys(APP.graus).forEach((nome) => {
    const chave = APP.graus[nome].join(",");
    const e = E.porId(E.slug(nome));
    if (vistos[chave]) assert.strictEqual(e, null, "sinônimo não deveria aparecer: " + nome);
    else { assert.ok(e, "faltou " + nome); assert.strictEqual(e.nome, nome); assert.deepStrictEqual(e.graus, APP.graus[nome]); vistos[chave] = true; }
  });
  assert.strictEqual(E.LISTA.length, Object.keys(vistos).length);
});

ok("escala padrão igual à do app: pífano diatônica maior, NAF pentatônica menor", () => {
  assert.strictEqual(E.porId(E.PADRAO.pife).nome, APP.padrao.pife);
  assert.strictEqual(E.porId(E.PADRAO.naf).nome, APP.padrao.naf);
});

ok("montagem dos furos igual à do app em todas as escalas que aparecem (pífano 5/6/7, NAF 5/6)", () => {
  let c = 0;
  [["pife", [5, 6, 7]], ["naf", [5, 6]]].forEach(([inst, ns]) => ns.forEach((k) => E.aplicaveis(inst, k).forEach((e) => {
    const l = E.layout(e.id, k, inst), a = APP.layout[k][e.nome];
    assert.deepStrictEqual(l.furos, a.furos, inst + " " + k + " " + e.nome);
    assert.deepStrictEqual(l.aux, a.aux, inst + " " + k + " " + e.nome + " (aux)");
    assert.deepStrictEqual(a.fora, [], "nenhuma nota fica de fora: " + e.nome);
    assert.strictEqual(l.furos.length, k);
    c++;
  })));
  assert.ok(c > 100, "casos: " + c);
});

ok("só aparecem escalas que cabem: pífano 6 = 7 notas (+ hexatônicas com oitava); sem pentatônica; NAF com pentatônica", () => {
  const p6 = ids(E.aplicaveis("pife", 6)), p5 = ids(E.aplicaveis("pife", 5)), p7 = ids(E.aplicaveis("pife", 7));
  const n5 = ids(E.aplicaveis("naf", 5)), n6 = ids(E.aplicaveis("naf", 6));
  ["diatonica-maior-jonia", "mixolidia", "nordestina-lidio-7-baiao-pifano", "dorica", "menor-natural-eolia", "blues-menor-pentatonica-5"].forEach((x) => assert.ok(p6.includes(x), "pife 6: " + x));
  ["pentatonica-menor", "pentatonica-maior", "cromatica-chromatic", "blues-rock-and-roll-blues-rock-n-roll", "semitom-tom-half-whole"].forEach((x) => assert.ok(!p6.includes(x), "pife 6 não: " + x));
  assert.ok(p5.includes("pentatonica-menor") && !p5.includes("diatonica-maior-jonia"));
  assert.ok(p7.includes("diatonica-maior-jonia") && p7.includes("semitom-tom-half-whole") && !p7.includes("pentatonica-menor"));
  assert.ok(n5.includes("pentatonica-menor") && n5.includes("yo-japonesa") && !n5.includes("diatonica-maior-jonia"));
  assert.ok(n6.includes("pentatonica-menor") && n6.includes("egipcia-pentatonica-suspensa") && n6.includes("diatonica-maior-jonia"));
  assert.ok(!n6.includes("yo-japonesa"), "NAF 6: pentatônica sem nota auxiliar consagrada não aparece");
  assert.ok(!E.serve("diatonica-maior-jonia", "pife", 5) && E.serve("diatonica-maior-jonia", "pife", 6));
});

ok("NAF 6 furos na pentatônica menor: auxiliar = 6ª menor (+8), como o furo extra de antes", () => {
  assert.deepStrictEqual(E.layout("pentatonica-menor", 6, "naf"), { furos: [3, 5, 7, 8, 10, 12], aux: [8] });
  assert.deepStrictEqual(N.escala("pentatonica-menor", 67, 6), [70, 72, 74, 75, 77, 79]);
  assert.strictEqual(N.ehAux("pentatonica-menor", 6, 3), true);
  assert.strictEqual(N.ehAux("personalizada", 6, 3), false);
  assert.deepStrictEqual(N.escala("dorica", 62, 6), [64, 65, 67, 69, 71, 72]);
});

ok("sequência para ouvir: Subir = tônica até a oitava; Ida e volta = sobe e desce sem repetir a oitava", () => {
  const f0 = 392, furos = [2, 4, 5, 7, 9, 11].map((s) => ({ hz: f0 * Math.pow(2, s / 12), aux: false }));
  const sobe = E.sequencia(f0, furos, "subir");
  assert.strictEqual(sobe.length, 8);
  perto(sobe[0], 392, 1e-9, "tônica"); perto(sobe[7], 784, 1e-9, "oitava");
  for (let k = 1; k < sobe.length; k++) assert.ok(sobe[k] > sobe[k - 1]);
  const iv = E.sequencia(f0, furos, "ida-e-volta");
  assert.strictEqual(iv.length, 15);
  assert.deepStrictEqual(iv.slice(0, 8), sobe);
  assert.deepStrictEqual(iv.slice(8), sobe.slice(0, 7).reverse());
  /* furo da oitava já existe: não duplica; furo auxiliar (NAF) não toca */
  const naf = [3, 5, 7, 8, 10, 12].map((s) => ({ hz: 440 * Math.pow(2, s / 12), aux: s === 8 }));
  const sn = E.sequencia(440, naf, "subir");
  assert.deepStrictEqual(sn.map((h) => Math.round(1200 * Math.log2(h / 440))), [0, 300, 500, 700, 1000, 1200]);
});

ok("pífano: Lá 440/432 muda as notas tocadas; frequências vêm do pife calculado", () => {
  [440, 432].forEach((la) => {
    const e = { tom: "sol", la: la, temp: 25, D: 18, parede: 4, emb: 10, furos: [8, 10, 7, 10, 10, 10] };
    const r = P.calcular(e), seq = E.sequencia(r.f0, r.furos.map((f) => ({ hz: f.freq, aux: !!f.aux })), "subir");
    perto(seq[0], la * Math.pow(2, (67 - 69) / 12), 1e-9, "Sol 4 com Lá " + la);
    perto(seq[seq.length - 1], 2 * seq[0], 1e-9, "oitava");
    assert.strictEqual(seq.length, 8);
  });
});

ok("pífano: escala maior de 6 furos dá exatamente o mesmo cálculo de antes (com e sem semitons explícitos)", () => {
  const e = { tom: "re-grave", la: 440, temp: 25, D: 20, parede: 4, emb: 11, furos: [9, 11, 8, 11, 11, 11] };
  const a = P.calcular(e), b = P.calcular(Object.assign({}, e, { semitons: [2, 4, 5, 7, 9, 11], aux: [] }));
  assert.deepStrictEqual(a, b);
  assert.deepStrictEqual(P.otimizarFuros({ tom: "sol", la: 440, temp: 25, D: 18, parede: 4, emb: 10, furos: [] }), [8, 10, 7, 10, 10, 10]);
  assert.deepStrictEqual(P.padraoFuros([2, 4, 5, 7, 9, 11]), [8, 10, 7, 10, 10, 10]);
});

ok("pífano com outra escala e outra quantidade de furos: notas certas, furos em ordem e dentro do tubo", () => {
  [["pentatonica-menor", 5], ["nordestina-lidio-7-baiao-pifano", 6], ["mixolidia", 6], ["diatonica-maior-jonia", 7], ["blues-menor-pentatonica-5", 6]].forEach(([id, k]) => {
    ["sol", "re-agudo", "do-grave"].forEach((tom) => {
      const l = E.layout(id, k, "pife"), base = { tom, la: 440, temp: 25, D: P.tuboSugerido(tom), parede: 3.5, emb: 10, semitons: l.furos, aux: l.aux };
      base.furos = P.otimizarFuros(base);
      assert.strictEqual(base.furos.length, k);
      const r = P.calcular(base), midi = P.TONS.filter((t) => t.id === tom)[0].midi;
      assert.strictEqual(r.furos.length, k);
      r.furos.forEach((f, i) => {
        assert.strictEqual(f.midi, midi + l.furos[i], id + " " + tom + " nota do furo " + (i + 1));
        assert.ok(isFinite(f.daBoca) && f.daBoca > 0 && f.daBoca < r.bocaAoPe, id + " " + tom + " furo " + (i + 1) + " dentro do tubo");
        if (i > 0) assert.ok(f.daBoca < r.furos[i - 1].daBoca, id + " " + tom + " ordem dos furos");
      });
    });
  });
  /* mais furo aberto = nota mais aguda = furo mais perto da boca; 5 furos pentatônica: o furo de cima é a oitava */
  const l5 = E.layout("pentatonica-menor", 5, "pife");
  assert.deepStrictEqual(l5.furos, [3, 5, 7, 10, 12]);
});

ok("NAF com outra escala: sugestão calcula sem erro e marca o furo pequeno no meio tom", () => {
  [["pentatonica-maior", 6], ["diatonica-maior-jonia", 6], ["yo-japonesa", 5], ["blues-menor-pentatonica-5", 5]].forEach(([id, k]) => {
    [60, 67, 72].forEach((m) => {
      const sug = N.sugerir({ furos: k, midi: m, escala: id }), notas = N.escala(id, m, k);
      const r = N.calcular({ furos: k, escala: id, fundamental: N.nomeEn(m), a4: 440, temperatura: 20, diametroExterno: sug.diametroExterno, parede: sug.parede,
        janelaCompr: sug.janelaCompr, janelaLarg: sug.janelaLarg, janelaAltura: sug.janelaAltura, cabeca: sug.cabeca, ponta: 0,
        linhas: notas.map((x, i) => ({ nota: N.nomeEn(x), diametro: sug.diametros[i] })) });
      assert.ok(r.ok, id + " " + k + " midi " + m + ": " + JSON.stringify(r.erros));
      const l = E.layout(id, k, "naf");
      r.furos.forEach((f, i) => assert.strictEqual(f.extra, l.aux.indexOf(l.furos[i]) >= 0));
    });
  });
});

console.log("escalas: " + n + " verificações OK");
