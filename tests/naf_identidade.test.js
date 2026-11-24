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
/* Furos: grade compacta como a do Pífano (rótulo em cima, Ø embaixo; Nota/Hz só na escala personalizada) e bloco de material */
const js = fs.readFileSync(path.join(__dirname, "..", "assets", "naf-ui.js"), "utf8"), css = fs.readFileSync(path.join(__dirname, "..", "assets", "naf.css"), "utf8");
t("furos da NAF em grade compacta, Hz como texto", () => { assert.ok(/#naf-linhas\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(120px/.test(css)); assert.ok(js.includes('class="naf-hz-txt"')); assert.ok(/\.naf-lin \.naf-pers\{display:none\}/.test(css)); });
t("bloco de material de construção na aba NAF", () => { assert.ok(html.includes('class="naf-material"')); assert.ok(/id="medir"/.test(html) && /href="#medir"/.test(naf + html.slice(html.indexOf('<aside class="naf-material"'), html.indexOf("</aside>")))); });
console.log(ok + " verificações NAF identidade (com furos e material)");
t("NAF desenha as duas janelas (ar e som), ilustrativa e sem cota", () => { const j = fs.readFileSync(path.join(__dirname, "..", "assets", "naf-ui.js"), "utf8"); assert.ok(j.includes("function janelaAr(") && j.includes(">ar</text>") && j.includes('"som"')); assert.ok(j.includes("mk.ar")); });
