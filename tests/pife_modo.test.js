/* Calculadora de Pife: um formulário só (pedido do Igor, 23/11/2026: "deixe só o modo avançado ... sem esse nome"),
   o ▶ do tom, as notas e os saltos da escala, avisos dinâmicos e alcance dos dedos.
   Rodar: node tests/pife_modo.test.js
   - Sem seletor de modo e sem as palavras do modo na página; o que está nos campos é o que entra na conta, e com os campos
     no padrão dá o mesmo resultado de antes (furos sugeridos = otimizar + ajustar).
   - Notas da escala no tom e os saltos (T, ST, 1½T...) com os semitons; os nomes são os da tabela de furos.
   - Avisos de campo só aparecem fora da faixa (e nunca nas flautas sugeridas); os do motor não se perdem.
   - Alcance dos dedos: regra do app Igor Bastos CNC (48 mm entre furos vizinhos da mesma mão); a sugestão de furo menor
     cabe no alcance e mantém as notas.
   - Página: nenhuma frase fixa (<small>) embaixo dos campos; cada "?" abre um texto; ▶ do tom com aria. */
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
/* a flauta que a página mostra ao abrir: os campos no padrão e os furos sugeridos */
const sugerida = (raw) => Object.assign({}, raw, { furos: M.sugeridos(raw).furos });
/* todas as combinações de escala × furos × tom, com o tubo indicado de cada tom */
function todas(fn) { [5, 6, 7].forEach((k) => E.aplicaveis("pife", k).forEach((es) => P.TONS.forEach((t) => fn(cru(t.id, k, es.id), k, es, t)))); }

ok("um formulário só: nada do modo básico no motor da tela (sem padrões escondidos nem 'modo' guardado)", () => {
  ["PADRAO", "basica", "entradaBasica", "ajustesAvancados", "modoDoEstado"].forEach((k) => assert.ok(!(k in M), k + " saiu"));
  /* os campos de afinação, temperatura, parede, cone, oval e porta-lábios mudam a conta (antes o Básico os ignorava) */
  const base = sugerida(cru("sol", 6, "diatonica-maior-jonia")), pe0 = P.calcular(base).bocaAoPe;
  [{ la: 432 }, { temp: 35 }, { parede: 3 }, { cone: true }, { embForma: "oval", embL: 9, embC: 12 }, { lip: 2 }].forEach((x) =>
    assert.ok(Math.abs(P.calcular(Object.assign({}, base, x)).bocaAoPe - pe0) > 0.05, JSON.stringify(x) + " precisa mudar a conta"));
  /* referência fixa (Sol 4, Lá 432, 35 °C, tubo 18, parede 3, oval 9 × 11, porta-lábios 2, bocal cônico): a página mostra isto */
  const av = sugerida(cru("sol", 6, "diatonica-maior-jonia", { la: 432, temp: 35, parede: 3, embForma: "oval", embL: 9, embC: 11, lip: 2, cone: true }));
  assert.deepStrictEqual(av.furos, [8, 10, 7, 10, 10, 10]);
  assert.strictEqual(P.calcular(av).bocaAoPe.toFixed(1), "408.3");
  assert.strictEqual(P.calcular(base).bocaAoPe.toFixed(1), "387.5");
});

ok("com os campos no padrão, em todas as combinações, o resultado é o do gerador por regras (furos sugeridos = sugerirFuros + ajustar)", () => {
  let tot = 0;
  todas((raw) => {
    const rb = P.calcular(sugerida(raw));
    /* a flauta pelo mesmo caminho do gerador: sugerirFuros (regras) e ajustar */
    const antes = { tom: raw.tom, la: 440, temp: 25, D: raw.D, parede: P.paredeIdeal(raw.D), emb: raw.emb, embForma: "redondo", cone: false, lip: 0, semitons: raw.semitons, aux: raw.aux };
    antes.furos = P.ajustarFuros(Object.assign({}, antes, { furos: P.sugerirFuros(antes) })).diametros;
    assert.strictEqual(JSON.stringify(rb), JSON.stringify(P.calcular(antes)), raw.tom + " " + raw.escala);
    tot++;
  });
  assert.ok(tot > 1400, String(tot));
  console.log("      " + tot + " combinações");
  /* com os outros campos mexidos, os furos sugeridos seguem a mesma regra */
  [{ la: 432, temp: 35 }, { parede: 2.5, lip: 3 }, { cone: true, embForma: "oval", embL: 9, embC: 11 }].forEach((x) => {
    const e = cru("re-grave", 6, "diatonica-maior-jonia", x);
    assert.deepStrictEqual(M.sugeridos(e).furos, P.ajustarFuros(Object.assign({}, e, { furos: P.sugerirFuros(e) })).diametros, JSON.stringify(x));
  });
});

