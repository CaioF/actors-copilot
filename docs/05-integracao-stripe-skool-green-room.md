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

### 2.2 Inventário real da conta Stripe (consulta MCP, somente leitura)

Consulta executada na conta Stripe **The Actors Copilot**, após habilitar o conector Stripe via Zapier MCP. Resultado após a criação do Green Room: **3 Products ativos** e **7 Prices recorrentes ativos**.

| Product | Product ID | Price | Price ID | Cobrança |
|---|---|---:|---|---|
| The Actors Copilot Green Room | `prod_VQvghFBGjOICOX` | **US$ 9,00** | `price_1UQ9tLEnOTJRuCTXYblFkB0R` | mensal |
| The Actors Copilot Green Room | `prod_VQvghFBGjOICOX` | **£9,00** | `price_1UQBj0EnOTJRuCTXkTIePIfS` | mensal |
| The Actors Copilot Green Room | `prod_VQvghFBGjOICOX` | €9,00 | `price_1UQ4X6EnOTJRuCTXoH6zHvtI` | mensal |
| The Actors Copilot Economy Class | `prod_Uu0uIaw9yLDSke` | €19,00 | `price_1TuCshEnOTJRuCTXl1SD2vMr` | mensal |
| The Actors Copilot Economy Class | `prod_Uu0uIaw9yLDSke` | €190,00 | `price_1TwOUREnOTJRuCTXdUqc9fyK` | anual |
| The Actors Copilot Business Class | `prod_Uu0uuFpzXE5YiE` | €29,00 | `price_1TuCsvEnOTJRuCTXbaAzTSbO` | mensal |
| The Actors Copilot Business Class | `prod_Uu0uuFpzXE5YiE` | €290,00 | `price_1TwO6vEnOTJRuCTXl4ilzwrn` | anual |

> ⚠️ O Green Room hoje tem **três preços** ativos no mesmo Product: **USD** e **GBP** (com link de venda) e **EUR** (criado antes, sem link em uso). Recomenda-se desativar o EUR para evitar cobrança na moeda errada.

**Imagem do Product:** `https://www.theactorscopilot.com/logo.png` — aplicada em `images[0]` (mesma arte de `public/logo.png` do repositório, confirmada servindo `image/png` 200).

**Links diretos no Stripe Dashboard:**

- Product Green Room: <https://dashboard.stripe.com/products/prod_VQvghFBGjOICOX>
- Price Green Room **US$ 9/mês**: <https://dashboard.stripe.com/prices/price_1UQ9tLEnOTJRuCTXYblFkB0R>
- Price Green Room **£9/mês**: <https://dashboard.stripe.com/prices/price_1UQBj0EnOTJRuCTXkTIePIfS>
- Price Green Room €9/mês (sem link em uso): <https://dashboard.stripe.com/prices/price_1UQ4X6EnOTJRuCTXoH6zHvtI>
- Payment Link **USD**: <https://dashboard.stripe.com/payment-links/plink_1UQ9tVEnOTJRuCTXDmWZVBvW>
- Payment Link **GBP**: <https://dashboard.stripe.com/payment-links/plink_1UQBj6EnOTJRuCTXohl1r4t2>
- Payment Link EUR (antigo): <https://dashboard.stripe.com/payment-links/plink_1UQ9PkEnOTJRuCTXfyacvjPy>
- Lista de produtos: <https://dashboard.stripe.com/products>

### 2.2.1 Links de venda por moeda (Caminho A — escolhido)

Todos criados em **modo LIVE** e verificados (HTTP 200, abrem o Stripe Checkout):

| Moeda | Link de pagamento | Payment Link ID | Price ID |
|---|---|---|---|
| 🇺🇸 **USD** | <https://buy.stripe.com/eVqbJ1fao4kq9o4awyaZi03> | `plink_1UQ9tVEnOTJRuCTXDmWZVBvW` | `price_1UQ9tLEnOTJRuCTXYblFkB0R` |
| 🇬🇧 **GBP** | <https://buy.stripe.com/00waEX7HWeZ48k0gUWaZi04> | `plink_1UQBj6EnOTJRuCTXohl1r4t2` | `price_1UQBj0EnOTJRuCTXkTIePIfS` |
| 🇪🇺 EUR (não divulgar) | <https://buy.stripe.com/00w14n9Q4cQW8k06giaZi02> | `plink_1UQ9PkEnOTJRuCTXfyacvjPy` | `price_1UQ4X6EnOTJRuCTXoH6zHvtI` |

**Comum a todos:** cupons promocionais habilitados (`allow_promotion_codes: true`), `payment_method_collection: always`, metadata `product_role: green_room_only`, `app_access: none`, `community: the_actors_copilot_green_room`. Os links GBP/USD também carregam `currency_market`.

**Link oficial (USD)** — detalhamento:

```text
https://buy.stripe.com/eVqbJ1fao4kq9o4awyaZi03
```

| Propriedade | Valor |
|---|---|
| ID | `plink_1UQ9tVEnOTJRuCTXDmWZVBvW` |
| Produto / preço | The Actors Copilot Green Room · **US$ 9,00/mês** |
| Price ID | `price_1UQ9tLEnOTJRuCTXYblFkB0R` |
| Moeda | **USD** (`currency: "usd"`) |
| Modo | **LIVE** (`livemode: true`) |
| Cupons promocionais | ✅ habilitado (`allow_promotion_codes: true`) |
| Cobrança de método de pagamento | `always` |
| Metadata | `product_role: green_room_only`, `app_access: none`, `community: the_actors_copilot_green_room` |

<details>
<summary>Link EUR anterior (criado por engano antes da definição de moeda)</summary>

```text
https://buy.stripe.com/00w14n9Q4cQW8k06giaZi02
```

ID `plink_1UQ9PkEnOTJRuCTXfyacvjPy` · €9,00/mês · `price_1UQ4X6EnOTJRuCTXoH6zHvtI`. **Não divulgar** — usar apenas o link USD.

</details>

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

### Quando fazer sem Zapier?

Só vale implementar o convite diretamente no Next.js se houver uma **API Skool oficial e estável**, com credenciais server-side, endpoint de convite e mecanismo de revogação/retry documentado. Isso reduziria uma ferramenta externa, mas hoje aumenta o risco: a integração pronta e autenticada que temos é a do Zapier.

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
| Green Room Only (**oficial**) | `price_1UQ9tLEnOTJRuCTXYblFkB0R` (**US$ 9/mês**, LIVE) | opcional / a decidir |
| Green Room Only (EUR, sem uso) | `price_1UQ4X6EnOTJRuCTXoH6zHvtI` (€9/mês) | opcional / a decidir |
