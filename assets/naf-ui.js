/* Calculadora de Flauta NAF: interface (modo ao lado do Pífano). Tudo roda no navegador; nada é enviado.
   Tabela, desenho, cartões do celular e molde 1:1 consomem o MESMO objeto devolvido por NafCalc.calcular(). */
(function () {
  "use strict";
  var N = window.NafCalc;
  if (!N) return;
  var $ = function (id) { return document.getElementById(id); };
  var mm = function (v, d) { return v.toFixed(d === undefined ? 1 : d).replace(".", ","); };
  var CHAVE = "nafCalc.v1";
  var CAMPOS = { a4: "naf-a4", temperatura: "naf-temp", diametroExterno: "naf-od", parede: "naf-parede", janelaCompr: "naf-jc",
    janelaLarg: "naf-jl", janelaAltura: "naf-ja", cabeca: "naf-cabeca", ponta: "naf-ponta", fundamental: "naf-fund", furos: "naf-furos" };
  var linhas = [];       /* estado das linhas (do pé para a boca): {nota, hz, d, a}; hz vazio = derivado da nota */
  var manualDim = false; /* a pessoa mexeu nas medidas: não reaplicar as sugestões sozinho */
  var ultimo = null;     /* último resultado válido (mesmo objeto para tabela, desenho e molde) */

  /* ---- seletor de modo (abas) ---- */
  var abaPife = $("modo-aba-pife"), abaNaf = $("modo-aba-naf");
  function modoNaf() { return /(^|[?&])modo=naf(&|$)/.test(location.search); }
  function mostrarModo(naf) {
    window.__modoNaf = naf;
    $("modo-pife").hidden = naf; $("modo-naf").hidden = !naf;
    document.body.classList.toggle("modo-naf", naf);
    [[abaPife, !naf], [abaNaf, naf]].forEach(function (p) { p[0].setAttribute("aria-selected", p[1] ? "true" : "false"); p[0].tabIndex = p[1] ? 0 : -1; });
    var h1 = document.querySelector(".ph h1");
    if (h1) h1.textContent = naf ? "Calculadora de flauta NAF" : "Calculadora de pife";
    var lead = document.querySelector(".ph p");
    if (lead) { if (!lead.getAttribute("data-pife")) lead.setAttribute("data-pife", lead.textContent);
      lead.textContent = naf ? "Onde furar a sua flauta nativa americana de 5 ou 6 furos. Informe o tubo, a janela e a nota, e a calculadora mostra a posição de cada furo, desenha a flauta e gera um molde em tamanho real para imprimir." : lead.getAttribute("data-pife"); }
    document.title = naf ? "Calculadora de flauta NAF · Igor Bastos" : "Calculadora de pife · Igor Bastos";
  }
  function trocarModo(naf) {
    if (naf === !$("modo-naf").hidden) return;
    mostrarModo(naf);
    if (naf) { history.pushState(null, "", location.pathname + "?modo=naf" + (hashNaf || "")); atualizar(); }
    else history.pushState(null, "", location.pathname + (window.__pifeHash || ""));
  }
  var hashNaf = null;
  [abaPife, abaNaf].forEach(function (b) {
    b.addEventListener("click", function () { trocarModo(b === abaNaf); });
    b.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowRight" || ev.key === "ArrowLeft" || ev.key === "Home" || ev.key === "End") {
        ev.preventDefault();
        var alvo = ev.key === "ArrowRight" || ev.key === "End" ? abaNaf : abaPife; alvo.focus(); trocarModo(alvo === abaNaf);
      }
    });
  });

  /* ---- campos ---- */
  var sel = $("naf-fund");
  for (var m = N.MIDI_MIN; m <= N.MIDI_MAX; m++) {
    var o = document.createElement("option"); o.value = N.nomeEn(m); o.textContent = N.nomePt(m) + " (" + N.nomeEn(m) + ")"; sel.appendChild(o);
  }
  var dl = $("naf-notas");
  for (m = 55; m <= 96; m++) { var op = document.createElement("option"); op.value = N.nomePt(m); dl.appendChild(op); }

  function midiFund() { return N.parseNota($("naf-fund").value); }
  function nFuros() { return parseInt($("naf-furos").value, 10) === 5 ? 5 : 6; }

  function sugestao() { return N.sugerir({ furos: nFuros(), midi: midiFund(), a4: parseFloat($("naf-a4").value) || 440 }); }
  function derivarInterno() {
    if (document.activeElement === $("naf-di")) return; /* não reescreve o campo enquanto a pessoa digita nele */
    var od = parseFloat($("naf-od").value), p = parseFloat($("naf-parede").value);
    $("naf-di").value = isFinite(od) && isFinite(p) ? (Math.round((od - 2 * p) * 100) / 100) : "";
  }
  function aplicarMedidas(s) {
    $("naf-od").value = s.diametroExterno; $("naf-parede").value = s.parede; $("naf-jc").value = s.janelaCompr; $("naf-jl").value = s.janelaLarg;
    $("naf-ja").value = s.janelaAltura; $("naf-cabeca").value = s.cabeca; $("naf-ponta").value = s.ponta; derivarInterno();
  }
  function notasEscala() {
    return N.escala("pentatonica-menor", midiFund(), nFuros()).map(N.nomePt);
  }
  /* reconstrói as linhas para o número de furos atual: sem sobras escondidas (linhas extras são descartadas) */
  function montarLinhas(preservar) {
    var n = nFuros(), s = sugestao(), pent = $("naf-escala").value === "pentatonica-menor", notas = notasEscala(), novo = [];
    for (var k = 0; k < n; k++) {
      var velho = preservar && linhas[k];
      novo.push({ nota: pent || !velho ? notas[k] : velho.nota, hz: pent || !velho ? "" : velho.hz,
        d: velho && manualDim ? velho.d : s.diametros[k], a: velho ? velho.a : true });
    }
    linhas = novo; desenharLinhas();
  }
  function sugerirTudo() { manualDim = false; aplicarMedidas(sugestao()); montarLinhas(false); }

  /* NAF de 6 furos na pentatônica: o 4º furo contado do pé é o extra, fora da escala (Flutopedia, Basic-Six) */
  function ehExtra(k) { return nFuros() === 6 && $("naf-escala").value === "pentatonica-menor" && N.FURO_EXTRA[6] === k; }
  var TEXTO_EXTRA = " Furo extra: fora da pentatônica (sugestão: 6ª menor, +8 semitons; é o Ré do exemplo em Fá# menor da Flutopedia). Na digitação principal ele fica fechado. Pode editar a nota ou os Hz.";

  function desenharLinhas() {
    var cx = $("naf-linhas"); cx.innerHTML = "";
    linhas.forEach(function (l, k) {
      var div = document.createElement("div"); div.className = "naf-lin"; div.setAttribute("role", "group"); div.setAttribute("aria-label", "Furo " + (k + 1));
      div.innerHTML = '<label class="naf-ativo"><input type="checkbox" data-k="' + k + '" data-c="a"> <b>Furo ' + (k + 1) + '<span class="naf-xt" data-k="' + k + '"></span></b></label>' +
        '<label>Nota-alvo<input type="text" list="naf-notas" autocomplete="off" data-k="' + k + '" data-c="nota"></label>' +
        '<label>Frequência (Hz)<input type="text" inputmode="decimal" autocomplete="off" data-k="' + k + '" data-c="hz"></label>' +
        '<label>Ø do furo (mm)<input type="number" min="1" max="40" step="0.5" data-k="' + k + '" data-c="d"></label>' +
        '<small class="naf-info" data-k="' + k + '"></small>';
      cx.appendChild(div);
      div.querySelector('[data-c="a"]').checked = l.a; div.querySelector('[data-c="nota"]').value = l.nota;
      div.querySelector('[data-c="hz"]').value = l.hz; div.querySelector('[data-c="d"]').value = l.d;
    });
  }

  /* ---- leitura do formulário (valores crus; a validação é do motor) ---- */
  function lerEntrada() {
    return {
      furos: nFuros(), escala: $("naf-escala").value, fundamental: $("naf-fund").value, a4: $("naf-a4").value, temperatura: $("naf-temp").value,
      diametroExterno: $("naf-od").value, parede: $("naf-parede").value, janelaCompr: $("naf-jc").value, janelaLarg: $("naf-jl").value,
      janelaAltura: $("naf-ja").value, cabeca: $("naf-cabeca").value, ponta: $("naf-ponta").value,
      linhas: linhas.map(function (l) { return { nota: l.nota, hz: l.hz, diametro: l.d, ativo: l.a }; })
    };
  }
  function estadoLink() {
    return { f: nFuros(), fu: $("naf-fund").value, es: $("naf-escala").value, a4: $("naf-a4").value, t: $("naf-temp").value, od: $("naf-od").value,
      p: $("naf-parede").value, jc: $("naf-jc").value, jl: $("naf-jl").value, ja: $("naf-ja").value, c: $("naf-cabeca").value, po: $("naf-ponta").value,
      m: manualDim ? 1 : 0, l: linhas.map(function (l) { return [l.nota, l.hz, l.d, l.a ? 1 : 0]; }) };
  }
  function aplicarLink(s) {
    if (!s || typeof s !== "object" || !s.fu) return false;
    $("naf-furos").value = s.f === 5 ? "5" : "6"; $("naf-fund").value = s.fu; if (!$("naf-fund").value) $("naf-fund").value = "G4";
    $("naf-escala").value = s.es === "personalizada" ? "personalizada" : "pentatonica-menor";
    $("naf-a4").value = s.a4; $("naf-temp").value = s.t;
    $("naf-od").value = s.od; $("naf-parede").value = s.p; $("naf-jc").value = s.jc; $("naf-jl").value = s.jl; $("naf-ja").value = s.ja;
    $("naf-cabeca").value = s.c; $("naf-ponta").value = s.po; derivarInterno(); manualDim = !!s.m;
    var n = nFuros(), l = Array.isArray(s.l) ? s.l.slice(0, n) : [];
    linhas = []; for (var k = 0; k < n; k++) { var x = l[k] || ["", "", "", 1]; linhas.push({ nota: String(x[0]), hz: String(x[1] === null ? "" : x[1]), d: x[2], a: x[3] !== 0 }); }
    desenharLinhas(); return true;
  }

  /* ---- desenho (SVG) ---- */
  function cota(x1, x2, y, texto, cor, dy) {
    var m = (x1 + x2) / 2, s = '<g stroke="' + cor + '" stroke-width="1.2"><line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '"/>' +
      '<line x1="' + x1 + '" y1="' + (y - 5) + '" x2="' + x1 + '" y2="' + (y + 5) + '"/><line x1="' + x2 + '" y1="' + (y - 5) + '" x2="' + x2 + '" y2="' + (y + 5) + '"/></g>';
    return s + '<text x="' + m + '" y="' + (y - 4 - (dy || 0)) + '" text-anchor="middle" font-size="12" fill="' + cor + '">' + texto + '</text>';
  }
  function desenho(r) {
    var e = r.entrada, W = 1000, x0 = 30, L = r.comprimentoFisico, esc = (W - x0 - 40) / L;
    var X = function (p) { return x0 + (L - p) * esc; }; /* p = distância ao pé; cabeça à esquerda, pé à direita */
    var ext = e.diametroExterno, h = ext * esc, hi = r.diametroInterno * esc, topo = 52, cy = topo + h / 2, base = cy + h / 2;
    var xpe = X(0), xj = X(r.janelaDoPe), s = "";
    s += '<rect x="' + x0 + '" y="' + (cy - h / 2) + '" width="' + (xpe - x0) + '" height="' + h + '" rx="2" fill="#D9A33A" stroke="#7a5a1c" stroke-width="2"/>';
    s += '<rect x="' + x0 + '" y="' + (cy - hi / 2) + '" width="' + (xpe - x0) + '" height="' + hi + '" fill="#f0c56a"/>';
    s += '<g stroke="#7a5a1c" stroke-width="1" stroke-dasharray="5 4"><line x1="' + x0 + '" y1="' + (cy - hi / 2) + '" x2="' + xpe + '" y2="' + (cy - hi / 2) + '"/><line x1="' + x0 + '" y1="' + (cy + hi / 2) + '" x2="' + xpe + '" y2="' + (cy + hi / 2) + '"/></g>';
    /* janela: comprimento ao longo do tubo, largura atravessando (limitada à altura do tubo no desenho) */
    var wj = Math.min(e.janelaLarg, ext) * esc, lj = e.janelaCompr * esc;
    s += '<rect x="' + (xj - lj / 2) + '" y="' + (cy - wj / 2) + '" width="' + lj + '" height="' + wj + '" fill="#2D4839"/>';
    s += '<line x1="' + xj + '" y1="' + 20 + '" x2="' + xj + '" y2="' + (base + 6) + '" stroke="#9A3B1F" stroke-width="1.2" stroke-dasharray="4 3"/>';
    s += '<text x="' + xj + '" y="' + 14 + '" text-anchor="middle" font-size="12" fill="#9A3B1F">centro da janela</text>';
    var xs = [];
    var nivelAlto = false;
    r.furos.forEach(function (f, i) {
      var x = X(f.doPe); xs.push(x);
      s += '<circle cx="' + x + '" cy="' + cy + '" r="' + (f.diametro * esc / 2) + '" fill="#2D4839"/>';
      s += '<g stroke="#f6efe2" stroke-width="1"><line x1="' + (x - 4) + '" y1="' + cy + '" x2="' + (x + 4) + '" y2="' + cy + '"/><line x1="' + x + '" y1="' + (cy - 4) + '" x2="' + x + '" y2="' + (cy + 4) + '"/></g>';
      /* notas de furos vizinhos muito juntos sobem um nível para não se sobrepor */
      var sobe = i > 0 && Math.abs(x - xs[i - 1]) < 52 && !nivelAlto;
      nivelAlto = sobe;
      s += '<text x="' + x + '" y="' + (topo - 14 - (sobe ? 14 : 0)) + '" text-anchor="middle" font-size="13" fill="#7E2A5E">' + f.nota + '</text>';
      s += '<text x="' + x + '" y="' + (base + 16) + '" text-anchor="middle" font-size="14" fill="#2D4839">' + f.linha + '</text>';
    });
    var y = base + 26;
    /* entre centros de furos vizinhos (rótulos alternados em altura para não se sobreporem) */
    for (var i = 1; i < r.furos.length; i++) s += cota(xs[i], xs[i - 1], y + 14, mm(r.furos[i].espacoAbaixo), "#7E2A5E", i % 2 ? 0 : 13);
    y += 34;
    /* até o pé: uma cota por furo, do centro do furo à ponta do pé */
    r.furos.forEach(function (f, k) { s += cota(xpe, xs[k], y + 14 + k * 18, "furo " + f.linha + " · " + f.nota + ": " + mm(f.doPe), "#2D4839"); });
    y += 18 * r.furos.length + 8;
    s += cota(xpe, xj, y + 14, "centro da janela ao pé: " + mm(r.janelaDoPe), "#9A3B1F"); y += 26;
    s += cota(xpe, X(L), y + 14, "comprimento total estimado: " + mm(L), "#7a5a1c"); y += 30;
    s += '<text x="' + (x0) + '" y="' + (y + 12) + '" font-size="12" fill="#444">Todas as medidas dos furos e da janela são até o CENTRO (não até a borda). Posições calculadas pelo modelo.</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + (y + 26) + '" role="img" aria-label="Desenho da flauta NAF com a janela, os furos e as medidas até o pé">' + s + '</svg>';
  }

  /* ---- molde 1:1: páginas A4 em pé, régua de 100 mm, distância ao pé crescendo para baixo ---- */
  function molde(r) {
    var e = r.entrada, L = r.comprimentoFisico, passo = 230, ini = -10, fim = L + 10, paginas = "", n = 1;
    var marcas = [{ p: 0, d: 0, t: "PÉ (ponta do tubo): 0 mm" }];
    r.furos.forEach(function (f) { marcas.push({ p: f.doPe, d: f.diametro, t: "Furo " + f.linha + " · " + f.nota + " · Ø " + mm(f.diametro) + " (centro)" }); });
    marcas.push({ p: r.janelaDoPe, janela: true, t: "CENTRO DA JANELA " + mm(e.janelaCompr) + " × " + mm(e.janelaLarg) });
    marcas.push({ p: L, d: 0, t: "CABEÇA (ponta): cortar aqui" });
    var tx = Math.max(84, 60 + e.diametroExterno / 2 + 6);
    for (var a = ini; a < fim; a += passo, n++) {
      var b = a + passo + 10, s = '<svg xmlns="http://www.w3.org/2000/svg" width="180mm" height="270mm" viewBox="0 0 180 270">';
      var Y = function (p) { return 25 + (p - a); };
      s += '<text x="5" y="8" font-size="4">Calculadora de flauta NAF · igorbastosluthier.com.br · ' + mm(e.janelaCompr) + ' mm de janela · página ' + n + '</text>';
      s += '<text x="5" y="14" font-size="3.2">A régua abaixo deve ter 100 mm (10 cm). Se não tiver, imprima em tamanho real (100%, sem ajustar à página).</text>';
      s += '<line x1="5" y1="18" x2="105" y2="18" stroke="#000" stroke-width=".4"/>';
      for (var k = 0; k <= 100; k += 10) s += '<line x1="' + (5 + k) + '" y1="16" x2="' + (5 + k) + '" y2="20" stroke="#000" stroke-width=".3"/>';
      s += '<text x="108" y="19" font-size="3">100 mm</text>';
      s += '<line x1="60" y1="' + Y(Math.max(a, ini)) + '" x2="60" y2="' + Y(Math.min(b, fim)) + '" stroke="#000" stroke-width=".4"/>';
      s += '<rect x="' + (60 - e.diametroExterno / 2) + '" y="' + Y(Math.max(a, 0)) + '" width="' + e.diametroExterno + '" height="' + Math.max(0, Y(Math.min(b, L)) - Y(Math.max(a, 0))) + '" fill="none" stroke="#999" stroke-width=".25" stroke-dasharray="1 1"/>';
      for (var q = Math.ceil(a / 10) * 10; q <= b; q += 10) {
        var big = q % 50 === 0;
        s += '<line x1="' + (big ? 24 : 27) + '" y1="' + Y(q) + '" x2="30" y2="' + Y(q) + '" stroke="#000" stroke-width=".25"/>';
        if (big) s += '<text x="22" y="' + (Y(q) + 1.2) + '" font-size="3" text-anchor="end">' + q + '</text>';
      }
      marcas.forEach(function (mk) {
        if (mk.p < a || mk.p > b) return;
        var y = Y(mk.p);
        s += '<line x1="' + (60 - Math.max(20, e.diametroExterno / 2 + 4)) + '" y1="' + y + '" x2="' + (60 + Math.max(20, e.diametroExterno / 2 + 4)) + '" y2="' + y + '" stroke="#000" stroke-width=".3"/>';
        if (mk.janela) s += '<rect x="' + (60 - Math.min(e.janelaLarg, e.diametroExterno) / 2) + '" y="' + (y - e.janelaCompr / 2) + '" width="' + Math.min(e.janelaLarg, e.diametroExterno) + '" height="' + e.janelaCompr + '" fill="none" stroke="#000" stroke-width=".3"/>';
        else if (mk.d) s += '<circle cx="60" cy="' + y + '" r="' + (mk.d / 2) + '" fill="none" stroke="#000" stroke-width=".3"/><line x1="58" y1="' + y + '" x2="62" y2="' + y + '" stroke="#000" stroke-width=".25"/><line x1="60" y1="' + (y - 2) + '" x2="60" y2="' + (y + 2) + '" stroke="#000" stroke-width=".25"/>';
        s += '<text x="' + tx + '" y="' + (y + 1.2) + '" font-size="3.6">' + mk.t + ' · ' + mm(mk.p) + ' mm do pé</text>';
      });
      if (b < fim) s += '<text x="5" y="' + Y(b) + '" font-size="3">✂ emendar com a próxima página nesta linha</text><line x1="0" y1="' + Y(b) + '" x2="180" y2="' + Y(b) + '" stroke="#000" stroke-dasharray="2 2" stroke-width=".3"/>';
      paginas += '<div class="pc-pag">' + s + '</svg></div>';
    }
    return paginas;
  }

  /* ---- resultado ---- */
  function selo(rz) {
    if (rz === null) return '<span class="pc-selo" style="--c:#9A3B1F">● indisponível</span>';
    var c = rz >= 2 ? ["#2D4839", "Bom"] : rz >= 1.5 ? ["#D9A33A", "Limitado"] : ["#9A3B1F", "Crítico"];
    return '<span class="pc-selo" style="--c:' + c[0] + '">● ' + c[1] + ' · ' + mm(rz, 2) + '</span>';
  }
  function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  function marcarErros(erros) {
    Object.keys(CAMPOS).forEach(function (c) { var el = $(CAMPOS[c]); if (el) el.removeAttribute("aria-invalid"); });
    document.querySelectorAll("#naf-linhas input").forEach(function (i) { i.removeAttribute("aria-invalid"); });
    (erros || []).forEach(function (er) {
      var el = CAMPOS[er.campo] ? $(CAMPOS[er.campo]) : null, mt = /^furo(\d+)-(d|hz|nota)$/.exec(er.campo);
      if (mt) el = document.querySelector('#naf-linhas input[data-k="' + mt[1] + '"][data-c="' + (mt[2] === "d" ? "d" : mt[2]) + '"]');
      if (el) el.setAttribute("aria-invalid", "true");
    });
  }

  function atualizar() {
    derivarInterno();
    var e = lerEntrada(), r = N.calcular(e);
    document.querySelectorAll("#naf-linhas .naf-info").forEach(function (el) { el.textContent = ""; });
    document.querySelectorAll("#naf-linhas .naf-xt").forEach(function (el) { el.textContent = ehExtra(parseInt(el.getAttribute("data-k"), 10)) ? " (extra)" : ""; });
    marcarErros(r.ok ? [] : r.erros);
    if (!r.ok) {
      ultimo = null;
      $("naf-erros").innerHTML = '<div class="pc-aviso" role="alert"><b>Não foi possível calcular</b><ul>' + r.erros.map(function (x) { return "<li>" + esc(x.msg) + "</li>"; }).join("") + "</ul><p class=\"pc-mini\">Nenhuma posição é mostrada enquanto houver erros. Corrija os campos marcados.</p></div>";
      $("naf-saida").hidden = true; $("naf-molde").innerHTML = "";
      salvar(); return;
    }
    ultimo = r; $("naf-erros").innerHTML = ""; $("naf-saida").hidden = false;
    r.furos.forEach(function (f) {
      var el = document.querySelector('#naf-linhas .naf-info[data-k="' + (f.linha - 1) + '"]'); if (!el) return;
      el.textContent = (f.extra ? TEXTO_EXTRA.trim() + " " : "") + (f.fonteHz === "hz" ? "Hz digitado vale como alvo (≈ " + f.notaProxima.nota + (Math.abs(f.notaProxima.cents) >= 0.5 ? (f.notaProxima.cents > 0 ? " +" : " −") + Math.round(Math.abs(f.notaProxima.cents)) + " cents" : "") + ")" : "Hz da nota: " + mm(f.hz, 2));
    });
    $("naf-desenho").innerHTML = desenho(r);
    $("naf-cartoes").innerHTML = r.furos.slice().reverse().map(function (f) {
      return '<div class="pc-cartao"><div class="pc-c1"><b>' + f.linha + 'º</b> ' + f.nota + (f.extra ? ' (extra)' : '') + ' <span>Ø ' + mm(f.diametro) + ' · ' + mm(f.hz, 2) + ' Hz</span></div>' +
        '<div class="pc-c2"><b>' + mm(f.doPe) + '</b> do pé · ' + mm(f.daJanela) + ' da janela' + (f.espacoAbaixo === null ? "" : " · " + mm(f.espacoAbaixo) + " ao furo de baixo") + '</div>' +
        '<div class="pc-c3">' + selo(f.razaoCorte) + '</div></div>';
    }).join("");
    $("naf-tabela").querySelector("tbody").innerHTML = r.furos.map(function (f) {
      return '<tr><th scope="row">' + f.linha + 'º</th><td>' + f.nota + ' <small>(' + f.notaIng + (f.extra ? ', extra' : '') + ')</small></td><td>' + mm(f.hz, 2) + (f.fonteHz === "hz" ? " <small>digitado</small>" : "") + '</td><td>' + mm(f.diametro) + ' mm</td><td><b>' + mm(f.doPe) + ' mm</b></td><td>' +
        mm(f.daJanela) + ' mm</td><td>' + (f.espacoAbaixo === null ? "—" : mm(f.espacoAbaixo) + " mm") + '</td><td>' + selo(f.razaoCorte) + '</td></tr>';
    }).join("");
    $("naf-resumo").innerHTML =
      "<li><span>Fundamental (todos os furos fechados)</span><b>" + r.fundamental.nome + " (" + r.fundamental.nomeIng + ") · " + mm(r.fundamental.hz, 2) + " Hz</b></li>" +
      "<li><span>Centro da janela, medido da ponta do pé <em>(calculado)</em></span><b>" + mm(r.janelaDoPe) + " mm</b></li>" +
      "<li><span>Comprimento acústico: centro da janela ao fim acústico <em>(calculado)</em></span><b>" + mm(r.comprimentoAcustico) + " mm</b></li>" +
      "<li><span>Cabeça: ponta da cabeça ao centro da janela <em>(informado)</em></span><b>" + mm(r.entrada.cabeca) + " mm</b></li>" +
      "<li><span>Extensão além do fim acústico, na ponta do pé <em>(informado; não entra na acústica)</em></span><b>" + mm(r.entrada.ponta) + " mm</b></li>" +
      "<li><span>Comprimento total estimado do tubo (cabeça + acústico + extensão)</span><b>" + mm(r.comprimentoFisico) + " mm</b></li>" +
      "<li><span>Diâmetro interno <em>(derivado: externo − 2 × parede)</em> · ótimo do modelo para essa nota</span><b>" + mm(r.diametroInterno) + " mm · " + mm(r.furoOtimo) + " mm</b></li>" +
      "<li><span>Velocidade do som a " + mm(r.entrada.temperatura, 0) + " °C</span><b>" + mm(r.velocidadeSom / 1000, 1) + " m/s</b></li>";
    $("naf-avisos").innerHTML = r.avisos.length
      ? '<div class="pc-aviso"><b>Atenção</b> <span class="pc-mini">(avisos não mexem nos furos; a decisão é sua)</span><ul>' + r.avisos.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul></div>"
      : '<p class="pc-ok">Nenhum aviso do modelo para esta geometria.</p>';
    $("naf-molde").innerHTML = molde(r);
    salvar();
  }

  function salvar() {
    var est = estadoLink(), json = JSON.stringify(est);
    hashNaf = "#" + encodeURIComponent(json);
    try { localStorage.setItem(CHAVE, json); } catch (x) { /* sem armazenamento: segue */ }
    if (window.__modoNaf) history.replaceState(null, "", location.pathname + "?modo=naf" + hashNaf);
  }

  /* ---- eventos ---- */
  $("naf-form").addEventListener("input", function (ev) {
    var t = ev.target, c = t.getAttribute("data-c"), k = parseInt(t.getAttribute("data-k"), 10);
    if (c) {
      var l = linhas[k]; if (!l) return;
      if (c === "a") l.a = t.checked; else if (c === "d") { l.d = t.value; manualDim = true; } else { l[c] = t.value; if (c === "nota" || c === "hz") $("naf-escala").value = "personalizada"; }
    } else if (/^naf-(od|parede|jc|jl|ja|cabeca|ponta)$/.test(t.id)) manualDim = true;
    if (t.id === "naf-di") { var p = parseFloat($("naf-parede").value), di = parseFloat(t.value); if (isFinite(p) && isFinite(di)) { $("naf-od").value = Math.round((di + 2 * p) * 100) / 100; manualDim = true; } }
    atualizar();
  });
  $("naf-form").addEventListener("change", function (ev) {
    var id = ev.target.id;
    if (id === "naf-furos") { montarLinhas(true); if (!manualDim) aplicarMedidas(sugestao()); }
    else if (id === "naf-fund" || id === "naf-escala" || id === "naf-a4") {
      if (id === "naf-escala" && ev.target.value === "pentatonica-menor") montarLinhas(true);
      else if (id !== "naf-escala") { if ($("naf-escala").value === "pentatonica-menor") montarLinhas(true); if (!manualDim && id === "naf-fund") { aplicarMedidas(sugestao()); montarLinhas(true); } }
    }
    atualizar();
  });
  $("naf-sugerir").addEventListener("click", function () { sugerirTudo(); atualizar(); });
  $("naf-imprimir").addEventListener("click", function () { if (ultimo) window.print(); });
  $("naf-link").addEventListener("click", function () {
    var done = function () { $("naf-copiado").hidden = false; setTimeout(function () { $("naf-copiado").hidden = true; }, 2500); };
    if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, done); else done();
  });
  window.addEventListener("popstate", function () {
    var naf = modoNaf(); mostrarModo(naf);
    if (naf) { var s = lerHash(); if (s && aplicarLink(s)) atualizar(); }
    else if (window.PifeUI && window.PifeUI.recarregar) window.PifeUI.recarregar();
  });
  function lerHash() { try { return location.hash.length > 2 ? JSON.parse(decodeURIComponent(location.hash.slice(1))) : null; } catch (x) { return null; } }

  /* ---- início: link > salvo > sugestões ---- */
  var inicio = modoNaf() ? lerHash() : null;
  if (modoNaf() && !inicio) { try { inicio = JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch (x) { inicio = null; } }
  $("naf-escala").value = "pentatonica-menor"; $("naf-fund").value = "G4"; $("naf-furos").value = "5"; $("naf-a4").value = "440"; $("naf-temp").value = "20";
  if (!(inicio && aplicarLink(inicio))) sugerirTudo();
  mostrarModo(modoNaf());
  if (modoNaf()) atualizar(); else { var tmp = estadoLink(); hashNaf = "#" + encodeURIComponent(JSON.stringify(tmp)); }
})();
