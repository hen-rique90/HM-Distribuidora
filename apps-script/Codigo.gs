/**
 * HM Distribuidora — estoque e pedidos na planilha do Google
 *
 * Cole este código em: Planilha → Extensões → Apps Script.
 * 1) Troque a SENHA_ADMIN abaixo (é a senha da página admin.html).
 * 2) Publique em: Implantar → Nova implantação → App da Web
 *      - Executar como: Eu
 *      - Quem pode acessar: Qualquer pessoa
 *    e copie a URL gerada para o campo "scriptPedidos" do config.js.
 *
 * Passo a passo completo no README.md.
 */

const SENHA_ADMIN = "troque-esta-senha";

const ABA_PEDIDOS = "Pedidos";
const ABA_ENTRADAS = "Entradas";
const MAX_POR_ITEM = 200; // trava contra pedidos absurdos

// ---------------------------------------------------------------------
//  Rotas
// ---------------------------------------------------------------------
function doGet(e) {
  const acao = e && e.parameter && e.parameter.acao;
  if (acao === "listar") return responder({ ok: true, produtos: listarProdutos() });
  return responder({ ok: true, mensagem: "Script da HM Distribuidora funcionando." });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // uma operação por vez, para o estoque não se perder
    const dados = JSON.parse(e.postData.contents);
    const acao = dados.acao || "pedido";

    if (acao === "pedido") return responder(processarPedido(dados));

    // Ações de administração exigem senha
    if (SENHA_ADMIN === "troque-esta-senha") {
      return responder({ ok: false, erro: "Defina a SENHA_ADMIN no Apps Script antes de usar a área admin." });
    }
    if (String(dados.senha || "") !== SENHA_ADMIN) {
      Utilities.sleep(1500); // dificulta tentativas de adivinhar a senha
      return responder({ ok: false, erro: "Senha incorreta.", senhaInvalida: true });
    }
    if (acao === "verificar") return responder({ ok: true });
    if (acao === "entrada") return responder(darEntrada(dados));
    if (acao === "cadastrar") return responder(cadastrarProduto(dados));
    return responder({ ok: false, erro: "Ação desconhecida." });
  } catch (err) {
    return responder({ ok: false, erro: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------
//  Pedidos (vindos do site)
// ---------------------------------------------------------------------
function processarPedido(pedido) {
  const itens = (pedido && pedido.itens) || [];
  if (!itens.length) return { ok: false, erro: "Pedido sem itens." };

  const est = lerEstoque();
  const faltando = [];
  const baixas = [];

  for (const item of itens) {
    const qtd = Math.floor(Number(item.quantidade));
    const linha = est.porNome[normalizar(item.produto)];
    if (!linha || !(qtd > 0) || qtd > MAX_POR_ITEM || linha.estoque < qtd) {
      faltando.push({ produto: item.produto, disponivel: linha ? linha.estoque : 0 });
      continue;
    }
    baixas.push({ linha, qtd });
  }

  if (faltando.length) return { ok: false, faltando };

  for (const { linha, qtd } of baixas) {
    linha.estoque -= qtd;
    est.aba.getRange(linha.numero, est.col.estoque).setValue(linha.estoque);
  }

  return { ok: true, numero: registrarPedido(pedido) };
}

// ---------------------------------------------------------------------
//  Administração (página admin.html)
// ---------------------------------------------------------------------
function darEntrada(d) {
  const qtd = Math.floor(Number(d.quantidade));
  if (!(qtd > 0)) return { ok: false, erro: "Informe uma quantidade maior que zero." };

  const est = lerEstoque();
  const linha = est.porNome[normalizar(d.produto)];
  if (!linha) return { ok: false, erro: `Produto "${d.produto}" não encontrado.` };

  linha.estoque += qtd;
  est.aba.getRange(linha.numero, est.col.estoque).setValue(linha.estoque);

  const preco = paraNumero(d.preco);
  if (preco > 0 && est.col.preco) est.aba.getRange(linha.numero, est.col.preco).setValue(preco);

  registrarEntrada(linha.nomeCompleto, qtd, preco > 0 ? preco : "", "Entrada");
  return { ok: true, estoque: linha.estoque };
}

function cadastrarProduto(d) {
  const nome = String(d.nome || "").trim();
  const tamanho = String(d.tamanho || "").trim();
  const categoria = String(d.categoria || "").trim();
  const preco = paraNumero(d.preco);
  const qtd = Math.max(0, Math.floor(Number(d.estoque) || 0));

  if (!nome) return { ok: false, erro: "Informe o nome do produto." };
  if (!categoria) return { ok: false, erro: "Escolha a categoria." };
  if (!(preco > 0)) return { ok: false, erro: "Informe o preço." };

  const est = lerEstoque();
  const nomeCompleto = juntarNome(nome, tamanho);
  if (est.porNome[normalizar(nomeCompleto)]) {
    return { ok: false, erro: `"${nomeCompleto}" já existe. Use "Entrada de estoque" para somar quantidade.` };
  }

  // Garante a coluna "tamanho" (planilhas antigas não têm)
  if (!est.col.tamanho) {
    est.col.tamanho = est.aba.getLastColumn() + 1;
    est.aba.getRange(1, est.col.tamanho).setValue("tamanho");
  }

  const linha = new Array(est.aba.getLastColumn()).fill("");
  linha[est.col.produto - 1] = nome;
  linha[est.col.tamanho - 1] = tamanho;
  linha[est.col.categoria - 1] = categoria;
  linha[est.col.preco - 1] = preco;
  linha[est.col.estoque - 1] = qtd;
  est.aba.appendRow(linha);

  registrarEntrada(nomeCompleto, qtd, preco, "Cadastro");
  return { ok: true, produto: nomeCompleto };
}

function listarProdutos() {
  const est = lerEstoque();
  return est.linhas.map((l) => ({
    produto: l.nomeCompleto,
    nome: l.nome,
    tamanho: l.tamanho,
    categoria: l.categoria,
    preco: l.preco,
    estoque: l.estoque,
  }));
}

// ---------------------------------------------------------------------
//  Planilha de estoque
// ---------------------------------------------------------------------
function lerEstoque() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const aba of ss.getSheets()) {
    const nomeAba = aba.getName();
    if (nomeAba === ABA_PEDIDOS || nomeAba === ABA_ENTRADAS) continue;
    const dados = aba.getDataRange().getValues();
    if (!dados.length) continue;
    const cab = dados[0].map(normalizar);
    const achar = (...nomes) => cab.findIndex((h) => nomes.includes(h)) + 1; // 0 = não existe
    const col = {
      produto: achar("produto", "nome"),
      tamanho: achar("tamanho"),
      categoria: achar("categoria"),
      preco: achar("preco", "valor"),
      estoque: achar("estoque", "quantidade", "qtd"),
    };
    if (!col.produto || !col.estoque) continue;

    const porNome = {};
    const linhas = [];
    for (let r = 1; r < dados.length; r++) {
      const v = (c) => (c && dados[r][c - 1] != null ? dados[r][c - 1] : "");
      const nome = String(v(col.produto)).trim();
      if (!nome) continue;
      const tamanho = String(v(col.tamanho)).trim();
      const nomeCompleto = juntarNome(nome, tamanho);
      const chave = normalizar(nomeCompleto);
      if (porNome[chave]) continue;
      const linha = {
        numero: r + 1,
        nome,
        tamanho,
        nomeCompleto,
        categoria: String(v(col.categoria)).trim(),
        preco: paraNumero(v(col.preco)),
        estoque: Math.max(0, Math.floor(paraNumero(v(col.estoque)))),
      };
      porNome[chave] = linha;
      linhas.push(linha);
    }
    return { aba, col, porNome, linhas };
  }
  throw new Error("Não encontrei uma aba com as colunas 'produto' e 'estoque'.");
}

// ---------------------------------------------------------------------
//  Abas de registro
// ---------------------------------------------------------------------
const CAB_PEDIDOS = ["Nº", "Data", "Cliente", "Telefone", "Itens", "Total", "Pagamento", "Tipo", "Endereço", "Status", "Itens (não editar)"];
const CAB_ENTRADAS = ["Data", "Tipo", "Produto", "Quantidade", "Preço"];

function abaRegistro(nome, cabecalho, ocultarUltima) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(nome);
  if (!aba) {
    aba = ss.insertSheet(nome);
    aba.appendRow(cabecalho);
    aba.setFrozenRows(1);
    aba.getRange(1, 1, 1, cabecalho.length).setFontWeight("bold");
    if (ocultarUltima) aba.hideColumns(cabecalho.length);
  }
  return aba;
}

