// =====================================================================
//  CONFIGURAÇÃO DA LOJA — edite este arquivo para mudar tudo no site
// =====================================================================

const LOJA = {
  nome: "HM Distribuidora",
  slogan: "Bebida gelada e espetinho na brasa",

  // Número do WhatsApp que RECEBE os pedidos.
  // Formato: 55 + DDD + número, só dígitos. Ex.: 5511987654321
  whatsapp: "5500000000000",

  // Taxa de entrega (R$). Use 0 para entrega grátis.
  taxaEntrega: 5.0,

  // Pedido mínimo para entrega (R$). Use 0 para não ter mínimo.
  pedidoMinimoEntrega: 20.0,

  // Horário em que os espetinhos ficam disponíveis (formato 24h).
  espetinhos: { inicio: 18, fim: 23 },

  // Link da planilha do Google com o estoque (publicada como CSV).
  // Veja o passo a passo no README.md. Deixe "" para usar a lista PRODUTOS abaixo.
  planilhaEstoque: "",

  // Chave Pix mostrada para o cliente quando escolher Pix.
  chavePix: "sua-chave-pix@exemplo.com",
};

// =====================================================================
//  ESTOQUE
//  Se "planilhaEstoque" estiver preenchido, os produtos vêm da planilha e a
//  lista PRODUTOS abaixo só é usada se a planilha não puder ser lida.
//  - estoque: quantidade disponível (0 = esgotado, aparece como "Esgotado")
//  - categoria: precisa ser uma das CATEGORIAS abaixo
//  - noturno: true = só pode ser pedido no horário dos espetinhos
//    (todos da categoria espetinhos já são noturnos)
// =====================================================================

const CATEGORIAS = [
  { id: "cervejas", nome: "Cervejas", icone: "🍺" },
  { id: "refrigerantes", nome: "Refrigerantes", icone: "🥤" },
  { id: "cachacas", nome: "Cachaças", icone: "🥃" },
  { id: "doses", nome: "Doses (copo americano)", icone: "🥛" },
  { id: "espetinhos", nome: "Espetinhos (à noite)", icone: "🍢", noturno: true },
];

const PRODUTOS = [
  // Cervejas
  { id: "brahma-lata", nome: "Brahma lata 350ml", preco: 4.5, estoque: 120, categoria: "cervejas" },
  { id: "skol-lata", nome: "Skol lata 350ml", preco: 4.5, estoque: 96, categoria: "cervejas" },
  { id: "heineken-ln", nome: "Heineken long neck 330ml", preco: 8.0, estoque: 48, categoria: "cervejas" },
  { id: "original-600", nome: "Original 600ml", preco: 12.0, estoque: 24, categoria: "cervejas" },
  { id: "brahma-litrao", nome: "Brahma litrão 1L", preco: 11.0, estoque: 0, categoria: "cervejas" },

  // Refrigerantes
  { id: "coca-2l", nome: "Coca-Cola 2L", preco: 12.0, estoque: 30, categoria: "refrigerantes" },
  { id: "coca-lata", nome: "Coca-Cola lata 350ml", preco: 5.0, estoque: 60, categoria: "refrigerantes" },
  { id: "guarana-2l", nome: "Guaraná Antarctica 2L", preco: 10.0, estoque: 25, categoria: "refrigerantes" },
  { id: "fanta-2l", nome: "Fanta Laranja 2L", preco: 9.0, estoque: 12, categoria: "refrigerantes" },

  // Cachaças (garrafa)
  { id: "51-garrafa", nome: "Cachaça 51 965ml", preco: 18.0, estoque: 15, categoria: "cachacas" },
  { id: "ypioca-garrafa", nome: "Ypióca Prata 965ml", preco: 22.0, estoque: 10, categoria: "cachacas" },
  { id: "velho-barreiro", nome: "Velho Barreiro 910ml", preco: 17.0, estoque: 8, categoria: "cachacas" },

  // Doses no copo americano
  { id: "dose-51", nome: "Dose de 51", preco: 3.0, estoque: 100, categoria: "doses" },
  { id: "dose-ypioca", nome: "Dose de Ypióca", preco: 4.0, estoque: 100, categoria: "doses" },
  { id: "dose-conhaque", nome: "Dose de conhaque", preco: 4.0, estoque: 80, categoria: "doses" },

  // Espetinhos (só à noite)
  { id: "esp-carne", nome: "Espetinho de carne", preco: 8.0, estoque: 40, categoria: "espetinhos", noturno: true },
  { id: "esp-frango", nome: "Espetinho de frango", preco: 7.0, estoque: 40, categoria: "espetinhos", noturno: true },
  { id: "esp-linguica", nome: "Espetinho de linguiça", preco: 7.0, estoque: 30, categoria: "espetinhos", noturno: true },
  { id: "esp-queijo", nome: "Espetinho de queijo coalho", preco: 7.0, estoque: 25, categoria: "espetinhos", noturno: true },
  { id: "esp-coracao", nome: "Espetinho de coração", preco: 8.0, estoque: 20, categoria: "espetinhos", noturno: true },
];
