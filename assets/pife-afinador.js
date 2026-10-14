/* Afinador para flauta - Calculadora de pife, Igor Bastos Luthier.
   Detecção de altura pelo método YIN (de Cheveigné & Kawahara, 2002), no próprio navegador, pelo microfone.
   Modos: cromático; pife (as notas do pife calculado, nas 3 oitavas, com o mapa de afinação); oitavas (compara a
   mesma nota na 1ª e na 2ª oitava, para o ajuste da rolha); nota de referência (toca um som para afinar de ouvido). */
(function () {
  "use strict";
  var P = window.PifeCalc;
  var $ = function (id) { return document.getElementById(id); };
  if (!$("af-ligar")) return;

  var NOMES = ["Dó", "Dó#", "Ré", "Ré#", "Mi", "Fá", "Fá#", "Sol", "Sol#", "Lá", "Lá#", "Si"];
  var ESCALA = [0, 2, 4, 5, 7, 9, 11];
  var ctx = null, analisador = null, fonte = null, buf = null, rodando = false, osc = null;
  /* sensibilidade à variação: quanto a agulha é amortecida (suave: 0 = mostra cada tremida, 0,9 = só a tendência) */
  var PRESETS = { estavel: { rms: 0.01, suave: 0.92 }, normal: { rms: 0.01, suave: 0.75 }, sensivel: { rms: 0.01, suave: 0.35 } };
  var SENS = PRESETS.normal;
  var modo = "cromatico", historico = [], suave = null, mapa = {}, oitavas = { a: null, b: null };

  /* limiar de ruído ajustável (como o AP Tuner): sons mais fracos que a marca são ignorados */
  var limiarDb = -40;
  function limiarRms() { return Math.pow(10, limiarDb / 20); }
  function nivel(rms) {
    var db = 20 * Math.log10(rms || 1e-9), pct = function (v) { return Math.max(0, Math.min(100, (v + 70) / 55 * 100)); };
    var el = $("af-nivel"); if (el) { el.style.width = pct(db) + "%"; el.style.background = db < limiarDb ? "#b9ad93" : "#2D4839"; }
  }
  function marcarLimiar() { var m = $("af-limiar-marca"); if (m) m.style.left = Math.max(0, Math.min(100, (limiarDb + 70) / 55 * 100)) + "%"; }

  /* Harmônicos: força de cada harmônico (1 a 8) em relação à fundamental, medida por DFT com janela de Hann
     exatamente nas frequências k·f0 (busca fina de ±40 cents, porque a fundamental medida tem pequeno erro). */
  var harm = null, harmRef = null, hann = null;
  function forcaEm(x, sr, f) {
    var w = 2 * Math.PI * f / sr, re = 0, im = 0;
    for (var n = 0; n < x.length; n++) { var v = x[n] * hann[n]; re += v * Math.cos(w * n); im -= v * Math.sin(w * n); }
    return Math.sqrt(re * re + im * im);
  }
  function harmonicos(x, sr, f0) {
    if (!hann || hann.length !== x.length) { hann = new Float32Array(x.length); for (var n = 0; n < x.length; n++) hann[n] = 0.5 - 0.5 * Math.cos(2 * Math.PI * n / (x.length - 1)); }
    var res = [];
    for (var k = 1; k <= 8; k++) {
      if (k * f0 > sr / 2 - 200) break;
      var melhor = 0;
      for (var c = -40; c <= 40; c += 10) melhor = Math.max(melhor, forcaEm(x, sr, k * f0 * Math.pow(2, c / 1200)));
      res.push(melhor);
    }
    var base = res[0] || 1e-9;
    return res.map(function (a) { return 20 * Math.log10((a || 1e-9) / base); });
  }
  function desenharHarm() {
    var cv = $("af-harm"); if (!cv) return;
    var estreito = cv.clientWidth > 0 && cv.clientWidth < 560;
    if (cv.width !== (estreito ? 420 : 800)) { cv.width = estreito ? 420 : 800; cv.height = estreito ? 260 : 220; }
    var g = cv.getContext("2d"), w = cv.width, h = cv.height, topo = 22, base = h - 26, n = 8, esq = 64, larg = (w - esq) / n;
    g.clearRect(0, 0, w, h);
    g.font = "15px system-ui, sans-serif"; g.textAlign = "center";
    [0, -20, -40, -60].forEach(function (db) {
      var y = topo + (-db / 60) * (base - topo);
      g.strokeStyle = "#e3dac6"; g.lineWidth = 1; g.beginPath(); g.moveTo(esq, y); g.lineTo(w, y); g.stroke();
      g.fillStyle = "#8a7f6a"; g.textAlign = "right"; g.fillText(String(db).replace("-", "−") + " dB", esq - 8, y + 5); g.textAlign = "center";
    });
    for (var k = 0; k < n; k++) {
      var cx = esq + larg * k + larg / 2;
      [[harmRef, "rgba(126,42,94,.28)", -larg * 0.16], [harm, "#7E2A5E", larg * 0.16]].forEach(function (p) {
        if (!p[0] || p[0][k] == null) return;
        var db = Math.max(-60, Math.min(0, p[0][k])), y = topo + (-db / 60) * (base - topo);
        g.fillStyle = p[1]; g.fillRect(cx + p[2] - larg * 0.14, y, larg * 0.28, base - y);
      });
      g.fillStyle = "#3b3226"; g.fillText(String(k + 1), cx, h - 8);
    }
  }
  function fmtDb(v) { var r = Math.round(v); return (r < 0 ? "−" : "") + Math.abs(r); }
  function textoHarm() {
    if (!harm) return;
    var h2 = harm[1], h3 = harm[2], t = "2º harmônico " + (h2 == null ? "—" : fmtDb(h2) + " dB") + ", 3º " + (h3 == null ? "—" : fmtDb(h3) + " dB") + " em relação à fundamental. ";
    t += h2 == null ? "" : h2 > -12 ? "Som cheio e brilhante." : h2 > -25 ? "Som equilibrado." : "Som doce ou soproso (harmônicos fracos).";
    if (harmRef && harmRef[1] != null && h2 != null) {
      var d = h2 - harmRef[1];
      t += " Comparado ao som guardado: 2º harmônico " + (Math.round(d) > 0 ? "+" : "") + fmtDb(d) + " dB" + (Math.round(d) === 0 ? " (igual)." : ".");
    }
    $("af-harm-res").textContent = t;
  }

  function la() { return parseFloat(($("pc-la") || {}).value) || 440; }
  function midiDeFreq(f) { return 69 + 12 * Math.log2(f / la()); }
  function freqDeMidi(m) { return la() * Math.pow(2, (m - 69) / 12); }
  function nome(m) { return NOMES[((m % 12) + 12) % 12] + " " + (Math.floor(m / 12) - 1); }
  function cents(f, m) { return 1200 * Math.log2(f / freqDeMidi(m)); }

  /* YIN: diferença quadrática, média cumulativa normalizada, primeiro mínimo abaixo do limiar, interpolação. */
  function yin(x, sr) {
    var meio = Math.floor(x.length / 2), d = new Float32Array(meio), tauMin = Math.floor(sr / 3200), tauMax = Math.min(meio - 1, Math.floor(sr / 180));
    var rms = 0;
    for (var i = 0; i < x.length; i++) rms += x[i] * x[i];
    rms = Math.sqrt(rms / x.length);
    nivel(rms);
    if (rms < limiarRms()) return null;
    for (var tau = 1; tau <= tauMax; tau++) {
      var soma = 0;
      for (var j = 0; j < meio; j++) { var dif = x[j] - x[j + tau]; soma += dif * dif; }
      d[tau] = soma;
    }
    d[0] = 1;
    var acum = 0;
    for (tau = 1; tau <= tauMax; tau++) { acum += d[tau]; d[tau] = d[tau] * tau / (acum || 1); }
    var achado = -1;
    for (tau = tauMin; tau <= tauMax; tau++) {
      if (d[tau] < 0.12) { while (tau + 1 <= tauMax && d[tau + 1] < d[tau]) tau++; achado = tau; break; }
    }
    if (achado < 0) return null;
    var t0 = achado;
    if (t0 > 1 && t0 < tauMax) {
      var a = d[t0 - 1], b = d[t0], c = d[t0 + 1], den = a + c - 2 * b;
      if (den) t0 = t0 + (a - c) / (2 * den);
    }
    return { f: sr / t0, confianca: 1 - d[achado] };
  }

  /* notas do pife calculado: a escala maior do tom, nas 3 oitavas, com o furo que dá cada uma */
  function notasDoPife() {
    var tom = P.TONS.filter(function (t) { return t.id === $("pc-tom").value; })[0];
    var lista = [];
    for (var o = 0; o < 3; o++) {
      ESCALA.forEach(function (st, k) {
        lista.push({ midi: tom.midi + 12 * o + st, oitava: o + 1, furo: k, chave: (tom.midi + 12 * o + st) });
      });
    }
    lista.push({ midi: tom.midi + 36, oitava: 4, furo: 0, chave: tom.midi + 36 });
    return lista;
  }

  function ponteiro(c) {
    var lim = Math.max(-50, Math.min(50, c)), cor = Math.abs(c) <= 5 ? "#2D4839" : Math.abs(c) <= 15 ? "#D9A33A" : "#9A3B1F";
    $("af-agulha").style.left = (50 + lim) + "%";
    $("af-agulha").style.background = cor;
    $("af-cents").textContent = (c > 0 ? "+" : "") + Math.round(c) + " cents";
    $("af-cents").style.color = cor;
    $("af-dica").textContent = Math.abs(c) <= 5 ? "Afinada" : c > 0 ? "Alta: a nota está acima" : "Baixa: a nota está abaixo";
  }

  function desenharHistorico() {
    var cv = $("af-graf"), g = cv.getContext("2d"), w = cv.width, h = cv.height;
    g.clearRect(0, 0, w, h);
    g.strokeStyle = "#b9ad93"; g.lineWidth = 1;
    [-25, 0, 25].forEach(function (c) { var y = h / 2 - c / 50 * (h / 2); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); });
    g.strokeStyle = "#7E2A5E"; g.lineWidth = 2; g.beginPath();
    historico.forEach(function (c, k) {
      var x = w - (historico.length - k) * (w / 200), y = h / 2 - Math.max(-50, Math.min(50, c)) / 50 * (h / 2);
      if (k === 0 || historico[k - 1] === null || c === null) g.moveTo(x, y); else g.lineTo(x, y);
    });
    g.stroke();
  }

  function mostrarMapa() {
    var notas = notasDoPife(), linhas = {};
    notas.forEach(function (n) { (linhas[n.furo] = linhas[n.furo] || {})[n.oitava] = n; });
    var furosNome = ["1ª nota da escala (tom)", "2ª nota", "3ª nota", "4ª nota", "5ª nota", "6ª nota", "7ª nota"];
    var html = "<thead><tr><th scope=\"col\">Nota</th><th scope=\"col\">1ª oitava</th><th scope=\"col\">2ª oitava</th><th scope=\"col\">3ª oitava</th></tr></thead><tbody>";
    for (var f = 0; f < 7; f++) {
      html += "<tr><th scope=\"row\">" + furosNome[f] + "</th>";
      for (var o = 1; o <= 3; o++) {
        var n = linhas[f] && linhas[f][o], v = n ? mapa[n.chave] : null;
        var cor = v == null ? "" : Math.abs(v) <= 5 ? "#2D4839" : Math.abs(v) <= 15 ? "#b9861f" : "#9A3B1F";
        html += "<td>" + (n ? nome(n.midi) : "") + (v == null ? ' <span class="pc-mini">—</span>' : ' <b style="color:' + cor + '">' + (v > 0 ? "+" : "") + Math.round(v) + "</b>") + "</td>";
      }
      html += "</tr>";
    }
    $("af-mapa").innerHTML = html + "</tbody>";
  }

  var quadroN = 0;
  var estavel = { midi: null, n: 0, soma: 0 };
  function registrar(m, c) {
    /* uma nota segurada uns 0,6 s entra no mapa com a média dos cents */
    if (estavel.midi === m) { estavel.n++; estavel.soma += c; } else { estavel = { midi: m, n: 1, soma: c }; }
    if (estavel.n === 18) { mapa[m] = estavel.soma / estavel.n; mostrarMapa(); }
  }

  function quadro() {
    if (!rodando) return;
    analisador.getFloatTimeDomainData(buf);
    var r = yin(buf, ctx.sampleRate);
    if (r && r.confianca > 0.8) {
      suave = suave == null ? r.f : suave * SENS.suave + r.f * (1 - SENS.suave);
      var m = Math.round(midiDeFreq(suave)), alvo = m;
      if (modo === "pife") {
        var notas = notasDoPife(), melhor = null;
        notas.forEach(function (n) { if (melhor == null || Math.abs(n.midi - midiDeFreq(suave)) < Math.abs(melhor.midi - midiDeFreq(suave))) melhor = n; });
        alvo = melhor.midi;
        $("af-nota-sub").textContent = melhor.oitava + "ª oitava · " + ["tudo fechado", "furo 1 aberto", "furos 1 e 2 abertos", "furos 1 a 3 abertos", "furos 1 a 4 abertos", "furos 1 a 5 abertos", "tudo aberto"][melhor.furo];
      } else { $("af-nota-sub").textContent = ""; }
      var c = cents(suave, alvo);
      $("af-nota").textContent = nome(alvo);
      $("af-hz").textContent = suave.toFixed(1).replace(".", ",") + " Hz";
      ponteiro(c);
      historico.push(c);
      if (modo === "pife" && Math.abs(c) < 50) registrar(alvo, c);
      if (modo === "oitavas") oitavasQuadro(suave);
      if (modo === "harm" && (quadroN++ % 4 === 0)) {
        var hh = harmonicos(buf, ctx.sampleRate, r.f);
        harm = harm && harm.length === hh.length ? harm.map(function (v, i) { return v * 0.7 + hh[i] * 0.3; }) : hh;
        desenharHarm(); textoHarm();
      }
    } else {
      suave = null; historico.push(null);
      estavel = { midi: null, n: 0, soma: 0 };
    }
    if (historico.length > 200) historico.shift();
    desenharHistorico();
    requestAnimationFrame(quadro);
  }

  /* Oitavas: toque a nota grave e depois a mesma posição na 2ª oitava; mostra quantos cents a 2ª está acima ou
     abaixo de uma oitava perfeita (o teste da rolha). */
  var ultimaEstavel = { f: null, n: 0 };
  function oitavasQuadro(f) {
    if (ultimaEstavel.f && Math.abs(1200 * Math.log2(f / ultimaEstavel.f)) < 30) ultimaEstavel.n++; else ultimaEstavel = { f: f, n: 1 };
    if (ultimaEstavel.n !== 20) return;
    if (!oitavas.a || (oitavas.a && oitavas.b)) { oitavas = { a: f, b: null }; }
    else if (f > oitavas.a * 1.6) { oitavas.b = f; }
    var txt = "Nota grave: " + (oitavas.a ? nome(Math.round(midiDeFreq(oitavas.a))) + " (" + oitavas.a.toFixed(1).replace(".", ",") + " Hz)" : "—");
    if (oitavas.b) {
      var dif = 1200 * Math.log2(oitavas.b / (2 * oitavas.a));
      txt += ". 2ª oitava: " + (dif > 0 ? "+" : "") + Math.round(dif) + " cents em relação à oitava perfeita. " +
        (Math.abs(dif) <= 5 ? "Oitava afinada." : dif > 0 ? "2ª oitava alta: afaste um pouco a rolha do sopro." : "2ª oitava baixa: aproxime um pouco a rolha do sopro (ou use cabeça cônica / undercut).");
    } else { txt += ". Agora toque a mesma posição na 2ª oitava."; }
    $("af-oitavas").textContent = txt;
  }

  $("af-ligar").addEventListener("click", function () {
    if (rodando) { parar(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $("af-erro").textContent = "Este navegador não deixa usar o microfone."; return; }
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(function (s) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      fonte = ctx.createMediaStreamSource(s);
      analisador = ctx.createAnalyser(); analisador.fftSize = 4096;
      buf = new Float32Array(analisador.fftSize);
      fonte.connect(analisador);
      rodando = true; $("af-ligar").textContent = "Desligar o afinador"; $("af-erro").textContent = "";
      fonte._stream = s;
      requestAnimationFrame(quadro);
    }).catch(function () { $("af-erro").textContent = "Não foi possível usar o microfone. Permita o acesso ao microfone no navegador e tente de novo."; });
  });
  function parar() {
    rodando = false;
    if (fonte && fonte._stream) fonte._stream.getTracks().forEach(function (t) { t.stop(); });
    if (ctx) ctx.close();
    $("af-ligar").textContent = "Ligar o afinador";
  }

  document.querySelectorAll("[name=af-modo]").forEach(function (r) {
    r.addEventListener("change", function () {
      modo = r.value;
      $("af-painel-pife").hidden = modo !== "pife";
      $("af-painel-oitavas").hidden = modo !== "oitavas";
      $("af-painel-ref").hidden = modo !== "ref";
      if ($("af-painel-harm")) { $("af-painel-harm").hidden = modo !== "harm"; desenharHarm(); }
      if (modo === "pife") mostrarMapa();
    });
  });
  document.querySelectorAll("[name=af-sens]").forEach(function (r) {
    r.addEventListener("change", function () { SENS = PRESETS[r.value]; try { localStorage.setItem("pifeCalc.afSens", r.value); } catch (x) { /* sem armazenamento */ } });
  });
  try { var salvo = localStorage.getItem("pifeCalc.afSens"); if (salvo && PRESETS[salvo]) { SENS = PRESETS[salvo]; document.querySelector("[name=af-sens][value=" + salvo + "]").checked = true; } } catch (x) { /* padrão */ }
  $("af-limpar").addEventListener("click", function () { mapa = {}; mostrarMapa(); });
  if ($("af-limiar")) {
    try { var lim = parseFloat(localStorage.getItem("pifeCalc.afLimiar")); if (lim >= -70 && lim <= -15) { limiarDb = lim; $("af-limiar").value = lim; } } catch (x) { /* padrão */ }
    $("af-limiar").addEventListener("input", function () {
      limiarDb = parseFloat($("af-limiar").value); marcarLimiar();
      try { localStorage.setItem("pifeCalc.afLimiar", String(limiarDb)); } catch (x) { /* sem armazenamento */ }
    });
    marcarLimiar();
  }
  if ($("af-harm-guardar")) {
    $("af-harm-guardar").addEventListener("click", function () {
      if (!harm) { $("af-harm-res").textContent = "Ligue o afinador e toque uma nota antes de guardar."; return; }
      harmRef = harm.slice(); $("af-harm-esquecer").hidden = false; desenharHarm(); textoHarm();
    });
    $("af-harm-esquecer").addEventListener("click", function () { harmRef = null; $("af-harm-esquecer").hidden = true; desenharHarm(); textoHarm(); });
  }

  /* nota de referência: um som suave na nota escolhida */
  function preencherRef() {
    var sel = $("af-ref-nota"), notas = notasDoPife(), atual = sel.value;
    sel.innerHTML = notas.map(function (n) { return '<option value="' + n.midi + '">' + nome(n.midi) + " (" + n.oitava + "ª oitava)</option>"; }).join("");
    if (atual) sel.value = atual;
  }
  $("af-ref-tocar").addEventListener("click", function () {
    if (osc) { osc.stop(); osc = null; $("af-ref-tocar").textContent = "Tocar nota de referência"; return; }
    var c2 = ctx && ctx.state !== "closed" ? ctx : new (window.AudioContext || window.webkitAudioContext)();
    osc = c2.createOscillator(); var g = c2.createGain();
    osc.type = "triangle"; osc.frequency.value = freqDeMidi(parseInt($("af-ref-nota").value, 10)); g.gain.value = 0.15;
    osc.connect(g); g.connect(c2.destination); osc.start();
    $("af-ref-tocar").textContent = "Parar";
  });
  ["pc-tom", "pc-la"].forEach(function (id) { $(id).addEventListener("change", function () { mapa = {}; mostrarMapa(); preencherRef(); }); });
  preencherRef(); mostrarMapa();
})();
