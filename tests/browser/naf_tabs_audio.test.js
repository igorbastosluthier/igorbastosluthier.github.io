"use strict";

const assert = require("node:assert/strict");

module.exports = async (page, base) => {
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
    window.frequenciesForTest = [];
    window.AudioContext = class extends NativeAudioContext {
      createOscillator() {
        const oscillator = super.createOscillator();
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (when) => {
          window.frequenciesForTest.push(oscillator.frequency.value);
          return start(when);
        };
        return oscillator;
      }
    };
  })();` });
  await page.goto(base + "/calculadora.html?modo=naf");
  const select = (id, value) => page.eval(`(() => {
    const field = document.getElementById(${JSON.stringify(id)});
    field.value = ${JSON.stringify(value)};
    field.dispatchEvent(new Event("change", {bubbles:true}));
  })()`);
  const click = (id) => page.eval(`document.getElementById(${JSON.stringify(id)}).click()`);
  const play = async (count, mode = "ida-e-volta") => {
    const result = await page.eval(`(() => {
      const chips = [...document.querySelectorAll("#naf-notas-escala .pc-nota")];
      document.querySelector('input[name="naf-ouvir-modo"][value="${mode}"]').checked = true;
      const before = window.frequenciesForTest.length;
      document.getElementById("naf-ouvir").click();
      const notes = window.frequenciesForTest.slice(before).filter((_, index) => index % 3 === 0);
      return { holes: Number(document.getElementById("naf-furos").value), chips: chips.map(b => Number(b.dataset.hz)),
        extra: chips.filter(b => b.classList.contains("pc-extra")).length, notes };
    })()`);
    assert.equal(result.holes, count);
    assert.equal(result.extra, count === 6 ? 1 : 0);
    const expected = mode === "subir" ? result.chips : result.chips.concat(result.chips.slice(0, -1).reverse());
    assert.equal(result.notes.length, expected.length, "O primeiro clique deve iniciar a sequência inteira");
    expected.forEach((hz, index) => assert.ok(Math.abs(hz - result.notes[index]) < 0.001));
    console.log(`NAF ${count} furos, ${mode}: ${result.notes.length} notas conferidas`);
  };
  await select("naf-fund", "F4");
  await select("naf-furos", "6");
  await select("naf-escala", "pentatonica-menor");
  await play(6);
  await click("modo-aba-pife");
  await click("pc-ouvir");
  await click("modo-aba-naf");
  await play(6);
  await page.eval(`(() => {
    document.getElementById("modo-aba-pife").click();
    document.getElementById("modo-aba-naf").click();
  })()`);
  await play(6);
  await click("modo-aba-pife");
  await click("modo-aba-naf");
  await play(6, "subir");
  await click("modo-aba-pife");
  await click("modo-aba-naf");
  await select("naf-furos", "5");
  await play(5);
};
