/* Calculadora de Flauta NAF: interface (modo ao lado do Pífano). Tudo roda no navegador; nada é enviado.
   Tabela, desenho, cartões do celular e molde 1:1 consomem o MESMO objeto devolvido por NafCalc.calcular(). */
(function () {
  "use strict";
  var N = window.NafCalc, Esc = window.Escalas;
  if (!N) return;
  var $ = function (id) { return document.getElementById(id); };
  var mm = function (v, d) { return v.toFixed(d === undefined ? 1 : d).replace(".", ","); };
  var CHAVE = "nafCalc.v1";
  var CAMPOS = { a4: "naf-a4", temperatura: "naf-temp", diametroExterno: "naf-od", parede: "naf-parede", janelaCompr: "naf-jc",
    janelaLarg: "naf-jl", janelaAltura: "naf-ja", cabeca: "naf-cabeca", ponta: "naf-ponta", fundamental: "naf-fund", furos: "naf-furos" };
  var linhas = [];       /* estado das linhas (do pé para a boca): {nota, hz, d, a}; hz vazio = derivado da nota */
  var manualDim = false; /* a pessoa mexeu nas medidas: não reaplicar as sugestões sozinho */
  var ultimo = null;     /* último resultado válido (mesmo objeto para tabela, desenho e molde) */
  var dDigitado = false; /* a pessoa digitou algum diâmetro de furo: vale o dela, sem ajuste automático */
  var ajusteManual = null; /* resultado do botão "Ajustar sozinho" (quando os diâmetros foram digitados) */

  /* ---- seletor de modo (abas) ---- */
  var abaPife = $("modo-aba-pife"), abaNaf = $("modo-aba-naf");
  function modoNaf() { return /(^|[?&])modo=naf(&|$)/.test(location.search); }
  function mostrarModo(naf) {
    window.__modoNaf = naf;
    $("modo-pife").hidden = naf; $("modo-naf").hidden = !naf;
    document.body.classList.toggle("modo-naf", naf);
    [[abaPife, !naf], [abaNaf, naf]].forEach(function (p) { p[0].setAttribute("aria-selected", p[1] ? "true" : "false"); p[0].tabIndex = p[1] ? 0 : -1; });
    var h1 = document.querySelector(".ph h1");
    if (h1) h1.textContent = naf ? "Faça sua flauta NAF" : "Faça sua flauta";
    var lead = document.querySelector(".ph p");
    if (lead) { if (!lead.getAttribute("data-pife")) lead.setAttribute("data-pife", lead.textContent);
      lead.textContent = naf ? "Onde furar a sua flauta nativa americana. Escolha a nota, meça o tubo e a janela, e a calculadora mostra a posição de cada furo, desenha a flauta e gera um molde em tamanho real para imprimir." : lead.getAttribute("data-pife"); }
    document.title = naf ? "Faça sua flauta NAF · Igor Bastos" : "Faça sua flauta · Igor Bastos";
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

  /* escala: as do app que cabem inteiras na NAF com essa quantidade de furos, mais "Personalizada" */
  var ultimaEscala = "pentatonica-menor"; /* última escala com nome (para o botão "Voltar à ...") */
  function escolhida() { var v = $("naf-escala").value; return v && v !== "personalizada" ? v : null; }
  function opcoesEscala(desejada) {
    var sel = $("naf-escala"), atual = desejada || sel.value, lista = Esc ? Esc.aplicaveis("naf", nFuros()) : [{ id: "pentatonica-menor", nome: "Pentatônica menor" }];
    sel.innerHTML = lista.map(function (x) { return '<option value="' + x.id + '">' + x.nome + "</option>"; }).join("") + '<option value="personalizada">Personalizada</option>';
    if (!lista.some(function (x) { return x.id === ultimaEscala; })) ultimaEscala = "pentatonica-menor";
    sel.value = atual === "personalizada" || lista.some(function (x) { return x.id === atual; }) ? atual : ultimaEscala;
    if (escolhida()) ultimaEscala = escolhida();
    var nome = (lista.filter(function (x) { return x.id === ultimaEscala; })[0] || {}).nome || "Pentatônica menor";
    $("naf-voltar-pent").textContent = "Voltar à escala " + nome.charAt(0).toLowerCase() + nome.slice(1);
  }
  function sugestao() { var t = parseFloat($("naf-temp").value); return N.sugerir({ furos: nFuros(), midi: midiFund(), escala: escolhida() || ultimaEscala, a4: parseFloat($("naf-a4").value) || 440, temp: isFinite(t) ? t : 20 }); }
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
    return N.escala(escolhida() || ultimaEscala, midiFund(), nFuros()).map(N.nomePt);
  }
  /* Semente completa e coerente da topologia atual (notas da escala e Ø sugeridos). Nunca herda notas nem Ø por
     índice de outra topologia: o furo extra da NAF de 6 furos não existe na de 5. */
  function montarLinhas() {
    var n = nFuros(), sug = sugestao(), notas = notasEscala(), novo = [];
    for (var k = 0; k < n; k++) novo.push({ nota: notas[k], hz: "", d: sug.diametros[k], ideal: sug.diametros[k], a: true });
    linhas = novo; dDigitado = false; desenharLinhas();
  }
  /* só as notas (escala pentatônica); mantém Ø e furos ativos */
  function refazerNotas() {
    var notas = notasEscala();
    linhas.forEach(function (l, k) { l.nota = notas[k]; l.hz = ""; }); desenharLinhas();
  }
  function refazerDiametros() { var sug = sugestao(); linhas.forEach(function (l, k) { l.d = l.ideal = sug.diametros[k]; }); dDigitado = false; desenharLinhas(); }
  function sugerirTudo() { manualDim = false; aplicarMedidas(sugestao()); montarLinhas(); }

  /* NAF de 6 furos na pentatônica: o furo auxiliar (o 4º contado do pé na menor) é o extra, fora da escala */
  function ehExtra(k) { return N.ehAux(escolhida(), nFuros(), k); }
  

  function desenharLinhas() {
    var cx = $("naf-linhas"); cx.innerHTML = "";
    linhas.forEach(function (l, k) {
      var div = document.createElement("div"); div.className = "naf-lin"; div.setAttribute("role", "group"); div.setAttribute("aria-label", "Furo " + (k + 1));
      div.innerHTML = '<label class="naf-ativo"><span class="pc-n">Furo ' + (k + 1) + '<span class="naf-xt" data-k="' + k + '"></span> · <b class="naf-nome" data-k="' + k + '"></b></span></label>' +
        '<small class="naf-hz-txt" data-k="' + k + '"></small>' +
        '<input type="number" min="1" max="40" step="0.5" data-k="' + k + '" data-c="d" aria-label="Diâmetro do furo ' + (k + 1) + ' (mm)">' +
        '<div class="naf-pers"><label>Nota<input type="text" list="naf-notas" autocomplete="off" data-k="' + k + '" data-c="nota"></label>' +
        '<label>Hz<input type="text" inputmode="decimal" autocomplete="off" data-k="' + k + '" data-c="hz"></label></div>' +
        '<small class="naf-info" data-k="' + k + '"></small>';
      cx.appendChild(div);
      div.querySelector('[data-c="nota"]').value = l.nota;
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
      m: manualDim ? 1 : 0, dd: dDigitado ? 1 : 0, l: linhas.map(function (l) { return [l.nota, l.hz, l.d, l.a ? 1 : 0, l.ideal === undefined ? l.d : l.ideal]; }) };
  }
  function aplicarLink(s) {
    if (!s || typeof s !== "object" || !s.fu) return false;
    $("naf-furos").value = s.f === 5 ? "5" : "6"; $("naf-fund").value = s.fu; if (!$("naf-fund").value) $("naf-fund").value = "G4";
    opcoesEscala(s.es || "pentatonica-menor");
    $("naf-a4").value = s.a4; $("naf-temp").value = s.t;
    $("naf-od").value = s.od; $("naf-parede").value = s.p; $("naf-jc").value = s.jc; $("naf-jl").value = s.jl; $("naf-ja").value = s.ja;
    $("naf-cabeca").value = s.c; $("naf-ponta").value = s.po; derivarInterno(); manualDim = !!s.m;
    var n = nFuros(), l = Array.isArray(s.l) ? s.l.slice(0, n) : [];
    linhas = []; for (var k = 0; k < n; k++) { var x = l[k] || ["", "", "", 1]; linhas.push({ nota: String(x[0]), hz: String(x[1] === null ? "" : x[1]), d: x[2], a: true, ideal: x[4] === undefined ? x[2] : x[4] }); }
    dDigitado = !!s.dd;
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
  /* Região das janelas, vista de cima, no modelo das fotos de NAF sem bloco que o Igor mandou. Tudo dentro do ninho: um rebaixo
     comprido, em forma de pista, de pontas bem arredondadas, um pouco mais escuro que a madeira e de borda marcada. No meio dele,
     do bocal para o pé: a saída de ar (SAC), pequena e quase preta; a rampa, por onde o canal desce para dentro dela; o canal, da
     largura das janelas; e a janela do som (TSH), também pequena e quase preta, com a aresta viva (fipple edge) na borda do lado do
     pé. O motor só calcula a janela do som (comprimento, largura, posição). O ninho, a saída de ar e as distâncias seguem a
     proporção das fotos em relação ao diâmetro do tubo: ilustrativos, sem cota. Distâncias ao pé em mm. */
  function geoJanelas(r) {
    var e = r.entrada, lj = e.janelaCompr, ext = e.diametroExterno, wj = Math.min(e.janelaLarg, ext), pj = r.janelaDoPe, L = r.comprimentoFisico;
    var fl = 1.6 * lj, base = pj + lj / 2, sacFoot = base + fl, sacBoca = sacFoot + lj, mg = 0.4 * ext;
    var cabe = sacBoca + 0.12 * ext <= L - 1;
    if (cabe) mg = Math.min(mg, L - 1 - sacBoca);
    return { lj: lj, wj: wj, pj: pj, base: base, fl: fl, sacFoot: sacFoot, sacBoca: sacBoca, nw: Math.min(Math.max(0.65 * ext, wj * 1.9), ext * 0.92),
      ar: cabe ? { centro: sacFoot + lj / 2 } : null, recPe: pj - lj / 2 - 0.4 * ext, recBoca: cabe ? sacBoca + mg : Math.min(base + 0.4 * ext, L - 1) };
  }
  function janelaAr(r) { return geoJanelas(r).ar; }
  /* tampão maciço (languid) dentro do bore, sob o canal: separa a câmara de ar (lado do bocal) da câmara do som; só o contorno tracejado */
  function tampaoRc(r, rc) {
    var g = geoJanelas(r); if (!g.ar) return "";
    return rc(g.base, g.sacFoot, -r.diametroInterno / 2, r.diametroInterno / 2, 'fill="rgba(122,90,28,.22)" stroke="#7a5a1c" stroke-width="1.4" stroke-dasharray="4 3"', 0);
  }
  /* rc(p1, p2, b1, b2, atributos, raio): retângulo entre as distâncias ao pé p1..p2 e a posição b1..b2 através do tubo (mm) */
  function regiaoJanelas(r, rc, vertical) {
    var g = geoJanelas(r), lj = g.lj, wj = g.wj, pj = g.pj, o = "", rp = "naf-rampa" + (vertical ? "V" : "H"), fio = Math.max(0.1 * lj, 0.7);
    /* o degradê da rampa vai do canal (lado do pé) até quase preto na borda da saída de ar (lado do bocal) */
    o += '<defs><linearGradient id="' + rp + '" x1="0" y1="0" x2="' + (vertical ? 0 : 1) + '" y2="' + (vertical ? 1 : 0) + '"><stop offset="0" stop-color="#6b4416"/><stop offset="1" stop-color="#cf9a3a"/></linearGradient></defs>';
    /* ninho: pista de pontas totalmente arredondadas */
    o += rc(g.recPe, g.recBoca, -g.nw / 2, g.nw / 2, 'fill="#dcae4f" stroke="#a87a26" stroke-width="1.4"', g.nw / 2);
    /* canal: da largura das janelas, um pouco mais escuro que o ninho */
    o += rc(pj + lj / 2, g.ar ? g.sacFoot : pj + lj / 2, -wj / 2, wj / 2, 'fill="#cf9a3a"', 0);
    if (g.ar) {
      o += rc(g.sacFoot - 0.45 * g.fl, g.sacFoot, -wj / 2, wj / 2, 'fill="url(#' + rp + ')"', 0); /* rampa: o canal desce para dentro da saída de ar */
      o += rc(g.sacFoot, g.sacBoca, -wj / 2, wj / 2, 'fill="#0f0b09"', 0.04 * lj); /* saída de ar (SAC) */
    }
    /* janela do som (TSH), com a aresta viva (linha clara) na borda do lado do pé */
    o += rc(pj - lj / 2, pj + lj / 2, -wj / 2, wj / 2, 'fill="#0f0b09"', 0.04 * lj);
    o += rc(pj - lj / 2, pj - lj / 2 + fio, -wj / 2, wj / 2, 'fill="#fff7e0"', 0);
    return o;
  }
  /* Detalhe ampliado das janelas (vista de cima), com legendas curtas. Horizontal: bocal à esquerda, pé à direita. Vertical
     (celular): bocal em cima, pé embaixo, legendas à direita. */
  function detalheJanelas(r, vertical) {
    var e = r.entrada, g = geoJanelas(r), lj = g.lj, ext = e.diametroExterno, L = r.comprimentoFisico;
    var pLo = Math.max(-5, g.recPe - 0.5 * lj), pHi = Math.min(L, g.recBoca + 0.5 * lj), span = pHi - pLo, pad = 14;
    var s = Math.max(2, vertical ? Math.min(150 / ext, 440 / span) : Math.min(760 / span, 300 / ext)), h = ext * s, big = span * s;
    var X, Y, W, H, rc, xl = 16, yt = 70;
    if (vertical) {
      W = 380; H = big + 2 * pad;
      X = function (b) { return xl + (b + ext / 2) * s; }; Y = function (p) { return pad + (pHi - p) * s; };
      rc = function (p1, p2, b1, b2, at, rx) { return '<rect x="' + X(b1) + '" y="' + Y(Math.max(p1, p2)) + '" width="' + ((b2 - b1) * s) + '" height="' + (Math.abs(p2 - p1) * s) + '" rx="' + ((rx || 0) * s) + '" ' + at + "/>"; };
    } else {
      W = big + 2 * pad; H = h + 2 * yt + 20;
      X = function (p) { return pad + (pHi - p) * s; }; Y = function (b) { return yt + (b + ext / 2) * s; };
      rc = function (p1, p2, b1, b2, at, rx) { return '<rect x="' + X(Math.max(p1, p2)) + '" y="' + Y(b1) + '" width="' + (Math.abs(p2 - p1) * s) + '" height="' + ((b2 - b1) * s) + '" rx="' + ((rx || 0) * s) + '" ' + at + "/>"; };
    }
    var o = vertical ? '<rect x="' + X(-ext / 2) + '" y="0" width="' + h + '" height="' + H + '" fill="#f0c56a"/><line x1="' + X(-ext / 2) + '" y1="0" x2="' + X(-ext / 2) + '" y2="' + H + '" stroke="#7a5a1c" stroke-width="2"/><line x1="' + X(ext / 2) + '" y1="0" x2="' + X(ext / 2) + '" y2="' + H + '" stroke="#7a5a1c" stroke-width="2"/>'
      : '<rect x="0" y="' + Y(-ext / 2) + '" width="' + W + '" height="' + h + '" fill="#f0c56a"/><line x1="0" y1="' + Y(-ext / 2) + '" x2="' + W + '" y2="' + Y(-ext / 2) + '" stroke="#7a5a1c" stroke-width="2"/><line x1="0" y1="' + Y(ext / 2) + '" x2="' + W + '" y2="' + Y(ext / 2) + '" stroke="#7a5a1c" stroke-width="2"/>';
    o += regiaoJanelas(r, rc, vertical);
    /* legendas: [distância ao pé, posição através do tubo, texto, lado (horizontal: cima/baixo)] */
    var ls = [];
    ls.push([g.recPe + 0.2 * (g.sacFoot - g.recPe), -g.nw * 0.36, "ninho", "u"]);
    if (g.ar) ls.push([g.ar.centro, 0, "saída de ar", "u"]);
    ls.push([g.base + 0.35 * g.fl, 0, "canal", "u"]); ls.push([g.pj, g.wj * 0.2, "janela do som", "d"]); ls.push([g.pj - lj / 2 + 0.05 * lj, g.wj * 0.3, "aresta", "f"]);
    var fs = vertical ? 11 : 13, tx = "";
    if (vertical) {
      var xr = X(ext / 2) + 12, usados = [];
      ls.sort(function (a, b) { return b[0] - a[0]; }).forEach(function (l) {
        var ya = Y(l[0]), yl = ya; if (usados.length && yl < usados[usados.length - 1] + 16) yl = usados[usados.length - 1] + 16; usados.push(yl);
        tx += '<polyline points="' + X(l[1]) + "," + ya + " " + (xr - 2) + "," + ya + " " + (xr + 6) + "," + yl + '" fill="none" stroke="#2D4839" stroke-width="1"/><circle cx="' + X(l[1]) + '" cy="' + ya + '" r="2.4" fill="#2D4839"/>' +
          '<text x="' + (xr + 9) + '" y="' + (yl + 4) + '" font-size="' + fs + '" fill="#2D4839">' + l[2] + "</text>";
      });
      tx += '<text x="' + (W - 6) + '" y="12" font-size="11" text-anchor="end" fill="#7a5a1c">bocal ↑</text><text x="' + (W - 6) + '" y="' + (H - 4) + '" font-size="11" text-anchor="end" fill="#7a5a1c">pé ↓</text>';
    } else {
      ls.forEach(function (l) {
        var x = X(l[0]), ya = Y(l[1]), cima = l[3] === "u" || l[3] === "e", yl = l[3] === "e" ? yt - 48 : l[3] === "u" ? yt - 26 : l[3] === "f" ? yt + h + 52 : yt + h + 30, yb = cima ? yt - (l[3] === "e" ? 44 : 22) : yt + h + (l[3] === "f" ? 34 : 6);
        tx += '<line x1="' + x + '" y1="' + ya + '" x2="' + x + '" y2="' + yb + '" stroke="#2D4839" stroke-width="1"/><circle cx="' + x + '" cy="' + ya + '" r="2.6" fill="#2D4839"/>' +
          '<text x="' + x + '" y="' + yl + '" font-size="' + fs + '" text-anchor="middle" fill="#2D4839">' + l[2] + "</text>";
      });
      tx += '<text x="8" y="16" font-size="12" fill="#7a5a1c">← bocal</text><text x="' + (W - 8) + '" y="16" font-size="12" text-anchor="end" fill="#7a5a1c">pé →</text>';
    }
    return '<div class="naf-detalhe"><p class="pc-mini">Detalhe das janelas, ampliado (vista de cima; desenho ilustrativo, sem medidas)</p><svg class="naf-det-svg' + (vertical ? " naf-det-v" : "") + '" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Detalhe ampliado das janelas da flauta NAF: ninho, saída de ar, canal, janela do som e aresta">' + o + tx + "</svg></div>";
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
    var ar = janelaAr(r);
    var rcH = function (p1, p2, b1, b2, at, rx) { return '<rect x="' + X(Math.max(p1, p2)) + '" y="' + (cy + b1 * esc) + '" width="' + (Math.abs(p2 - p1) * esc) + '" height="' + ((b2 - b1) * esc) + '" rx="' + ((rx || 0) * esc) + '" ' + at + "/>"; };
    s += grupo("janela", regiaoJanelas(r, rcH, false) + tampaoRc(r, rcH) +
      (ar ? '<text x="' + X(ar.centro) + '" y="16" text-anchor="middle" font-size="12" fill="#2D4839">ar</text>' : "") +
      '<line x1="' + xj + '" y1="22" x2="' + xj + '" y2="' + (base + 6) + '" stroke="#9A3B1F" stroke-width="1.2" stroke-dasharray="4 3"/>' +
      '<text x="' + Math.max(xj, 50) + '" y="16" text-anchor="middle" font-size="12" fill="#9A3B1F">' + (ar ? "som" : "janela") + "</text>");
    var xs = [], altas = [], nivelAlto = false, yNota = topo - 12 - (VIS.diametros ? 16 : 0);
    var circulos = "", nots = "", nums = "", dias = "";
    r.furos.forEach(function (f, i) {
      var x = X(f.doPe); xs.push(x);
      circulos += '<circle cx="' + x + '" cy="' + cy + '" r="' + (f.diametro * esc / 2) + '" fill="#2D4839"' + (f.ajustado ? ' stroke="#D9A33A" stroke-width="3"' : "") + "/>" +
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
    var ar = janelaAr(r);
    var rcV = function (p1, p2, b1, b2, at, rx) { return '<rect x="' + (cx + b1 * esc) + '" y="' + Y(Math.max(p1, p2)) + '" width="' + ((b2 - b1) * esc) + '" height="' + (Math.abs(p2 - p1) * esc) + '" rx="' + ((rx || 0) * esc) + '" ' + at + "/>"; };
    s += grupo("janela", regiaoJanelas(r, rcV, true) + tampaoRc(r, rcV) +
      (ar ? '<text x="' + (x1 - 6) + '" y="' + (Y(ar.centro) + 4) + '" text-anchor="end" font-size="11" fill="#2D4839">ar</text>' : "") +
      '<text x="' + (x1 - 6) + '" y="' + (yj + 4) + '" text-anchor="end" font-size="11" fill="#9A3B1F">' + (ar ? "som" : "janela") + "</text>");
    var tx = function (y, t, cor, tam) { return '<text x="' + (x1 - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="' + (tam || 12) + '" fill="' + (cor || "#2D4839") + '">' + t + "</text>"; };
    var circ = "", rot = "", esp = "", bc = "", ant = ype;
    r.furos.forEach(function (f, k) {
      var y = Y(f.doPe);
      circ += '<circle cx="' + cx + '" cy="' + y + '" r="' + (f.diametro * esc / 2) + '" fill="#2D4839"' + (f.ajustado ? ' stroke="#D9A33A" stroke-width="3"' : "") + "/>";
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
    var arM = janelaAr(r);
    if (arM) marcas.push({ p: arM.centro, ar: true, t: "ar (ilustração, não cortar)" });
    marcas.push({ p: L, d: 0, t: "BOCAL: cortar aqui" });
    var tx = Math.max(84, 60 + e.diametroExterno / 2 + 6);
    for (var a = ini; a < fim; a += passo, n++) {
      var b = a + passo + 10, s = '<svg xmlns="http://www.w3.org/2000/svg" width="180mm" height="270mm" viewBox="0 0 180 270">';
      var Y = function (p) { return 25 + (p - a); };
      s += '<text x="5" y="8" font-size="4">Faça sua flauta NAF · igorbastosluthier.com.br' + ' · página ' + n + ' · a cruz marca o centro do furo</text>';
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
        if (mk.ar) s += '<rect x="' + (60 - Math.min(e.janelaLarg, e.diametroExterno) / 2) + '" y="' + (y - e.janelaCompr / 2) + '" width="' + Math.min(e.janelaLarg, e.diametroExterno) + '" height="' + e.janelaCompr + '" fill="none" stroke="#999" stroke-width=".25" stroke-dasharray="1 1"/>';
        else if (mk.janela) s += '<rect x="' + (60 - Math.min(e.janelaLarg, e.diametroExterno) / 2) + '" y="' + (y - e.janelaCompr / 2) + '" width="' + Math.min(e.janelaLarg, e.diametroExterno) + '" height="' + e.janelaCompr + '" fill="none" stroke="#000" stroke-width=".3"/>';
        else if (mk.d) s += '<circle cx="60" cy="' + y + '" r="' + (mk.d / 2) + '" fill="none" stroke="#000" stroke-width=".3"/><line x1="58" y1="' + y + '" x2="62" y2="' + y + '" stroke="#000" stroke-width=".25"/><line x1="60" y1="' + (y - 2) + '" x2="60" y2="' + (y + 2) + '" stroke="#000" stroke-width=".25"/>';
        if (mk.ar) s += '<text x="' + tx + '" y="' + (y + 1.2) + '" font-size="3">' + mk.t + "</text>"; else s += textoMolde(tx, y + 1.2, mk.t, mm(mk.p) + " mm do pé");
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
    $("naf-escala-aviso").hidden = !!escolhida();
    $("naf-linhas").classList.toggle("pers", !escolhida()); /* nota e Hz só se editam na escala personalizada */
    /* Ajuste automático: com os diâmetros sugeridos, os furos que ficariam encostados mudam de tamanho e a posição
       é recalculada (a afinação continua certa). Diâmetro digitado pela pessoa: vale o dela (com botão para ajustar). */
    var aj = null;
    if (!dDigitado && N.ajustarFuros) {
      var e0 = lerEntrada();
      e0.linhas = linhas.map(function (l) { return { nota: l.nota, hz: l.hz, diametro: l.ideal === undefined || l.ideal === "" ? l.d : l.ideal, ativo: l.a }; });
      aj = N.ajustarFuros(e0);
      linhas.forEach(function (l, k) {
        if (!l.a || !(aj.diametros[k] > 0)) return;
        l.d = aj.diametros[k];
        var inp = document.querySelector('#naf-linhas [data-k="' + k + '"][data-c="d"]'); if (inp && document.activeElement !== inp) inp.value = l.d;
      });
    } else if (ajusteManual && linhas.every(function (l, k) { return !l.a || Math.abs(parseFloat(l.d) - ajusteManual.diametros[k]) < 1e-9; })) aj = ajusteManual;
    var e = lerEntrada(), r = N.calcular(e);
    var ajustado = function (k) { return !!(aj && aj.ajustados.some(function (a) { return a.indice === k; })); };
    document.querySelectorAll('#naf-linhas [data-c="d"]').forEach(function (inp) { inp.classList.toggle("pc-aj-in", ajustado(parseInt(inp.getAttribute("data-k"), 10))); });
    var txtAj = "";
    if (aj && aj.ajustados.length) txtAj = AjusteFuros.textoAjuste(aj.ajustados);
    if (aj && !aj.ok && r.ok) txtAj += (txtAj ? " " : "") + "Não deu para separar todos os furos neste tubo: use um tubo mais fino ou outra nota.";
    else if (!aj && dDigitado && (!r.ok || N.apertos(r).length)) txtAj = 'Há furos encostados ou sem lugar. <button type="button" class="pc-link-btn" id="naf-ajustar">Ajustar sozinho</button>';
    $("naf-ajuste").innerHTML = txtAj ? '<p class="pc-ajuste">' + txtAj + "</p>" : "";
    if ($("naf-ajustar")) $("naf-ajustar").onclick = function () {
      ajusteManual = N.ajustarFuros(lerEntrada());
      linhas.forEach(function (l, k) { if (l.a && ajusteManual.diametros[k] > 0) l.d = ajusteManual.diametros[k]; });
      desenharLinhas(); atualizar();
    };
    if (r.ok) r.furos.forEach(function (f) { f.ajustado = ajustado(f.linha - 1); });
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
    notasDaEscala(r);
    if (btFund && Esc && Esc.estado(btFund) === "tocando") Esc.mudarNota(r.fundamental.hz); /* trocou a nota/o Lá tocando: muda na hora */
    /* Hz da nota aparece como sugestão cinza no campo; só o Hz digitado ganha uma linha de texto */
    linhas.forEach(function (l, k) {
      var hzEl = document.querySelector('#naf-linhas [data-k="' + k + '"][data-c="hz"]'), mp = N.parseNota(l.nota), a4 = parseFloat(e.a4);
      if (hzEl) hzEl.placeholder = mp !== null && isFinite(a4) ? mm(N.freqNota(mp, a4), 2) : "";
    });
    r.furos.forEach(function (f) {
      var nm = document.querySelector('#naf-linhas .naf-nome[data-k="' + (f.linha - 1) + '"]'), hzt = document.querySelector('#naf-linhas .naf-hz-txt[data-k="' + (f.linha - 1) + '"]');
      if (nm) nm.textContent = String(f.nota).replace(/^≈\s*/, "");
      if (hzt) hzt.textContent = mm(f.hz, 1) + " Hz";
      var el = document.querySelector('#naf-linhas .naf-info[data-k="' + (f.linha - 1) + '"]'); if (!el) return;
      var t = [];
      if (f.extra) t.push("Furo extra, fora da escala.");
      if (f.fonteHz === "hz") t.push("Vale este valor (≈ " + f.notaProxima.nota + (Math.abs(f.notaProxima.cents) >= 0.5 ? (f.notaProxima.cents > 0 ? " +" : " −") + Math.round(Math.abs(f.notaProxima.cents)) + " cents" : "") + ").");
      el.textContent = t.join(" ");
    });
    var celular = window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
    $("naf-desenho").innerHTML = (celular ? desenhoVertical(r) : desenho(r)) + (VIS.janela ? detalheJanelas(r, celular) : "");
    $("naf-cartoes").innerHTML = r.furos.slice().reverse().map(function (f) {
      return '<div class="pc-cartao' + (f.ajustado ? " pc-aj" : "") + '"><div class="pc-c1"><b>' + f.linha + "º</b> " + f.nota + " <span>Ø " + mm(f.diametro) + "</span></div>" +
        '<div class="pc-c2"><b>' + mm(f.doPe) + "</b> do pé · " + mm(f.daJanela) + " da janela" + (f.espacoAbaixo === null ? "" : " · " + mm(f.espacoAbaixo) + " até o de baixo") + "</div>" +
        '<div class="pc-c3">' + selo(f.razaoCorte) + "</div></div>";
    }).join("");
    $("naf-tabela").querySelector("tbody").innerHTML = r.furos.map(function (f) {
      return "<tr" + (f.ajustado ? ' class="pc-aj"' : "") + '><th scope="row">' + f.linha + "º</th><td>" + f.nota + " <small>" + mm(f.hz, 2) + " Hz</small></td><td>" + mm(f.diametro) + " mm</td><td><b>" + mm(f.doPe) + " mm</b></td><td>" +
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
      if (c === "d") { l.d = l.ideal = t.value; manualDim = true; dDigitado = true; } else { l[c] = t.value; if (c === "nota" || c === "hz") $("naf-escala").value = "personalizada"; }
    } else if (/^naf-(od|parede|jc|jl|ja|cabeca|ponta)$/.test(t.id)) manualDim = true;
    /* temperatura e A4 mudam a solução do modelo: enquanto as medidas são as sugeridas, refaz as sugestões junto
       (senão uma mudança de temperatura poderia deixar as medidas sugeridas sem solução) */
    if ((t.id === "naf-temp" || t.id === "naf-a4") && !manualDim && isFinite(parseFloat(t.value))) { aplicarMedidas(sugestao()); refazerDiametros(); }
    if (t.id === "naf-di") { var p = parseFloat($("naf-parede").value), di = parseFloat(t.value); if (isFinite(p) && isFinite(di)) { $("naf-od").value = Math.round((di + 2 * p) * 100) / 100; manualDim = true; } }
    atualizar();
  });
  $("naf-form").addEventListener("change", function (ev) {
    var id = ev.target.id, pent = !!escolhida();
    if (id === "naf-escala" && pent) { ultimaEscala = escolhida(); opcoesEscala(); refazerNotas(); if (!manualDim) refazerDiametros(); atualizar(); return; }
    if (id === "naf-furos") {
      opcoesEscala(); pent = !!escolhida();
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
  $("naf-voltar-pent").addEventListener("click", function () { $("naf-escala").value = ultimaEscala; refazerNotas(); atualizar(); });
  /* Ouvir a escala da flauta calculada (tônica até a oitava, ou ida e volta); o furo extra não entra */
  if ($("naf-ouvir") && Esc) Esc.ligarBotao($("naf-ouvir"), function () { var m = document.querySelector('input[name="naf-ouvir-modo"]:checked'); return m ? m.value : "ida-e-volta"; },
    function () { return ultimo ? { freqRaiz: ultimo.fundamental.hz, furos: ultimo.furos.map(function (f) { return { hz: f.hz, aux: f.extra }; }) } : null; });
  /* Notas da escala (mesma linha de notas do Pífano): a grave e cada furo da escala, da mais grave à mais aguda; tocar numa nota toca essa nota.
     O furo extra fica de fora, como no "Ouvir escala". */
  var btFund = $("naf-fund-ouvir"), caixaNotas = $("naf-notas-escala");
  function notasDaEscala(r) {
    if (!caixaNotas) return;
    var lista = [{ nome: N.nomePt(midiFund()), hz: r.fundamental.hz }];
    r.furos.forEach(function (f) { if (!f.extra) lista.push({ nome: String(f.nota).replace(/^≈\s*/, ""), hz: f.hz }); });
    lista.sort(function (a, b) { return a.hz - b.hz; });
    var h = lista.map(function (n) {
      return '<span class="pc-par"><button type="button" class="pc-nota" data-hz="' + n.hz + '" aria-label="Ouvir ' + esc(n.nome) + '">' + esc(n.nome) + "</button></span>";
    }).join("");
    if (caixaNotas.innerHTML !== h) caixaNotas.innerHTML = h;
    caixaNotas.setAttribute("aria-label", "Notas da flauta em " + N.nomePt(midiFund()) + ", da grave à mais aguda");
  }
  /* ▶ ao lado da nota grave: contínua até apertar de novo (mesmo som do Pífano) */
  function rotuloFund() { if (btFund) btFund.setAttribute("aria-pressed", String(!!Esc && Esc.estado(btFund) === "tocando")); }
  if (btFund && Esc) {
    btFund.addEventListener("click", function () {
      if (Esc.estado(btFund) === "tocando") Esc.parar();
      else { var a4 = parseFloat($("naf-a4").value), m = midiFund(); if (m !== null && isFinite(a4) && a4 > 0) Esc.sustentar(N.freqNota(m, a4), btFund); }
      rotuloFund();
    });
    Esc.aoMudar(rotuloFund);
  }
  if (caixaNotas && Esc) {
    caixaNotas.addEventListener("click", function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest(".pc-nota") : null; if (!b) return;
      Esc.tocar([parseFloat(b.getAttribute("data-hz"))], { porNota: 0.9, dono: caixaNotas });
      b.classList.add("pc-tocando");
    });
    Esc.aoMudar(function () {
      if (Esc.estado(caixaNotas) === "tocando") return;
      Array.prototype.forEach.call(caixaNotas.querySelectorAll(".pc-tocando"), function (b) { b.classList.remove("pc-tocando"); });
    });
  }
  /* voltou para a aba do Pífano: o som da NAF para */
  if (window.MutationObserver) new MutationObserver(function () {
    if (!$("modo-naf").hidden || !Esc) return;
    [btFund, caixaNotas, $("naf-ouvir")].forEach(function (d) { if (d && Esc.estado(d) !== "parado") Esc.parar(); });
  }).observe($("modo-naf"), { attributes: true, attributeFilter: ["hidden"] });
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
  $("naf-fund").value = "G4"; $("naf-furos").value = "5"; opcoesEscala("pentatonica-menor"); $("naf-a4").value = "440"; $("naf-temp").value = "20";
  if (!(inicio && aplicarLink(inicio))) sugerirTudo();
  mostrarModo(modoNaf());
  if (modoNaf()) atualizar(); else { var tmp = estadoLink(); hashNaf = "#" + encodeURIComponent(JSON.stringify(tmp)); }
})();
