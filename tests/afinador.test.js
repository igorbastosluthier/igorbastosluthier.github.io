/* Estabilidade do afinador (assets/pife-afinador.js), sem microfone e sem navegador.
   Carrega o MESMO arquivo do site numa página falsa (DOM mínimo, microfone e AudioContext simulados), toca sinais
   sintéticos parecidos com flauta (fundamental + harmônicos, ruído de sopro, vibrato leve) e lê o que a tela mostra
   (#af-nota e #af-cents) quadro a quadro, a 60 quadros/s.
   Mede: desvio padrão dos cents mostrados, trocas de nome de nota por segundo, quadros com a nota errada (erro de
   oitava etc.) e quadros sem leitura nova (o detector desistiu).
   Rodar: node tests/afinador.test.js            (testes)
          node tests/afinador.test.js --tabela   (só a tabela de números)
          AFINADOR_JS=caminho/antigo.js node tests/afinador.test.js   (mede outra versão do arquivo) */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert");
const ARQ = process.env.AFINADOR_JS || path.join(__dirname, "..", "assets", "pife-afinador.js");
const FONTE = fs.readFileSync(ARQ, "utf8");
const PifeCalc = require("../assets/pife-calc.js");
const NOMES = ["Dó", "Dó#", "Ré", "Ré#", "Mi", "Fá", "Fá#", "Sol", "Sol#", "Lá", "Lá#", "Si"];
const nomeMidi = (m) => NOMES[((m % 12) + 12) % 12] + " " + (Math.floor(m / 12) - 1);

/* gerador pseudoaleatório determinístico (mulberry32) */
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* sinal de flauta: f0 com desvio fixo em cents + vibrato senoidal; harmônicos (amplitudes relativas);
   ruído de sopro (branco passado num passa-baixa e num passa-alta simples) com SNR dado em dB; leve tremor de volume.
   o.seq = [{ midi, dur }, …] toca uma melodia ligada (troca de nota sem parar o som); o.harm = [] só ruído. */
function flauta(o) {
  const sr = o.sr, n = Math.round(o.dur * sr), x = new Float32Array(n), r = rng(o.seed || 1);
  const amps = o.harm || [1, 0.45, 0.25, 0.12, 0.06, 0.03];
  const hzDe = (m) => 440 * Math.pow(2, (m - 69) / 12) * Math.pow(2, (o.cents || 0) / 1200);
  const f0 = hzDe(o.seq ? o.seq[0].midi : o.midi);
  const midiEm = (t) => { let a = 0; for (const s of o.seq) { a += s.dur; if (t < a) return s.midi; } return o.seq[o.seq.length - 1].midi; };
  let fase = 0, lp = 0, hpAnt = 0, hp = 0, potS = 0, potR = 0;
  const ruido = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = (o.seq ? hzDe(midiEm(t)) : f0) * Math.pow(2, ((o.vib || 0) * Math.sin(2 * Math.PI * (o.vibHz || 5) * t)) / 1200);
    fase += 2 * Math.PI * f / sr;
    let s = 0;
    for (let k = 0; k < amps.length; k++) if ((k + 1) * f < sr / 2) s += amps[k] * Math.sin((k + 1) * fase + k * 0.7);
    s *= 1 + 0.04 * Math.sin(2 * Math.PI * 3.1 * t);
    x[i] = s; potS += s * s;
    const w = r() * 2 - 1; lp += 0.35 * (w - lp); hp = 0.97 * (hp + lp - hpAnt); hpAnt = lp;
    ruido[i] = hp; potR += hp * hp;
  }
  const g = potS === 0 ? 1 : Math.sqrt(potS / potR) * Math.pow(10, -(o.snr == null ? 22 : o.snr) / 20);
  let pico = 0;
  for (let i = 0; i < n; i++) { x[i] += g * ruido[i]; pico = Math.max(pico, Math.abs(x[i])); }
  for (let i = 0; i < n; i++) x[i] *= 0.3 / pico;
  return { x: x, f0: f0 };
}

