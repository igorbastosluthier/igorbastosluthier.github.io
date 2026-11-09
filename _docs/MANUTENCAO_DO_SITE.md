# Manutenção do site igorbastosluthier.com.br

Guia para retomar o trabalho no site, numa nova sessão do Claude, no Codex ou à mão.
Esta pasta começa com `_`, então o GitHub Pages (Jekyll) **não publica** este arquivo.

---

## 1. Onde fica e como publica
| Item | Valor |
|---|---|
| Repositório local | `C:\Users\airba\Documents\site_repo` |
| Remoto | `https://github.com/igorbastosluthier/igorbastosluthier.github.io.git`, ramo **main** |
| Hospedagem | GitHub Pages, domínio próprio pelo arquivo `CNAME` (`igorbastosluthier.com.br`) |
| Build | nenhum: HTML/CSS/JS estático. Sem `.nojekyll` e sem `_config.yml`: o Jekyll padrão do Pages ignora pastas e arquivos começados com `_` |
| Identidade do git | `Igor Bastos Luthier <airbastos2@gmail.com>` (já configurada no repositório) |

**Publicar = commit + push no main.** O Pages atualiza em 1–2 minutos.

```
cd C:\Users\airba\Documents\site_repo
git pull --ff-only
# editar
node tests/pife.test.js && node tests/naf.test.js && node tests/afinador.test.js && node tests/afinador_vies.test.js
git add <arquivos>
git commit -m "área: o que mudou (em português, para o Igor ler)"
git push origin main
```

**Antes de editar:** rode `git pull` e `git status`. Outras sessões (Claude/Codex/Hermes) também já publicaram aqui.

**Nunca:** `push --force`, apagar histórico, nem publicar texto com dados privados.

**Cache dos navegadores.** Os HTML carregam os scripts com versão (`assets/pife-afinador.js?v=9`). Ao mudar um `.js` ou `.css`, **aumente o `?v=`** em todas as páginas que o usam (procure pelo nome do arquivo). Senão, quem já visitou continua com a versão antiga.

**Final de linha.** Os HTML estão em CRLF. Edite sem converter o arquivo inteiro. Confira com `git show --stat HEAD`: deve mudar só o que você mexeu.

---

## 2. Estrutura
| Arquivo | O que é |
|---|---|
| `index.html` | página inicial (tem o cartão da calculadora: hoje "Calculadora de pife", **a renomear para "Faça sua flauta"**) |
| `calculadora.html` | calculadora (modos Pífano e Flauta NAF) + afinador embutido |
| `afinador.html` | afinador sozinho |
| `pifanos.html`, `nativas.html`, `irlandesa.html`, `monte.html`, `galeria.html`, `estojos.html`, `valores.html`, `tabelas.html`, `perguntas.html`, `sobre.html`, `privacidade.html`, `404.html` | páginas de conteúdo |
| `assets/pife-calc.js` | núcleo do cálculo do pífano (sem DOM; testado em node) |
| `assets/pife-ui.js` | tela da calculadora do pífano (desenho, molde 1:1, estado na URL) |
| `assets/naf-calc.js` / `assets/naf-ui.js` | núcleo e tela da NAF (núcleo Bracker, 5/6 furos) |
| `assets/pife-afinador.js` | afinador (YIN + refino; ver seção 4) |
| `assets/site.css`, `mix.css`, `naf.css`, `feedback.*`, `monte.js` | estilo, feedback e montagem |
| `img/`, `vid/` | imagens e vídeos |
| `mix-r7t2/`, `novo-k3p8/`, `teste-7q4k/` | rascunhos/versões de teste (não são o site principal) |
| `tests/` | testes em node (seção 3) |
| `sitemap.xml`, `robots.txt`, `CNAME` | SEO e domínio |

---

## 3. Testes (rodar sempre antes de publicar)
| Comando | Confere |
|---|---|
| `node tests/pife.test.js` | cálculo do pífano contra `tests/fixtures/pife.json` (gerado por `tests/gen_pife_fixtures.js`) |
| `node tests/naf.test.js` | cálculo da NAF contra `tests/fixtures/naf_ref.json` (gerado por `tests/gen_naf_reference.py`) |
| `node tests/afinador.test.js` | estabilidade do afinador numa página falsa: nome da nota firme, oitava certa, agulha firme, melodia, só ruído = sem nota |
| `node tests/afinador_vies.test.js` | **viés** do detector: Sol 3 a Mi 7, sons de flauta com pouco e muito sopro; exige viés ≤ 2 cents e p95 ≤ 4 cents |
| `tests/browser/*.test.js` | testes no navegador (Chrome via CDP, `tests/browser/cdp.js`) da tela da NAF |

---

## 4. Afinador (`assets/pife-afinador.js`)
1. **YIN:** diferença quadrática + média cumulativa normalizada. Fica o **primeiro** vale que chega perto do vale mais fundo; por isso não pula oitava com sopro.
2. Desde 09/11/2026, depois disso fica **o vale mais fundo a ±6 % desse primeiro vale**. O ruído do sopro criava vales falsos antes do verdadeiro, e o afinador lia alto: +31 cents no Sol 3 soproso.
3. **Refino pela soma dos harmônicos** (Goertzel com janela de Hann): ±40 cents em passos de 4, depois ±4 em passos de 0,5, com interpolação parabólica. Antes, nos agudos, lia +3 cents.
4. **Custo:** ~2 ms por quadro no PC (o YIN sozinho, ~0,5 ms).
5. **Medido:** pior viés 1 cent, 0 saltos de oitava.

O mesmo algoritmo existe no app Oficina CNC (`codigo/flute_tuner.py`). Mantenha os dois iguais.

---

## 5. Calculadoras
- **Pífano:** `pife-calc.js`. **NAF:** `naf-calc.js` (núcleo Bracker).
- O motor de referência do Igor está no app desktop `C:\CNC\Igor\PROGRAMAS\Aplainar Superfície\codigo\motor\` (Motor Único, matrizes de transferência, validado em NAFs medidas). Diferenças entre o site e o motor estão sendo levantadas em 09/11/2026 (ver seção 7).
- **Regras de texto da tela (pedidos do Igor):**
  - português simples;
  - **sem jargão** (nada de "Bracker", "cutoff", "modelo", nomes de software);
  - só avisos que a pessoa consegue resolver;
  - resumo enxuto.

---

## 6. Regras gerais do Igor para o site
- Privacidade: texto enxuto, sem nome do software nem detalhes técnicos; CNPJ e endereço no rodapé.
- Toda mudança vem com teste quando há cálculo ou áudio.
- Commit em português, dizendo o efeito para quem usa ("afinador: nota firme com sopro…").

---

## 7. Pendências (09/11/2026)
- Página inicial: "Calculadora de pife" → **"Faça sua flauta"**.
- Na calculadora, "Cabeça da flauta" → **"Bocal"**.
- **Escalas:**
  - escolher a escala (só as que servem ao pífano; na NAF as dela);
  - **ouvir a escala**, subindo ou subindo e descendo, como no app;
  - escolher a **quantidade de furos**.

  Vale para o Pífano e para a NAF.
- Alinhar o cálculo do site ao motor do app: frequência de corte com √2 (Benade), chaminé = parede, cabeça cônica Boehm (cone reto desde a embocadura), temperatura/A4. A comparação numérica está em andamento.
