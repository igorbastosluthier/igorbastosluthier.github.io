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
      if (py[i].razaoCorte === null) {
        /* o Python (Bracker) dá NaN no furo do pé da NAF de 5 furos; nossa extensão estima com s = distância ao fim acústico */
        assert.ok(f.corteEstimado && i === 0, "só o furo do pé (primeiro ativo) pode ser estimado");
        const bore = e.diametroExterno - 2 * e.parede, c = 20055 * Math.sqrt(e.temperatura + 270.15), d = f.diametro;
        perto(f.razaoCorte, (c / (2 * Math.PI)) * (d / bore) / Math.sqrt((e.parede + 0.75 * d) * f.doPeAcustico) / f.hz, 1e-9, "razaoCorte estimada");
      } else { assert.ok(!f.corteEstimado); perto(f.razaoCorte, py[i].razaoCorte, 1e-9, "razaoCorte"); }
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
/* 2b. NAF de 6 furos (Flutopedia Basic-Six, furos contados do pé): 5 notas da pentatônica + 1 furo EXTRA (o 4º do pé, +8) */
t("6 furos: furo 4 do pé é o extra (6ª menor), os outros 5 são a pentatônica", function () {
  const m = 67, e6 = N.escala("pentatonica-menor", m, 6);
  assert.deepStrictEqual(e6.map(N.nomeEn), ["Bb4", "C5", "D5", "Eb5", "F5", "G5"]);
  assert.deepStrictEqual(e6.map(x => x - m), [3, 5, 7, 8, 10, 12]);
  assert.strictEqual(N.FURO_EXTRA[6], 3);
  assert.ok(Math.abs(N.freqNota(e6[3], 440) - 622.254) < 0.001, "Eb5 = 622,25 Hz");
  assert.deepStrictEqual(e6.filter((x, i) => i !== 3).map(x => x - m), [3, 5, 7, 10, 12]); /* sem o extra = 3-2-2-3-2 */
});

function cfg(n, over) {
  const notas = N.escala("pentatonica-menor", 67, n), sug = N.sugerir({ furos: n, midi: 67 });
  const e = Object.assign({}, sug, { furos: n, fundamental: "G4", a4: 440, temperatura: 20, escala: "pentatonica-menor" });
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
  assert.deepStrictEqual(r6.furos.map(f => f.extra), [false, false, false, true, false, false]);
  assert.ok(r5.furos.every(f => !f.extra));
  assert.deepStrictEqual(r6.furos.map(f => f.nota), ["Si♭ 4", "Dó 5", "Ré 5", "Mi♭ 5", "Fá 5", "Sol 5"]);
  const e = cfg(5); e.linhas.push({ nota: "Sib 5", diametro: 8, ativo: true }); /* linha sobrando é ignorada */
  assert.strictEqual(N.calcular(e).furos.length, 5);
});
t("linha inativa não vira furo de diâmetro zero", function () {
  const e = cfg(6); e.linhas[3].ativo = false; /* desativa o furo extra */
  const r = N.calcular(e);
  assert.ok(r.ok, JSON.stringify(r.erros));
  assert.strictEqual(r.furos.length, 5); assert.ok(r.furos.every(f => f.diametro > 0 && f.linha !== 4));
});

/* 5. ordem pé -> boca e conversão Bracker */
t("ordem: furo 1 é o mais perto do pé; conversão Bracker coerente", function () {
  const r = N.calcular(cfg(6));
  for (let i = 1; i < r.furos.length; i++) { assert.ok(r.furos[i].doPe > r.furos[i - 1].doPe); assert.ok(r.furos[i].hz > r.furos[i - 1].hz); assert.ok(r.furos[i].daJanela < r.furos[i - 1].daJanela); }
  assert.ok(r.furos[5].daJanela > 0 && r.furos[0].doPe > 0 && r.furos[0].doPe < r.janelaDoPe);
  assert.deepStrictEqual(N.LINHAS_BRACKER[6], [0, 2, 3, 4, 5, 6]); assert.deepStrictEqual(N.LINHAS_BRACKER[5], [0, 2, 3, 4, 5]);
  r.furos.forEach((f, i) => { if (i) perto(f.espacoAbaixo, f.doPe - r.furos[i - 1].doPe, 1e-12, "espaço"); });
  const e = cfg(5); e.linhas.reverse(); const x = N.calcular(e); /* notas invertidas */
  assert.strictEqual(x.ok, false); assert.ok(/Ordem de notas/.test(x.erros[0].msg));
});