/* página falsa: só o que o afinador usa */
function pagina(sr, sinal) {
  const els = {}, rafs = [];
  let agora = 0, constraints = null;
  function el(id) {
    if (els[id]) return els[id];
    const ouvintes = {};
    const e = {
      id: id, textContent: "", innerHTML: "", hidden: false, checked: false, clientWidth: 800, width: 800, height: 120,
      value: id === "pc-la" ? "440" : id === "pc-tom" ? "do" : id === "af-limiar" ? "-40" : "",
      style: {},
      addEventListener: function (t, fn) { (ouvintes[t] = ouvintes[t] || []).push(fn); },
      disparar: function (t) { (ouvintes[t] || []).forEach(function (fn) { fn({ target: e }); }); },
      getContext: function () { return new Proxy({}, { get: function (o, k) { return k in o ? o[k] : function () {}; }, set: function (o, k, v) { o[k] = v; return true; } }); }
    };
    return (els[id] = e);
  }
  const analisadores = [];
  const radios = ["cromatico", "pife", "oitavas", "ref", "harm"].map(function (v) { const r = el("radio-" + v); r.value = v; return r; });
  function AudioContextFalso() {
    this.sampleRate = sr; this.state = "running";
    this.createMediaStreamSource = function () { return { connect: function () {} }; };
    this.createAnalyser = function () {
      const a = {
        fftSize: 2048, connect: function () {},
        getFloatTimeDomainData: function (buf) {
          const fim = Math.round(agora * sr);
          for (let i = 0; i < buf.length; i++) { const k = fim - buf.length + i; buf[i] = k >= 0 && k < sinal.length ? sinal[k] : 0; }
        }
      };
      analisadores.push(a); return a;
    };
    this.createOscillator = function () { return { connect: function () {}, start: function () {}, stop: function () {}, frequency: {} }; };
    this.createGain = function () { return { connect: function () {}, gain: {} }; };
    this.close = function () { this.state = "closed"; };
    this.currentTime = 0;
    Object.defineProperty(this, "currentTime", { get: function () { return agora; } });
  }
  const janela = {
    PifeCalc: PifeCalc,
    AudioContext: AudioContextFalso,
    requestAnimationFrame: function (fn) { rafs.push(fn); return rafs.length; },
    performance: { now: function () { return agora * 1000; } },
    localStorage: { getItem: function () { return null; }, setItem: function () {} },
    navigator: { mediaDevices: { getUserMedia: function (c) { constraints = c; return Promise.resolve({ getTracks: function () { return []; } }); } } },
    document: { getElementById: el, querySelectorAll: function (sel) { return sel === "[name=af-modo]" ? radios : []; }, querySelector: function () { return null; } },
    Math: Math, Float32Array: Float32Array, Float64Array: Float64Array, Promise: Promise, console: console
  };
  janela.window = janela;
  vm.createContext(janela);
  vm.runInContext(FONTE, janela, { filename: ARQ });
  return {
    el: el, janela: janela,
    ligar: async function () { el("af-ligar").disparar("click"); for (let i = 0; i < 5; i++) await Promise.resolve(); },
    constraints: function () { return constraints; },
    passo: function (dt) {
      agora += dt;
      const fs_ = rafs.splice(0, rafs.length);
      fs_.forEach(function (fn) { fn(agora * 1000); });
    },
    temAnalisador: function () { return analisadores.length > 0; },
    modo: function (v) { radios.filter(function (r) { return r.value === v; })[0].disparar("change"); }
  };
}

function desvio(v) {
  if (v.length < 2) return 0;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / (v.length - 1));
}

/* toca o sinal e lê a tela. Ignora o começo (ataque): 0,4 s, ou caso.desde. */
async function medir(caso) {
  const sr = caso.sr || 48000, dur = caso.dur || 3;
  const s = flauta(Object.assign({ sr: sr, dur: dur }, caso));
  const pg = pagina(sr, s.x);
  if (caso.modo) pg.modo(caso.modo);
  await pg.ligar();
  const fps = caso.fps || 60, dt = 1 / fps, esperado = nomeMidi(caso.esperado == null ? caso.midi : caso.esperado);
  pg.passo(0.1);
  const cents = [], nomes = [];
  let trocas = 0, errados = 0, quadros = 0, ant = null, semLeitura = 0, sub = "";
  for (let t = 0.1; t < dur - 0.01; t += dt) {
    const hzEl = pg.el("af-hz"), hzAnt = hzEl.textContent;
    hzEl.textContent = "";            /* marca: se continuar vazio, o quadro não deu leitura nova */
    pg.passo(dt);
    const novo = hzEl.textContent !== "";
    if (!novo) hzEl.textContent = hzAnt;
    if (t < (caso.desde || 0.4)) continue;
    const nome = pg.el("af-nota").textContent, ctxt = pg.el("af-cents").textContent;
    quadros++;
    const c = parseFloat(String(ctxt).replace("+", "").replace("−", "-"));
    if (!isNaN(c)) cents.push(c);
    if (ant !== null && nome !== ant) trocas++;
    if (nome !== esperado) errados++;
    if (!novo) semLeitura++;
    ant = nome; nomes.push(nome); sub = pg.el("af-nota-sub").textContent;
  }
  const seg = quadros / fps;
  return {
    nome: caso.nome, esperado: esperado, f0: s.f0,
    dpCents: desvio(cents), trocasPorSeg: trocas / seg, pctErrado: 100 * errados / quadros, pctSemLeitura: 100 * semLeitura / quadros,
    nomes: Array.from(new Set(nomes)).join("/"), sub: sub, constraints: pg.constraints()
  };
}

