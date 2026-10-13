# HANDOFF — Green Room (Stripe × Skool)

**Branch:** `handoff/green-room-stripe-skool`
**Base:** `main` @ `1c055f8`
**Data:** 2026-10-13

Documento de passagem para o próximo desenvolvedor. Leia isto primeiro; os detalhes estão em [`05-integracao-stripe-skool-green-room.md`](./05-integracao-stripe-skool-green-room.md).

---

## 1. Contexto em uma frase

A comunidade **The Actors Copilot Green Room** (Skool) é **uma única membership**. Ela é vendida sozinha (US$9 / £9) e também está **incluída sem custo adicional** nos planos Economy e Business. Por isso, **Economy e Business nunca podem representar níveis diferentes de acesso ao Skool**.

---

## 2. O que foi feito nesta branch

### 2.1 Stripe (conta **The Actors Copilot**, modo **LIVE**)

Product criado: **The Actors Copilot Green Room** (`prod_VQvghFBGjOICOX`), com logo aplicado.

| Moeda | Preço | Price ID | Payment Link |
|---|---|---|---|
| USD | US$ 9,00/mês | `price_1UQ9tLEnOTJRuCTXYblFkB0R` | <https://buy.stripe.com/eVqbJ1fao4kq9o4awyaZi03> |
| GBP | £9,00/mês | `price_1UQBj0EnOTJRuCTXkTIePIfS` | <https://buy.stripe.com/00waEX7HWeZ48k0gUWaZi04> |
| EUR | €9,00/mês | `price_1UQ4X6EnOTJRuCTXoH6zHvtI` | <https://buy.stripe.com/00w14n9Q4cQW8k06giaZi02> (⚠️ não divulgar) |

### 2.2 Código

| Arquivo | O que mudou |
|---|---|
| `lib/billing.ts` | Novo tipo `CommunityEntitlement` (`'none' \| 'green_room'`); campo `community` em `UserBilling`; `getStripeGreenRoomPriceId()`; `mapStripePriceToCommunity()`; `resolveEntitlementsFromPrice()`; `mapStripePriceToTier()` agora devolve `free` para o Price do Green Room |
| `lib/billing.test.ts` | **Novo** — 13 testes travando a regra "Green Room nunca concede tier do app" |
| `app/api/billing/checkout/route.ts` | Aceita `product: 'green_room'`; usa o Price do Green Room; **não** aplica trial de 14 dias; **não** grava `targetTier`; grava `product` em metadata |
| `app/api/webhooks/stripe/route.ts` | Resolve e persiste `community`, sem sobrescrever o campo em eventos parciais |
| `app/api/billing/checkout/route.test.ts` | Asserções de metadata atualizadas + teste de checkout community-only |
| `app/api/webhooks/stripe/route.test.ts` | Mock atualizado com `mapStripePriceToCommunity` |
| `env.example` | Nova variável `STRIPE_GREEN_ROOM_PRICE_ID` |

### 2.3 Documentação

`docs/README.md` (índice) · `01` arquitetura · `02` regras de negócio · `03` páginas e rotas · `04` design system · `05` integração Stripe × Skool · `_research/` relatórios técnicos · `_comunicacao/` mensagem para a cliente.

---

## 3. Validação executada

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | ✅ limpo |
| `npx jest` | ✅ **64 suites, 690 testes** |
| `npx eslint` (arquivos alterados) | ✅ 0 erros (só warnings pré-existentes de `any`) |

---

## 4. 🔴 Pendências e riscos (leia antes de publicar)

### 4.1 Filtro do Zap bloqueia assinaturas em trial — **P0**

O filtro atual do Zap exige status **`active`**. Mas Economy e Business **começam com trial de 14 dias**, e nesse período o status no Stripe é **`trialing`**.

Resultado: quem compra Economy/Business fica **14 dias sem receber o convite do Green Room**, em silêncio. O Green Room Only não tem trial, então **o bug não aparece testando pelo link de $9**.

Correção: aceitar `active` **ou** `trialing`; de preferência filtrar pelo **Price ID** e não pelo status.

Fonte: `app/api/billing/checkout/route.ts` → `...(isTrial ? { trial_period_days: 14 } : {})`.

### 4.2 Convite ao Skool não existe no código

O convite é responsabilidade do **Zap**. O app **não** chama o Skool em lugar nenhum. Se o Zap falhar, o cliente paga e não recebe convite.

### 4.3 Zapier bloqueado no plano gratuito

O fluxo tem mais de uma etapa (pagamento → filtro → convite). O plano free só permite automação de **um passo**. Para publicar, é necessário **Zapier Pro** (há teste de 14 dias).

### 4.4 Preço EUR sobrando

O Green Room tem três preços ativos. O **EUR** foi criado antes da definição de moeda e está sem link em uso. Recomenda-se **desativar** para evitar cobrança na moeda errada.

### 4.5 Divergência de moeda nos planos existentes

A UI do app mostra `$19/$15/$29/$23`, mas a conta Stripe tem Economy `€19/€190` e Business `€29/€290` **em EUR**. Precisa ser alinhado.

### 4.6 Bugs de billing pré-existentes (não introduzidos aqui)

- Webhook Stripe **sem idempotência** por `event.id` — retries podem duplicar efeitos externos (ex.: convites).
- `invoice.payment_*` pode sobrescrever `tier` com `null` no documento raiz do usuário.
- `cancel_url` aponta para `/api/billing/cancelled`, rota que **não existe**.
- `/api/billing/success` pode emitir sessão por `session_id` sem validar posse.
- APIs do app **não** aplicam enforcement de tier no servidor.
- `firestore.rules` libera leitura/escrita para qualquer usuário autenticado.

Detalhes: `02-regras-de-negocio.md` §11 e `05-integracao-stripe-skool-green-room.md` §7.

---

## 5. O que falta decidir

1. O convite usa o e-mail do **Stripe** (`customer_details.email`) ou o do **Firebase**? Se forem diferentes, o convite vai para a pessoa errada.
2. Política de cancelamento/inadimplência: revogar o Skool imediatamente, no fim do período, ou com carência?
3. Desativar o preço/link EUR?
4. Publicar a mensagem de agradecimento nos links? (**só** quando o convite por e-mail estiver funcionando de fato — hoje prometeria algo que não acontece).
5. O Caminho B (vender o Green Room dentro do app, com vínculo no Firestore) será implementado? O backend já está pronto; falta `STRIPE_GREEN_ROOM_PRICE_ID` no deploy e um card na página `/upgrade`.

---

## 6. Variáveis de ambiente necessárias

```env
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_ECONOMY_PRICE_ID=""
STRIPE_ECONOMY_ANNUAL_PRICE_ID=""
STRIPE_BUSINESS_PRICE_ID=""
STRIPE_BUSINESS_ANNUAL_PRICE_ID=""
STRIPE_GREEN_ROOM_PRICE_ID=""   # NOVO — price do Green Room
```

⚠️ `lib/billing.ts` **lança erro no import** se `STRIPE_ECONOMY_PRICE_ID`, `STRIPE_BUSINESS_PRICE_ID` ou `STRIPE_WEBHOOK_SECRET` estiverem ausentes. Sem essas variáveis o app não sobe.

---

## 7. Segurança

- Nenhum segredo foi commitado. `sk_test_dummy` / `whsec_dummy` em `lib/billing.test.ts` são placeholders literais.
- Os objetos Stripe do Green Room foram criados em **modo LIVE** e os links **aceitam pagamento real**. Não divulgue antes de o convite estar funcionando.
- `.env*` está no `.gitignore`.
