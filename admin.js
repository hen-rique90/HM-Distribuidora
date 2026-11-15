(function () {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const normalizar = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  const URL_SCRIPT = (LOJA.scriptPedidos || "").trim();
  let senha = "";
  let produtos = [];

  $("#nome-loja").textContent = LOJA.nome;

  if (!URL_SCRIPT) {
    $("#sem-script").hidden = false;
    return;
  }

  // ---------- Comunicação com a planilha ----------
  async function enviar(dados) {
    const resp = await fetch(URL_SCRIPT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...dados, senha }),
    });
    return resp.json();
  }

  async function carregarProdutos() {
    $("#tabela").innerHTML = `<p class="vazio">Carregando...</p>`;
    try {
      const resp = await fetch(`${URL_SCRIPT}?acao=listar&t=${Date.now()}`);
      const r = await resp.json();
      if (!r.ok) throw new Error(r.erro);
      produtos = r.produtos;
    } catch (e) {
      $("#tabela").innerHTML = `<p class="erro">Não foi possível carregar o estoque: ${escapar(e.message)}</p>`;
      return;
    }
    renderSelect();
    renderTabela();
  }

  // ---------- Login ----------
  try { senha = sessionStorage.getItem("hm-admin") || ""; } catch (e) { /* ignora */ }

  function mostrarLogin() {
    $("#form-login").hidden = false;
    $("#painel-admin").hidden = true;
    $("#btn-sair").hidden = true;
    $("#form-login [name=senha]").focus();
  }

  function mostrarPainel() {
    $("#form-login").hidden = true;
    $("#painel-admin").hidden = false;
    $("#btn-sair").hidden = false;
    carregarProdutos();
  }

  $("#form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const erro = $(".erro", form);
    const botao = $("button", form);
    senha = form.senha.value;
    erro.textContent = "";
    botao.disabled = true;
    try {
      const r = await enviar({ acao: "verificar" });
      if (!r.ok) throw new Error(r.erro);
      try { sessionStorage.setItem("hm-admin", senha); } catch (e2) { /* ignora */ }
      form.reset();
      mostrarPainel();
    } catch (err) {
      erro.textContent = err.message || "Não foi possível entrar.";
    } finally {
      botao.disabled = false;
    }
  });

  $("#btn-sair").addEventListener("click", () => {
    senha = "";
    try { sessionStorage.removeItem("hm-admin"); } catch (e) { /* ignora */ }
    mostrarLogin();
  });

  // ---------- Abas ----------
  document.querySelectorAll(".aba").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll(".aba").forEach((x) => x.classList.toggle("ativa", x === b));
      document.querySelectorAll("[data-painel]").forEach((p) => (p.hidden = p.dataset.painel !== b.dataset.aba));
      $("#sucesso").textContent = "";
    })
  );

  // ---------- Listas ----------
  $("#form-novo [name=categoria]").innerHTML =
    `<option value="">Escolha...</option>` +
    CATEGORIAS.map((c) => `<option value="${escapar(c.nome.replace(/\s*\(.*\)$/, ""))}">${c.icone} ${escapar(c.nome)}</option>`).join("");

  function renderSelect() {
    const sel = $("#form-entrada [name=produto]");
    const atual = sel.value;
    const ordenados = [...produtos].sort((a, b) => a.produto.localeCompare(b.produto, "pt-BR"));
    sel.innerHTML = `<option value="">Escolha o produto...</option>` +
      ordenados.map((p) => `<option value="${escapar(p.produto)}">${escapar(p.produto)}</option>`).join("");
    sel.value = atual;
    mostrarInfoProduto();
  }

  function mostrarInfoProduto() {
    const p = produtos.find((x) => x.produto === $("#form-entrada [name=produto]").value);
    $("#info-produto").textContent = p ? `Hoje: ${p.estoque} em estoque · ${brl(p.preco)}` : "";
  }
  $("#form-entrada [name=produto]").addEventListener("change", mostrarInfoProduto);

  function renderTabela() {
    const termo = normalizar($("#busca").value);
    const lista = produtos
      .filter((p) => normalizar(p.produto).includes(termo))
      .sort((a, b) => a.categoria.localeCompare(b.categoria, "pt-BR") || a.produto.localeCompare(b.produto, "pt-BR"));
    $("#tabela").innerHTML = lista.length
      ? `<div class="tabela-estoque">${lista.map((p) => `
          <div class="linha-estoque ${p.estoque === 0 ? "zerado" : p.estoque <= 5 ? "baixo" : ""}">
            <div>
              <strong>${escapar(p.nome)}</strong> ${p.tamanho ? `<span class="tag">${escapar(p.tamanho)}</span>` : ""}
              <small>${escapar(p.categoria)} · ${brl(p.preco)}</small>
            </div>
            <div class="qtd-estoque">${p.estoque}<small>un.</small></div>
            <button type="button" class="btn-mini" data-entrada="${escapar(p.produto)}">+ Entrada</button>
          </div>`).join("")}</div>`
      : `<p class="vazio">Nenhum produto encontrado.</p>`;
  }
  $("#busca").addEventListener("input", renderTabela);

  // Botão "+ Entrada" na tabela: abre o formulário já com o produto escolhido
  $("#tabela").addEventListener("click", (e) => {
    const b = e.target.closest("[data-entrada]");
    if (!b) return;
    $('.aba[data-aba="entrada"]').click();
    $("#form-entrada [name=produto]").value = b.dataset.entrada;
    mostrarInfoProduto();
    window.scrollTo({ top: 0, behavior: "smooth" });
    $("#form-entrada [name=quantidade]").focus();
  });

  // ---------- Envio dos formulários ----------
  async function enviarForm(form, dados, mensagemSucesso) {
    const erro = $(".erro", form);
    const botao = $("button[type=submit]", form);
    erro.textContent = "";
    $("#sucesso").textContent = "";
    botao.disabled = true;
    try {
      const r = await enviar(dados);
      if (r.senhaInvalida) { mostrarLogin(); return; }
      if (!r.ok) throw new Error(r.erro);
      form.reset();
      $("#sucesso").textContent = mensagemSucesso(r);
      await carregarProdutos();
    } catch (err) {
      erro.textContent = err.message || "Erro ao salvar. Tente de novo.";
    } finally {
      botao.disabled = false;
    }
  }

  $("#form-entrada").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    if (!f.produto.value) return ($(".erro", f).textContent = "Escolha o produto.");
    const produto = f.produto.value;
    const qtd = f.quantidade.value;
    enviarForm(f, { acao: "entrada", produto, quantidade: qtd, preco: f.preco.value },
      (r) => `✅ +${qtd} ${produto}. Estoque agora: ${r.estoque}.`);
  });

  $("#form-novo").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    enviarForm(f, {
      acao: "cadastrar",
      nome: f.nome.value,
      tamanho: f.tamanho.value,
      categoria: f.categoria.value,
      preco: f.preco.value,
      estoque: f.estoque.value,
    }, (r) => `✅ ${r.produto} cadastrado.`);
  });

  // ---------- Início ----------
  if (senha) {
    enviar({ acao: "verificar" }).then((r) => (r.ok ? mostrarPainel() : mostrarLogin())).catch(mostrarLogin);
  } else {
    mostrarLogin();
  }
})();
