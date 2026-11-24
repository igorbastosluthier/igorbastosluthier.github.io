/* "?" de cada campo: abre e fecha a explicação curta (calculadora e afinador, pífano e NAF).
   Fica num arquivo só dele, carregado antes dos outros: o "?" funciona mesmo que a calculadora não consiga iniciar (estado salvo
   estranho, script que falhou ou ainda não carregou). Delegado no documento: vale para os botões de qualquer aba, inclusive os que
   aparecem depois. */
(function () {
  "use strict";
  document.addEventListener("click", function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest(".pc-ajuda") : null; if (!b) return;
    var alvo = document.getElementById(b.getAttribute("aria-controls")); if (!alvo) return;
    var abrir = b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", String(abrir)); alvo.hidden = !abrir;
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape") return;
    var b = document.activeElement && document.activeElement.closest ? document.activeElement.closest(".pc-ajuda") : null;
    if (b && b.getAttribute("aria-expanded") === "true") b.click();
  });
})();