ok("notas da escala no tom e os saltos: maior, pentatônica menor e blues em Sol e em Ré", () => {
  const linha = (tom, k, es) => { const l = E.layout(es, k, "pife"), x = M.notasEscala(P.TONS.find((t) => t.id === tom).midi, l.furos, l.aux); return M.linhaEscala(x) + " | " + x.saltos.map((s) => s.st).join(" "); };
  assert.strictEqual(linha("sol", 6, "diatonica-maior-jonia"), "Sol –T– Lá –T– Si –ST– Dó –T– Ré –T– Mi –T– Fá# –ST– Sol | 2 2 1 2 2 2 1");
  assert.strictEqual(linha("re-grave", 6, "diatonica-maior-jonia"), "Ré –T– Mi –T– Fá# –ST– Sol –T– Lá –T– Si –T– Dó# –ST– Ré | 2 2 1 2 2 2 1");
  assert.strictEqual(linha("re-agudo", 7, "diatonica-maior-jonia"), "Ré –T– Mi –T– Fá# –ST– Sol –T– Lá –T– Si –T– Dó# –ST– Ré | 2 2 1 2 2 2 1", "7 furos: o de cima dá a oitava");
  assert.strictEqual(linha("sol", 5, "pentatonica-menor"), "Sol –1½T– Lá# –T– Dó –T– Ré –1½T– Fá –T– Sol | 3 2 2 3 2");
  assert.strictEqual(linha("re-grave", 5, "pentatonica-menor"), "Ré –1½T– Fá –T– Sol –T– Lá –1½T– Dó –T– Ré | 3 2 2 3 2");
  assert.strictEqual(linha("sol", 6, "blues-menor-pentatonica-5"), "Sol –1½T– Lá# –T– Dó –ST– Dó# –ST– Ré –1½T– Fá –T– Sol | 3 2 1 1 3 2");
  assert.strictEqual(linha("re-grave", 5, "blues-menor-pentatonica-5"), "Ré –1½T– Fá –T– Sol –ST– Sol# –ST– Lá –1½T– Dó –T– Ré | 3 2 1 1 3 2");
  const x = M.notasEscala(67, [3, 5, 7, 10, 12], []);
  assert.deepStrictEqual(x.saltos.map((s) => s.falado), ["1 tom e meio (3 semitons)", "1 tom (2 semitons)", "1 tom (2 semitons)", "1 tom e meio (3 semitons)", "1 tom (2 semitons)"]);
  assert.strictEqual(M.notasEscala(67, [1], []).saltos[0].falado, "semitom (1 semitom)");
  assert.strictEqual(M.notasEscala(67, [4], []).saltos[0].rotulo, "2T");
  assert.strictEqual(M.notasEscala(67, [5], []).saltos[0].rotulo, "2½T");
  assert.deepStrictEqual(M.notasEscala(67, [2, 7, 12], [7]).notas.map((n) => n.st), [0, 2, 12], "nota auxiliar fora da escala não entra");
  /* todas as combinações: do tom à oitava (12 semitons), e os nomes são os da tabela de furos */
  let tot = 0;
  todas((raw) => {
    const r = P.calcular(sugerida(raw)), x = M.notasEscala(r.tom.midi, raw.semitons, raw.aux);
    assert.strictEqual(x.saltos.reduce((a, s) => a + s.st, 0), 12, raw.escala);
    assert.strictEqual(x.notas[0].nome + " " + (Math.floor(r.tom.midi / 12) - 1), String(r.tom.nome).split(" · ")[0]);
    r.furos.forEach((f) => { if (!f.aux) assert.ok(x.notas.some((n) => n.midi === f.midi && f.nota.indexOf(n.nome + " ") === 0), raw.tom + " " + raw.escala + ": " + f.nota); });
    assert.ok(x.saltos.every((s) => /^(ST|\d*½?T)$/.test(s.rotulo)), JSON.stringify(x.saltos));
    tot++;
  });
  console.log("      " + tot + " combinações com notas e saltos conferidos");
});

