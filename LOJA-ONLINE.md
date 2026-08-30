# Loja online — The Pet House

Loja pública de pedidos de ração, dentro do mesmo projeto e do mesmo banco do PDV.

- **Cliente:** `https://seu-dominio.vercel.app/loja` — sem login, sem cadastro.
- **Você:** menu **Pedidos online** no PDV.

O catálogo é o seu estoque de verdade: preço por kg, preço do saco fechado, peso do
saco e quantidade disponível saem da tabela `products`. Não existe cadastro paralelo.

---

## 1. Rodar a migração (uma vez só)

No Supabase → **SQL Editor** → **New query** → cole o conteúdo de
`supabase/migrations/001_loja_online.sql` → **Run**.

Ela cria as tabelas `orders` e `order_items`, acrescenta os campos da loja em
`products` e grava as configurações padrão. É idempotente: pode rodar de novo sem
estragar nada, e não altera nenhum dado que já existe.

Enquanto isso não rodar, a tela **Pedidos online** dá erro de tabela inexistente.

## 2. Configurar a loja

PDV → **Configurações** → aba **Loja online**:

| Campo | Para que serve |
|---|---|
| Loja aceitando pedidos | Desligado, o cliente ainda monta o pedido, mas vê o aviso de loja fechada |
| WhatsApp da loja | Botão "Falar no WhatsApp" no fim do pedido. **Sem isso o botão não aparece** |
| Endereço mostrado | Aparece no topo da loja e na opção "retirar" |
| Taxa de entrega | Cobrada quando o pedido fica abaixo do valor de frete grátis |
| Entrega grátis acima de | Padrão R$ 99 |
| Pedido mínimo | Deixe 0 para não exigir mínimo |

## 3. Liberar os produtos

Em **Produtos**, ao cadastrar ou editar, tem um bloco **Loja online**:

- **Aparece no catálogo** — desmarque o que não quer vender pela internet.
- **Espécie / Fase / Porte** — é o que faz os filtros "Cão", "Gato", "Filhote",
  "Castrado", "Raça pequena" funcionarem.
- **Foto (link)** — opcional. Sem foto, entra um desenho de saco nas cores da marca.
- **Vendido fracionado** — desmarque em ração que você só vende em saco fechado.

> **Atenção com os dados de hoje.** A migração preenche espécie/fase a partir do
> campo `tipo` que o PDV já usa, mas boa parte do seu cadastro está com `tipo = cao`
> mesmo em produto de gato (a areia sanitária, por exemplo). Vale revisar os
> campeões de venda antes de divulgar o link — nos outros, o filtro só não vai
> ajudar, mas o produto continua aparecendo em "Todos".

## 3b. Fotos dos produtos

Rode também `supabase/migrations/002_fotos_produtos.sql` (cria o balde de
arquivos), e use o menu **Fotos da loja**.

**Não existe jeito de puxar as fotos automaticamente.** Foi testado:
Open Pet Food Facts (a base aberta de ração) não tem Golden, Premier nem
Quatree — retorna zero; busca de imagem sem chave paga e os sites das
fabricantes bloqueiam acesso automático. E, sem código de barras no cadastro,
casar 88 rações por nome ("gga", "FREDDY", "PITTY 15KG") ia colocar foto
errada em produto certo — pior do que não ter foto.

Então a tela faz o caminho que funciona:

- **Tirar foto** — no celular abre a câmera direto. O navegador encolhe para
  800×800, centraliza e **tira o fundo** sozinho.
- **Colar link** — se você já tem a imagem do fornecedor.
- **Remover** — volta ao desenho de saco nas cores da marca.

O recorte de fundo funciona por preenchimento a partir das bordas: fotografe
o saco **contra parede clara e lisa**. Se o fundo não for uniforme, ele desiste
do recorte e mantém a foto inteira — nunca come pedaço do produto.

Prioridade: filtre por **Sem foto + Só com estoque**. São 21 rações, não 88.

## 4. Como o pedido chega até o caixa

1. Cliente monta e envia. O pedido nasce com status **novo**.
2. Se o WhatsApp dele ainda não estava em **Clientes**, é cadastrado na hora.
3. Aparece em **Pedidos online** (a tela se atualiza sozinha a cada 30s e o menu
   mostra a bolinha vermelha com a quantidade de novos).
4. Você clica em **Confirmar e lançar**, escolhe a forma de pagamento, e aí sim:
   - cria a **venda** no PDV,
   - dá **baixa no estoque** (kg ou unidade, igual a uma venda no balcão),
   - registra a movimentação como `Pedido online #N`,
   - atualiza a última compra do cliente.
5. Depois é só ir empurrando o status: Separando → Pronto → Entregue.

**A taxa de entrega não entra na venda.** A venda registra só os produtos, para o
frete não inflar o seu faturamento. O valor cheio continua no pedido.

Preço e estoque são recalculados no servidor na hora de gravar. Se o cliente
deixar o carrinho aberto e o preço mudar, vale o preço novo; se o estoque acabou,
o pedido é recusado com a mensagem do que faltou.

## 5. Publicar na Vercel

Nada muda no deploy — mesmo projeto, mesmo `vercel.json`:

```bash
git add -A
git commit -m "Loja online de pedidos integrada ao PDV"
git push
```

A Vercel faz o build sozinha. Depois é só divulgar o link `/loja` (Instagram, status
do WhatsApp, adesivo na vitrine com QR Code).

O cliente baixa só a loja (~245 KB), não o sistema de gestão inteiro (~800 KB) —
as duas partes foram separadas em pedaços diferentes de propósito.

## 6. Uma coisa para arrumar quando sobrar tempo

As tabelas de pedido usam a mesma chave pública (`anon`) que o resto do projeto já
usa. Funciona, e é a mesma postura das outras tabelas — mas quem tiver essa chave
consegue ler os pedidos.

Para fechar: crie `SUPABASE_SERVICE_ROLE_KEY` nas variáveis de ambiente da Vercel,
faça `api/index.js` usar essa chave, e troque as policies do fim da migração para
deixar o `anon` apenas com INSERT. Aí só o servidor lê pedidos.

---

## Arquivos

| Arquivo | O que é |
|---|---|
| `supabase/migrations/001_loja_online.sql` | Migração do banco |
| `supabase/migrations/002_fotos_produtos.sql` | Balde de arquivos das fotos |
| `src/pages/Photos.jsx` | Tela "Fotos da loja" (câmera, recorte de fundo, envio) |
| `src/loja/Loja.jsx` | A loja inteira (catálogo, produto, carrinho, checkout) |
| `src/loja/loja.css` | Visual da loja |
| `src/pages/Orders.jsx` | Tela de pedidos no PDV |
| `api/index.js` | Rotas `/api/shop/*`, `/api/orders/*` e `/api/settings` |
| `src/App.jsx` | Decide entre loja pública e PDV, e separa os bundles |
| `src/Pdv.jsx` | O que antes era o `App.jsx` (login + layout + rotas do PDV) |
