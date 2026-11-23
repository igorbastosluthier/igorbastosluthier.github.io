/* Modo Básico | Avançado, avisos dinâmicos e alcance dos dedos (pedido do Igor, 23/11/2026).
   Rodar: node tests/pife_modo.test.js
   - Básico calcula com os padrões (Lá 440, 25 °C, parede ideal, bocal reto, sopro redondo, sem porta-lábios, furos
     sugeridos) e dá o mesmo resultado de antes para esses valores.
   - Avisos de campo só aparecem fora da faixa (e nunca nas flautas sugeridas); os do motor não se perdem.
   - Alcance dos dedos: regra do app Igor Bastos CNC (48 mm entre furos vizinhos da mesma mão); a sugestão de furo menor
     cabe no alcance e mantém as notas.
   - Página: nenhuma frase fixa (<small>) embaixo dos campos; cada "?" abre um texto; o que é do Avançado fica marcado. */
"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path");
const P = require("../assets/pife-calc.js"), M = require("../assets/pife-modo.js"), E = require("../assets/escalas.js");
const cents = (a, b) => 1200 * Math.log2(a / b);
let n = 0;
const ok = (nome, fn) => { fn(); n++; console.log("  ok  " + nome); };

/* o que a tela lê dos campos (lerForm), com escala e furos */
function cru(tomId, k, esId, extra) {
  const D = P.tuboSugerido(tomId), l = E.layout(esId, k, "pife");
  return Object.assign({ tom: tomId, la: 440, temp: 25, D, parede: P.paredeIdeal(D), emb: Math.round(D * 0.53), embForma: "redondo", embL: 9, embC: 11,
    cone: false, lip: 0, nf: k, escala: esId, semitons: l.furos, aux: l.aux, furos: l.furos.map(() => 8), manual: false }, extra || {});
}
/* todas as combinações de escala × furos × tom, com o tubo indicado de cada tom */
function todas(fn) { [5, 6, 7].forEach((k) => E.aplicaveis("pife", k).forEach((es) => P.TONS.forEach((t) => fn(cru(t.id, k, es.id), k, es, t)))); }

ok("Básico: usa os padrões mesmo com o Avançado mexido (Lá 432, 35 °C, parede 2, cone, oval, porta-lábios, furos digitados)", () => {
  const raw = cru("sol", 6, "diatonica-maior-jonia", { la: 432, temp: 35, parede: 2, cone: true, embForma: "oval", embL: 12, embC: 9, lip: 3, furos: [14, 14, 14, 14, 14, 14], manual: true });
  const b = M.entradaBasica(raw).e;
  assert.strictEqual(b.la, 440); assert.strictEqual(b.temp, 25); assert.strictEqual(b.parede, P.paredeIdeal(raw.D));
  assert.strictEqual(b.cone, false); assert.strictEqual(b.embForma, "redondo"); assert.strictEqual(b.lip, 0); assert.strictEqual(b.manual, false);
  assert.deepStrictEqual(b.furos, P.ajustarFuros(Object.assign({}, b, { furos: P.otimizarFuros(b) })).diametros);
  assert.strictEqual(raw.la, 432, "o estado do Avançado não é alterado");
  const lista = M.ajustesAvancados(raw).map((a) => a.k);
  assert.deepStrictEqual(lista, ["la", "temp", "parede", "cone", "oval", "lip", "furos"]);
  assert.deepStrictEqual(M.ajustesAvancados(cru("sol", 6, "diatonica-maior-jonia")), []);
});

ok("Básico: em todas as combinações, o resultado é o de antes com os padrões e igual ao Avançado sem mexer", () => {
  let tot = 0;
  todas((raw) => {
    const b = M.entradaBasica(raw).e, rb = P.calcular(b);
    /* a flauta de antes: os mesmos padrões escritos à mão + o "sugerir" antigo (otimizar e ajustar) */
    const antes = { tom: raw.tom, la: 440, temp: 25, D: raw.D, parede: P.paredeIdeal(raw.D), emb: raw.emb, embForma: "redondo", cone: false, lip: 0, semitons: raw.semitons, aux: raw.aux };
    antes.furos = P.ajustarFuros(Object.assign({}, antes, { furos: P.otimizarFuros(antes) })).diametros;
    assert.strictEqual(JSON.stringify(rb), JSON.stringify(P.calcular(antes)), raw.tom + " " + raw.escala);
    /* Avançado com os campos no padrão e furos sugeridos = Básico */
    const av = Object.assign({}, raw, { furos: M.sugeridos(raw).furos });
    assert.strictEqual(JSON.stringify(P.calcular(av)), JSON.stringify(rb), raw.tom + " " + raw.escala + " (Avançado)");
    tot++;
  });
  assert.ok(tot > 1400, String(tot));
  console.log("      " + tot + " combinações");
});

