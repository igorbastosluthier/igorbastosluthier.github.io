#!/usr/bin/env python3
"""Gera o indice da busca do site (assets/busca.json).

Uso (na raiz do site):
    python tools/build_search_index.py          # grava ids nos cartoes, o botao da busca nas paginas e o indice
    python tools/build_search_index.py --check  # so confere; sai com 1 se algo estiver desatualizado

O que faz, sempre igual (deterministico, so biblioteca padrao):
  1. Garante um id estavel em cada cartao de peca (<article class="peca ...">): "p-" + nome da
     primeira foto (img/c/<nome>-p.jpg). Tambem garante um id em cada pergunta de perguntas.html.
  2. Garante em todas as paginas o botao da busca no cabecalho e os arquivos assets/busca.css e
     assets/busca.js (com ?v= tirado do conteudo do arquivo, entao o cache se renova sozinho).
  3. Le as paginas e grava assets/busca.json: pecas, paginas/secoes, perguntas e ferramentas.

Rode de novo sempre que mudar uma pagina (nova peca, texto novo) e publique junto o busca.json.
Nao mexe no rodape.
"""
import hashlib
import html
import json
import os
import re
import sys
import unicodedata
from html.parser import HTMLParser

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, "assets", "busca.json")

# Paginas na ordem de prioridade (a primeira que tiver uma secao com o mesmo titulo fica com ela).
PAGINAS = [
    "index.html", "pifanos.html", "irlandesa.html", "nativas.html", "estojos.html", "galeria.html",
    "valores.html", "perguntas.html", "monte.html", "tabelas.html", "afinador.html", "calculadora.html",
    "sobre.html", "privacidade.html",
]
SEM_BUSCA = {"404.html"}
# Outros nomes de cada pagina (pesam como o titulo, mas nao aparecem).
APELIDOS = {
    "pifanos.html": "pife pifes", "nativas.html": "naf nativa americana", "irlandesa.html": "irish flute low d",
    "estojos.html": "estojo case", "galeria.html": "fotos portfolio trabalhos", "valores.html": "precos preco tabela de precos",
    "perguntas.html": "duvidas faq prazo pagamento garantia", "sobre.html": "igor bastos luthier quem sou",
}  # paginas que nao recebem o botao (redirecionam)
# Paginas de onde vem as pecas; a primeira da lista que tiver a peca vira o link dela.
PAGINAS_PECAS = ["pifanos.html", "nativas.html", "irlandesa.html", "estojos.html", "galeria.html"]
NOME_PAGINA = {
    "index.html": "Início", "pifanos.html": "Pífanos", "irlandesa.html": "Flauta irlandesa",
    "nativas.html": "Flautas nativas", "estojos.html": "Estojos", "galeria.html": "Galeria",
    "valores.html": "Valores", "perguntas.html": "Perguntas", "monte.html": "Monte a sua flauta",
    "tabelas.html": "Tabelas de digitação", "afinador.html": "Afinador", "calculadora.html": "Faça sua flauta",
    "sobre.html": "Sobre", "privacidade.html": "Privacidade",
}
# Secoes: index.html so entra como pagina; afinador.html so a parte do afinador.
SECOES_SO_DENTRO = {"afinador.html": "afinador"}
SECOES_NENHUMA = {"index.html", "galeria.html", "monte.html"}
TITULOS_IGNORADOS = {"pecas", "mais flautas", "resultado", "para apreciar", "tabela de digitacao"}

FERRAMENTAS = [
    {"t": "Faça sua flauta", "s": "calculadora de furos", "a": "Calculadora gratuita", "u": "calculadora.html",
     "d": "Escolha o tom, meça o tubo e veja onde furar: desenho, molde em tamanho real para imprimir e guia completo.",
     "k": "calculadora calcular furos furar furo molde imprimir desenho fazer construir pife pifano bambu naf "
          "nativa tom tubo diametro faca sua flauta guia ferramenta gratis"},
    {"t": "Afinador para flauta", "s": "afinador de flauta", "a": "Ferramenta gratuita", "u": "afinador.html",
     "d": "Use o microfone: modo cromático, mapa de afinação do pife, teste de oitavas e nota de referência.",
     "k": "afinador afinar afinacao microfone cromatico oitavas rolha nota referencia harmonicos timbre tuner "
          "ferramenta gratis"},
    {"t": "Monte a sua flauta", "s": "orcamento simulador", "a": "Orçamento na hora", "u": "monte.html",
     "d": "Escolha o modelo, o tom e os detalhes e veja a estimativa do valor na hora.",
     "k": "monte montar orcamento estimativa preco precos valor valores simulador personalizar personalizacao "
          "gravacao laser nome frase encomendar encomenda"},
    {"t": "Tabelas de digitação", "a": "Para imprimir", "u": "tabelas.html",
     "d": "Quais furos tapar em cada nota, no tom da sua flauta. Baixe em PNG ou imprima.",
     "k": "tabela tabelas digitacao dedilhado notas furos tapar imprimir png baixar irlandesa low d diatonica"},
    {"t": "Rastreamento da encomenda", "s": "rastreio correios", "a": "Correios", "u": "https://www.siterastreio.com.br/",
     "d": "Acompanhe a sua flauta nos Correios com o código de rastreio.",
     "k": "rastrear rastreio rastreamento correios encomenda envio codigo objeto entrega"},
]