/* toca uma melodia (caso.seq) e mede, em cada troca, quanto tempo a tela leva para mostrar a nota nova */
async function melodia(caso) {
  const sr = 48000, dur = caso.seq.reduce((a, s) => a + s.dur, 0);
  const s = flauta(Object.assign({ sr: sr, dur: dur }, caso));
  const pg = pagina(sr, s.x);
  await pg.ligar();
  const dt = 1 / 60, tocadas = caso.seq.map((n) => nomeMidi(n.midi));
  pg.passo(0.1);
  const vistos = new Set(), demoras = [];
  let inicio = 0, k = 0, achou = true;
  for (let t = 0.1; t < dur - 0.01; t += dt) {
    pg.passo(dt);
    let a = 0, idx = 0; for (; idx < caso.seq.length; idx++) { a += caso.seq[idx].dur; if (t < a) break; }
    if (idx !== k) { if (!achou) demoras.push(t - inicio); k = idx; inicio = a - caso.seq[idx].dur; achou = false; }
    const nome = pg.el("af-nota").textContent;
    if (nome && nome !== "—") vistos.add(nome);
    if (!achou && nome === tocadas[k]) { demoras.push(t - inicio); achou = true; }
  }
  return { nomes: Array.from(vistos), estranhos: Array.from(vistos).filter((n) => tocadas.indexOf(n) < 0), demoras: demoras };
}

/* notas de teste: faixa do pife/flauta (≈ 400 Hz a 2,5 kHz), A4 = 440 */
const H2_FORTE = [0.5, 1, 0.45, 0.25, 0.12, 0.06];   /* 2º harmônico 6 dB acima da fundamental (som cheio, oitava "puxando") */
const H2_MUITO = [0.35, 1, 0.5, 0.3, 0.15, 0.08];   /* 2º harmônico 9 dB acima */
const CASOS = [
  { nome: "Lá 4 afinado", midi: 69, vib: 6 },
  { nome: "Ré 5 afinado", midi: 74, vib: 6 },
  { nome: "Sol 5 afinado", midi: 79, vib: 6 },
  { nome: "Dó 6 afinado", midi: 84, vib: 6 },
  { nome: "Mi 6 afinado", midi: 88, vib: 6 },
  { nome: "Lá 6 afinado", midi: 93, vib: 6 },
  { nome: "Ré 7 afinado", midi: 98, vib: 6 },
  { nome: "Ré# 7 afinado (2,5 kHz)", midi: 99, vib: 6 },
  { nome: "Ré 7 a 44,1 kHz", midi: 98, vib: 6, sr: 44100 },
  { nome: "Sol 5 +44 cents (perto do 1/4 de tom)", midi: 79, cents: 44, vib: 10 },
  { nome: "Si 6 −44 cents (perto do 1/4 de tom)", midi: 95, cents: -44, vib: 10 },
  /* bem na divisa (+47 com vibrato de 8: a nota passa dos 50 cents a cada tremida). O nome pode começar pelo vizinho;
     depois de 1 s tem de estar no lado onde a nota mais fica, sem trocar. */
  { nome: "Mi 5 +47 cents, sopro soproso", midi: 76, cents: 47, vib: 8, snr: 16, desde: 1, dur: 4 },
  { nome: "Lá 4, 2º harmônico +6 dB", midi: 69, vib: 6, harm: H2_FORTE },
  { nome: "Ré 5, 2º harmônico +6 dB", midi: 74, vib: 6, harm: H2_FORTE },
  { nome: "Sol 5, 2º harmônico +9 dB", midi: 79, vib: 6, harm: H2_MUITO },
  { nome: "Si 4, 2º harmônico +9 dB, soproso", midi: 71, vib: 6, harm: H2_MUITO, snr: 16 },
  { nome: "Dó 6 soproso (SNR 14 dB)", midi: 84, vib: 6, snr: 14 },
  { nome: "Lá 6 soproso (SNR 14 dB)", midi: 93, vib: 6, snr: 14 },
  /* sopro bem soproso: o ruído chega perto do som (era aqui que a nota pulava de oitava e "tremia") */
  { nome: "Lá 4 muito soproso (SNR 9 dB)", midi: 69, vib: 6, snr: 9 },
  { nome: "Sol 5 muito soproso (SNR 9 dB)", midi: 79, vib: 6, snr: 9 },
  { nome: "Mi 6 muito soproso (SNR 9 dB)", midi: 88, vib: 6, snr: 9 },
  { nome: "Lá 6 muito soproso (SNR 9 dB)", midi: 93, vib: 6, snr: 9 },
  { nome: "Ré 7 soproso (SNR 10 dB)", midi: 98, vib: 6, snr: 10 },
  { nome: "Ré 5, 2º harm. +9 dB, muito soproso", midi: 74, vib: 6, harm: H2_MUITO, snr: 9 }
];

