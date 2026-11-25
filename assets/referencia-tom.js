(function () {
  "use strict";
  var audio = window.Escalas;
  if (!audio) return;

  function montar(botao, lerNota) {
    function atualizar() {
      var nota = lerNota();
      var tocando = audio.estado(botao) === "tocando";
      botao.textContent = tocando ? "⏸" : "▶";
      botao.setAttribute("aria-pressed", String(tocando));
      botao.setAttribute("aria-label", "Tom de referência: " + nota.nome);
      botao.title = (tocando ? "Pausar " : "Ouvir ") + nota.nome;
    }
    botao.addEventListener("click", function () {
      var nota = lerNota();
      if (!Number.isInteger(nota.midi)) return;
      var estado = audio.estado(botao);
      if (estado === "tocando") audio.pausar();
      else if (estado === "pausado") audio.continuar();
      else audio.tocar([440 * Math.pow(2, (nota.midi - 69) / 12)], { porNota: 3, dono: botao });
    });
    audio.aoMudar(atualizar);
    atualizar();
    return atualizar;
  }

  document.querySelectorAll("button[data-tom-midi]").forEach(function (botao) {
    montar(botao, function () {
      return { midi: Number(botao.dataset.tomMidi), nome: botao.dataset.tomNome };
    });
  });
  window.ReferenciaTom = { montar: montar };
})();
