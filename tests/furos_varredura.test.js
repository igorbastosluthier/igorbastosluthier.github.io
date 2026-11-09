/* Varredura completa (pedido do Igor): para QUALQUER escala, quantidade de furos e tom, a calculadora sugere uma flauta
   válida, sem furos encostados, e as notas continuam as da escala. Pífano: todas as escalas × 5/6/7 furos × 23 tons
   (tubo indicado de cada tom). NAF: todas as escalas × 5/6 furos × Dó 3 a Sol 5 (medidas sugeridas), mais a
   "Personalizada" com notas digitadas. Rodar: node tests/furos_varredura.test.js */
"use strict";
const assert = require("assert");
const P = require("../assets/pife-calc.js"), N = require("../assets/naf-calc.js"), E = require("../assets/escalas.js"), A = require("../assets/ajuste-furos.js");
const cents = (a, b) => 1200 * Math.log2(a / b);
let n = 0;
const ok = (nome, fn) => { fn(); n++; console.log("  ok  " + nome); };

ok("texto do aviso: curto, sem jargão, diz que a afinação continua certa", () => {
  assert.strictEqual(A.textoAjuste([{ indice: 2, de: 10, para: 8.6 }, { indice: 3, de: 10, para: 8.6 }]),
    "Ajustamos o tamanho dos furos 3 e 4 (de 10 para 8,6 mm) para eles não ficarem encostados. A afinação continua certa.");
  assert.strictEqual(A.textoAjuste([{ indice: 0, de: 9, para: 8.4 }]), "Ajustamos o tamanho do furo 1 (de 9 para 8,4 mm) para ele não ficar encostado. A afinação continua certa.");
  assert.strictEqual(A.textoAjuste([]), "");
});

ok("ajuste: furo encostado é resolvido mudando o tamanho; as posições saem da conta normal", () => {
  /* Sol 4, tubo 18: furos 3 e 4 bem grandes ficam encostados */
  const e = { tom: "sol", la: 440, temp: 25, D: 18, parede: 4, emb: 10, embForma: "redondo", furos: [8, 10, 14, 14, 10, 10] };
  assert.ok(P.apertos(e, P.calcular(e).furos).length > 0, "o caso de teste precisa ter aperto");
  const a = P.ajustarFuros(e), e2 = Object.assign({}, e, { furos: a.diametros }), r = P.calcular(e2);
  assert.ok(a.ok && P.apertos(e2, r.furos).length === 0, JSON.stringify(a));
  assert.ok(a.ajustados.length > 0 && a.ajustados.every((x) => x.para >= Math.max(3.5, 0.25 * 18) - 1e-9 && x.para <= 0.8 * 18 + 1e-9));
  r.furos.forEach((f, i) => assert.ok(Math.abs(cents(f.freq, P.freqMidi(67 + [2, 4, 5, 7, 9, 11][i], 440))) < 1e-9));
  console.log("      exemplo: " + A.textoAjuste(a.ajustados));
});

ok("pífano: todas as escalas × 5/6/7 furos × 23 tons: 0 furos encostados, 0 erros, notas da escala", () => {
  let tot = 0, ajust = 0; const ex = [];
  [5, 6, 7].forEach((k) => E.aplicaveis("pife", k).forEach((es) => P.TONS.forEach((t) => {
    const D = P.tuboSugerido(t.id), l = E.layout(es.id, k, "pife");
    const e = { tom: t.id, la: 440, temp: 25, D, parede: P.paredeIdeal(D), emb: Math.round(D * 0.53), embForma: "redondo", semitons: l.furos, aux: l.aux };
    e.furos = P.otimizarFuros(e);
    const a = P.ajustarFuros(e), e2 = Object.assign({}, e, { furos: a.diametros }), r = P.calcular(e2);
    const nome = k + " furos " + es.nome + " " + t.nome;
    assert.ok(a.ok, nome + ": ajuste não fechou (" + a.falta + ")");
    assert.deepStrictEqual(P.apertos(e2, r.furos), [], nome);
    r.furos.forEach((f, i) => {
      assert.strictEqual(f.midi, t.midi + l.furos[i], nome + " nota");
      assert.ok(f.daBoca > 0 && f.daBoca < r.bocaAoPe && (i === 0 || f.daBoca < r.furos[i - 1].daBoca), nome + " posição");
      assert.ok(f.diametro <= 0.8 * D + 1e-9, nome + " furo grande");
    });
    assert.ok(!r.avisos.some((x) => /muito perto/.test(x)), nome + ": " + r.avisos.join(" | "));
    tot++; if (a.ajustados.length) { ajust++; if (ex.length < 3) ex.push(nome + ": " + A.textoAjuste(a.ajustados)); }
  })));
  console.log("      pífano: " + tot + " combinações, " + ajust + " com furos ajustados");
  ex.forEach((x) => console.log("      exemplo: " + x));
  assert.ok(tot > 1400);
});

