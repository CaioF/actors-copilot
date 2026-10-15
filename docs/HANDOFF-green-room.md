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

Product criado: **The Actors Copilot Green Room** (`prod_VQvghFBGjOICOX`), com logo aplicado e descrição em inglês. **6 preços** (3 moedas × mensal/anual) e **6 Payment Links**, todos em modo LIVE.

Convenção do anual: `anual = 10 × mensal` (2 meses grátis). Valores conforme a tabela **aprovada pela Tracey**.

**Tabela atual (após a correção de 15/10/2026):**

| Ciclo | Moeda | Valor | Price ID | Payment Link |
|---|---|---:|---|---|
| Mensal | USD | US$ 9,00 | `price_1UQ9tLEnOTJRuCTXYblFkB0R` | <https://buy.stripe.com/eVqbJ1fao4kq9o4awyaZi03> |
| Anual | USD | US$ 90,00 | `price_1UQCEyEnOTJRuCTX44nKC5G8` | <https://buy.stripe.com/7sYcN56DS04a9o4bACaZi05> |
| Mensal | GBP | **£7,00** | `price_1UQsxMEnOTJRuCTXt6ub7m9h` | <https://buy.stripe.com/5kQ7sL2nCeZ47fWawyaZi08> |
| Anual | GBP | **£70,00** | `price_1UQsxTEnOTJRuCTXoD11VS1a` | <https://buy.stripe.com/4gM9ATaU8cQW43K6giaZi09> |
| Mensal | EUR | **€8,00** | `price_1UQsxZEnOTJRuCTXnTW0Q09z` | <https://buy.stripe.com/7sYcN59Q45ougQwdIKaZi0a> |
| Anual | EUR | **€80,00** | `price_1UQsxcEnOTJRuCTX8Z4HOFBd` | <https://buy.stripe.com/14AaEXd2g4kq57O8oqaZi0b> |

> Os 6 links foram verificados individualmente. Os preços têm apelido (`nickname`) descritivo em inglês para aparecerem legíveis no Dashboard e no dropdown de preço do Zap/Make.

**Preços e links substituídos (15/10/2026).** Criados com o valor do dólar repetido (`£9/£90`, `€9/€90`) em vez dos valores locais aprovados. O `unit_amount` de um Price é imutável, por isso foram **recriados**, não editados. Os antigos estão **inativos** — reativáveis a qualquer momento pelo Dashboard:

| Ciclo | Moeda | Valor antigo | Price ID (inativo) | Payment Link (inativo) |
|---|---|---:|---|---|
| Mensal | GBP | £9,00 | `price_1UQBj0EnOTJRuCTXkTIePIfS` | `plink_1UQBj6EnOTJRuCTXohl1r4t2` |
| Anual | GBP | £90,00 | `price_1UQCF0EnOTJRuCTXI4SRYNyo` | `plink_1UQCFxEnOTJRuCTXK1vej4fu` |
| Mensal | EUR | €9,00 | `price_1UQ4X6EnOTJRuCTXoH6zHvtI` | `plink_1UQ9PkEnOTJRuCTXfyacvjPy` |
| Anual | EUR | €90,00 | `price_1UQCF3EnOTJRuCTXHvewkOLR` | `plink_1UQCFzEnOTJRuCTXENKvv7gI` |

> Os links inativos mostram a mensagem "This link has been replaced…" com o endereço do link novo. Os links USD não foram tocados.

> ⚠️ **Moeda:** o app **não** tem `lib/plan-selection.ts` nesta branch — o seletor de moeda do PR #79 não está aqui. Hoje o `/api/billing/checkout` escolhe o Price só por `tier` + `billingCycle` (`getStripePriceIdForTier`), ou seja, a moeda é sempre a **moeda base do Price**. Isso é aceitável para o Green Room (que tem um Price por moeda e é vendido por Payment Link), mas é o bloqueio para Economy/Business em multi-moeda — ver §4.7 e o doc 08.

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

### 4.3 Zapier bloqueado no plano gratuito — **existe alternativa grátis**

O fluxo tem mais de uma etapa (pagamento → filtro → convite). O plano free do Zapier só permite automação de **um passo**, então publicar exige **Zapier Pro**.

**Alternativa pesquisada e recomendada: Make.com.**

O app **skool** no Make tem exatamente um módulo — **`Invite a New Member`** — e funciona **já no plano gratuito** (2 cenários ativos, intervalo mínimo de 15 min). O Skool não tem trigger no Make, então o cenário precisa começar por webhook.

Arquitetura sugerida: o **nosso** webhook do Stripe decide (idempotência, `trialing` vs `active`, e-mail correto) e chama o webhook do Make, que só executa o convite. Isso tira a decisão do filtro visual do Zap — que foi exatamente o que quebrou no trial (ver 4.1).

**Contexto importante:** o Skool **não tem API oficial**. A API não oficial (Apify) cobre `approve`/`reject`/`ban`/`remove`, mas **não tem invite** — não serve para este fluxo. Detalhes e comparação completa em `05-integracao-stripe-skool-green-room.md` §9.

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

### 4.7 🔴 Conflito com o PR #79 (multi-moeda) — decisão pendente

O `main` recebeu o **PR #79 — "Preserve requested plan and currency through signup to plan selection"** (agente v0/Vercel), que implementou **multi-moeda** com uma abordagem **diferente** da usada nesta branch:

| | PR #79 (main) | Esta branch |
|---|---|---|
| Moedas | `currency_options` no **mesmo Price** | **3 Prices separados** por moeda |
| Validação | `getPriceCurrencies()` consulta a API do Stripe | Price ID fixo por moeda |
| Escopo | `RequestedPlan = 'economy' \| 'business'` | inclui `green_room` |

**Há conflito real** em `app/api/billing/checkout/route.ts` (confirmado com `git merge-tree`). É na linha do destructuring: nós adicionamos `product`, o PR adicionou `currency` — dá para manter os dois.

**Ponto crítico:** o modelo do PR #79 **não conhece o Green Room** (`RequestedPlan` só tem `economy` e `business`). As duas abordagens de moeda coexistem hoje, mas precisam ser reconciliadas.

**Decisão necessária:** manter os 3 Prices separados (como está nos Payment Links, que já funcionam) **ou** migrar o Green Room para `currency_options`, ficando consistente com Economy/Business. Nada foi resolvido — o conflito segue aberto de propósito.

Novos arquivos vindos do `main`: `lib/billing-currency.ts`, `lib/plan-selection.ts`, `app/api/billing/currencies/route.ts`.

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
