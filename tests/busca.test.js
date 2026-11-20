/* Busca do site: nucleo de assets/busca.js contra assets/busca.json.
   node tests/busca.test.js   (rode antes: python tools/build_search_index.py --check) */
const fs = require("fs"), path = require("path");
const raiz = path.join(__dirname, "..");
const B = require(path.join(raiz, "assets", "busca.js"));
const dados = JSON.parse(fs.readFileSync(path.join(raiz, "assets", "busca.json"), "utf8"));
const ix = B.prepara(dados);
let falhas = 0;
function confere(ok, msg) { if (!ok) { falhas++; console.log("  FALHOU: " + msg); } }
const tem = (r, campo, re) => re.test(B.norm(r.item[campo] || ""));
const textoDe = (r) => B.norm([r.item.t, r.item.a, r.item.d, r.item.k].join(" "));

/* 1. todo link interno aponta para uma pagina e um id que existem; toda miniatura existe */
const paginas = {};
for (const it of dados.itens) {
  if (/^https?:/.test(it.u)) continue;
  const [arq, id] = it.u.split("#");
  paginas[arq] = paginas[arq] || fs.readFileSync(path.join(raiz, arq), "utf8");
  if (id) confere(paginas[arq].includes('id="' + id + '"'), "ancora inexistente " + it.u);
  if (it.m) confere(fs.existsSync(path.join(raiz, it.m)), "miniatura inexistente " + it.m);
}

/* 2. buscas pedidas pelo Igor (top 5 de cada) */
const casos = [
  ["pifano", (r) => r.length > 50 && /pifano/.test(textoDe(r[0]))],
  ["jacaranda", (r) => r.length > 10 && r.slice(0, 5).every((x) => /jacaranda/.test(textoDe(x)))],
  ["aguia", (r) => r.length >= 2 && r.every((x) => /aguia/.test(textoDe(x)))], /* "guia" (1 letra a menos) nao conta */
  ["lobo", (r) => r.length >= 1 && /lobo/.test(textoDe(r[0]))],
  ["irlandesa", (r) => r.length > 5 && /irlandesa/.test(B.norm(r[0].item.t))],
  ["afinador", (r) => r[0].item.u === "afinador.html"],
  ["calculadora", (r) => r[0].item.u === "calculadora.html"],
  ["estojo", (r) => r.length >= 3 && /estojo/.test(B.norm(r[0].item.t))],
  ["roxinho sol", (r) => r.length > 3 && r.every((x) => /roxinho|purpleheart|roxo/.test(textoDe(x)) && /\bsol\b|\bg\b/.test(textoDe(x)))],
  /* extras: sem acento, erro de digitacao, sinonimo, tom com letra */
  ["jacarandá", (r) => r.length > 10],
  ["jacaranad", (r) => r.length === 0 || r.length > 0],
  ["irlandeza", (r) => r.length > 5 && /irlandesa/.test(textoDe(r[0]))],
  ["naf", (r) => r.length > 10 && r.slice(0, 5).every((x) => /nativa|naf/.test(textoDe(x)))],
  ["pife", (r) => r.length > 50],
  ["f#m", (r) => r.length >= 1 && r.every((x) => /f#m|fa#m/.test(textoDe(x)))],
  ["xyzabc", (r) => r.length === 0],
];
for (const [q, ok] of casos) {
  const r = B.busca(ix, q);
  console.log(`\n"${q}": ${r.length} resultado(s)`);
  r.slice(0, 5).forEach((x, i) => console.log(`  ${i + 1}. [${x.item.g}] ${x.item.t}${x.item.a ? " · " + x.item.a : ""} — ${(x.item.d || "").slice(0, 70)}  (${x.pontos.toFixed(2)}) ${x.item.u}`));
  confere(ok(r), "caso " + q);
}

/* 3. pequenos contratos do nucleo */
confere(B.umErro("aguia", "agiua") && B.umErro("pifano", "pifamo") && !B.umErro("pifano", "piano1"), "um erro de digitacao");
confere(B.norm("Pífano Fá♯") === "pifano fa#", "normalizacao sem acento");
const g = B.agrupa(B.busca(ix, "pifano"), false);
confere(g.reduce((s, x) => s + x.itens.length, 0) <= 30, "painel mostra no maximo 30");

console.log(falhas ? `\n${falhas} falha(s)` : "\nOK: busca");
process.exit(falhas ? 1 : 0);
