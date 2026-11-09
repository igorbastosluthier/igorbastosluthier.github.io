/* Viés do detector do afinador (assets/pife-afinador.js), sem navegador.
   Antes (até 09/11/2026) o afinador lia ALTO: +31 cents no Sol 3 soproso e quase puro, +3 cents no Mi 7 limpo.
   Mede o viés médio (cents com sinal) e o p95 em sons parecidos com flauta, do Sol 3 ao Mi 7, com pouco e muito sopro.
   Rodar: node tests/afinador_vies.test.js */
"use strict";
const fs = require("fs"), path = require("path"), assert = require("assert");
const fonte = fs.readFileSync(path.join(__dirname, "..", "assets", "pife-afinador.js"), "utf8");
const bloco = fonte.slice(fonte.indexOf("/* YIN:"), fonte.indexOf("/* notas do pife"));
const yin = new Function("nivel", "limiarRms", bloco + "; return yin;")(() => {}, () => 0.001);
let semente = 7;
const rnd = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
const gauss = () => { const u = rnd() || 1e-9, v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const SR = 48000, N = 4096;
function medir(f, harm, sopro, vezes) {
  const c = []; let saltos = 0;
  for (let k = 0; k < vezes; k++) {
    const x = new Float32Array(N); let p = 0;
    for (let i = 0; i < N; i++) { const t = (i + k * 1600) / SR; let s = 0; harm.forEach((a, j) => { s += a * Math.sin(2 * Math.PI * (j + 1) * f * t); }); x[i] = s; p += s * s; }
    const r = Math.sqrt(p / N); for (let i = 0; i < N; i++) x[i] += sopro * r * gauss();
    const o = yin(x, SR); if (!o) continue;
    const ce = 1200 * Math.log2(o.f / f); if (Math.abs(ce) > 300) saltos++; else c.push(ce);
  }
  const media = c.reduce((a, b) => a + b, 0) / c.length, abs = c.map(Math.abs).sort((a, b) => a - b);
  return { media, p95: abs[Math.floor(abs.length * 0.95)], saltos };
}
const sons = { "quase puro": [1, 0.05], "1º registro": [1, 0.5, 0.25, 0.12], "2º registro": [1, 1.4, 0.5, 0.2], "fundamental fraca": [0.25, 1, 0.6, 0.3] };
let falhas = 0;
for (const [nome, h] of Object.entries(sons)) for (const sopro of [0.05, 0.3]) for (const f of [196, 233.1, 277.2, 440, 880, 1760, 2637]) {
  const m = medir(f, h, sopro, 30);
  const ok = Math.abs(m.media) <= 2 && m.p95 <= 4 && m.saltos === 0;
  if (!ok) falhas++;
  console.log(`  ${ok ? "ok " : "ERRO"} ${nome}, sopro ${sopro}, ${f} Hz: viés ${m.media.toFixed(2)} c, p95 ${m.p95.toFixed(2)} c, saltos ${m.saltos}`);
}
assert.strictEqual(falhas, 0, `${falhas} casos com viés > 2 c, p95 > 4 c ou salto de oitava`);
console.log("afinador: viés ≤ 2 c e p95 ≤ 4 c em todos os casos — OK");
