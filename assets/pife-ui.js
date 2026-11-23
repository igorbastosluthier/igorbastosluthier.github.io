/* Calculadora de Pife: interface. Tudo roda no navegador; nada é enviado. */
(function () {
  "use strict";
  var P = window.PifeCalc, Esc = window.Escalas, M = window.PifeModo;
  var $ = function (id) { return document.getElementById(id); };
  var mm = function (v) { return v.toFixed(1).replace(".", ","); };
  var CHAVE = "pifeCalc.v1";
  /* Básico | Avançado (pedido do Igor, 23/11): o Básico pede tom, furos, escala, tubo e furo do sopro e usa os padrões
     (Lá 440, 25 °C, parede ideal, bocal reto, sopro redondo, sem porta-lábios, furos sugeridos). O que se muda no Avançado
     fica guardado e volta ao abrir o Avançado; no Básico não entra na conta. O modo vai junto no link e no que fica salvo. */
  var modo = "basico", paredeManual = false, ajusteBasico = null, itensResultado = [];
  function setModo(m) {
    modo = m === "avancado" ? "avancado" : "basico";
    $("pc-form").classList.toggle("pc-basico", modo === "basico");
    ["basico", "avancado"].forEach(function (k) { var b = $("pc-modo-" + k); if (b) b.setAttribute("aria-pressed", String(k === modo)); });
  }
  function numero(id, padrao) { var v = parseFloat($(id).value); return isFinite(v) ? v : padrao; } /* 0 °C vale 0 */
  function laForm() {
    var v = $("pc-la").value;
    if (v === "outra") { var o = parseFloat(($("pc-la-outra") || {}).value); return isFinite(o) && o > 0 ? o : 440; }
    return parseFloat(v) || 440;
  }
  function setLa(v) {
    v = parseFloat(v) || 440;
    if (v === 440 || v === 432 || !$("pc-la-outra")) $("pc-la").value = String(v);
    else { $("pc-la").value = "outra"; $("pc-la-outra").value = v; }
  }
  /* a afinação da conta, sem refazer a flauta (o afinador pergunta a cada nota) */
  function laConta() { return modo === "avancado" ? laForm() : M.PADRAO.la; }
  /* parede: segue a ideal do tubo até a pessoa digitar a dela (no Avançado) */
  function sincParede() { if (!paredeManual) $("pc-parede").value = P.paredeIdeal(parseFloat($("pc-D").value) || 18); }

  P.TONS.forEach(function (t) {
    var o = document.createElement("option"); o.value = t.id; o.textContent = t.nome; $("pc-tom").appendChild(o);
  });
  $("pc-tom").value = "sol";

  /* Quantidade de furos e escala (as mesmas do app; só aparecem as que cabem inteiras nos furos escolhidos) */
  var selN = $("pc-nfuros"), selEsc = $("pc-escala");
  function nFuros() { var n = selN ? parseInt(selN.value, 10) : 6; return n === 5 || n === 7 ? n : 6; }
  function escalaId() { return selEsc && selEsc.value ? selEsc.value : "diatonica-maior-jonia"; }
  function opcoesEscala(desejada) {
    if (!selEsc || !Esc) return;
    var lista = Esc.aplicaveis("pife", nFuros()), atual = desejada || selEsc.value;
    selEsc.innerHTML = lista.map(function (x) { return '<option value="' + x.id + '">' + x.nome + "</option>"; }).join("");
    selEsc.value = lista.some(function (x) { return x.id === atual; }) ? atual : (lista.some(function (x) { return x.id === Esc.PADRAO.pife; }) ? Esc.PADRAO.pife : lista[0].id);
  }
  function semitons() {
    var l = Esc ? Esc.layout(escalaId(), nFuros(), "pife") : null;
    return l ? l : { furos: P.SEMITONS_ESCALA_MAIOR.slice(), aux: [] };
  }

  var caixa = $("pc-furos"), entradasFuro = [];
  function montarFuros(n) {
    if (entradasFuro.length === n) return;
    caixa.innerHTML = "";
    for (var i = 0; i < n; i++) {
      var l = document.createElement("label");
      l.innerHTML = '<span class="pc-n"></span><input type="number" min="2" max="30" step="0.5" data-i="' + i + '">';
      caixa.appendChild(l);
    }
    entradasFuro = Array.prototype.slice.call(caixa.querySelectorAll("input"));
  }
  opcoesEscala(); montarFuros(nFuros());

  /* Furos: o sugerido é o otimizado (inteiro). Se a pessoa digitar um furo, vale o dela até apertar "voltar aos
     sugeridos"; enquanto não digitar, os furos se reotimizam a cada mudança de tom ou de tubo. */
  var manual = false;
  /* Furos sugeridos: os tamanhos ideais e, se algum furo ficaria encostado, o ajuste automático do tamanho (as posições
     são recalculadas pela conta normal, então a afinação continua certa). */
  var ajusteAtual = null;
  function sugerir() {
    /* os furos do Avançado (no Básico a conta usa os sugeridos para os padrões, sem mexer nestes campos) */
    var s = M.sugeridos(lerForm());
    ajusteAtual = s.ajuste;
    entradasFuro.forEach(function (inp, k) { inp.value = s.furos[k]; });
    manual = false;
  }
  function mesmos(a, b) { return a.length === b.length && a.every(function (x, i) { return Math.abs(x - b[i]) < 1e-9; }); }
  function dicaTubo() {
    var t = $("pc-tom").options[$("pc-tom").selectedIndex].text, alvo = P.tuboSugerido($("pc-tom").value);
    $("pc-dica-tubo").textContent = "Indicado para " + t + ": " + mm(alvo) + " mm.";
  }
  /* "usar 18,0 mm": o tubo indicado do tom e o furo do sopro na mesma proporção */
  function usarTubo(alvo) { $("pc-D").value = alvo; $("pc-emb").value = Math.round(alvo * 0.53); sincParede(); if (!manual) sugerir(); atualizar(); }

  /* o que está nos campos (inclusive os do Avançado, mesmo escondidos) */
  function lerForm() {
    return {
      tom: $("pc-tom").value, la: laForm(), temp: numero("pc-temp", 25),
      D: parseFloat($("pc-D").value) || 19, parede: parseFloat($("pc-parede").value) || 3, paredeManual: paredeManual,
      emb: parseFloat($("pc-emb").value) || 10,
      embForma: $("pc-emb-forma").value, embL: parseFloat($("pc-emb-l").value) || 9, embC: parseFloat($("pc-emb-c").value) || 11,
      cone: $("pc-cone").checked,
      lip: $("pc-lip-sim").checked ? (parseFloat($("pc-lip").value) || 0) : 0,
      nf: nFuros(), escala: escalaId(), semitons: semitons().furos, aux: semitons().aux,
      furos: entradasFuro.map(function (x) { return parseFloat(x.value) || 8; }),
      manual: manual, modo: modo
    };
  }
  /* o que entra na conta: no Avançado, os campos; no Básico, os padrões e os furos sugeridos */
  function lerEntrada() {
    var raw = lerForm();
    if (modo === "avancado") return raw;
    var b = M.entradaBasica(raw);
    ajusteBasico = b.ajuste;
    return b.e;
  }

  function aplicar(e) {
    $("pc-tom").value = e.tom; setLa(e.la); $("pc-temp").value = e.temp;
    $("pc-D").value = e.D; $("pc-parede").value = e.parede; $("pc-emb").value = e.emb;
    $("pc-emb-forma").value = e.embForma || "redondo"; if (e.embL) $("pc-emb-l").value = e.embL; if (e.embC) $("pc-emb-c").value = e.embC;
    $("pc-lip-sim").checked = !!e.lip; $("pc-cone").checked = !!e.cone; if (e.lip) $("pc-lip").value = e.lip;
    /* links antigos não dizem se a parede foi digitada: digitada é a que difere da ideal */
    paredeManual = e.paredeManual !== undefined ? !!e.paredeManual : Math.abs((parseFloat(e.parede) || 0) - P.paredeIdeal(parseFloat(e.D) || 18)) > 1e-9;
    sincParede();
    setModo(M.modoDoEstado(e, "basico"));
    /* links antigos (sem escala) são o pife de 6 furos na escala maior */
    if (selN) selN.value = String(e.nf === 5 || e.nf === 7 ? e.nf : 6);
    opcoesEscala(e.escala || "diatonica-maior-jonia"); montarFuros(nFuros());
    if (!e.furos || e.furos.length !== nFuros()) { sugerir(); return; }
    entradasFuro.forEach(function (x, k) { if (e.furos && e.furos[k]) x.value = e.furos[k]; });
    manual = !!e.manual; /* furos digitados pela pessoa continuam valendo ao reabrir o link */
    if (!manual) sugerir(); /* sugeridos: refaz (e ajusta) com a conta atual */
  }

  /* Opções de visualização do desenho (marcar/desmarcar). */
  var VIS = { tubo: true, notas: true, numeros: true, espacos: true, boca: false, total: true, rolha: true, diametros: false };
  try { var salvo = JSON.parse(localStorage.getItem(CHAVE + ".vis") || "null"); if (salvo) VIS = Object.assign(VIS, salvo); } catch (x) { /* padrão */ }

  function cota(x1, x2, y, texto, cor) {
    var m = (x1 + x2) / 2, s = '<g stroke="' + cor + '" stroke-width="1.2">';
    s += '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '"/>';
    s += '<line x1="' + x1 + '" y1="' + (y - 5) + '" x2="' + x1 + '" y2="' + (y + 5) + '"/><line x1="' + x2 + '" y1="' + (y - 5) + '" x2="' + x2 + '" y2="' + (y + 5) + '"/></g>';
    return s + '<text x="' + m + '" y="' + (y - 4) + '" text-anchor="middle" font-size="12" fill="' + cor + '">' + texto + '</text>';
  }

  function desenho(r, e) {
    var W = 1000, x0 = VIS.rolha ? 80 : 20, total = r.rolha + 25 + r.bocaAoPe, esc = (W - x0 - 20 - (VIS.tubo ? 150 : 0)) / total;
    var topo = 18 + (VIS.notas ? 18 : 0) + (VIS.diametros ? 16 : 0);
    /* escala real: a mesma em comprimento e em largura (1 mm = esc px) */
    var ext = e.D + 2 * e.parede, h = ext * esc, cy = topo + h / 2, hi = e.D * esc;
    var boca = x0 + (r.rolha + 25) * esc, pe = boca + r.bocaAoPe * esc, base = cy + h / 2;
    var linhas = [], y = base + (VIS.numeros ? 24 : 10);
    var s = '<rect x="' + x0 + '" y="' + (cy - h / 2) + '" width="' + (pe - x0) + '" height="' + h + '" rx="2" fill="#D9A33A" stroke="#7a5a1c" stroke-width="2"/>';
    if (VIS.tubo) {
      /* parede: o buraco interno desenhado dentro do tubo, na proporção real com a medida de fora */
      s += '<rect x="' + x0 + '" y="' + (cy - hi / 2) + '" width="' + (pe - x0) + '" height="' + hi + '" fill="#f0c56a"/>';
      s += '<g stroke="#7a5a1c" stroke-width="1" stroke-dasharray="5 4"><line x1="' + x0 + '" y1="' + (cy - hi / 2) + '" x2="' + pe + '" y2="' + (cy - hi / 2) + '"/><line x1="' + x0 + '" y1="' + (cy + hi / 2) + '" x2="' + pe + '" y2="' + (cy + hi / 2) + '"/></g>';
      var xc = pe + 22;
      s += '<g stroke="#9A3B1F" stroke-width="1.2"><line x1="' + xc + '" y1="' + (cy - hi / 2) + '" x2="' + xc + '" y2="' + (cy + hi / 2) + '"/><line x1="' + (xc - 5) + '" y1="' + (cy - hi / 2) + '" x2="' + (xc + 5) + '" y2="' + (cy - hi / 2) + '"/><line x1="' + (xc - 5) + '" y1="' + (cy + hi / 2) + '" x2="' + (xc + 5) + '" y2="' + (cy + hi / 2) + '"/>';
      s += '<line x1="' + (pe - 4) + '" y1="' + (cy - hi / 2) + '" x2="' + xc + '" y2="' + (cy - hi / 2) + '" stroke-dasharray="2 2"/><line x1="' + (pe - 4) + '" y1="' + (cy + hi / 2) + '" x2="' + xc + '" y2="' + (cy + hi / 2) + '" stroke-dasharray="2 2"/></g>';
      var dy = Math.max(h / 2 + 2, 16); /* rótulos com pelo menos 16 px entre si, mesmo em tubo fino */
      s += '<text x="' + (xc + 8) + '" y="' + (cy + 4) + '" font-size="12" fill="#9A3B1F">Ø interno ' + mm(e.D) + '</text>';
      s += '<g stroke="#7E2A5E" stroke-width="1.2"><line x1="' + (xc + 4) + '" y1="' + (cy - h / 2) + '" x2="' + (xc + 4) + '" y2="' + (cy - hi / 2) + '"/></g>';
      s += '<text x="' + (xc + 8) + '" y="' + (cy - dy) + '" font-size="12" fill="#7E2A5E">parede ' + mm(e.parede) + '</text>';
      s += '<text x="' + (xc + 8) + '" y="' + (cy + dy + 8) + '" font-size="11" fill="#7a5a1c">Ø externo ' + mm(ext) + '</text>';
    }
    var xr = boca - r.rolha * esc;
    s += '<line x1="' + xr + '" y1="' + (cy - h / 2) + '" x2="' + xr + '" y2="' + (cy + h / 2) + '" stroke="#9A3B1F" stroke-width="3" stroke-dasharray="4 3"/>';
    var eC = e.embForma === "oval" ? e.embC : e.emb, eL = e.embForma === "oval" ? e.embL : e.emb;
    /* visto de cima: o porta-lábios é a placa em volta do furo do sopro */
    if (e.lip) s += '<rect x="' + (boca - eC * esc * 1.7) + '" y="' + (cy - h * 0.42) + '" width="' + (eC * esc * 3.4) + '" height="' + (h * 0.84) + '" rx="' + (h * 0.2) + '" fill="#9A3B1F" stroke="#5e2414"/>' +
      (VIS.numeros ? '<text x="' + boca + '" y="' + (cy - h / 2 - 6) + '" text-anchor="middle" font-size="12" fill="#9A3B1F">porta-lábios ' + mm(e.lip) + '</text>' : '');
    s += '<ellipse cx="' + boca + '" cy="' + cy + '" rx="' + (eC * esc / 2) + '" ry="' + (eL * esc / 2) + '" fill="#2D4839"/>';
    r.furos.forEach(function (f) {
      var x = boca + f.daBoca * esc;
      s += '<circle cx="' + x + '" cy="' + cy + '" r="' + (f.diametro * esc / 2) + '" fill="#2D4839"' + (f.ajustado ? ' stroke="#D9A33A" stroke-width="3"' : "") + "/>";
      if (VIS.numeros) s += '<text x="' + x + '" y="' + (base + 16) + '" text-anchor="middle" font-size="14" fill="#2D4839">' + (f.indice + 1) + '</text>';
      if (VIS.notas) s += '<text x="' + x + '" y="' + (cy - h / 2 - 6 - (VIS.diametros ? 16 : 0)) + '" text-anchor="middle" font-size="13" fill="#7E2A5E">' + f.nota + '</text>';
      if (VIS.diametros) s += '<text x="' + x + '" y="' + (cy - h / 2 - 6) + '" text-anchor="middle" font-size="11" fill="#2D4839">Ø' + mm(f.diametro) + '</text>';
    });
    if (VIS.numeros) s += '<text x="' + boca + '" y="' + (base + 16) + '" text-anchor="middle" font-size="12" fill="#2D4839">sopro</text>';
    var furosX = r.furos.map(function (f) { return boca + f.daBoca * esc; });
    if (VIS.espacos) {
      var pontos = [pe].concat(furosX);
      var ult = r.furos.length - 1;
      for (var i = 0; i <= ult; i++) s += cota(pontos[i + 1], pontos[i], y + 14, mm(r.furos[i].espaco), "#7E2A5E");
      s += cota(boca, furosX[ult], y + 14, mm(r.furos[ult].daBoca), "#7E2A5E");
      y += 26;
    }
    if (VIS.boca) {
      r.furos.forEach(function (f, k) {
        s += cota(pe, boca + f.daBoca * esc, y + 14 + k * 18, f.nota + ": " + mm(f.doPe), "#2D4839");
      });
      y += 18 * r.furos.length + 8;
    }
    if (VIS.rolha) { s += cota(xr, boca, y + 14, "", "#9A3B1F") + '<text x="' + (xr - 4) + '" y="' + (y + 18) + '" text-anchor="end" font-size="12" fill="#9A3B1F">rolha ' + mm(r.rolha) + '</text>'; }
    if (VIS.total) {
      s += cota(boca, pe, y + 14, "da boca ao pé: " + mm(r.bocaAoPe) + " mm", "#9A3B1F");
      y += 26;
      s += cota(x0, pe, y + 14, "tubo inteiro (com 25 mm de bocal além da rolha): " + mm(r.bocaAoPe + r.rolha + 25) + " mm", "#7a5a1c");
    }
    if (VIS.rolha && !VIS.total) y += 26;
    var H = y + 26;
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Desenho do pífano com os furos e as medidas">' + s + '</svg>';
  }

  /* Celular: a flauta desenhada em pé (escala real), notas e furos à esquerda, medidas à direita */
  function cotaV(x, ya, yb, txt, cor) {
    cor = cor || "#7E2A5E";
    var s = '<g stroke="' + cor + '" stroke-width="1.4"><line x1="' + x + '" y1="' + ya + '" x2="' + x + '" y2="' + yb + '"/>' +
      '<line x1="' + (x - 5) + '" y1="' + ya + '" x2="' + (x + 5) + '" y2="' + ya + '"/><line x1="' + (x - 5) + '" y1="' + yb + '" x2="' + (x + 5) + '" y2="' + yb + '"/></g>';
    return s + (txt ? '<text x="' + (x + 7) + '" y="' + ((ya + yb) / 2 + 5) + '" font-size="13" fill="' + cor + '">' + txt + '</text>' : "");
  }

  /* cota vertical com o texto girado ao longo da linha (como no desenho deitado do PC) */
  function cotaVR(x, ya, yb, txt, cor) {
    cor = cor || "#7E2A5E";
    var m = (ya + yb) / 2;
    var s = '<g stroke="' + cor + '" stroke-width="1.3"><line x1="' + x + '" y1="' + ya + '" x2="' + x + '" y2="' + yb + '"/>' +
      '<line x1="' + (x - 4) + '" y1="' + ya + '" x2="' + (x + 4) + '" y2="' + ya + '"/><line x1="' + (x - 4) + '" y1="' + yb + '" x2="' + (x + 4) + '" y2="' + yb + '"/></g>';
    return s + (txt ? '<text x="' + (x - 3) + '" y="' + m + '" font-size="11" fill="' + cor + '" text-anchor="middle" transform="rotate(-90 ' + (x - 3) + ' ' + m + ')">' + txt + '</text>' : "");
  }

  /* Celular: o mesmo desenho do PC, em pé. Da esquerda para a direita: rótulos, tubo, espaços entre furos,
     uma linha da boca até cada furo, rolha, boca ao pé e tubo inteiro. */
  function desenhoVertical(r, e) {
    var total = r.rolha + 25 + r.bocaAoPe, H = 860, y0 = 30, esc = (H - 60) / total;
    var ext = e.D + 2 * e.parede, w = ext * esc;
    var esq = 6 + Math.max(VIS.notas || VIS.numeros ? 52 : 34, VIS.rolha ? 62 : 0);
    var x1 = esq, cx = x1 + w / 2, col = x1 + w + 16;
    var colEsp = col; if (VIS.espacos) col += 18;
    var colBoca = col; if (VIS.boca) col += r.furos.length * 16;
    var colTot = col; if (VIS.total) col += 2 * 16;
    var W = Math.max(col + 8, x1 + w + 20);
    var boca = y0 + (r.rolha + 25) * esc, pe = boca + r.bocaAoPe * esc, s = "";
    s += '<rect x="' + x1 + '" y="' + y0 + '" width="' + w + '" height="' + (pe - y0) + '" rx="2" fill="#D9A33A" stroke="#7a5a1c" stroke-width="2"/>';
    if (VIS.tubo) s += '<rect x="' + (cx - e.D * esc / 2) + '" y="' + y0 + '" width="' + (e.D * esc) + '" height="' + (pe - y0) + '" fill="#f0c56a"/>';
    var yr = boca - r.rolha * esc;
    s += '<line x1="' + x1 + '" y1="' + yr + '" x2="' + (x1 + w) + '" y2="' + yr + '" stroke="#9A3B1F" stroke-width="3" stroke-dasharray="4 3"/>';
    var eC = e.embForma === "oval" ? e.embC : e.emb, eL = e.embForma === "oval" ? e.embL : e.emb;
    /* porta-lábios também no desenho do celular (antes só aparecia no do PC) */
    if (e.lip) s += '<rect x="' + (cx - w * 0.42) + '" y="' + (boca - eC * esc * 1.7) + '" width="' + (w * 0.84) + '" height="' + (eC * esc * 3.4) + '" rx="' + (w * 0.2) + '" fill="#9A3B1F" stroke="#5e2414"/>' +
      /* 16/10: em uma linha o rótulo passava da borda no celular ("ta-lábios"): duas linhas curtas */
      '<text x="' + (x1 - 12) + '" y="' + (boca + 17) + '" text-anchor="end" font-size="10" fill="#9A3B1F">porta-</text>' +
      '<text x="' + (x1 - 12) + '" y="' + (boca + 29) + '" text-anchor="end" font-size="10" fill="#9A3B1F">lábios ' + mm(e.lip) + '</text>';
    s += '<ellipse cx="' + cx + '" cy="' + boca + '" rx="' + (eL * esc / 2) + '" ry="' + (eC * esc / 2) + '" fill="#2D4839"/>';
    var tx = function (y, t, cor, tam) { return '<text x="' + (x1 - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="' + (tam || 12) + '" fill="' + (cor || "#2D4839") + '">' + t + '</text>'; };
    s += '<text x="' + (x1 - 12) + '" y="' + (boca + 4) + '" text-anchor="end" font-size="11" fill="#2D4839">sopro</text>';
    var ant = pe;
    r.furos.forEach(function (f, k) {
      var y = boca + f.daBoca * esc;
      s += '<circle cx="' + cx + '" cy="' + y + '" r="' + (f.diametro * esc / 2) + '" fill="#2D4839"' + (f.ajustado ? ' stroke="#D9A33A" stroke-width="3"' : "") + "/>";
      var l1 = [VIS.numeros ? (f.indice + 1) + "º" : "", VIS.notas ? f.nota : ""].filter(Boolean).join(" ");
      if (l1) s += tx(y - (VIS.diametros ? 4 : 0), l1);
      if (VIS.diametros) s += tx(y + (l1 ? 9 : 0), "Ø" + mm(f.diametro), "#7a5a1c", 10);
      if (VIS.espacos) s += cotaVR(colEsp, ant, y, mm(f.espaco));
      if (VIS.boca) s += cotaVR(colBoca + k * 16, pe, y, f.nota + ": " + mm(f.doPe), "#2D4839");
      ant = y;
    });
    if (VIS.espacos) s += cotaVR(colEsp, ant, boca, mm(r.furos[r.furos.length - 1].daBoca));
    var xt = colTot;
    if (VIS.rolha) s += cotaVR(x1 - 6, yr, boca, "", "#9A3B1F") + '<text x="' + (x1 - 12) + '" y="' + (yr + 3) + '" text-anchor="end" font-size="11" fill="#9A3B1F">rolha ' + mm(r.rolha) + '</text>';
    if (VIS.total) { s += cotaVR(xt, boca, pe, "boca ao pé: " + mm(r.bocaAoPe), "#9A3B1F"); s += cotaVR(xt + 16, y0, pe, "tubo inteiro: " + mm(r.bocaAoPe + r.rolha + 25), "#7a5a1c"); }
    s += tx(pe - 4, "pé", null, 11);
    W = Math.max(W, 120); var bas = pe + 22, mid = W / 2, extra = "";
    if (VIS.tubo) {
      ["Ø interno " + mm(e.D), "parede " + mm(e.parede), "Ø externo " + mm(ext)].forEach(function (t, k) {
        extra += '<text x="' + mid + '" y="' + (bas + k * 15) + '" text-anchor="middle" font-size="11" fill="#7a5a1c">' + t + '</text>';
      }); bas += 30;
    }
    return '<svg class="pc-vert" viewBox="0 0 ' + W + ' ' + (bas + 18) + '" role="img" aria-label="Desenho do pífano em pé, com os furos e as medidas">' + s + extra + '</svg>';
  }

  function painelVis() {
    var nomes = { notas: "Notas", numeros: "Nº dos furos", diametros: "Ø dos furos", espacos: "Entre furos",
      boca: "Até o pé", total: "Comprimento", rolha: "Rolha", tubo: "Tubo e parede" };
    $("pc-vis").innerHTML = '<span class="pc-mini pc-vis-t">Mostrar no desenho:</span>' + Object.keys(nomes).map(function (k) {
      return '<label><input type="checkbox" data-vis="' + k + '"' + (VIS[k] ? " checked" : "") + '> ' + nomes[k] + '</label>';
    }).join("");
  }

  function molde(r, e) {
    /* Páginas A4 em pé; cada uma mostra 240 mm do tubo, com sobreposição de 10 mm e régua de 10 cm. */
    var ini = -r.rolha - 15, fim = r.bocaAoPe + 10, passo = 230, paginas = "";
    var marcas = [{ x: 0, d: e.embForma === "oval" ? e.embC : e.emb, t: e.embForma === "oval" ? "SOPRO (centro) · oval " + mm(e.embL) + " × " + mm(e.embC) : "SOPRO (centro)" }, { x: -r.rolha, d: 0, t: "ROLHA (face de dentro)" }, { x: r.bocaAoPe, d: 0, t: "PÉ: cortar aqui" }];
    r.furos.forEach(function (f) { marcas.push({ x: f.daBoca, d: f.diametro, t: (f.indice + 1) + "º furo · " + f.nota + " · Ø " + mm(f.diametro) + " mm (fure com " + mm(f.diametro - 1) + " e abra)" }); });
    var n = 1;
    for (var a = ini; a < fim; a += passo, n++) {
      var b = a + passo + 10, s = '<svg xmlns="http://www.w3.org/2000/svg" width="180mm" height="270mm" viewBox="0 0 180 270">';
      s += '<text x="5" y="8" font-size="4">Faça sua flauta · igorbastosluthier.com.br · ' + r.tom.nome + ' · página ' + n + '</text>';
      s += '<text x="5" y="14" font-size="3.2">A régua abaixo deve ter 10 cm. Se não tiver, imprima em tamanho real (100%).</text>';
      s += '<line x1="5" y1="18" x2="105" y2="18" stroke="#000" stroke-width=".4"/>';
      for (var k = 0; k <= 100; k += 10) s += '<line x1="' + (5 + k) + '" y1="16" x2="' + (5 + k) + '" y2="20" stroke="#000" stroke-width=".3"/>';
      var X = function (v) { return 25 + (v - a); };
      s += '<rect x="0" y="0" width="0" height="0"/>';
      s += '<line x1="60" y1="' + X(Math.max(a, ini)) + '" x2="60" y2="' + X(Math.min(b, fim)) + '" stroke="#000" stroke-width=".5"/>';
      marcas.forEach(function (m) {
        if (m.x < a || m.x > b) return;
        var y = X(m.x);
        s += '<line x1="40" y1="' + y + '" x2="80" y2="' + y + '" stroke="#000" stroke-width=".3"/>';
        if (m.d) s += '<circle cx="60" cy="' + y + '" r="' + (m.d / 2) + '" fill="none" stroke="#000" stroke-width=".3"/>';
        s += '<text x="84" y="' + (y + 1.2) + '" font-size="3.6">' + m.t + ' · ' + mm(m.x) + ' mm do sopro</text>';
      });
      if (b < fim) s += '<text x="5" y="' + X(b) + '" font-size="3">✂ emendar com a próxima página nesta linha</text><line x1="0" y1="' + X(b) + '" x2="180" y2="' + X(b) + '" stroke="#000" stroke-dasharray="2 2" stroke-width=".3"/>';
      paginas += '<div class="pc-pag">' + s + '</svg></div>';
    }
    return paginas;
  }

  /* Alcance pelo corte (fc/f): quanto mais alto, mais fácil a 2ª e a 3ª oitava saírem nesse furo. */
  function nivel(r) {
    /* oitavas estimadas pelo corte do furo (estimativa, não medição) */
    if (r >= 2.8) return { c: "#2D4839", t: "Ótimo", o: "~3 oitavas" };
    if (r >= 2.2) return { c: "#2D4839", t: "Ótimo", o: "~2,5 oitavas" };
    if (r >= 1.7) return { c: "#5b7d3a", t: "Bom", o: "~2 oitavas" };
    if (r >= 1.4) return { c: "#D9A33A", t: "Limitado", o: "~1,5 oitava" };
    return { c: "#9A3B1F", t: "Fraco", o: "~1 oitava" };
  }
  function selo(r) { var n = nivel(r); return '<span class="pc-selo" style="--c:' + n.c + '">● ' + n.t + ' · ' + n.o + '</span>'; }
  function alcance(r) {
    var pior = Math.min.apply(null, r.furos.map(function (f) { return f.razaoCorte; })), n = nivel(pior);
    var frase = { "Ótimo": "Agudos fáceis em todos os furos.",
      "Bom": "A 3ª oitava fica difícil em algum furo.",
      "Limitado": "Os agudos (2ª oitava) vão exigir sopro firme. Aumentar os furos marcados em amarelo melhora.",
      "Fraco": "Algum furo está pequeno demais: a nota sai abafada. Aumente os furos marcados em vermelho." }[n.t];
    return '<div class="pc-alcance" style="--c:' + n.c + '"><b>Alcance: ' + n.t + ' (' + n.o + ', estimado)</b> · ' + frase +
      ' <a href="#alcance" class="pc-q" aria-label="O que é o alcance">?</a></div>';
  }

  /* Cabeça parabólica do Boehm: d(x) = 0,9 D + 0,1 D (x / Lc)^2, x medido da rolha, Lc = 1/4 do comprimento total */
  function cabeca(e, r) {
    var total = r.rolha + r.bocaAoPe, Lc = total / 4, x = r.rolha;
    return { inicio: Lc, sopro: e.D * (0.9 + 0.1 * Math.pow(Math.min(x / Lc, 1), 2)) };
  }

  /* tabela de digitação do tom (imagens do site, por nota) */
  var DIG = ["C", "Cs", "D", "Eb", "E", "F", "Fs", "G", "Gs", "A", "Bb", "B"];
  function digitacao() {
    /* a tabela de digitação do site é a do pife de 6 furos na escala maior */
    var box = $("digitacao"), padrao = nFuros() === 6 && escalaId() === "diatonica-maior-jonia";
    if (box) box.hidden = !padrao;
    if (!padrao) return;
    var tom = P.TONS.filter(function (t) { return t.id === $("pc-tom").value; })[0], k = DIG[((tom.midi % 12) + 12) % 12];
    $("pc-dig-img").src = "img/tabelas/tabela_" + k + ".webp"; $("pc-dig-link").href = "img/tabelas/tabela_" + k + ".png";
    $("pc-dig-img").alt = "Tabela de digitação do pife em " + tom.nome;
  }

  /* aviso de campo: só aparece quando há algo fora do lugar; some quando a pessoa acerta */
  function alerta(id, textos) {
    var el = $(id); if (!el) return;
    var h = textos.filter(Boolean).join(" ");
    if (el.innerHTML !== h) el.innerHTML = h;
    el.hidden = !h;
  }
  function faixa(id, un) {
    var el = $(id); if (!el || el.value === "") return "";
    var v = parseFloat(el.value), mn = parseFloat(el.min), mx = parseFloat(el.max), f = function (x) { return String(x).replace(".", ","); };
    return isFinite(v) && (v < mn || v > mx) ? "Fora da faixa da calculadora: use de " + f(mn) + " a " + f(mx) + un + "." : "";
  }
  function avisosNosCampos(e, r) {
    var c = M.avisosCampos(e, r), txt = function (k) { return (c[k] || []).map(function (a) { return a.texto; }); }, n = 0;
    var tubo = (c.D || [])[0], linhaD = txt("D"), av = modo === "avancado";
    if (tubo) linhaD.push('<button type="button" class="pc-link-btn" id="pc-usar-tubo" data-alvo="' + tubo.alvo + '">usar ' + mm(tubo.alvo) + " mm</button>");
    var grupos = {
      "pc-al-D": linhaD,
      "pc-al-emb": e.embForma === "oval" ? [] : txt("emb").concat(av ? [faixa("pc-emb", " mm")] : []),
      "pc-al-oval": av && e.embForma === "oval" ? txt("oval").concat([faixa("pc-emb-l", " mm") || faixa("pc-emb-c", " mm")]) : [],
      "pc-al-parede": av ? txt("parede").concat([faixa("pc-parede", " mm")]) : [],
      "pc-al-temp": av ? [faixa("pc-temp", " °C")] : [],
      "pc-al-la": av && $("pc-la").value === "outra" ? [faixa("pc-la-outra", " Hz")] : [],
      "pc-al-lip": av && e.lip ? [faixa("pc-lip", " mm")] : []
    };
    Object.keys(grupos).forEach(function (id) { var l = grupos[id].filter(Boolean); n += l.length; alerta(id, l); });
    return n;
  }

  function atualizar() {
    dicaTubo();
    digitacao();
    var Dt = parseFloat($("pc-D").value) || 18, ideal = P.paredeIdeal(Dt), pw = parseFloat($("pc-parede").value);
    $("pc-dica-parede").innerHTML = "Ideal para esse tubo: " + mm(ideal) + " mm." + (paredeManual && Math.abs(pw - ideal) > 1e-9 ?
      ' <button type="button" class="pc-link-btn" id="pc-usar-parede">usar ' + mm(ideal) + " mm</button>" : "");
    if ($("pc-dica-emb")) $("pc-dica-emb").textContent = "Para este tubo, comece com uns " + Math.round(Dt * 0.53) + " mm (um pouco mais que a metade do diâmetro interno).";
    var oval = modo === "avancado" && $("pc-emb-forma").value === "oval";
    $("pc-emb-r").hidden = oval; $("pc-emb-o").hidden = !oval;
    $("pc-lip-box").hidden = !$("pc-lip-sim").checked;
    if ($("pc-la-outra-box")) $("pc-la-outra-box").hidden = $("pc-la").value !== "outra";
    var e = lerEntrada(), r = P.calcular(e);
    /* aviso curto do ajuste automático (ou dos furos encostados, se a pessoa digitou os tamanhos) */
    var aj = modo === "basico" ? ajusteBasico : ajusteAtual && mesmos(ajusteAtual.diametros, e.furos) ? ajusteAtual : null, caixaAj = $("pc-ajuste");
    r.furos.forEach(function (f) { f.ajustado = !!(aj && aj.ajustados.some(function (a) { return a.indice === f.indice; })); });
    entradasFuro.forEach(function (inp, k) { inp.classList.toggle("pc-aj-in", r.furos[k].ajustado); });
    if (caixaAj) {
      var txt = "";
      if (aj && aj.ajustados.length) txt = AjusteFuros.textoAjuste(aj.ajustados);
      if (aj && !aj.ok) txt += (txt ? " " : "") + "Não deu para separar todos os furos neste tubo: use um tubo mais fino, outro tom ou outra escala.";
      else if (!aj && manual && P.apertos(e, r.furos).length) txt = 'Há furos encostados. <button type="button" class="pc-link-btn" id="pc-ajustar">Ajustar sozinho</button>';
      caixaAj.innerHTML = txt ? '<p class="pc-ajuste">' + txt + "</p>" : "";
      var bt = $("pc-ajustar");
      if (bt) bt.onclick = function () {
        ajusteAtual = P.ajustarFuros(lerEntrada());
        entradasFuro.forEach(function (inp, k) { inp.value = ajusteAtual.diametros[k]; });
        atualizar();
      };
    }
    entradasFuro.forEach(function (inp, k) {
      inp.previousElementSibling.textContent = (k + 1) + "º · " + r.furos[k].nota;
    });
    $("pc-desenho").innerHTML = (window.matchMedia && window.matchMedia("(max-width: 640px)").matches) ? desenhoVertical(r, e) : desenho(r, e);
    /* celular: um cartão curto por furo, no lugar da tabela larga */
    $("pc-cartoes").innerHTML = r.furos.slice().reverse().map(function (f) {
      return '<div class="pc-cartao' + (f.ajustado ? " pc-aj" : "") + '"><div class="pc-c1"><b>' + (f.indice + 1) + 'º</b> ' + f.nota + ' <span>Ø ' + mm(f.diametro) + '</span></div>' +
        '<div class="pc-c2"><b>' + mm(f.daBoca) + '</b> da boca · ' + mm(f.espaco) + ' até o de baixo</div>' +
        '<div class="pc-c3">' + selo(f.razaoCorte) + '</div></div>';
    }).join("");
    $("pc-tabela").querySelector("tbody").innerHTML = r.furos.map(function (f) {
      return "<tr" + (f.ajustado ? ' class="pc-aj"' : "") + "><th scope=\"row\">" + (f.indice + 1) + "º</th><td>" + f.nota + "</td><td>" + mm(f.diametro) + " mm</td><td><b>" + mm(f.daBoca) + " mm</b></td><td>" + mm(f.doPe) + " mm</td><td>" + mm(f.espaco) + " mm</td><td>" + selo(f.razaoCorte) + "</td></tr>";
    }).join("");
    $("pc-alcance").innerHTML = alcance(r);
    $("pc-resumo").innerHTML =
      "<li><span>Da boca (centro do sopro) até o pé</span><b>" + mm(r.bocaAoPe) + " mm</b></li>" +
      (e.lip ? "<li><span>Chaminé do sopro (parede + porta-lábios " + mm(e.lip) + " mm)</span><b>" + mm(e.parede + e.lip) + " mm</b></li>" : "") +
      "<li><span>Distância da rolha até o centro do furo do sopro</span><b>" + mm(r.rolha) + " mm</b></li>" +
      (e.cone ? "<li><span>Bocal cônico: diâmetro interno no centro do sopro</span><b>" + mm(cabeca(e, r).sopro) + " mm</b></li>" +
      "<li><span>Bocal cônico: diâmetro interno na rolha</span><b>" + mm(e.D * 0.9) + " mm</b></li>" +
      "<li><span>Bocal cônico: o estreitamento começa a esta distância da rolha</span><b>" + mm(cabeca(e, r).inicio) + " mm</b></li>" : "") +
      "<li><span>Nota grave (tudo fechado)</span><b>" + r.tom.nome + " · " + r.f0.toFixed(1).replace(".", ",") + " Hz</b></li>";
    /* avisos: os de um campo aparecem embaixo dele; os do resultado (furos e alcance dos dedos) aqui */
    var nCampos = avisosNosCampos(e, r);
    itensResultado = M.avisosResultado(e, r);
    var marcados = itensResultado.filter(function (a) { return a.tipo === "furo-grande" || a.tipo === "furo-fraco"; }).map(function (a) { return a.furo; });
    entradasFuro.forEach(function (inp, k) { inp.classList.toggle("pc-in-aviso", marcados.indexOf(k) >= 0); });
    $("pc-avisos").innerHTML = itensResultado.length
      ? '<div class="pc-aviso"><b>Atenção</b><ul>' + itensResultado.map(function (a, k) {
        var b = a.sugestao ? ' <button type="button" class="pc-link-btn" data-alcance="' + k + '">usar ' + mm(a.sugestao.para) + " mm no " + (a.sugestao.furo + 1) + "º furo</button>" : "";
        return "<li>" + a.texto + b + "</li>"; }).join("") + "</ul></div>"
      : nCampos ? "" : '<p class="pc-ok">Tudo dentro do normal para esse tubo.</p>';
    $("pc-aj-furo").innerHTML = r.furos.map(function (f) { return '<option value="' + f.indice + '">' + (f.indice + 1) + "º furo · " + f.nota + "</option>"; }).join("");
    $("pc-molde").innerHTML = molde(r, e);
    /* guarda os campos (com os do Avançado) e o modo; o link reproduz o mesmo cálculo */
    try { localStorage.setItem(CHAVE, JSON.stringify(raw)); } catch (x) { /* sem armazenamento: segue */ }
    window.__pifeHash = "#" + encodeURIComponent(JSON.stringify(raw));
    if (!window.__modoNaf) history.replaceState(null, "", window.__pifeHash); /* no modo NAF a URL é da NAF */
  }

  /* início: link > salvo > padrão */
  var inicial = null;
  try { if (location.hash.length > 2 && !window.__modoNaf) inicial = JSON.parse(decodeURIComponent(location.hash.slice(1))); } catch (x) { inicial = null; }
  if (!inicial) { try { inicial = JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch (x) { inicial = null; } }
  if (inicial && inicial.tom) aplicar(inicial); else { sincParede(); sugerir(); }

  /* Básico | Avançado */
  function trocarModo(m) {
    if (m === modo) return;
    var laAntes = laConta();
    setModo(m);
    if (modo === "avancado") { sincParede(); if (!manual) sugerir(); }
    atualizar();
    /* o afinador ("Afinar este pife") refaz o mapa só se a afinação da conta mudou */
    if (laConta() !== laAntes) $("pc-la").dispatchEvent(new Event("change"));
  }
  ["basico", "avancado"].forEach(function (k) { var b = $("pc-modo-" + k); if (b) b.addEventListener("click", function () { trocarModo(k); }); });
  /* botões dentro dos avisos: usar o tubo indicado, a parede ideal ou o furo que cabe no alcance dos dedos */
  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.getAttribute) return;
    if (t.id === "pc-usar-tubo") { usarTubo(parseFloat(t.getAttribute("data-alvo"))); return; }
    if (t.id === "pc-usar-parede") { paredeManual = false; sincParede(); if (!manual) sugerir(); atualizar(); return; }
    var k = t.getAttribute("data-alcance"); if (k === null) return;
    var a = itensResultado[parseInt(k, 10)]; if (!a || !a.sugestao) return;
    if (modo === "basico") {
      /* a sugestão é para a flauta do Básico: ela passa para o Avançado como está, e lá o furo muda */
      var e = lerEntrada();
      setLa(440); $("pc-temp").value = 25; paredeManual = false; sincParede(); $("pc-cone").checked = false;
      $("pc-emb-forma").value = "redondo"; $("pc-lip-sim").checked = false;
      entradasFuro.forEach(function (inp, j) { inp.value = e.furos[j]; });
      setModo("avancado");
    }
    entradasFuro[a.sugestao.furo].value = a.sugestao.para; manual = true;
    atualizar();
  });
  /* "?" de cada campo: abre e fecha a explicação curta (vale também para a NAF) */
  document.addEventListener("click", function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest(".pc-ajuda") : null; if (!b) return;
    var alvo = $(b.getAttribute("aria-controls")); if (!alvo) return;
    var abrir = b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", String(abrir)); alvo.hidden = !abrir;
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape") return;
    var b = document.activeElement && document.activeElement.closest ? document.activeElement.closest(".pc-ajuda") : null;
    if (b && b.getAttribute("aria-expanded") === "true") b.click();
  });

  painelVis();
  $("pc-vis").addEventListener("change", function (ev) {
    var k = ev.target.getAttribute("data-vis"); if (!k) return;
    VIS[k] = ev.target.checked;
    try { localStorage.setItem(CHAVE + ".vis", JSON.stringify(VIS)); } catch (x) { /* sem armazenamento */ }
    atualizar();
  });
  caixa.addEventListener("input", function () { manual = true; });
  $("pc-form").addEventListener("input", function (ev) {
    if (ev.target === $("pc-parede")) paredeManual = true;
    sincParede();
    if (ev.target === selN) { opcoesEscala(); montarFuros(nFuros()); sugerir(); }
    else if (ev.target === selEsc) { if (!manual) sugerir(); }
    else if (!manual && ev.target.closest && !ev.target.closest("#pc-furos")) sugerir();
    atualizar();
  });
  /* Ouvir a escala do pife calculado (tônica até a oitava, ou ida e volta) */
  var ouvir = $("pc-ouvir");
  if (ouvir && Esc) Esc.ligarBotao(ouvir, function () { var m = document.querySelector('input[name="pc-ouvir-modo"]:checked'); return modo === "avancado" && m ? m.value : "ida-e-volta"; },
    function () { var r = P.calcular(lerEntrada()); return { freqRaiz: r.f0, furos: r.furos.map(function (f) { return { hz: f.freq, aux: !!f.aux }; }) }; });
  $("pc-sugerir").addEventListener("click", function () { sugerir(); atualizar(); });
  $("pc-imprimir").addEventListener("click", function () { window.print(); });
  $("pc-link").addEventListener("click", function () {
    var done = function () { $("pc-copiado").hidden = false; setTimeout(function () { $("pc-copiado").hidden = true; }, 2500); };
    if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, done); else done();
  });
  $("pc-aj-btn").addEventListener("click", function () {
    var res = P.ajuste(lerEntrada(), parseInt($("pc-aj-furo").value, 10), parseFloat($("pc-aj-cents").value) || 0);
    $("pc-aj-res").textContent = res.texto;
  });
  /* Qual tom combina com o tubo: o indicado de cada tom ± 1 mm é a faixa boa; os mais próximos primeiro. */
  function usarTom(id, d) { $("pc-tom").value = id; $("pc-D").value = d; manual = false; sincParede(); sugerir(); atualizar(); $("pc-form").scrollIntoView({ behavior: "smooth" }); }
  function qualTom() {
    var d = parseFloat($("pc-qt-d").value) || 0, caixa = $("pc-qt-res");
    if (!d) { caixa.innerHTML = ""; return; }
    var bons = P.TONS.map(function (t) { var x = P.tuboSugerido(t.id); return { t: t, dif: Math.abs(x - d) }; })
      .filter(function (o) { return o.dif <= 1; }).sort(function (a, b) { return a.dif - b.dif; });
    if (!bons.length) {
      caixa.innerHTML = '<p class="pc-aviso">Esse tubo fica fora da faixa dos pifes da calculadora (de ' + mm(P.tuboSugerido(P.TONS[0].id)) + " a " + mm(P.tuboSugerido(P.TONS[P.TONS.length - 1].id)) + " mm).</p>";
      return;
    }
    caixa.innerHTML = '<div class="pc-qt-melhor"><span>Melhor tom: <b>' + bons[0].t.nome + '</b></span>' +
      '<button type="button" class="btn" data-tom="' + bons[0].t.id + '">Calcular este pife</button></div>' +
      (bons.length > 1 ? '<p class="pc-mini">Também servem:</p><div class="pc-qt-chips">' + bons.slice(1).map(function (o) {
        return '<button type="button" class="pc-chip" data-tom="' + o.t.id + '">' + o.t.nome + "</button>"; }).join("") + "</div>" : "");
    caixa.querySelectorAll("[data-tom]").forEach(function (b) { b.onclick = function () { usarTom(b.getAttribute("data-tom"), d); }; });
  }
  $("pc-qt-tab").querySelector("tbody").innerHTML = P.TONS.map(function (t) {
    var x = P.tuboSugerido(t.id);
    return "<tr><th scope=\"row\">" + t.nome + "</th><td><b>" + mm(x) + " mm</b></td><td>" + mm(x - 1) + " a " + mm(x + 1) + " mm</td></tr>";
  }).join("");
  $("pc-qt-d").addEventListener("input", qualTom);
  qualTom();
  if (window.matchMedia) { var mq = window.matchMedia("(max-width: 640px)"); (mq.addEventListener ? mq.addEventListener("change", atualizar) : mq.addListener(atualizar)); }
  atualizar();
  /* Voltar/Avançar do navegador de volta ao Pífano: recarrega o estado do link (usado por naf-ui.js) */
  window.PifeUI = { semitons: function () { return semitons(); }, la: laConta, modo: function () { return modo; }, recarregar: function () {
    try { var s = location.hash.length > 2 ? JSON.parse(decodeURIComponent(location.hash.slice(1))) : null; if (s && s.tom) { aplicar(s); atualizar(); } } catch (x) { /* link inválido: mantém */ }
  } };
})();
