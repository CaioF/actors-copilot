# 05 — Integração Stripe × Skool: The Actors Copilot Green Room

> Documento de alinhamento comercial e técnico para a integração entre **Stripe**, o app **The Actors Copilot** e a comunidade **The Actors Copilot Green Room** no **Skool**.
>
> Regra de ouro: **Skool não tem níveis diferentes de acesso por plano.** Os planos de US$19 e US$29 incluem, sem custo adicional, a mesma comunidade que custa US$9 quando adquirida isoladamente.
>
> **Código reatualizado:** `git pull --ff-only origin main` concluído em `1c055f8` (PRs #72 a #78). As mudanças recebidas são mobile UX e troca de modelos Gemini; **nenhuma altera Stripe, Skool, billing ou webhooks**.

---

## 1. Estrutura comercial confirmada

| Produto comercial | Preço mensal | Skool: The Actors Copilot Green Room | App The Actors Copilot | Papel no domínio do app |
|---|---:|---|---|---|
| **Green Room Only** | **US$9** | ✅ acesso à mesma comunidade | ❌ sem acesso ao app | Novo: o código atual não representa este produto |
| **Economy Class** | **US$19** | ✅ acesso à mesma comunidade, incluído | ✅ Economy Class | `economy` |
| **Business Class** | **US$29** | ✅ acesso à mesma comunidade, incluído | ✅ Business Class | `business` |

### Invariantes de negócio

1. **Existe uma única comunidade Skool:** `The Actors Copilot Green Room`.
2. Um membro de US$9, US$19 ou US$29 recebe **o mesmo nível de acesso no Skool**.
3. US$19 e US$29 **não são upgrades dentro do Skool**; são planos que incluem Green Room + acesso ao app.
4. O único critério para permissões no app é o entitlement do app:
   - Green Room Only → nenhum tier pago do app;
   - Economy → `economy`;
   - Business → `business`.
5. A associação ao Skool deve ser concedida tanto para:
   - checkout feito no site/app;
   - assinatura/upgrades iniciados pelo Skool.
6. A inclusão no Skool é **sem cobrança adicional** para Economy e Business. Não deve haver uma segunda subscription/cobrança de US$9 para essas pessoas.

---

## 2. Estado atual do repositório

### 2.1 O que já existe no Stripe/app

O código atual implementa **somente Economy e Business**:

```ts
export type SubscriptionTier = 'free' | 'economy' | 'business'
```

Fonte: `lib/billing.ts:7`.

| Tier do app | Price ID mensal | Price ID anual | Onde é resolvido |
|---|---|---|---|
| `economy` | `STRIPE_ECONOMY_PRICE_ID` | `STRIPE_ECONOMY_ANNUAL_PRICE_ID` | `lib/billing.ts:72-81` |
| `business` | `STRIPE_BUSINESS_PRICE_ID` | `STRIPE_BUSINESS_ANNUAL_PRICE_ID` | `lib/billing.ts:82-89` |

A página `/upgrade` mostra:

| Plano | Mensal | Anual | Fonte |
|---|---:|---:|---|
| Economy Class | US$19 | US$15/mês | `app/(interior)/upgrade/page.tsx:207-220` |
| Business Class | US$29 | US$23/mês | `app/(interior)/upgrade/page.tsx:223-238` |

O checkout grava metadata suficiente para decidir o tier do app:

```ts
metadata: {
  platformUserId: uid,
  firebaseUid: uid,
  targetTier: selectedTier,       // economy | business
  billingCycle: selectedBillingCycle,
  isTrial: isTrial ? 'true' : 'false',
}
```

Fonte: `app/api/billing/checkout/route.ts:144-150`.

O webhook Stripe trata:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Fonte: `app/api/webhooks/stripe/route.ts:179-315`.

Ele sincroniza o entitlement do app em `users/{uid}/billing/current` e `users/{uid}`.

### 2.2 Inventário real da conta Stripe

Consulta executada na conta Stripe **The Actors Copilot**. Resultado após a criação do Green Room completo: **3 Products ativos** e **10 Prices recorrentes ativos**.

**The Actors Copilot Green Room** (`prod_VQvghFBGjOICOX`) — 6 preços, 3 moedas × 2 ciclos (**valores corrigidos em 15/10/2026**):

| Ciclo | Moeda | Valor | Price ID | Apelido (nickname) |
|---|---|---:|---|---|
| Mensal | USD | US$ 9,00 | `price_1UQ9tLEnOTJRuCTXYblFkB0R` | Green Room - Monthly - USD 9 |
| Anual | USD | US$ 90,00 | `price_1UQCEyEnOTJRuCTX44nKC5G8` | Green Room - Annual - USD 90 |
| Mensal | GBP | **£7,00** | `price_1UQsxMEnOTJRuCTXt6ub7m9h` | Green Room - Monthly - GBP 7 |
| Anual | GBP | **£70,00** | `price_1UQsxTEnOTJRuCTXoD11VS1a` | Green Room - Annual - GBP 70 |
| Mensal | EUR | **€8,00** | `price_1UQsxZEnOTJRuCTXnTW0Q09z` | Green Room - Monthly - EUR 8 |
| Anual | EUR | **€80,00** | `price_1UQsxcEnOTJRuCTX8Z4HOFBd` | Green Room - Annual - EUR 80 |

**Convenção do valor anual:** `anual = 10 × mensal` (2 meses grátis ≈ **16,7%** de desconto). Atenção: o rótulo da UI do app dizia "-20%", o que está errado — ver doc 08 §2.4.

**Histórico da correção (15/10/2026):** os preços GBP e EUR foram criados com o valor do dólar repetido (`£9/£90`, `€9/€90`) em vez dos valores locais aprovados pela Tracey (`£7/£70`, `€8/€80`). Como o `unit_amount` de um Price é imutável, os quatro foram **recriados** e os antigos **desativados** (`active: false`), junto com os respectivos Payment Links:

| Ciclo | Moeda | Valor antigo | Price ID (inativo) | Payment Link (inativo) |
|---|---|---:|---|---|
| Mensal | GBP | £9,00 | `price_1UQBj0EnOTJRuCTXkTIePIfS` | `plink_1UQBj6EnOTJRuCTXohl1r4t2` |
| Anual | GBP | £90,00 | `price_1UQCF0EnOTJRuCTXI4SRYNyo` | `plink_1UQCFxEnOTJRuCTXK1vej4fu` |
| Mensal | EUR | €9,00 | `price_1UQ4X6EnOTJRuCTXoH6zHvtI` | `plink_1UQ9PkEnOTJRuCTXfyacvjPy` |
| Anual | EUR | €90,00 | `price_1UQCF3EnOTJRuCTXHvewkOlR` | `plink_1UQCFzEnOTJRuCTXENKvv7gI` |

Nada foi apagado: a reativação é uma flag `active: true`. Os links inativos exibem "This link has been replaced…" com o endereço do novo. Os preços e links **USD não foram tocados**. As assinaturas já existentes nesses preços continuam válidas (o Stripe mantém o preço contratado).

**Produtos existentes** (multi-moeda aplicado em 15/10/2026 — ver nota abaixo):

| Product | Product ID | Price ID | EUR (base) | GBP | USD | Cobrança |
|---|---|---|---:|---:|---:|---|
| Economy Class | `prod_Uu0uIaw9yLDSke` | `price_1TuCshEnOTJRuCTXl1SD2vMr` | €19,00 | £14,00 | $19,00 | mensal |
| Economy Class | `prod_Uu0uIaw9yLDSke` | `price_1TwOUREnOTJRuCTXdUqc9fyK` | €190,00 | £140,00 | $190,00 | anual |
| Business Class | `prod_Uu0uuFpzXE5YiE` | `price_1TuCsvEnOTJRuCTXbaAzTSbO` | €29,00 | £22,00 | $29,00 | mensal |
| Business Class | `prod_Uu0uuFpzXE5YiE` | `price_1TwO6vEnOTJRuCTXl4ilzwrn` | €290,00 | £220,00 | $290,00 | anual |

**Multi-moeda (15/10/2026).** Os quatro Prices ganharam `currency_options` com GBP e USD sobre a mesma Price (a moeda base continua **EUR**). Efeito: **os Price IDs não mudam**, logo não há alteração de env vars, código ou deploy — o `/api/billing/checkout` continua usando exatamente os mesmos IDs. Verificado com `expand[]=currency_options`.

> ✅ **Decisão registrada:** o modelo de moeda do sistema é **`currency_options` (um Price por plano/ciclo com várias moedas)**, e não um Price por moeda. É o mesmo modelo do PR #79 e o único que não exige mudança de código no checkout.

> 🟡 **Desvio consciente da tabela do board paper.** O paper propõe €17/€170 (Economy) e €26/€260 (Business). Optámos por **manter o EUR atual** (€19/€190 e €29/€290) e acrescentar apenas GBP e USD, para não reduzir o preço europeu que já está no ar sem confirmação explícita da Tracey. Se ela confirmar os valores do paper, é preciso **recriar** os quatro Prices (o `unit_amount` da moeda base é imutável) e voltar a apontar as env vars — trabalho maior, já que muda os IDs.
>
> Consequência a alinhar com ela: o USD fica com o mesmo número do EUR ($19/€19), o que é intencional na tabela aprovada, mas o GBP (£14/£22) é proporcionalmente mais barato.

> 🔴 **PENDENTE (ação manual no Dashboard) — link que assina Economy *e* Business juntos.**
> `plink_1UFJuNEnOTJRuCTXYZRUn4yl` → <https://buy.stripe.com/3cI14n6DSaIO7fWgUWaZi01>
> Tem **dois line items** (Economy €19/mês **+** Business €29/mês = **€48/mês**) com trial de 14 dias. Payment Link não oferece "escolha um plano", portanto quem entrar por ele assina os dois.
> **Não foi possível desativar pela conexão do Zapier:** o link tem Managed Payments ativo e a conexão envia header `Stripe-Account`, que o Stripe rejeita nesse caso (`Managed Payments cannot be used with Connect`). As tentativas via request bruto e via ação nativa devolveram o mesmo erro.
> Desativar em: <https://dashboard.stripe.com/payment_links/plink_1UFJuNEnOTJRuCTXYZRUn4yl>
> (O irmão dele, `plink_1UEBm5EnOTJRuCTXqRLXnvSl`, Business-only, já está inativo.)

**Descrição do Product (inglês, exibida ao comprador no Checkout):**

> Membership for The Actors Copilot Green Room on Skool. Community access only - no Economy or Business Class access in the app. Cancel anytime.

**Imagem do Product:** `https://www.theactorscopilot.com/logo.png` — aplicada em `images[0]`, a mesma em todos os links (mesma arte de `public/logo.png` do repositório, confirmada servindo `image/png` 200).

**Links diretos no Stripe Dashboard:**

- Product Green Room: <https://dashboard.stripe.com/products/prod_VQvghFBGjOICOX>
- Lista de preços do Product: <https://dashboard.stripe.com/prices?product=prod_VQvghFBGjOICOX>
- Lista de Payment Links: <https://dashboard.stripe.com/payment-links>
- Lista de produtos: <https://dashboard.stripe.com/products>

### 2.2.1 Os 6 links de venda (Caminho A — escolhido)

Todos criados em **modo LIVE** e verificados individualmente (**HTTP 200**, abrem o Stripe Checkout).

| Ciclo | Moeda | Valor | Link de pagamento | Payment Link ID |
|---|---|---:|---|---|
| **Mensal** | 🇺🇸 USD | US$ 9,00 | <https://buy.stripe.com/eVqbJ1fao4kq9o4awyaZi03> | `plink_1UQ9tVEnOTJRuCTXDmWZVBvW` |
| **Anual** | 🇺🇸 USD | US$ 90,00 | <https://buy.stripe.com/7sYcN56DS04a9o4bACaZi05> | `plink_1UQCFrEnOTJRuCTX1L9cN0pJ` |
| **Mensal** | 🇬🇧 GBP | **£7,00** | <https://buy.stripe.com/5kQ7sL2nCeZ47fWawyaZi08> | `plink_1UQsxrEnOTJRuCTXaEcLFVO0` |
| **Anual** | 🇬🇧 GBP | **£70,00** | <https://buy.stripe.com/4gM9ATaU8cQW43K6giaZi09> | `plink_1UQsxxEnOTJRuCTXws80RJlv` |
| **Mensal** | 🇪🇺 EUR | **€8,00** | <https://buy.stripe.com/7sYcN59Q45ougQwdIKaZi0a> | `plink_1UQsy2EnOTJRuCTXoEPYxTP2` |
| **Anual** | 🇪🇺 EUR | **€80,00** | <https://buy.stripe.com/14AaEXd2g4kq57O8oqaZi0b> | `plink_1UQsy6EnOTJRuCTXwcUAYVPj` |

> ⚠️ **Os quatro links GBP/EUR acima são novos (15/10/2026).** Os antigos, com £9/£90 e €9/€90, foram **desativados**. Se a Tracey já tiver divulgado algum deles, é preciso avisá-la para trocar o endereço — o link antigo abre com a mensagem de substituição e o novo endereço.

**Comum a todos:** cupons promocionais habilitados (`allow_promotion_codes: true`), `payment_method_collection: always`, `invoice_creation: false` (obrigatório em preço recorrente), metadata `product_role: green_room_only`, `app_access: none`, `community: the_actors_copilot_green_room`. Os links também carregam `currency_market` e `billing_cycle`.

**Observação sobre a moeda EUR:** os três preços em EUR continuam ativos e agora **têm** link. Mantenha todos ou desative os que não forem usados comercialmente — os links EUR só devem ser divulgados se a venda em euro for intencional.

### 2.2.2 O valor muda se o cliente trocar de moeda? **Não.**

Pergunta feita pela Tracey. Resposta verificada ao vivo em 15/10/2026:

**Cada link tem um valor fixo e não oferece escolha de moeda.** Isso não é configuração nossa — é consequência do modelo de Price:

- cada Price do Green Room tem **uma única moeda** (`expand[]=currency_options` devolve só a própria moeda, ex.: `{"gbp":{"unit_amount":700}}` para o link de £7);
- o Payment Link aponta para **um** Price e carrega `currency` fixo (`gbp`, `eur` ou `usd`).

Logo: **o link GBP cobra sempre £7; o link EUR, sempre €8.** Não há seletor, não há conversão, não há surpresa. É justamente por isso que mantivemos **6 links separados** em vez de um link único multi-moeda — assim a Tracey controla exatamente o que cada mercado paga.

**Onde o valor muda de verdade — e é intencional:** nos planos do **app** (Economy/Business), onde acabámos de adicionar `currency_options`. Aí o mesmo Price serve três moedas e o valor apresentado depende da moeda escolhida/localizada: Economy = **$19 / £14 / €19**; Business = **$29 / £22 / €29**. São valores fixos aprovados por moeda, não conversão por câmbio.

**Adaptive Pricing — o único mecanismo que poderia alterar um valor fixo.** O Stripe tem uma funcionalidade de conta ("Adaptive Pricing") que converte automaticamente o preço para a moeda local do visitante, aplicando câmbio + taxa de conversão. Se estiver ligada, um visitante dos EUA a abrir o link de £7 poderia ver um valor convertido em USD.
- Não é possível ler nem alterar isso pela conexão usada aqui: a API devolve `Received unknown parameter: adaptive_pricing`.
- **Verificar no Dashboard:** Settings → Payments → Adaptive Pricing (ou Currency conversion).
- Recomendação: para os 6 links do Green Room, manter **desligado** — os valores por moeda que a Tracey aprovou só fazem sentido se forem exatamente aqueles.

### 2.2.3 Um link único multi-moeda (alternativa)

Se houver interesse em **um só URL** para todos os mercados, é possível: colocar `currency_options` num Price único e criar um Payment Link multi-moeda. O Stripe passa a apresentar a moeda conforme a localização do visitante (e o cliente pode alternar).

| | 6 links fixos (atual) | 1 link multi-moeda |
|---|---|---|
| Valor por mercado | **Garantido** (definido por nós) | Sugerido pelo Stripe conforme a localização |
| URLs a divulgar | 6 | 1 |
| Risco | Enviar o link do mercado errado | Cliente pode alternar e pagar em moeda diferente da planeada |

Recomendação: **manter os 6 links** para o Green Room.

**Detalhamento de um link (modelo — todos os 6 seguem o mesmo formato):**

| Propriedade | Valor |
|---|---|
| ID | `plink_1UQ9tVEnOTJRuCTXDmWZVBvW` (USD mensal) |
| Produto / preço | The Actors Copilot Green Room · **US$ 9,00/mês** |
| Price ID | `price_1UQ9tLEnOTJRuCTXYblFkB0R` |
| Moeda | **USD** (`currency: "usd"`) |
| Modo | **LIVE** (`livemode: true`) |
| Cupons promocionais | ✅ habilitado (`allow_promotion_codes: true`) |
| Cobrança de método de pagamento | `always` |
| Metadata | `product_role: green_room_only`, `app_access: none`, `community: the_actors_copilot_green_room` |

**Consequências de usar o Payment Link (importante):**

- ✅ Não exige deploy; pode ser divulgado imediatamente.
- ✅ Gera um `checkout.session.completed` real e **dispara o Zap** do Skool.
- ❌ **Não carrega `platformUserId`/`firebaseUid`** — o Payment Link não sabe quem é o usuário no app.
- ❌ O webhook do app (`/api/webhooks/stripe`) vai receber o evento, **não vai resolver o usuário** e apenas registrará um aviso no log. É inofensivo, mas gera ruído.
- ❌ Se a mesma pessoa depois comprar Economy/Business pelo app, o Stripe pode criar **dois customers** para ela (um do link, outro do checkout do app).
- ⚠️ Como não passa pelo `/api/billing/checkout`, o registro `community` **não** é gravado no Firestore por esse caminho.

> Para o caminho com vínculo no app (metadata + Firestore + reuso de customer), é necessário o **Caminho B**: `STRIPE_GREEN_ROOM_PRICE_ID` no deploy + card na página `/upgrade` (o backend já está pronto).

> ⚠️ Esses objetos foram criados em **modo LIVE** (`livemode: true`). A conexão Stripe do Zapier não oferece alternância para Test Mode; o parâmetro `test_mode_data` apenas controla o dado de amostra do passo de teste, **não** o ambiente da API. Para criar o equivalente em **Test Mode**, use o Stripe Dashboard com a chave de test ligada — os links em test mode têm o prefixo `/test`, por exemplo `https://dashboard.stripe.com/test/products`.

**Conclusões da conta Stripe atual:**

- ✅ Products e Prices ativos para Green Room, Economy e Business.
- ✅ O Product do Green Room foi criado com metadata `app_access: none` e `product_role: green_room_only`.
- ⚠️ A UI do app usa `$19/$15/$29/$23` (`upgrade/page.tsx`), mas a conta Stripe atual contém **€19/€190/€29/€290**. Além de moeda divergente, os valores anuais efetivos são €15,83/mês e €24,17/mês, não os valores exibidos pela UI.
- ⚠️ Os dois Products Stripe carregam a mesma descrição, que menciona inclusive Actor Profile e DNA, mesmo para Economy. É preciso alinhar a copy do Stripe com a matriz real de recursos.
- ⚠️ Ainda falta confirmar no deploy se as env vars `STRIPE_ECONOMY_*` e `STRIPE_BUSINESS_*` apontam exatamente para esses IDs.

### 2.3 O que **não** existe

| Gap | Evidência / impacto |
|---|---|
| ~~Produto/Price ID para Green Room Only~~ | ✅ **Resolvido**: criados USD, GBP e EUR no Product `prod_VQvghFBGjOICOX` (seção 2.2) |
| ~~Tier de domínio para membro só do Skool~~ | ✅ **Resolvido**: `CommunityEntitlement` + `appTier` separados em `lib/billing.ts` |
| Convite para Skool a partir de uma assinatura Stripe | Não há import/chamada Skool em `app/api/webhooks/stripe/route.ts` nem em qualquer outro handler. O convite é feito pelo Zap. |
| Registro de membership Skool no Firestore | Não há `skoolMemberId`, `skoolInviteStatus`, `skoolInviteSentAt` etc. |
| Reconciliação de assinaturas iniciadas no Skool | O app ainda tem vestígios de Kajabi, mas não há webhook/integração Skool. |
| Revogação/cancelamento da associação Skool | A ação Skool disponível é `Invite Member`; não há ação de remover membro exposta no MCP atual. Isso precisa ser definido como política/integração. |
| **Filtro do Zap bloqueia assinaturas em trial** | 🔴 Ver seção 5.4 — hoje o filtro exige status `active`, mas Economy/Business começam em `trialing` por 14 dias. |

> O link da comunidade já aparece na sidebar (`components/app-sidebar.tsx:180-188`), mas é só um link externo; não concede ou controla membership.

---

## 3. Conectores MCP disponíveis nesta sessão

### Skool

A conexão Skool já está autenticada e expõe estas capacidades:

| Ação | Tipo | Uso no fluxo |
|---|---|---|
| **Invite Member** | Escrita | Convidar um assinante elegível ao Green Room. A action pede **somente `email`**; o grupo vem da conexão Skool configurada no Zapier. |
| **Unlock Course for Member** | Escrita | Opcional: liberar curso específico; **não usar** para diferenciar os planos sem uma regra comercial explícita |
| **New Paid Member** | Leitura/trigger | Detectar pagamento direto pelo Skool. O payload declarado contém apenas `email`, `first_name`, `last_name`, `created_at`, `id` — **não traz offer/price/tier**. |
| **Answered Membership Questions** | Leitura/trigger | Capturar dados submetidos no onboarding do Skool |

### Stripe

O conector Stripe foi habilitado e está autenticado para a conta **The Actors Copilot**.

- Há ações para consultar customer, subscription, invoice, payment e balance; criar checkout/customer/price/product/subscription; cancelar assinatura; e fazer requisições brutas autenticadas.
- Ações disponíveis no conector atual **não incluem** um read action pronto para enumerar Products/Prices.
- A tentativa de `GET /v1/products` por API Request é bloqueada pelo Zapier porque esse endpoint genérico foi classificado como ação de escrita, embora o método seja GET.

### Como identificar os Products/Prices reais no Stripe

Há três alternativas seguras:

1. **Stripe Dashboard**: enviar os IDs de Price/Product (por exemplo `price_...` / `prod_...`); podemos cruzá-los imediatamente com os env vars e o código.
2. **Criar uma read-only custom action no Zapier**: listar `/v1/products` e `/v1/prices` com paginação, sem permitir alterações.
3. **Expor os IDs no ambiente/deploy** (não os segredos): confirmar os valores de `STRIPE_ECONOMY_PRICE_ID`, `STRIPE_BUSINESS_PRICE_ID`, seus anuais e o futuro `STRIPE_GREEN_ROOM_PRICE_ID`.

> Nunca coloque `STRIPE_SECRET_KEY` no código, em docs ou em mensagens. O MCP/Zapier usa a conexão autenticada; o app usa a variável somente no servidor.

---

## 4. Arquitetura recomendada

### 4.1 Fonte de verdade

| Responsabilidade | Fonte de verdade |
|---|---|
| Cobrança, preço, status de pagamento | Stripe ou Skool, conforme a origem da venda |
| Entitlement do app | Firestore `users/{uid}/billing/current` |
| Membership do Green Room | Skool |
| Log/idempotência da sincronização | Firestore (novo documento de integração) |

### 4.2 Modelo de entitlement recomendado

Não use o tier do app para representar o acesso ao Skool. Modele as duas permissões separadamente:

```ts
type AppTier = 'none' | 'economy' | 'business'
type CommunityEntitlement = 'none' | 'green_room'
type PurchaseSource = 'stripe' | 'skool'

type MembershipStatus =
  | 'not_required'
  | 'pending_invite'
  | 'invited'
  | 'active'
  | 'revoked'
  | 'failed'
```

Exemplo de documento:

```ts
// users/{uid}/entitlements/current
{
  appTier: 'economy',             // none | economy | business
  community: 'green_room',
  communityStatus: 'pending_invite',
  purchaseSource: 'stripe',
  sourceSubscriptionId: 'sub_...',
  sourceCustomerId: 'cus_...',
  sourcePriceId: 'price_...',
  email: 'actor@example.com',
  updatedAt: Timestamp,
}

// users/{uid}/integrations/skool
{
  group: 'The Actors Copilot Green Room',
  status: 'invited',
  inviteSentAt: Timestamp,
  memberId: '...',                 // se a API o devolver
  lastSourceEventId: 'evt_...',
  lastError: null,
}
```

> O documento de billing atual pode continuar existindo para compatibilidade; a migração pode introduzir `appTier` e `community` gradualmente.

### 4.3 Matriz Price → entitlement

Defina o mapeamento explicitamente. Não infira acesso pela quantia cobrada.

| Stripe Price | Origem | `appTier` | `community` | Ação Skool |
|---|---|---|---|---|
| `STRIPE_GREEN_ROOM_PRICE_ID` (novo, US$9) | Stripe/site | `none` | `green_room` | convidar |
| `STRIPE_ECONOMY_PRICE_ID` | Stripe/site | `economy` | `green_room` | convidar |
| `STRIPE_BUSINESS_PRICE_ID` | Stripe/site | `business` | `green_room` | convidar |
| Price anual Economy | Stripe/site | `economy` | `green_room` | convidar |
| Price anual Business | Stripe/site | `business` | `green_room` | convidar |
| Produto direto do Skool | Skool | `none` por padrão | `green_room` | já é membro; não convidar |
| Upgrade originado no Skool para Economy/Business | Skool → Stripe/app | `economy`/`business` | `green_room` | não duplicar convite |

### 4.4 Fluxo A — compra Economy/Business no site

```text
Usuário autenticado
  → Checkout Stripe (metadata: uid, price/tier, source=website)
  → Stripe webhook validado
  → sincroniza billing/app entitlement no Firestore
  → determina community=green_room
  → cria tarefa idempotente “invite-to-skool”
  → Skool: Invite Member(email)
  → grava status invited/active no Firestore
  → e-mail de convite sai pelo Skool
```

**Evento para convite:** prefira `checkout.session.completed` ou `customer.subscription.created` apenas quando o status for `active` ou `trialing` e houver e-mail válido. Não envie pelo `invoice.payment_succeeded` sozinho: esse evento se repete a cada renovação.

### 4.5 Fluxo B — compra Green Room Only no site

```text
Checkout Stripe com price de US$9
  → webhook Stripe
  → appTier=none; community=green_room
  → Invite Member no Skool
  → não emitir entitlement Economy/Business
```

Esse plano não deve cair em `/upgrade` ou receber recursos do app. Se a mesma pessoa criar uma conta no app, ela fica com `appTier: none` até comprar Economy ou Business.

### 4.6 Fluxo C — pessoa compra diretamente no Skool

```text
Skool: New Paid Member
  → localizar/criar identidade pelo e-mail
  → community=green_room, purchaseSource=skool
  → appTier=none
  → opcional: enviar e-mail para criar conta no app
```

Atenção: o gatilho Skool só indica que entrou como membro pago. Para saber se se trata de US$9, Economy ou Business vendido/upgraded pelo Skool, precisa haver um **identificador confiável**: offer/price ID, tag, campo de membership question, metadata ou webhook payload documentado. Sem isso, trate como `appTier: none` para não conceder app por engano.

### 4.7 Fluxo D — upgrade via Skool

```text
Skool sinaliza upgrade / produto contratado
  → resolve o e-mail para uid
  → valida qual oferta/price representa Economy ou Business
  → atualiza appTier no Firestore
  → mantém community=green_room
  → não reenviar convite se status já for invited/active
```

**Ponto de decisão obrigatório:** precisamos saber como o Skool sinaliza esse upgrade. O MCP atual mostra `New Paid Member`, mas não uma ação de "membership updated". Pode exigir webhook/API nativa do Skool, um Zap disparado por pagamento/offer específica ou uma rotina de reconciliação.

---

## 5. Idempotência e regras operacionais

### 5.1 Não convide duas vezes

Antes de chamar `Invite Member`, use uma transação/bloqueio em Firestore:

```ts
if (skool.status === 'active' || skool.status === 'invited') return
if (skool.lastSourceEventId === stripeEvent.id) return

// marca pending_invite antes da chamada externa
// depois grava invited ou failed
```

O webhook Stripe atual **não possui idempotência por `event.id`**. Isso precisa ser corrigido antes de adicionar um efeito externo como envio de convite, ou reentregas da Stripe poderão disparar e-mails duplicados.

### 5.2 Nunca use o preço para dar acesso por "faixa"

Faça lookup por **Price ID exato**. Um cupom, ajuste de preço ou mudança de moeda não deve alterar privilégios. O webhook já tem um ponto natural para isso: `mapStripePriceToTier()` em `lib/billing.ts:104-119`; ele deve evoluir para mapear também `community` e `appTier`.

### 5.3 Cuidado com cancelamento e inadimplência

A regra comercial precisa ser decidida antes de implementar remoção/revogação:

| Situação | Pergunta de negócio a fechar |
|---|---|
| `cancel_at_period_end=true` | Permanece no Green Room até o fim do período? (recomendado: sim) |
| `customer.subscription.deleted` | Remover/revogar o Green Room imediatamente ou no fim do período? |
| `invoice.payment_failed` / `past_due` | Há período de carência no Skool? |
| Downgrade Business → Economy | Green Room permanece; muda apenas `appTier` |
| Downgrade Economy → Green Room Only | Green Room permanece; `appTier` vai para `none` |
| Cancelamento de Green Room Only | Como remover ou impedir renovação da membership no Skool? |

O MCP atual expõe convite e desbloqueio de curso, **não remoção de membro**. Antes de prometer revogação automática, confirme a API/webhook do Skool ou a possibilidade de desativação via Zapier/custom action.

### 5.4 🔴 Filtro do Zap: `active` bloqueia quem está em trial

**Sintoma observado no teste:**

```text
Run details
This filter successfully stopped your run.
Filter will succeed if all rules in a group match
Only continue if…
1. active
```

**Causa:** o filtro exige que o status da assinatura seja **`active`**. Mas as assinaturas de **Economy e Business começam em trial de 14 dias**, e nesse período o status no Stripe é **`trialing`**, não `active`.

Fonte: `app/api/billing/checkout/route.ts` → `...(isTrial ? { trial_period_days: 14 } : {})`.

**Consequência real:** um cliente que compra Economy ou Business pelo app fica **14 dias sem receber o convite do Green Room** — e o filtro descarta o evento silenciosamente. Só no 15º dia, quando vira `active`, o Zap deixaria passar (se o evento de atualização disparar o trigger).

**Correção recomendada:**

1. Aceitar **`active` OU `trialing`** no filtro (usar grupo com lógica "OR").
2. Preferencialmente, **não filtrar por status no primeiro passo**. Filtrar pelo **Price ID** (um dos 3 do Green Room + Economy mês/ano + Business mês/ano) e tratar o status depois.
3. Nunca convidar em `past_due`, `unpaid`, `incomplete` ou `canceled`.

**Observação sobre o Green Room Only:** esse plano **não tem trial** (o checkout community-only não aplica `trial_period_days`), então a assinatura já nasce `active` e passa no filtro atual. O problema afeta **Economy e Business**.

**Dica de teste:** use um e-mail que **ainda não seja membro** do grupo no Skool. Se a pessoa já for membro ativo, o passo de convite não terá efeito e o teste parecerá falhar mesmo com o filtro correto.

---

## 6. Alterações de código

### 6.0 Já implementado neste repositório

As alterações abaixo foram aplicadas, com `pnpm typecheck` limpo e **690 testes passando** (64 suites).

| Arquivo | Mudança |
|---|---|
| `env.example` | Nova variável `STRIPE_GREEN_ROOM_PRICE_ID` |
| `lib/billing.ts` | Novo tipo `CommunityEntitlement`; campo `community` em `UserBilling`; `getStripeGreenRoomPriceId()`; `mapStripePriceToCommunity()`; `resolveEntitlementsFromPrice()`; `mapStripePriceToTier()` devolve `free` para o Price do Green Room |
| `app/api/billing/checkout/route.ts` | Aceita `product: 'green_room'`; usa o Price do Green Room; **não** aplica trial de 14 dias; **não** grava `targetTier`; grava `product` em metadata |
| `app/api/webhooks/stripe/route.ts` | Resolve e persiste `community` em `users/{uid}/billing/current` e em `users/{uid}`, sem sobrescrever o campo em eventos parciais |
| `lib/billing.test.ts` | **Novo**: 13 testes travando a regra “Green Room nunca concede tier do app” |
| `app/api/billing/checkout/route.test.ts` | Asserções de metadata atualizadas + novo teste de checkout community-only |
| `app/api/webhooks/stripe/route.test.ts` | Mock atualizado com `mapStripePriceToCommunity` |

> **Importante:** o código **não** envia convite ao Skool. Isso continua sendo responsabilidade do Zapier na primeira fase.

### Fase 1 — modelar os produtos (referência)

1. Adicionar env vars para o produto de comunidade:

```env
STRIPE_GREEN_ROOM_PRICE_ID=""
# se houver anual:
STRIPE_GREEN_ROOM_ANNUAL_PRICE_ID=""
SKOOL_GREEN_ROOM_GROUP_ID=""
```

2. Separar **app access** de **community access** em `lib/billing.ts`; não adicionar `green_room` como um tier que acidentalmente destrava o app.

3. Atualizar o Stripe checkout para aceitar `product: 'green_room' | 'economy' | 'business'` e converter explicitamente para:

```ts
{ appTier: 'none' | 'economy' | 'business', community: boolean }
```

4. Atualizar a página comercial: se o site vender os três, exibir também Green Room Only com copy clara: "Community access only — no app access".

### Fase 2 — convite idempotente ao Skool

1. Criar um serviço server-side, por exemplo `lib/skool/server.ts` ou um worker/webhook Zapier, **sem colocar credenciais Skool no cliente**.
2. No webhook Stripe, após validar e persistir a assinatura, enfileirar a sincronização Skool.
3. Persistir `skool.status`, `sourceEventId`, tentativas e erros no Firestore.
4. Tratar reentregas Stripe e retries sem reenviar convite.

### Fase 3 — reconciliação Skool → app

1. Configurar o gatilho `New Paid Member` do Skool.
2. Mapear o produto/offer pago a `appTier` e `community`.
3. Resolver identidade por e-mail com confirmação/normalização.
4. Criar ou atualizar entitlement sem duplicar membership.
5. Implementar uma rotina de reconciliação manual/diária para eventos perdidos.

---

## 7. Correções obrigatórias no billing atual antes de ativar o efeito Skool

| Prioridade | Problema atual | Risco para a integração |
|---|---|---|
| P0 | Webhook Stripe sem idempotência | Convites Skool duplicados em retries/reentregas |
| P0 | `invoice.payment_*` pode sobrescrever tier com `null` | Pode remover o entitlement do app de um membro elegível |
| P0 | `cancel_url` aponta para `/api/billing/cancelled`, rota inexistente | UX de checkout quebrada |
| P0 | `/api/billing/success` pode emitir sessão por `session_id` sem validar posse | Risco de fixação de sessão |
| P0 | API do app sem enforcement server-side de tier | Green Room-only pode chamar APIs pagas diretamente |
| P1 | Trial automático para qualquer primeiro checkout | Pode dar 14 dias de app a uma compra Green Room-only, se reutilizar a lógica atual |
| P1 | `SubscriptionTier` mistura plano de cobrança e acesso a features | Dificulta modelar o US$9 corretamente |
| P1 | Não há status/ID de Skool no Firestore | Impossível auditar, reprocessar ou impedir convite duplicado |

---

## 8. Dados que faltam para fechar a implementação

1. IDs reais dos Products/Prices Stripe para:
   - Green Room Only (US$9);
   - Economy (US$19; e anual se existir);
   - Business (US$29; e anual se existir).
2. Confirmação: o checkout de US$9 será no **Stripe**, exclusivamente no **Skool**, ou em ambos?
3. Como o Skool identifica a oferta/plano comprado e um upgrade? (offer ID, preço, tag, webhook payload, membership question etc.)
4. Qual e-mail deve receber o convite: e-mail Stripe (`customer_details.email`) ou e-mail autenticado do Firebase? Regra recomendada: exigir que sejam iguais, ou registrar divergência para revisão.
5. Política de cancelamento/inadimplência no Skool (revogação imediata, fim do ciclo, período de carência).
6. Existe mais de uma comunidade/grupo Skool, curso ou permissão? Se a resposta for não, **não usar `Unlock Course for Member`** na primeira versão.

---

## 9. Decisão recomendada para o primeiro rollout

### Recomendação direta

**Sim: crie o produto Green Room Only de €/$9 no Stripe e use Zapier para enviar o convite ao Skool.**

Para a primeira versão, **não** recomendo integrar o app diretamente à API não documentada do Skool. O projeto não contém SDK, credenciais, webhook nem contrato de API Skool; por outro lado, a sua conexão Zapier já oferece uma ação oficial/pronta de **Invite Member** usando apenas o e-mail.

### Passos na ordem certa

1. **Criar no Stripe** um Product `The Actors Copilot Green Room` e um Price recorrente de €/$9 por mês. ✅ **Feito em modo LIVE** (`prod_VQvghFBGjOICOX` + `price_1UQ4X6EnOTJRuCTXoH6zHvtI`, €9/mês).
   - Esse Product é **community only**: não concede Economy ou Business.
   - Criar Price anual apenas se houver decisão comercial clara.
2. **Confirmar e corrigir os Price IDs no deploy** (o código usa `price_...`, não `prod_...`):
   - Economy mensal → `STRIPE_ECONOMY_PRICE_ID`
   - Economy anual → `STRIPE_ECONOMY_ANNUAL_PRICE_ID`
   - Business mensal → `STRIPE_BUSINESS_PRICE_ID`
   - Business anual → `STRIPE_BUSINESS_ANNUAL_PRICE_ID`
   - Green Room mensal → nova `STRIPE_GREEN_ROOM_PRICE_ID`
3. **Corrigir a moeda/copy da UI** antes de abrir checkout: a UI está em `$`, mas os Prices ativos encontrados no Stripe são em `EUR`.
4. **Criar um Zap no Zapier:**
   - trigger: evento Stripe de checkout/assinatura ativa de qualquer um dos três Prices permitidos;
   - filtro: permitir somente os 5 Price IDs (Green Room, Economy M/A, Business M/A);
   - action: Skool → **Invite Member** → e-mail do customer Stripe;
   - dedupe: registrar/filtrar o customer e subscription ID para não reenviar convite em cada renewal.
5. **Manter o app separado do Zap na primeira fase:** o Zap entrega a comunidade; o webhook existente continua entregando Economy/Business ao app.
6. **Só depois** adicionar o caminho Skool → app para upgrades vendidos no Skool, porque o trigger atual `New Paid Member` não informa Price/Offer/Tier.

### Viabilidade de convite sem Zapier (pesquisa concluída)

**Resposta curta:** sim, é viável — mas **não** através de uma API do Skool. O Skool **não tem API oficial**, e a API não oficial que existe **não sabe convidar**. A alternativa real é o **Make.com**, que tem exatamente o módulo de convite e funciona **já no plano gratuito**.

#### O que existe hoje

| Caminho | Convida? | Custo | Observações |
|---|---|---|---|
| **Zapier** (atual) | ✅ `Invite Member` | **Pro** (pago) | Bloqueado no free por ser fluxo multi-etapa |
| **Make.com** | ✅ **`Invite a New Member`** | ✅ **Free plan** | Só 1 módulo, **sem trigger** — precisa começar por outro app |
| **API oficial do Skool** | ❌ | — | **Não existe** |
| **API não oficial (Apify)** | ❌ | ~US$1,50/mês | Tem `approve`/`reject`/`ban`/`remove`, **não tem invite** |
| **Nosso backend (Next.js)** | ⚠️ | — | Só é possível reimplementando o endpoint de convite do Skool por engenharia reversa |
| **Convite manual** | ✅ | Grátis | Não escala |

#### Por que a API não oficial não resolve

O actor `Skool All-in-One API` (Apify) cobre o ciclo de vida do **membro já existente**:

```
members:list      → membros ativos
members:pending   → quem está na fila de aprovação
members:approve   → aprovar quem já se candidatou
members:reject    → rejeitar
members:remove    → remover do grupo
members:ban       → banir
members:batchApprove
members:export    → CSV de membros
```

Não há `members:invite`. Ele **aprova quem já pediu para entrar** — não envia convite para quem nunca entrou. Para o nosso fluxo (pagou no Stripe → precisa entrar sem pagar de novo no Skool), isso não serve.

#### Make.com é a alternativa recomendada

O app **skool** no Make tem **um único módulo**, e é justamente o que precisamos:

> **Invite a New Member** — "Invites a new member into your group." Envia o convite por e-mail, então a pessoa entra na comunidade sem passar pelo admin.

| Fato | Detalhe |
|---|---|
| Plano necessário | ✅ **Free plan** — "skool is a standard app in Make, so you can use it from the Free plan" |
| Limites do free | 2 cenários ativos, intervalo mínimo de 15 min, 5 min por execução |
| Trigger do Skool | ❌ **Nenhum** — o cenário precisa começar por outro app ou por webhook |
| Outros módulos | ❌ Só esse. Não há remoção de membro nem leitura |
| Operações | 1 operação por execução do módulo |

**Arquitetura recomendada (sem Zapier e sem mensalidade):**

```text
Stripe (pagamento aprovado)
   → webhook do NOSSO app (/api/webhooks/stripe)
   → nossa lógica decide se deve convidar (idempotência + filtro de status)
   → HTTP POST para o webhook do Make
   → Make: skool "Invite a New Member"
   → convite enviado
```

Vantagens sobre o Zapier:

- **Custo zero** no plano free do Make (o Zapier exige Pro).
- **A decisão fica no nosso código**: idempotência, status `trialing`/`active`, qual e-mail usar.
- Sem depender de filtro visual frágil — foi justamente o filtro `active` do Zap que quebrou o fluxo no trial.
- O Make fica responsável **apenas** pelo último passo, que é o único que ele faz bem.

⚠️ Limitações a considerar: o Make free limita a **2 cenários ativos** e impõe **15 minutos** de intervalo se o gatilho for agendado. No desenho acima o gatilho é um **webhook** (instantâneo), então o intervalo não se aplica ao caso principal.

#### E se quisermos convidar direto do Next.js, sem Make?

Só é viável reimplementando por engenharia reversa o endpoint de convite que o próprio Skool usa. **Não recomendado** como primeira opção:

- Não existe documentação oficial e o contrato pode mudar a qualquer momento.
- Exige manter cookies de sessão de admin e um token de WAF que **rotaciona a cada ~3,5 dias**.
- É o tipo de integração que quebra silenciosamente num deploy do Skool.

Se isso for necessário no futuro, o caminho realista é **usar a mesma abordagem do actor da Apify**: autenticar como admin, manter cookies e tratar WAF/buildId. É trabalho contínuo de manutenção, não uma integração de uma vez.

### O que o código já permite / não permite

| Item | Situação |
|---|---|
| Usar Economy/Business atuais no Stripe | ✅ Sim, via Price IDs nas env vars |
| Usar Product IDs (`prod_...`) diretamente | ❌ Não; o código não os lê |
| Vender Green Room Only | ✅ Sim; o checkout aceita `product: 'green_room'` e novos helpers resolvem o entitlement |
| Enviar convite Skool após checkout | ❌ Não no código; ✅ viável via Zapier |
| Diferenciar privilégio Skool por Economy/Business | ❌ Não deve; todos entram na mesma Green Room |
| Dar acesso ao app pelo produto de €/$9 | ❌ Não; `mapStripePriceToTier` devolve `free` para esse Price |

### Price IDs ativos encontrados na conta Stripe

| Plano | Price ID mensal | Price ID anual |
|---|---|---|
| Economy | `price_1TuCshEnOTJRuCTXl1SD2vMr` (€19/mês) | `price_1TwOUREnOTJRuCTXdUqc9fyK` (€190/ano) |
| Business | `price_1TuCsvEnOTJRuCTXbaAzTSbO` (€29/mês) | `price_1TwO6vEnOTJRuCTXl4ilzwrn` (€290/ano) |
| Green Room USD | `price_1UQ9tLEnOTJRuCTXYblFkB0R` (US$ 9/mês) | `price_1UQCEyEnOTJRuCTX44nKC5G8` (US$ 90/ano) |
| Green Room GBP | `price_1UQBj0EnOTJRuCTXkTIePIfS` (£9/mês) | `price_1UQCF0EnOTJRuCTXI4SRYNyo` (£90/ano) |
| Green Room EUR | `price_1UQ4X6EnOTJRuCTXoH6zHvtI` (€9/mês) | `price_1UQCF3EnOTJRuCTXHvewkOlR` (€90/ano) |

Todos os 6 preços do Green Room estão ativos, com apelido descritivo e link de venda próprio (ver §2.2.1).