# Sinonimos (formas ja normalizadas: minusculas e sem acento). Cada grupo vale nos dois sentidos.
SINONIMOS = [
    ["pifano", "pife", "pifes", "pifanos", "fife", "transversal"],
    ["nativa", "naf", "nativas", "native", "americana"],
    ["irlandesa", "irish", "irlandesas", "lowd"],
    ["roxinho", "purpleheart", "roxo", "peltogyne"],
    ["jacaranda", "dalbergia", "rosewood"],
    ["muirapiranga", "conduru"],
    ["marchetaria", "marchetado", "marchetada", "marchetados", "mosaico", "inlay"],
    ["estojo", "estojos", "case", "caixa"],
    ["afinador", "tuner", "afinar"],
    ["calculadora", "calcular", "calculo"],
    ["tabela", "tabelas", "digitacao", "dedilhado"],
    ["valores", "preco", "precos", "valor", "custa", "quanto"],
    ["frete", "envio", "correios", "entrega"],
    ["rastreio", "rastreamento", "rastrear"],
    ["whatsapp", "zap", "wpp", "contato"],
    ["segmentado", "segmentada", "partes", "encaixe"],
    ["bambu", "bamboo"],
    ["madeira", "wood"],
    ["rabeca", "rabecas", "fiddle"],
    ["do", "c"], ["re", "d"], ["mi", "e"], ["fa", "f"], ["sol", "g"], ["la", "a"], ["si", "b"],
    ["do#", "c#", "reb", "db"], ["re#", "d#", "mib", "eb"], ["fa#", "f#", "solb", "gb"],
    ["sol#", "g#", "lab", "ab"], ["la#", "a#", "sib", "bb"],
    ["dom", "cm"], ["rem", "dm"], ["mim", "em"], ["fam", "fm"], ["solm", "gm"], ["lam", "am"], ["sim", "bm"],
    ["do#m", "c#m"], ["fa#m", "f#m"], ["sol#m", "g#m"],
]

STOP = set("a e o de da das dos do em no na nos nas com para pra por um uma os as ao aos que se ou "
           "the of and sua seu meu minha mais muito este esta essa esse isso".split())

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
PULAR = {"script", "style", "svg", "noscript", "select", "button", "template", "form", "nav", "table"}
BLOCOS = {"p", "li", "dd", "dt", "td", "th", "div", "h1", "h2", "h3", "h4", "summary", "br", "figcaption",
          "caption", "section", "header", "details", "ul", "ol", "span", "figure"}
SEM_TEXTO = {"peca", "antigos", "pcards"}  # cartoes de peca entram como pecas, nao no texto da pagina
# Paginas em que os titulos h2/h3 sem id ganham um (para o link da busca cair no lugar certo).
IDS_NOS_TITULOS = {"valores.html": "v-", "tabelas.html": "t-", "privacidade.html": "s-"}

LETRA_SOLFEJO = {"C": "do", "D": "re", "E": "mi", "F": "fa", "G": "sol", "A": "la", "B": "si"}
SOLFEJO_LETRA = {v: k.lower() for k, v in LETRA_SOLFEJO.items()}


def normaliza(s):
    s = unicodedata.normalize("NFD", s.replace("♯", "#"))
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower()


def palavras(s):
    return re.findall(r"[a-z0-9#]+", normaliza(s))


