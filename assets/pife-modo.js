/* Calculadora de Pife: furos sugeridos, notas e saltos da escala, avisos que só aparecem quando algo está fora do lugar e
   alcance dos dedos. Pedido do Igor (23/11/2026): um formulário só, com todos os campos e sem frases fixas embaixo deles.
   Funções puras, sem DOM (testadas em tests/pife_modo.test.js); a tela é pife-ui.js. */
(function (root) {
  "use strict";
  var node = typeof module === "object" && module.exports;
  var P = node ? require("./pife-calc.js") : root.PifeCalc;
  var Aj = node ? require("./ajuste-furos.js") : root.AjusteFuros;
  var r1 = function (x) { return Math.round(x * 10) / 10; };
  var num = function (x) { return String(r1(x)).replace(".", ","); };
  var mm1 = function (x) { return x.toFixed(1).replace(".", ","); };

  /* Furos sugeridos: o gerador por regras (furos-regras.js) na proporção do tubo e, se algum ainda ficaria encostado, o ajuste automático. */
  function sugeridos(e) {
    var f = P.sugerirFuros(e), aj = P.ajustarFuros(Object.assign({}, e, { furos: f }));
    return { furos: aj.diametros, ajuste: aj };
  }

  /* Notas da escala no tom (pedido do Igor, 23/11/2026: "quais notas participam da escala escolhida" e "os saltos"):
     da nota do tom (tudo fechado) até a oitava, com os mesmos nomes da tabela de furos (sem a oitava). semitons: os
     dos furos, do pé para a boca; aux: furos fora da escala (não entram). Saltos: ST = semitom, T = tom, 1½T = tom e
     meio..., com os semitons de cada um. */
  function salto(d) {
    var t = Math.floor(d / 2), meio = d % 2 === 1;
    if (d === 1) return { st: 1, rotulo: "ST", falado: "semitom (1 semitom)" };
    return { st: d, rotulo: (t === 1 && !meio ? "" : String(t)) + (meio ? "½" : "") + "T",
      falado: t + (t === 1 ? " tom" : " tons") + (meio ? " e meio" : "") + " (" + d + " semitons)" };
  }
  function nomeSemOitava(midi) { return P.nomeNota(midi).replace(/ -?\d+$/, ""); }
  function notasEscala(tomMidi, semitons, aux) {
    aux = aux || [];
    var graus = [0];
    (semitons || []).forEach(function (st) { if (aux.indexOf(st) < 0 && st > graus[graus.length - 1] && st <= 12) graus.push(st); });
    if (graus[graus.length - 1] !== 12) graus.push(12);
    var notas = graus.map(function (st) { return { st: st, midi: tomMidi + st, nome: nomeSemOitava(tomMidi + st) }; });
    var saltos = [];
    for (var i = 1; i < graus.length; i++) {
      saltos.push(salto(graus[i] - graus[i - 1]));
    }
    return { notas: notas, saltos: saltos };
  }
  /* em uma linha de texto: "Sol –T– Lá –T– Si –ST– Dó ..." */
  function linhaEscala(x) {
    return x.notas.map(function (n, i) { return (i ? " –" + x.saltos[i - 1].rotulo + "– " : "") + n.nome; }).join("");
  }

  /* Alcance dos dedos (regra do app Igor Bastos CNC, motor/design.py: FINGER_CEIL_MM = 48): no máximo 48 mm de centro a
     centro entre furos vizinhos da MESMA mão (pflute v4 48,0; low D 44; Irish v14 42). As mãos como no app: 5 furos =
     2 em cima + 3 embaixo; 6 = 3 + 3; 7 = 4 + 3. O vão entre as duas mãos não conta. */
  var ALCANCE_MAX = 48;
  function furosMaoDeCima(n) { return n === 5 ? 2 : n < 7 ? Math.floor((n + 1) / 2) : 4; }
  /* índices i (do pé para a boca) em que o par (i-1, i) é da mesma mão */
  function paresMesmaMao(n) {
    var baixo = n - furosMaoDeCima(n), l = [];
    for (var i = 1; i < n; i++) if (i !== baixo) l.push(i);
    return l;
  }
  function longes(r) { return paresMesmaMao(r.furos.length).filter(function (i) { return r.furos[i].espaco > ALCANCE_MAX + 1e-9; }); }
  /* Aproximar: o furo de baixo do par, menor, sobe para perto do de cima (a conta normal refaz as posições, então a afinação
     continua certa). Procura o maior tamanho (em décimos de mm, como o ajuste automático) que deixa o par dentro do
     alcance, sem criar aviso novo nem tirar outro par do alcance. null quando nem o menor furo permitido resolve. */
  function sugestaoAlcance(e, i) {
    var k = i - 1, d0 = e.furos[k], lim = Aj.limites(e.D, 0.8);
    var calc = function (d) { var t = Object.assign({}, e, { furos: e.furos.slice() }); t.furos[k] = d; return { t: t, r: P.calcular(t) }; };
    if (calc(lim.min).r.furos[i].espaco > ALCANCE_MAX) return null;
    var lo = lim.min, hi = d0;
    for (var it = 0; it < 40; it++) { var m = (lo + hi) / 2; if (calc(m).r.furos[i].espaco <= ALCANCE_MAX) lo = m; else hi = m; }
    var d = Math.max(lim.min, Math.floor(lo * 10 + 1e-9) / 10);
    if (!(d < d0)) return null;
    var c = calc(d), r0 = P.calcular(e), chave = function (a) { return a.tipo + ":" + a.furo; };
    if (c.r.furos[i].espaco > ALCANCE_MAX + 1e-9) return null;
    var antes = P.avisosItens(e, r0.bocaAoPe, r0.furos).map(chave);
    var depois = P.avisosItens(c.t, c.r.bocaAoPe, c.r.furos).filter(function (a) { return a.tipo !== "espaco-45"; }).map(chave);
    if (depois.some(function (x) { return antes.indexOf(x) < 0; })) return null;
    var l0 = longes(r0), l1 = longes(c.r);
    if (l1.some(function (x) { return l0.indexOf(x) < 0; })) return null;
    return { furo: k, de: d0, para: d, distancia: c.r.furos[i].espaco };
  }
  function alcanceDedos(e, r) {
    return longes(r).map(function (i) {
      var s = r.furos[i].espaco, sug = sugestaoAlcance(e, i), k = i - 1;
      var texto = "Furos " + i + " e " + (i + 1) + ": " + mm1(s) + " mm entre os centros, na mesma mão. Passa do alcance confortável dos dedos (até " + ALCANCE_MAX + " mm).";
      texto += sug ? " Com o " + (k + 1) + "º furo de " + num(sug.para) + " mm (em vez de " + num(sug.de) + "), ele sobe e fica a " + mm1(sug.distancia) + " mm do " + (i + 1) + "º; a afinação continua certa."
        : " Diminuir o " + (k + 1) + "º furo aproxima os dois, mas aqui não basta: escolha um tom mais agudo ou fure inclinado (por fora fica mais perto do vizinho; por dentro, no lugar da conta).";
      return { tipo: "alcance", campo: "furo", furo: k, furos: [k, i], distancia: s, sugestao: sug, texto: texto };
    });
  }

  /* Avisos junto dos campos: só quando o valor está fora do lugar; somem quando a pessoa acerta.
     Devolve {D: [...], parede: [...], emb: [...], oval: [...]} (campo sem aviso não aparece). */
  function nomeTom(r) { return String(r.tom.nome).split(" · ")[0]; }
  function avisosCampos(e, r) {
    var out = {}, add = function (campo, a) { (out[campo] = out[campo] || []).push(a); };
    var alvo = P.tuboSugerido(e.tom), dif = e.D - alvo;
    /* a faixa boa de cada tom é o indicado ± 1 mm (a mesma do "Qual tom fazer com o seu tubo?") */
    if (Math.abs(dif) > 1 + 1e-9) add("D", { tipo: dif > 0 ? "tubo-largo" : "tubo-estreito", alvo: alvo,
      texto: "Tubo " + (dif > 0 ? "largo" : "estreito") + " para " + nomeTom(r) + ": o indicado é " + mm1(alvo) + " mm (fica bom de " + mm1(alvo - 1) + " a " + mm1(alvo + 1) + ")." });
    var oval = e.embForma === "oval", campoSopro = oval ? "oval" : "emb";
    if (P.diametroSopro(e) < 0.45 * e.D) add(campoSopro, { tipo: "sopro-pequeno",
      texto: "Furo do sopro pequeno para esse tubo: o som sai fraco. O comum é de " + num(0.5 * e.D) + " a " + num(0.65 * e.D) + " mm (50% a 65% do diâmetro interno)." });
    /* regra do Igor (app, flute_measured): no oval, o número maior vai ao longo do tubo */
    if (oval && e.embL > e.embC + 1e-9) add("oval", { tipo: "oval-invertido", texto: "No furo oval, a medida maior costuma ficar ao longo do tubo (no comprimento)." });
    P.avisosItens(e, r.bocaAoPe, r.furos).forEach(function (a) {
      if (a.campo === "parede") add("parede", a);
      else if (a.campo === "emb") add(campoSopro, a);
    });
    return out;
  }
  /* Avisos do resultado: os do motor que não são de um campo (o de 4,5 cm dá lugar ao alcance dos dedos do app) + alcance. */
  function avisosResultado(e, r) {
    var l = P.avisosItens(e, r.bocaAoPe, r.furos).filter(function (a) { return a.campo !== "parede" && a.campo !== "emb" && a.tipo !== "espaco-45"; });
    return l.concat(alcanceDedos(e, r));
  }

  /* Sem modelos prontos (pedido do Igor, 23/11/2026): as medidas de produção dele não vão para o site. */
  var api = { ALCANCE_MAX: ALCANCE_MAX, sugeridos: sugeridos, notasEscala: notasEscala, salto: salto, linhaEscala: linhaEscala,
    furosMaoDeCima: furosMaoDeCima, paresMesmaMao: paresMesmaMao,
    alcanceDedos: alcanceDedos, sugestaoAlcance: sugestaoAlcance, avisosCampos: avisosCampos, avisosResultado: avisosResultado };
  if (node) module.exports = api; else root.PifeModo = api;
})(this);
