/* Gera tests/fixtures/pife.json com as saídas ATUAIS do motor do pífano (rodar só para recapturar de propósito). */
"use strict";
const fs = require("fs"), path = require("path");
const P = require("../assets/pife-calc.js");
const casos = [];
const bases = [
  { D: 18, parede: 4, emb: 10, la: 440, temp: 25, embForma: "redondo" },
  { D: 14, parede: 3, emb: 8, la: 432, temp: 20, embForma: "redondo", cone: true },
  { D: 22, parede: 5, emb: 12, la: 440, temp: 30, embForma: "oval", embL: 11, embC: 13, lip: 3 },
  { D: 16.5, parede: 3.5, emb: 9, la: 440, temp: 15, embForma: "redondo", lip: 2, cone: true }
];
P.TONS.forEach(function (t, i) {
  const b = Object.assign({ tom: t.id }, bases[i % bases.length]);
  b.furos = P.otimizarFuros(b);
  const alt = Object.assign({}, b, { furos: [7, 9, 6, 9.5, 8.5, 10] });
  [b, alt].forEach(function (e) {
    casos.push({ entrada: e, calcular: P.calcular(e), ajuste: [P.ajuste(e, 2, 12), P.ajuste(e, 4, -9)] });
  });
});
const extra = { tuboSugerido: P.TONS.map(t => P.tuboSugerido(t.id)), paredeIdeal: [10, 14, 18, 22, 30].map(P.paredeIdeal), furoSugerido: [0, 1, 2, 3, 4, 5].map(i => P.furoSugerido(18, i)) };
fs.writeFileSync(path.join(__dirname, "fixtures", "pife.json"), JSON.stringify({ casos, extra }));
console.log("casos:", casos.length);