def limpa(s):
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def notas(texto):
    """Tons citados no texto ("tom de Sol", "em C e G", "F#m", "Dó") -> fichas de busca (sol g, f#m fa#m...)."""
    out = []

    def junta(sol, acid, menor):
        letra = SOLFEJO_LETRA[sol]
        acid = "#" if acid in ("#", "♯") else ("b" if acid == "b" else "")
        out.extend([sol + acid, letra + acid])
        if menor:
            out.extend([sol + acid + "m", letra + acid + "m"])

    for m in re.finditer(r"(?<![\wÀ-ÿ])(Dó|Do|DO|Ré|Re|RÉ|Mi|Fá|Fa|FÁ|Sol|SOL|Lá|La|LÁ|Si)([#♯]?)(m?)(?![\wÀ-ÿ])", texto):
        sol = normaliza(m.group(1))
        if sol in ("do", "re", "fa", "la") and m.group(1)[-1] not in "óéáÓÉÁ" and not m.group(1).isupper():
            continue  # "Do"/"La" sem acento: so se vier escrito em maiusculas (DO) ou com acento
        if sol == "si" and not re.search(r"(?:tom|tons|em|de)\s+$", texto[:m.start()]):
            continue
        junta(sol, m.group(2), m.group(3))
    for m in re.finditer(r"(?<![\wÀ-ÿ])([A-G])([#♯b]?)(m?)(?![\wÀ-ÿ])", texto):
        letra, acid, menor = m.groups()
        if letra in "AE" and not acid and not menor:
            if not re.search(r"(?:tom|tons|em|de|e|low)\s+$", texto[:m.start()], re.I):
                continue
        if letra == "E" and not acid and not menor and re.search(r"(?<![\wÀ-ÿ])e\s+$", texto[:m.start()]):
            continue
        junta(LETRA_SOLFEJO[letra], acid, menor)
    return out


def unicas(lista, limite=None, tirar=()):
    vistos, out = set(tirar), []
    for p in lista:
        if p in vistos or p in STOP or (len(p) < 2 and not p.isalpha()):
            continue
        vistos.add(p)
        out.append(p)
        if limite and len(out) >= limite:
            break
    return out


# ---------- arvore HTML minima (so para ler texto, titulos e ids) ----------
class No:
    __slots__ = ("tag", "attrs", "filhos", "pai")

    def __init__(self, tag, attrs, pai):
        self.tag, self.attrs, self.filhos, self.pai = tag, dict(attrs), [], pai


class Leitor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.raiz = No("#doc", [], None)
        self.atual = self.raiz

    def handle_starttag(self, tag, attrs):
        no = No(tag, attrs, self.atual)
        self.atual.filhos.append(no)
        if tag not in VOID:
            self.atual = no

    def handle_startendtag(self, tag, attrs):
        self.atual.filhos.append(No(tag, attrs, self.atual))

    def handle_endtag(self, tag):
        n = self.atual
        while n is not None and n.tag != tag:
            n = n.pai
        if n is not None and n.pai is not None:
            self.atual = n.pai

    def handle_data(self, data):
        self.atual.filhos.append(data)


def arvore(texto):
    p = Leitor()
    p.feed(texto)
    p.close()
    return p.raiz


def acha(no, pred):
    for f in no.filhos:
        if isinstance(f, No):
            if pred(f):
                return f
            r = acha(f, pred)
            if r is not None:
                return r
    return None


def texto_de(no):
    partes = []

    def anda(n):
        for f in n.filhos:
            if isinstance(f, str):
                partes.append(f)
            elif f.tag not in PULAR and not set(classes(f)) & SEM_TEXTO:
                anda(f)
                if f.tag in BLOCOS:
                    partes.append(" ")

    anda(no)
    return re.sub(r"\s+", " ", "".join(partes)).strip()


def classes(no):
    return no.attrs.get("class", "").split()


# ---------- 1/2. ids e ganchos nas paginas (edicao minima, preserva bytes e finais de linha) ----------
def hash_arquivo(caminho):
    with open(caminho, "rb") as f:
        return hashlib.sha1(f.read()).hexdigest()[:8]


BOTAO = ('<a class="busca-btn" href="busca.html" aria-label="Buscar no site" title="Buscar no site (/)" data-busca>'
         '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">'
         '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/>'
         '<path d="M15.5 15.5 21 21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
         '</svg></a>')


def slug(s, maxlen=48):
    p = re.sub(r"[^a-z0-9]+", "-", normaliza(s)).strip("-")
    return p[:maxlen].rstrip("-") or "x"