ok("avisos de campo: nenhum nas flautas sugeridas (todas as combinações)", () => {
  let tot = 0;
  todas((raw) => {
    const b = sugerida(raw), c = M.avisosCampos(b, P.calcular(b));
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
  assert.deepStrictEqual(campos({ embForma: "oval", embL: 9, embC: 11 }), {});
  assert.strictEqual(campos({ embForma: "oval", embL: 11, embC: 9 }).oval[0].tipo, "oval-invertido");
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
  const sol = sugerida(cru("sol", 6, "diatonica-maior-jonia"));
  assert.deepStrictEqual(M.alcanceDedos(sol, P.calcular(sol)), []);
  /* Lá 3 grave: o vão entre as mãos passa de 48 mm e não gera aviso; os pares da mesma mão, sim */
  const la = sugerida(cru("la-grave", 6, "diatonica-maior-jonia")), rl = P.calcular(la), al = M.alcanceDedos(la, rl);
  assert.ok(rl.furos[3].espaco > 48, "o caso precisa ter o vão entre as mãos largo");
  assert.ok(al.length > 0 && al.every((a) => a.furos[1] !== 3), JSON.stringify(al.map((a) => a.furos)));
  [1, 2, 4, 5].forEach((i) => assert.strictEqual(al.some((a) => a.furos[1] === i), rl.furos[i].espaco > 48, "par " + i));
});

ok("alcance dos dedos: Ré 4 grave (com os furos de antes, 10/12/9/12/12/12) avisa os furos 1 e 2 e sugere o 1º menor, que cabe no alcance e mantém as notas", () => {
  const e0 = sugerida(cru("re-grave", 6, "diatonica-maior-jonia")), e = Object.assign({}, e0, { furos: P.ajustarFuros(Object.assign({}, e0, { furos: P.otimizarFuros(e0) })).diametros }), r = P.calcular(e), al = M.alcanceDedos(e, r);
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
    const e = sugerida(raw), r = P.calcular(e), antes = r.avisos.filter((t) => !/4,5 cm/.test(t));
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

ok("sem 'Começar de um modelo' nem as medidas de produção do Igor (pedido dele, 23/11/2026)", () => {
  assert.ok(!("MODELOS" in M));
  const fs = require("fs"), path = require("path"), raiz = path.join(__dirname, "..");
  ["calculadora.html", "afinador.html", "assets/pife-ui.js", "assets/pife-modo.js", "assets/pife-modo.css"].forEach((f) => {
    const t = fs.readFileSync(path.join(raiz, f), "utf8");
    assert.ok(!/data-modelo|pc-modelos|Começar de um modelo|Pife em Sol da oficina|17,6 mm por dentro/.test(t), f);
    // Igor 23/11 ("que desgraça de informação é essa?"): nenhuma frase "No Básico valem os padrões. Guardado no Avançado"
    assert.ok(!/pc-modo-nota|Guardado no Avançado|valem os padrões/.test(t), f + ": frase do modo");
  });
});

/* ---- página: sem frases fixas embaixo dos campos; "?" ligado; um formulário só; ▶ do tom e notas da escala ---- */
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
const texto = (no) => (no.filhos || []).map((x) => x.texto !== undefined ? x.texto : texto(x)).join("");

["calculadora.html", "afinador.html"].forEach((pag) => ok(pag + ": um formulário só, sem frase fixa, \"?\" abre texto, ▶ do tom e notas da escala", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", pag), "utf8");
  /* Igor 23/11/2026: "deixe só o modo avançado mesmo, no caso sem esse nome avançado" */
  assert.ok(!/b[aá]sico|avan[cç]ado|pc-nivel|pc-modo-|data-avancado|pc-basico/i.test(html), pag + ": sobrou algo do modo");
  const ini = html.indexOf('<form id="pc-form"'), fim = html.indexOf("</form>", ini) + 7;
  assert.ok(ini > 0 && fim > ini, "bloco do formulário");
  const raiz = arvore(html.slice(ini, fim)), form = porId(raiz, "pc-form");
  assert.ok(form && form.attrs.class === "pc-grid", "formulário sem classe de modo");
  assert.deepStrictEqual(todos(form, (x) => x.tag === "small"), [], "sem <small> fixo");
  todos(form, (x) => x.tag === "p" && !("hidden" in x.attrs)).forEach((p) => assert.fail("parágrafo visível fixo: " + texto(p).slice(0, 60)));
  const ajudas = todos(raiz, (x) => /\bpc-ajuda\b/.test(x.attrs.class || "") && x.tag === "button");
  assert.ok(ajudas.length >= 11, String(ajudas.length));   // 11 campos com "?" (o do modelo saiu em 23/11)
  ajudas.forEach((b) => {
    const alvo = porId(raiz, b.attrs["aria-controls"]);
    assert.ok(alvo && "hidden" in alvo.attrs && texto(alvo).trim().length > 10, "? sem texto: " + b.attrs["aria-controls"]);
    assert.strictEqual(b.attrs["aria-expanded"], "false"); assert.ok(b.attrs["aria-label"], "rótulo do ?");
  });
  ["pc-tom", "pc-nfuros", "pc-escala", "pc-ouvir", "pc-D", "pc-emb", "pc-la", "pc-la-outra", "pc-temp", "pc-parede", "pc-cone", "pc-emb-forma",
    "pc-emb-l", "pc-emb-c", "pc-lip-sim", "pc-lip", "pc-furos", "pc-sugerir"].forEach((id) => assert.ok(porId(raiz, id), id + " no formulário"));
  assert.strictEqual(todos(form, (x) => x.tag === "input" && x.attrs.name === "pc-ouvir-modo").length, 2, "subir / ida e volta");
  ["pc-al-D", "pc-al-emb", "pc-al-oval", "pc-al-parede", "pc-al-temp", "pc-al-la", "pc-al-lip"].forEach((id) => { const a = porId(raiz, id); assert.ok(a && "hidden" in a.attrs && !texto(a).trim(), id + " começa escondido e vazio"); });
  /* ▶ ao lado do tom: botão de verdade, com rótulo e estado para leitor de tela */
  const bt = porId(raiz, "pc-tom-ouvir"), tom = porId(raiz, "pc-tom");
  assert.ok(bt && bt.tag === "button" && bt.attrs.type === "button", "botão do tom");
  assert.strictEqual(bt.attrs["aria-label"], "Ouvir a nota do tom"); assert.strictEqual(bt.attrs["aria-pressed"], "false");
  assert.ok(bt.pai === tom.pai && /pc-tom-linha/.test(bt.pai.attrs.class), "o ▶ fica ao lado do tom");
  /* notas da escala: logo abaixo da escala, sem texto fixo (a tela preenche) */
  const esc = porId(raiz, "pc-escala"), notas = porId(raiz, "pc-notas"), irmaos = esc.pai.filhos.filter((x) => x.tag);
  assert.ok(notas && notas.tag === "div" && irmaos[irmaos.indexOf(esc) + 1] === notas && !texto(notas).trim(), "notas logo abaixo da escala");
  assert.ok(/semitom/.test(texto(porId(raiz, "aj-escala"))) && /▶/.test(texto(porId(raiz, "aj-tom"))), "o ? explica os saltos e o ▶");
  assert.ok(/pife-modo\.js/.test(html) && html.indexOf("pife-modo.js") < html.indexOf("pife-ui.js") && html.indexOf("escalas.js") < html.indexOf("pife-ui.js"), "pife-modo.js e escalas.js antes de pife-ui.js");
}));

ok("arquivos da calculadora sem o modo (Igor 23/11/2026)", () => {
  ["assets/pife-ui.js", "assets/pife-modo.js", "assets/pife-modo.css", "assets/pife-afinador.js"].forEach((f) => {
    const t = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    assert.ok(!/b[aá]sico|avan[cç]ado|pc-nivel|pc-modo-|data-avancado|pc-basico|modoDoEstado|entradaBasica/i.test(t), f);
  });
});

ok("calculadora.html: NAF sem frase fixa embaixo dos campos (escala e temperatura no \"?\")", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "calculadora.html"), "utf8");
  const ini = html.indexOf('<form id="naf-form"'), fim = html.indexOf("</form>", ini) + 7, raiz = arvore(html.slice(ini, fim));
  assert.deepStrictEqual(todos(raiz, (x) => x.tag === "small"), []);
  ["aj-naf-escala", "aj-naf-temp"].forEach((id) => assert.ok(porId(raiz, id) && "hidden" in porId(raiz, id).attrs, id));
});

console.log("formulário, notas da escala, avisos e alcance: " + n + " verificações OK");
