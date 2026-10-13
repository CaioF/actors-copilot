# 02 — Regras de Negócio

> Este é o documento mais importante para **trabalhar** no projeto: descreve o comportamento esperado do sistema por domínio, com as regras exatas, os caminhos de dados e os pontos onde o código diverge da intenção.
>
> Convenção: 🟢 = regra implementada e consistente · 🟡 = implementada com lacuna/duplicação · 🔴 = risco/bug relevante.
>
> Base: commit `32f7f74`. Referências no formato `arquivo:linha`.

---

## Sumário

1. [Autenticação e sessão](#1-autenticação-e-sessão)
2. [Assinaturas, tiers e billing](#2-assinaturas-tiers-e-billing)
3. [Gating de features (o que cada plano libera)](#3-gating-de-features)
4. [Personal DNA — extração psicológica](#4-personal-dna--extração-psicológica)
5. [Audições — breakdown e sides](#5-audições--breakdown-e-sides)
6. [Acting Coach](#6-acting-coach)
7. [Perfil do ator e perfil público](#7-perfil-do-ator-e-perfil-público)
8. [Dados, privacidade e exclusão](#8-dados-privacidade-e-exclusão)
9. [Modelo de dados Firestore (consolidado)](#9-modelo-de-dados-firestore-consolidado)
10. [Regras transversais e constantes](#10-regras-transversais-e-constantes)
11. [Backlog priorizado de correções](#11-backlog-priorizado-de-correções)

---

## 1. Autenticação e sessão

### 1.1 Métodos de login 🟢

| Método | Implementação | Referência |
|---|---|---|
| Google OAuth | `signInWithPopup(auth, googleProvider)` | `lib/context/AuthContext.tsx:55,124` |
| E-mail/senha (login) | `signInWithEmailAndPassword` | `lib/context/AuthContext.tsx:171` |
| E-mail/senha (cadastro) | `createUserWithEmailAndPassword` | `lib/context/AuthContext.tsx:212` |
| Reset de senha | `sendPasswordResetEmail` | `lib/context/AuthContext.tsx:254` |
| Logout | `signOut(auth)` + `POST /api/auth/logout` | `lib/context/AuthContext.tsx:278-281` |

### 1.2 Fluxo de emissão da sessão 🟢

```
1. Usuário autentica no Firebase (client)
2. client → POST /api/auth/callback { idToken }
3. Servidor: auth.verifyIdToken(idToken) → exige claim `email` (400 se ausente)
4. Lê users/{uid}/billing/current  → tier, status, stripeCustomerId, ...
5. Assina JWT HS256 (jose) e grava cookie httpOnly `platform_session`
6. Responde { success, user: { uid, email, tier, subscriptionStatus } }
```

- **Claims do JWT** (`PlatformSession`, `lib/session.ts:9-18`): `uid`, `email`, `tier`, `subscriptionStatus`, `stripeCustomerId?`, `stripeSubscriptionId?`, `stripePriceId?`, `currentPeriodEnd?`.
- **Cookie:** nome `platform_session`, `httpOnly: true`, `secure: NODE_ENV === 'production'`, `sameSite: 'lax'`, `path: '/'`, `maxAge` 7 dias (`lib/session.ts:69-75`).
- **Token:** `alg: HS256`, `setIssuedAt()`, `setExpirationTime('7d')`; segredo `JWT_SECRET_KEY || JWT_SECRET` (`lib/session.ts:21,34-40`).
- **Defaults sem documento de billing:** `tier = 'free'`, `subscriptionStatus = 'canceled'` (`app/api/auth/callback/route.ts:28-29`).
- **Hidratação do front:** `GET /api/auth/callback` (lê só o cookie) devolve `{ authenticated, tier, subscriptionStatus, stripeCustomerId }`; se falhar, o `AuthContext` faz fallback para `free`/`canceled` (`AuthContext.tsx:294-331`).

> 🟡 **README × código:** o README (linhas 636-643) afirma `sameSite: 'strict'` e `secure: true`; o código usa `'lax'` e `secure` só em produção. O README também diz que o cookie é gravado em `callback/route.ts:71` — na verdade está em `lib/session.ts:65-76`.

### 1.3 Regras de erro de autenticação (mensagens ao usuário) 🟢

| Código Firebase | Mensagem exibida | Referência |
|---|---|---|
| `auth/popup-closed-by-user`, `auth/cancelled-popup-request` | silencioso (return) | `AuthContext.tsx:147-149` |
| `auth/account-exists-with-different-credential` | "This email is already registered. Please log in using the Email/Password form." | `AuthContext.tsx:150-152` |
| `auth/invalid-credential` | "Invalid credentials. If you originally signed up with Google, please use the Google button." | `AuthContext.tsx:191-193` |
| `auth/email-already-in-use` | "This email is already registered. Try logging in with Google or your password instead." | `AuthContext.tsx:237-239` |
| `auth/invalid-email` (reset) | "Please enter a valid email address." | `AuthContext.tsx:257-259` |
| `auth/user-not-found` (reset) | silencioso (evita enumeração de e-mails) | `AuthContext.tsx:260-262` |

> 🟢 Boa prática já aplicada: o reset de senha não revela se o e-mail existe.

### 1.4 Guardas de rota

Três camadas, com responsabilidades distintas:

| Camada | Arquivo | Verifica | Não verifica |
|---|---|---|---|
| Middleware de borda | `proxy.ts` | Cookie JWT válido + `tier` × `subscriptionStatus` | Firebase real |
| `ProtectedRoute` (client) | `lib/context/ProtectedRoute.tsx:19-23` | Se existe usuário Firebase | Tier / assinatura |
| Handlers de API | `app/api/**` | `Authorization: Bearer <ID token>` (Firebase) | **Tier / assinatura / `hasAccess`** 🔴 |

**Regras exatas do middleware** (`proxy.ts:18-69`):

| Condição | Ação |
|---|---|
| Caminho é `/api/billing/success*` | `next()` — **bypass total, antes de checar auth** 🔴 |
| Sem cookie `platform_session` | 307 → `/login` |
| Cookie inválido/expirado | 307 → `/login` + apaga o cookie |
| `tier === 'free'` **ou** status ∉ `['active','trialing']` | Só `/dashboard` e `/dashboard/*` passam; resto → `/upgrade` |
| `tier === 'economy'` | Bloqueia `/profile*` e `/acting-coach*` → `/upgrade`; resto passa |
| `tier === 'business'` | Passa tudo |
| `BILLING_ENGINE !== 'STRIPE'` | Ramo legado **Kajabi** (cookie `kajabi_session` + claim `offers`) — inalcançável no default |

**Matcher do middleware** (`proxy.ts:129-140`):
`/api/billing/success`, `/dashboard/:path*`, `/chat/:path*`, `/auditions/:path*`, `/personal-dna/:path*`, `/settings/:path*`, `/profile/:path*`, `/acting-coach/:path*`

> 🔴 **Fora do matcher** (portanto sem gate de tier no servidor): `/dna-vault`, `/reader-copilot`, `/upgrade`, `/login`, `/`, `/actors/**` e **todas as rotas de API** exceto `/api/billing/success`.

### 1.5 Logout 🟡

- Apaga o cookie `platform_session` (`lib/session.ts:94-97`) e responde `{ success: true }`.
- **Não há blacklist/revogação de JWT.** Token copiado continua válido até `exp` (7 dias) — TODO registrado no README.
- Erros no logout são engolidos no cliente (apenas `logger.error`) — `AuthContext.tsx:283-287`.
- **Regra de consistência:** a lista de status ativos `['active','trialing']` está duplicada em **4 lugares**: `proxy.ts:51`, `lib/billing.ts:147`, `app/api/webhooks/stripe/route.ts:223` e `:264`. Alterar exige mudar todos. 🔴

---

## 2. Assinaturas, tiers e billing

### 2.1 Tiers e status 🟢

```ts
type SubscriptionTier   = 'free' | 'economy' | 'business';           // lib/billing.ts:7
type SubscriptionStatus = 'active' | 'trialing' | 'canceled'
                        | 'incomplete' | 'past_due' | 'unpaid';       // lib/billing.ts:12-18
type BillingCycle       = 'monthly' | 'annual';                        // lib/billing.ts:20
```

**Regra de acesso:** apenas `active` e `trialing` concedem acesso. Qualquer outro status ⇒ tier efetivo `free`.

> 🟡 O JWT persiste o **tier bruto** do documento (`callback/route.ts:40,52`); quem cruza `tier` × `status` é o `proxy.ts`. Um usuário `past_due` com `tier: 'business'` continua com `business` no token, mas é redirecionado a `/upgrade` pelo status.

### 2.2 Matriz tier → Stripe Price ID 🟢

`getStripePriceIdForTier(tier, billingCycle)` (`lib/billing.ts:72-97`):

| Tier | Mensal | Anual |
|---|---|---|
| `economy` | `STRIPE_ECONOMY_PRICE_ID` | `STRIPE_ECONOMY_ANNUAL_PRICE_ID` (erro se ausente) |
| `business` | `STRIPE_BUSINESS_PRICE_ID` | `STRIPE_BUSINESS_ANNUAL_PRICE_ID` (erro se ausente) |
| `free` | lança `Error` | lança `Error` |

Mapeamento reverso `mapStripePriceToTier(priceId)` (`lib/billing.ts:104-119`): economy (M ou A) → `economy`; business (M ou A) → `business`; desconhecido/`undefined` → `free` (com `console.warn`).

> 🔴 **Hard fail na importação:** `lib/billing.ts:52-64` lança erro se `STRIPE_ECONOMY_PRICE_ID`, `STRIPE_BUSINESS_PRICE_ID` **ou** `STRIPE_WEBHOOK_SECRET` não existirem. Sem essas variáveis o módulo nem importa (quebra checkout, webhook, success e testes).

### 2.3 Preços

Não existem no servidor — vivem no Stripe. Os números em código:

| Fonte | Economy | Business | Ciclo |
|---|---|---|---|
| UI `/upgrade` (USD, hardcoded) | `$19.00` / `$15.00` | `$29.00` / `$23.00` | mensal / anual ("−20%") — `upgrade/page.tsx:200,209,225` |
| CSV legado Kajabi (GBP) | `£19.00` | — | `Month` — `subscriptions.csv:2-4` |

> 🟡 Inconsistência de moeda: UI atual vende em **USD**; dados legados/migração em **GBP**.

### 2.4 Trial de 14 dias 🟡

- `trial_period_days: 14` na Checkout Session (`app/api/billing/checkout/route.ts:139`).
- **Elegibilidade:** `hasUsedTrial` é lido de `users/{uid}/billing/current` e, se falso, de `users/{uid}` raiz (`checkout/route.ts:72-89`).
- Se `hasUsedTrial === true` e a requisição for explicitamente trial (`isTrial`, `trial` ou `tier === 'trial'`) → **400** `"A free trial has already been used for this account."` (`checkout/route.ts:48,91-93`).
- 🔴 **Regra crítica:** `const isTrial = !hasUsedTrial` (`checkout/route.ts:96`) ⇒ **todo primeiro checkout ganha 14 dias de trial automaticamente**, mesmo clicando "Upgrade" sem pedir trial, com `payment_method_collection: 'always'`.
- 🟡 `tier` ausente ou `'trial'` cai em `selectedTier = 'business'` (`checkout/route.ts:49`) — um trial pode virar Business por default.
- **Intenção de trial:** `?plan=...` em `/login` grava `sessionStorage.trial_intent = "14d"` / `trial_tier`; após autenticar, `AuthContext.handlePostAuthRedirect()` dispara o checkout e redireciona ao Stripe (`login/page.tsx:67-86`; `AuthContext.tsx:78-111`).

### 2.5 Onde o entitlement é armazenado 🟢

| Caminho | Campos | Escrito por |
|---|---|---|
| `users/{uid}/billing/current` | `customerId`, `subscriptionId`, `priceId`, `tier`, `status`, `subscriptionStatus`, `hasAccess`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `cancelAt`, `trialStart`, `trialEnd`, `hasUsedTrial`, `migrationSource`, `migratedAt`, `updatedAt` | webhook (`webhooks/stripe/route.ts:130-140`); seed no checkout (`checkout/route.ts:110-115`) |
| `users/{uid}` (espelho) | `stripeCustomerId`, `subscriptionStatus`, `hasAccess`, `tier`, `cancelAtPeriodEnd`, `cancelAt`, `hasUsedTrial`, `updatedAt` (+ `email`) | webhook (`webhooks/stripe/route.ts:142-157`) |

> 🔴 **Dois namespaces para o mesmo usuário:** billing/sessão usam `users/{uid}`; **todo o conteúdo do app** usa `users/{uid}_{FirstName}` (ver §4.2). Ver §9.

### 2.6 Fluxo de Checkout 🟢

`POST /api/billing/checkout` (`app/api/billing/checkout/route.ts`):

1. Parse defensivo do JSON → 400 `"Malformed JSON request body"` (`:17-22`).
2. Auth: cookie `platform_session` **ou** `idToken` no body verificado por `verifyIdToken` (`:30-42`); sem `uid`/`email` → 401.
3. `isExplicitTrialReq = isTrial || trial || tier === 'trial'`; `selectedTier = tier !== 'trial' ? tier : 'business'`; `billingCycle` default `'monthly'` (`:48-50`).
4. Validação: só `economy`/`business` (400 caso contrário) (`:52-54`).
5. Resolve `priceId` (`:57-62`).
6. Lê billing + regra de trial (`:64-96`).
7. Lazy-create do customer Stripe com `metadata.platformUserId`/`firebaseUid` + seed `{ customerId, tier:'free', status:'canceled', updatedAt }` (`:99-116`).
8. Cria a Checkout Session (`:119-151`):

| Campo | Valor |
|---|---|
| `customer` | `stripeCustomerId` |
| `client_reference_id` | `uid` |
| `mode` | `'subscription'` |
| `allow_promotion_codes` | `true` |
| `billing_address_collection` | `'required'` |
| `line_items` | `[{ price: priceId, quantity: 1 }]` |
| `subscription_data.metadata` | `{ firebaseUid, platformUserId, targetTier }` |
| `subscription_data.trial_period_days` | `14` (só se `isTrial`) |
| `payment_method_collection` | `'always'` (só se `isTrial`) |
| `success_url` | `${NEXT_PUBLIC_APP_URL \|\| 'http://localhost:3000'}/api/billing/success?session_id={CHECKOUT_SESSION_ID}` |
| `cancel_url` | `${appUrl}/api/billing/cancelled` ← 🔴 **rota não existe** |
| `metadata` | `{ platformUserId, firebaseUid, targetTier, billingCycle, isTrial }` |

9. Resposta: `{ url: checkoutSession.url }` (`:154`).

### 2.7 Customer Portal — dois endpoints duplicados 🟡

| Endpoint | Auth | `return_url` | Usado por |
|---|---|---|---|
| `POST /api/billing/portal` | cookie → Bearer → body `idToken` | `STRIPE_CUSTOMER_PORTAL_RETURN_URL \|\| ${appUrl}/settings` | **ninguém** (código morto) |
| `POST /api/create-portal-session` | idem | sempre `${appUrl}/settings` | `/settings` (`settings/page.tsx:115`) |

Ambos: 400 `"Bad Request: No active billing profile exists for this account."` quando não há `stripeCustomerId`, e então `stripe.billingPortal.sessions.create({ customer, return_url })`.

### 2.8 Callback de sucesso 🔴

`GET /api/billing/success` — **isento de auth no proxy** (`proxy.ts:26-30`). Lê `session_id` da query, busca a Checkout Session, usa `client_reference_id` como `uid`, lê `users/{uid}/billing/current` como fonte autoritativa e **assina uma nova sessão** (novo cookie) antes de redirecionar para `/dashboard`.

> 🔴 **Vetor de fixação de sessão:** a rota emite `platform_session` a partir de um `session_id` de query **sem validar que a Checkout Session pertence ao chamador**. Quem obtiver um `session_id` de terceiro pode obter a sessão correspondente. Não há teste para esta rota.

### 2.9 Webhook Stripe 🟡

`POST /api/webhooks/stripe` (`export const dynamic = 'force-dynamic'`).

**Segurança:** header `stripe-signature` obrigatório (400 se ausente); corpo lido como texto cru; `constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)`; falha → 400 `"Invalid Webhook Cryptographic Signature"`.

**Resolução de `platformUserId`** (cascata, `resolvePlatformUserId` `:48-125`):
1. `client_reference_id` → metadata (`platformUserId` → `userId` → `uid` → `firebaseUID` → `firebaseUserId`)
2. `collectionGroup('billing').where('customerId','==',customerId).limit(1)` (exige índice de collection group)
3. `users.where('stripeCustomerId','==',customerId).limit(1)`
4. `stripe.customers.retrieve(customerId)` → metadata / e-mail
5. `users.where('email','==',email).limit(1)`

Se nada resolve → apenas `logger.warn` e o evento é **descartado silenciosamente** (sem fila/retry).

**Eventos tratados:**

| Evento | Efeito |
|---|---|
| `checkout.session.completed` | Resolve uid; busca subscription e `priceId` (fallback `listLineItems`); `tier = metadata.targetTier \|\| mapStripePriceToTier(priceId) \|\| 'free'`; detecta trial; `hasAccess = status ∈ [trialing, active]`; grava billing + espelho |
| `customer.subscription.created/updated/deleted` | `tier` pelo price; `isDeleted = deleted \|\| cancelled \|\| unpaid`; `hasAccess = !isDeleted && status ∈ [trialing,active]`; `currentPeriodEnd`; `cancelAtPeriodEnd`; `cancelAt`; se deletado → `tier:'free'`, `status:'canceled'` |
| `invoice.payment_succeeded` | `status = 'active'`, `hasAccess = true` — grava **apenas** `{ customerId, status, hasAccess }` |
| `invoice.payment_failed` | `status = 'past_due'`, `hasAccess = false` — idem |
| default | `logger.debug` + 200 |

**Mutação Firestore** (`syncUserBilling` `:130-158`): `set(payload, { merge: true })` em `users/{uid}/billing/current` e em `users/{uid}`. `sanitizeFirestorePayload` converte `undefined → null` (evita crash do Admin SDK).

> 🔴 **Bugs conhecidos no webhook:**
> - `invoice.payment_succeeded/failed` **não passam `tier`** → `syncUserBilling` grava `tier: null` em `users/{uid}` (o merge sobrescreve o tier existente) e força `cancelAtPeriodEnd: false`.
> - `hasUsedTrial: undefined` é sanitizado para `null`, sobrescrevendo `true` em replays.
> - **Sem idempotência por `event.id`** (nenhuma coleção de eventos processados) e **sem checagem de `event.livemode`**.
> - `migratedAt` é regenerado a cada replay (não idempotente para auditoria).
> - Se `stripe.subscriptions.retrieve` falhar sem metadata de trial, `subStatus` assume `'active'`.

---

## 3. Gating de features

### 3.1 O que cada plano promete (copy oficial em `/upgrade`) 🟢

| Tier | Features listadas na UI |
|---|---|
| **Economy Class** (US$ 19/mês · US$ 15/mês anual) | Access to Personal DNA Extraction chats · Full Audition Breakdown generation features · Multi-step Audition Wizard access · Standard storage metrics limits |
| **Business Class** (US$ 29/mês · US$ 23/mês anual) | Everything in Economy · **Exclusive access to the AI Acting Coach** · **Deep character lens profile analysis modules** · Priority processing speeds · **Full Actor Profile management tools** |

### 3.2 O que está **de fato** implementado 🟡

| Camada | Aplica | Referência |
|---|---|---|
| Edge (`proxy.ts`) | Auth + tier por prefixo de rota | `proxy.ts:18-69,129-140` |
| Client (`ProtectedRoute`) | Só autenticação Firebase | `ProtectedRoute.tsx:19-23` |
| Client (UI) | Cosmético: "Manage Plan"/"Upgrade Plan" (`tier === 'business'`), "Current Plan" no card, badge em Settings. **Nenhum bloqueio** | `app-sidebar.tsx:51,175`; `upgrade/page.tsx:96,212,229` |
| Server (rotas de IA) | **Só autenticação** — não consulta tier/status/`hasAccess` 🔴 | `dna/chat/route.ts:24-28`; `coach/chat/route.ts:13-16`; `analyzeBrief/route.ts:158`; `autofill/route.ts:298` |
| Server (billing) | Auth por cookie/ID token + regras de trial/customer | `checkout/route.ts:26-46` |

> 🔴 **Não existe nenhum limite numérico de uso no código** (nem `MAX_` de audições, mensagens, quotas ou DNA). "Standard storage metrics limits" é apenas copy. O único `MAX_HISTORY_MESSAGES = 20` (`coach/chat/route.ts:8,102`) é janela de contexto do LLM, não limite comercial.
>
> 🔴 **Enforcement de tier é bypassável:** como as rotas de IA não estão no matcher e não checam tier, um usuário `free` (ou inadimplente) autenticado pode consumir DNA, audições e **até o Acting Coach** (vendido como exclusivo de Business) por chamada direta à API.
>
> 🟡 O README descreve o `chat-sidebar.tsx` como tendo "tier-aware control gates" — **não há nenhuma referência a `tier` nesse arquivo**.
>
> 🟢 **Gate de produto (não de tier):** `auditionsUnlocked` é calculado pelo progresso da extração de DNA e persistido na sessão (`lib/chat-types.ts:41`; `hooks/use-chat.ts:557,690`) — ou seja, liberar audições depende de completar DNA, não de pagar.

### 3.3 Matriz de acesso por rota

| Rota | `free`/inativo | `economy` | `business` |
|---|---|---|---|
| `/dashboard/**` | ✅ | ✅ | ✅ |
| `/chat/**` | → `/upgrade` | ✅ | ✅ |
| `/auditions/**` | → `/upgrade` | ✅ | ✅ |
| `/personal-dna/**` | → `/upgrade` | ✅ | ✅ |
| `/settings/**` | → `/upgrade` | ✅ | ✅ |
| `/profile/**` | → `/upgrade` | **→ `/upgrade`** | ✅ |
| `/acting-coach/**` | → `/upgrade` | **→ `/upgrade`** | ✅ |
| `/dna-vault/**`, `/reader-copilot/**` | ⚠️ sem gate | ⚠️ sem gate | ⚠️ sem gate |
| `/upgrade`, `/login`, `/`, `/actors/**` | público | público | público |

---

## 4. Personal DNA — extração psicológica

### 4.1 Conceito 🟢

O Personal DNA é construído por uma conversa socrática conduzida pelo agente **"The Coach" (YAN)**, que extrai material psicológico bruto. Paralelamente, um segundo agente (**MEMLISTENER**) analisa cada turno e grava extrações estruturadas no *Master Profile*.

### 4.2 Identificador de usuário — regra crítica 🔴

**Todo o conteúdo do app é gravado em `users/{userPath}/...`, onde:**

```
userPath = `${uid}_${firstNameSanitizado}`
firstNameSanitizado = displayName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") || "Actor"
```

Referências: `app/api/dna/chat/route.ts:54-66`; `app/api/coach/chat/route.ts:65-67`; `app/(interior)/settings/page.tsx:233-234`; `app/(interior)/reader-copilot/page.tsx:49-52`.

> 🔴 **Consequência:** se o usuário alterar o `displayName` (ex.: "Caio" → "Caio Ferreira" continua igual, mas "Caio" → "Charles" quebra), o `userPath` muda e **o app deixa de encontrar os dados antigos** (DNA, audições, sessões). Billing, por outro lado, usa `users/{uid}` e não é afetado. É a maior armadilha estrutural do projeto.

### 4.3 As 12 arenas psicológicas 🟢

`DNA_SECTIONS` (`lib/chat-types.ts:80-93`) — a ordem no código é a abaixo (⚠️ difere da ordem do README):

| # | ID | Label |
|---|---|---|
| 1 | `identity` | Identity and Self-Story |
| 2 | `childhood` | Early Childhood and Home |
| 3 | `school_authority` | School, Authority and the Outside World |
| 4 | `belonging` | Belonging and Exclusion |
| 5 | `relationships` | Relationships and Attachment |
| 6 | `power` | Power and Authority |
| 7 | `shame` | Shame and Self-Worth |
| 8 | `loss` | Loss and Change |
| 9 | `desire` | Desire and Ambition |
| 10 | `joy` | Joy and Vitality |
| 11 | `conflict` | Conflict and Pressure |
| 12 | `beliefs` | Beliefs and Life Patterns |

### 4.4 Os 4 capítulos (unidade de navegação da UI) 🟢

A UI **não** percorre as 12 arenas individualmente: ela usa `DNA_CHAPTERS` (`lib/chat-types.ts:110-147`), e é o `chapter_N` que vai como `currentSection` para a API.

| Capítulo | Título | Subtítulo | Arenas agrupadas | Recompensa de desbloqueio |
|---|---|---|---|---|
| `chapter_1` | Foundation & Persona | Identity, Roots & Formative Beliefs | `identity`, `childhood`, `beliefs` | 🚀 AI Audition Prep & Acting Coach |
| `chapter_2` | World & Relational Power | Authority, Belonging & Relationships | `school_authority`, `belonging`, `relationships`, `power` | 🎭 Subconscious Archetype & Dynamic Character Matching |
| `chapter_3` | Inner Shadow & Vulnerability | Defense Mechanisms, Shame & Grief | `shame`, `loss`, `conflict` | 🔥 High-Stakes Emotional Trigger Analysis |
| `chapter_4` | Core Fuel & Creative Drive | Desire, Ambition & Vitality | `desire`, `joy` | 👑 Master DNA Profile & Full Vault Synthesis |

> ⚠️ `beliefs` está no capítulo 1 mas é a última arena na lista; e `conflict`/`joy` aparecem em capítulos diferentes da ordem das arenas. Sempre consulte `DNA_CHAPTERS` como fonte de verdade.
>
> 🔴 **Os 12 `SECTION_PROMPTS` de arena são código morto no fluxo atual:** o `currentSection` enviado à API é sempre `chapter_1..4` (`app/chat/page.tsx:42`; `hooks/use-chat.ts:740-743`), e o servidor faz `SECTION_PROMPTS[currentSection]`. Só as chaves `chapter_*` (e o fallback `identity` para ids desconhecidos) são usadas (`app/api/dna/chat/route.ts:40`).

### 4.5 Taxonomia de temas e requisitos de conclusão 🟢

Cada arena tem um vocabulário controlado de temas (`ARENA_THEMES`, `lib/chat-types.ts:155-243`) que o MEMLISTENER usa para marcar cada extração, garantindo **diversidade** de exploração. Ex.: `shame` → `shame_origin`, `shame_trigger`, `shame_coping`, `shame_relationships`, `shame_body`, `shame_identity`.

`THEME_DISPLAY_NAMES` (`lib/chat-types.ts:250-328`) mapeia os IDs para rótulos legíveis na UI.

**Regra de conclusão de seção** (`hooks/use-chat.ts:564-565,596-602`):

```ts
REQUIRED_THEMES               = 4   // >= 4 temas únicos
HQ_EXTRACTIONS_FOR_COMPLETION = 5   // >= 5 extrações de alta qualidade
meetsCountRequirement = hqCount >= 5
meetsThemeRequirement = uniqueThemes.size >= 4   // ⚠️ calculado mas NÃO usado
isComplete = meetsCountRequirement               // ⚠️ só a contagem decide
```

> 🔴 `meetsThemeRequirement` é calculado e **ignorado** no `if` de conclusão (`use-chat.ts:596-602`). Na prática a seção completa com 5 extrações independentemente da diversidade.

**Cálculo de progresso** (`hooks/use-chat.ts:645-675`):
- `TOTAL_CHAPTERS = 4` → cada capítulo completo vale **25%** (não 8,33%).
- Pesos internos: `DIVERSITY_WEIGHT = 0.6` e `COUNT_WEIGHT = 0.4`.
- **Desbloqueio de audições:** `newCompletedSecs.length >= 2` (`use-chat.ts:643`).

> 🔴 **Todo esse bloco é inatingível na prática** — ver §4.14. O `progress` cai no fallback fixo `Math.min(totalProgressPercentage || 25, 100)` = **25%** e `auditionsUnlocked` nunca liga.

**Extração de alta qualidade (HQ)** — definida no servidor (`app/api/dna/chat/route.ts:271-275`):

```ts
isHighQuality = progress_assessment != null
             && progress_assessment.has_actionable_pattern === true
             && (progress_assessment.depth_score ?? 0) >= 4
```

Só extrações HQ atualizam o Master Profile.

### 4.6 Motor de pivô (Pivot Engine) 🟢

Limiares únicos em `DEFAULT_THRESHOLDS` (`lib/pivot-logic.ts:18-23`):

| Parâmetro | Valor | Significado |
|---|---|---|
| `windowSize` | 5 | Janela deslizante (FIFO) de temas HQ considerados |
| `requiredDiversity` | 4 | Mínimo de temas únicos na janela |
| `questionThreshold` | 15 | Pivô obrigatório após N turnos |
| `repetitionThreshold` | 3 | Pivô se um tema repetir ≥ 3× na janela |

`shouldTriggerPivot()` (`lib/pivot-logic.ts:62-96`) dispara se **qualquer** condição for verdadeira:
1. `questionCounter >= 15`
2. Algum tema com contagem `>= 3` na janela
3. `uniqueThemes < 4` (avaliado **apenas** quando a janela está cheia, `history.length >= 5`)

> 🟡 O README afirma "Mandatory pivot: every 10 questions" — o código usa **15**. Além disso, `isMandatoryPivot` está **hardcoded `false`** no servidor (`app/api/dna/chat/route.ts:88`), então o "pivô obrigatório" documentado não existe nessa camada.
>
> 🔴 **Na prática só a condição 1 dispara.** `themes_extracted` **não existe** no schema de function calling (`lib/dna/extraction/extraction-tool-schema.ts`) e um teste **exige a ausência** (`extraction-tool-schema.test.ts:19-24`). Logo `hqExtractionHistory` nunca recebe temas e as condições de repetição/diversidade são sempre falsas. Ver §4.14.
>
> Detalhe de implementação: `updateTracker` **sempre zera** `pivotFlag`; o chamador recalcula via `shouldTriggerPivot` e persiste o valor para o próximo turno (`lib/pivot-logic.ts:104-109,158`).

### 4.7 Arquitetura dual-agent (YAN + MEMLISTENER) 🟢

`POST /api/dna/chat` (`app/api/dna/chat/route.ts`):

| Agente | Papel | Modelo | Config |
|---|---|---|---|
| **YAN** | Resposta socrática (bloqueante — o usuário espera) | `gemini-3.1-pro-preview` | system instruction `SYSTEM_PROMPT` + directive do capítulo; histórico últimas **15** mensagens |
| **MEMLISTENER** | Extração psicológica (background, via `after()`) | `gemini-2.5-pro` | `temperature: 0.1`, `tools: [EXTRACTION_TOOL]` (function calling); histórico últimas **7** mensagens |

- A extração **roda em background** (`after(backgroundTask)`) — o cliente recebe apenas `{ aiData: { coach_reply, extractions: null }, selectedQuestions: [...] }` e o perfil é atualizado de forma assíncrona no servidor.
- **Regra de segurança:** a extração **não roda** quando: sessão encerrada, comando de skip, "Pick up where I left off" ou "Start something new" (`shouldExtract`, `:260`).
- **Blacklist de perguntas:** as últimas **6** perguntas são injetadas como "Prior AI Question" (`:42-45`).
- Histórico YAN truncado em **15** mensagens; extração usa **7** (`:212,219`).

> 🟡 O README (e `AUDIT_EXECUTIVE_SUMMARY.md`) descrevem a extração como sequencial/`Promise.all` e escrita no **cliente** (`hooks/use-chat.ts`) — o código atual moveu a escrita para o servidor em background. A auditoria está desatualizada.
>
> 🟡 **A persona se chama "The Coach", não "YAN"** (`lib/prompts.ts:23`). "YAN" só existe em comentário/JSDoc da rota.
>
> 🔴 **Sem streaming:** o YAN responde de forma bloqueante e o estado `streamingContent` **nunca é populado** (`hooks/use-chat.ts:135,406,711`), então o `StreamingBubble` é inalcançável. A UI usa `AiThinkingBlock` + `TypingIndicator` + textos rotativos de `lib/loading-texts.ts`.
>
> 🔴 **`emotional_baseline` e `intellectual_framework` NÃO são persistidos pela rota de chat** (`app/api/dna/chat/route.ts:279-297`), embora estejam no schema. Eles só são gravados por `/api/dna/baseline` e `/api/dna/transcribe/history`.

### 4.8 Comandos e overrides de conversa 🟢

Detectados por texto exato no `/api/dna/chat` (`:87-120`):

| Gatilho (texto) | Comportamento |
|---|---|
| `"Please help me ground myself and close the session."` | **Grounding protocol:** cessa toda extração, valida o esforço, conduz exercício sensorial (5-4-3-2-1) e encerra com segurança |
| `"Pass"` / `"Change the subject, next question"` | Pula a pergunta e muda de assunto (extração suprimida) |
| `"Pick up where I left off"` | Retoma sessão (extração suprimida) |
| `"Start something new"` | Inicia nova sessão (extração suprimida) |
| Input com `< 15` caracteres | Instiga profundidade, não aceita resposta curta |

### 4.9 Prompt de sistema (YAN) — regras de comportamento 🟢

`SYSTEM_PROMPT` (`lib/prompts.ts:21-62`). Regras de negócio embutidas no prompt:

1. **Responder no mesmo idioma do input do usuário.**
2. **Fluidez psicológica:** conversa natural, não repetir a resposta do usuário.
3. **Zero repetição & pivô:** nunca repetir pergunta; se o usuário for vago, não insistir — pivotar.
4. **Momento sobre minúcias.**
5. **Expor contradições** — desafiar racionalizações.
6. **O narrador não confiável:** detectar omissões/mentiras e perguntar de forma cirúrgica sem acusar.
7. **Âncora somática:** forçar o usuário a reviver sensorialmente a memória.
8. **Válvula de segurança:** se ficar pesado, oferecer saída e priorizar bem-estar.
9. **Linguagem acessível:** sem vocabulário acadêmico/pretensioso.
10. **Só perguntas:** não dar conselhos, validações ou interpretações; "não repetir/parafrasear" é regra dura.

Seções/rotas psicológicas (`SECTION_PROMPTS`, `lib/prompts.ts:69+`) definem por capítulo um `TARGET`, um `PSYCHOLOGICAL PROBE` e um `CONTRADICTION CHECK`.

### 4.10 Schema de extração (MEMLISTENER) 🟢

Function calling `update_master_profile` via `EXTRACTION_TOOL` (`lib/dna/extraction/extraction-tool-schema.ts`). Campos de `ExtractedPsychData` (`lib/chat-types.ts:370-399`):

| Campo | Tipo | Destino no Master Profile |
|---|---|---|
| `is_valuable_extraction` | boolean | — (triagem) |
| `new_traits` | string[] | `psychology.traits` |
| `themes_extracted` | string[] | marcador de diversidade |
| `defense_mechanisms` | string[] | `psychology.defenseMechanisms` |
| `leaf_snippets` | string[] | `psychology.leafSnippets` (com `section`+`timestamp`) |
| `holistic_analysis` | string | `psychology.analysisTimeline` |
| `somatic_tells` | string[] | `physicality.somaticTells` |
| `core_values` | string[] | `psychology.coreValues` |
| `relational_dynamics` | string[] | `psychology.relationalDynamics` |
| `milestones` | `{event, emotional_cost}[]` | `history.milestones` (com contexto) |
| `core_wounds_and_fears` | string[] | `acting_fuel.coreWounds` |
| `unmet_needs` | string[] | `acting_fuel.unmetNeeds` |
| `public_masks` | string[] | `acting_fuel.publicMasks` |
| `archetype_signals` | string[] | `acting_fuel.archetypes` |
| `key_entities_and_arenas` | string[] | `history.keyEntities` |
| `emotional_baseline` | `{conflict_response, internal_friction, vulnerability_management}` | `psychology.emotionalBaseline` |
| `intellectual_framework` | `{cognitive_style, attention_to_detail}` | `psychology.intellectualFramework` |
| `progress_assessment` | `{has_actionable_pattern, depth_score}` | gate de qualidade (≥ 4) |

**Regra de escrita:** todas as gravações usam `FieldValue.arrayUnion(...)` em `users/{userPath}/profile/master` — ou seja, extrações são **acumulativas e deduplicadas por valor** (nunca removem).

### 4.11 Síntese do Master Profile — 🔴 quebrada em produção

**Intenção:** `POST /api/dna/synthesize` transforma as extrações cruas no **UAP (Unique Actor Profile)** — o Master Profile canônico descrito em `SYNTHESIZER_PROMPT` (`lib/prompts.ts:628-671`) — usando `gemini-2.5-flash`, `responseMimeType: application/json`, `temperature 0.3`.

**Formato de saída declarado (UAP):**

```
actor_summary                       (string, ~3 frases)
ai_coaching_manual { communication_style, resistance_markers, breakthrough_tactics }
emotional_transference_map { core_driver, usable_triggers[3-4], emotional_dead_zones[] }
relationship_blueprints { handling_authority, handling_intimacy, handling_conflict }
physical_instrument { default_armor, involuntary_tells[] }
performance_traps[]                 (3 avisos)
```

> 🔴 **A rota nunca funciona.** Ela lê `users/{userPath}/dnaVault` (`synthesize/route.ts:44`), mas **nenhum arquivo de produção escreve nessa subcoleção** — só há leitores/deletores (`synthesize/route.ts:44`, `dna-vault/page.tsx:78-93`, `settings/page.tsx:335-336`). Portanto a rota sempre retorna **400 `"No DNA extractions found. Complete a session first."`** antes mesmo da checagem de cache.
>
> O único caller, `components/auditions/audition-wizard.tsx:309-318`, faz `await dnaResponse.json()` **sem checar `response.ok`** — a falha é silenciosa e o breakdown segue usando o `profile/master` cru (que é o que `analyzeSides` realmente lê: `app/api/auditions/analyzeSides/route.ts:179-187`).
>
> **Consequência de arquitetura:** o `/dna-vault` não mostra o UAP; ele faz *parse* direto do `profile/master` bruto via `lib/dna/dna-parser.ts:49`. O campo `profile` (UAP) até sabe ser lido (`dna-parser.ts:216-230`), mas não é produzido pelo app.
>
> 🟡 O contrato do prompt também está inconsistente: ele declara receber `instrument_dna`, `behaviours`, `themes`, mas o payload compilado usa `psychology.*`, `acting_fuel.*`, `history.*`, `physicality.*`.

**Schema real do `profile/master` (o que o app de fato grava):**

```ts
{
  psychology: {
    traits: string[]
    defenseMechanisms: string[]
    leafSnippets: Array<{ quote, section, timestamp }>
    coreValues: string[]
    relationalDynamics: string[]
    emotionalBaseline: { conflictResponse, internalFriction, vulnerabilityManagement }
    intellectualFramework: { cognitiveStyle, attentionToDetail }
  }
  acting_fuel: {
    coreWounds: string[]
    unmetNeeds: string[]
    publicMasks: string[]
    archetypes: string[]
  }
  history: {
    milestones: Array<{ event, emotional_cost }>
    keyEntities: string[]
  }
  physicality: { somaticTells: string[] }
  baselineHistory: string
  lastUpdated: Timestamp
}
```

> ⚠️ **Atenção ao formato real das chaves:** o código grava com **camelCase** (`psychology.defenseMechanisms`, `acting_fuel.coreWounds` — `dna/chat/route.ts:279-297`), enquanto o README documenta `defense_mechanisms`/`core_wounds` (snake). O camelCase é a fonte de verdade para o Firestore.

### 4.12 Baseline documental (upload em massa) 🟢

`POST /api/dna/baseline` (multipart: `file` ou `text`).

| Regra | Valor |
|---|---|
| MIME aceitos | `application/pdf`, `text/plain`, `application/msword`, `…wordprocessingml.document` |
| Fallback por extensão | `.doc` / `.docx` aceitos mesmo sem MIME correto |
| Erro de tipo | 400 `"Unsupported file type. Please upload PDF, TXT, or DOCX."` |
| Conteúdo mínimo | `trim().length < 50` → 400 `"Content too short for AI analysis."` |
| Sem arquivo nem texto | 400 `"No content provided"` |
| Timeout do PDF | 60s via `Promise.race` |
| Chunking | ❌ **Não existe** — o conteúdo inteiro vai em uma única chamada |

**Parsing:** PDF via `pdf2json` (`PDFParser` + `getRawTextContent()`), DOCX via `mammoth.extractRawText`, TXT via `file.text()`.

**Extração em lote (`BULK_SYSTEM_PROMPT`):** modelo `gemini-2.5-pro`, `temperature 0.2`, `thinkingLevel: "MEDIUM"`. Instrui a ser "aggressive and comprehensive", ler nas entrelinhas e **não inventar** dados ausentes. O schema inline é uma **cópia** do canônico **mais** `baseline_summary` ("cohesive, highly dense 2-to-3 paragraph psychological summary… AI Coach's core memory").

**Persistência:** `baselineHistory` (texto integral), `baselineSummary`, `lastUpdated` e `arrayUnion` em `psychology.*`, `history.milestones` (com `section: "baseline_upload"`), `acting_fuel.*`, **`psychology.emotionalBaseline.*`** e `history.keyEntities`. Retorna `{ success, message, extractionsCount }`.

> 🟡 O modal de UI reaproveita o `StepUpload` das audições, cujo `accept` difere da rota (a rota aceita `.doc/.docx`; `chat-input.tsx:303` lista `.pdf,.txt,.doc,.docx,.rtf,.md,.markdown`).

### 4.13 Voz / transcrição 🟢

Dois caminhos, ambos client-side (`MediaRecorder` + base64, sem streaming):

| Rota | Modelo | Regra | Persistência |
|---|---|---|---|
| `POST /api/dna/transcribe/chat` | `gemini-2.5-flash`, temp 0.1 | Rejeita texto < 2 chars; prompt "Transcribe this audio exactly as spoken… Return only the raw text." | nenhuma (preenche o textarea) |
| `POST /api/dna/transcribe/history` ("Capture a Memory") | `gemini-2.5-flash` (transcrição) + `gemini-2.5-pro`, temp 0.1, `thinkingLevel: "HIGH"` (extração) | Rejeita texto < 5 chars | `rawMemories` (`arrayUnion {text, timestamp}`) + dot-paths do chat **incluindo** `emotional_baseline` e `intellectual_framework` |

### 4.14 🔴 Lacunas críticas do motor de DNA (leia antes de mexer)

| # | Problema | Efeito no produto | Evidência |
|---|---|---|---|
| 1 | `dnaVault` nunca é escrito | Síntese sempre 400; UAP nunca gerado; erro silencioso no wizard | `synthesize/route.ts:44` (sem writer) |
| 2 | Rota devolve `extractions: null` | Progresso fixo em 25%, `completedSections` vazio, `auditionsUnlocked` nunca liga | `chat/route.ts:319-325`; `use-chat.ts:569-641,677` |
| 3 | `themes_extracted` fora do schema (teste exige ausência) | Motor de diversidade/pivô cego — só conta 15 perguntas | `extraction-tool-schema.ts`; `extraction-tool-schema.test.ts:19-24` |
| 4 | UI envia `chapter_*`, não arena | 12 `SECTION_PROMPTS` de arena são código morto | `chat/page.tsx:42`; `chat/route.ts:40` |
| 5 | `emotional_baseline`/`intellectual_framework` não persistidos no chat | Dados extraídos são descartados silenciosamente | `chat/route.ts:279-297` |
| 6 | `meetsThemeRequirement` calculado e ignorado | Conclusão de seção não exige diversidade | `use-chat.ts:596-602` |
| 7 | `isMandatoryPivot = false` hardcoded | "Pivô obrigatório" não existe no servidor | `chat/route.ts:88` |
| 8 | Sem streaming | `streamingContent`/`StreamingBubble` inalcançáveis | `use-chat.ts:135,406,711` |
| 9 | Órfãos: `lib/questions.ts` (chaves ≠ `DNA_SECTIONS`), `response-shortcuts.ts`, `run-extraction.ts` (só testes) | Manutenção enganosa | — |
| 10 | Schema de tool duplicado 3× (baseline, transcribe/history, coach/updateDna) | Risco de drift entre cópias | `baseline/route.ts:160-279`; `transcribe/history/route.ts:99-219` |

> 💡 **Resumo prático:** hoje o DNA funciona como **acúmulo de extrações no `profile/master` via worker de background**. A camada de "progresso/gamificação" e a camada de "síntese em UAP" **não estão operacionais**.

---

## 5. Audições — breakdown e sides

### 5.1 Tipos e projeto 🟢

| Dimensão | Valores | Default |
|---|---|---|
| `projectType` | `cinematic`, `theater`, `commercial` | `cinematic` |
| `breakdownDepth` | `complete`, `quick` | `complete` |
| `analysisType` | `sides`, `brief` | — |
| `status` | texto livre | `""` |

### 5.2 Validação do formulário (Zod) 🟢

`lib/schemas/audition.ts`:

| Campo | Regra |
|---|---|
| `project` | máx. **150** caracteres, `trim()` |
| `role` | máx. **100** caracteres, `trim()` |
| `actorName` | máx. 200, default `"Actor"` |
| `deadline` | máx. 50 |
| `castingDirectorName` | máx. 150 |
| `previousTake` | máx. **5000** |
| `criticalBriefFactsPayload` | máx. **10000** (JSON serializado) |
| `sidesFile` / `briefFile` | máx. **20MB**; só `application/pdf` ou `.docx` |

> 🟢 Regra de arquivo: apenas **PDF e Word (.docx)** são aceitos; a checagem combina MIME type **e** extensão (`.docx` passa mesmo sem MIME correto).

### 5.3 Dois wizards distintos 🟢

| Wizard | Rota | `mode` | Objetivo |
|---|---|---|---|
| **Casting Brief Breakdown** | `/auditions/new/brief` | `brief` | Transformar e-mail/PDF de casting em checklist cronológico + fatos críticos |
| **Character Breakdown / Scene Study** | `/auditions/new/sides` | `sides` | Decupagem das falas em Performance Map (com lente do DNA) |

Ambos renderizam `<AuditionWizard mode={...} auditionId={searchParams.enrichAuditionId} />`.
O parâmetro `?enrichAuditionId=` significa "refazer/enriquecer" uma audição existente; nesse modo o wizard preserva o resultado anterior e permite alternar para o outro modo via `router.push('/auditions/new/${otherMode}?enrichAuditionId=${id}')` (`audition-wizard.tsx:665`).

### 5.4 Modelo de resultado — Performance Map 🟢

```ts
interface PerformanceMap {
  intro?: string;
  sections: { title: string; items: string[] }[];
  outro?: string;
}
interface CriticalBriefFact { label: string; value: string; importance: "critical" | "important" }
interface BriefAnalysisResult extends PerformanceMap { criticalBriefFacts?: CriticalBriefFact[] }
```

`AuditionDocument` persiste (`lib/audition-types.ts:35-52`): `project`, `role`, `deadline`, `auditionTimezone`, `actorLocalDeadline`, `castingDirectorName`, `breakdownDepth`, `performanceMap`, `sidesPerformanceMap`, `briefPerformanceMap`, `criticalBriefFacts`, `hasSides`, `hasBrief`, `analysisType`, `createdAt`, `status`.

### 5.5 Passos do wizard e pré-requisitos 🟢

`AuditionWizard` (`components/auditions/audition-wizard.tsx:54`) serve os dois modos **e** o modo enrichment (`?enrichAuditionId=`).

| Passo | Título | Componente | Valida |
|---|---|---|---|
| 1 | Basics | `step-basic.tsx` | nada bloqueante |
| 2 | Upload (Sides ou Brief) | `step-upload.tsx` | **só o tipo** de arquivo (PDF/`.docx`) no cliente |
| 3 | Review & Generate | `step-review.tsx` | resumo; botão desabilitado até `canGenerate` |
| 4 | Generating → Result | inline em `audition-wizard.tsx:757-880` | spinner → `StepResultSides`/`StepResultBrief` |

- O `Stepper` mostra **3** passos (Basics / Upload / Review) e some a partir do passo 4.
- `handleNext` faz `Math.min(prev+1, 4)` → 🔴 **o passo 5 (`generating`) nunca é alcançado** e `components/auditions/step/step-generating.tsx` está **vazio (0 bytes)**.
- **Pré-requisitos únicos** (`findMissingPrerequisite`, `:154-184`): `project` não vazio → `role` não vazio → (sides) `sidesText` ou `sidesFile` → (brief) `briefText` ou `briefFile`.
- Módulos `deadline` / `auditionTimezone` / `castingDirectorName` só aparecem no **modo brief** (`step-basic.tsx:156,210`).

> 🔴 **`sidesText` nunca é persistido.** `newAuditionDoc()` e `buildMergeUpdate()` (`audition-wizard.tsx:446-463,470-494`) **não incluem `sidesText`** — apesar de `AuditionDocument` não declará-lo e de o valor existir no formulário. Cadeia quebrada: `/reader-copilot/[id]` sempre falha, `parse-script` não acha texto, a seção "EXACT SIDES TEXT" do Character Coach fica vazia e o `RehearsalRunner` do Stage 9 fica sem falas.
>
> 🔴 O cliente **não valida os 20MB** — só o servidor. Um arquivo de 300MB é aceito na UI.
>
> 🟡 O campo `actorTimezone` é enviado pelo wizard (`:331`) mas **não existe no `lib/schemas/audition.ts`** → o Zod descarta silenciosamente.
>
> 🟡 O botão "Delete" na tela de resultado (`audition-wizard.tsx:142-147`) só limpa o estado local — **não apaga nada no Firestore**.

### 5.6 Análise por IA — `analyzeSides` × `analyzeBrief` 🟢

| Dimensão | `POST /api/auditions/analyzeSides` | `POST /api/auditions/analyzeBrief` |
|---|---|---|
| System prompt | `getAuditionCoachPrompt(isStandalone, projectType, breakdownDepth)` | `BRIEF_ANALYSIS_PROMPT` + sub-prompt por categoria |
| Sub-prompts | `COMMERCIAL_MODE_PROMPT`, `THEATHER_MODE_PROMPT` | `BRIEF_CINEMATIC_PROMPT`, `BRIEF_THEATER_PROMPT`, `BRIEF_COMMERCIAL_PROMPT` |
| Modelo | `gemini-3.1-pro-preview` (Vertex `global`) | idem |
| Saída | `application/json` + `responseSchema` → `{ intro, sections[], outro, criticalBriefFacts? }` | idem |
| Timeout de PDF | **80s** | **60s** |
| Arquivo do outro tipo | aceita e ignora `briefFile` | **rejeita** `sidesFile` com 400 |
| `breakdownDepth` | usado no prompt | **ignorado** |

**Regras de negócio embutidas nos prompts:**
- **O DNA é a lente canônica:** `"You MUST use this profile as the psychological lens for your entire breakdown. Do not just tack it on at the end."`
- **Contrato "LOCKED" de 21 seções** no modo cinematic completo (ordem exata, Objective com 4 regras duras, Tactics com verbos ativos, "NO therapy", "BEHAVIOR OVER EMOTION", `MULTI-SCENE AWARENESS`, fallback obrigatório `"N/A - Only one scene provided."`).
- **Comercial** → exatamente **6** seções, brevidade de 1–2 frases. **Theater** → 5 pilares. **Quick cinematic** → 6 seções fixas.
- **Alternative Take:** quando `previousTake` existe, o prompt manda **inverter** a direção criativa (emoção↔frieza, táticas/monólogo interno/bold choice opostos) sem dizer isso no output. O take anterior é salvo como doc `"{project} V1"`. **Só existe no modo `sides`.**
- **Critical Brief Facts:** canal estruturado e **não truncado**. O brief os produz → o wizard serializa em `criticalBriefFactsPayload` → o prompt das sides os marca como *"non-negotiable… honored verbatim"* e exige eco na saída. Parser tolerante descarta payload malformado sem falhar.
- **Brief → Sides:** no modo brief o prompt recebe `<prior_sides_analysis>` para casar psicologia macro com ação imediata; **o Brief nunca sobrepõe o texto dos sides**.

**Fluxo de auth/posse (ambos):** Bearer obrigatório (401) → validação Zod (400 com `details`) → **checagem de posse** `userPath.startsWith(\`${uid}_\`)` senão **403 + log "SECURITY ALERT"** → parsing → leitura do DNA → inferência → `JSON.parse` (malformado → 502).

> 🔴 `app/api/auditions/analyzeBrief/routeBrief.ts` (285 linhas) é uma cópia **byte-a-byte** de `route.ts`, sem nenhum importador. O Next.js só registra `route.ts` — `routeBrief.ts` **nunca executa**. É código morto puro.
>
> 🟡 Ambas as rotas fazem `JSON.stringify(profileData)` do doc **inteiro** de `profile/master` (incluindo `status`, `dataPointsAnalyzed`) sem truncamento — infla tokens e vaza metadados internos.

### 5.7 Ciclo de vida, dedupe e status 🟡

- Lista em `/auditions` ("Audition Tracker") lê `users/{userPath}/auditions` ordenado por `createdAt desc`.
- Detalhe em `/auditions/[id]`; impressão em `/auditions/[id]?action=print`.
- Ações: abrir Reader Copilot, refazer brief/sides, abrir Acting Coach no contexto, imprimir.
- **Dedupe:** `findDuplicateId` roda `where(project == p) + where(role == r) + where(analysisType == mode)`; se houver duplicata, abre `AlertDialog` com 3 caminhos: cancelar · criar mesmo assim · enriquecer existente.
- **Status:** o wizard grava **sempre `status: "completed"`**; o modal de edição permite `"draft"`/`"processing"`/`"completed"` em minúsculas. 🔴 **`"processing"` nunca é escrito por código** e não há autosave/rascunho.

> 🔴 **Não existe `firestore.indexes.json`** no repositório, embora a query de dedupe exija um índice composto (`project + role + analysisType`). Sem ele, o Firestore erra, o código loga `warn` e segue silenciosamente para `addDoc` — o dedupe simplesmente não funciona.
>
> 🟡 Reader Copilot lista até **15** audições com `sidesText` — mas, por causa do bug acima, esse filtro tende a retornar vazio para audições criadas pelo wizard.

---

## 6. Acting Coach

### 6.1 Dois modos 🟢

| Modo | Quando | `coachType` | Contexto injetado |
|---|---|---|---|
| **General** | Sem `?auditionId=` | `"general"` | Baseline do ator + lista de audições |
| **Character Coach** | Com `?auditionId=` | `"character"` | O acima + breakdown completo da audição |

`isCharacterCoach = session?.coachType === "character" || Boolean(auditionId)` (`acting-coach/page.tsx:75`).

### 6.2 Duas personas 🟢

| Persona | Prompt | Características |
|---|---|---|
| **General Coach** ("24/7 General Coach") | `ACTING_COACH_SYSTEM_PROMPT` (`lib/prompts.ts:1282-1420`) | Um passo por turno, ≤ ~60 palavras no modo `guided`, no máximo 1 pergunta. Lê pushback como informação. **BOUNDARIES:** não faz terapia, não especula estado psicológico, **nunca nomeia/atribui conselhos a practitioners**, **nunca emite marcadores de citação `[1]`**; recomenda o Character Coach para pedidos específicos de papel. |
| **Character Coach** ("Role Focus") | `CHARACTER_COACH_SYSTEM_PROMPT` (`lib/prompts.ts:1427-1473`) | Persona **"Tracey Collis"**, inglês britânico, sem em-dash/hype. 4 core rules: nunca repetir o breakdown, ajudar o ator a **descobrir** (não prescrever), turnos de 50–150 palavras, **diálogo verbatim** dos sides. Hierarquia de fontes: `Sides > Brief > Breakdown > DNA > escolhas da sessão > craft geral`. Sign-off obrigatório `"You are cleared for takeoff."` |

A escolha é resolvida no servidor: `coachType || (auditionId ? "character" : "general")` (`coach/chat/route.ts:117`).

### 6.3 Regras de composição do prompt 🟢

Ordem das seções (`buildCoachPrompt`, `lib/acting-coach/build-coach-prompt.ts:12-207`):

```
persona
# CURRENT ACTOR
# ACTOR DNA & PSYCHOLOGY            (profile/master)
# ACTOR PUBLIC PROFILE              (actorProfiles/{uid})
# CURRENT SESSION FOCUS & STAGE STATE
# CRITICAL BRIEF FACTS              (só com label+value)
# EXACT SIDES TEXT                  (fonte de verdade do diálogo — ver bug do sidesText)
# breakdown ativo                   (sides + brief, ou só um, ou legado)
# ACTOR'S AUDITIONS                 ("- {project} — {role} ({id})")
# METHODOLOGY REFERENCE MATERIAL  ou  # NO REFERENCE MATERIAL
# CONVERSATION LOG                  ("Actor:" / "Coach:")
# ACTOR'S CURRENT REQUEST
```

**Regras de negócio do coach:**
- Limite de histórico: `MAX_HISTORY_MESSAGES = 20` (`coach/chat/route.ts:8,102`) — o cliente envia tudo, o servidor corta.
- Modos de resposta: `guided` (≤ 60 palavras, um passo por turno), `informational` (factual), `transition` (pivô de tópico).
- **Resposta estruturada sem `responseSchema`:** o modelo devolve um envelope JSON (`coach_reply`, `session_focus`, `step_index`, `mode`, `phase`, `current_stage`, `completed_stages`, `flight_plan_mode`, `audition_plan`, `action`, `extractions`); o texto é limpo de cercas ```` ```json ```` e parseado; falha → `{ reply: rawText }` (fallback defensivo). Campos ausentes caem para o `currentFocus` anterior.
- O coach **lê** audições mas **nunca escreve** nelas (só em `profile/master` via ação e em `actorProfiles/{uid}` via allowlist).

> 🔴 **O RAG é código morto em runtime.** `app/api/coach/chat/route.ts:124` passa `excerpts: []` **sempre**. Toda a infraestrutura (`load-corpus-documents`, `chunk-acting-text` com 800/100, `config`, `create-generation-model`, `COACH_REPLY_SCHEMA`, `components/acting-coach-citations.tsx`) só é exercitada por testes. Como a lista é vazia, o prompt injeta `"# NO REFERENCE MATERIAL … Do not invent source books, quotes, citation numbers, or library references."` → **não há grounding externo nem citações**; as respostas vêm de conhecimento geral + contexto do ator/audição.
>
> 🔴 O modelo é **hardcoded** `gemini-3.1-pro-preview` (`:137`), ignorando `ACTING_COACH_GENERATION_MODEL`/`getActingCoachConfig()`. A variável documentada no README **não tem efeito**.
>
> 🟡 `COACH_REPLY_SCHEMA` existe mas nunca é passado como `responseSchema` — daí o parse manual e frágil.
>
> 🟡 `components/acting-coach-citations.tsx` e `components/coach-suggestion-chips.tsx` **não são importados por ninguém** (o README ainda lista o segundo como arquivo-chave).

### 6.4 Flight Plan (10 estágios) e Audition Plan 🟢

- **Estágios** (`components/acting-coach/flight-plan.tsx:15-26`): 1 Orientate · 2 Relationship · 3 Want/Stakes · 4 Actions/Beats · 5 Subtext · 6 Personal DNA · 7 Strong Choices · 8 To Camera · 9 Ground & Run · 10 Takeoff.
- Barra mostra estágio ativo, badge `Guided Flow` vs `Direct Stage`, e menu com check dos concluídos. O botão **"Run Scene Now" só aparece no estágio 9**.
- `selectStage` grava `{ currentStage, flightPlanMode: "menu", sessionFocus: "Stage N" }` e a página envia `"Let's jump to Stage N."` com `targetStage` (sanitizado para inteiro 1..10 no servidor).
- Estado inicial da sessão: `currentStage: 1`, `completedStages: []`, `flightPlanMode: "guided"`.
- **`AuditionPlanData`** = 13 campos (`before_scene`, `relationship`, `want`, `stakes`, `obstacle`, `primary_action`, `shift`, `private_thought`, `contradiction`, `first_five_seconds`, `grounding`, `final_instruction`, `sign_off`), renderizado por `AuditionPlanCard` com botão de copiar.
- O **`RehearsalRunner` do Stage 9** é um runner textual (regex `parseSidesToLines`, sem TTS) e depende de `session.sidesText` — que hoje chega vazio (ver §5.5).

### 6.5 Foco flutuante (floating focus) 🟢

`CoachSession` rastreia o exercício em andamento: `sessionFocus` (descrição), `stepIndex` (incrementado pelo modelo), `mode`, `phase`. A UI mostra "Currently working on: {sessionFocus}" com toque para limpar.

Campos adicionais (`lib/chat-types.ts:47-65`): `coachType`, `currentStage`, `completedStages`, `flightPlanMode`, `auditionPlan`, `sidesText`, `linkedAuditionId`, `messageCount`, `status`.

**Persistência por turno** (`hooks/use-acting-coach.ts:153-332`): grava a mensagem do usuário, chama a API, grava a do assistente e faz `updateDoc` da sessão (`lastActiveAt`, `messageCount: increment(1)`, foco, estágios, `auditionPlan`, `sidesText`).

### 6.6 Atualização do DNA — dois caminhos concorrentes 🟡

| Caminho | Gatilho | Modelo | Destino | Campos |
|---|---|---|---|---|
| **A. Inline (novo)** | `action.type === "trigger_dna_extraction"` + gate `depth_score >= 4` | o mesmo do chat | `users/{userPath}/profile/master` | `psychology.traits`, `psychology.coreValues`, `physicality.somaticTells` (`arrayUnion`) |
| **B. Endpoint (legado)** `POST /api/coach/updateDna` | botão "Update DNA" do `ChatInput`, com as últimas **15** mensagens | `gemini-2.5-pro` + `thinkingLevel MEDIUM` + function calling | `profile/master` **e** `users/{userPath}/sessions/{sessionId}` | `psychology.*` (traits, defenseMechanisms, coreValues, relationalDynamics), `acting_fuel.*`, `history.keyEntities` |

> 🔴 O caminho B grava em `users/{userPath}/sessions/{sessionId}` — **coleção órfã**: nem `dnaSessions` (DNA) nem `coachSessions` (coach). Nenhum leitor usa `sessions/`.
>
> 🟡 Os dois caminhos têm filosofias opostas sobre o mesmo dado: o prompt do coach proíbe terapia; o do `updateDna` proíbe terminologia de atuação.
>
> 🟡 A ação `update_actor_profile` escreve em `actorProfiles/{uid}` com **allowlist** `COACH_WRITABLE_FIELDS` (array replace semantics obrigatório).

### 6.7 Timer de sessão e time tracking — ⚠️ pertencem ao `/chat`, não ao coach

| Hook | Onde é usado de fato | Regras |
|---|---|---|
| `hooks/use-session-timer.ts` | **apenas** `/chat` (DNA) | `DEFAULT_BREAK_INTERVAL_MS = 15 min` → abre `BreakCheckInModal`; sem limite/bloqueio/persistência |
| `hooks/use-chat-time-tracker.ts` | **apenas** `/chat` (DNA) | Acumula segundos só com a aba visível; backup em `localStorage` a cada 5s; flush atômico a cada 60s, em `visibilitychange→hidden`, `beforeunload` e unmount; grava `totalChatSeconds: increment(delta)` em `profile/master`. **Sem teto** |

> ⚠️ O Acting Coach **não tem** timer, break reminder nem contabilização de tempo. O README não documenta nenhum dos dois hooks.

---

## 7. Perfil do ator e perfil público

### 7.1 Dois documentos diferentes 🟢

| Documento | Caminho | Uso |
|---|---|---|
| Perfil do ator (fonte) | `actorProfiles/{uid}` | Base para edição e para gerar o perfil público |
| Master Profile (DNA) | `users/{userPath}/profile/master` | Lente psicológica usada pela IA (não é o perfil profissional) |

O perfil público é lido de `actorProfiles` filtrando `slug == slug` **e** `status == "published"` (`lib/get-public-profile.ts:12-17`).

### 7.2 Status e publicação 🟡

```ts
status: "draft" | "published"
```

- Auto-save com **debounce de 2s** (`profile/page.tsx:164-177`), respeitando `initialLoadDone` para não salvar no `reset()` inicial; alterar `fullName` regenera o **slug** automaticamente.
- `publishProfile()` grava `status: "published"` + `publishedAt` (revert para `"draft"` em erro); salvar usa `setDoc(..., { merge: true })` → nunca destrói campos não enviados.
- **Slug:** `generateSlug(fullName)` (`lib/profile-types.ts:235-242`) — minúsculas, remove não-alfanuméricos, espaços → `-`, colapsa hífens.
- URL pública: `theactorscopilot.com/actors/{slug}`.

> 🔴 **A validação Zod é decorativa.** `app/(interior)/profile/page.tsx:46` instala `zodResolver(actorProfileSchema)`, mas **`handleSubmit` nunca é chamado** — `saveDraft` (`:65`) e `publishProfile` (`:213`) persistem `methods.getValues()` cru. Portanto `fullName.min(1)` e `bio.max(500)` **não são aplicados na gravação**; só o `maxLength` do DOM limita a bio. URLs, e-mails, contagens e tamanhos ficam irrestritos. Os asteriscos de "obrigatório" do README **não têm efeito**.
>
> 🔴 **Slug sem unicidade:** não há verificação de colisão no save e a consulta pública usa `.limit(1)` → dois atores com o mesmo nome colidem e um "rouba" a URL do outro, de forma arbitrária.
>
> 🟡 `getPublicProfile` retorna `as ActorProfile` **sem validação** — um documento parcial derruba a página pública (`profile.additionalPhotos.length` etc.).
>
> 🟡 `playingAgeMin/Max` usam `valueAsNumber`: limpar o campo pode gravar `NaN`. `timezone` não tem UI nem exibição (só entra pelo autofill).

### 7.3 Schema `ActorProfile` (`lib/profile-types.ts`) 🟢

| Grupo | Campos | Regras |
|---|---|---|
| Meta | `slug`, `status` | `status` ∈ `draft`/`published` |
| Fotos | `headshot` (nullable), `additionalPhotos[]` | headshot máx. **5MB**; até **10** fotos adicionais |
| Básico | `fullName` (**obrigatório**, min 1), `playingAgeMin/Max` (nullable), `location`, `timezone`, `gender` | HTML `min/max` 1–100 |
| Físico | `height`, `heightUnit` (`imperial`/`metric`), `eyeColour`, `hairColour`, `nationalities[]`, `workPermits[]`, `ethnicity`, `appearance[]` | `workPermits` ∈ `UK`, `EU`, `US`, `South Africa`, `Other` |
| Sobre | `awardsCallout`, `bio` | `bio` máx. **500** caracteres |
| Representação | `agents[]` (`agencyName`, `agencyEmail`, `agencyWebsite`, `agencyPhone`), `agencyName?`, `agencyEmail?`, `agencyWebsite?`, `agencyPhone?`, `showContactPublicly` | `normalizeAgents()` migra os campos legados de agência única para `agents[]` |
| Showreels | `showreels[]` `{ title, url, thumbnailUrl? }` | sem limite |
| Créditos | `credits[]` `{ category, title, role, year, productionCompany, featured }` | `category` ∈ `television`, `feature_film`, `stage`, `commercial`, `further` |
| Formação | `training[]` `{ category, institution, qualification, years }` | reusa as mesmas categorias (semanticamente estranho) |
| Perfis externos | `externalProfiles` com **23** campos | IMDb, Spotlight, Actors Access, Backstage, Casting Networks, Filmmakers Europe, e-TALENTA, Nawak, Casting URL, Castforward, Showcast, Casting Networks AU, Talentrack, Dazzlerr, Filmo, Elenco Digital, Alternativa Teatral, Casting Networks SA, Star Quality, Personal Website, Instagram, LinkedIn, Facebook |
| Skills | `skillsAndAccents[]` | chips, sem campo separado de accents |
| CV | `cvUrl`, `cvFilename` | PDF, máx. **100MB** |

**Editor em 11 seções** (`components/profile/actor-profile-form.tsx:42-85`): Photos · Basic Info · Physical & Professional · About Me · Agent/Representation · Showreels · Credits · Training · External Profiles · Skills & Accents · CV Upload. Coluna direita: `ImdbAutofill` + `ProfileLivePreview`.

> 🟡 O README afirma "21 platform URLs" e não menciona `agents[]`, `timezone` nem `thumbnailUrl` — está desatualizado. O código tem **23** campos.
>
> 🟡 `workPermits` é `string[]` livre no Zod (as opções são da UI).
>
> 🟡 `eyeColour`/`hairColour` são **texto livre** (não há lista de opções). `credits[].featured` é editável mas **ignorado** no preview e no HTML público — só o markdown/JSON-LD o usa. `ProfileLivePreview` filtra por `title`, não por `featured`.
>
> 🟡 `ethnicity` é coletado e exportado em markdown/JSON-LD, mas **ausente do HTML público**.

### 7.4 Uploads, storage e limites 🟡

| Recurso | Limite | MIME | Caminho | Delete |
|---|---|---|---|---|
| Headshot | 5MB | `accept` png/jpeg/webp (**sem** checagem de MIME no código) | `profiles/{uid}/headshot.{ext}` | ❌ nenhum |
| Fotos adicionais | 5MB cada, máx. 10 | idem | `profiles/{uid}/photos/{index}.{ext}` | ❌ nenhum |
| Showreel (vídeo) | **500MB** | `video/*` | `users/{uid}/showreels/{ts}_{nome}` | ✅ |
| Thumbnail do showreel | gerada no cliente | `image/jpeg` | `users/{uid}/showreels/thumbnails/{file}.jpg` | ✅ |
| CV | **100MB** | `application/pdf` | `profiles/{uid}/cv.pdf` (nome fixo, sobrescreve) | ❌ nenhum |
| Avatar de conta (Settings) | **2MB** | imagem | `avatars/{uid}.{ext}` | — |

- Extração de thumbnail: seek em 0.1s, downscale com **cap de 512px**, timeout 10s, `AbortSignal`, cleanup de `ObjectURL`.
- `deleteShowreelFile` só apaga URLs do Firebase Storage (protege YouTube/Vimeo).
- 🟡 Todos os uploads são **client-side** para o Firebase Storage, sem rota de servidor. **As Storage Rules não estão versionadas** neste repo (só existe `firestore.rules`).
- 🟡 O índice das fotos adicionais é `additionalPhotos.length` → re-adicionar após remover **pode sobrescrever** uma foto existente.

### 7.5 Autofill de IMDb 🟢

`POST /api/profile/autofill`:

1. **Auth** Bearer → 401. **Body** `{ url }` → 400 se ausente.
2. **Validação de URL:** allowlist de hostnames `["imdb.com","www.imdb.com","m.imdb.com"]` + pathname casando `/\/name\/nm\d+/`.
3. **Firecrawl:** `POST https://api.firecrawl.dev/v2/scrape` com `FIRECRAWL_API_KEY`, `formats:["markdown"]`, `waitFor: 2000`. Falha → 502. **Não existe fallback** (nenhum segundo provedor nem fetch direto) — o "bypass do WAF" é responsabilidade do Firecrawl.
4. **DNA:** lê `users/{userPath}/profile/master` e reduz a um contexto enxuto: `acting_fuel.archetypes`, `psychology.traits` (5), `psychology.coreValues`, `history.keyEntities` (5).
5. **Parsing determinístico** (`parseIMDBMarkdown`): nome do H1, `location`, `height` (imperial `5′ 9″` **ou** métrico `175 cm`), `knownFor`, créditos categorizados por heading, dedupe por `title+year`, `featured` quando em "Known For", showreels só de `imdb.com/video`. Fallback de bio: `metadata.description` truncado em 500.
6. **Síntese IA:** `gemini-2.5-flash`, system `IMDB_AUTOFILL_PROMPT`, `application/json`, `temperature 0.3`. **Sem `responseSchema`** → parse por `JSON.parse`; em falha usa o determinístico.
7. **Merge:** IA tem prioridade por campo, fallback no determinístico; `agency*` singular → `agents: [...]`; `externalProfiles` vem só da IA.
8. Resposta `{ success, data: finalData }`.

No cliente (`imdb-autofill.tsx` → `handleAutofillSuccess`): estratégia **"preencher só vazios"** + deep-merge de `externalProfiles`, depois `reset()` + `debouncedSave()`.

> 🟡 `lib/imdb-types.ts` define os tipos do Firecrawl/IMDB mas **nenhum é usado como validação em runtime** (só tipagem de fachada).
>
> 🟡 `FIRECRAWL_API_KEY` é exigida mas **ausente do `env.example`**.

### 7.6 Perfil público e export para LLM 🟢

**HTML — `/actors/[slug]`** (Server Component): SEO/OpenGraph, seções condicionais (Hero, Photos, Details, Showreels, About, Credits, Training, Skills) e botão de download do CV. `notFound()` se o perfil não existir/não estiver publicado.

**Markdown — `/actors/[slug]/index.md`** (GET): `text/markdown`, `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`, declarado como `alternates.types["text/markdown"]`. Só perfis `published`; o 404 também devolve markdown.

Estrutura do markdown (`lib/profile-to-markdown.ts`):
1. **YAML frontmatter schema.org** (`@type: Person`, `name`, `url`, `jobTitle`, `image`, `nationalities`, `height`, `playingAge`, `knowsAbout`, `workPermits`, `representedBy` se público, `dateModified`).
2. **Bloco `<!-- AI_AGENT_CONTEXT … -->`** com 6 instruções numeradas para agentes (role matching, skill matching, experiência, disponibilidade, referência visual, contato) + **"casting confidence signals"** dinâmicos (≥5 créditos → "Established", showreel, training, awards, permits, headshot, CV, plataformas).
3. `# Nome` + resumo · `## About` · `## Casting Profile` · `## Details` (inclui `ethnicity`) · `## Credits` (agrupados + `### Notable / Featured Credits` **pela flag `featured`**) · `## Showreels` · `## Training` · `## Skills & Accents` · `## Awards` · `## Representation` · `## Availability & Work Authorization` · `## External Profiles` · `## Photos` · `## CV`.
4. **`## Structured Data`** — JSON-LD com extensões `x-casting` (`playingAgeRange`, `appearance`, `workPermits`, `eyeColor`, `hairColor`, `ethnicity`).

### 7.7 🔴 Lacunas críticas do perfil

| # | Problema | Efeito |
|---|---|---|
| 1 | Zod não executado no save/publish | Nenhuma validação real de nome, bio, URLs, e-mails, contagens |
| 2 | Slug sem unicidade + `.limit(1)` | Colisão de URLs públicas entre atores homônimos |
| 3 | `getPublicProfile` sem validação de shape | Doc parcial derruba a página pública |
| 4 | Sem delete de Storage para CV/fotos | Objetos órfãos acumulam |
| 5 | `ethnicity` e `featured` fora do HTML público | Dados coletados não aparecem onde o casting vê |
| 6 | `timezone` sem UI | Campo morto |
| 7 | `public-navbar.tsx`/`public-footer.tsx` com botões sem handler | UI enganosa |
| 8 | `platform-icon.tsx` chama o serviço de favicons do Google a cada visita | Privacidade/perf |

---

## 8. Dados, privacidade e exclusão

### 8.1 Princípios declarados (`DATA_PRIVACY_AND_SECURITY.md`) 🟡

- Scripts/sides são processados **em memória** no backend e enviados apenas à API de desenvolvedor do Gemini.
- Conteúdo confidencial **não é persistido** no Firestore.
- Existem fluxos explícitos de exclusão de dados.

> 🟢 **Correção importante:** a afirmação do documento de privacidade é **acidentalmente verdadeira hoje** — `sidesText` **não é persistido** pelo wizard (ver §5.5). O `Reader Copilot`, porém, **depende** desse campo (lê `data.sidesText` de `users/{userPath}/auditions/*`), então corrigir o bug de persistência **muda a postura de privacidade** e exige revisar esta afirmação antes de usá-la contratualmente. Decisão de produto pendente:
> - **Opção A (privacidade máxima):** manter o texto apenas em memória durante a sessão e fazer o Reader Copilot receber as sides por outra via (ex.: estado de sessão/upload avulso).
> - **Opção B (funcionalidade):** persistir `sidesText` e atualizar a política de privacidade/NDA para refletir isso.

### 8.2 Exclusão de dados (Settings) 🟢

**`handleDeleteChatData()`** — batch delete de:
- `users/{userPath}/dnaSessions/{id}/messages/*` e os docs de sessão
- `users/{userPath}/coachSessions/{id}/messages/*` e os docs de sessão
- `users/{userPath}/profile/master`

**`handleDeleteAccount()`** — tudo acima **mais**:
- `users/{userPath}/dnaVault/*`
- `users/{userPath}/auditions/*`
- `users/{userPath}/profile/master` e o doc raiz `users/{userPath}`
- avatar no Firebase Storage
- a conta no Firebase Auth

**`handleDeleteProfile()`** — apenas `deleteDoc(actorProfiles/{uid})` (despublica o perfil).

**Upload de avatar:** máx. 2MB; extensão derivada do nome/MIME (default `jpg`); grava em `avatars/{uid}.{ext}`.

> ⚠️ A exclusão usa operações de **batch** sem paginação visível para coleções muito grandes — se um usuário tiver centenas de mensagens, o batch pode estourar o limite de 500 operações do Firestore. Verificar em `settings/page.tsx:236-282`.

---

## 9. Modelo de dados Firestore (consolidado)

```
users/{uid}                                  # raiz + espelho de billing (email, stripeCustomerId, tier, hasAccess, ...)
users/{uid}/billing/current                  # UserBilling — fonte autoritativa da sessão
actorProfiles/{uid}                          # perfil profissional (fonte da verdade) + hasSeenIntroVideo
actorProfiles (query por slug + published)   # perfil público

users/{userPath}/                            # ⚠️ userPath = `${uid}_${firstName}` (ver §4.2)
├── profile/master                           # Master Profile (DNA)
├── dnaVault/{docId}                         # extrações cruas para síntese
├── auditions/{auditionId}                   # AuditionDocument (performance maps, sidesText, ...)
├── dnaSessions/{sessionId}/messages/{msgId} # chat do DNA
├── coachSessions/{sessionId}/messages/{msgId} # chat do coach
├── sessions/{sessionId}                     # estado/metricas de sessão
├── chatLogs/{docId}                         # log bruto (userMessage + aiResponse)
```

**Regras de segurança (`firestore.rules`)** 🔴:

```
match /{document=**} {
  allow read, write: if request.auth != null;
}
```

> 🔴 **Crítico:** qualquer usuário autenticado (inclusive um `free` recém-cadastrado) pode **ler e escrever qualquer documento de qualquer usuário**. Não há checagem de posse (`request.auth.uid == userId`) nem de tier/`hasAccess`. Combinado com o uso intenso do SDK client (dna-vault, settings, perfil gravam direto do browser), é o achado de maior severidade do projeto. O próprio arquivo diz "permissive rule for development - tighten for production".

---

## 10. Regras transversais e constantes

### 10.1 Limites e constantes 🟢

| Constante | Valor | Onde |
|---|---|---|
| Histórico enviado ao coach | 20 mensagens | `app/api/coach/chat/route.ts:8` |
| Histórico YAN (DNA) | 15 mensagens | `app/api/dna/chat/route.ts:212` |
| Histórico do extrator | 7 mensagens | `app/api/dna/chat/route.ts:219` |
| Blacklist de perguntas | 6 | `app/api/dna/chat/route.ts:42` |
| Extração HQ | `depth_score >= 4` e `has_actionable_pattern` | `app/api/dna/chat/route.ts:271-275` |
| Conclusão de seção | 5 extrações HQ (temas calculados mas **ignorados**) | `hooks/use-chat.ts:564-565,596-602` |
| Progresso por capítulo | 25% (4 capítulos) | `hooks/use-chat.ts:645-675` |
| Desbloqueio de audições | 2 capítulos completos | `hooks/use-chat.ts:643` |
| Pivô por perguntas | 15 | `lib/pivot-logic.ts:21` |
| Repetição de tema | 3 na janela de 5 | `lib/pivot-logic.ts:19,22` |
| Documento de audição/DNA | 20 MB | `lib/document-processing.ts:18`; `lib/schemas/audition.ts:3` |
| Bio do perfil | 500 caracteres | `lib/profile-types.ts:142` |
| Foto de perfil (headshot) | 5 MB | `components/profile/sections/photos-section.tsx:46` |
| Avatar de conta | 2 MB | `settings/page.tsx:177` |
| CV | 100 MB, PDF | `components/profile/sections/cv-upload-section.tsx:28` |
| Showreel (vídeo) | 500 MB, `video/*` | `components/profile/sections/VideoDropzone.tsx:183` |
| Fotos adicionais | 10, 5 MB cada | `components/profile/sections/photos-section.tsx:70,151` |
| Break check-in (DNA) | 15 min | `hooks/use-session-timer.ts:5` |
| Audições listadas no Reader | 15 | `reader-copilot/page.tsx:69` |
| Retry de chat (cliente) | 3 tentativas, 2s | `hooks/use-chat.ts` |

### 10.2 Erros e retry 🟡

- `use-chat` tenta **3 vezes** com 2s de espera entre tentativas em falha de IA.
- Mapeamento de erros do Firebase com mensagens amigáveis (§1.3).
- Logging com `pino` + prefixos; alertas de segurança em acesso não autorizado; `alert()` nativo para erros críticos.
- **Não há rate limiting** em nenhum endpoint (nem auth nem IA) — TODO.

### 10.3 Convenções de dados 🟡

- **`userPath`** (`{uid}_{firstName}`) para conteúdo; **`{uid}`** para billing e `actorProfiles`. Dois namespaces.
- Timestamps: `serverTimestamp()` nas coleções de conteúdo; **string ISO** em billing (`updatedAt`).
- `arrayUnion` para extrações (acumulativo, dedup por valor).
- `set(..., { merge: true })` em quase todas as escritas.

---

## 11. Backlog priorizado de correções

| Prioridade | Item | Onde | Ação sugerida |
|---|---|---|---|
| 🔴 P0 | Regras do Firestore liberam cross-tenant | `firestore.rules` | Trocar por `request.auth.uid == userId`; separar leitura pública de `actorProfiles` |
| 🔴 P0 | `/api/billing/success` sem verificação de posse | `app/api/billing/success/route.ts` | Validar que a sessão Stripe pertence ao usuário autenticado; não emitir cookie só por `session_id` |
| 🔴 P0 | Sem enforcement de tier no servidor | rotas `/api/dna`, `/coach`, `/auditions` | Extrair helper `requireTier()` e aplicar nos handlers |
| 🔴 P0 | `dnaVault` nunca escrito → síntese sempre 400 | `app/api/dna/synthesize/route.ts` | Passar a persistir extrações no vault **ou** sintetizar direto do `profile/master`; tratar `response.ok` no caller |
| 🔴 P0 | `extractions: null` torna progresso/conclusão inatingíveis | `app/api/dna/chat/route.ts:319-325` + `hooks/use-chat.ts:569-641` | Devolver as extrações do worker ao cliente **ou** mover o cálculo de progresso para o servidor |
| 🔴 P0 | `themes_extracted` ausente do schema de extração | `lib/dna/extraction/extraction-tool-schema.ts` | Adicionar o campo (e atualizar o teste que o proíbe) |
| 🔴 P0 | `emotional_baseline`/`intellectual_framework` extraídos e descartados | `app/api/dna/chat/route.ts:279-297` | Persistir os dois objetos no `updatePayload` |
| 🔴 P0 | `sidesText` nunca persistido → Reader Copilot/Stage 9/"EXACT SIDES TEXT" quebrados | `components/auditions/audition-wizard.tsx:446-463,470-494` | Incluir `sidesText` nos payloads (após decidir a questão de privacidade — §8.1) |
| 🔴 P0 | `userPath` derivado do primeiro nome | `lib/firestore.utils.ts` e rotas | Migrar para `users/{uid}` (com migração de dados) |
| 🟠 P1 | `invoice.payment_*` grava `tier: null` | `app/api/webhooks/stripe/route.ts:307-311` | Incluir `tier` no payload ou omitir a chave |
| 🟠 P1 | `hasUsedTrial` sobrescrito por `null` | `:14-20,232,282` | Sanitizar preservando o valor existente |
| 🟠 P1 | Webhook sem idempotência | `:160-322` | Persistir `event.id` processado |
| 🟠 P1 | `cancel_url` aponta para rota inexistente | `app/api/billing/checkout/route.ts:143` | Criar `/api/billing/cancelled` |
| 🟠 P1 | `isTrial = !hasUsedTrial` concede trial a todo checkout | `app/api/billing/checkout/route.ts:96` | Gate explícito por `isExplicitTrialReq` |
| 🟠 P1 | Zod do perfil nunca executado (`handleSubmit` ausente) | `app/(interior)/profile/page.tsx:46,65,213` | Chamar `handleSubmit` no save/publish |
| 🟠 P1 | Slug de perfil sem unicidade + `.limit(1)` público | `lib/profile-types.ts:235-242`; `lib/get-public-profile.ts:16` | Garantir unicidade do slug e trocar por query determinística |
| 🟠 P1 | `profile/master` com dois schemas incompatíveis (UAP aninhado × campos planos) | `app/api/dna/synthesize/route.ts:103-111` | Unificar o shape e fazer o UAP ser consumido de fato |
| 🟠 P1 | `getPublicProfile` sem validação de shape | `lib/get-public-profile.ts:31` | Validar com Zod antes de renderizar |
| 🟡 P2 | Lista de status ativos duplicada 4× | `proxy.ts:51`, `billing.ts:147`, webhook | Extrair constante única |
| 🟡 P2 | Dois endpoints de portal | `billing/portal` vs `create-portal-session` | Deprecar um |
| 🟡 P2 | Duplicação `analyzeBrief/route.ts` × `routeBrief.ts` | `app/api/auditions/analyzeBrief/` | Remover o não usado |
| 🟡 P2 | Sem `firestore.indexes.json` (dedupe de audição não funciona) | raiz do repo | Versionar os índices compostos |
| 🟡 P2 | RAG do coach morto (`excerpts: []`) e env de modelo ignorada | `app/api/coach/chat/route.ts:124,137` | Remover a infra morta **ou** religar o corpus e a env |
| 🟡 P2 | Duas gravações de DNA divergentes + coleção órfã `sessions/` | `hooks/use-acting-coach.ts` × `app/api/coach/updateDna/route.ts` | Unificar em um único caminho |
| 🟡 P2 | `actorTimezone` descartado pelo Zod | `components/auditions/audition-wizard.tsx:331` | Adicionar o campo ao schema ou remover do payload |
| 🟡 P2 | Webhook sem retry para eventos não resolvidos | `app/api/webhooks/stripe/route.ts` | Fila/retry |
| 🟡 P2 | README desatualizado | `README.md` | Corrigir ou derivar desta doc |
| 🟡 P2 | `personal-dna/page.tsx` é CTA morto | `app/(interior)/personal-dna/` | Redirect para `/chat` ou remover |
| 🟢 P3 | `buildPlatformSessionPayload` não usado | `lib/billing.ts:146-155` | Remover |
| 🟢 P3 | `step-generating.tsx` vazio e passo 5 inalcançável | `components/auditions/step/` | Remover |
| 🟢 P3 | Botão "Delete" do wizard não apaga no Firestore | `components/auditions/audition-wizard.tsx:142-147` | Implementar delete real ou remover o botão |
| 🟢 P3 | `MicFab` nunca renderizado | `app/(interior)/layout.tsx:2` | Remover |
| 🟢 P3 | Órfãos: `lib/questions.ts`, `response-shortcuts.ts`, `run-extraction.ts`, `coach-suggestion-chips.tsx`, `acting-coach-citations.tsx`, `resetTrackerForSection` | — | Remover ou religar |
| 🟢 P3 | Sem rate limiting | global | Middleware/Upstash |
| 🟢 P3 | `env.example` incompleto | `env.example` | Completar com as vars de §1 do doc 01 |
