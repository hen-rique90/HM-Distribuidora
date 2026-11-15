(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Carrinho salvo no navegador do cliente: { idProduto: quantidade }
  let carrinho = {};
  try { carrinho = JSON.parse(localStorage.getItem("hm-carrinho")) || {}; } catch (e) { carrinho = {}; }
  let localizacao = null; // { lat, lng }

  let produtos = [];
  let produtoPorId = {};

  function definirProdutos(lista) {
    produtos = lista;
    produtoPorId = Object.fromEntries(lista.map((p) => [p.id, p]));
    // Remove do carrinho itens que não existem mais ou excedem o estoque
    for (const id of Object.keys(carrinho)) {
      const p = produtoPorId[id];
      if (!p || p.estoque <= 0) delete carrinho[id];
      else carrinho[id] = Math.min(carrinho[id], p.estoque);
    }
    salvar();
  }

  // ---------- Planilha do Google ----------
  const normalizar = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  // Lê CSV respeitando campos entre aspas (ex.: "4,50")
  function lerCSV(texto) {
    const linhas = [];
    let linha = [], campo = "", aspas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (aspas) {
        if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') aspas = false;
        else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === ",") { linha.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i++;
        linha.push(campo); linhas.push(linha); linha = []; campo = "";
      } else campo += c;
    }
    if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas.filter((l) => l.some((v) => v.trim()));
  }

  function numero(v) {
    let t = String(v || "").replace(/[^\d,.-]/g, "");
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(t);
    return isNaN(n) ? 0 : n;
  }

  function acharCategoria(valor) {
    const v = normalizar(valor);
    return CATEGORIAS.find((c) => normalizar(c.id) === v || normalizar(c.nome) === v || normalizar(c.nome).startsWith(v));
  }

  // Converte linhas { produto, tamanho, categoria, preco, estoque } em produtos do site
  function montarProdutos(linhas) {
    const ids = new Set();
    return linhas.map((l) => {
      const nome = [String(l.produto || "").trim(), String(l.tamanho || "").trim()].filter(Boolean).join(" ");
      const cat = acharCategoria(l.categoria);
      if (!nome || !cat) return null;
      let id = normalizar(nome).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      while (ids.has(id)) id += "-2";
      ids.add(id);
      return { id, nome, categoria: cat.id, preco: numero(l.preco), estoque: Math.max(0, Math.floor(numero(l.estoque))) };
    }).filter(Boolean);
  }

  function produtosDaPlanilha(texto) {
    const [cab, ...linhas] = lerCSV(texto);
    if (!cab) return [];
    const col = (...nomes) => cab.findIndex((h) => nomes.includes(normalizar(h)));
    const iNome = col("produto", "nome"), iTam = col("tamanho"), iCat = col("categoria"), iPreco = col("preco", "valor"), iEst = col("estoque", "quantidade", "qtd");
    if ([iNome, iCat, iPreco, iEst].includes(-1)) throw new Error("Colunas esperadas: produto, categoria, preco, estoque");
    return montarProdutos(linhas.map((l) => ({
      produto: l[iNome], tamanho: iTam >= 0 ? l[iTam] : "", categoria: l[iCat], preco: l[iPreco], estoque: l[iEst],
    })));
  }

  // Ordem: script da planilha (estoque em tempo real) → CSV publicado → lista do config.js
  async function carregarProdutos() {
    const script = (LOJA.scriptPedidos || "").trim();
    if (script) {
      try {
        const resp = await fetch(`${script}?acao=listar&t=${Date.now()}`);
        const r = await resp.json();
        // O script devolve "produto" já com o tamanho; separa para não duplicar
        const lista = montarProdutos((r.produtos || []).map((p) => ({ ...p, tamanho: "" })));
        if (r.ok && lista.length) return lista;
      } catch (e) {
        console.warn("Não foi possível ler o estoque pelo script:", e);
      }
    }
    const url = (LOJA.planilhaEstoque || "").trim();
    if (url) {
      try {
        const sep = url.includes("?") ? "&" : "?";
        const resp = await fetch(`${url}${sep}t=${Date.now()}`, { cache: "no-store" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const lista = produtosDaPlanilha(await resp.text());
        if (lista.length) return lista;
      } catch (e) {
        console.warn("Não foi possível ler a planilha:", e);
      }
    }
    return PRODUTOS;
  }

  function horarioNoturno() {
    const h = new Date().getHours();
    const { inicio, fim } = LOJA.espetinhos;
    return inicio <= fim ? h >= inicio && h < fim : h >= inicio || h < fim;
  }

  function noturno(p) {
    return !!(p.noturno || CATEGORIAS.find((c) => c.id === p.categoria)?.noturno);
  }

  function disponivel(p) {
    return p.estoque > 0 && (!noturno(p) || horarioNoturno());
  }

  function salvar() {
    try { localStorage.setItem("hm-carrinho", JSON.stringify(carrinho)); } catch (e) { /* ignora */ }
  }

  function escapar(t) {
    return String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------- Cabeçalho ----------
  document.title = LOJA.nome;
  $("#nome-loja").textContent = LOJA.nome;
  $("#slogan").textContent = LOJA.slogan;
  $("#categorias").innerHTML = CATEGORIAS.map(
    (c) => `<a href="#cat-${c.id}">${c.icone} ${escapar(c.nome)}</a>`
  ).join("");

  if (!horarioNoturno()) {
    const aviso = $("#aviso-noite");
    aviso.hidden = false;
    aviso.textContent = `🍢 Os espetinhos ficam disponíveis das ${LOJA.espetinhos.inicio}h às ${LOJA.espetinhos.fim}h.`;
  }

  // ---------- Lista de produtos ----------
  function textoEstoque(p) {
    if (p.estoque <= 0) return `<span class="estoque zero">Esgotado</span>`;
    if (noturno(p) && !horarioNoturno()) return `<span class="estoque zero">Disponível a partir das ${LOJA.espetinhos.inicio}h</span>`;
    if (p.estoque <= 5) return `<span class="estoque pouco">Últimas ${p.estoque} unidades</span>`;
    return `<span class="estoque">${p.estoque} em estoque</span>`;
  }

  function controleQtd(p) {
    const q = carrinho[p.id] || 0;
    const pode = disponivel(p);
    return `<div class="qtd">
      <button type="button" data-menos="${p.id}" ${q === 0 ? "disabled" : ""} aria-label="Remover um">−</button>
      <span>${q}</span>
      <button type="button" data-mais="${p.id}" ${!pode || q >= p.estoque ? "disabled" : ""} aria-label="Adicionar um">+</button>
    </div>`;
  }

  function renderLista() {
    const termo = $("#busca").value.trim().toLowerCase();
    const html = CATEGORIAS.map((c) => {
      const itens = produtos.filter((p) => p.categoria === c.id && p.nome.toLowerCase().includes(termo));
      if (!itens.length) return "";
      return `<section class="secao" id="cat-${c.id}">
        <h2>${c.icone} ${escapar(c.nome)}</h2>
        <div class="grade">${itens.map((p) => `
          <article class="produto ${disponivel(p) ? "" : "indisponivel"}">
            <h3>${escapar(p.nome)}</h3>
            ${textoEstoque(p)}
            <div class="produto-rodape">
              <span class="preco">${brl(p.preco)}</span>
              ${controleQtd(p)}
            </div>
          </article>`).join("")}
        </div>
      </section>`;
    }).join("");
    $("#lista").innerHTML = html || `<p class="vazio">Nenhum produto encontrado.</p>`;
  }

  // ---------- Carrinho ----------
  function itensCarrinho() {
    return Object.entries(carrinho)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => ({ p: produtoPorId[id], q }));
  }

  function ehEntrega() {
    return document.querySelector('input[name="tipo"]:checked').value === "entrega";
  }

  function calcular() {
    const subtotal = itensCarrinho().reduce((s, { p, q }) => s + p.preco * q, 0);
    const taxa = ehEntrega() && subtotal > 0 ? LOJA.taxaEntrega : 0;
    return { subtotal, taxa, total: subtotal + taxa };
  }

  function renderCarrinho() {
    const itens = itensCarrinho();
    const qtd = itens.reduce((s, i) => s + i.q, 0);
    const { subtotal, taxa, total } = calcular();

    $("#qtd-carrinho").textContent = qtd;
    $("#barra-total").hidden = qtd === 0 || !$("#painel").hidden;
    $("#barra-valor").textContent = brl(total);

    $("#itens-carrinho").innerHTML = itens.length
      ? itens.map(({ p, q }) => `
        <div class="item">
          <div class="item-nome">${escapar(p.nome)}<small>${q} × ${brl(p.preco)} = ${brl(p.preco * q)}</small></div>
          ${controleQtd(p)}
        </div>`).join("")
      : `<p class="vazio">Seu carrinho está vazio.</p>`;

    $("#subtotal").textContent = brl(subtotal);
    $("#taxa").textContent = taxa ? brl(taxa) : "Grátis";
    $("#linha-taxa").hidden = !ehEntrega();
    $("#total").textContent = brl(total);
  }

  function alterar(id, delta) {
    const p = produtoPorId[id];
    if (!p) return;
    const atual = carrinho[id] || 0;
    const novo = Math.max(0, Math.min(p.estoque, atual + delta));
    if (delta > 0 && !disponivel(p)) return;
    if (novo === 0) delete carrinho[id]; else carrinho[id] = novo;
    salvar();
    renderLista();
    renderCarrinho();
  }

  document.addEventListener("click", (e) => {
    const mais = e.target.closest("[data-mais]");
    const menos = e.target.closest("[data-menos]");
    if (mais) alterar(mais.dataset.mais, 1);
    if (menos) alterar(menos.dataset.menos, -1);
    if (e.target.closest("[data-fechar]")) fecharPainel();
  });

  $("#busca").addEventListener("input", renderLista);

  // ---------- Painel ----------
  function abrirPainel() {
    $("#painel").hidden = false;
    document.body.style.overflow = "hidden";
    renderCarrinho();
  }
  function fecharPainel() {
    $("#painel").hidden = true;
    document.body.style.overflow = "";
    renderCarrinho();
  }
  $("#btn-carrinho").addEventListener("click", abrirPainel);
  $("#barra-total").addEventListener("click", abrirPainel);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#painel").hidden) fecharPainel(); });

  const form = $("#form-pedido");

  form.addEventListener("change", (e) => {
    if (e.target.name === "tipo") {
      $("#campos-endereco").hidden = !ehEntrega();
      renderCarrinho();
    }
    if (e.target.name === "pagamento") {
      const v = e.target.value;
      $("#campo-troco").hidden = v !== "Dinheiro";
      const pix = $("#info-pix");
      pix.hidden = v !== "Pix";
      pix.textContent = `Chave Pix: ${LOJA.chavePix} — envie o comprovante na conversa do WhatsApp.`;
    }
  });

  // ---------- Localização ----------
  $("#btn-localizacao").addEventListener("click", () => {
    const status = $("#status-localizacao");
    if (!navigator.geolocation) {
      status.textContent = "Seu navegador não permite pegar a localização. Digite o endereço abaixo.";
      return;
    }
    status.textContent = "Buscando sua localização...";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        localizacao = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const link = linkMapa();
        status.innerHTML = `✅ Localização adicionada. <a href="${link}" target="_blank" rel="noopener">Ver no mapa</a>`;
      },
      () => {
        status.textContent = "Não foi possível pegar a localização. Verifique a permissão ou digite o endereço.";
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });

  function linkMapa() {
    return `https://maps.google.com/?q=${localizacao.lat.toFixed(6)},${localizacao.lng.toFixed(6)}`;
  }

  // ---------- Enviar pedido ----------
  // Envia o pedido para o script da planilha, que confere e baixa o estoque.
  // Retorna { ok, numero } | { ok:false, faltando:[...] } | null (script fora do ar)
  async function baixarEstoque(dados) {
    const url = (LOJA.scriptPedidos || "").trim();
    if (!url) return null;
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // evita preflight de CORS no Google
        body: JSON.stringify(dados),
      });
      const r = await resp.json();
      return r.ok || r.faltando ? r : null;
    } catch (e) {
      console.warn("Falha ao baixar o estoque:", e);
      return null;
    }
  }

  let enviando = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (enviando) return;
    const erro = $("#erro");
    erro.textContent = "";
    const d = Object.fromEntries(new FormData(form));
    const itens = itensCarrinho();
    const { subtotal, taxa, total } = calcular();
    const entrega = ehEntrega();

    const falha = (msg, campo) => {
      erro.textContent = msg;
      if (campo) form.elements[campo].focus?.();
    };

    if (!itens.length) return falha("Adicione pelo menos um produto ao pedido.");
    const indisponiveis = itens.filter(({ p }) => !disponivel(p));
    if (indisponiveis.length) return falha(`Indisponível agora: ${indisponiveis.map((i) => i.p.nome).join(", ")}. Remova do pedido.`);
    if (!d.nome.trim()) return falha("Informe seu nome.", "nome");
    if (d.telefone.replace(/\D/g, "").length < 10) return falha("Informe um telefone válido com DDD.", "telefone");
    if (entrega && !d.endereco.trim() && !localizacao) return falha("Informe o endereço ou use sua localização atual.", "endereco");
    if (entrega && subtotal < LOJA.pedidoMinimoEntrega) return falha(`O pedido mínimo para entrega é ${brl(LOJA.pedidoMinimoEntrega)}.`);
    if (!d.pagamento) return falha("Escolha a forma de pagamento.");

    let troco = "";
    if (d.pagamento === "Dinheiro" && d.troco.trim()) {
      const valor = parseFloat(d.troco.replace(/[^\d,.]/g, "").replace(",", "."));
      if (isNaN(valor) || valor < total) return falha(`O valor para troco deve ser maior que o total (${brl(total)}).`, "troco");
      troco = `Troco para ${brl(valor)} (troco: ${brl(valor - total)})`;
    }

    const enderecoCompleto = entrega
      ? [d.endereco.trim(), d.referencia.trim(), localizacao ? linkMapa() : ""].filter(Boolean).join(" | ")
      : "";

    const botao = form.querySelector(".btn-enviar");
    const textoBotao = botao.textContent;
    enviando = true;
    botao.disabled = true;
    botao.textContent = "Confirmando estoque...";
    const r = await baixarEstoque({
      cliente: d.nome.trim(),
      telefone: d.telefone.trim(),
      itens: itens.map(({ p, q }) => ({ produto: p.nome, quantidade: q })),
      total,
      pagamento: d.pagamento,
      tipo: entrega ? "Entrega" : "Retirada",
      endereco: enderecoCompleto,
    });
    enviando = false;
    botao.disabled = false;
    botao.textContent = textoBotao;

    if (r && !r.ok) {
      // Estoque mudou desde que a página abriu: atualiza e avisa o cliente
      for (const f of r.faltando) {
        const p = produtos.find((x) => x.nome === f.produto);
        if (p) p.estoque = f.disponivel;
      }
      definirProdutos(produtos);
      renderLista();
      renderCarrinho();
      return falha("Desculpe, o estoque mudou: " + r.faltando
        .map((f) => f.disponivel > 0 ? `${f.produto} (só ${f.disponivel})` : `${f.produto} (esgotado)`)
        .join(", ") + ". Ajustamos seu carrinho, confira e envie de novo.");
    }

    const linhas = [
      r ? `*NOVO PEDIDO Nº ${r.numero} — ${LOJA.nome}*` : `*NOVO PEDIDO — ${LOJA.nome}*`,
      "",
      `*Cliente:* ${d.nome.trim()}`,
      `*Telefone:* ${d.telefone.trim()}`,
      "",
      "*Itens:*",
      ...itens.map(({ p, q }) => `• ${q}x ${p.nome} — ${brl(p.preco * q)}`),
      "",
      `Subtotal: ${brl(subtotal)}`,
      entrega ? `Entrega: ${taxa ? brl(taxa) : "Grátis"}` : null,
      `*Total: ${brl(total)}*`,
      "",
      `*Pagamento:* ${d.pagamento}`,
      troco || null,
      "",
      entrega ? "*🛵 ENTREGA*" : "*🏪 RETIRADA NA LOJA*",
      entrega && d.endereco.trim() ? `Endereço: ${d.endereco.trim()}` : null,
      entrega && d.referencia.trim() ? `Referência: ${d.referencia.trim()}` : null,
      entrega && localizacao ? `Localização: ${linkMapa()}` : null,
      d.obs.trim() ? `\n*Obs.:* ${d.obs.trim()}` : null,
      LOJA.scriptPedidos && !r ? "\n⚠️ Estoque não foi baixado automaticamente." : null,
    ].filter((l) => l !== null);

    const url = `https://wa.me/${LOJA.whatsapp}?text=${encodeURIComponent(linhas.join("\n"))}`;
    window.open(url, "_blank") || (window.location.href = url);

    carrinho = {};
    salvar();
    renderLista();
    renderCarrinho();
    $("#itens-carrinho").innerHTML = `<p class="vazio">✅ Pedido montado! Confirme o envio no WhatsApp.</p>`;
  });

  $("#lista").innerHTML = `<p class="vazio">Carregando estoque...</p>`;
  carregarProdutos().then((lista) => {
    definirProdutos(lista);
    renderLista();
    renderCarrinho();
  });
})();
