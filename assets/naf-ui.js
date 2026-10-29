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
      lead.textContent = naf ? "Onde furar a sua flauta nativa americana. Escolha a nota, meça o tubo e a janela, e a calculadora mostra a posição de cada furo, desenha a flauta e gera um molde em tamanho real para imprimir." : lead.getAttribute("data-pife"); }
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

  function sugestao() { var t = parseFloat($("naf-temp").value); return N.sugerir({ furos: nFuros(), midi: midiFund(), a4: parseFloat($("naf-a4").value) || 440, temp: isFinite(t) ? t : 20 }); }
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
  /* Semente completa e coerente da topologia atual (notas da escala e Ø sugeridos). Nunca herda notas nem Ø por
     índice de outra topologia: o furo extra da NAF de 6 furos não existe na de 5. */
  function montarLinhas() {
    var n = nFuros(), sug = sugestao(), notas = notasEscala(), novo = [];
    for (var k = 0; k < n; k++) novo.push({ nota: notas[k], hz: "", d: sug.diametros[k], a: true });
    linhas = novo; desenharLinhas();
  }
  /* só as notas (escala pentatônica); mantém Ø e furos ativos */
  function refazerNotas() {
    var notas = notasEscala();
    linhas.forEach(function (l, k) { l.nota = notas[k]; l.hz = ""; }); desenharLinhas();
  }
  function refazerDiametros() { var sug = sugestao(); linhas.forEach(function (l, k) { l.d = sug.diametros[k]; }); desenharLinhas(); }
  function sugerirTudo() { manualDim = false; aplicarMedidas(sugestao()); montarLinhas(); }

  /* NAF de 6 furos na pentatônica: o 4º furo contado do pé é o extra, fora da escala (Flutopedia, Basic-Six) */
  function ehExtra(k) { return nFuros() === 6 && $("naf-escala").value === "pentatonica-menor" && N.FURO_EXTRA[6] === k; }
  

  function desenharLinhas() {
    var cx = $("naf-linhas"); cx.innerHTML = "";
    linhas.forEach(function (l, k) {
      var div = document.createElement("div"); div.className = "naf-lin"; div.setAttribute("role", "group"); div.setAttribute("aria-label", "Furo " + (k + 1));
      div.innerHTML = '<label class="naf-ativo"><input type="checkbox" data-k="' + k + '" data-c="a"> <b>Furo ' + (k + 1) + '<span class="naf-xt" data-k="' + k + '"></span></b></label>' +
        '<label>Nota<input type="text" list="naf-notas" autocomplete="off" data-k="' + k + '" data-c="nota"></label>' +
        '<label>Hz<input type="text" inputmode="decimal" autocomplete="off" data-k="' + k + '" data-c="hz"></label>' +
        '<label>Ø (mm)<input type="number" min="1" max="40" step="0.5" data-k="' + k + '" data-c="d"></label>' +
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
  /* Opções "Mostrar no desenho" (mesma ideia e mesmos nomes do Pífano). Cada uma liga/desliga de fato um grupo do SVG. */
  var VIS = { tubo: true, notas: true, numeros: true, espacos: true, boca: false, total: true, janela: true, diametros: false };
  var VIS_NOMES = { notas: "Notas", numeros: "Nº dos furos", diametros: "Ø dos furos", espacos: "Entre furos", boca: "Até o pé", total: "Comprimento", janela: "Janela", tubo: "Tubo e parede" };
  try { var salvoVis = JSON.parse(localStorage.getItem(CHAVE + ".vis") || "null"); if (salvoVis) Object.keys(VIS).forEach(function (k) { if (typeof salvoVis[k] === "boolean") VIS[k] = salvoVis[k]; }); } catch (x) { /* padrão */ }
  function grupo(chave, interno) { return VIS[chave] ? '<g data-vis="' + chave + '">' + interno + "</g>" : ""; }

  function cota(x1, x2, y, texto, cor, dy) {
    var m = (x1 + x2) / 2, s = '<g stroke="' + cor + '" stroke-width="1.2"><line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '"/>' +
      '<line x1="' + x1 + '" y1="' + (y - 5) + '" x2="' + x1 + '" y2="' + (y + 5) + '"/><line x1="' + x2 + '" y1="' + (y - 5) + '" x2="' + x2 + '" y2="' + (y + 5) + '"/></g>';
    return s + '<text x="' + m + '" y="' + (y - 4 - (dy || 0)) + '" text-anchor="middle" font-size="12" fill="' + cor + '">' + texto + '</text>';
  }
  /* cota vertical com o texto girado ao longo da linha (celular) */
  function cotaVR(x, ya, yb, txt, cor, fs) {
    var m = (ya + yb) / 2;
    return '<g stroke="' + cor + '" stroke-width="1.3"><line x1="' + x + '" y1="' + ya + '" x2="' + x + '" y2="' + yb + '"/><line x1="' + (x - 4) + '" y1="' + ya + '" x2="' + (x + 4) + '" y2="' + ya + '"/><line x1="' + (x - 4) + '" y1="' + yb + '" x2="' + (x + 4) + '" y2="' + yb + '"/></g>' +
      (txt ? '<text x="' + (x - 3) + '" y="' + m + '" font-size="' + (fs || 11) + '" fill="' + cor + '" text-anchor="middle" transform="rotate(-90 ' + (x - 3) + ' ' + m + ')">' + txt + "</text>" : "");
  }
  function textoTubo(r) { var e = r.entrada; return "Ø externo " + mm(e.diametroExterno) + " · parede " + mm(e.parede) + " · Ø interno " + mm(r.diametroInterno); }

  function desenho(r) {
    var e = r.entrada, W = 1000, L = r.comprimentoFisico;
    /* margem esquerda extra quando a janela passa da ponta da cabeça (cabeça curta), para nada sair do desenho */
    var x0 = 30 + Math.max(0, e.janelaCompr / 2 - e.cabeca) * ((W - 70) / L), esc = (W - x0 - 40) / L;
    var X = function (p) { return x0 + (L - p) * esc; }; /* p = distância ao pé; cabeça à esquerda, pé à direita */
    var ext = e.diametroExterno, h = ext * esc, hi = r.diametroInterno * esc;
    var topo = 40 + (VIS.janela ? 16 : 0) + (VIS.notas ? 16 : 0) + (VIS.diametros ? 16 : 0), cy = topo + h / 2, base = cy + h / 2;
    var xpe = X(0), xj = X(r.janelaDoPe), s = "";
    s += '<rect x="' + x0 + '" y="' + (cy - h / 2) + '" width="' + (xpe - x0) + '" height="' + h + '" rx="2" fill="#D9A33A" stroke="#7a5a1c" stroke-width="2"/>';
    s += grupo("tubo", '<rect x="' + x0 + '" y="' + (cy - hi / 2) + '" width="' + (xpe - x0) + '" height="' + hi + '" fill="#f0c56a"/>' +
      '<g stroke="#7a5a1c" stroke-width="1" stroke-dasharray="5 4"><line x1="' + x0 + '" y1="' + (cy - hi / 2) + '" x2="' + xpe + '" y2="' + (cy - hi / 2) + '"/><line x1="' + x0 + '" y1="' + (cy + hi / 2) + '" x2="' + xpe + '" y2="' + (cy + hi / 2) + '"/></g>');
    /* janela: comprimento ao longo do tubo, largura atravessando (limitada à altura do tubo no desenho) */
    var wj = Math.min(e.janelaLarg, ext) * esc, lj = e.janelaCompr * esc;
    s += grupo("janela", '<rect x="' + (xj - lj / 2) + '" y="' + (cy - wj / 2) + '" width="' + lj + '" height="' + wj + '" fill="#2D4839"/>' +
      '<line x1="' + xj + '" y1="22" x2="' + xj + '" y2="' + (base + 6) + '" stroke="#9A3B1F" stroke-width="1.2" stroke-dasharray="4 3"/>' +
      '<text x="' + Math.max(xj, 50) + '" y="16" text-anchor="middle" font-size="12" fill="#9A3B1F">janela</text>');
    var xs = [], altas = [], nivelAlto = false, yNota = topo - 12 - (VIS.diametros ? 16 : 0);
    var circulos = "", nots = "", nums = "", dias = "";
    r.furos.forEach(function (f, i) {
      var x = X(f.doPe); xs.push(x);
      circulos += '<circle cx="' + x + '" cy="' + cy + '" r="' + (f.diametro * esc / 2) + '" fill="#2D4839"/>' +
        '<g stroke="#f6efe2" stroke-width="1"><line x1="' + (x - 4) + '" y1="' + cy + '" x2="' + (x + 4) + '" y2="' + cy + '"/><line x1="' + x + '" y1="' + (cy - 4) + '" x2="' + x + '" y2="' + (cy + 4) + '"/></g>';
      /* notas de furos vizinhos muito juntos sobem um nível para não se sobrepor */
      var sobe = i > 0 && Math.abs(x - xs[i - 1]) < 52 && !nivelAlto; nivelAlto = sobe;
      nots += '<text x="' + x + '" y="' + (yNota - (sobe ? 14 : 0)) + '" text-anchor="middle" font-size="13" fill="#7E2A5E">' + f.nota + "</text>";
      dias += '<text x="' + x + '" y="' + (topo - 12) + '" text-anchor="middle" font-size="11" fill="#2D4839">Ø' + mm(f.diametro) + "</text>";
      nums += '<text x="' + x + '" y="' + (base + 16) + '" text-anchor="middle" font-size="14" fill="#2D4839">' + f.linha + "</text>";
    });
    s += circulos + grupo("notas", nots) + grupo("diametros", dias) + grupo("numeros", nums);
    var y = base + (VIS.numeros ? 24 : 10);
    if (VIS.espacos) {
      var sp = ""; for (var i = 1; i < r.furos.length; i++) sp += cota(xs[i], xs[i - 1], y + 14, mm(r.furos[i].espacoAbaixo), "#7E2A5E", i % 2 ? 0 : 13);
      s += grupo("espacos", sp); y += 34;
    }
    if (VIS.boca) {
      var bc = ""; r.furos.forEach(function (f, k) { bc += cota(xpe, xs[k], y + 14 + k * 18, f.nota + ": " + mm(f.doPe), "#2D4839"); });
      s += grupo("boca", bc); y += 18 * r.furos.length + 8;
    }
    if (VIS.janela) { s += grupo("janela", cota(xpe, xj, y + 14, "da janela ao pé: " + mm(r.janelaDoPe), "#9A3B1F")); y += 26; }
    if (VIS.total) { s += grupo("total", cota(xpe, X(L), y + 14, "comprimento: " + mm(L), "#7a5a1c")); y += 26; }
    if (VIS.tubo) { s += grupo("tubo", '<text x="' + x0 + '" y="' + (y + 14) + '" font-size="12" fill="#7a5a1c">' + textoTubo(r) + "</text>"); y += 22; }
    return '<svg viewBox="0 0 ' + W + " " + (y + 18) + '" role="img" aria-label="Desenho da flauta NAF com os furos e as medidas">' + s + "</svg>";
  }

  /* Celular: a mesma flauta em pé (cabeça em cima, pé embaixo), com as mesmas opções */
  function desenhoVertical(r) {
    var e = r.entrada, L = r.comprimentoFisico, H = 860, y0 = 30, esc = (H - 60) / L, ext = e.diametroExterno, w = ext * esc, hi = r.diametroInterno * esc;
    var rotulos = VIS.notas || VIS.numeros || VIS.diametros, esq = 6 + (rotulos ? (VIS.diametros ? 84 : 66) : (VIS.janela ? 34 : 14));
    var x1 = esq, cx = x1 + w / 2, col = x1 + w + 16;
    var Y = function (p) { return y0 + (L - p) * esc; };
    var colEsp = col; if (VIS.espacos) col += 18;
    var colBoca = col; if (VIS.boca) col += r.furos.length * 16;
    var colJan = col; if (VIS.janela) col += 16;
    var colTot = col; if (VIS.total) col += 16;
    var W = Math.max(col + 8, x1 + w + 20, VIS.tubo ? 200 : 0), ype = Y(0), yj = Y(r.janelaDoPe), s = "";
    s += '<rect x="' + x1 + '" y="' + y0 + '" width="' + w + '" height="' + (ype - y0) + '" rx="2" fill="#D9A33A" stroke="#7a5a1c" stroke-width="2"/>';
    s += grupo("tubo", '<rect x="' + (cx - hi / 2) + '" y="' + y0 + '" width="' + hi + '" height="' + (ype - y0) + '" fill="#f0c56a"/>');
    var wj = Math.min(e.janelaLarg, ext) * esc, lj = e.janelaCompr * esc;
    s += grupo("janela", '<rect x="' + (cx - wj / 2) + '" y="' + (yj - lj / 2) + '" width="' + wj + '" height="' + lj + '" fill="#2D4839"/>' +
      '<text x="' + (x1 - 6) + '" y="' + (yj + 4) + '" text-anchor="end" font-size="11" fill="#9A3B1F">janela</text>');
    var tx = function (y, t, cor, tam) { return '<text x="' + (x1 - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="' + (tam || 12) + '" fill="' + (cor || "#2D4839") + '">' + t + "</text>"; };
    var circ = "", rot = "", esp = "", bc = "", ant = ype;
    r.furos.forEach(function (f, k) {
      var y = Y(f.doPe);
      circ += '<circle cx="' + cx + '" cy="' + y + '" r="' + (f.diametro * esc / 2) + '" fill="#2D4839"/>';
      var l1 = [VIS.numeros ? f.linha + "º" : "", VIS.notas ? f.nota : ""].filter(Boolean).join(" ");
      if (l1) rot += tx(y - (VIS.diametros ? 4 : 0), l1);
      if (VIS.diametros) rot += tx(y + (l1 ? 9 : 0), "Ø" + mm(f.diametro), "#7a5a1c", 10);
      if (k > 0) esp += cotaVR(colEsp, ant, y, mm(f.espacoAbaixo), "#7E2A5E", 10);
      bc += cotaVR(colBoca + k * 16, ype, y, f.nota + ": " + mm(f.doPe), "#2D4839", 10);
      ant = y;
    });
    s += circ + ((rotulos) ? '<g data-vis="rotulos">' + rot + "</g>" : "") + grupo("espacos", esp) + grupo("boca", bc);
    if (VIS.janela) s += grupo("janela", cotaVR(colJan, ype, yj, "janela ao pé: " + mm(r.janelaDoPe), "#9A3B1F", 10));
    if (VIS.total) s += grupo("total", cotaVR(colTot, ype, y0, "total: " + mm(L), "#7a5a1c", 10));
    s += tx(ype - 4, "pé", null, 11);
    var bas = ype + 22, extra = "";
    if (VIS.tubo) { ["Ø externo " + mm(ext), "parede " + mm(e.parede), "Ø interno " + mm(r.diametroInterno)].forEach(function (t, k) { extra += '<text x="' + (W / 2) + '" y="' + (bas + k * 15) + '" text-anchor="middle" font-size="11" fill="#7a5a1c">' + t + "</text>"; }); bas += 30; }
    return '<svg class="pc-vert" viewBox="0 0 ' + W + " " + (bas + 18) + '" role="img" aria-label="Desenho da flauta NAF em pé, com os furos e as medidas">' + s + (VIS.tubo ? '<g data-vis="tubo">' + extra + "</g>" : "") + "</svg>";
  }
  function painelVis() {
    $("naf-vis").innerHTML = '<span class="pc-mini pc-vis-t">Mostrar no desenho:</span>' + Object.keys(VIS_NOMES).map(function (k) {
      return '<label><input type="checkbox" data-vis="' + k + '"' + (VIS[k] ? " checked" : "") + "> " + VIS_NOMES[k] + "</label>";
    }).join("");
  }

  /* ---- molde 1:1: páginas A4 em pé, régua de 100 mm, distância ao pé crescendo para baixo ---- */
  /* texto da marca do molde: numa linha se couber na folha (limite 176 mm), senão em duas linhas e, se preciso, menor */
  function textoMolde(x, y, a, b) {
    var fs = 3.6, larg = 176 - x, w1 = (a.length + b.length + 3) * 0.52 * fs;
    if (w1 <= larg) return '<text x="' + x + '" y="' + y + '" font-size="' + fs + '">' + a + " · " + b + "</text>";
    fs = Math.max(2.4, Math.min(fs, larg / (Math.max(a.length, b.length) * 0.52)));
    return '<text x="' + x + '" y="' + (y - 1.4) + '" font-size="' + fs + '">' + a + '</text><text x="' + x + '" y="' + (y + fs - 0.6) + '" font-size="' + fs + '">' + b + "</text>";
  }
  function molde(r) {
    var e = r.entrada, L = r.comprimentoFisico, passo = 230, ini = -10, fim = L + 10, paginas = "", n = 1;
    var marcas = [{ p: 0, d: 0, t: "PÉ (ponta do tubo)" }];
    r.furos.forEach(function (f) { marcas.push({ p: f.doPe, d: f.diametro, t: "Furo " + f.linha + " · " + f.nota + " · Ø " + mm(f.diametro) }); });
    marcas.push({ p: r.janelaDoPe, janela: true, t: "JANELA " + mm(e.janelaCompr) + " × " + mm(e.janelaLarg) });
    marcas.push({ p: L, d: 0, t: "CABEÇA: cortar aqui" });
    var tx = Math.max(84, 60 + e.diametroExterno / 2 + 6);
    for (var a = ini; a < fim; a += passo, n++) {
      var b = a + passo + 10, s = '<svg xmlns="http://www.w3.org/2000/svg" width="180mm" height="270mm" viewBox="0 0 180 270">';
      var Y = function (p) { return 25 + (p - a); };
      s += '<text x="5" y="8" font-size="4">Calculadora de flauta NAF · igorbastosluthier.com.br' + ' · página ' + n + ' · a cruz marca o centro do furo</text>';
      s += '<text x="5" y="14" font-size="3.2">A régua deve ter 100 mm. Se não tiver, imprima em tamanho real (100%).</text>';
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
        s += textoMolde(tx, y + 1.2, mk.t, mm(mk.p) + " mm do pé");
      });
      if (b < fim) s += '<text x="5" y="' + Y(b) + '" font-size="3">✂ emendar com a próxima página nesta linha</text><line x1="0" y1="' + Y(b) + '" x2="180" y2="' + Y(b) + '" stroke="#000" stroke-dasharray="2 2" stroke-width=".3"/>';
      paginas += '<div class="pc-pag">' + s + '</svg></div>';
    }
    return paginas;
  }

  /* ---- resultado ---- */
  /* Alcance: o quanto os agudos saem com facilidade neste furo (a conta é a razão de corte; aqui só a faixa) */
  function selo(rz) {
    if (rz === null) return "—";
    var c = rz >= 2 ? ["#2D4839", "Bom"] : rz >= 1.5 ? ["#D9A33A", "Limitado"] : ["#9A3B1F", "Fraco"];
    return '<span class="pc-selo" style="--c:' + c[0] + '">● ' + c[1] + "</span>";
  }
  function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  function marcarErros(erros) {
    Object.keys(CAMPOS).forEach(function (c) { var el = $(CAMPOS[c]); if (el) el.removeAttribute("aria-invalid"); });
    document.querySelectorAll("#naf-linhas input").forEach(function (i) { i.removeAttribute("aria-invalid"); });
    (erros || []).forEach(function (er) {
      var el = CAMPOS[er.campo] ? $(CAMPOS[er.campo]) : null, mt = /^furo(\d+)-(d|hz|nota)$/.exec(er.campo);
      if (mt) el = document.querySelector('#naf-linhas input[data-k="' + mt[1] + '"][data-c="' + (mt[2] === "d" ? "d" : mt[2]) + '"]');
      if (el) { el.setAttribute("aria-invalid", "true"); if (er.campo === "cabeca" || er.campo === "ponta") $("naf-mais").open = true; }
    });
  }

  function atualizar() {
    if (linhas.length !== nFuros()) return; /* estado intermediário de uma troca de topologia: não calcula nem salva */
    derivarInterno();
    $("naf-escala-aviso").hidden = $("naf-escala").value === "pentatonica-menor";
    var e = lerEntrada(), r = N.calcular(e);
    document.querySelectorAll("#naf-linhas .naf-info").forEach(function (el) { el.textContent = ""; });
    document.querySelectorAll("#naf-linhas .naf-xt").forEach(function (el) { el.textContent = ehExtra(parseInt(el.getAttribute("data-k"), 10)) ? " (extra)" : ""; });
    marcarErros(r.ok ? [] : r.erros);
    if (!r.ok) {
      ultimo = null;
      $("naf-erros").innerHTML = '<div class="pc-aviso" role="alert"><b>Confira os campos</b><ul>' + r.erros.map(function (x) { return "<li>" + esc(x.msg) + "</li>"; }).join("") + "</ul></div>";
      $("naf-saida").hidden = true; $("naf-molde").innerHTML = "";
      salvar(); return;
    }
    ultimo = r; $("naf-erros").innerHTML = ""; $("naf-saida").hidden = false;
    /* Hz da nota aparece como sugestão cinza no campo; só o Hz digitado ganha uma linha de texto */
    linhas.forEach(function (l, k) {
      var hzEl = document.querySelector('#naf-linhas [data-k="' + k + '"][data-c="hz"]'), mp = N.parseNota(l.nota), a4 = parseFloat(e.a4);
      if (hzEl) hzEl.placeholder = mp !== null && isFinite(a4) ? mm(N.freqNota(mp, a4), 2) : "";
    });
    r.furos.forEach(function (f) {
      var el = document.querySelector('#naf-linhas .naf-info[data-k="' + (f.linha - 1) + '"]'); if (!el) return;
      var t = [];
      if (f.extra) t.push("Furo extra, fora da escala.");
      if (f.fonteHz === "hz") t.push("Vale este valor (≈ " + f.notaProxima.nota + (Math.abs(f.notaProxima.cents) >= 0.5 ? (f.notaProxima.cents > 0 ? " +" : " −") + Math.round(Math.abs(f.notaProxima.cents)) + " cents" : "") + ").");
      el.textContent = t.join(" ");
    });
    $("naf-desenho").innerHTML = (window.matchMedia && window.matchMedia("(max-width: 640px)").matches) ? desenhoVertical(r) : desenho(r);
    $("naf-cartoes").innerHTML = r.furos.slice().reverse().map(function (f) {
      return '<div class="pc-cartao"><div class="pc-c1"><b>' + f.linha + "º</b> " + f.nota + " <span>Ø " + mm(f.diametro) + "</span></div>" +
        '<div class="pc-c2"><b>' + mm(f.doPe) + "</b> do pé · " + mm(f.daJanela) + " da janela" + (f.espacoAbaixo === null ? "" : " · " + mm(f.espacoAbaixo) + " até o de baixo") + "</div>" +
        '<div class="pc-c3">' + selo(f.razaoCorte) + "</div></div>";
    }).join("");
    $("naf-tabela").querySelector("tbody").innerHTML = r.furos.map(function (f) {
      return '<tr><th scope="row">' + f.linha + "º</th><td>" + f.nota + " <small>" + mm(f.hz, 2) + " Hz</small></td><td>" + mm(f.diametro) + " mm</td><td><b>" + mm(f.doPe) + " mm</b></td><td>" +
        mm(f.daJanela) + " mm</td><td>" + (f.espacoAbaixo === null ? "—" : mm(f.espacoAbaixo) + " mm") + "</td><td>" + selo(f.razaoCorte) + "</td></tr>";
    }).join("");
    $("naf-resumo").innerHTML =
      "<li><span>Do centro da janela até o pé</span><b>" + mm(r.janelaDoPe) + " mm</b></li>" +
      "<li><span>Comprimento total do tubo</span><b>" + mm(r.comprimentoFisico) + " mm</b></li>" +
      "<li><span>Nota grave (tudo fechado)</span><b>" + r.fundamental.nome + " · " + mm(r.fundamental.hz, 2) + " Hz</b></li>";
    $("naf-avisos").innerHTML = r.avisos.length
      ? '<div class="pc-aviso"><b>Atenção</b><ul>' + r.avisos.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul></div>" : "";
    $("naf-cautela").textContent = "Posições calculadas: confira com o afinador e ajuste aos poucos" + (r.furos.some(function (f) { return f.extra; }) ? ", principalmente o furo extra." : ".");
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
    if (t.tagName === "SELECT") return; /* o "change" do select vem em seguida; evita resultado/URL intermediários */
    $("naf-aviso-troca").hidden = true;
    if (c) {
      var l = linhas[k]; if (!l) return;
      if (c === "a") l.a = t.checked; else if (c === "d") { l.d = t.value; manualDim = true; } else { l[c] = t.value; if (c === "nota" || c === "hz") $("naf-escala").value = "personalizada"; }
    } else if (/^naf-(od|parede|jc|jl|ja|cabeca|ponta)$/.test(t.id)) manualDim = true;
    /* temperatura e A4 mudam a solução do modelo: enquanto as medidas são as sugeridas, refaz as sugestões junto
       (senão uma mudança de temperatura poderia deixar as medidas sugeridas sem solução) */
    if ((t.id === "naf-temp" || t.id === "naf-a4") && !manualDim && isFinite(parseFloat(t.value))) { aplicarMedidas(sugestao()); refazerDiametros(); }
    if (t.id === "naf-di") { var p = parseFloat($("naf-parede").value), di = parseFloat(t.value); if (isFinite(p) && isFinite(di)) { $("naf-od").value = Math.round((di + 2 * p) * 100) / 100; manualDim = true; } }
    atualizar();
  });
  $("naf-form").addEventListener("change", function (ev) {
    var id = ev.target.id, pent = $("naf-escala").value === "pentatonica-menor";
    if (id === "naf-furos") {
      /* trocar a topologia refaz tudo com a semente da nova (nada é herdado por índice); fundamental, A4, temperatura e escala ficam */
      var editou = manualDim || !pent || linhas.some(function (l) { return !l.a || l.hz !== ""; });
      sugerirTudo();
      $("naf-aviso-troca").hidden = !editou;
    } else if (id === "naf-fund") {
      if (pent) refazerNotas();
      if (!manualDim) { aplicarMedidas(sugestao()); refazerDiametros(); }
    } else if (id === "naf-a4" || id === "naf-escala") { if (pent) refazerNotas(); }
    atualizar();
  });
  $("naf-voltar-pent").addEventListener("click", function () { $("naf-escala").value = "pentatonica-menor"; refazerNotas(); atualizar(); });
  painelVis();
  $("naf-vis").addEventListener("change", function (ev) {
    var k = ev.target.getAttribute("data-vis"); if (!k) return;
    VIS[k] = ev.target.checked;
    try { localStorage.setItem(CHAVE + ".vis", JSON.stringify(VIS)); } catch (x) { /* sem armazenamento */ }
    atualizar();
  });
  if (window.matchMedia) { var mq = window.matchMedia("(max-width: 640px)"); (mq.addEventListener ? mq.addEventListener("change", atualizar) : mq.addListener(atualizar)); }
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
  /* o estado NAF vem do link (só no modo NAF) ou do que ficou salvo neste aparelho, em qualquer modo, para que a
     aba NAF mostre o mesmo cálculo seja qual for a aba aberta primeiro */
  var inicio = modoNaf() ? lerHash() : null;
  if (!inicio) { try { inicio = JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch (x) { inicio = null; } }
  $("naf-escala").value = "pentatonica-menor"; $("naf-fund").value = "G4"; $("naf-furos").value = "5"; $("naf-a4").value = "440"; $("naf-temp").value = "20";
  if (!(inicio && aplicarLink(inicio))) sugerirTudo();
  mostrarModo(modoNaf());
  if (modoNaf()) atualizar(); else { var tmp = estadoLink(); hashNaf = "#" + encodeURIComponent(JSON.stringify(tmp)); }
})();