ok("modo ao abrir: o do estado vale; link antigo com ajuste do Avançado abre no Avançado; senão o preferido", () => {
  assert.strictEqual(M.modoDoEstado({ modo: "basico", parede: 2, D: 18, la: 440, temp: 25 }, "avancado"), "basico");
  assert.strictEqual(M.modoDoEstado({ modo: "avancado" }, "basico"), "avancado");
  assert.strictEqual(M.modoDoEstado(cru("sol", 6, "diatonica-maior-jonia", { parede: 3 }), "basico"), "avancado");
  assert.strictEqual(M.modoDoEstado(cru("sol", 6, "diatonica-maior-jonia", { manual: true }), "basico"), "avancado");
  assert.strictEqual(M.modoDoEstado(cru("sol", 6, "diatonica-maior-jonia"), "basico"), "basico");
  assert.strictEqual(M.modoDoEstado(null), "basico");
});

ok("avisos de campo: nenhum nas flautas sugeridas (todas as combinações, Básico)", () => {
  let tot = 0;
  todas((raw) => {
    const b = M.entradaBasica(raw).e, c = M.avisosCampos(b, P.calcular(b));
    assert.deepStrictEqual(c, {}, raw.tom + " " + raw.escala + ": " + JSON.stringify(c));
    tot++;
  });
  console.log("      " + tot + " combinações sem aviso de campo");
});

ok("aviso do tubo: só fora do indicado ± 1 mm, com o indicado para o botão usar", () => {
  const base = cru("sol", 6, "diatonica-maior-jonia"), alvo = P.tuboSugerido("sol");
  const tubo = (D) => { const e = Object.assign({}, base, { D, parede: P.paredeIdeal(D) }); e.furos = M.sugeridos(e).furos; return M.avisosCampos(e, P.calcular(e)).D; };
  [alvo - 1, alvo - 0.5, alvo, alvo + 0.5, alvo + 1].forEach((D) => assert.strictEqual(tubo(D), undefined, "D " + D));
  const largo = tubo(alvo + 1.5), estreito = tubo(alvo - 1.5);
  assert.ok(largo && largo.length === 1 && largo[0].tipo === "tubo-largo" && largo[0].alvo === alvo && /^Tubo largo para Sol 4: o indicado é 18,0 mm/.test(largo[0].texto), JSON.stringify(largo));
  assert.ok(estreito && estreito[0].tipo === "tubo-estreito" && /fica bom de 17,0 a 19,0/.test(estreito[0].texto), JSON.stringify(estreito));
});

ok("aviso do furo do sopro e do oval: só fora da faixa; o do motor (grande) vai para o campo", () => {
  const base = cru("sol", 6, "diatonica-maior-jonia");
  const campos = (x) => { const e = Object.assign({}, base, x); e.furos = M.sugeridos(e).furos; return M.avisosCampos(e, P.calcular(e)); };
  assert.deepStrictEqual(campos({ emb: 10 }), {});
  assert.deepStrictEqual(campos({ emb: 8.1 }), {}, "45% do tubo ainda não avisa");
  assert.strictEqual(campos({ emb: 7 }).emb[0].tipo, "sopro-pequeno");
  const g = campos({ emb: 14 }).emb;
  assert.ok(g.length === 1 && g[0].tipo === "sopro-grande" && /^Furo do sopro grande/.test(g[0].texto), JSON.stringify(g));
  assert.deepStrictEqual(campos({ embForma: "oval", embL: 9.4, embC: 11.4 }), {});
  assert.strictEqual(campos({ embForma: "oval", embL: 11.4, embC: 9.4 }).oval[0].tipo, "oval-invertido");
  assert.strictEqual(campos({ embForma: "oval", embL: 13, embC: 15 }).oval[0].tipo, "sopro-grande");
});