def garante_ids(texto, pagina):
    usados = set(re.findall(r'\bid="([^"]+)"', texto))

    def novo_id(base):
        i, cand = 2, base
        while cand in usados:
            cand, i = "%s-%d" % (base, i), i + 1
        usados.add(cand)
        return cand

    def artigo(m):
        abre, resto = m.group(1), m.group(2)
        if re.search(r'\bid="', abre):
            return m.group(0)
        img = re.search(r'img/c/([0-9a-z]+)-p\.jpg', resto)
        if img:
            base = "p-" + img.group(1)
        else:
            tag = re.search(r'<p class="tag">(.*?)</p>', resto, re.S)
            base = "p-" + slug(limpa(tag.group(1)) if tag else "peca")
        return abre.replace("<article ", '<article id="%s" ' % novo_id(base), 1) + resto

    texto = re.sub(r'(<article class="peca\b[^>]*>)(.*?</article>)', artigo, texto, flags=re.S)
    if pagina in IDS_NOS_TITULOS:
        pre = IDS_NOS_TITULOS[pagina]

        def tit(m):
            if re.search(r'\bid="', m.group(2)):
                return m.group(0)
            return "<%s%s id=\"%s\">%s" % (m.group(1), m.group(2), novo_id(pre + slug(limpa(m.group(3)), 40)), m.group(3))
        i, j = texto.find('<main id="conteudo">'), texto.find("</main>")
        if 0 <= i < j:  # so dentro do <main>: cabecalho e rodape ficam como estao
            meio = re.sub(r'<(h[23])((?:\s[^>]*)?)>(.*?)(?=</\1>)', tit, texto[i:j], flags=re.S)
            texto = texto[:i] + meio + texto[j:]
    if pagina == "perguntas.html":
        def det(m):
            return '<details id="%s"><summary>' % novo_id("q-" + slug(limpa(m.group(1)), 40)) + m.group(1)
        texto = re.sub(r'<details><summary>(.*?)(?=</summary>)', det, texto, flags=re.S)
    return texto


def garante_ganchos(texto, v_css, v_js):
    if "data-busca" not in texto and '<button class="burger"' in texto:
        texto = texto.replace('<button class="burger"', BOTAO + '<button class="burger"', 1)
    link = '<link rel="stylesheet" href="assets/busca.css?v=%s">' % v_css
    if "assets/busca.css" in texto:
        texto = re.sub(r'<link rel="stylesheet" href="assets/busca\.css(?:\?v=[^"]*)?">', link, texto)
    elif "<header class=\"site\">" in texto:
        texto = re.sub(r'(<link rel="stylesheet" href="assets/site\.css[^"]*">)', r"\1" + link, texto, count=1)
    script = '<script src="assets/busca.js?v=%s" defer></script>' % v_js
    if "assets/busca.js" in texto:
        texto = re.sub(r'<script src="assets/busca\.js(?:\?v=[^"]*)?" defer></script>', script, texto)
    elif "<header class=\"site\">" in texto:
        i = texto.rfind("</body>")
        nl = "\r\n" if texto[max(0, i - 2):i] == "\r\n" else "\n"
        texto = texto[:i] + script + nl + texto[i:]
    return texto


def le(pagina):
    with open(os.path.join(RAIZ, pagina), "r", encoding="utf-8", newline="") as f:
        return f.read()


def grava(pagina, texto):
    with open(os.path.join(RAIZ, pagina), "w", encoding="utf-8", newline="") as f:
        f.write(texto)


# ---------- 3. indice ----------
def pecas_da_pagina(texto, pagina):
    out = []
    for m in re.finditer(r'<article id="([^"]+)" class="peca\b([^"]*)"([^>]*)>(.*?)</article>', texto, re.S):
        pid, extra, attrs, corpo = m.groups()
        tag = re.search(r'<p class="tag">(.*?)</p>', corpo, re.S)
        tag = limpa(tag.group(1)) if tag else ""
        titulo, _, ano = tag.partition(" · ")
        caps = [limpa(c) for c in re.findall(r'<p class="cap">(.*?)</p>', corpo, re.S)]
        caps += [limpa(c) for c in re.findall(r'data-cap="([^"]*)"', corpo)]
        caps = [c for i, c in enumerate(caps) if c and c not in caps[:i]]
        img = re.search(r'<img src="(img/c/[0-9a-z]+-p\.jpg)"', corpo)
        h3 = re.search(r"<h3>(.*?)</h3>", corpo, re.S)
        cat = re.search(r'data-c="([^"]*)"', attrs)
        alt = re.search(r'data-alt="([^"]*)"', attrs)
        out.append({
            "id": pid, "pagina": pagina, "titulo": titulo or (limpa(h3.group(1)) if h3 else "Peça"),
            "ano": ano, "caps": caps, "img": img.group(1) if img else "",
            "extra": " ".join(x for x in [cat.group(1).replace("-", " ") if cat else "",
                                         html.unescape(alt.group(1)) if alt else "",
                                         limpa(h3.group(1)) if h3 else ""] if x),
            "aviso": "rabeca-aviso" in extra,
        })
    return out


