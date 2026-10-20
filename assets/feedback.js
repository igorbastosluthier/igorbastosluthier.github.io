/* Feedback do site: um botão em toda página e, na calculadora, "Esse resultado ajudou?".
   Só respostas de clique (assunto, nota, opções), contadas como eventos no GoatCounter
   (igorbastosluthier.goatcounter.com). Sem texto livre, sem cookie, sem dado pessoal. */
(function () {
  var GC = "https://igorbastosluthier.goatcounter.com/count";
  if (!document.querySelector("script[data-goatcounter]")) {
    var s = document.createElement("script");
    s.async = true; s.src = "//gc.zgo.at/count.js"; s.setAttribute("data-goatcounter", GC);
    document.head.appendChild(s);
  }
  var fila = [];
  function conta(caminho, titulo) {
    var ev = { path: "feedback/" + caminho, title: titulo || caminho, event: true };
    if (window.goatcounter && window.goatcounter.count) window.goatcounter.count(ev); else fila.push(ev);
  }
  var tenta = setInterval(function () {
    if (!(window.goatcounter && window.goatcounter.count)) return;
    clearInterval(tenta); fila.splice(0).forEach(function (ev) { window.goatcounter.count(ev); });
  }, 1000);
  setTimeout(function () { clearInterval(tenta); }, 30000);

  var pagina = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";
  var ASSUNTOS = [["calculadora", "Calculadora"], ["site", "Site em geral"], ["flautas", "Flautas e valores"], ["outro", "Outro"]];
  var padrao = /calculadora|afinador/.test(pagina) ? "calculadora"
    : /pifanos|irlandesa|nativas|estojos|valores|monte|galeria/.test(pagina) ? "flautas" : "site";
  var OPCOES = [["facil", "Fácil de usar"], ["bonito", "Bonito"], ["confuso", "Confuso"], ["faltou-info", "Faltou informação"],
    ["lento", "Lento"], ["erro", "Algo deu erro"], ["celular-ruim", "Ruim no celular"]];

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }
  function grupo(nome, itens, multi, marcado) {
    var g = el("div", "fbk-g"); g.setAttribute("role", "group"); g.setAttribute("aria-label", nome);
    itens.forEach(function (it) {
      var b = el("button", "fbk-chip", it[1]); b.type = "button"; b.dataset.v = it[0];
      b.setAttribute("aria-pressed", String(it[0] === marcado));
      b.onclick = function () {
        if (!multi) g.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", String(multi ? b.getAttribute("aria-pressed") !== "true" : true));
      };
      g.appendChild(b);
    });
    return g;
  }
  function escolhidos(g) { return [].map.call(g.querySelectorAll('[aria-pressed="true"]'), function (b) { return b.dataset.v; }); }

  var botao = el("button", "fbk-fab", "Feedback"); botao.type = "button"; botao.setAttribute("aria-haspopup", "dialog");
  var caixa = el("div", "fbk-box"); caixa.setAttribute("role", "dialog"); caixa.setAttribute("aria-modal", "false");
  caixa.setAttribute("aria-labelledby", "fbk-t"); caixa.hidden = true;
  var fechar = el("button", "fbk-x", "×"); fechar.type = "button"; fechar.setAttribute("aria-label", "Fechar");
  var tit = el("h2", null, "Sua opinião ajuda"); tit.id = "fbk-t";
  var gA = grupo("Sobre o que é", ASSUNTOS, false, padrao);
  var gN = grupo("Nota de 1 a 5", [1, 2, 3, 4, 5].map(function (n) { return [String(n), n + "★"]; }), false, null);
  var gO = grupo("O que achou", OPCOES, true, null);
  var enviar = el("button", "fbk-send", "Enviar"); enviar.type = "button";
  var aviso = el("p", "fbk-note", "Anônimo: só os cliques são contados, nada que identifique você.");
  [fechar, tit, el("p", "fbk-l", "Sobre o que é?"), gA, el("p", "fbk-l", "Nota"), gN,
    el("p", "fbk-l", "O que achou? (pode marcar várias)"), gO, enviar, aviso].forEach(function (x) { caixa.appendChild(x); });

  function abre(v) { caixa.hidden = !v; botao.setAttribute("aria-expanded", String(v)); if (v) gA.querySelector("button").focus(); else botao.focus(); }
  botao.onclick = function () { abre(caixa.hidden); };
  fechar.onclick = function () { abre(false); };
  caixa.addEventListener("keydown", function (e) { if (e.key === "Escape") abre(false); });
  enviar.onclick = function () {
    var a = escolhidos(gA)[0] || padrao, n = escolhidos(gN)[0], o = escolhidos(gO);
    if (!n && !o.length) { aviso.textContent = "Marque uma nota ou uma opção."; return; }
    if (n) conta(a + "/nota-" + n, "Feedback " + a + ": nota " + n);
    o.forEach(function (x) { conta(a + "/" + x, "Feedback " + a + ": " + x); });
    conta(a + "/pagina-" + pagina, "Feedback enviado de " + pagina);
    caixa.innerHTML = ""; caixa.appendChild(fechar); caixa.appendChild(el("h2", null, "Obrigado!"));
    caixa.appendChild(el("p", "fbk-note", "Recebido. Cada resposta ajuda a melhorar o site."));
    setTimeout(function () { abre(false); }, 2500);
  };

  // Calculadora: depois de cada resultado, uma pergunta curta.
  function perguntaCalc(resumo) {
    var q = el("div", "fbk-calc"); q.appendChild(el("span", null, "Esse resultado ajudou?"));
    var sim = el("button", "fbk-chip", "Sim"), nao = el("button", "fbk-chip", "Não"); sim.type = nao.type = "button";
    q.appendChild(sim); q.appendChild(nao);
    function fim(t) { q.innerHTML = ""; q.appendChild(el("span", null, t)); }
    sim.onclick = function () { conta("calculadora/ajudou-sim", "Calculadora ajudou: sim"); fim("Obrigado!"); };
    nao.onclick = function () {
      conta("calculadora/ajudou-nao", "Calculadora ajudou: não");
      q.innerHTML = ""; q.appendChild(el("span", null, "O que faltou?"));
      [["medidas-estranhas", "Medidas estranhas"], ["dificil-entender", "Difícil de entender"],
        ["faltou-opcao", "Faltou uma opção"], ["desenho-molde", "Problema no desenho/molde"]].forEach(function (it) {
        var b = el("button", "fbk-chip", it[1]); b.type = "button";
        b.onclick = function () { conta("calculadora/" + it[0], "Calculadora: " + it[1]); fim("Obrigado, vou olhar isso."); };
        q.appendChild(b);
      });
    };
    resumo.parentNode.insertBefore(q, resumo.nextSibling);
  }
  function liga() {
    document.body.appendChild(botao); document.body.appendChild(caixa);
    var r = document.getElementById("pc-resumo");
    if (r && pagina === "calculadora") {
      var feito = false;
      var ver = function () { if (!feito && r.textContent.trim()) { feito = true; perguntaCalc(r); } };
      new MutationObserver(ver).observe(r, { childList: true, subtree: true, characterData: true }); ver();
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", liga); else liga();
})();