async function tabela() {
  const linhas = [];
  for (const c of CASOS) linhas.push(await medir(c));
  console.log("arquivo: " + path.relative(process.cwd(), ARQ));
  console.log("caso".padEnd(42) + "Hz".padStart(8) + "  dp cents  trocas/s  %errado  %sem leit.  nomes");
  linhas.forEach(function (r) {
    console.log(r.nome.padEnd(42) + r.f0.toFixed(1).padStart(8) + r.dpCents.toFixed(2).padStart(10) + r.trocasPorSeg.toFixed(2).padStart(10) +
      r.pctErrado.toFixed(1).padStart(9) + r.pctSemLeitura.toFixed(1).padStart(10) + "  " + r.nomes);
  });
  return linhas;
}

module.exports = { medir: medir, flauta: flauta, pagina: pagina, CASOS: CASOS };
if (require.main === module) (async function () {
  const linhas = await tabela();
  if (process.argv.includes("--tabela")) return;
  let falhas = 0;
  const ok = (cond, nome, extra) => { console.log((cond ? "  ok  " : "FALHA ") + nome + (cond ? "" : "  -> " + extra)); if (!cond) falhas++; };
  /* limites: nota sustentada com vibrato leve (6 a 10 cents) e ruído de sopro */
  linhas.forEach(function (r) {
    ok(r.trocasPorSeg <= 0.4, r.nome + ": nome da nota não fica trocando", r.trocasPorSeg.toFixed(2) + " trocas/s (" + r.nomes + ")");
    ok(r.pctErrado <= 2, r.nome + ": mostra a nota certa (" + r.esperado + ")", r.pctErrado.toFixed(1) + "% dos quadros com outra nota (" + r.nomes + ")");
    ok(r.dpCents <= 6, r.nome + ": agulha firme (desvio dos cents ≤ 6)", r.dpCents.toFixed(2) + " cents");
  });
  /* melodia ligada Ré 5 → Mi 5 → Fá# 5 → Lá 5 → Ré 6 → Lá 5 (0,5 s cada): a nota nova aparece logo e o nome não passa
     pelas notas do meio (antes, a média em Hz arrastava a agulha por Ré# 5, Sol 5, Sol# 5…) */
  const seq = [74, 76, 78, 81, 86, 81].map(function (m) { return { midi: m, dur: 0.5 }; });
  const mel = await melodia({ seq: seq, vib: 6, snr: 14 });
  console.log("melodia: nomes mostrados " + mel.nomes.join("/") + "; demora até a nota nova (s): " + mel.demoras.map(function (d) { return d.toFixed(2); }).join(", "));
  ok(mel.estranhos.length === 0, "melodia: só aparecem as notas tocadas", mel.estranhos.join("/"));
  ok(Math.max.apply(null, mel.demoras) <= 0.15, "melodia: a nota nova aparece em até 0,15 s", mel.demoras.join(", "));
  /* só o ruído do sopro (sem nota): não pode inventar nota */
  /* modo "Afinar este pife" (tom Dó): mesma estabilidade, nome e furo certos */
  const pf = await medir({ nome: "pife Mi 5 soproso", midi: 76, vib: 6, snr: 9, modo: "pife" });
  ok(pf.trocasPorSeg === 0 && pf.pctErrado === 0 && pf.sub === "1ª oitava · furos 1 e 2 abertos", "modo pife: Mi 5 soproso estável, com o furo certo",
    pf.trocasPorSeg + " trocas/s, " + pf.pctErrado + "% errado, " + pf.nomes + " / " + pf.sub);
  const rui = await medir({ nome: "só ruído", midi: 69, harm: [], snr: 0 });
  ok(rui.pctSemLeitura >= 98, "só ruído de sopro: não mostra nota", (100 - rui.pctSemLeitura).toFixed(1) + "% dos quadros com leitura (" + rui.nomes + ")");
  const c = linhas[0].constraints && linhas[0].constraints.audio;
  ok(c && c.echoCancellation === false && c.noiseSuppression === false && c.autoGainControl === false,
    "microfone sem filtros de voz (eco, ruído e ganho automático desligados)", JSON.stringify(c));
  if (falhas) { console.log(falhas + " falha(s)"); process.exitCode = 1; } else console.log("afinador: " + linhas.length + " sinais estáveis — OK");
})();
