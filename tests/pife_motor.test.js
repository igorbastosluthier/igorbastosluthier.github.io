/* Pífano do site contra o motor do app da oficina (Motor Único): mesmos tubos e furos, posições comparadas.
   Referência: tests/fixtures/pife_motor.json (gerado por tests/gen_pife_motor.py). Rodar: node tests/pife_motor.test.js
   Exige: pé (da boca ao pé) a até 1,5 mm do motor; furos a até 7 mm e rms dos furos até 2,5 mm.
   Com a fórmula antiga (Flutomat) o pé errava até 9,4 mm e os furos até 18 mm (parede grossa saía aguda). */
"use strict";
const assert = require("assert");
const P = require("../assets/pife-calc.js"), REF = require("./fixtures/pife_motor.json");
const TOM = { G4: "sol", C5: "do", D5: "re-agudo" };
let piorPe = 0, piorFuro = 0, soma2 = 0, nf = 0;
REF.forEach((c) => {
  assert.ok(c.convergiu, "motor convergiu");
  const r = P.calcular({ tom: TOM[c.tom], la: 440, temp: 25, D: c.D, parede: c.parede, emb: c.emb, embForma: "redondo", furos: c.furos });
  const dPe = r.bocaAoPe - c.motor.bocaAoPe, dF = r.furos.map((f, i) => f.daBoca - c.motor.daBoca[i]);
  const nome = c.tom + " tubo " + c.D + " parede " + c.parede + " sopro " + c.emb;
  assert.ok(Math.abs(dPe) <= 1.5, nome + ": pé a " + dPe.toFixed(2) + " mm do motor");
  dF.forEach((d, i) => assert.ok(Math.abs(d) <= 7, nome + ": furo " + (i + 1) + " a " + d.toFixed(2) + " mm do motor"));
  piorPe = Math.max(piorPe, Math.abs(dPe)); piorFuro = Math.max(piorFuro, ...dF.map(Math.abs));
  dF.forEach((d) => { soma2 += d * d; nf++; });
  console.log("  ok  " + nome + ": pé " + dPe.toFixed(1) + " mm, furos " + dF.map((d) => d.toFixed(1)).join(" "));
});
const rms = Math.sqrt(soma2 / nf);
assert.ok(rms <= 2.5, "rms dos furos " + rms.toFixed(2) + " mm");
assert.ok(REF.length >= 8);
console.log("pífano x motor: " + REF.length + " casos; pior pé " + piorPe.toFixed(1) + " mm, pior furo " + piorFuro.toFixed(1) + " mm, rms dos furos " + rms.toFixed(1) + " mm — OK");
