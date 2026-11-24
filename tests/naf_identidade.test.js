/* A NAF usa os mesmos componentes do Pífano: todo campo de medida está num .pc-campo com "?" visível (aria-controls para um .pc-ajuda-txt) */
"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "calculadora.html"), "utf8");
const naf = html.slice(html.indexOf('<form id="naf-form"'), html.indexOf('<div id="naf-ajuste"'));
let ok = 0; const t = (n, f) => { f(); ok++; console.log("  ok  " + n); };
const campos = ["naf-furos", "naf-fund", "naf-escala", "naf-a4", "naf-temp", "naf-od", "naf-parede", "naf-di", "naf-jc", "naf-jl", "naf-ja", "naf-cabeca", "naf-ponta"];
campos.forEach(id => t("NAF " + id + ": .pc-campo + ajuda visível", () => {
  const m = naf.match(new RegExp('<div class="pc-campo">\s*<label for="' + id + '">[^]*?</div>'));
  assert.ok(m, id + " fora de .pc-campo");
  const aj = m[0].match(/class="pc-ajuda"[^>]*aria-controls="([^"]+)"/);
  assert.ok(aj, id + " sem botão ?");
  assert.ok(new RegExp('id="' + aj[1] + '" class="pc-ajuda-txt"').test(naf), id + " sem texto de ajuda");
}));
t("nenhum title escondendo medida na NAF", () => assert.ok(!/<input[^>]*title=/.test(naf)));
t("▶ da nota grave e linha de notas", () => { assert.ok(naf.includes('id="naf-fund-ouvir" class="pc-tocar"')); assert.ok(naf.includes('id="naf-notas-escala" class="pc-notas"')); });
t("avisos usam .pc-alerta", () => assert.ok(/id="naf-aviso-troca" class="pc-alerta"/.test(naf)));
console.log(ok + " verificações NAF identidade");
