"use strict";
const assert = require("node:assert/strict");

module.exports = async (page, base) => {
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
    window.testNotes = [];
    window.AudioContext = class extends NativeAudioContext {
      createOscillator() {
        const oscillator = super.createOscillator();
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (when) => {
          window.testNotes.push(oscillator.frequency.value);
          return start(when);
        };
        return oscillator;
      }
    };
  })();` });
  await page.goto(base + "/valores.html");
  const prices = await page.eval(`(() => {
    const buttons = [...document.querySelectorAll("[data-tom-midi]")];
    const first = buttons[0], second = buttons[1];
    first.click();
    const playing = first.getAttribute("aria-pressed");
    first.click();
    const paused = first.getAttribute("aria-pressed");
    first.click();
    const resumed = first.getAttribute("aria-pressed");
    second.click();
    return { count: buttons.length, labels: buttons.map(b => b.dataset.tomNome),
      playing, paused, resumed, replaced: first.getAttribute("aria-pressed"),
      secondPlaying: second.getAttribute("aria-pressed"), notes: window.testNotes };
  })()`);
  assert.equal(prices.count, 71);
  assert.ok(prices.labels.every(label => / [45] \([A-G]#?[45]\)$/.test(label)));
  assert.deepEqual([prices.playing, prices.paused, prices.resumed, prices.replaced, prices.secondPlaying],
                   ["true", "false", "true", "false", "true"]);
  assert.ok(Math.abs(prices.notes[0] - 622.254) < .001);
  assert.ok(Math.abs(prices.notes[3] - 587.330) < .001);
  assert.equal(prices.notes.length, 6);

  await page.goto(base + "/monte.html");
  const quote = await page.eval(`(() => {
    const model = document.getElementById("mm");
    const tone = document.getElementById("mt");
    const sound = document.getElementById("mt-ouvir");
    const total = () => document.getElementById("mtot").textContent;
    const choose = (select, value) => {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const first = { name: tone.selectedOptions[0].text, price: total() };
    sound.click();
    choose(tone, "1");
    const next = { price: total(), stopped: sound.getAttribute("aria-pressed") };
    choose(model, "3");
    sound.click();
    return { first, next, irish: { price: total(), label: sound.getAttribute("aria-label"),
                                  hz: window.testNotes.at(-3) } };
  })()`);
  assert.deepEqual(quote.first, { name: "Ré♯ 5 (D#5)", price: "R$ 270" });
  assert.deepEqual(quote.next, { price: "R$ 290", stopped: "false" });
  assert.equal(quote.irish.price, "R$ 1.970");
  assert.match(quote.irish.label, /Ré 4 \(D4\)/);
  assert.ok(Math.abs(quote.irish.hz - 293.665) < .001);

  for (const path of ["calculadora.html", "afinador.html"]) {
    await page.goto(base + "/" + path);
    let option;
    for (let i = 0; i < 10 && !option; i++) {
      option = await page.eval('Array.from(document.getElementById("pc-tom")?.options || []).find(o => o.value === "sol" && o.text)?.text');
      if (!option) await page.sleep(200);
    }
    assert.equal(option, "Sol 4 (G4)", path);
  }
  await page.goto(base + "/index.html");
  const actions = await page.eval(`Array.from(document.querySelectorAll(".h4hero .acts a"), a => [a.textContent, a.getAttribute("href")])`);
  assert.deepEqual(actions, [["Ver os modelos", "#linhas"], ["Valores", "valores.html"], ["Encomende a sua!", "monte.html"]]);
  assert.equal(await page.eval(`!!document.getElementById("linhas")`), true);
  console.log("71 referências, reprodução, pausa, troca de nota e preços conferidos");
};
