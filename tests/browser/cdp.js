/* Driver CDP minimo (Chrome headless, sem dependencias): node tests/browser/cdp.js <cenario.js> [url-base]
   Requer Chrome (CHROME=caminho) e o site servido, ex.: python -m http.server 8765 na raiz do repo. O cenario exporta async (page, base) => {...}. */
const { spawn } = require("child_process"), fs = require("fs"), path = require("path"), http = require("http");
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = +process.env.CDP_PORT || 9333, udd = path.join(process.env.TEMP, "cdp-prof-" + Date.now());
const get = (u) => new Promise((res, rej) => http.get(u, r => { let b = ""; r.on("data", d => b += d); r.on("end", () => res(JSON.parse(b))); }).on("error", rej));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const proc = spawn(CHROME, ["--headless=new", "--remote-debugging-port=" + port, "--user-data-dir=" + udd, "--no-first-run", "--disable-gpu", "about:blank"], { stdio: "ignore" });
  let tabs; for (let i = 0; i < 50; i++) { try { tabs = await get("http://127.0.0.1:" + port + "/json"); break; } catch (e) { await sleep(200); } }
  const tab = tabs.find(t => t.type === "page");
  const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {}; const events = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } else events.push(d); };
  const send = (method, params) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const page = {
    send, events,
    goto: async (url) => { await send("Page.navigate", { url }); await sleep(1200); },
    eval: async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 600)); return r.result.result.value; },
    shot: async (file, w, h) => { await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 }); await sleep(300); const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); fs.writeFileSync(file, Buffer.from(r.result.data, "base64")); },
    pdf: async (file) => { const r = await send("Page.printToPDF", { printBackground: false, preferCSSPageSize: true }); fs.writeFileSync(file, Buffer.from(r.result.data, "base64")); },
    sleep
  };
  await send("Runtime.enable"); await send("Page.enable"); await send("Log.enable");
  try { await require(path.resolve(process.argv[2]))(page, process.argv[3] || "http://127.0.0.1:8765"); } catch (e) { console.log("ERRO:", e.message); }
  const errs = events.filter(e => e.method === "Runtime.exceptionThrown" || (e.method === "Log.entryAdded" && e.params.entry.level === "error")).map(e => JSON.stringify(e.params).slice(0, 300));
  console.log("erros de console/exceção:", errs.length ? errs : "nenhum");
  ws.close(); proc.kill(); process.exit(process.exitCode || 0);
})();
