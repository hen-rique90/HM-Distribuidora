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

   | produto | tamanho | categoria | preco | estoque |
   |---|---|---|---|---|
   | Brahma lata | 350ml | Cervejas | 4,50 | 120 |
   | Espetinho de carne | | Espetinhos | 8,00 | 40 |

   - **tamanho** é opcional. No site aparece junto do nome ("Brahma lata 350ml").

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

## Baixa automática do estoque a cada pedido

Com isso, quando o cliente envia o pedido, o estoque da planilha diminui
sozinho e o pedido fica registrado numa aba **Pedidos** (com número, cliente,
itens, total, pagamento e endereço).

1. Na sua planilha de estoque: **Extensões → Apps Script**.
2. Apague o que estiver lá, cole todo o conteúdo do arquivo
   `apps-script/Codigo.gs`. Na linha `const SENHA_ADMIN = "troque-esta-senha";`
   coloque **a senha da sua área de estoque** e clique em **Salvar** (💾).
3. Clique em **Implantar → Nova implantação**. Na engrenagem, escolha **App da Web**:
   - **Executar como:** Eu
   - **Quem pode acessar:** Qualquer pessoa
4. Clique em **Implantar** e autorize o acesso com sua conta do Google. Se aparecer
   "O Google não verificou este app", clique em **Avançado → Acessar (não seguro)**.
   O script é seu e só mexe nesta planilha.
5. Copie a **URL do app da Web** (termina em `/exec`) e cole no `config.js`:

   ```js
   scriptPedidos: "https://script.google.com/macros/s/.../exec",
   ```

**Como funciona:**
- Antes de abrir o WhatsApp, o site confere o estoque **real** na planilha. Se
  alguém comprou o último item segundos antes, o cliente recebe um aviso e o
  carrinho é ajustado. Nada é vendido sem estoque.
- A mensagem no WhatsApp chega com o **número do pedido** (ex.: Nº 42), o mesmo da aba Pedidos.
- **Cancelar um pedido** (cliente desistiu, não confirmou no WhatsApp etc.):
  na aba **Pedidos**, clique na linha do pedido e use o menu
  **🍺 Pedidos → Cancelar pedido selecionado**. Os itens voltam para o estoque.
  (Se o menu não aparecer, recarregue a planilha.)
- Se o script estiver fora do ar, o pedido **não é perdido**: vai pelo WhatsApp
  com o aviso "⚠️ Estoque não foi baixado automaticamente", e você baixa na mão.
- Se você **mudar o código** do script, publique de novo em
  **Implantar → Gerenciar implantações → ✏️ → Versão: Nova versão**.
- Não renomeie produtos na planilha enquanto houver pedidos abertos: o
  cancelamento devolve o estoque procurando pelo nome.

## Área de estoque (admin.html)

Página para você alimentar o estoque pelo celular, sem abrir a planilha.
Ela precisa do script acima configurado.

Acesse `https://<seu-site>/admin.html` e entre com a `SENHA_ADMIN` do script.
Salve o link na tela inicial do celular para abrir rápido.

- **➕ Entrada de estoque**: escolha o produto, informe quanto chegou e, se quiser,
  o novo preço. A quantidade é **somada** ao estoque.
- **🆕 Novo produto**: nome, tamanho, categoria, preço e quantidade inicial.
  O produto aparece na loja na hora.
- **Estoque atual**: lista com quantidade de cada produto (laranja = 5 ou menos,
  vermelho = zerado). O botão **+ Entrada** já abre o formulário com o produto escolhido.
- Toda entrada e cadastro fica registrado na aba **Entradas** da planilha
  (data, produto, quantidade, preço).

Com o script configurado, a loja também passa a ler o estoque direto por ele,
**em tempo real** (sem a demora de ~5 minutos da planilha publicada).

> Se você já tinha publicado o script antes, depois de colar o código novo vá em
> **Implantar → Gerenciar implantações → ✏️ → Versão: Nova versão → Implantar**.
> A URL continua a mesma.

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
- `admin.html` / `admin.js`: área de estoque (entrada e cadastro de produtos)
- `apps-script/Codigo.gs`: script que dá baixa no estoque e registra os pedidos
