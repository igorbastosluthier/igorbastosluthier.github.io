/* Testes da NAF: paridade numérica com o Python original (fixtures geradas por tests/gen_naf_reference.py),
   frequências da pentatônica menor de Sol 4, Hz explícito, topologia, ordem, sanidade e datum. */
"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path");
const N = require("../assets/naf-calc.js");
const ref = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "naf_ref.json"), "utf8"));
let ok = 0;
const t = (nome, fn) => { fn(); ok++; console.log("  ok  " + nome); };
const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), msg + ": " + a + " vs " + b);

/* 1. paridade com o Bracker/Flute Lab (tolerância relativa 1e-9) */
ref.casos.forEach(function (c) {
  t("paridade Python: " + c.nome, function () {
    const e = c.entrada;
    const r = N.calcular({ furos: e.furos, fundamental: e.fundamental, a4: e.a4, temperatura: e.temperatura, diametroExterno: e.diametroExterno,
      parede: e.parede, janelaCompr: e.janelaCompr, janelaLarg: e.janelaLarg, janelaAltura: e.janelaAltura, cabeca: e.cabeca, ponta: e.ponta,
      linhas: e.linhas.map(l => ({ nota: l.nota, hz: l.hz, diametro: l.diametro, ativo: l.ativo })) });
    if (c.erro) { assert.strictEqual(r.ok, false, "o Python recusou; o JS também deve recusar"); assert.ok(r.erros[0].msg.length > 10); return; }
    assert.strictEqual(r.ok, true, JSON.stringify(r.erros));
    const o = c.saida, py = o.furosBoca2Pe.slice().reverse(); /* Python: boca->pé; JS: pé->boca */
    assert.strictEqual(r.furos.length, py.length);
    r.furos.forEach(function (f, i) {
      perto(f.hz, py[i].hz, 1e-9, "hz"); perto(f.diametro, py[i].diametro, 1e-12, "diâmetro");
      perto(f.doPe, py[i].doPe, 1e-9, "doPe"); perto(f.doPeAcustico, py[i].doPeAcustico, 1e-9, "doPeAcustico");
      perto(f.daJanela, py[i].daJanela, 1e-9, "daJanela");
      if (py[i].razaoCorte === null) assert.strictEqual(f.razaoCorte, null); else perto(f.razaoCorte, py[i].razaoCorte, 1e-9, "razaoCorte");
      if (py[i].corte !== null) perto(f.corte, py[i].corte, 1e-9, "corte Hz");
    });
    perto(r.comprimentoAcustico, o.comprimentoAcustico, 1e-9, "comprimento acústico");
    perto(r.comprimentoFisico, o.comprimentoFisico, 1e-9, "comprimento físico");
    perto(r.diametroInterno, o.furoInterno, 1e-12, "bore"); perto(r.furoOtimo, o.furoOtimo, 1e-9, "bore ótimo");
    /* datum: janela a partir do pé = acústico + ponta; furo a partir da janela = acústico - furo(fim acústico) */
    perto(r.janelaDoPe, o.comprimentoAcustico + c.entrada.ponta, 1e-9, "janela do pé");
    r.furos.forEach(f => perto(f.doPe + f.daJanela, r.janelaDoPe, 1e-9, "doPe + daJanela = janelaDoPe"));
  });
});

/* 2. Sol 4, A4=440: fundamental + 5 alvos da pentatônica menor (seção 4 do brief) */
const esperadas = [392.00, 466.16, 523.25, 587.33, 698.46, 783.99];
t("Sol 4 / A4=440: fundamental e alvos da pentatônica menor", function () {
  const m = N.parseNota("Sol 4");
  const f = N.escala("pentatonica-menor", m, 5).map(x => N.freqNota(x, 440));
  perto(N.freqFundamental(m, 440), esperadas[0], 5e-5, "fundamental");
  f.forEach((hz, i) => assert.ok(Math.abs(hz - esperadas[i + 1]) < 0.006, "alvo " + (i + 1) + ": " + hz));
  assert.deepStrictEqual(N.escala("pentatonica-menor", m, 5).map(N.nomeEn), ["Bb4", "C5", "D5", "F5", "G5"]);
});

function cfg(n, over) {
  const notas = N.escala("pentatonica-menor", 67, n), sug = N.sugerir({ furos: n, midi: 67 });
  const e = Object.assign({}, sug, { furos: n, fundamental: "G4", a4: 440, temperatura: 20 });
  e.linhas = notas.map((m, i) => ({ nota: N.nomeEn(m), diametro: sug.diametros[i], ativo: true }));
  return Object.assign(e, over || {});
}

/* 3. Hz explícito é soberano */
t("Hz explícito vence a nota temperada", function () {
  const e = cfg(5); e.linhas[0] = { nota: "Sib 4", hz: 470.5, diametro: e.linhas[0].diametro, ativo: true };
  const r = N.calcular(e); assert.ok(r.ok, JSON.stringify(r.erros));
  assert.strictEqual(r.furos[0].hz, 470.5); assert.strictEqual(r.furos[0].fonteHz, "hz");
  const r2 = N.calcular(cfg(5)); assert.ok(r2.furos[0].doPe !== r.furos[0].doPe, "posição muda com o Hz");
  assert.ok(Math.abs(r2.furos[0].hz - 466.1638) < 1e-3);
  e.linhas[0] = { hz: 440, diametro: e.linhas[0].diametro, ativo: true }; /* só Hz, sem nota */
  assert.strictEqual(N.calcular(e).furos[0].hz, 440);
});

