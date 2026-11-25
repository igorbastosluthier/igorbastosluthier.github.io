/* Paridade Pífano x NAF (pedido do Igor, 24/11/2026: "exatamente o mesmo padrão"). Lista cada componente que o Pífano tem e exige o
   mesmo na NAF, ou um "não se aplica" com o motivo, ou um "pendente" com o motivo. A tabela sai na tela ao rodar.
   Se alguém tirar um componente do Pífano ou da NAF, este teste falha. */
"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path");
const rd = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const html = rd("calculadora.html"), jsPife = rd("assets/pife-ui.js"), jsNaf = rd("assets/naf-ui.js"), fb = rd("assets/feedback.js");
const iP = html.indexOf('id="modo-pife"'), iN = html.indexOf('id="modo-naf"'), iA = html.indexOf('<section class="blk pc-af"');
const pife = html.slice(iP, iN), naf = html.slice(iN, iA);
const JS = { pife: jsPife, naf: jsNaf };
/* [item, onde, regex do Pífano, regex da NAF | null, nota] ; NAF null = não se aplica (nota = motivo) ou pendente (pendente = true) */
const itens = [
  ["Abas Pífano / Flauta NAF", html, /id="modo-aba-pife"/, /id="modo-aba-naf"/],
  ["Seções numeradas (1. 2. 3. 4.)", "h", /<legend>1\. O pife/, /<legend>1\. A flauta/],
  ["Tom / nota grave com ▶ (toca até apertar de novo)", "h", /id="pc-tom-ouvir" class="pc-tocar"/, /id="naf-fund-ouvir" class="pc-tocar"/],
  ["Furos (select)", "h", /id="pc-nfuros"/, /id="naf-furos"/],
  ["Escala (select) com ? de ajuda", "h", /id="pc-escala"[^]*?aj-escala|aria-controls="aj-escala"/, /id="naf-escala"/],
  ["Linha de notas da escala (chips)", "h", /class="pc-notas"/, /class="pc-notas"/],
  ["Saltos T / ST entre as notas", "j", /pc-salto/, /pc-salto/],
  ["▶ em cada nota (toca a nota)", "j", /class="pc-nota(?:"|')/, /class="pc-nota(?:"|')/],
  ["Ouvir escala (botão)", "h", /id="pc-ouvir"/, /id="naf-ouvir"/],
  ["Subir / Ida e volta", "h", /name="pc-ouvir-modo"/, /name="naf-ouvir-modo"/],
  ["Afinação: 440 / 432 / Outra", "h", /id="pc-la"[^]*?Outra/, /id="naf-la"[^]*?Outra/],
  ["Temperatura do lugar", "h", /id="pc-temp"/, /id="naf-temp"/],
  ["Diâmetro interno", "h", /id="pc-D"/, /id="naf-di"/],
  ["Espessura da parede", "h", /id="pc-parede"/, /id="naf-parede"/],
  ["? de ajuda visível em cada campo", "h", /class="pc-ajuda"/, /class="pc-ajuda"/],
  ["Aviso por campo (.pc-alerta)", "h", /class="pc-alerta"/, /class="pc-alerta"/],
  ["Mensagem \"Fora da faixa da calculadora\"", "j", /Fora da faixa da calculadora/, /Fora da faixa da calculadora/],
  ["Botão \"usar X mm\" (tubo indicado)", "j", /pc-usar-tubo/, /naf-usar-tubo/],
  ["Furos dos dedos: grade compacta com Ø", "h", /id="pc-furos"/, /id="naf-linhas"/],
  ["Voltar aos tamanhos sugeridos", "h", /id="pc-sugerir"/, /id="naf-sugerir"/],
  ["Faixa \"Alcance\" no resultado", "h", /id="pc-alcance"/, /id="naf-alcance"/],
  ["Ajustar sozinho (furos encostados)", "h", /id="pc-ajuste"/, /id="naf-ajuste"/],
  ["Mostrar no desenho (opções)", "h", /id="pc-vis"/, /id="naf-vis"/],
  ["Desenho (horizontal e em pé no celular)", "h", /id="pc-desenho"/, /id="naf-desenho"/],
  ["Cartões por furo no celular", "h", /id="pc-cartoes"/, /id="naf-cartoes"/],
  ["Tabela com coluna Alcance", "h", /<th scope="col">Alcance<\/th>/, /<th scope="col">Alcance<\/th>/],
  ["Lista-resumo (medidas totais)", "h", /id="pc-resumo"/, /id="naf-resumo"/],
  ["Esse resultado ajudou? Sim / Não", "f", /"pc-resumo"/, /"naf-resumo"/],
  ["Caixa \"Atenção\" com os avisos do resultado", "j", /class="pc-aviso"/, /class="pc-aviso"/],
  ["Linha de status \"Tudo dentro do normal\"", "j", /Tudo dentro do normal para esse tubo/, /Tudo dentro do normal para essa flauta/],
  ["Imprimir molde em tamanho real", "h", /id="pc-imprimir"/, /id="naf-imprimir"/],
  ["Copiar link deste cálculo (+ \"Link copiado\")", "h", /id="pc-copiado"/, /id="naf-copiado"/],
  ["Guia / material de construção na página", "h", /id="pc-dig"|class="pc-dig"/, /class="naf-material"/, "o guia completo abaixo é do Pífano; a NAF tem o bloco \"Para construir a sua flauta nativa\" com links"],
  ["Bocal cônico (modelo Boehm)", "h", /id="pc-cone"/, null, "não se aplica: a NAF não tem bocal cônico nem rolha"],
  ["Furo do sopro (redondo/oval) e porta-lábios", "h", /id="pc-emb-forma"/, null, "não se aplica: a NAF sopra por canal e tem janela (comprimento, largura, altura), que a NAF já tem na seção 3"],
  ["Tabela de digitação do tom (imagens)", "h", /id="digitacao"/, null, "PENDENTE: não há tabela de digitação de NAF no site (img/tabelas só tem pífano e irlandesa); não foi inventada", true]
];
const onde = { h: null, j: null, f: fb };
let ok = 0; const linhas = [];
itens.forEach(([nome, tipo, rp, rn, nota, pendente]) => {
  const pg = (alvo, lado) => tipo === html ? html : tipo === "h" ? (lado === "p" ? pife : naf) : tipo === "j" ? (lado === "p" ? jsPife : jsNaf) : fb;
  assert.ok(rp.test(pg(tipo, "p")), "o Pífano perdeu: " + nome);
  let estado;
  if (rn) { assert.ok(rn.test(pg(tipo, "n")), "falta na NAF: " + nome); estado = "sim"; }
  else { assert.ok(nota && nota.length > 20, "'não se aplica' sem motivo: " + nome); estado = pendente ? "pendente" : "não se aplica"; }
  if (pendente) assert.ok(!fs.readdirSync(path.join(__dirname, "..", "img", "tabelas")).some(f => /naf|nativ/i.test(f)), "existe imagem de digitação de NAF: implemente");
  linhas.push([estado, nome, nota || ""]); ok++;
  console.log("  ok  [" + estado + "] " + nome + (nota ? " — " + nota : ""));
});
assert.ok(!/\b(SAC|TSH|flue|fipple|languid)\b/i.test(naf), "termo em inglês na aba NAF");
console.log("paridade Pífano x NAF: " + ok + " itens (" + linhas.filter(l => l[0] === "sim").length + " sim, " + linhas.filter(l => l[0] === "não se aplica").length + " não se aplica, " + linhas.filter(l => l[0] === "pendente").length + " pendente) OK");
