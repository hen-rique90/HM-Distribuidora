/**
 * HM Distribuidora — baixa automática de estoque
 *
 * Cole este código em: Planilha → Extensões → Apps Script.
 * Depois publique em: Implantar → Nova implantação → App da Web
 *   - Executar como: Eu
 *   - Quem pode acessar: Qualquer pessoa
 * e copie a URL gerada para o campo "scriptPedidos" do config.js.
 *
 * Passo a passo completo no README.md.
 */

const ABA_PEDIDOS = "Pedidos";
const MAX_POR_ITEM = 200; // trava contra pedidos absurdos

// ---------------------------------------------------------------------
//  Recebe o pedido do site
// ---------------------------------------------------------------------
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // um pedido por vez, para não vender o mesmo item duas vezes
    const pedido = JSON.parse(e.postData.contents);
    return responder(processarPedido(pedido));
  } catch (err) {
    return responder({ ok: false, erro: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return responder({ ok: true, mensagem: "Script de pedidos da HM Distribuidora funcionando." });
}

function processarPedido(pedido) {
  const itens = (pedido && pedido.itens) || [];
  if (!itens.length) return { ok: false, erro: "Pedido sem itens." };

  const est = lerEstoque();
  const faltando = [];
  const baixas = [];

  for (const item of itens) {
    const qtd = Math.floor(Number(item.quantidade));
    const linha = est.porNome[normalizar(item.produto)];
    if (!linha || !(qtd > 0) || qtd > MAX_POR_ITEM) {
      faltando.push({ produto: item.produto, disponivel: linha ? linha.estoque : 0 });
      continue;
    }
    if (linha.estoque < qtd) {
      faltando.push({ produto: item.produto, disponivel: linha.estoque });
      continue;
    }
    baixas.push({ linha, qtd });
  }

  if (faltando.length) return { ok: false, faltando };

  // Tudo disponível: dá baixa
  for (const { linha, qtd } of baixas) {
    linha.estoque -= qtd;
    est.aba.getRange(linha.numero, est.colEstoque).setValue(linha.estoque);
  }

  const numero = registrarPedido(pedido);
  return { ok: true, numero };
}

// ---------------------------------------------------------------------
//  Planilha de estoque
// ---------------------------------------------------------------------
function lerEstoque() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const aba of ss.getSheets()) {
    if (aba.getName() === ABA_PEDIDOS) continue;
    const dados = aba.getDataRange().getValues();
    if (!dados.length) continue;
    const cab = dados[0].map(normalizar);
    const iNome = cab.findIndex((h) => h === "produto" || h === "nome");
    const iEst = cab.findIndex((h) => h === "estoque" || h === "quantidade" || h === "qtd");
    if (iNome < 0 || iEst < 0) continue;

    const porNome = {};
    for (let r = 1; r < dados.length; r++) {
      const nome = normalizar(dados[r][iNome]);
      if (!nome || porNome[nome]) continue;
      porNome[nome] = { numero: r + 1, estoque: Math.max(0, Math.floor(Number(dados[r][iEst]) || 0)) };
    }
    return { aba, colEstoque: iEst + 1, porNome };
  }
  throw new Error("Não encontrei uma aba com as colunas 'produto' e 'estoque'.");
}

// ---------------------------------------------------------------------
//  Aba "Pedidos"
// ---------------------------------------------------------------------
const CAB_PEDIDOS = ["Nº", "Data", "Cliente", "Telefone", "Itens", "Total", "Pagamento", "Tipo", "Endereço", "Status", "Itens (não editar)"];

function abaPedidos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(ABA_PEDIDOS);
  if (!aba) {
    aba = ss.insertSheet(ABA_PEDIDOS);
    aba.appendRow(CAB_PEDIDOS);
    aba.setFrozenRows(1);
    aba.getRange(1, 1, 1, CAB_PEDIDOS.length).setFontWeight("bold");
    aba.hideColumns(CAB_PEDIDOS.length);
  }
  return aba;
}

function registrarPedido(p) {
  const aba = abaPedidos();
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
      if (l) est.aba.getRange(l.numero, est.colEstoque).setValue(l.estoque + i.quantidade);
    }
    aba.getRange(linha, colStatus).setValue("Cancelado");
  } finally {
    lock.releaseLock();
  }
  ui.alert(`Pedido ${numero} cancelado e estoque devolvido.`);
}

// ---------------------------------------------------------------------
function normalizar(t) {
  return String(t == null ? "" : t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
