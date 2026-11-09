/* Calculadora de Flauta NAF (Native American Flute) - Igor Bastos Luthier.
   Porte para JavaScript do núcleo do clone Bracker (Hans Bracker, calculadora "Whistle and Flute Hole Calculator")
   como está em flute_app/clone/bracker_clone.py e flute_app/acoustics/bracker_quick_engine.py (Flute Lab 6.1.1),
   ramo "Whistle" (excitação por ducto/janela). As fórmulas NÃO foram simplificadas: a ordem de cálculo, as
   correções de extremidade, de furo fechado e de janela, e a recursão quadrática dos furos são as do original.
   Todas as medidas em mm; frequências em Hz. Nada é enviado a servidor. */
(function (root) {
  "use strict";
  /* escalas do app (escalas.js): no navegador vem antes deste arquivo; no node, por require */
  var Esc = typeof module === "object" && module.exports ? require("./escalas.js") : root.Escalas;
  /* ajuste automático do tamanho dos furos (ajuste-furos.js) */
  var Aj = typeof module === "object" && module.exports ? require("./ajuste-furos.js") : root.AjusteFuros;

  /* ---- notas ---- */
  var NOMES_PT = ["Dó", "Dó♯", "Ré", "Mi♭", "Mi", "Fá", "Fá♯", "Sol", "Sol♯", "Lá", "Si♭", "Si"];
  var NOMES_EN = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
  var BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, DO: 0, RE: 2, MI: 4, FA: 5, SOL: 7, LA: 9, SI: 11 };

  /* "G4", "Sol 4", "Sib4", "Fá#5", "Bb4": retorna número MIDI ou null */
  function parseNota(txt) {
    if (typeof txt !== "string") return null;
    var s = txt.trim().toUpperCase().replace(/Á/g, "A").replace(/É/g, "E").replace(/Ó/g, "O").replace(/\s+/g, "")
      .replace(/♯/g, "#").replace(/♭/g, "B");
    var m = /^(DO|RE|MI|FA|SOL|LA|SI|[A-G])([#B]?)(-?\d)$/.exec(s);
    if (!m) return null;
    var n = BASE[m[1]];
    if (m[2] === "#") n += 1; else if (m[2] === "B") n -= 1;
    return (parseInt(m[3], 10) + 1) * 12 + n;
  }
  function nomePt(midi) { return NOMES_PT[((midi % 12) + 12) % 12] + " " + (Math.floor(midi / 12) - 1); }
  function nomeEn(midi) { return NOMES_EN[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1); }
  /* frequência temperada de uma nota (bracker: concert * 2 ** ((midi - 69) / 12)) */
  function freqNota(midi, a4) { return a4 * Math.pow(2, (midi - 69) / 12); }
  /* fundamental do Bracker (key_change, temperamento igual): calib * (2^(1/12)) ^ (midi - 69) */
  function freqFundamental(midi, a4) { return a4 * Math.pow(Math.pow(2, 1 / 12), midi - 69); }
  function notaMaisProxima(hz, a4) {
    var m = 69 + 12 * Math.log(hz / a4) / Math.LN2, r = Math.round(m);
    return { midi: r, cents: (m - r) * 100 };
  }

  /* Bracker: chaves da calculadora vão de G5 (índice 1) a C3 (índice 32): MIDI 79 a 48 */
  var MIDI_MIN = 48, MIDI_MAX = 79;

  /* Pentatônica menor (passos 3-2-2-3-2), semitons acima da fundamental, do furo do pé para a boca:
     3ª menor, 4ª, 5ª, 7ª menor, oitava. Fonte: Flutopedia (int3_penta_minor.htm e tuning_basic6.htm).
     NAF de 6 furos (Flutopedia "Basic-Six", furos numerados a partir do PÉ): furo 1=3ª menor, 2=4ª, 3=5ª, 4=EXTRA
     (fora da pentatônica; no exemplo em Fá# menor é o Ré, 6ª menor = +8), 5=7ª menor, 6=oitava. O furo extra fica
     fechado na digitação principal do Modo 1 ("o quarto furo a partir de baixo fica sempre fechado", tuning_Grealish.htm).
     O +8 do furo extra é uma SUGESTÃO editável (a página só rotula o furo 4 como "D" no exemplo de Fá# menor). */
  var ESCALAS = { 5: [3, 5, 7, 10, 12], 6: [3, 5, 7, 8, 10, 12] };
  var FURO_EXTRA = { 6: 3 }; /* índice (0 = furo do pé) do furo extra na pentatônica de 6 furos */

  /* Linhas do Bracker, da embocadura para o pé: L1 LTh L2 L3 R1 R2 R3 (índices 0..6; LTh = polegar, não usado na NAF).
     Topologia do Flute Lab (instrument_family.py: NAF 5 furos = L1 L2 L3 R1 R2; NAF 6 furos = L1 L2 L3 R1 R2 R3; a
     linha R3 fica livre na de 5 e a do polegar nunca é usada). O vetor é lido do furo da boca (0) ao do pé. */
  var LINHAS_BRACKER = { 6: [0, 2, 3, 4, 5, 6], 5: [0, 2, 3, 4, 5] };

  /* ---- modelo Bracker (ramo Whistle), tudo em mm ---- */
  function Estado(p) { /* p: {bore, wall, emb1, emb2, embWall, temp, fend, freqs[7], diams[7]} */
    this.bore = p.bore; this.wall = p.wall; this.emb1 = p.emb1; this.emb2 = p.emb2; this.embWall = p.embWall;
    this.freqs = p.freqs; this.diams = p.diams; this.fend = p.fend;
    this.c = 20055 * Math.sqrt(p.temp + 270.15); /* velocidade do som, mm/s */
    this.xf = [0, 0, 0, 0, 0, 0, 0];
  }
  function te(s, n1) { return 1.0 * s.wall + 0.75 * s.diams[n1 - 1]; }
  function cC(s, n1) { var r = s.diams[n1 - 1] / s.bore; return 0.25 * s.wall * r * r; }
  function cEnd(s) { return 0.5 * s.bore; }
  function cEmb(s) { /* ramo Whistle */
    var le = s.embWall, bd = (s.bore * s.bore) / (s.emb1 * s.emb2), de = s.emb1 / 2 + s.emb2 / 2;
    return bd * (1 * le + 0.3 * de);
  }
  function raizQuadratica(a, b, c) { return (-b - Math.sqrt(b * b - 4 * a * c)) / (2 * a); }

  function distancias(s) {
    s.xorg = s.c * 0.5 / s.fend;
    s.cend = cEnd(s);
    s.xend = s.xorg - s.cend;
    s.cclosed = 0;
    var i;
    for (i = 1; i <= 7; i++) s.cclosed += cC(s, i);
    for (i = 1; i <= 7; i++) s.xend -= cC(s, i);

    var L = s.c * 0.5 / s.freqs[6];
    for (i = 2; i <= 7; i++) L -= cC(s, i - 1);
    var razao = s.diams[6] / s.bore, a = razao * razao;
    if (s.diams[6] === 0) s.xf[6] = s.xend;
    else {
      var b = -(s.xend + L) * (razao * razao);
      var c = s.xend * L * (razao * razao) + te(s, 7) * (L - s.xend);
      s.xf[6] = raizQuadratica(a, b, c);
    }
    for (var h = 6; h >= 1; h--) {
      if (s.diams[h - 1] === 0) { s.xf[h - 1] = s.xf[h]; continue; }
      L = s.c * 0.5 / s.freqs[h - 1];
      if (h > 1 && h <= 7) for (i = 1; i < h; i++) L -= cC(s, i);
      var rt = te(s, h) * (s.bore / s.diams[h - 1]) * (s.bore / s.diams[h - 1]);
      var prox = h === 1 ? s.xf[2] : s.xf[h]; /* o original pula a linha do polegar para o 1º furo */
      var bb = -prox - 3 * L + rt, cc = prox * (L - rt) + (L * L);
      s.xf[h - 1] = raizQuadratica(2, bb, cc);
    }
    s.xemb = cEmb(s);
  }

  /* frequência de corte (f_c do clone) dividida pela frequência do furo = "razão de corte" */
  function razaoCorte(s, n1) {
    if (s.diams[n1 - 1] === 0) return { valor: 0, estimado: false };
    var sp, estimado = false;
    if (n1 === 7) sp = s.xend - s.xf[6];
    else if (s.diams[n1] > 0) sp = s.xf[n1] - s.xf[n1 - 1];
    else if (n1 + 1 < 7) sp = s.xf[n1 + 1] - s.xf[n1 - 1];
    else {
      /* EXTENSÃO NOSSA (não é paridade): o clone Bracker dá NaN aqui (furo do pé quando a linha R3 está livre, como na
         NAF de 5 furos, pois não há furo abaixo). Usamos a mesma regra que ele aplica ao último furo (n1 == 7):
         espaço = distância do furo ao fim acústico. As posições não dependem disso. */
      sp = s.xend - s.xf[n1 - 1]; estimado = true;
    }
    var a = (s.c / (2 * Math.PI)) * (s.diams[n1 - 1] / s.bore) * (1.0 / Math.sqrt(te(s, n1) * sp));
    return { valor: a / s.freqs[n1 - 1], estimado: estimado };
  }

  /* ---- sugestões editáveis (sementes do Flute Lab 6.1.1 / auto_design: NAF), não são regra universal ---- */
  function r1(x) { return Math.round(x * 10) / 10; }
  function sementeSugestao(n, midi, a4, fator, escD, semis) {
    var f0 = freqFundamental(midi, a4);
    var otimo = Math.max(7, Math.min(38, 2620 * Math.pow(f0, -5 / 6)));
    var bore = Math.max(7, Math.min(38, otimo * fator));
    var wall = Math.max(2.4, Math.min(5.5, bore * 0.14));
    var ref = [8.0, 9.0, 8.0, 7.0, 8.0, 10.5, 9.0].slice(0, n).reverse(); /* da boca ao pé -> do pé à boca */
    var esc = Math.max(0.7, Math.min(1.4, bore / 19.0));
    var diams = ref.map(function (v) { return Math.max(2.5, Math.min(bore * 0.72, Math.round(v * esc * escD * 2) / 2)); });
    /* furo que fica meio tom acima do de baixo (como o extra da pentatônica de 6 furos) é pequeno: com o Bracker ele
       só tem solução se for bem menor que os vizinhos (mesma regra do app) */
    semis.forEach(function (st, k) { if (k > 0 && st - semis[k - 1] === 1) diams[k] = Math.max(2.5, Math.round(bore * 0.3 * 2) / 2); });
    return {
      diametroExterno: r1(bore + 2 * wall), parede: r1(wall),
      janelaCompr: r1(Math.max(3, bore * 0.5)), janelaLarg: r1(Math.max(3, bore * 0.55)),
      janelaAltura: r1(wall), /* altura da janela = parede do tubo nesse ponto (medido em NAFs: erro +3 a +17 mm; com 0,07 × o furo, +31 a +34 mm) */ cabeca: Math.round(bore * 5.2), ponta: 0, diametros: diams
    };
  }
  /* Parte da semente do Flute Lab (bore = 1,15 × o ótimo do Bracker) e, se o modelo não achar posições em ordem
     para essa geometria (acontece com o furo extra em tubo largo), reduz o tubo em passos até achar. É só uma
     sugestão editável: se nada servir, devolve a semente original. */
  function sugerir(o) {
    o = o || {};
    var n = o.furos === 5 ? 5 : 6, a4 = o.a4 || 440, midi = typeof o.midi === "number" ? o.midi : 67, semis = semitons(o.escala, n).furos;
    var fatores = [1.15, 1.05, 0.95, 0.9, 0.85, 0.8, 0.7, 0.6], escDs = [1, 0.85, 0.7, 0.55], sementes = [];
    for (var q = 0; q < fatores.length * escDs.length; q++) {
      var i = Math.floor(q / escDs.length), s = sementeSugestao(n, midi, a4, fatores[i], escDs[q % escDs.length], semis);
      var e = { furos: n, fundamental: nomeEn(midi), a4: a4, temperatura: o.temp === undefined ? 20 : o.temp, diametroExterno: s.diametroExterno, parede: s.parede,
        janelaCompr: s.janelaCompr, janelaLarg: s.janelaLarg, janelaAltura: s.janelaAltura, cabeca: s.cabeca, ponta: 0,
        linhas: semis.map(function (st) { return midi + st; }).map(function (m, k) { return { nota: nomeEn(m), diametro: s.diametros[k] }; }) };
      sementes.push({ s: s, e: e, ok: midi >= MIDI_MIN && midi <= MIDI_MAX && calcular(e).ok });
    }
    /* 1º: a primeira semente que já calcula e em que o ajuste automático separa todos os furos; 2º: a primeira que
       calcula; 3º: a primeira em que o ajuste consegue chegar a uma flauta válida; senão, a semente original */
    var ajOk = function (x) { return !Aj || ajustarFuros(x.e).ok; };
    var a = sementes.filter(function (x) { return x.ok; }).filter(ajOk)[0] || null;
    if (a) return a.s;
    var calculavel = sementes.filter(function (x) { return x.ok; })[0];
    if (calculavel) return calculavel.s;
    if (Aj && midi >= MIDI_MIN && midi <= MIDI_MAX) for (q = 0; q < sementes.length; q++) if (ajOk(sementes[q])) return sementes[q].s;
    return sementes[0].s;
  }

  /* semitons dos furos (do pé para a boca) e auxiliares da escala escolhida; escala que não serve para a NAF com n
     furos (ou desconhecida, ou "personalizada") cai na pentatônica menor */
  function semitons(tipo, n) {
    n = n === 5 ? 5 : 6;
    var l = Esc && tipo ? Esc.layout(tipo, n, "naf") : null;
    if (l) return l;
    return { furos: ESCALAS[n].slice(), aux: n === 6 ? [ESCALAS[6][FURO_EXTRA[6]]] : [] };
  }
  /* notas (MIDI) dos furos do pé para a boca; n = 5 ou 6 */
  function escala(tipo, midiFund, n) {
    return semitons(tipo, n).furos.map(function (x) { return midiFund + x; });
  }

  /* ---- validação ---- */
  function num(v) { return typeof v === "number" && isFinite(v) ? v : (typeof v === "string" && v.trim() !== "" && isFinite(Number(v.replace(",", "."))) ? Number(v.replace(",", ".")) : NaN); }
  function fmt(x) { return (Math.round(x * 10) / 10).toFixed(1).replace(".", ","); }

  function validar(e) {
    var erros = [];
    function req(campo, rot, v, min, max, unid) {
      var x = num(v);
      if (!isFinite(x)) { erros.push({ campo: campo, msg: rot + ": informe um número." }); return NaN; }
      if (x <= 0 && min > 0) { erros.push({ campo: campo, msg: rot + ": precisa ser maior que zero." }); return NaN; }
      if (x < min || x > max) { erros.push({ campo: campo, msg: rot + ": use um valor entre " + min + " e " + max + (unid || "") + "." }); return NaN; }
      return x;
    }
    var v = {};
    v.furos = e.furos === 5 ? 5 : e.furos === 6 ? 6 : NaN;
    if (!isFinite(v.furos)) erros.push({ campo: "furos", msg: "Quantidade de furos: escolha 5 ou 6." });
    v.a4 = req("a4", "Afinação (Lá)", e.a4, 380, 480, " Hz");
    v.temperatura = req("temperatura", "Temperatura", e.temperatura, -10, 50, " °C");
    v.diametroExterno = req("diametroExterno", "Diâmetro externo", e.diametroExterno, 8, 80, " mm");
    v.parede = req("parede", "Espessura da parede", e.parede, 0.3, 20, " mm");
    v.janelaCompr = req("janelaCompr", "Comprimento da janela", e.janelaCompr, 1, 60, " mm");
    v.janelaLarg = req("janelaLarg", "Largura da janela", e.janelaLarg, 1, 60, " mm");
    v.janelaAltura = req("janelaAltura", "Altura da janela", e.janelaAltura, 0.1, 30, " mm");
    var cab = num(e.cabeca);
    if (!isFinite(cab)) erros.push({ campo: "cabeca", msg: "Bocal: informe um número em mm." });
    else if (cab < 0 || cab > 400) erros.push({ campo: "cabeca", msg: "Bocal: use um valor entre 0 e 400 mm." }); else v.cabeca = cab;
    var po = e.ponta === undefined || e.ponta === "" ? 0 : num(e.ponta);
    if (!isFinite(po) || po < 0 || po > 200) erros.push({ campo: "ponta", msg: "Extensão na ponta: use um valor entre 0 e 200 mm." }); else v.ponta = po;
    if (isFinite(v.diametroExterno) && isFinite(v.parede) && v.diametroExterno <= 2 * v.parede)
      erros.push({ campo: "parede", msg: "O diâmetro externo (" + fmt(v.diametroExterno) + " mm) precisa ser maior que duas vezes a parede (" + fmt(2 * v.parede) + " mm)." });
    var midi = parseNota(e.fundamental);
    if (midi === null) erros.push({ campo: "fundamental", msg: "Nota grave inválida. Exemplos: Sol 4, Lá 3, Sib 3." });
    else if (midi < MIDI_MIN || midi > MIDI_MAX) erros.push({ campo: "fundamental", msg: "A nota grave precisa estar entre Dó 3 e Sol 5." });
    v.midi = midi;
    var linhas = Array.isArray(e.linhas) ? e.linhas.slice(0, isFinite(v.furos) ? v.furos : 6) : [];
    if (isFinite(v.furos) && linhas.length < v.furos) erros.push({ campo: "linhas", msg: "Faltam linhas de furos (esperadas " + v.furos + ")." });
    v.linhas = linhas.map(function (l, k) {
      l = l || {};
      var ativo = l.ativo !== false, rot = "Furo " + (k + 1), o = { linha: k + 1, ativo: ativo, diametro: 0, hz: 0, fonte: "nota", nota: "" };
      if (!ativo) return o;
      var d = num(l.diametro);
      if (!isFinite(d) || d <= 0) erros.push({ campo: "furo" + k + "-d", msg: rot + ": diâmetro precisa ser um número maior que zero." }); else o.diametro = d;
      /* Hz explícito é soberano: vale exatamente o que foi digitado, mesmo que a nota mais próxima tenha outro nome */
      var hzExp = l.hz === undefined || l.hz === null || l.hz === "" ? NaN : num(l.hz);
      if (l.hz !== undefined && l.hz !== null && l.hz !== "" && (!isFinite(hzExp) || hzExp <= 0)) erros.push({ campo: "furo" + k + "-hz", msg: rot + ": frequência em Hz inválida." });
      else if (isFinite(hzExp)) { o.hz = hzExp; o.fonte = "hz"; o.nota = l.nota || ""; }
      else {
        var m = parseNota(l.nota);
        if (m === null) erros.push({ campo: "furo" + k + "-nota", msg: rot + ": informe uma nota (ex.: Sib 4) ou a frequência em Hz." });
        else if (isFinite(v.a4)) { o.hz = freqNota(m, v.a4); o.midi = m; o.nota = l.nota; }
      }
      return o;
    });
    return { erros: erros, v: v };
  }

  /* furo auxiliar (fora da escala) da escala escolhida; na personalizada nenhum furo é auxiliar */
  function ehAux(tipo, n, k) {
    if (!tipo || tipo === "personalizada") return false;
    var l = semitons(tipo, n);
    return l.aux.indexOf(l.furos[k]) >= 0;
  }

  /* ---- cálculo ---- */
  function calcular(e) {
    var val = validar(e || {}), v = val.v, erros = val.erros.slice(), avisos = [];
    if (erros.length) return { ok: false, erros: erros };
    var n = v.furos, lin = LINHAS_BRACKER[n];
    var fend = freqFundamental(v.midi, v.a4);
    var ativas = v.linhas.filter(function (l) { return l.ativo; });
    if (!ativas.length) return { ok: false, erros: [{ campo: "linhas", msg: "Ative ao menos um furo." }] };

    /* ordem: do pé para a boca as frequências sobem; a fundamental é a mais grave */
    var ant = fend, antRot = "a nota grave";
    for (var q = 0; q < ativas.length; q++) {
      if (!(ativas[q].hz > ant)) {
        return { ok: false, erros: [{ campo: "furo" + (ativas[q].linha - 1) + "-hz", msg: "Ordem das notas: o furo " + ativas[q].linha + " (" + ativas[q].hz.toFixed(2).replace(".", ",") + " Hz) precisa soar mais agudo que " + antRot + " (" + ant.toFixed(2).replace(".", ",") + " Hz). As notas sobem do pé para a boca." }] };
      }
      ant = ativas[q].hz; antRot = "o furo " + ativas[q].linha;
    }

    /* Mapeamento pé->boca (linhas do usuário) para boca->pé (7 linhas do Bracker): conversão explícita */
    var freqs = [0, 0, 0, 0, 0, 0, 0], diams = [0, 0, 0, 0, 0, 0, 0], slotDe = [];
    for (var k = 0; k < n; k++) {
      var slot = lin[n - 1 - k]; slotDe[k] = slot;
      if (v.linhas[k].ativo) { freqs[slot] = v.linhas[k].hz; diams[slot] = v.linhas[k].diametro; }
    }
    var bore = v.diametroExterno - 2 * v.parede;
    var s = new Estado({ bore: bore, wall: v.parede, emb1: v.janelaCompr, emb2: v.janelaLarg, embWall: v.janelaAltura,
      temp: v.temperatura, fend: fend, freqs: freqs, diams: diams });
    distancias(s);

    var compAc = s.xend - s.xemb;
    function falha(msg, campo) { return { ok: false, erros: [{ campo: campo || "geometria", msg: msg }] }; }
    if (!isFinite(compAc) || compAc <= 0) return falha("Não foi possível calcular com estas medidas. Revise o diâmetro, a parede e a janela.");
    /* uso interno do ajuste automático: as posições "cruas", mesmo quando não formam uma flauta válida */
    if (e._bruto) {
      var cru = [];
      for (k = 0; k < n; k++) if (v.linhas[k].ativo) cru.push({ k: k, x: s.xend - s.xf[slotDe[k]], d: v.linhas[k].diametro });
      return { ok: false, bruto: { compAc: compAc, bore: bore, janelaCompr: v.janelaCompr, furos: cru } };
    }
    var previo = Infinity, doFim = [];
    for (k = n - 1; k >= 0; k--) { /* boca -> pé */
      if (!v.linhas[k].ativo) continue;
      var x = s.xend - s.xf[slotDe[k]];
      if (!isFinite(x) || x <= 0 || x >= compAc || x >= previo)
        return falha("Não foi possível posicionar o furo " + (k + 1) + " com estas medidas. Tente um tubo mais estreito ou furos menores, ou revise a ordem das notas.", "furo" + k + "-d");
      doFim[k] = x; previo = x;
    }

    var furos = [], acimaFim = null;
    for (k = 0; k < n; k++) {
      var l = v.linhas[k]; if (!l.ativo) continue;
      var doPeAc = doFim[k], pos = doPeAc + v.ponta, da = compAc - doPeAc;
      var rcc = razaoCorte(s, slotDe[k] + 1), rc = rcc.valor;
      var nome, nomeI, aprox = null;
      if (l.fonte === "nota") { nome = nomePt(l.midi); nomeI = nomeEn(l.midi); }
      else {
        /* Hz explícito é o alvo; o rótulo nunca pode contradizê-lo: só mantém o nome da nota se o Hz estiver a
           menos de 0,5 cent dela, senão mostra a nota mais próxima com "≈" */
        var nm = notaMaisProxima(l.hz, v.a4); aprox = nm;
        var igual = Math.abs(nm.cents) < 0.5;
        nome = (igual ? "" : "≈ ") + nomePt(nm.midi); nomeI = (igual ? "" : "≈ ") + nomeEn(nm.midi);
      }
      furos.push({
        linha: l.linha, extra: ehAux(e.escala, n, l.linha - 1), nota: nome, notaIng: nomeI, hz: l.hz, fonteHz: l.fonte, notaProxima: aprox ? { nota: nomePt(aprox.midi), cents: aprox.cents } : null,
        diametro: l.diametro, doPe: pos, doPeAcustico: doPeAc, daJanela: da, espacoAbaixo: null,
        corte: isFinite(rc) ? rc * l.hz : null, razaoCorte: isFinite(rc) ? rc : null, corteEstimado: rcc.estimado
      });
    }
    for (k = 1; k < furos.length; k++) furos[k].espacoAbaixo = furos[k].doPe - furos[k - 1].doPe;

    var otimo = 2620 * Math.pow(fend, -5 / 6);
    if (Math.abs(bore - otimo) / otimo > 0.18)
      avisos.push("Tubo fora do ideal para essa nota: o ideal é perto de " + fmt(otimo) + " mm de diâmetro interno (o seu tem " + fmt(bore) + " mm).");
    if (v.cabeca < v.janelaCompr / 2) avisos.push("O bocal está curto demais para a janela.");
    furos.forEach(function (f, i) {
      var r = "Furo " + f.linha + " (" + f.nota + ")";
      if (f.razaoCorte !== null && f.razaoCorte < 1.5) avisos.push(r + ": os agudos vão sair com dificuldade. Aumente o furo ou afaste-o do vizinho.");
      if (f.diametro > bore * 0.72) avisos.push(r + ": furo grande demais para o tubo.");
      if (f.doPeAcustico - f.diametro / 2 < 0) avisos.push(r + ": o furo encosta na ponta do tubo.");
      if (f.daJanela - f.diametro / 2 < v.janelaCompr / 2) avisos.push(r + ": o furo encosta na janela.");
      if (i > 0) {
        var p = furos[i - 1], d = f.doPe - p.doPe;
        if (d < (f.diametro + p.diametro) / 2) avisos.push(r + ": cruza o furo " + p.linha + " (centros a " + fmt(d) + " mm).");
        else if (d - (f.diametro + p.diametro) / 2 < folga(bore)) avisos.push(r + ": muito perto do furo " + p.linha + " (centros a " + fmt(d) + " mm).");
      }
    });
    return {
      ok: true, modelo: "bracker-whistle",
      entrada: { furos: n, fundamental: v.midi, a4: v.a4, temperatura: v.temperatura, diametroExterno: v.diametroExterno, parede: v.parede, janelaCompr: v.janelaCompr, janelaLarg: v.janelaLarg, janelaAltura: v.janelaAltura, cabeca: v.cabeca, ponta: v.ponta },
      fundamental: { midi: v.midi, nome: nomePt(v.midi), nomeIng: nomeEn(v.midi), hz: fend },
      diametroInterno: bore, velocidadeSom: s.c, furoOtimo: otimo,
      comprimentoAcustico: compAc,                    /* do centro acústico da janela ao fim acústico (calculado) */
      janelaDoPe: compAc + v.ponta,                   /* centro da janela medido da ponta do pé */
      comprimentoFisico: v.cabeca + compAc + v.ponta, /* cabeça (informada) + acústico (calculado) + ponta (informada) */
      correcaoJanela: s.xemb, correcaoPonta: s.cend + s.cclosed,
      furos: furos, avisos: avisos
    };
  }

  /* folga mínima entre bordas (a mesma do pífano e do ajuste automático) */
  function folga(bore) { return Aj ? Aj.folgaMinima(bore) : Math.max(3, 0.15 * bore); }
  /* Furos encostados num resultado válido: vizinhos, furo e pé (ponta do tubo), furo e janela.
     Devolve [{tipo, furos: [índices das linhas, 0 = pé], falta: mm}]. */
  function apertos(r) {
    var g = folga(r.diametroInterno), e = r.entrada, fs = r.furos, lista = [];
    fs.forEach(function (f, i) {
      var k = f.linha - 1;
      if (i === 0) { var gp = f.doPe - f.diametro / 2; if (gp < g) lista.push({ tipo: "pe", furos: [k], falta: g - gp }); }
      else { var p = fs[i - 1], gv = f.doPe - p.doPe - (f.diametro + p.diametro) / 2; if (gv < g) lista.push({ tipo: "vizinhos", furos: [p.linha - 1, k], falta: g - gv }); }
      if (i === fs.length - 1) { var gj = f.daJanela - f.diametro / 2 - e.janelaCompr / 2; if (gj < g) lista.push({ tipo: "janela", furos: [k], falta: g - gj }); }
    });
    return lista;
  }
  /* Ajuste automático (pedido do Igor): parte dos diâmetros de e.linhas (os ideais) e muda o tamanho só dos furos que
     ficariam encostados; as posições saem da conta normal, então as notas continuam afinadas. Furo de 3,5 mm (ou 25% do
     tubo) até 72% do tubo. Devolve {diametros (0 = furo desligado), ideal, ajustados: [{indice, de, para}], ok, falta}. */
  function ajustarFuros(e) {
    var val = validar(e || {});
    var ideal = (e.linhas || []).map(function (l) { var d = num(l && l.diametro); return l && l.ativo === false ? 0 : (isFinite(d) ? d : 0); });
    if (val.erros.length) return { diametros: ideal, ideal: ideal.slice(), ajustados: [], ok: false, falta: 0 };
    var bore = val.v.diametroExterno - 2 * val.v.parede, lim = Aj.limites(bore, 0.72);
    var ativos = []; ideal.forEach(function (d, i) { if (d > 0) ativos.push(i); });
    return Aj.ajustar(ideal, function (d) {
      var t = Object.assign({}, e, { linhas: e.linhas.map(function (l, i) { return Object.assign({}, l, { diametro: d[i] > 0 ? d[i] : l.diametro }); }) });
      var r = calcular(t);
      if (!r.ok) { /* sem flauta válida: mede o quanto falta pelas posições cruas, para a busca saber para onde ir */
        var b = calcular(Object.assign({}, t, { _bruto: true })).bruto, fb = 100;
        if (!b) return { falta: 1000, envolvidos: ativos };
        var g = folga(b.bore), ant = null;
        b.furos.forEach(function (h) {
          if (!isFinite(h.x)) { fb += 50; return; }
          if (ant === null) fb += Math.max(0, g - (h.x - h.d / 2));
          else fb += Math.max(0, g - (h.x - ant.x - (h.d + ant.d) / 2));
          ant = h;
        });
        if (ant) fb += Math.max(0, g - (b.compAc - ant.x - ant.d / 2 - b.janelaCompr / 2));
        return { falta: fb, envolvidos: ativos };
      }
      var a = apertos(r), falta = 0, env = [];
      a.forEach(function (x) { falta += x.falta; x.furos.forEach(function (i) { if (env.indexOf(i) < 0) env.push(i); }); });
      return { falta: falta, envolvidos: env };
    }, lim);
  }

  var api = { apertos: apertos, ajustarFuros: ajustarFuros, semitons: semitons, ehAux: ehAux, calcular: calcular, validar: validar, sugerir: sugerir, escala: escala, parseNota: parseNota, nomePt: nomePt, nomeEn: nomeEn,
    FURO_EXTRA: FURO_EXTRA, freqNota: freqNota, freqFundamental: freqFundamental, notaMaisProxima: notaMaisProxima, MIDI_MIN: MIDI_MIN, MIDI_MAX: MIDI_MAX, LINHAS_BRACKER: LINHAS_BRACKER };
  if (typeof module === "object" && module.exports) module.exports = api; else root.NafCalc = api;
})(this);