ok("aviso da parede: só a fina (regra do motor), embaixo do campo da parede", () => {
  const base = cru("sol", 6, "diatonica-maior-jonia");
  const campos = (x) => { const e = Object.assign({}, base, x); e.furos = M.sugeridos(e).furos; return M.avisosCampos(e, P.calcular(e)); };
  assert.deepStrictEqual(campos({ parede: 4 }), {});
  assert.deepStrictEqual(campos({ parede: 3 }), {});
  const f = campos({ parede: 2.5 }).parede;
  assert.ok(f && f[0].tipo === "parede-fina", JSON.stringify(f));
  assert.deepStrictEqual(campos({ parede: 2.5, lip: 2 }), {}, "porta-lábios reengrossa a parede no sopro");
});

ok("nenhum aviso do motor se perde: campo + resultado = motor (o de 4,5 cm vira o alcance dos dedos)", () => {
  const casos = [cru("sol", 6, "diatonica-maior-jonia", { parede: 2, emb: 15, furos: [8, 10, 16, 16, 10, 10], manual: true }),
    cru("la-grave", 6, "diatonica-maior-jonia"), cru("sol-agudo", 7, "diatonica-maior-jonia", { furos: [3, 3, 3, 3, 3, 3, 3] })];
  todas((raw) => { if (raw.tom === "re-grave" || raw.tom === "mi-agudo") casos.push(Object.assign({}, raw, { furos: M.sugeridos(raw).furos })); });
  casos.forEach((e, idx) => {
    if (!e.manual && e.furos.every((x) => x === 8)) e.furos = M.sugeridos(e).furos;
    const r = P.calcular(e), c = M.avisosCampos(e, r), res = M.avisosResultado(e, r);
    const motor = r.avisos.filter((t) => !/4,5 cm/.test(t));
    const vistos = [].concat(...Object.values(c)).concat(res).map((a) => a.texto);
    motor.forEach((t) => assert.ok(vistos.indexOf(t) >= 0, "caso " + idx + ": sumiu o aviso " + t));
    assert.ok(!vistos.some((t) => /4,5 cm/.test(t)));
  });
  /* as fixtures antigas: os itens com tipo dão exatamente os textos de sempre */
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pife.json"), "utf8"));
  fx.casos.forEach((cx, i) => { const r = P.calcular(cx.entrada); assert.deepStrictEqual(P.avisosItens(cx.entrada, r.bocaAoPe, r.furos).map((a) => a.texto), cx.calcular.avisos, "fixture " + i); });
});

ok("alcance dos dedos: as mãos como no app (5 = 2+3, 6 = 3+3, 7 = 4+3); o vão entre as mãos não conta", () => {
  assert.strictEqual(M.ALCANCE_MAX, 48);
  assert.deepStrictEqual(M.paresMesmaMao(5), [1, 2, 4]);
  assert.deepStrictEqual(M.paresMesmaMao(6), [1, 2, 4, 5]);
  assert.deepStrictEqual(M.paresMesmaMao(7), [1, 2, 4, 5, 6]);
  /* Sol 4 (tubo 18): tudo ao alcance */
  const sol = M.entradaBasica(cru("sol", 6, "diatonica-maior-jonia")).e;
  assert.deepStrictEqual(M.alcanceDedos(sol, P.calcular(sol)), []);
  /* Lá 3 grave: o vão entre as mãos passa de 48 mm e não gera aviso; os pares da mesma mão, sim */
  const la = M.entradaBasica(cru("la-grave", 6, "diatonica-maior-jonia")).e, rl = P.calcular(la), al = M.alcanceDedos(la, rl);
  assert.ok(rl.furos[3].espaco > 48, "o caso precisa ter o vão entre as mãos largo");
  assert.ok(al.length > 0 && al.every((a) => a.furos[1] !== 3), JSON.stringify(al.map((a) => a.furos)));
  [1, 2, 4, 5].forEach((i) => assert.strictEqual(al.some((a) => a.furos[1] === i), rl.furos[i].espaco > 48, "par " + i));
});

