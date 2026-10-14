/* Calculadora de Pife: interface. Tudo roda no navegador; nada é enviado. */
(function () {
  "use strict";
  var P = window.PifeCalc;
  var $ = function (id) { return document.getElementById(id); };
  var mm = function (v) { return v.toFixed(1).replace(".", ","); };
  var CHAVE = "pifeCalc.v1";

  P.TONS.forEach(function (t) {
    var o = document.createElement("option"); o.value = t.id; o.textContent = t.nome; $("pc-tom").appendChild(o);
  });
  $("pc-tom").value = "sol";

  var caixa = $("pc-furos");
  for (var i = 0; i < 6; i++) {
    var l = document.createElement("label");
    l.innerHTML = '<span class="pc-n"></span><input type="number" min="2" max="30" step="0.5" data-i="' + i + '">';
    caixa.appendChild(l);
  }
  var entradasFuro = caixa.querySelectorAll("input");

  /* Furos: o sugerido é o otimizado (inteiro). Se a pessoa digitar um furo, vale o dela até apertar "voltar aos
     sugeridos"; enquanto não digitar, os furos se reotimizam a cada mudança de tom ou de tubo. */
  var manual = false;
  function sugerir() {
    var e = lerEntrada(), f = P.otimizarFuros(e);
    entradasFuro.forEach(function (inp, k) { inp.value = f[k]; });
    manual = false;
  }
  function dicaTubo() {
    var t = $("pc-tom").options[$("pc-tom").selectedIndex].text, alvo = P.tuboSugerido($("pc-tom").value);
    var D = parseFloat($("pc-D").value);
    $("pc-dica-tubo").innerHTML = "Indicado para " + t + ": " + mm(alvo) + " mm. " + (Math.abs(D - alvo) < 0.01 ? "" :
      '<button type="button" class="pc-link-btn" id="pc-usar-tubo">usar ' + mm(alvo) + ' mm</button>');
    var b = $("pc-usar-tubo"); if (b) b.onclick = function () { $("pc-D").value = alvo; $("pc-emb").value = Math.round(alvo * 0.53); if (!manual) sugerir(); atualizar(); };
  }



  function lerEntrada() {
    return {
      tom: $("pc-tom").value, la: parseFloat($("pc-la").value), temp: parseFloat($("pc-temp").value) || 25,
      D: parseFloat($("pc-D").value) || 19, parede: parseFloat($("pc-parede").value) || 3,
      emb: parseFloat($("pc-emb").value) || 10,
      embForma: $("pc-emb-forma").value, embL: parseFloat($("pc-emb-l").value) || 9, embC: parseFloat($("pc-emb-c").value) || 11,
      cone: $("pc-cone").checked,
      lip: $("pc-lip-sim").checked ? (parseFloat($("pc-lip").value) || 0) : 0,
      furos: Array.prototype.map.call(entradasFuro, function (x) { return parseFloat(x.value) || 8; })
    };
  }

  function aplicar(e) {
    $("pc-tom").value = e.tom; $("pc-la").value = String(e.la); $("pc-temp").value = e.temp;
    $("pc-D").value = e.D; $("pc-parede").value = e.parede; $("pc-emb").value = e.emb;
    $("pc-emb-forma").value = e.embForma || "redondo"; if (e.embL) $("pc-emb-l").value = e.embL; if (e.embC) $("pc-emb-c").value = e.embC;
    $("pc-lip-sim").checked = !!e.lip; $("pc-cone").checked = !!e.cone; if (e.lip) $("pc-lip").value = e.lip;
    entradasFuro.forEach(function (x, k) { if (e.furos && e.furos[k]) x.value = e.furos[k]; });
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
    var W = 1000, x0 = 20, total = r.rolha + 25 + r.bocaAoPe, esc = (W - 40 - (VIS.tubo ? 150 : 0)) / total;
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
      s += '<text x="' + (xc + 8) + '" y="' + (cy + 4) + '" font-size="12" fill="#9A3B1F">Ø interno ' + mm(e.D) + '</text>';
      s += '<g stroke="#7E2A5E" stroke-width="1.2"><line x1="' + (xc + 4) + '" y1="' + (cy - h / 2) + '" x2="' + (xc + 4) + '" y2="' + (cy - hi / 2) + '"/></g>';
      s += '<text x="' + (xc + 8) + '" y="' + (cy - hi / 2 - 2) + '" font-size="12" fill="#7E2A5E">parede ' + mm(e.parede) + '</text>';
      s += '<text x="' + (xc + 8) + '" y="' + (cy + h / 2 + 2) + '" font-size="11" fill="#7a5a1c">Ø externo ' + mm(ext) + '</text>';
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
      s += '<circle cx="' + x + '" cy="' + cy + '" r="' + (f.diametro * esc / 2) + '" fill="#2D4839"/>';
      if (VIS.numeros) s += '<text x="' + x + '" y="' + (base + 16) + '" text-anchor="middle" font-size="14" fill="#2D4839">' + (f.indice + 1) + '</text>';
      if (VIS.notas) s += '<text x="' + x + '" y="' + (cy - h / 2 - 6 - (VIS.diametros ? 16 : 0)) + '" text-anchor="middle" font-size="13" fill="#7E2A5E">' + f.nota + '</text>';
      if (VIS.diametros) s += '<text x="' + x + '" y="' + (cy - h / 2 - 6) + '" text-anchor="middle" font-size="11" fill="#2D4839">Ø' + mm(f.diametro) + '</text>';
    });
    if (VIS.numeros) s += '<text x="' + boca + '" y="' + (base + 16) + '" text-anchor="middle" font-size="12" fill="#2D4839">sopro</text>';
    var furosX = r.furos.map(function (f) { return boca + f.daBoca * esc; });
    if (VIS.espacos) {
      var pontos = [pe].concat(furosX);
      for (var i = 0; i < 6; i++) s += cota(pontos[i + 1], pontos[i], y + 14, mm(r.furos[i].espaco), "#7E2A5E");
      s += cota(boca, furosX[5], y + 14, mm(r.furos[5].daBoca), "#7E2A5E");
      y += 26;
    }
    if (VIS.boca) {
      r.furos.slice().reverse().forEach(function (f, k) {
        s += cota(boca, boca + f.daBoca * esc, y + 14 + k * 18, f.nota + ": " + mm(f.daBoca), "#2D4839");
      });
      y += 18 * 6 + 8;
    }
    if (VIS.rolha) { s += cota(xr, boca, y + 14, "", "#9A3B1F") + '<text x="' + (xr - 4) + '" y="' + (y + 18) + '" text-anchor="end" font-size="12" fill="#9A3B1F">rolha ' + mm(r.rolha) + '</text>'; }
    if (VIS.total) {
      s += cota(boca, pe, y + 14, "da boca ao pé: " + mm(r.bocaAoPe) + " mm", "#9A3B1F");
      y += 26;
      s += cota(x0, pe, y + 14, "tubo inteiro (com 25 mm de cabeça além da rolha): " + mm(r.bocaAoPe + r.rolha + 25) + " mm", "#7a5a1c");
    }
    if (VIS.rolha && !VIS.total) y += 26;
    var H = y + 26;
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Desenho do pífano com os furos e as medidas">' + s + '</svg>';
  }

  /* Celular: a flauta desenhada em pé (escala real), notas e furos à esquerda, medidas à direita */
  function desenhoVertical(r, e) {
    var H = 900, y0 = 20, total = r.rolha + 25 + r.bocaAoPe, esc = (H - 60) / total;
    var ext = e.D + 2 * e.parede, w = ext * esc, cx = 150, x1 = cx - w / 2;
    var boca = y0 + (r.rolha + 25) * esc, pe = boca + r.bocaAoPe * esc, s = "";
    s += '<rect x="' + x1 + '" y="' + y0 + '" width="' + w + '" height="' + (pe - y0) + '" rx="2" fill="#D9A33A" stroke="#7a5a1c" stroke-width="2"/>';
    if (VIS.tubo) s += '<rect x="' + (cx - e.D * esc / 2) + '" y="' + y0 + '" width="' + (e.D * esc) + '" height="' + (pe - y0) + '" fill="#f0c56a"/>';
    var yr = boca - r.rolha * esc;
    s += '<line x1="' + x1 + '" y1="' + yr + '" x2="' + (x1 + w) + '" y2="' + yr + '" stroke="#9A3B1F" stroke-width="3" stroke-dasharray="4 3"/>';
    var eC = e.embForma === "oval" ? e.embC : e.emb, eL = e.embForma === "oval" ? e.embL : e.emb;
    s += '<ellipse cx="' + cx + '" cy="' + boca + '" rx="' + (eL * esc / 2) + '" ry="' + (eC * esc / 2) + '" fill="#2D4839"/>';
    s += '<text x="' + (x1 - 10) + '" y="' + (boca + 5) + '" text-anchor="end" font-size="15" fill="#2D4839">sopro</text>';
    if (VIS.rolha) s += '<text x="' + (x1 - 10) + '" y="' + (yr + 5) + '" text-anchor="end" font-size="14" fill="#9A3B1F">rolha ' + mm(r.rolha) + '</text>';
    var ant = pe;
    r.furos.forEach(function (f) {
      var y = boca + f.daBoca * esc;
      s += '<circle cx="' + cx + '" cy="' + y + '" r="' + (f.diametro * esc / 2) + '" fill="#2D4839"/>';
      var rot = (VIS.numeros ? (f.indice + 1) + "º " : "") + (VIS.notas ? f.nota : "") + (VIS.diametros ? " · Ø" + mm(f.diametro) : "");
      if (rot) s += '<text x="' + (x1 - 10) + '" y="' + (y + 5) + '" text-anchor="end" font-size="15" fill="#2D4839">' + rot + '</text>';
      if (VIS.espacos) s += '<text x="' + (x1 + w + 12) + '" y="' + ((y + ant) / 2 + 5) + '" font-size="14" fill="#7E2A5E">↕ ' + mm(f.espaco) + '</text>';
      if (VIS.boca) s += '<text x="' + (x1 + w + 12) + '" y="' + (y + 5) + '" font-size="13" fill="#2D4839">' + mm(f.daBoca) + ' da boca</text>';
      ant = y;
    });
    if (VIS.espacos) s += '<text x="' + (x1 + w + 12) + '" y="' + ((boca + ant) / 2 + 5) + '" font-size="14" fill="#7E2A5E">↕ ' + mm(r.furos[5].daBoca) + '</text>';
    s += '<text x="' + (x1 - 10) + '" y="' + (pe - 4) + '" text-anchor="end" font-size="14" fill="#2D4839">pé</text>';
    var bas = pe + 26;
    if (VIS.total) s += '<text x="150" y="' + bas + '" text-anchor="middle" font-size="15" fill="#9A3B1F">da boca ao pé: ' + mm(r.bocaAoPe) + ' mm</text>';
    if (VIS.tubo) s += '<text x="150" y="' + (bas + 22) + '" text-anchor="middle" font-size="13" fill="#7a5a1c">Ø interno ' + mm(e.D) + ' · parede ' + mm(e.parede) + ' · Ø externo ' + mm(ext) + '</text>';
    return '<svg class="pc-vert" viewBox="0 0 330 ' + (bas + 40) + '" role="img" aria-label="Desenho do pífano em pé, com os furos e as medidas">' + s + '</svg>';
  }

  function painelVis() {
    var nomes = { tubo: "Diâmetro e parede do tubo", notas: "Notas", numeros: "Número dos furos", espacos: "Distância entre furos", boca: "Distância de cada furo até a boca",
      total: "Comprimento", rolha: "Rolha (stopper)", diametros: "Diâmetro dos furos" };
    $("pc-vis").innerHTML = '<span class="pc-mini">Mostrar no desenho:</span>' + Object.keys(nomes).map(function (k) {
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
      s += '<text x="5" y="8" font-size="4">Calculadora de pife · igorbastosluthier.com.br · ' + r.tom.nome + ' · página ' + n + '</text>';
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
    var tom = P.TONS.filter(function (t) { return t.id === $("pc-tom").value; })[0], k = DIG[((tom.midi % 12) + 12) % 12];
    $("pc-dig-img").src = "img/tabelas/tabela_" + k + ".webp"; $("pc-dig-link").href = "img/tabelas/tabela_" + k + ".png";
    $("pc-dig-img").alt = "Tabela de digitação do pife em " + tom.nome;
  }

  function atualizar() {
    dicaTubo();
    digitacao();
    $("pc-dica-parede").textContent = "Ideal para esse tubo: " + mm(P.paredeIdeal(parseFloat($("pc-D").value) || 18)) + " mm.";
    $("pc-emb-r").hidden = $("pc-emb-forma").value === "oval"; $("pc-emb-o").hidden = !$("pc-emb-r").hidden;
    $("pc-lip-box").hidden = !$("pc-lip-sim").checked;
    var e = lerEntrada(), r = P.calcular(e);
    entradasFuro.forEach(function (inp, k) {
      inp.previousElementSibling.textContent = (k + 1) + "º · " + r.furos[k].nota;
    });
    $("pc-desenho").innerHTML = (window.matchMedia && window.matchMedia("(max-width: 640px)").matches) ? desenhoVertical(r, e) : desenho(r, e);
    $("pc-tabela").querySelector("tbody").innerHTML = r.furos.map(function (f) {
      return "<tr><th scope=\"row\">" + (f.indice + 1) + "º</th><td>" + f.nota + "</td><td>" + mm(f.diametro) + " mm</td><td><b>" + mm(f.daBoca) + " mm</b></td><td>" + mm(f.doPe) + " mm</td><td>" + mm(f.espaco) + " mm</td><td>" + selo(f.razaoCorte) + "</td></tr>";
    }).join("");
    $("pc-alcance").innerHTML = alcance(r);
    $("pc-resumo").innerHTML =
      "<li><span>Da boca (centro do sopro) até o pé</span><b>" + mm(r.bocaAoPe) + " mm</b></li>" +
      "<li><span>Distância da rolha até o centro do furo do sopro</span><b>" + mm(r.rolha) + " mm</b></li>" +
      (e.cone ? "<li><span>Cabeça cônica: diâmetro interno no centro do sopro</span><b>" + mm(cabeca(e, r).sopro) + " mm</b></li>" +
      "<li><span>Cabeça cônica: diâmetro interno na rolha</span><b>" + mm(e.D * 0.9) + " mm</b></li>" +
      "<li><span>Cabeça cônica: o estreitamento começa a esta distância da rolha</span><b>" + mm(cabeca(e, r).inicio) + " mm</b></li>" : "") +
      "<li><span>Nota grave (tudo fechado)</span><b>" + r.tom.nome + " · " + r.f0.toFixed(1).replace(".", ",") + " Hz</b></li>";
    $("pc-avisos").innerHTML = r.avisos.length
      ? '<div class="pc-aviso"><b>Atenção</b><ul>' + r.avisos.map(function (a) { return "<li>" + a + "</li>"; }).join("") + "</ul></div>"
      : '<p class="pc-ok">Tudo dentro do normal para esse tubo.</p>';
    $("pc-aj-furo").innerHTML = r.furos.map(function (f) { return '<option value="' + f.indice + '">' + (f.indice + 1) + "º furo · " + f.nota + "</option>"; }).join("");
    $("pc-molde").innerHTML = molde(r, e);
    try { localStorage.setItem(CHAVE, JSON.stringify(e)); } catch (x) { /* sem armazenamento: segue */ }
    history.replaceState(null, "", "#" + encodeURIComponent(JSON.stringify(e)));
  }

  /* início: link > salvo > padrão */
  var inicial = null;
  try { if (location.hash.length > 2) inicial = JSON.parse(decodeURIComponent(location.hash.slice(1))); } catch (x) { inicial = null; }
  if (!inicial) { try { inicial = JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch (x) { inicial = null; } }
  if (inicial && inicial.tom) aplicar(inicial); else sugerir();
  if (!inicial) sugerir();

  painelVis();
  $("pc-vis").addEventListener("change", function (ev) {
    var k = ev.target.getAttribute("data-vis"); if (!k) return;
    VIS[k] = ev.target.checked;
    try { localStorage.setItem(CHAVE + ".vis", JSON.stringify(VIS)); } catch (x) { /* sem armazenamento */ }
    atualizar();
  });
  caixa.addEventListener("input", function () { manual = true; });
  $("pc-form").addEventListener("input", function (ev) {
    if (!manual && ev.target.closest && !ev.target.closest("#pc-furos")) sugerir();
    atualizar();
  });
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
  function usarTom(id, d) { $("pc-tom").value = id; $("pc-D").value = d; manual = false; sugerir(); atualizar(); $("pc-form").scrollIntoView({ behavior: "smooth" }); }
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
})();
