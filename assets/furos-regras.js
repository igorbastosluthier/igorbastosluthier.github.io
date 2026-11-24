/* Tamanho sugerido dos furos, igual para o pífano e para a NAF. Sem DOM; testado em node (tests/furos_regras.test.js).
   O gerador parte do tamanho de furo de costume (por quantidade de furos e na proporção do tubo) e escolhe, de 0,5 em
   0,5 mm, a disposição que cumpre as regras de bom senso: furo que dá voz mas que o dedo fecha, dedos da mesma mão a uma distância
   que a mão alcança, vãos regulares dentro de cada mão, madeira entre furos vizinhos e alcance (agudos) o maior possível. As
   posições de cada furo saem da conta normal da calculadora (as notas continuam afinadas); o tubo nunca é encolhido aqui.
   Determinístico: a mesma entrada dá sempre a mesma saída. */
(function (root) {
  "use strict";
  var meio = function (x) { return Math.round(x * 2) / 2; };

  /* mãos: 5 furos = 2 em cima + 3 embaixo; 6 = 3 + 3; 7 = 4 + 3 (o furo do polegar fica com a mão de cima) */
  function maosTopo(n) { return n === 5 ? 2 : n < 7 ? Math.floor((n + 1) / 2) : 4; }
  /* índices i (do pé para a boca) em que o par (i-1, i) é da mesma mão */
  function paresMesmaMao(n) {
    var baixo = n - maosTopo(n), l = [];
    for (var i = 1; i < n; i++) if (i !== baixo) l.push(i);
    return l;
  }

  var W = { prior: 3, padrao: 40, padraoNaf: 15, alcance: 30, vaos: 1.5, maos: 3, madeira: 4, razao: 20, conforto: 8, dedo: 40, falta: 100 };
  var ALCANCE_MIN = 18, ALCANCE_MAX = 48, CONFORTO_NAF = 22, MADEIRA = 9, RAZAO_MAX = 1.8, CORTE_ALVO = 2.0;
  /* limites de tamanho: dá voz (pelo menos 30% do tubo) e o dedo fecha (até 62% do tubo e 16 mm) */
  function limites(bore) {
    var mx = Math.floor(Math.min(16, 0.62 * bore) * 2) / 2, mn = Math.ceil(Math.max(3.5, 0.3 * bore) * 2) / 2;
    return { min: Math.min(mn, mx), max: mx };
  }

  /* Tamanho de partida (do pé para a boca), na proporção do tubo. semis: semitons dos furos; o furo que fica meio tom acima do
     de baixo é menor, para caber. */
  function padrao(tipo, n, semis, bore) {
    var lim = limites(bore), pequeno = function () { return Math.max(lim.min, meio(0.3 * bore)); }, ref, esc;
    if (tipo === "naf") {
      ref = []; for (var i = 0; i < n; i++) ref.push(i === n - 1 ? 8 : i === n - 2 ? 10 : 9);
      esc = Math.max(0.7, Math.min(1.4, bore / 22));
    } else {
      ref = semis.map(function (st, i) { return i === 0 ? 8 : st - semis[i - 1] === 1 ? 7 : 10; });
      esc = bore / 18;
    }
    return ref.map(function (v, i) {
      var d = meio(v * esc);
      if (tipo === "naf" && i > 0 && semis[i] - semis[i - 1] === 1) d = Math.min(d, pequeno());
      return Math.max(lim.min, Math.min(lim.max, d));
    });
  }

  /* custo de uma disposição (0 = tudo certo). a = avaliar(d): {ok, pos (do pé, crescente), razao, falta (mm de furos encostados)} */
  function custo(d, a, o) {
    if (!a) return 1e9;
    if (!a.ok) return 1e6 + 100 * (a.faltaBruta || 0); /* sem flauta válida: a busca segue o quanto os furos ficariam apertados */
    var n = d.length, c = W.falta * (a.falta || 0), i, gap = function (k) { return a.pos[k] - a.pos[k - 1]; };
    var mesma = paresMesmaMao(n), baixo = n - maosTopo(n), maos = [[0, baixo], [baixo, n]], dedos = [];
    mesma.forEach(function (k) {
      var g = gap(k); dedos.push(g);
      c += W.dedo * (Math.max(0, ALCANCE_MIN + 0.5 - g) + Math.max(0, g - ALCANCE_MAX));
      if (o.tipo === "naf") c += W.conforto * Math.max(0, CONFORTO_NAF - g);
    });
    /* vãos regulares dentro de cada mão */
    maos.forEach(function (m) {
      if (m[1] - m[0] < 3) return;
      var gs = [], s = 0; for (i = m[0] + 1; i < m[1]; i++) { gs.push(gap(i)); s += gap(i); }
      var med = s / gs.length; gs.forEach(function (g) { c += W.vaos * Math.abs(g - med); });
    });
    /* as mãos não se espremem: o vão entre elas não é menor que o vão médio dos dedos */
    if (baixo > 0 && baixo < n && dedos.length) c += W.maos * Math.max(0, dedos.reduce(function (x, y) { return x + y; }, 0) / dedos.length - gap(baixo));
    /* madeira entre vizinhos (onde não há tamanho de partida para a quantidade de furos) */
    if (o.madeira) for (i = 1; i < n; i++) c += W.madeira * Math.max(0, MADEIRA - (gap(i) - (d[i] + d[i - 1]) / 2));
    /* furos de tamanhos parecidos */
    var mx = Math.max.apply(null, d), mn = Math.min.apply(null, d); c += W.razao * Math.max(0, mx - RAZAO_MAX * mn);
    /* alcance: agudos fáceis em todos os furos */
    for (i = 0; i < n; i++) if (a.razao[i] !== null && a.razao[i] !== undefined) c += W.alcance * Math.max(0, CORTE_ALVO - a.razao[i]);
    /* perto do tamanho de partida */
    for (i = 0; i < n; i++) c += (o.padrao ? (o.tipo === "naf" ? W.padraoNaf : W.padrao) : W.prior) * Math.pow(d[i] - o.base[i], 2);
    return c;
  }

  function gerar(o) {
    var n = o.n, lim = o.limites || limites(o.bore), passo = o.passo || 0.5;
    var preso = function (v) { return Math.max(lim.min, Math.min(lim.max, meio(v))); };
    var avalia = function (d) { var a = o.avaliar(d); return { d: d, a: a, c: custo(d, a, o) }; };
    var melhor = null;
    /* partida: o tamanho de sempre; se a conta não fechar, o mesmo com todos os furos um pouco menores ou maiores (nunca o tubo) */
    [1, 0.9, 1.1, 0.8, 1.2, 0.7, 1.3].forEach(function (f) {
      if (melhor && melhor.a && melhor.a.ok) return;
      var t = avalia(o.base.map(function (v) { return preso(v * f); }));
      if (!melhor || t.c < melhor.c) melhor = t;
    });
    var atual = melhor;
    for (var it = 0; it < 120; it++) {
      var cand = null;
      for (var i = 0; i < n; i++) {
        for (var s = 0; s < 4; s++) {
          var delta = [-passo, passo, -2 * passo, 2 * passo][s], v = preso(atual.d[i] + delta);
          if (v === atual.d[i]) continue;
          var nd = atual.d.slice(); nd[i] = v;
          var t = avalia(nd);
          if (t.c < atual.c - 1e-9 && (!cand || t.c < cand.c - 1e-9)) cand = t;
        }
      }
      if (!cand) break;
      atual = cand;
    }
    /* sobrou furo encostado: acerto fino, de 0,1 em 0,1 mm, só até os furos deixarem de encostar */
    for (var fi = 0; fi < 60 && atual.a && atual.a.ok && atual.a.falta > 1e-9; fi++) {
      var fino = null;
      for (var j = 0; j < n; j++) for (var k = 1; k <= 10; k++) [-1, 1].forEach(function (sg) {
        var v = Math.max(lim.min, Math.min(lim.max, Math.round((atual.d[j] + sg * 0.1 * k) * 10) / 10));
        if (v === atual.d[j]) return;
        var nd = atual.d.slice(); nd[j] = v; var t = avalia(nd);
        if (t.a && t.a.ok && t.a.falta < atual.a.falta - 1e-12 && (!fino || t.a.falta < fino.a.falta - 1e-12 || (Math.abs(t.a.falta - fino.a.falta) <= 1e-12 && t.c < fino.c))) fino = t;
      });
      if (!fino) break;
      atual = fino;
    }
    var res = { diametros: atual.d, ok: !!(atual.a && atual.a.ok), falta: atual.a && atual.a.ok ? atual.a.falta : null, custo: atual.c, limites: lim };
    /* a conta não fechou com furos que dão voz: tenta de novo deixando os furos ficarem menores (o tubo continua o do tom) */
    if (!res.ok && !o.limites) {
      var lim2 = { min: Math.min(lim.max, Math.max(3.5, Math.ceil(0.2 * o.bore * 2) / 2)), max: lim.max };
      if (lim2.min < lim.min) {
        var o2 = Object.assign({}, o, { limites: lim2 }); o2.base = o.base.map(function (v) { return Math.max(lim2.min, Math.min(lim2.max, v)); });
        var r2 = gerar(o2); if (r2.ok) { r2.relaxado = true; return r2; }
      }
    }
    return res;
  }

  var api = { pesos: W, gerar: gerar, padrao: padrao, limites: limites, maosTopo: maosTopo, paresMesmaMao: paresMesmaMao, custo: custo,
    ALCANCE_MIN: ALCANCE_MIN, ALCANCE_MAX: ALCANCE_MAX, CORTE_ALVO: CORTE_ALVO, MADEIRA: MADEIRA };
  if (typeof module === "object" && module.exports) module.exports = api; else root.FurosRegras = api;
})(this);