function registrarPedido(p) {
  const aba = abaRegistro(ABA_PEDIDOS, CAB_PEDIDOS, true);
  const ultimo = aba.getLastRow() > 1 ? Number(aba.getRange(aba.getLastRow(), 1).getValue()) || 0 : 0;
  const numero = ultimo + 1;
  const texto = (v) => String(v == null ? "" : v).slice(0, 500);
  aba.appendRow([
    numero,
    new Date(),
    texto(p.cliente),
    "'" + texto(p.telefone),
    p.itens.map((i) => `${i.quantidade}x ${i.produto}`).join("\n"),
    Number(p.total) || 0,
    texto(p.pagamento),
    texto(p.tipo),
    texto(p.endereco),
    "Novo",
    JSON.stringify(p.itens.map((i) => ({ produto: String(i.produto), quantidade: Math.floor(Number(i.quantidade)) }))),
  ]);
  return numero;
}

function registrarEntrada(produto, qtd, preco, tipo) {
  abaRegistro(ABA_ENTRADAS, CAB_ENTRADAS, false).appendRow([new Date(), tipo, produto, qtd, preco]);
}

// ---------------------------------------------------------------------
//  Menu na planilha: cancelar pedido devolve os itens ao estoque
// ---------------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🍺 Pedidos")
    .addItem("Cancelar pedido selecionado (devolve ao estoque)", "cancelarPedidoSelecionado")
    .addToUi();
}

