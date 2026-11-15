# HM Distribuidora — site de pedidos

Site onde o cliente vê o estoque, monta o pedido, escolhe a forma de pagamento,
informa o endereço (ou envia a localização do celular) e **o pedido chega no
WhatsApp da loja** já formatado.

## Como configurar

Tudo é editado no arquivo **`config.js`**:

1. **`whatsapp`**: coloque o número que vai receber os pedidos (55 + DDD + número, só dígitos).
   Ex.: `"5511987654321"`.
2. **`taxaEntrega`**, **`pedidoMinimoEntrega`**, **`chavePix`**: ajuste os valores.
3. **`espetinhos`**: horário em que os espetinhos podem ser pedidos (padrão: 18h às 23h).
4. **`PRODUTOS`**: lista de produtos com preço e **estoque**.
   - `estoque: 0` mostra o produto como **Esgotado**.
   - Com 5 ou menos unidades, o site mostra "Últimas X unidades".
   - O cliente não consegue pedir mais do que o estoque.

## Como colocar no ar (grátis)

No GitHub: **Settings → Pages → Source: Deploy from a branch → branch `main`, pasta `/ (root)`**.
Em alguns minutos o site fica disponível em `https://<seu-usuario>.github.io/HM-Distribuidora/`.

Para testar no computador, é só abrir o `index.html` no navegador.

## Arquivos

- `index.html`: estrutura da página
- `style.css`: visual
- `app.js`: carrinho, validações e montagem da mensagem do WhatsApp
- `config.js`: dados da loja e estoque (**o único arquivo que você precisa editar**)
