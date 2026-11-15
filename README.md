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
4. **Estoque**: use a planilha do Google (recomendado, veja abaixo) ou a lista
   **`PRODUTOS`** do `config.js`.
   - `estoque: 0` mostra o produto como **Esgotado**.
   - Com 5 ou menos unidades, o site mostra "Últimas X unidades".
   - O cliente não consegue pedir mais do que o estoque.

## Estoque pela planilha do Google

Assim você atualiza preços e estoque pelo celular, sem mexer no código.
O site lê a planilha toda vez que um cliente abre a página.

1. Acesse [sheets.google.com](https://sheets.google.com) e crie uma planilha nova.
2. **Arquivo → Importar → Fazer upload** e envie o arquivo `planilha-modelo.csv`
   deste projeto (escolha "Substituir planilha"). Ou digite as colunas na mão:

   | produto | categoria | preco | estoque |
   |---|---|---|---|
   | Brahma lata 350ml | Cervejas | 4,50 | 120 |
   | Espetinho de carne | Espetinhos | 8,00 | 40 |

   - **categoria** precisa ser uma destas: `Cervejas`, `Refrigerantes`, `Cachaças`,
     `Doses` ou `Espetinhos`. Linhas com outra categoria são ignoradas.
   - **estoque** `0` = aparece como Esgotado.
   - Tudo da categoria Espetinhos só pode ser pedido no horário da noite.
3. **Arquivo → Compartilhar → Publicar na Web**. Escolha a aba da planilha e o
   formato **Valores separados por vírgula (.csv)**, e clique em **Publicar**.
4. Copie o link gerado (termina em `output=csv`) e cole no `config.js`:

   ```js
   planilhaEstoque: "https://docs.google.com/spreadsheets/d/e/.../pub?output=csv",
   ```

Depois de editar a planilha, o Google pode levar **até uns 5 minutos** para
mostrar a mudança no site. Se a planilha não puder ser lida, o site usa a lista
`PRODUTOS` do `config.js` como reserva.

> O estoque não diminui sozinho quando chega um pedido: ao separar o pedido,
> baixe a quantidade na planilha.

## Como colocar no ar (grátis)

No GitHub: **Settings → Pages → Source: Deploy from a branch → branch `main`, pasta `/ (root)`**.
Em alguns minutos o site fica disponível em `https://<seu-usuario>.github.io/HM-Distribuidora/`.

Para testar no computador, é só abrir o `index.html` no navegador.

## Arquivos

- `index.html`: estrutura da página
- `style.css`: visual
- `app.js`: carrinho, validações e montagem da mensagem do WhatsApp
- `config.js`: dados da loja e estoque (**o único arquivo que você precisa editar**)
- `planilha-modelo.csv`: modelo para importar no Google Planilhas