function cancelarPedidoSelecionado() {
  const ui = SpreadsheetApp.getUi();
  const aba = SpreadsheetApp.getActiveSheet();
  if (aba.getName() !== ABA_PEDIDOS) return ui.alert(`Abra a aba "${ABA_PEDIDOS}" e clique na linha do pedido.`);
  const linha = aba.getActiveRange().getRow();
  if (linha < 2) return ui.alert("Clique na linha do pedido que quer cancelar.");

  const colStatus = CAB_PEDIDOS.indexOf("Status") + 1;
  const colItens = CAB_PEDIDOS.length;
  const numero = aba.getRange(linha, 1).getValue();
  if (aba.getRange(linha, colStatus).getValue() === "Cancelado") return ui.alert(`O pedido ${numero} já está cancelado.`);
  if (ui.alert(`Cancelar o pedido ${numero} e devolver os itens ao estoque?`, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const itens = JSON.parse(aba.getRange(linha, colItens).getValue() || "[]");
    const est = lerEstoque();
    for (const i of itens) {
      const l = est.porNome[normalizar(i.produto)];
      if (l) est.aba.getRange(l.numero, est.col.estoque).setValue(l.estoque + i.quantidade);
    }
    aba.getRange(linha, colStatus).setValue("Cancelado");
  } finally {
    lock.releaseLock();
  }
  ui.alert(`Pedido ${numero} cancelado e estoque devolvido.`);
}

// ---------------------------------------------------------------------
function juntarNome(nome, tamanho) {
  return [String(nome || "").trim(), String(tamanho || "").trim()].filter(Boolean).join(" ");
}

function normalizar(t) {
  return String(t == null ? "" : t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

function paraNumero(v) {
  if (typeof v === "number") return v;
  let t = String(v == null ? "" : v).replace(/[^\d,.-]/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(t);
  return isNaN(n) ? 0 : n;
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
