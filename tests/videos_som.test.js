/* Vídeos das peças: o botão só promete "com som" quando o vídeo é o Igor TOCANDO aquela flauta.
   Pedido do Igor (19/11/2026): "tem 'ver vídeo com som' mas nem sempre sou eu tocando... isso pra mim é errado".
   node tests/videos_som.test.js
   - botão sem a classe so-ver (mostra "Ver o vídeo · com som") => vídeo na lista conferida tests/fixtures/videos_tocando.json
     e o arquivo tem trilha de áudio;
   - botão so-ver => o rótulo não fala em som;
   - o mesmo cartão (id p-...) usa o mesmo vídeo em todas as páginas; todo vídeo citado existe. */
const fs = require("fs"), path = require("path");
const raiz = path.join(__dirname, "..");
const fx = JSON.parse(fs.readFileSync(path.join(raiz, "tests", "fixtures", "videos_tocando.json"), "utf8"));
const css = fs.readFileSync(path.join(raiz, "assets", "mix.css"), "utf8");
let falhas = 0, total = 0, comSom = 0, soVer = 0;
function confere(ok, msg) { if (!ok) { falhas++; console.log("  FALHOU: " + msg); } }

/* trilha de áudio: no MP4 o "moov" traz um hdlr do tipo "soun" (os vídeos do site são faststart: moov no começo) */
function temAudio(arq) {
  const b = fs.readFileSync(arq);
  return b.indexOf(Buffer.from("hdlrsoun")) >= 0 || /hdlr\x00{8}soun/.test(b.toString("latin1"));
}

const porCartao = {};
for (const pg of ["galeria.html", "pifanos.html", "nativas.html", "irlandesa.html", "index.html", "estojos.html"]) {
  const html = fs.readFileSync(path.join(raiz, pg), "utf8");
  const re = /<article id="(p-[0-9a-z]+)"[^>]*>(?:(?!<\/article>)[\s\S])*?<button class="play( so-ver)?" type="button" data-src="vid\/([0-9a-f]+)\.mp4"[^>]*aria-label="([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    const [, cartao, so, vid, aria] = m;
    total++;
    const arq = path.join(raiz, "vid", vid + ".mp4");
    confere(fs.existsSync(arq), pg + " " + cartao + ": vídeo inexistente vid/" + vid + ".mp4");
    if (porCartao[cartao]) confere(porCartao[cartao] === vid, cartao + ": vídeos diferentes entre páginas (" + porCartao[cartao] + " x " + vid + ")");
    porCartao[cartao] = vid;
    if (so) {
      soVer++;
      confere(!/som/i.test(aria), pg + " " + cartao + ": botão so-ver não pode falar em som (" + aria + ")");
    } else {
      comSom++;
      confere(Object.prototype.hasOwnProperty.call(fx.tocando, vid), pg + " " + cartao + ": 'com som' mas vid/" + vid + ".mp4 não está na lista do Igor tocando");
      if (fs.existsSync(arq)) confere(temAudio(arq), pg + " " + cartao + ": 'com som' mas vid/" + vid + ".mp4 não tem áudio");
      confere(/com som/.test(aria), pg + " " + cartao + ": rótulo acessível deve dizer 'com som' (" + aria + ")");
    }
  }
}
confere(total > 100, "esperava mais de 100 botões de vídeo, achou " + total);
confere(/\.play\.so-ver::after\{content:"\\25B6\\00a0 Ver o vídeo"\}/.test(css), "mix.css: falta a regra .play.so-ver (rótulo sem 'com som')");
/* a lista não guarda vídeo que saiu do site */
for (const vid of Object.keys(fx.tocando)) confere(Object.values(porCartao).includes(vid), "videos_tocando.json: " + vid + " não está mais em nenhum cartão");
console.log("videos_som: " + total + " botões, " + comSom + " com som, " + soVer + " só ver; " + (falhas ? falhas + " falhas" : "ok"));
process.exit(falhas ? 1 : 0);
