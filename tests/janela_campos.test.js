/* Janela do som x saída de ar x canal raso no motor: só a janela do som (comprimento, largura, altura) entra na conta da afinação.
   Saída de ar e canal raso servem para o desenho e o molde: mudar qualquer um deles não muda posição, afinação nem aviso de furo. */
"use strict";
const assert = require("assert"), path = require("path");
const N = require(path.join(__dirname, "..", "assets", "naf-calc.js")), E = require(path.join(__dirname, "..", "assets", "escalas.js"));
let ok = 0; const t = (nome, fn) => { fn(); ok++; console.log("  ok  " + nome); };
const caso = (over) => {
  const sg = N.sugerir({ furos: 5, midi: 67 }), semis = E.layout("pentatonica-menor", 5, "naf").furos;
  return Object.assign({ furos: 5, escala: "pentatonica-menor", fundamental: "G4", a4: 440, temperatura: 20, diametroExterno: sg.diametroExterno, parede: sg.parede,
    janelaCompr: sg.janelaCompr, janelaLarg: sg.janelaLarg, janelaAltura: sg.janelaAltura, cabeca: sg.cabeca, ponta: 0,
    linhas: semis.map((st, i) => ({ nota: N.nomeEn(67 + st), diametro: sg.diametros[i] })) }, over || {});
};
const conta = (r) => JSON.stringify({ f: r.furos.map((f) => [f.doPe, f.daJanela, f.hz, f.diametro, f.razaoCorte]), a: r.avisos, j: r.janelaDoPe, c: r.comprimentoFisico });

t("saída de ar e canal raso não entram na conta (posições, afinação, avisos iguais)", () => {
  const base = N.calcular(caso());
  [{ saidaCompr: 20 }, { saidaLarg: 30 }, { canalCompr: 80 }, { saidaCompr: 5, saidaLarg: 5, canalCompr: 5 }].forEach((o) => assert.strictEqual(conta(N.calcular(caso(o))), conta(base), JSON.stringify(o)));
});
t("a janela do som entra na conta (comprimento, largura e altura mudam as posições)", () => {
  const base = conta(N.calcular(caso()));
  [{ janelaCompr: 13.4 }, { janelaLarg: 15 }, { janelaAltura: 5 }].forEach((o) => assert.notStrictEqual(conta(N.calcular(caso(o))), base, JSON.stringify(o)));
});
t("sem os campos novos valem o padrão: saída de ar do tamanho da janela do som, canal de 1,55 × o tubo (mínimo 18 mm)", () => {
  const r = N.calcular(caso()), e = r.entrada, pad = N.padraoAr(r.diametroInterno, e.janelaCompr, e.janelaLarg);
  assert.deepStrictEqual([e.saidaCompr, e.saidaLarg, e.canalCompr], [pad.saidaCompr, pad.saidaLarg, pad.canalCompr]);
  assert.strictEqual(e.saidaCompr, e.janelaCompr); assert.ok(e.canalCompr >= 18);
});
t("os valores digitados voltam em entrada e valores fora da faixa dão erro no campo certo", () => {
  const r = N.calcular(caso({ saidaCompr: 7, saidaLarg: 8, canalCompr: 25 }));
  assert.deepStrictEqual([r.entrada.saidaCompr, r.entrada.saidaLarg, r.entrada.canalCompr], [7, 8, 25]);
  const x = N.calcular(caso({ saidaCompr: 500 }));
  assert.ok(!x.ok && x.erros.some((er) => er.campo === "saidaCompr"));
});
t("a sugestão traz saída de ar e canal pelo tubo do tom, sem nome nem texto novo", () => {
  const s = N.sugerir({ furos: 6, midi: 64 });
  assert.ok(s.saidaCompr > 0 && s.saidaLarg > 0 && s.canalCompr >= 18);
});
console.log(ok + " verificações janela do som / saída de ar / canal");