function nafCaso(k, esId, m, temp) {
  const sg = N.sugerir({ furos: k, midi: m, escala: esId, temp: temp }), notas = N.escala(esId, m, k);
  return { furos: k, escala: esId, fundamental: N.nomeEn(m), a4: 440, temperatura: temp, diametroExterno: sg.diametroExterno, parede: sg.parede,
    janelaCompr: sg.janelaCompr, janelaLarg: sg.janelaLarg, janelaAltura: sg.janelaAltura, cabeca: sg.cabeca, ponta: 0,
    linhas: notas.map((x, i) => ({ nota: N.nomeEn(x), diametro: sg.diametros[i] })) };
}
function nafConfere(e, nome) {
  const a = N.ajustarFuros(e);
  const e2 = Object.assign({}, e, { linhas: e.linhas.map((l, i) => Object.assign({}, l, { diametro: a.diametros[i] })) }), r = N.calcular(e2);
  assert.ok(r.ok, nome + ": " + JSON.stringify(r.erros));
  assert.ok(a.ok, nome + ": ajuste não fechou (" + a.falta + ")");
  assert.deepStrictEqual(N.apertos(r), [], nome);
  assert.ok(!r.avisos.some((x) => /cruza|muito perto|encosta/.test(x)), nome + ": " + r.avisos.join(" | "));
  r.furos.forEach((f, i) => { assert.ok(Math.abs(cents(f.hz, N.freqNota(N.parseNota(e.linhas[i].nota), 440))) < 1e-9, nome + " nota"); assert.ok(f.diametro <= 0.72 * r.diametroInterno + 1e-9); });
  return a;
}

ok("NAF: todas as escalas × 5/6 furos × Dó 3 a Sol 5 (e 3 temperaturas no Sol 4): 0 encostados, 0 erros, notas certas", () => {
  let tot = 0, ajust = 0; const ex = [];
  [5, 6].forEach((k) => E.aplicaveis("naf", k).forEach((es) => {
    for (let m = N.MIDI_MIN; m <= N.MIDI_MAX; m++) [20].concat(m === 67 ? [5, 35] : []).forEach((temp) => {
      const nome = k + " furos " + es.nome + " " + N.nomePt(m) + " " + temp + "°C", a = nafConfere(nafCaso(k, es.id, m, temp), nome);
      tot++; if (a.ajustados.length) { ajust++; if (ex.length < 3) ex.push(nome + ": " + A.textoAjuste(a.ajustados)); }
    });
  }));
  console.log("      NAF: " + tot + " combinações, " + ajust + " com furos ajustados");
  ex.forEach((x) => console.log("      exemplo: " + x));
  assert.ok(tot > 1300);
});

ok("NAF Personalizada: notas digitadas (fora da escala) com os tamanhos sugeridos também viram flauta válida", () => {
  let tot = 0;
  [[5, [2, 3, 7, 9, 12]], [5, [1, 4, 5, 8, 10]], [6, [2, 3, 4, 5, 7, 9]], [6, [1, 2, 5, 6, 10, 11]]].forEach(([k, st]) => {
    [55, 62, 67, 72].forEach((m) => {
      const e = nafCaso(k, "pentatonica-menor", m, 20);
      e.escala = "personalizada"; e.linhas = e.linhas.map((l, i) => Object.assign({}, l, { nota: N.nomeEn(m + st[i]) }));
      nafConfere(e, "personalizada " + k + " " + st + " " + N.nomePt(m)); tot++;
    });
  });
  console.log("      personalizada: " + tot + " casos");
});

console.log("varredura dos furos: " + n + " verificações OK");
