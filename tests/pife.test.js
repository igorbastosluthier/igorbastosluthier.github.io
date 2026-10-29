/* Regressão do Pífano: o motor tem de reproduzir bit a bit as saídas capturadas antes da NAF. */
"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path");
const P = require("../assets/pife-calc.js");
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pife.json"), "utf8"));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let n = 0;
fx.casos.forEach(function (c, i) {
  assert.ok(same(P.calcular(c.entrada), c.calcular), "calcular difere no caso " + i);
  assert.ok(same([P.ajuste(c.entrada, 2, 12), P.ajuste(c.entrada, 4, -9)], c.ajuste), "ajuste difere no caso " + i);
  n++;
});
assert.ok(same(P.TONS.map(t => P.tuboSugerido(t.id)), fx.extra.tuboSugerido));
assert.ok(same([10, 14, 18, 22, 30].map(P.paredeIdeal), fx.extra.paredeIdeal));
console.log("pífano: " + n + " casos idênticos às fixtures (calcular + ajuste) — OK");
