/* Regressões de interface da NAF em navegador real. Rodar: node tests/browser/cdp.js tests/browser/naf_ui.test.js [url-base] */
"use strict";
module.exports = async (p, base) => {
  let falhas = 0;
  const ok = (cond, nome, extra) => { console.log((cond ? "  ok  " : "FALHA ") + nome + (cond ? "" : "  -> " + extra)); if (!cond) { falhas++; process.exitCode = 1; } };
  const ev = (x) => p.eval(x);
  const set = (id, v, evt) => ev("(()=>{const e=document.getElementById('" + id + "');e.value='" + v + "';e.dispatchEvent(new Event('" + (evt || "input") + "',{bubbles:true}));})()");
  const erro = () => ev("document.getElementById('naf-erros').innerText");
  const linhasTab = () => ev("document.querySelectorAll('#naf-tabela tbody tr').length");
  const abrir = async () => { await p.goto(base + "/calculadora.html?modo=naf"); await ev("localStorage.clear()"); await p.goto(base + "/calculadora.html?modo=naf"); await p.send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false }); await p.sleep(300); };

  /* A1: editar medida e trocar 5 <-> 6 nunca deixa resultado inválido */
  await abrir();
  await set("naf-od", "24"); await set("naf-jc", "9.1");
  await set("naf-furos", "6", "change"); await p.sleep(200);
  ok((await erro()) === "" && (await linhasTab()) === 6, "A1 5->6 depois de editar medidas: resultado válido com 6 furos", await erro());
  ok(await ev("document.getElementById('naf-aviso-troca')?.hidden===false"), "A1 aviso de que a troca refez as medidas");
  ok((await ev("document.querySelector('#naf-linhas [data-k=\"3\"][data-c=\"nota\"]').value")).startsWith("Mi"), "A1 furo extra (4º) recebe o Mi♭5 da semente de 6 furos");
  await set("naf-furos", "5", "change"); await p.sleep(200);
  ok((await erro()) === "" && (await linhasTab()) === 5, "A1 6->5: resultado válido com 5 furos", await erro());
  /* escala personalizada: notas não são herdadas por índice */
  await ev("(()=>{const e=document.querySelector('#naf-linhas [data-k=\"4\"][data-c=\"nota\"]');e.value='Sol 5';e.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await set("naf-furos", "6", "change"); await p.sleep(200);
  const notas6 = await ev("[...document.querySelectorAll('#naf-linhas [data-c=\"nota\"]')].map(e=>e.value).join(',')");
  ok(notas6 === "Si♭ 4,Dó 5,Ré 5,Mi♭ 5,Fá 5,Sol 5" && (await erro()) === "", "A1 personalizada 5->6: notas refeitas pela semente (sem 7ª/oitava nas posições 4/5)", notas6 + " | " + (await erro()));

  /* M1: Sol 5 com 6 furos abre sem erro */
  await abrir(); await set("naf-furos", "6", "change"); await set("naf-fund", "G5", "change"); await p.sleep(200);
  ok((await erro()) === "" && (await linhasTab()) === 6, "M1 Sol 5, 6 furos: sem erro", await erro());

  /* M2: Hz digitado diferente da nota => rótulo com ≈ na tabela, no desenho e no molde */
  await abrir();
  await ev("(()=>{const e=document.querySelector('#naf-linhas [data-k=\"0\"][data-c=\"hz\"]');e.value='480';e.dispatchEvent(new Event('input',{bubbles:true}));})()");
  const cel = await ev("document.querySelector('#naf-tabela tbody tr td').innerText");
  ok(cel.startsWith("≈"), "M2 tabela: rótulo com ≈ quando o Hz não é a nota", cel);
  ok(await ev("document.getElementById('naf-desenho').innerHTML.includes('≈') && document.getElementById('naf-molde').innerHTML.includes('≈')"), "M2 desenho e molde também");

  /* M3: cabeça vazia = erro claro; cabeça curta mantém tudo dentro do viewBox */
  await abrir(); await set("naf-cabeca", "");
  ok(/Cabeça.*informe um número/.test(await erro()), "M3 cabeça vazia: mensagem clara", await erro());
  const dentro = "(()=>{const s=document.querySelector('#naf-desenho svg');const vb=s.viewBox.baseVal;const bb=s.getBBox();return JSON.stringify({x:bb.x,y:bb.y,r:bb.x+bb.width,b:bb.y+bb.height,W:vb.width,H:vb.height})})()";
  for (const c of ["2", "0", "89"]) {
    await set("naf-cabeca", c);
    const m = JSON.parse(await ev(dentro));
    ok(m.x >= -0.5 && m.y >= -0.5 && m.r <= m.W + 0.5 && m.b <= m.H + 0.5, "M3 desenho dentro do viewBox com cabeça " + c, JSON.stringify(m));
  }

  /* B1: molde de tubo grande: nenhum texto passa da folha (180 mm) */
  await abrir();
  await set("naf-fund", "C3", "change"); await set("naf-od", "70"); await set("naf-parede", "3"); await set("naf-jc", "28"); await set("naf-jl", "31"); await set("naf-ja", "2"); await set("naf-cabeca", "150");
  for (let k = 0; k < 5; k++) await ev("(()=>{const e=document.querySelector('#naf-linhas [data-k=\"" + k + "\"][data-c=\"d\"]');e.value='20';e.dispatchEvent(new Event('input',{bubbles:true}));})()");
  ok((await erro()) === "", "B1 tubo grande (C3, Ø70) calcula", await erro());
  const fora = await ev("(()=>{const m=document.getElementById('naf-molde');m.style.display='block';let max=0;m.querySelectorAll('svg').forEach(s=>{const o=s.getBoundingClientRect().left;s.querySelectorAll('text').forEach(t=>{const b=t.getBoundingClientRect();max=Math.max(max,(b.right-o)/(96/25.4))})});m.style.display='';return max})()");
  ok(fora <= 180.2, "B1 texto do molde cabe na folha (maior x = " + fora.toFixed(1) + " mm)", fora);

  /* B2: editar nota => aviso de escala personalizada e botão para voltar */
  await abrir();
  ok(await ev("document.getElementById('naf-escala-aviso')?.hidden===true"), "B2 pentatônica: sem aviso");
  await ev("(()=>{const e=document.querySelector('#naf-linhas [data-k=\"1\"][data-c=\"nota\"]');e.value='Ré 5';e.dispatchEvent(new Event('input',{bubbles:true}));})()");
  ok(await ev("document.getElementById('naf-escala-aviso')?.hidden===false"), "B2 editar nota mostra o aviso de personalizada");
  await ev("document.getElementById('naf-voltar-pent')?.click()");
  ok((await ev("document.getElementById('naf-escala').value")) === "pentatonica-menor" && (await ev("document.getElementById('naf-escala-aviso')?.hidden===true")) && (await ev("document.querySelector('#naf-linhas [data-k=\"1\"][data-c=\"nota\"]').value")) === "Dó 5", "B2 botão volta à pentatônica e refaz as notas");

  /* B3: "input" do select (antes do change) não calcula nem grava estado intermediário */
  await abrir();
  const antes = await ev("location.hash");
  await ev("(()=>{const e=document.getElementById('naf-furos');e.value='6';e.dispatchEvent(new Event('input',{bubbles:true}));})()");
  ok((await ev("location.hash")) === antes, "B3 input transitório do select não grava a URL");

  /* B4: estado NAF salvo vale também ao abrir pelo modo Pífano e trocar de aba */
  await abrir(); await set("naf-temp", "31");
  await p.goto(base + "/calculadora.html"); await ev("document.getElementById('modo-aba-naf').click()"); await p.sleep(300);
  ok((await ev("document.getElementById('naf-temp').value")) === "31", "B4 aba NAF mostra o cálculo salvo mesmo abrindo primeiro no Pífano");

  /* C1: caso do dono (5 furos, Dó 5): tudo calcula e o texto fica limpo; o aviso do furo extra só aparece com 6 furos */
  const PROIBIDO = "/Bracker|Flute ?Lab|Flutopedia|cutoff|estimad[oa]|modelo|NaN|Infinity|undefined|\bnull\b|indispon|\b[RL][123]\b|topologia/i";
  await abrir();
  await set("naf-fund", "C5", "change"); await set("naf-temp", "25"); await set("naf-od", "22.4"); await set("naf-parede", "3"); await set("naf-jc", "5"); await set("naf-jl", "12"); await set("naf-ja", "8"); await set("naf-cabeca", "85");
  for (const [k, d] of [[0, 10], [1, 8], [2, 9], [3, 11], [4, 9]]) await ev("(()=>{const e=document.querySelector('#naf-linhas [data-k=\"" + k + "\"][data-c=\"d\"]');e.value='" + d + "';e.dispatchEvent(new Event('input',{bubbles:true}));})()");
  ok((await erro()) === "" && (await linhasTab()) === 5, "C1 caso do dono calcula 5 furos", await erro());
  const cel1 = await ev("document.querySelector('#naf-tabela tbody tr td:last-child').innerText");
  ok(/^● (Bom|Limitado|Fraco)$/.test(cel1.trim()), "C1 coluna Alcance simples, sem números nem 'estimado'", cel1);
  ok((await ev("document.getElementById('naf-avisos').innerText")).trim() === "" || !(await ev("new RegExp(" + PROIBIDO + ").test(document.getElementById('naf-avisos').innerText)")), "C1 avisos sem jargão");
  ok(!(await ev("new RegExp(" + PROIBIDO + ").test(document.getElementById('modo-naf').innerText + ' ' + [...document.querySelectorAll('#modo-naf [title],#modo-naf [placeholder]')].map(e=>(e.title||'')+(e.placeholder||'')).join(' ') + ' ' + document.getElementById('naf-desenho').textContent + ' ' + document.getElementById('naf-molde').textContent)")), "C1 texto visível da NAF sem Bracker/cutoff/modelo/etc.");
  ok(!(await ev("document.querySelector('#naf-linhas .naf-info[data-k=\"3\"]').textContent.includes('extra')")), "C1 5 furos: nenhuma explicação de furo extra");
  await set("naf-furos", "6", "change");
  ok(await ev("document.querySelector('#naf-linhas .naf-info[data-k=\"3\"]').textContent.includes('Furo extra')"), "C1 6 furos: furo 4 marcado como extra (texto curto)");
  ok(/principalmente o furo extra/.test(await ev("document.getElementById('naf-cautela').textContent")), "C1 uma linha de cautela, com o extra só em 6 furos");

  /* V1: "Mostrar no desenho" liga/desliga de fato cada grupo do SVG (desktop) e persiste */
  await abrir();
  const grupos = async () => JSON.parse(await ev("JSON.stringify([...new Set([...document.querySelectorAll('#naf-desenho svg [data-vis]')].map(g=>g.getAttribute('data-vis')))].sort())"));
  const chk = (k, v) => ev("(()=>{const c=document.querySelector('#naf-vis input[data-vis=\"" + k + "\"]');if(c.checked!==" + v + "){c.click();}})()");
  const rotulosVis = ["notas", "numeros", "diametros", "espacos", "boca", "total", "janela", "tubo"];
  ok(JSON.stringify(await ev("[...document.querySelectorAll('#naf-vis label')].map(l=>l.textContent.trim())")) === JSON.stringify(["Notas", "Nº dos furos", "Ø dos furos", "Entre furos", "Até o pé", "Comprimento", "Janela", "Tubo e parede"]), "V1 painel com os mesmos nomes do Pífano");
  ok(JSON.stringify(await grupos()) === JSON.stringify(["espacos", "janela", "notas", "numeros", "total", "tubo"]), "V1 padrão limpo (sem Ø e sem 'Até o pé')", JSON.stringify(await grupos()));
  for (const k of rotulosVis) {
    await chk(k, k === "boca" || k === "diametros"); /* liga os desligados por padrão, desliga os ligados */
    const g = await grupos(), ligado = await ev("document.querySelector('#naf-vis input[data-vis=\"" + k + "\"]').checked");
    ok(g.includes(k) === ligado, "V1 '" + k + "': checkbox " + (ligado ? "ligado" : "desligado") + " => grupo " + (ligado ? "presente" : "ausente"), JSON.stringify(g));
    await chk(k, !ligado);
  }
  await chk("boca", true); await chk("diametros", true);
  ok((await grupos()).includes("boca") && (await grupos()).includes("diametros") && (await ev("document.getElementById('naf-desenho').textContent.includes('Ø9')")), "V1 'Até o pé' e 'Ø dos furos' aparecem no desenho");
  await p.goto(base + "/calculadora.html?modo=naf"); await p.sleep(300);
  ok((await ev("document.querySelector('#naf-vis input[data-vis=\"boca\"]').checked")) === true, "V1 escolha persiste ao recarregar (como no Pífano)");
  /* V2: celular (390 px): mesmo painel, desenho em pé, mesmas opções ligando/desligando */
  await p.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await p.sleep(500);
  await ev("(()=>{const c=document.querySelector('#naf-vis input[data-vis=\"espacos\"]');c.click();c.click();})()");
  ok(await ev("!!document.querySelector('#naf-desenho svg.pc-vert')"), "V2 celular usa o desenho em pé");
  for (const k of ["espacos", "boca", "total", "janela", "tubo"]) {
    const ligado = await ev("document.querySelector('#naf-vis input[data-vis=\"" + k + "\"]').checked");
    await chk(k, !ligado);
    const g = await grupos(); ok(g.includes(k) === !ligado, "V2 celular '" + k + "' " + (!ligado ? "liga" : "desliga") + " o grupo", JSON.stringify(g));
    await chk(k, ligado);
  }
  await chk("notas", false); await chk("numeros", false); await chk("diametros", false);
  ok(!(await ev("!!document.querySelector('#naf-desenho svg [data-vis=rotulos]')")), "V2 celular sem notas/nº/Ø: sem rótulos laterais");

  console.log(falhas ? "RESULTADO: " + falhas + " falha(s)" : "RESULTADO: tudo OK");
};