ok("alcance dos dedos: Ré 4 grave avisa os furos 1 e 2 e sugere o 1º menor, que cabe no alcance e mantém as notas", () => {
  const e = M.entradaBasica(cru("re-grave", 6, "diatonica-maior-jonia")).e, r = P.calcular(e), al = M.alcanceDedos(e, r);
  assert.strictEqual(al.length, 1); const a = al[0];
  assert.deepStrictEqual(a.furos, [0, 1]); assert.ok(a.distancia > 48);
  assert.ok(/^Furos 1 e 2: 50,\d mm entre os centros, na mesma mão\. Passa do alcance confortável dos dedos \(até 48 mm\)\./.test(a.texto), a.texto);
  assert.ok(a.sugestao && a.sugestao.furo === 0 && a.sugestao.para < a.sugestao.de, JSON.stringify(a.sugestao));
  const e2 = Object.assign({}, e, { furos: e.furos.slice() }); e2.furos[0] = a.sugestao.para;
  const r2 = P.calcular(e2);
  assert.ok(r2.furos[1].espaco <= 48 + 1e-9, String(r2.furos[1].espaco));
  assert.deepStrictEqual(M.alcanceDedos(e2, r2), []);
  r2.furos.forEach((f, i) => assert.ok(Math.abs(cents(f.freq, r.furos[i].freq)) < 1e-9, "nota " + i));
});

ok("alcance dos dedos: em todas as combinações, cada sugestão resolve o par sem aviso novo", () => {
  let avisos = 0, sug = 0;
  todas((raw) => {
    const e = M.entradaBasica(raw).e, r = P.calcular(e), antes = r.avisos.filter((t) => !/4,5 cm/.test(t));
    M.alcanceDedos(e, r).forEach((a) => {
      avisos++;
      assert.ok(M.paresMesmaMao(e.furos.length).indexOf(a.furos[1]) >= 0 && r.furos[a.furos[1]].espaco > 48);
      assert.ok(!/muito perto|NaN|undefined|null|Infinity/.test(a.texto), a.texto);
      if (!a.sugestao) return;
      sug++;
      const e2 = Object.assign({}, e, { furos: e.furos.slice() }); e2.furos[a.sugestao.furo] = a.sugestao.para;
      const r2 = P.calcular(e2), depois = r2.avisos.filter((t) => !/4,5 cm/.test(t));
      assert.ok(r2.furos[a.furos[1]].espaco <= 48 + 1e-9, raw.tom + " " + raw.escala);
      assert.ok(a.sugestao.para >= Math.max(3.5, 0.25 * e.D) - 1e-9);
      depois.forEach((t) => assert.ok(antes.indexOf(t) >= 0, raw.tom + " " + raw.escala + ": aviso novo " + t));
      r2.furos.forEach((f, i) => assert.strictEqual(f.midi, r.furos[i].midi));
    });
  });
  console.log("      " + avisos + " avisos de alcance, " + sug + " com sugestão de furo menor");
  assert.ok(avisos > 0 && sug > 0);
});

ok("modelo da oficina (Pife em Sol, app: 17,6 / 4,2 / oval 11,4 × 9,4): preenche todos os campos e sai sem aviso", () => {
  assert.strictEqual(M.MODELOS.length, 1);
  const md = M.MODELOS[0], v = md.valores;
  ["tom", "nf", "escala", "la", "temp", "D", "parede", "emb", "embForma", "embL", "embC", "cone", "lip", "manual"].forEach((k) => assert.ok(k in v, k));
  assert.ok(v.embC > v.embL, "o maior ao longo do tubo");
  const l = E.layout(v.escala, v.nf, "pife"), e = Object.assign({}, v, { semitons: l.furos, aux: l.aux });
  e.furos = M.sugeridos(e).furos;
  const r = P.calcular(e);
  assert.deepStrictEqual(M.avisosCampos(e, r), {}); assert.deepStrictEqual(M.avisosResultado(e, r), []);
  assert.ok(/17,6 mm/.test(md.ajuda) && /4,2 mm/.test(md.ajuda) && /9,4 × 11,4/.test(md.ajuda));
});

/* ---- página: sem frases fixas embaixo dos campos; "?" ligado; Avançado marcado ---- */
const VAZIOS = { input: 1, br: 1, img: 1, meta: 1, link: 1, hr: 1, source: 1 };
function arvore(html) {
  const raiz = { tag: "#", attrs: {}, filhos: [], pai: null }; let at = raiz;
  const re = /<(\/?)([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g; let m;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) { at.filhos.push({ texto: m[4] }); continue; }
    const tag = m[2].toLowerCase();
    if (m[1]) { while (at !== raiz && at.tag !== tag) at = at.pai; if (at !== raiz) at = at.pai; continue; }
    const attrs = {}; m[3].replace(/([a-zA-Z-]+)(?:="([^"]*)")?/g, (_, k, v) => { attrs[k] = v === undefined ? "" : v; });
    const no = { tag, attrs, filhos: [], pai: at }; at.filhos.push(no);
    if (!VAZIOS[tag] && !/\/$/.test(m[3])) at = no;
  }
  return raiz;
}
function todos(no, f, out) { out = out || []; (no.filhos || []).forEach((x) => { if (x.tag) { if (f(x)) out.push(x); todos(x, f, out); } }); return out; }
const porId = (raiz, id) => todos(raiz, (x) => x.attrs.id === id)[0];
const dentroAvancado = (no) => { for (let p = no; p; p = p.pai) if (p.attrs && "data-avancado" in p.attrs) return true; return false; };
const texto = (no) => (no.filhos || []).map((x) => x.texto !== undefined ? x.texto : texto(x)).join("");

