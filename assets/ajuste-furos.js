/* Ajuste automático do tamanho dos furos - Igor Bastos Luthier.
   Pedido do Igor: ao escolher qualquer escala, a calculadora tem de mostrar uma flauta que dá para fazer, sem furos
   encostados. Os tamanhos sugeridos são o ideal; quando dois furos ficariam encostados (ou um furo encostado na boca ou no
   pé), muda-se o tamanho de alguns furos, aos poucos, e a POSIÇÃO de cada furo é recalculada pela conta normal da
   calculadora, então as notas continuam afinadas.
   Busca: a cada passo (0,1 mm) experimenta aumentar ou diminuir cada furo envolvido num aperto e fica com a mudança que
   mais diminui o aperto total; no empate, a que fica mais perto dos tamanhos ideais. Não supõe o sentido (se o furo sobe
   ou desce ao mudar de tamanho): mede pela própria conta. Sem DOM; testado em node. */
(function (root) {
  "use strict";
  function r1(x) { return Math.round(x * 10) / 10; }

  /* ideal: diâmetros sugeridos; avaliar(d) -> {falta: soma dos apertos em mm (0 = tudo certo), envolvidos: [índices]};
     lim: {min, max, passo, maxPassos}. Devolve {diametros, ideal, ajustados: [{indice, de, para}], ok, falta}. */
  function ajustar(ideal, avaliar, lim) {
    var passo = lim.passo || 0.1, maxPassos = lim.maxPassos || 400;
    var preso = function (v) { return r1(Math.max(lim.min, Math.min(lim.max, v))); };
    var d = ideal.map(function (v) { return v > 0 ? preso(v) : v; }); /* 0 = furo desligado (NAF) */
    var desvio = function (x) { var s = 0; for (var i = 0; i < x.length; i++) s += Math.abs(x[i] - ideal[i]); return s; };
    var atual = avaliar(d);
    for (var it = 0; it < maxPassos && atual.falta > 1e-9; it++) {
      var melhor = null;
      for (var mult = 1; mult <= 64 && !melhor; mult *= 2) { /* platô: tenta passos maiores antes de desistir */
        atual.envolvidos.forEach(function (i) {
          if (!(d[i] > 0)) return;
          [-1, 1].forEach(function (sinal) {
            var nd = d.slice(); nd[i] = preso(d[i] + sinal * passo * mult);
            if (nd[i] === d[i]) return;
            var v = avaliar(nd), dv = desvio(nd);
            if (v.falta < atual.falta - 1e-9 && (!melhor || v.falta < melhor.v.falta - 1e-9 || (Math.abs(v.falta - melhor.v.falta) <= 1e-9 && dv < melhor.dv)))
              melhor = { d: nd, v: v, dv: dv };
          });
        });
      }
      if (!melhor) break;
      d = melhor.d; atual = melhor.v;
    }
    var ajustados = [];
    d.forEach(function (v, i) { if (ideal[i] > 0 && Math.abs(v - ideal[i]) > 0.05) ajustados.push({ indice: i, de: ideal[i], para: v }); });
    return { diametros: d, ideal: ideal.slice(), ajustados: ajustados, ok: atual.falta <= 1e-9, falta: atual.falta };
  }

  /* Folga mínima entre as bordas de dois furos vizinhos (e entre furo e boca/pé): 3 mm, ou 15% do tubo se for mais. */
  function folgaMinima(canal) { return Math.max(3, 0.15 * canal); }
  /* Limites de tamanho de furo para o ajuste: até 80% do tubo e pelo menos 3,5 mm (ou 25% do tubo). */
  function limites(canal, maxFrac) { return { min: Math.max(3.5, 0.25 * canal), max: (maxFrac || 0.8) * canal }; }

  function numero(v) { return String(r1(v)).replace(".", ","); }
  /* "Ajustamos o tamanho dos furos 3 e 4 (de 10 para 8,6 mm) para eles não ficarem encostados." */
  function textoAjuste(ajustados, nomeFuro) {
    if (!ajustados.length) return "";
    nomeFuro = nomeFuro || function (i) { return String(i + 1); };
    var grupos = [];
    ajustados.forEach(function (a) {
      var g = grupos.filter(function (x) { return x.de === a.de && x.para === a.para; })[0];
      if (g) g.furos.push(nomeFuro(a.indice)); else grupos.push({ de: a.de, para: a.para, furos: [nomeFuro(a.indice)] });
    });
    var lista = function (xs) { return xs.length === 1 ? xs[0] : xs.slice(0, -1).join(", ") + " e " + xs[xs.length - 1]; };
    var partes = grupos.map(function (g) { return lista(g.furos) + " (de " + numero(g.de) + " para " + numero(g.para) + " mm)"; });
    var plural = ajustados.length > 1;
    return "Ajustamos o tamanho " + (plural ? "dos furos " : "do furo ") + lista(partes) + " para " + (plural ? "eles não ficarem encostados" : "ele não ficar encostado") + ". A afinação continua certa.";
  }

  var api = { ajustar: ajustar, folgaMinima: folgaMinima, limites: limites, textoAjuste: textoAjuste };
  if (typeof module === "object" && module.exports) module.exports = api; else root.AjusteFuros = api;
})(this);