def secoes_da_pagina(raiz, pagina):
    """Titulos h2/h3 (e as perguntas) com o texto ate o proximo titulo; link = id mais proximo."""
    main = acha(raiz, lambda n: n.attrs.get("id") == "conteudo")
    if main is None:
        return [], ""
    so_dentro = SECOES_SO_DENTRO.get(pagina)
    secoes, atual = [], None
    ultimo_id = {"v": ""}

    def ancora(no):
        if no.attrs.get("id"):
            return no.attrs["id"]
        n = no.pai
        while n is not None and n is not main:
            if n.attrs.get("id") and n.tag in ("section", "div", "details", "figure", "article")                     and "hidden" not in n.attrs:
                return n.attrs["id"]
            n = n.pai
        return ultimo_id["v"]

    def dentro_de(no, ident):
        n = no
        while n is not None:
            if isinstance(n, No) and n.attrs.get("id") == ident:
                return True
            n = n.pai
        return False

    def anda(n):
        nonlocal atual
        for f in n.filhos:
            if isinstance(f, str):
                if atual is not None:
                    atual["txt"].append(f)
                continue
            if f.tag in PULAR or set(classes(f)) & SEM_TEXTO:
                continue
            titulo = None
            if f.tag in ("h2", "h3"):
                titulo = f
            elif f.tag == "summary" and pagina == "perguntas.html":
                titulo = f
            if titulo is not None:
                alvo = f.pai if f.tag == "summary" else f
                a = ancora(alvo)
                if a and f.tag != "summary":
                    ultimo_id["v"] = a
                ok = (so_dentro is None or dentro_de(f, so_dentro))
                atual = {"t": texto_de(f), "a": a, "txt": [], "ok": ok, "q": f.tag == "summary"}
                secoes.append(atual)
                continue
            anda(f)
            if atual is not None and f.tag in BLOCOS:
                atual["txt"].append(" ")

    anda(main)
    out = []
    for s in secoes:
        corpo = re.sub(r"\s+", " ", "".join(s["txt"])).strip()
        if not s["ok"] or not s["t"] or normaliza(s["t"]) in TITULOS_IGNORADOS:
            continue
        out.append({"t": s["t"], "a": s["a"], "corpo": corpo, "q": s["q"]})
    return out, texto_de(main)


def resumo(s, n=150):
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) <= n:
        return s
    corte = s[:n].rsplit(" ", 1)[0].rstrip(",.;:")
    return corte + "…"