["calculadora.html", "afinador.html"].forEach((pag) => ok(pag + ": formulário do pife sem frase fixa, \"?\" abre texto, Básico só com o essencial", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", pag), "utf8");
  const ini = html.indexOf('<div class="pc-nivel"'), fim = html.indexOf("</form>", ini) + 7;
  assert.ok(ini > 0 && fim > ini, "bloco do formulário");
  const raiz = arvore(html.slice(ini, fim)), form = porId(raiz, "pc-form");
  assert.ok(form && /\bpc-basico\b/.test(form.attrs.class), "abre no Básico");
  assert.deepStrictEqual(todos(form, (x) => x.tag === "small"), [], "sem <small> fixo");
  todos(form, (x) => x.tag === "p" && !("hidden" in x.attrs)).forEach((p) => assert.fail("parágrafo visível fixo: " + texto(p).slice(0, 60)));
  const ajudas = todos(raiz, (x) => /\bpc-ajuda\b/.test(x.attrs.class || "") && x.tag === "button");
  assert.ok(ajudas.length >= 12, String(ajudas.length));
  ajudas.forEach((b) => {
    const alvo = porId(raiz, b.attrs["aria-controls"]);
    assert.ok(alvo && "hidden" in alvo.attrs && texto(alvo).trim().length > 10, "? sem texto: " + b.attrs["aria-controls"]);
    assert.strictEqual(b.attrs["aria-expanded"], "false"); assert.ok(b.attrs["aria-label"], "rótulo do ?");
  });
  ["pc-tom", "pc-nfuros", "pc-escala", "pc-ouvir", "pc-D", "pc-emb"].forEach((id) => assert.ok(porId(raiz, id) && !dentroAvancado(porId(raiz, id)), id + " é do Básico"));
  ["pc-la", "pc-la-outra", "pc-temp", "pc-parede", "pc-cone", "pc-emb-forma", "pc-emb-l", "pc-emb-c", "pc-lip-sim", "pc-lip", "pc-furos", "pc-sugerir"]
    .forEach((id) => assert.ok(porId(raiz, id) && dentroAvancado(porId(raiz, id)), id + " é do Avançado"));
  todos(form, (x) => x.tag === "input" && x.attrs.name === "pc-ouvir-modo").forEach((x) => assert.ok(dentroAvancado(x), "ida e volta é do Avançado"));
  ["pc-al-D", "pc-al-emb", "pc-al-oval", "pc-al-parede", "pc-al-temp", "pc-al-la", "pc-al-lip"].forEach((id) => { const a = porId(raiz, id); assert.ok(a && "hidden" in a.attrs && !texto(a).trim(), id + " começa escondido e vazio"); });
  assert.ok(porId(raiz, "pc-modo-basico").attrs["aria-pressed"] === "true" && porId(raiz, "pc-modo-avancado").attrs["aria-pressed"] === "false");
  assert.ok(/pife-modo\.js/.test(html) && html.indexOf("pife-modo.js") < html.indexOf("pife-ui.js"), "pife-modo.js antes de pife-ui.js");
}));

ok("calculadora.html: NAF sem frase fixa embaixo dos campos (escala e temperatura no \"?\")", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "calculadora.html"), "utf8");
  const ini = html.indexOf('<form id="naf-form"'), fim = html.indexOf("</form>", ini) + 7, raiz = arvore(html.slice(ini, fim));
  assert.deepStrictEqual(todos(raiz, (x) => x.tag === "small"), []);
  ["aj-naf-escala", "aj-naf-temp"].forEach((id) => assert.ok(porId(raiz, id) && "hidden" in porId(raiz, id).attrs, id));
});

console.log("modo básico/avançado, avisos e alcance: " + n + " verificações OK");
