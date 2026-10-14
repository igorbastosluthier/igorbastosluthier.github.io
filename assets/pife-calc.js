/* Calculadora de Pife - Igor Bastos Luthier.
   Motor de cálculo próprio, escrito do zero a partir das fórmulas publicadas do método de comprimento efetivo
   (Flutomat, de Pete Kosel, que segue o trabalho de Hans Bracker e de C. J. Nederveen). Todas as medidas em mm. */
(function (root) {
  "use strict";

  var SEMITONS_ESCALA_MAIOR = [2, 4, 5, 7, 9, 11];
  var NOMES = ["Dó", "Dó#", "Ré", "Ré#", "Mi", "Fá", "Fá#", "Sol", "Sol#", "Lá", "Lá#", "Si"];

  /* Tons de pífano: nota grave (todos os furos fechados), em número MIDI. */
  var TONS = [
    { id: "sol-agudo", midi: 79 },
    { id: "fas-agudo", midi: 78 },
    { id: "fa-agudo", midi: 77 },
    { id: "mi-agudo", midi: 76 },
    { id: "res-agudo", midi: 75 },
    { id: "re-agudo", midi: 74 },
    { id: "dos", midi: 73 },
    { id: "do", midi: 72 },
    { id: "si", midi: 71 },
    { id: "las", midi: 70 },
    { id: "la", midi: 69 },
    { id: "sols", midi: 68 },
    { id: "sol", midi: 67 },
    { id: "fas", midi: 66 },
    { id: "fa", midi: 65 },
    { id: "mi", midi: 64 },
    { id: "res", midi: 63 },
    { id: "re-grave", midi: 62 },
    { id: "dos-grave", midi: 61 },
    { id: "do-grave", midi: 60 },
    { id: "si-grave", midi: 59 },
    { id: "las-grave", midi: 58 },
    { id: "la-grave", midi: 57 }
  ];

  /* nome com a oitava científica: Sol 4 = 392 Hz (o Sol do pife em Sol), Lá 4 = 440 Hz */
  function nomeNota(midi) { return NOMES[((midi % 12) + 12) % 12] + " " + (Math.floor(midi / 12) - 1); }
  /* faixa do pife: agudo (Si 4 para cima), médio (Fá 4 a Lá# 4), grave (Mi 4 para baixo) */
  function faixa(midi) { return midi >= 71 ? "agudo" : midi >= 65 ? "médio" : "grave"; }
  TONS.forEach(function (t) { t.nome = nomeNota(t.midi) + " · " + faixa(t.midi); });
  function freqMidi(midi, la) { return la * Math.pow(2, (midi - 69) / 12); }
  function velocidadeSom(tempC) { return (331.3 + 0.606 * tempC) * 1000; } /* mm/s */

  /* Correção da embocadura (furo do sopro). */
  function correcaoEmbocadura(D, parede, embDiam) {
    var r = D / embDiam;
    return r * r * 10.84 * parede * embDiam / (D + 2 * parede);
  }
  function correcaoPonta(D) { return 0.6133 * D / 2; }
  function correcaoFechado(D, parede, d) { var r = d / D; return 0.25 * parede * r * r; }
  function espessuraEfetiva(parede, d) { return parede + 0.75 * d; }

  /* fração do diâmetro do corpo no centro do sopro, na parábola de Boehm: 0,9 na rolha, 1,0 a 1/4 do comprimento */
  function diametroConeNoSopro(e) {
    var compr = velocidadeSom(e.temp || 25) / (2 * freqMidi((TONS.filter(function (t) { return t.id === e.tom; })[0] || TONS[12]).midi, e.la || 440));
    var Lc = compr / 4, x = e.D;
    return 0.9 + 0.1 * Math.pow(Math.min(x / Lc, 1), 2);
  }

  function diametroSopro(e) {
    return e.embForma === "oval" ? Math.sqrt((e.embL || e.emb) * (e.embC || e.emb)) : e.emb; /* oval: o redondo de mesma área */
  }

  /* Diâmetro de furo sugerido: proporcional ao tubo, menor nos furos de cima. */
  function furoSugerido(D, indice) {
    var fator = [0.6, 0.58, 0.42, 0.58, 0.55, 0.5][indice]; /* o 3º furo (meio tom) é menor */
    return Math.max(4, Math.round(D * fator * 2) / 2);
  }

  /* Calcula o pífano. entrada: {tom, la, temp, D, parede, emb, furos:[d1..d6] (de baixo para cima)} */
  function calcular(e) {
    var tom = TONS.filter(function (t) { return t.id === e.tom; })[0] || TONS[12];
    var c = velocidadeSom(e.temp);
    var D = e.D, t = e.parede;
    /* furo do sopro redondo (emb) ou oval (embL = largura, atravessando o tubo; embC = comprimento, ao longo dele):
       o diâmetro equivalente é o do furo redondo de mesma área. O porta-lábios aumenta a altura da "chaminé" do sopro. */
    var embD = diametroSopro(e), chamine = t + (e.lip || 0);
    /* cabeça cônica (opcional, modelo Boehm): no furo do sopro o tubo é mais estreito; a correção da embocadura usa o
       diâmetro local ali (Flutomat), o que muda o comprimento do tubo e a posição dos furos */
    var Demb = e.cone ? D * diametroConeNoSopro(e) : D;
    var Ce = correcaoEmbocadura(Demb, chamine, embD);
    var Cp = correcaoPonta(D);
    var d = e.furos.slice();
    var f0 = freqMidi(tom.midi, e.la);
    var fechados = d.map(function (di) { return correcaoFechado(D, t, di); });
    var somaFechados = function (de) { var s = 0; for (var j = de; j < 6; j++) s += fechados[j]; return s; };

    var pe = c / (2 * f0) - Ce - Cp - somaFechados(0); /* da boca (centro do sopro) até o pé */
    var furos = [];
    var anterior = pe;
    for (var i = 0; i < 6; i++) {
      var midi = tom.midi + SEMITONS_ESCALA_MAIOR[i];
      var f = freqMidi(midi, e.la);
      var meia = c / (2 * f);
      var base = meia - Ce - somaFechados(i + 1);
      var te = espessuraEfetiva(t, d[i]);
      var x = base - 10, s = 0, Cop = 0;
      for (var k = 0; k < 200; k++) {
        s = Math.max(anterior - x, 0.5);
        if (i === 0) {
          Cop = te / (Math.pow(d[i] / D, 2) + te / s);
        } else {
          Cop = s / 2 * (Math.sqrt(1 + 4 * (te / s) * Math.pow(D / d[i], 2)) - 1);
        }
        var novo = base - Cop;
        if (Math.abs(novo - x) < 0.001) { x = novo; break; }
        x = novo;
      }
      s = anterior - x;
      var fc = c / (2 * Math.PI) * (d[i] / D) / Math.sqrt(te * Math.max(s, 0.5));
      furos.push({
        indice: i, nota: nomeNota(midi), midi: midi, freq: f, diametro: d[i],
        daBoca: x, doPe: pe - x, espaco: s, corte: fc, razaoCorte: fc / f
      });
      anterior = x;
    }
    return {
      cone: e.cone ? { sopro: D * diametroConeNoSopro(e), rolha: D * 0.9 } : null,
      tom: tom, f0: f0, velocidade: c, correcaoEmbocadura: Ce, correcaoPonta: Cp,
      bocaAoPe: pe, rolha: D * 1.0, furos: furos, avisos: avisos(e, pe, furos)
    };
  }

  /* Parede ideal (Igor, 13/10): 4 mm no Sol 4 com tubo de 18 mm; proporcional ao diâmetro interno nos outros tons */
  function paredeIdeal(D) { return Math.round(4 * D / 18 * 2) / 2; }

  function avisos(e, pe, furos) {
    var lista = [], ideal = paredeIdeal(e.D);
    if (e.parede + (e.lip || 0) < ideal * 0.75) lista.push("Parede fina para esse tubo (o ideal é perto de " + String(ideal).replace(".", ",") + " mm): no furo do sopro, um porta-lábios ajuda a dar mais sustentação ao som.");
    furos.forEach(function (h) {
      var n = (h.indice + 1) + "º furo (" + h.nota + ")";
      if (h.diametro > e.D * 0.85) lista.push(n + ": furo quase do tamanho do tubo. Use um tubo mais largo ou um furo menor.");
      if (h.razaoCorte < 1.4) lista.push(n + ": furo pequeno para essa distância; a nota pode sair fraca ou abafada. Aumente o furo.");
      if (h.espaco < h.diametro + 3) lista.push(n + ": muito perto do furo de baixo. Diminua os furos ou use outro tom.");
    });
    var maior = Math.max.apply(null, furos.slice(1).map(function (h) { return h.espaco; }));
    if (maior > 45) lista.push("Há furos com mais de 4,5 cm entre si: pode ficar difícil para mãos pequenas. Diminuir esses furos aproxima as posições.");
    if (diametroSopro(e) > e.D * 0.75) lista.push("Furo do sopro grande para esse tubo: o som fica mais aberto mas mais difícil. O comum é entre 50% e 65% do diâmetro interno.");
    if (pe < 150) lista.push("Tubo muito curto para esse tom.");
    return lista;
  }

  /* Ajuste fino: a nota saiu 'cents' (positivo = alta, negativo = baixa). Retorna a orientação. */
  function ajuste(e, indice, cents) {
    var r = calcular(e);
    var h = r.furos[indice];
    var fReal = h.freq * Math.pow(2, cents / 1200);
    /* comprimento a mais (ou a menos) que o furo está se comportando */
    var c = r.velocidade;
    var delta = c / (2 * fReal) - c / (2 * h.freq); /* + = está "longo" (nota baixa) */
    if (Math.abs(cents) < 5) return { tipo: "ok", texto: cents === 0 ? "Marcou 0: a nota está afinada, não precisa mexer." : "Diferença pequena (menos de 5 cents): dá para corrigir no sopro, sem mexer no furo." };
    if (delta > 0) {
      var lo = h.diametro, hi = e.D * 0.95, alvo = h.daBoca + delta, novo = null;
      for (var k = 0; k < 60; k++) {
        var m = (lo + hi) / 2;
        var tent = JSON.parse(JSON.stringify(e)); tent.furos[indice] = m;
        var x = calcular(tent).furos[indice].daBoca;
        if (x < alvo) lo = m; else hi = m;
        novo = m;
      }
      if (novo >= e.D * 0.94) return { tipo: "subir", texto: "A nota está baixa demais para corrigir só alargando. Furo novo cerca de " + delta.toFixed(1) + " mm mais perto da boca." };
      return { tipo: "alargar", diametro: novo, texto: "A nota está baixa: alargue o furo de " + h.diametro.toFixed(1) + " para cerca de " + novo.toFixed(1) + " mm, aos poucos (lixa enrolada), conferindo no afinador. Alargar mais para o lado da boca sobe mais a nota." };
    }
    return { tipo: "baixar", texto: "A nota está alta: o furo ficou " + (-delta).toFixed(1) + " mm alto demais. Para corrigir, preencha a parte de cima do furo (cola com pó de madeira ou cera) e alargue para baixo; na próxima flauta, fure " + (-delta).toFixed(1) + " mm mais perto do pé." };
  }

  /* Diâmetro interno indicado para o tom (testes práticos do Igor, 13/10): Ré grave 22 mm, Ré agudo 14 mm; entre e
     além deles, a mesma proporção a cada semitom (curva geométrica). Arredondado a 0,5 mm. */
  function tuboSugerido(tomId) {
    var tom = TONS.filter(function (t) { return t.id === tomId; })[0] || TONS[12];
    var x = 22 * Math.pow(14 / 22, (tom.midi - 62) / 12);
    return Math.round(x * 2) / 2;
  }

  /* Furos sugeridos: o padrão que o Igor usa no Sol 4 com tubo de 18 mm (do pé para a boca: 8, 10, 7, 10, 10, 10),
     na mesma proporção do diâmetro interno do tubo para qualquer tom; mm inteiros. */
  var PADRAO_IGOR = [8, 10, 7, 10, 10, 10], TUBO_PADRAO = 18;
  function otimizarFuros(e) {
    var tent = JSON.parse(JSON.stringify(e)), max = Math.max(4, Math.floor(e.D * 0.8));
    tent.furos = PADRAO_IGOR.map(function (d) { return Math.max(4, Math.round(d * e.D / TUBO_PADRAO)); });
    /* tubo fino: o arredondamento pode juntar dois furos; o de baixo cresce 1 mm (e desce) até haver 4 mm entre as bordas */
    for (var volta = 0; volta < 20; volta++) {
      var r = calcular(tent), mudou = false;
      for (var i = 1; i < 6; i++) {
        if (r.furos[i].espaco < (tent.furos[i] + tent.furos[i - 1]) / 2 + 4 && tent.furos[i - 1] < max) { tent.furos[i - 1] += 1; mudou = true; break; }
      }
      if (!mudou) break;
    }
    return tent.furos;
  }

  var api = { paredeIdeal: paredeIdeal, diametroSopro: diametroSopro, TONS: TONS, calcular: calcular, otimizarFuros: otimizarFuros, tuboSugerido: tuboSugerido, ajuste: ajuste, furoSugerido: furoSugerido, nomeNota: nomeNota, freqMidi: freqMidi };
  if (typeof module === "object" && module.exports) module.exports = api; else root.PifeCalc = api;
})(this);