def monta_indice(textos):
    itens = []
    vistos = set()
    for f in FERRAMENTAS:
        itens.append(dict(g="f", **f))
        vistos.add(normaliza(f["t"]))
    vistos_url = {f["u"] for f in FERRAMENTAS}
    vistos_secoes = set()

    paginas_itens, secoes_itens = [], []
    for pagina in PAGINAS:
        texto = textos[pagina]
        raiz = arvore(texto)
        titulo = acha(raiz, lambda n: n.tag == "title")
        titulo = texto_de(titulo).split(" · ")[0] if titulo is not None else NOME_PAGINA[pagina]
        desc = re.search(r'<meta name="description" content="([^"]*)"', texto)
        desc = html.unescape(desc.group(1)) if desc else ""
        secoes, todo = secoes_da_pagina(raiz, pagina)
        nome = NOME_PAGINA[pagina]
        if pagina == "index.html":
            titulo = "Início"
        if pagina not in vistos_url:
            itens_k = unicas(palavras(nome + " " + titulo + " " + desc + " " + todo), 160)
            item = {"g": "g", "t": nome, "a": "Página", "u": pagina, "d": resumo(desc or todo), "k": " ".join(itens_k)}
            if pagina in APELIDOS:
                item["s"] = APELIDOS[pagina]
            paginas_itens.append(item)
        if pagina in SECOES_NENHUMA:
            continue
        for s in secoes:
            # mesma secao em duas paginas (afinador.html repete partes da calculadora): fica a primeira
            chave = (normaliza(s["t"]), " ".join(palavras(s["corpo"]))[:240])
            if normaliza(s["t"]) in vistos or chave in vistos_secoes:
                continue
            vistos_secoes.add(chave)
            u = pagina + ("#" + s["a"] if s["a"] else "")
            k = unicas(palavras(s["corpo"]) + notas(s["corpo"]), 90, tirar=set(palavras(s["t"])))
            secoes_itens.append({"g": "g", "t": s["t"], "a": nome if not s["q"] else "Perguntas",
                                 "u": u, "d": resumo(s["corpo"]), "k": " ".join(k)})
    itens += paginas_itens

    # pecas: ordem da galeria (mais novas primeiro); link para a pagina da linha quando ela tem a peca
    por_id, ordem = {}, []
    for pagina in ["galeria.html"] + [p for p in PAGINAS_PECAS if p != "galeria.html"]:
        for p in pecas_da_pagina(textos[pagina], pagina):
            if p["id"] not in por_id:
                por_id[p["id"]] = {"base": p, "paginas": [pagina], "caps": list(p["caps"])}
                ordem.append(p["id"])
            else:
                reg = por_id[p["id"]]
                reg["paginas"].append(pagina)
                reg["caps"] += [c for c in p["caps"] if c not in reg["caps"]]
    for pid in ordem:
        reg = por_id[pid]
        p = reg["base"]
        destino = next(x for x in PAGINAS_PECAS if x in reg["paginas"])
        caps = reg["caps"]
        d = resumo(caps[0], 200) if caps else ""
        if caps and d != caps[0]:
            caps = [caps[0][len(d) - 1:]] + caps[1:]
        else:
            caps = caps[1:]
        bruto = " ".join([p["titulo"], p["ano"]] + reg["caps"])
        extra = palavras(" ".join(caps) + " " + p["extra"] + " " + NOME_PAGINA[destino]) + notas(bruto)
        k = unicas(extra, 80, tirar=set(palavras(p["titulo"] + " " + d)))
        item = {"g": "p", "t": p["titulo"], "a": p["ano"], "u": destino + "#" + pid, "d": d,
                "k": " ".join(k)}
        if p["img"]:
            item["m"] = p["img"]
        itens.append(item)

    itens += secoes_itens  # no empate, peca vem antes de secao
    return {"v": 1, "sin": SINONIMOS, "itens": itens}


def main(argv):
    check = "--check" in argv
    v_css = hash_arquivo(os.path.join(RAIZ, "assets", "busca.css"))
    v_js = hash_arquivo(os.path.join(RAIZ, "assets", "busca.js"))
    todas = sorted(f for f in os.listdir(RAIZ) if f.endswith(".html") and f not in SEM_BUSCA)
    mudou = []
    textos = {}
    for pagina in todas:
        antes = le(pagina)
        depois = garante_ganchos(garante_ids(antes, pagina), v_css, v_js)
        textos[pagina] = depois
        if depois != antes:
            mudou.append(pagina)
            if not check:
                grava(pagina, depois)
    faltam = [p for p in PAGINAS if p not in textos]
    if faltam:
        print("ERRO: paginas listadas que nao existem:", faltam)
        return 1
    novas = [p for p in todas if p not in PAGINAS and p != "busca.html"]
    if novas:
        print("AVISO: paginas fora do indice (inclua em PAGINAS):", novas)
    indice = monta_indice(textos)
    js = json.dumps(indice, ensure_ascii=False, separators=(",", ":"), sort_keys=False) + "\n"
    atual = open(SAIDA, encoding="utf-8").read() if os.path.exists(SAIDA) else ""
    if js != atual:
        mudou.append("assets/busca.json")
        if not check:
            with open(SAIDA, "w", encoding="utf-8", newline="\n") as f:
                f.write(js)
    cont = {}
    for it in indice["itens"]:
        cont[it["g"]] = cont.get(it["g"], 0) + 1
    import gzip
    tam = len(js.encode("utf-8"))
    gz = len(gzip.compress(js.encode("utf-8"), 9, mtime=0))
    print("busca.json: %d itens (pecas %d, paginas/secoes %d, ferramentas %d), %.1f KB, %.1f KB com gzip"
          % (len(indice["itens"]), cont.get("p", 0), cont.get("g", 0), cont.get("f", 0), tam / 1024, gz / 1024))
    if check:
        if mudou:
            print("DESATUALIZADO:", ", ".join(mudou), "-> rode: python tools/build_search_index.py")
            return 1
        print("OK: indice e paginas em dia")
        return 0
    print("gravado:" if mudou else "nada mudou", ", ".join(mudou))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