/* 6. sanidade geométrica */
t("entradas inválidas são rejeitadas sem NaN/Infinity", function () {
  [{ parede: 14 }, { escala: "x", furos: 4 }, { diametroExterno: "abc" }, { janelaCompr: 0 }, { a4: -1 }, { temperatura: NaN }, { fundamental: "H9" }, { fundamental: "C6" }, { ponta: -3 }, { furos: 7 }].forEach(function (o) {
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

/* 8b. sugestões iniciais têm solução em TODAS as fundamentais permitidas (Dó 3 a Sol 5), 5 e 6 furos, várias temperaturas */
t("sugestões iniciais têm solução (MIDI 48-79, 5 e 6 furos, -10 a 50 °C)", function () {
  const falhas = [];
  [5, 6].forEach(function (n) {
    for (let m = N.MIDI_MIN; m <= N.MIDI_MAX; m++) [-10, 0, 10, 20, 35, 50].forEach(function (temp) {
      const sug = N.sugerir({ furos: n, midi: m, temp: temp }), notas = N.escala("pentatonica-menor", m, n);
      const r = N.calcular({ furos: n, fundamental: N.nomeEn(m), a4: 440, temperatura: temp, escala: "pentatonica-menor", diametroExterno: sug.diametroExterno, parede: sug.parede,
        janelaCompr: sug.janelaCompr, janelaLarg: sug.janelaLarg, janelaAltura: sug.janelaAltura, cabeca: sug.cabeca, ponta: 0,
        linhas: notas.map((x, i) => ({ nota: N.nomeEn(x), diametro: sug.diametros[i] })) });
      if (!r.ok) falhas.push(n + " furos " + N.nomeEn(m) + " " + temp + "C");
    });
  });
  assert.deepStrictEqual(falhas, []);
});

/* 8c. o rótulo nunca contradiz o Hz usado como alvo */
t("Hz explícito diferente da nota: rótulo mostra a nota mais próxima com ≈", function () {
  const e = cfg(5); e.linhas[0] = { nota: "Sib 4", hz: 480, diametro: e.linhas[0].diametro, ativo: true };
  const f = N.calcular(e).furos[0];
  assert.strictEqual(f.hz, 480); assert.ok(/^≈ /.test(f.nota) && /^≈ /.test(f.notaIng), f.nota);
  assert.ok(Math.abs(f.notaProxima.cents) > 0.5);
  e.linhas[0].hz = N.freqNota(70, 440); /* exatamente Sib 4 */
  assert.strictEqual(N.calcular(e).furos[0].nota, "Si♭ 4");
  e.linhas[0].hz = 466.1638 * Math.pow(2, 0.3 / 1200); /* 0,3 cent: ainda é Sib 4 */
  assert.strictEqual(N.calcular(e).furos[0].nota, "Si♭ 4");
});

/* 8d. cabeça vazia ou inválida é erro claro (não vira 0 com aviso falso) */
t("cabeça vazia/ilegível é rejeitada com mensagem clara", function () {
  ["", "abc", undefined, null].forEach(function (c) {
    const r = N.calcular(cfg(5, { cabeca: c })); assert.strictEqual(r.ok, false, String(c));
    assert.ok(r.erros.some(x => x.campo === "cabeca" && /informe um número/.test(x.msg)), JSON.stringify(r.erros));
  });
  assert.strictEqual(N.calcular(cfg(5, { cabeca: "89" })).ok, true);
});

/* 8e. caso do dono (5 furos, Dó 5): o furo do pé ganha cutoff estimado, texto simples, sem NaN/null/R3 */
t("5 furos: cutoff do furo do pé estimado (caso do dono) e avisos em português simples", function () {
  const e = { furos: 5, escala: "pentatonica-menor", fundamental: "C5", a4: 440, temperatura: 25, diametroExterno: 22.4, parede: 3, janelaCompr: 5, janelaLarg: 12, janelaAltura: 8, cabeca: 85, ponta: 0,
    linhas: ["Eb5", "F5", "G5", "Bb5", "C6"].map((n, i) => ({ nota: n, diametro: [9, 8, 9, 11, 9][i] })) };
  const r = N.calcular(e); assert.ok(r.ok, JSON.stringify(r.erros));
  assert.ok(Number.isFinite(r.furos[0].razaoCorte) && r.furos[0].corteEstimado === true);
  assert.ok(r.furos.slice(1).every(f => !f.corteEstimado && Number.isFinite(f.razaoCorte)));
  perto(r.furos[0].doPe, 67.892, 1e-4, "posição do furo 1 (igual ao Python do Lab)");
  perto(r.furos[0].razaoCorte, 1.880, 1e-3, "razão estimada");
  const txt = r.avisos.join(" | ");
  assert.ok(/estimativa/.test(txt) && !/R3|NaN|null|indisponível|undefined/.test(txt), txt);
});

/* 8f. varredura: nenhuma saída com NaN/null/indisponível/jargão, 5 e 6 furos, todas as fundamentais, 6 temperaturas */
t("varredura: sem NaN/null/indisponível/jargão em resultados e avisos", function () {
  let n = 0, ruins = [];
  [5, 6].forEach(function (nf) {
    for (let m = N.MIDI_MIN; m <= N.MIDI_MAX; m++) [-10, 0, 10, 20, 35, 50].forEach(function (temp) {
      const sug = N.sugerir({ furos: nf, midi: m, temp: temp });
      const r = N.calcular({ furos: nf, fundamental: N.nomeEn(m), a4: 440, temperatura: temp, escala: "pentatonica-menor", diametroExterno: sug.diametroExterno, parede: sug.parede,
        janelaCompr: sug.janelaCompr, janelaLarg: sug.janelaLarg, janelaAltura: sug.janelaAltura, cabeca: sug.cabeca, ponta: 0,
        linhas: N.escala("x", m, nf).map((x, i) => ({ nota: N.nomeEn(x), diametro: sug.diametros[i] })) });
      if (!r.ok) { ruins.push(nf + "f " + N.nomeEn(m) + " " + temp + " erro"); return; }
      n++;
      const j = JSON.stringify(r);
      if (/NaN|Infinity|undefined/.test(j) || r.furos.some(f => f.razaoCorte === null || f.corte === null)) ruins.push(nf + "f " + N.nomeEn(m) + " " + temp + " valor ausente");
      if (/R3|R2|L1|indispon|null|NaN/.test(r.avisos.join(" "))) ruins.push(nf + "f " + N.nomeEn(m) + " " + temp + " jargão: " + r.avisos.join(" | "));
      if (r.furos.filter(f => f.corteEstimado).length !== (nf === 5 ? 1 : 0)) ruins.push(nf + "f " + N.nomeEn(m) + " " + temp + " estimado inesperado");
    });
  });
  assert.deepStrictEqual(ruins, []); assert.ok(n === 2 * 32 * 6, "todas as combinações calculadas: " + n);
});

/* 9. parser de notas */
t("parser de notas pt-BR/inglês", function () {
  [["G4", 67], ["Sol 4", 67], ["sol4", 67], ["Sib4", 70], ["Bb4", 70], ["Si♭ 4", 70], ["Fá#5", 78], ["Lá 4", 69], ["Dó 3", 48]].forEach(([s, m]) => assert.strictEqual(N.parseNota(s), m, s));
  assert.strictEqual(N.parseNota("xx"), null);
});

console.log("naf: " + ok + " verificações OK");
