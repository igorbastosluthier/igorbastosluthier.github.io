/* Escalas das calculadoras (Pífano e NAF) e o som para ouvir a escala - Igor Bastos Luthier.
   Os nomes, os graus e a regra de montagem dos furos são os mesmos do app da oficina (flute_scales.py):
   - escala com o mesmo número de notas que furos: um furo por nota;
   - uma nota a menos que furos: o furo de cima dá a oitava;
   - NAF de 6 furos com pentatônica: furo auxiliar (fora da escala), como na tradição.
   Aqui só aparecem as escalas que cabem inteiras nos furos escolhidos (nenhuma nota fica de fora).
   Parte pura (sem DOM) testada em node; o tocador usa a Web Audio API do navegador. */
(function (root) {
  "use strict";

  /* Graus da escala: semitons acima da tônica, sem a tônica e sem a oitava (mesma ordem do app). */
  var ESCALAS_APP = [
    ["Pentatônica menor", [3, 5, 7, 10]],
    ["Pentatônica maior", [2, 4, 7, 9]],
    ["Diatônica maior (jônia)", [2, 4, 5, 7, 9, 11]],
    ["Menor natural (eólia)", [2, 3, 5, 7, 8, 10]],
    ["Dórica", [2, 3, 5, 7, 9, 10]],
    ["Mixolídia", [2, 4, 5, 7, 9, 10]],
    ["Nordestina (lídio ♭7 · baião/pífano)", [2, 4, 6, 7, 9, 10]],
    ["Lídia", [2, 4, 6, 7, 9, 11]],
    ["Frígia", [1, 3, 5, 7, 8, 10]],
    ["Menor harmônica", [2, 3, 5, 7, 8, 11]],
    ["Menor melódica", [2, 3, 5, 7, 9, 11]],
    ["Frígia dominante (Hijaz)", [1, 4, 5, 7, 8, 10]],
    ["Dupla harmônica (Hijaz Kar / árabe)", [1, 4, 5, 7, 8, 11]],
    ["Cigana (húngara menor)", [2, 3, 6, 7, 8, 11]],
    ["Blues menor (pentatônica + ♭5)", [3, 5, 6, 7, 10]],
    ["Blues maior", [2, 3, 4, 7, 9]],
    ["Egípcia (pentatônica suspensa)", [2, 5, 7, 10]],
    ["Yo (japonesa)", [2, 5, 7, 9]],
    ["Hirajoshi (japonesa)", [2, 3, 7, 8]],
    ["In / Miyako-bushi (japonesa)", [1, 5, 7, 8]],
    ["Kumoi (japonesa)", [2, 3, 7, 9]],
    ["Ryukyu (Okinawa)", [4, 5, 7, 11]],
    ["Tons inteiros", [2, 4, 6, 8, 10]],
    ["Maior padrão (Standard / Major / Ionian)", [2, 4, 5, 7, 9, 11]],
    ["Eólia (Aeolian / Minor)", [2, 3, 5, 7, 8, 10]],
    ["Eólia com 3ª maior (Aeolian 3)", [2, 4, 5, 7, 8, 10]],
    ["Eólia com 6ª e 7ª (Aeolian 6 7)", [2, 3, 5, 7, 9, 11]],
    ["Eólia com 7ª maior (Aeolian 7)", [2, 3, 5, 7, 8, 11]],
    ["Blues rock and roll (Blues Rock'n'Roll)", [2, 3, 4, 5, 6, 7, 9, 10]],
    ["Cromática (Chromatic)", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]],
    ["Dórica ♯4 (Dorian #4)", [2, 3, 6, 7, 9, 10]],
    ["Cigana maior (Gypsy Major)", [1, 4, 5, 7, 8, 11]],
    ["Cigana menor (Gypsy Minor)", [2, 3, 6, 7, 8, 11]],
    ["Semitom-tom (Half Whole)", [1, 3, 4, 6, 7, 9, 10]],
    ["Cigana húngara (Hungarian Gypsy)", [2, 3, 6, 7, 8, 10]],
    ["Jônia ♯5 (Ionian #5)", [2, 4, 5, 8, 9, 11]],
    ["Lócria (Locrian)", [1, 3, 5, 6, 8, 10]],
    ["Lócria 2 (Locrian 2)", [2, 3, 5, 6, 8, 10]],
    ["Lócria 6 (Locrian 6)", [1, 3, 5, 6, 9, 10]],
    ["Lócria ♭4 (Locrian b4 / alterada)", [1, 3, 4, 6, 8, 10]],
    ["Lócria ♭4 ♭♭7 (Locrian b4 bb7)", [1, 3, 4, 6, 8, 9]],
    ["Lídia ♯2 (Lydian #2)", [3, 4, 6, 7, 9, 11]],
    ["Lídia ♯5 (Lydian #5)", [2, 4, 6, 8, 9, 11]],
    ["Lídia ♭7 (Lydian b7)", [2, 4, 6, 7, 9, 10]],
    ["Menor melódica descendente (Melodic Minor Descending)", [2, 3, 5, 7, 8, 10]],
    ["Pentatônica neutra (Neutral Pentatonic)", [2, 5, 7, 10]],
    ["Frígia 3 (Phrygian 3)", [1, 4, 5, 7, 8, 10]],
    ["Frígia 6 (Phrygian 6)", [1, 3, 5, 7, 9, 10]],
    ["Pentatônica rock (Rock Pentatonic)", [3, 5, 8, 10]],
    ["Pentatônica escocesa (Scottish Pentatonic)", [2, 5, 7, 9]],
    ["Cigana espanhola (Spanish Gypsy)", [1, 4, 5, 7, 8, 10]],
    ["Tom-semitom (Whole Half)", [2, 3, 5, 6, 8, 9, 11]]
  ];
  /* Notas auxiliares consagradas na NAF de 6 furos (app: AUXILIARY). */
  var AUX_NOME = { "Pentatônica menor": 8, "Pentatônica maior": 5, "Egípcia (pentatônica suspensa)": 9 };

  function slug(nome) {
    return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  /* Sinônimos (mesmas notas com outro nome) aparecem uma vez só, com o primeiro nome da lista do app. */
  var LISTA = [], POR_ID = {}, vistos = {};
  ESCALAS_APP.forEach(function (p) {
    var chave = p[1].join(",");
    if (vistos[chave]) return;
    vistos[chave] = true;
    var e = { id: slug(p[0]), nome: p[0], graus: p[1].slice(), aux: AUX_NOME[p[0]] || null };
    LISTA.push(e); POR_ID[e.id] = e;
  });

  var FUROS = { pife: [5, 6, 7], naf: [5, 6] };
  var PADRAO = { pife: "diatonica-maior-jonia", naf: "pentatonica-menor" };

  /* Semitons de cada furo (do pé para a boca) e as notas auxiliares; null se a escala não cabe inteira. */
  function layout(id, n, instrumento) {
    var e = POR_ID[id];
    if (!e) return null;
    var g = e.graus.length, furos = e.graus.slice(), aux = [];
    if (g === n) return { furos: furos, aux: aux };
    if (g === n - 1) return { furos: furos.concat([12]), aux: aux };
    /* NAF de 6 furos com pentatônica: oitava no furo de cima e a nota auxiliar da tradição */
    if (instrumento === "naf" && g === n - 2 && e.aux !== null) {
      furos = furos.concat([e.aux, 12]).sort(function (a, b) { return a - b; });
      return { furos: furos, aux: [e.aux] };
    }
    return null;
  }

  /* Escalas que servem para o instrumento ("pife" ou "naf") com n furos. */
  function aplicaveis(instrumento, n) {
    return LISTA.filter(function (e) { return layout(e.id, n, instrumento) !== null; });
  }
  function serve(id, instrumento, n) { return layout(id, n, instrumento) !== null; }

  /* Notas para ouvir: tônica (tudo fechado), cada furo que é nota da escala (o auxiliar não entra) e a oitava.
     freqRaiz: Hz da nota grave; furos: [{hz, aux}] do pé para a boca, como saíram do cálculo da flauta.
     modo: "subir" (tônica até a oitava) ou "ida-e-volta" (tônica, oitava e de volta à tônica). */
  function sequencia(freqRaiz, furos, modo) {
    var sobe = [freqRaiz];
    furos.forEach(function (f) { if (!f.aux && f.hz > sobe[sobe.length - 1] * 1.0001) sobe.push(f.hz); });
    if (sobe[sobe.length - 1] < freqRaiz * 2 * (1 - 1e-9)) sobe.push(freqRaiz * 2);
    if (modo === "ida-e-volta") return sobe.concat(sobe.slice(0, -1).reverse());
    return sobe;
  }

  /* ---- tocador (navegador) ---- */
  var ctx = null, fila = null;
  function contexto() {
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    return ctx;
  }
  /* Som macio, parecido com flauta: seno + um pouco do 2º e do 3º harmônico, ataque e saída curtos. */
  function nota(c, destino, f, t0, dur) {
    var g = c.createGain(), ataque = 0.05, saida = Math.min(0.18, dur * 0.4);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.22, t0 + ataque);
    g.gain.setValueAtTime(0.22, t0 + dur - saida);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    g.connect(destino);
    var oscs = [[1, 0.78], [2, 0.16], [3, 0.06]].map(function (h) {
      var o = c.createOscillator(), gh = c.createGain();
      o.type = "sine"; o.frequency.value = f * h[0]; gh.gain.value = h[1];
      o.connect(gh); gh.connect(g); o.start(t0); o.stop(t0 + dur + 0.02);
      return o;
    });
    return oscs[0];
  }
  /* Toca a lista de frequências. op: {porNota (s), ultima (s), aoAcabar()}. Devolve um controle. */
  function tocar(freqs, op) {
    op = op || {};
    parar();
    var c = contexto();
    if (!c || !freqs.length) return null;
    if (c.state === "suspended" && c.resume) c.resume(); /* celular: o som só sai depois de um toque */
    var mestre = c.createGain(); mestre.gain.value = 1; mestre.connect(c.destination);
    var t = c.currentTime + 0.06, passo = op.porNota || 0.5, ult = null;
    freqs.forEach(function (f, k) {
      var dur = k === freqs.length - 1 && op.ultima ? op.ultima : passo;
      ult = nota(c, mestre, f, t, dur); t += dur;
    });
    var este = { mestre: mestre, pausado: false, acabou: false };
    ult.onended = function () { if (fila !== este) return; este.acabou = true; fila = null; try { mestre.disconnect(); } catch (x) { /* já solto */ } if (op.aoAcabar) op.aoAcabar(); };
    fila = este;
    return este;
  }
  function pausar() { if (fila && ctx && !fila.pausado) { fila.pausado = true; ctx.suspend(); } }
  function continuar() { if (fila && ctx && fila.pausado) { fila.pausado = false; ctx.resume(); } }
  function parar() {
    if (!fila) return;
    var f = fila; fila = null;
    try { f.mestre.disconnect(); } catch (x) { /* já solto */ }
    if (ctx && ctx.state === "suspended") ctx.resume();
  }
  function estado() { return !fila ? "parado" : fila.pausado ? "pausado" : "tocando"; }

  /* Botão "Ouvir escala" com os modos Subir / Ida e volta. el: {botao, modo (select ou radios via função)};
     obter(): devolve {freqRaiz, furos} da flauta calculada agora (ou null). */
  function ligarBotao(botao, lerModo, obter) {
    var chaveAtual = null;
    function rotulo() {
      var s = estado();
      botao.textContent = s === "tocando" ? "⏸ Pausar" : s === "pausado" ? "▶ Continuar" : "▶ Ouvir escala";
      botao.setAttribute("aria-pressed", s === "tocando" ? "true" : "false");
    }
    botao.addEventListener("click", function () {
      var d = obter();
      if (!d) return;
      var modo = lerModo(), freqs = sequencia(d.freqRaiz, d.furos, modo), chave = modo + "|" + freqs.map(function (f) { return f.toFixed(2); }).join(",");
      var s = estado();
      if (s === "tocando" && chave === chaveAtual) pausar();
      else if (s === "pausado" && chave === chaveAtual) continuar();
      else { chaveAtual = chave; tocar(freqs, { porNota: 0.5, ultima: modo === "subir" ? 1.1 : 0.8, aoAcabar: rotulo }); }
      rotulo();
    });
    return { atualizar: rotulo, parar: function () { parar(); rotulo(); } };
  }

  var api = { LISTA: LISTA, FUROS: FUROS, PADRAO: PADRAO, porId: function (id) { return POR_ID[id] || null; }, slug: slug,
    layout: layout, aplicaveis: aplicaveis, serve: serve, sequencia: sequencia,
    tocar: tocar, pausar: pausar, continuar: continuar, parar: parar, estado: estado, ligarBotao: ligarBotao };
  if (typeof module === "object" && module.exports) module.exports = api; else root.Escalas = api;
})(this);