/* 4. topologia 5/6 */
t("5 furos calcula 5; 6 furos calcula 6; sem resíduos", function () {
  const r5 = N.calcular(cfg(5)), r6 = N.calcular(cfg(6));
  assert.ok(r5.ok && r6.ok, JSON.stringify([r5.erros, r6.erros]));
  assert.strictEqual(r5.furos.length, 5); assert.strictEqual(r6.furos.length, 6);
  assert.deepStrictEqual(r6.furos.map(f => f.linha), [1, 2, 3, 4, 5, 6]);
  const e = cfg(5); e.linhas.push({ nota: "Sib 5", diametro: 8, ativo: true }); /* linha sobrando é ignorada */
  assert.strictEqual(N.calcular(e).furos.length, 5);
});
t("linha inativa não vira furo de diâmetro zero", function () {
  const e = cfg(6); e.linhas[3].ativo = false;
  const r = N.calcular(e);
  assert.ok(r.ok, JSON.stringify(r.erros));
  assert.strictEqual(r.furos.length, 5); assert.ok(r.furos.every(f => f.diametro > 0 && f.linha !== 4));
});

/* 5. ordem pé -> boca e conversão Bracker */
t("ordem: furo 1 é o mais perto do pé; conversão Bracker coerente", function () {
  const r = N.calcular(cfg(6));
  for (let i = 1; i < r.furos.length; i++) { assert.ok(r.furos[i].doPe > r.furos[i - 1].doPe); assert.ok(r.furos[i].hz > r.furos[i - 1].hz); assert.ok(r.furos[i].daJanela < r.furos[i - 1].daJanela); }
  assert.ok(r.furos[5].daJanela > 0 && r.furos[0].doPe > 0 && r.furos[0].doPe < r.janelaDoPe);
  assert.deepStrictEqual(N.LINHAS_BRACKER[6], [0, 2, 3, 4, 5, 6]); assert.deepStrictEqual(N.LINHAS_BRACKER[5], [2, 3, 4, 5, 6]);
  r.furos.forEach((f, i) => { if (i) perto(f.espacoAbaixo, f.doPe - r.furos[i - 1].doPe, 1e-12, "espaço"); });
  const e = cfg(5); e.linhas.reverse(); const x = N.calcular(e); /* notas invertidas */
  assert.strictEqual(x.ok, false); assert.ok(/Ordem de notas/.test(x.erros[0].msg));
});

/* 6. sanidade geométrica */
t("entradas inválidas são rejeitadas sem NaN/Infinity", function () {
  [{ parede: 14 }, { diametroExterno: "abc" }, { janelaCompr: 0 }, { a4: -1 }, { temperatura: NaN }, { fundamental: "H9" }, { fundamental: "C6" }, { ponta: -3 }, { furos: 7 }].forEach(function (o) {
    const r = N.calcular(cfg(5, o)); assert.strictEqual(r.ok, false, JSON.stringify(o)); assert.ok(r.erros[0].msg && r.erros[0].campo);
  });
  const e = cfg(5); e.linhas[2].diametro = 0; assert.strictEqual(N.calcular(e).ok, false);
  assert.ok(!/NaN|Infinity/.test(JSON.stringify(N.calcular(cfg(6)))));
  const g = cfg(6); g.linhas.forEach(l => l.diametro = 40); const rg = N.calcular(g);
  assert.ok(!rg.ok ? rg.erros.length > 0 : !/NaN|Infinity/.test(JSON.stringify(rg)));
});

/* 7. diâmetro recalcula posições sem mudar o resto */
t("alterar um diâmetro recalcula posições e não altera os demais campos", function () {
  const a = cfg(5), b = cfg(5); b.linhas[1].diametro += 2;
  const ra = N.calcular(a), rb = N.calcular(b);
  assert.ok(ra.ok && rb.ok);
  assert.ok(ra.furos[1].doPe !== rb.furos[1].doPe);
  assert.strictEqual(ra.entrada.parede, rb.entrada.parede); assert.strictEqual(ra.entrada.janelaCompr, rb.entrada.janelaCompr);
  assert.strictEqual(a.linhas[0].diametro, b.linhas[0].diametro);
});

/* 8. avisos não movem furos: a mesma geometria dá as mesmas posições com ou sem avisos; a entrada não é alterada */
t("avisos não alteram posições nem a entrada", function () {
  const e = cfg(6); const copia = JSON.stringify(e);
  const r1 = N.calcular(e), r2 = N.calcular(e);
  assert.strictEqual(JSON.stringify(e), copia);
  assert.deepStrictEqual(r1.furos, r2.furos);
  const w = cfg(5, { diametroExterno: 28, parede: 2.6 }); const rw = N.calcular(w);
  assert.ok(rw.ok, JSON.stringify(rw.erros)); assert.ok(rw.avisos.length > 0, "tubo largo demais deve avisar");
  assert.strictEqual(JSON.stringify(w), JSON.stringify(cfg(5, { diametroExterno: 28, parede: 2.6 })));
});

/* 9. parser de notas */
t("parser de notas pt-BR/inglês", function () {
  [["G4", 67], ["Sol 4", 67], ["sol4", 67], ["Sib4", 70], ["Bb4", 70], ["Si♭ 4", 70], ["Fá#5", 78], ["Lá 4", 69], ["Dó 3", 48]].forEach(([s, m]) => assert.strictEqual(N.parseNota(s), m, s));
  assert.strictEqual(N.parseNota("xx"), null);
});

console.log("naf: " + ok + " verificações OK");
