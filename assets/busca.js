/* Busca do site: botao no cabecalho (ou tecla "/") abre o painel; resultados enquanto digita.
   Indice: assets/busca.json, gerado por tools/build_search_index.py e baixado so na primeira busca.
   Sem dependencias, sem rastreadores. O nucleo (prepara/busca) roda tambem no node (tests/busca.test.js). */
(function () {
  "use strict";

  var STOP = {};
  "a e o de da das dos em no na nos nas com para pra por um uma os as ao aos que se ou the of and sua seu meu minha mais muito este esta essa esse isso"
    .split(" ").forEach(function (w) { STOP[w] = 1; });
  var STOP_CAMPO = Object.assign({}, STOP, { "do": 1 }); /* "do" no texto e preposicao; o tom Do vem no campo k */
  var SUAVE = { "do": 1 };                                /* se nada casar, a busca tenta de novo sem estes */
  var PESO = { t: 3, s: 3, d: 2, k: 1 }; /* s: outros nomes do titulo (ferramentas) */
  var BONUS_TITULO = { f: 1.2, g: 0.5, p: 0 }; /* todas as palavras no titulo: ferramenta e pagina sobem */
  var GRUPOS = { f: "Ferramentas", g: "Páginas", p: "Peças" };
  var ORDEM_GRUPO = { f: 0, p: 1, g: 2 };
  var LIMITE = { f: 4, g: 6, p: 30 };
  var TOTAL_PAINEL = 30;
  var WA = "https://wa.me/5575982901157?text=";

  function norm(s) {
    return String(s || "").replace(/♯/g, "#").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }
  function fichas(s) { return norm(s).match(/[a-z0-9#]+/g) || []; }

  /* distancia de edicao <= 1 (troca, insercao, remocao ou duas letras trocadas de lugar) */
  function umErro(a, b) {
    var la = a.length, lb = b.length, i = 0;
    if (Math.abs(la - lb) > 1 || a === b) return false;
    while (i < la && i < lb && a[i] === b[i]) i++;
    if (la === lb) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
    return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
  }

  function prepara(dados) {
    var itens = dados.itens, vocab = new Map(), sin = new Map();
    (dados.sin || []).forEach(function (grupo) {
      grupo.forEach(function (w) {
        var alt = sin.get(w) || [];
        grupo.forEach(function (o) { if (o !== w && alt.indexOf(o) < 0) alt.push(o); });
        sin.set(w, alt);
      });
    });
    itens.forEach(function (it, i) {
      it.i = i;
      it.nt = norm(it.t + (it.s ? " | " + it.s : ""));
      it.pg = it.g === "g" && it.a === "Página";
      ["t", "s", "d", "k", "a"].forEach(function (campo) {
        var peso = PESO[campo] || 1, stop = campo === "k" ? STOP : STOP_CAMPO;
        fichas(it[campo]).forEach(function (w) {
          if (stop[w]) return;
          var lista = vocab.get(w);
          if (!lista) { lista = new Map(); vocab.set(w, lista); }
          if ((lista.get(i) || 0) < peso) lista.set(i, peso);
        });
      });
    });
    return { itens: itens, vocab: vocab, palavras: Array.from(vocab.keys()), sin: sin };
  }

  /* pontos de cada item para uma palavra da busca (exata > comeco da palavra > um erro de digitacao) */
  function casa(ix, q) {
    var res = new Map(), alts = [[q, 1, true]];
    if (q.length >= 4 && q[q.length - 1] === "s") alts.push([q.slice(0, -1), 0.95, false]);
    (ix.sin.get(q) || []).forEach(function (s) { alts.push([s, 0.9, false]); });
    function soma(lista, f, tok) {
      if (!lista) return;
      lista.forEach(function (peso, i) {
        var v = peso * f, ant = res.get(i);
        if (!ant || ant.v < v) res.set(i, { v: v, w: tok, tit: peso >= 3 });
      });
    }
    alts.forEach(function (alt) {
      var a = alt[0], f = alt[1];
      soma(ix.vocab.get(a), f, a);
      if (a.length >= 4 || (a.length >= 2 && !ix.vocab.has(a))) { /* "sol" nao vira "solida"; "jac" vira "jacaranda" */
        ix.palavras.forEach(function (w) {
          if (w.length > a.length && w.lastIndexOf(a, 0) === 0) soma(ix.vocab.get(w), f * (0.55 + 0.3 * a.length / w.length), w);
        });
      }
      if (alt[2] && a.length >= 5) {
        ix.palavras.forEach(function (w) {
          if (w !== a && w.length >= 5 && umErro(a, w)) /* "aguia" nao vira "guia" */ soma(ix.vocab.get(w), f * 0.4, w);
        });
      }
    });
    return res;
  }

  function busca(ix, texto) {
    var todas = fichas(texto);
    if (!todas.length) return [];
    var qs = todas.filter(function (w) { return !STOP[w]; });
    if (!qs.length) qs = todas;
    qs = qs.filter(function (w, i) { return qs.indexOf(w) === i; });
    var r = junta(ix, qs, norm(texto).trim());
    if (!r.length) {
      var sem = qs.filter(function (w) { return !SUAVE[w]; });
      if (sem.length && sem.length < qs.length) r = junta(ix, sem, sem.join(" "));
    }
    return r;
  }

  function junta(ix, qs, frase) {
    var mapas = qs.map(function (q) { return casa(ix, q); });
    mapas.sort(function (a, b) { return a.size - b.size; });
    var out = [];
    mapas[0].forEach(function (m0, i) {
      var total = 0, achou = [], noTitulo = true;
      for (var j = 0; j < mapas.length; j++) {
        var m = mapas[j].get(i);
        if (!m) return;
        total += m.v; achou.push(m.w); noTitulo = noTitulo && m.tit;
      }
      var it = ix.itens[i];
      if (frase.length > 1 && it.nt.indexOf(frase) >= 0) total += it.nt.lastIndexOf(frase, 0) === 0 ? 1.5 : 1;
      if (noTitulo) total += it.pg ? 1 : BONUS_TITULO[it.g];
      out.push({ item: it, pontos: total, achou: achou });
    });
    out.sort(function (a, b) { return b.pontos - a.pontos || a.item.i - b.item.i; });
    return out;
  }

  /* resultados -> grupos ordenados pela melhor nota de cada grupo */
  function agrupa(res, semLimite) {
    var grupos = {}, lista = [];
    res.forEach(function (r) {
      var g = r.item.g;
      if (!grupos[g]) { grupos[g] = { g: g, nome: GRUPOS[g], total: 0, melhor: r.pontos, itens: [] }; lista.push(grupos[g]); }
      grupos[g].total++;
      grupos[g].itens.push(r);
    });
    lista.sort(function (a, b) { return b.melhor - a.melhor || ORDEM_GRUPO[a.g] - ORDEM_GRUPO[b.g]; });
    if (!semLimite) {
      var usados = 0;
      lista.forEach(function (gr) { if (gr.g !== "p") { gr.itens = gr.itens.slice(0, LIMITE[gr.g]); usados += gr.itens.length; } });
      lista.forEach(function (gr) { if (gr.g === "p") gr.itens = gr.itens.slice(0, Math.min(LIMITE.p, TOTAL_PAINEL - usados)); });
      lista = lista.filter(function (gr) { return gr.itens.length; });
    }
    return lista;
  }

  var nucleo = { norm: norm, fichas: fichas, umErro: umErro, prepara: prepara, busca: busca, agrupa: agrupa };
  if (typeof module !== "undefined" && module.exports) module.exports = nucleo;
  if (typeof document === "undefined") return;

  /* ---------------- tela ---------------- */
  var indice = null, carregando = null;
  function carrega() {
    if (indice) return Promise.resolve(indice);
    if (!carregando) {
      carregando = fetch("assets/busca.json", { cache: "no-cache" })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (d) { indice = prepara(d); return indice; })
        .catch(function (e) { carregando = null; throw e; });
    }
    return carregando;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  /* marca as palavras encontradas (sem ligar para acento) */
  function marca(texto, achou) {
    return String(texto).split(/([\s,.;:()\/\-–—"“”]+)/).map(function (p) {
      var n = norm(p).replace(/[^a-z0-9#]/g, "");
      if (n && achou.some(function (w) { return n === w || (w.length >= 3 && n.lastIndexOf(w, 0) === 0); })) return "<mark>" + esc(p) + "</mark>";
      return esc(p);
    }).join("");
  }
  var ICONE = {
    f: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20 15 9m2-2 2-2M14 4l6 6M9 14l1 1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    g: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  };

  function htmlResultados(grupos, q, total, pagina) {
    var h = "";
    grupos.forEach(function (gr) {
      h += '<section class="busca-g"><h3>' + gr.nome + " <small>" + gr.total + "</small></h3><ul>";
      gr.itens.forEach(function (r) {
        var it = r.item, achou = r.achou;
        var fig = it.m ? '<img src="' + esc(it.m) + '" alt="" width="56" height="56" loading="lazy" decoding="async">' : '<span class="busca-ic">' + (ICONE[it.g] || ICONE.g) + "</span>";
        var ext = /^https?:/.test(it.u) ? ' target="_blank" rel="noopener"' : "";
        var linha = (it.a ? '<i>' + esc(it.a) + "</i> " : "") + marca(it.d || "", achou);
        h += '<li><a class="busca-it" href="' + esc(it.u) + '"' + ext + ">" + fig + '<span class="busca-tx"><b>' + marca(it.t, achou) + "</b><small>" + linha + "</small></span></a></li>";
      });
      h += "</ul></section>";
    });
    var mostrados = grupos.reduce(function (s, g) { return s + g.itens.length; }, 0);
    if (!pagina && total > mostrados) h += '<p class="busca-mais"><a href="busca.html?q=' + encodeURIComponent(q) + '">Ver todos os ' + total + " resultados →</a></p>";
    return h;
  }
  function htmlNada(q) {
    var txt = "Olá, Igor! Procurei no site por \"" + q + "\" e não achei. Pode me ajudar?";
    return '<div class="busca-nada"><p>Nada encontrado para <b>“' + esc(q) + '”</b>.</p><p>Tente outra palavra (pífano, jacarandá, Sol, estojo…) ou me pergunte direto: eu respondo no WhatsApp.</p>' +
      '<a class="btn wa" href="' + WA + encodeURIComponent(txt) + '" target="_blank" rel="noopener">Perguntar no WhatsApp</a></div>';
  }

  function render(alvo, status, q, pagina) {
    q = q.trim();
    if (!q) { alvo.innerHTML = ""; status.textContent = pagina ? "" : "Digite o que procura: modelo, madeira, tom, desenho…"; return []; }
    var res = busca(indice, q);
    if (!res.length) { alvo.innerHTML = htmlNada(q); status.textContent = "Nenhum resultado."; return []; }
    var grupos = agrupa(res, pagina);
    alvo.innerHTML = htmlResultados(grupos, q, res.length, pagina);
    status.textContent = res.length === 1 ? "1 resultado." : res.length + " resultados.";
    return res;
  }

  /* --- painel --- */
  var painel, entrada, caixaRes, status, quemAbriu, sel = -1, tempo;
  function montaPainel() {
    if (painel) return;
    painel = document.createElement("div");
    painel.className = "busca";
    painel.id = "busca";
    painel.hidden = true;
    painel.setAttribute("role", "dialog");
    painel.setAttribute("aria-modal", "true");
    painel.setAttribute("aria-label", "Buscar no site");
    painel.innerHTML =
      '<div class="busca-caixa">' +
      '<form class="busca-topo" role="search" action="busca.html">' +
      '<svg class="busca-lupa" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 21 21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      '<label class="busca-sr" for="busca-q">Buscar no site</label>' +
      '<input id="busca-q" name="q" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" placeholder="Pífano, jacarandá, águia, Sol…" aria-controls="busca-res" aria-describedby="busca-status">' +
      '<button type="button" class="busca-x" aria-label="Fechar a busca"><span aria-hidden="true">×</span></button>' +
      "</form>" +
      '<p id="busca-status" class="busca-status" role="status" aria-live="polite"></p>' +
      '<div id="busca-res" class="busca-res"></div>' +
      "</div>";
    document.body.appendChild(painel);
    entrada = painel.querySelector("#busca-q");
    caixaRes = painel.querySelector("#busca-res");
    status = painel.querySelector("#busca-status");
    painel.querySelector(".busca-x").addEventListener("click", fecha);
    painel.addEventListener("click", function (e) {
      if (e.target === painel) fecha();
      var a = e.target.closest && e.target.closest(".busca-it, .busca-mais a");
      if (a && !a.target) {
        fecha(true);
        if (a.pathname === location.pathname) setTimeout(mostraAlvo, 0); /* mesma pagina: o hash pode nem mudar */
      }
    });
    entrada.addEventListener("input", function () {
      clearTimeout(tempo);
      tempo = setTimeout(atualiza, 120);
    });
    painel.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      if (!indice) return;
      clearTimeout(tempo); atualiza();
      var links = caixaRes.querySelectorAll(".busca-it");
      var a = links[sel >= 0 ? sel : 0];
      if (a) { fecha(true); a.click(); }
    });
    painel.addEventListener("keydown", teclaPainel);
  }
  function atualiza() {
    if (!indice) {
      status.textContent = "Carregando…";
      carrega().then(atualiza, function () { status.textContent = "Não consegui carregar a busca. Confira a internet e tente de novo."; });
      return;
    }
    render(caixaRes, status, entrada.value, false);
    selecione(entrada.value.trim() ? 0 : -1);
  }
  function selecione(i) {
    var links = caixaRes.querySelectorAll(".busca-it");
    if (sel >= 0 && links[sel]) links[sel].classList.remove("sel");
    sel = links.length ? Math.max(-1, Math.min(i, links.length - 1)) : -1;
    if (sel >= 0) { links[sel].classList.add("sel"); links[sel].scrollIntoView({ block: "nearest" }); }
  }
  function teclaPainel(e) {
    if (e.key === "Escape") { e.preventDefault(); fecha(); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      var links = caixaRes.querySelectorAll(".busca-it");
      if (!links.length) return;
      e.preventDefault();
      selecione(sel + (e.key === "ArrowDown" ? 1 : -1));
      if (document.activeElement !== entrada) entrada.focus();
      return;
    }
    if (e.key === "Tab") { /* foco preso dentro do painel */
      var foc = [].slice.call(painel.querySelectorAll("input, button, a[href]"));
      var pri = foc[0], ult = foc[foc.length - 1];
      if (e.shiftKey && document.activeElement === pri) { e.preventDefault(); ult.focus(); }
      else if (!e.shiftKey && document.activeElement === ult) { e.preventDefault(); pri.focus(); }
    }
  }
  function abre(e, texto) {
    if (e) e.preventDefault();
    montaPainel();
    quemAbriu = document.activeElement;
    painel.hidden = false;
    document.documentElement.classList.add("busca-aberta");
    if (typeof texto === "string") entrada.value = texto;
    entrada.focus();
    entrada.select();
    atualiza();
  }
  function fecha(semFoco) {
    if (!painel || painel.hidden) return;
    painel.hidden = true;
    document.documentElement.classList.remove("busca-aberta");
    if (semFoco !== true && quemAbriu && quemAbriu.focus) quemAbriu.focus();
  }

  /* --- pagina busca.html --- */
  function paginaBusca() {
    var form = document.getElementById("busca-pg"), alvo = document.getElementById("busca-pg-res");
    if (!form || !alvo) return;
    var inp = form.querySelector("input"), st = document.getElementById("busca-pg-status");
    var q0 = new URLSearchParams(location.search).get("q") || "";
    inp.value = q0;
    function roda() {
      var q = inp.value.trim();
      history.replaceState(null, "", q ? "busca.html?q=" + encodeURIComponent(q) : "busca.html");
      if (!indice) { st.textContent = "Carregando…"; carrega().then(roda, function () { st.textContent = "Não consegui carregar a busca. Confira a internet e tente de novo."; }); return; }
      render(alvo, st, q, true);
    }
    var t;
    inp.addEventListener("input", function () { clearTimeout(t); t = setTimeout(roda, 120); });
    form.addEventListener("submit", function (e) {
      e.preventDefault(); clearTimeout(t); roda();
      var a = alvo.querySelector(".busca-it");
      if (a && inp.value.trim()) a.focus();
    });
    if (q0) roda();
    else inp.focus();
  }

  /* --- chegar numa peca pelo link da busca (#p-...): abre "Trabalhos anteriores", tira o filtro e destaca --- */
  function mostraAlvo() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!/^[pq]-/.test(id)) return;
    var el = document.getElementById(id);
    if (!el) return;
    for (var n = el; n; n = n.parentElement) if (n.tagName === "DETAILS") n.open = true;
    if (el.hidden || (el.closest && el.closest("[hidden]"))) {
      var todas = document.querySelector('.filtros button[data-f="todas"]');
      if (todas) { todas.click(); history.replaceState(null, "", "#" + id); }
    }
    requestAnimationFrame(function () {
      el.scrollIntoView({ block: "center" });
      el.classList.remove("busca-alvo");
      void el.offsetWidth;
      el.classList.add("busca-alvo");
      setTimeout(function () { el.classList.remove("busca-alvo"); }, 2600);
    });
    /* fotos acima da peca ainda carregando empurram a pagina: centraliza de novo quando a pagina termina
       de carregar, se a pessoa ainda nao mexeu na rolagem */
    if (document.readyState !== "complete") {
      var mexeu = false, marca = function () { mexeu = true; };
      ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (ev) { window.addEventListener(ev, marca, { once: true, passive: true }); });
      window.addEventListener("load", function () { if (!mexeu) el.scrollIntoView({ block: "center" }); }, { once: true });
    }
  }

  function inicia() {
    document.querySelectorAll("[data-busca]").forEach(function (b) {
      b.setAttribute("aria-haspopup", "dialog");
      b.addEventListener("click", function (e) { abre(e); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
      if (painel && !painel.hidden) return;
      abre(e);
    });
    paginaBusca();
    mostraAlvo();
    window.addEventListener("hashchange", mostraAlvo);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inicia);
  else inicia();
})();
