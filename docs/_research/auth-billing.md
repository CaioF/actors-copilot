# Pesquisa técnica — Autenticação, Autorização, Tiers de Assinatura e Billing

**Projeto:** `actors-copilot` ("The Actor's Copilot") — Next.js `16.1.6` (App Router) + React `19.2.4` + TypeScript `5.7.3` (`package.json:63,69`).
**Fonte de verdade:** código. Onde o `README.md` divergir, a divergência é apontada explicitamente na seção 8.
**Método:** leitura direta dos arquivos citados + varredura (`grep`) por `tier`, `hasAccess`, `subscription`, `collection(`, `limit`, `MAX_`. Nenhum valor de limite numérico de uso foi encontrado no código.

> Nota de plataforma: no Next.js 16 o antigo `middleware.ts` foi renomeado para `proxy.ts`. Este projeto **não possui** `middleware.ts`; o guard de borda é `proxy.ts`, que exporta a função `proxy` e o objeto `config` (`proxy.ts:18,129`).

---

## 1. Fluxo de autenticação

### 1.1 Métodos de login

| Método | Implementação | Referência |
|---|---|---|
| Google OAuth | `signInWithPopup(auth, googleProvider)` com `new GoogleAuthProvider()` | `lib/context/AuthContext.tsx:55,124` |
| E-mail + senha (login) | `signInWithEmailAndPassword` | `lib/context/AuthContext.tsx:171` |
| E-mail + senha (cadastro) | `createUserWithEmailAndPassword` | `lib/context/AuthContext.tsx:212` |
| Reset de senha | `sendPasswordResetEmail` | `lib/context/AuthContext.tsx:254` |
| Logout | `signOut(auth)` + `POST /api/auth/logout` | `lib/context/AuthContext.tsx:278-281` |

O SDK client do Firebase é inicializado em singleton preguiçoso (`lib/firebase.ts:30-50`); `AuthProvider` obtém `getAuth(app)` (`lib/context/AuthContext.tsx:66-67`). O provedor envolve toda a aplicação no root layout (`app/layout.tsx:34-40`).

### 1.2 Troca de token e emissão de sessão

1. Após o login, o cliente chama `getIdToken()` (Firebase ID token) — `AuthContext.tsx:125,172,213`.
2. `POST /api/auth/callback` com body `{ idToken }` — `AuthContext.tsx:127-133,174-178,215-219`.
3. O servidor valida com Firebase Admin `auth.verifyIdToken(idToken)` e exige a claim `email` (400 se ausente) — `app/api/auth/callback/route.ts:21-26`.
4. Lê o documento de billing `users/{uid}/billing/current` e hidrata tier/status/IDs — `app/api/auth/callback/route.ts:35-46`. Defaults: `tier='free'`, `subscriptionStatus='canceled'` (`:28-29`).
5. Assina o JWT e grava o cookie de sessão — `app/api/auth/callback/route.ts:49-58`.
6. Responde `{ success, user: { uid, email, tier, subscriptionStatus } }` (`:60-63`).

Existe também `GET /api/auth/callback` que apenas devolve o contexto da sessão (`tier`, `subscriptionStatus`, `stripeCustomerId`) e responde **401** com `tier: 'free'` quando não há sessão — `app/api/auth/callback/route.ts:76-91`. É esse GET que o `AuthContext` usa no `onAuthStateChanged` para hidratar `user.tier` (`AuthContext.tsx:294-331`), com fallback para `free/canceled` em erro (`:316,321`).

### 1.3 Mecânica do JWT (`jose`)

Implementado em `lib/session.ts`:

| Item | Valor | Referência |
|---|---|---|
| Biblioteca | `jose` (`SignJWT`, `jwtVerify`) | `lib/session.ts:2` |
| Algoritmo | `HS256` (header protegido e verificação restrita a `['HS256']`) | `lib/session.ts:36,50-52` |
| Segredo | `process.env.JWT_SECRET_KEY \|\| process.env.JWT_SECRET` | `lib/session.ts:21` |
| Falha de config | `throw` em tempo de módulo se o segredo faltar | `lib/session.ts:23-25` |
| Expiração | `setExpirationTime('7d')` — **7 dias** | `lib/session.ts:38` |
| Emissão | `setIssuedAt()` (sem `iss`/`aud`/`sub` explícitos) | `lib/session.ts:37` |
| Verificação | retorna `null` em qualquer falha (assina/expira) + `console.error` | `lib/session.ts:48-58` |
| Nome do cookie | `platform_session` | `lib/session.ts:20` |

**Claims armazenadas** (`PlatformSession`, `lib/session.ts:9-18`; preenchidas em `app/api/auth/callback/route.ts:49-58`):

```
uid, email, tier, subscriptionStatus,
stripeCustomerId?, stripeSubscriptionId?, stripePriceId?, currentPeriodEnd?
```

O cookie é gravado com `httpOnly: true`, `secure: NODE_ENV === 'production'`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 60*60*24*7` — `lib/session.ts:69-75`.

> Leitura da sessão: `getPlatformSession()` lê **somente o cookie** (`lib/session.ts:82-88`), apesar de o comentário em `:79` mencionar "HTTP request headers". Nenhuma rota lê o cookie via header manual.

### 1.4 Logout e revogação

- `POST /api/auth/logout` chama `deletePlatformSession()` (`cookieStore.delete('platform_session')`) e responde `{ success: true }` — `app/api/auth/logout/route.ts:10-18`, `lib/session.ts:94-97`.
- **Não existe revogação/blacklist de JWT.** O token é stateless; se o cookie for copiado antes do logout, continua válido até `exp` (7 dias). O próprio `README.md:670,831` registra "No JWT blacklisting on logout" como TODO.
- O `logout()` do cliente engole erros (`catch` apenas loga, `AuthContext.tsx:283-287`) e redireciona para `/login` via `window.location.href`.

### 1.5 Redirecionamentos

- Pós-login: se houver `sessionStorage.trial_intent`, dispara checkout de trial e redireciona à URL Stripe; caso contrário `window.location.href = "/dashboard"` — `AuthContext.tsx:78-111`.
- `app/login/page.tsx` captura intenção de trial via query params (`trial`, `plan`) em `sessionStorage` (`login/page.tsx:67-86`), e, com usuário já autenticado, dispara checkout ou manda para `/upgrade` (`login/page.tsx:88-128`).
- Sem cookie válido: middleware redireciona para `/login` (`proxy.ts:38-48`).
- Tier insuficiente: middleware redireciona para `/upgrade` (`proxy.ts:56,63`).

### 1.6 `ProtectedRoute` (client) — o que realmente verifica

- Componente client que consome `useAuth()` e, quando `!loading && !user` (usuário **Firebase**, não tier), faz `router.push('/login')` — `lib/context/ProtectedRoute.tsx:19-23`.
- Enquanto `loading`, renderiza tela de splash; retorna `children` só se `user` — `ProtectedRoute.tsx:25-54`.
- Envolve **todo** o layout `(interior)`: `app/(interior)/layout.tsx:24-36`. Portanto cobre `dashboard`, `chat`? (não — `/chat` está fora do grupo), `auditions`, `profile`, `dna-vault`, `reader-copilot`, `settings`, `upgrade`, `personal-dna`, `acting-coach`.
- **Não verifica tier nem status de assinatura.** É puramente anti-flash/UX; a barreira de tier é o `proxy.ts`.

### 1.7 Middleware de borda (`proxy.ts`) — matchers e regras exatas

Feature flag `BILLING_ENGINE = process.env.BILLING_ENGINE || 'STRIPE'` (`proxy.ts:9`).

**Bypass explícito:** `/api/billing/success` e subrotas retornam `NextResponse.next()` **antes de qualquer verificação de auth** (`proxy.ts:26-30`).

**Ramo Stripe (ativo por default)** — `proxy.ts:35-69`:

| Condição | Ação |
|---|---|
| Sem cookie `platform_session` | `307` → `/login` (`:38-40`) |
| Cookie presente mas `decryptSession` retorna `null` | `307` → `/login` + `response.cookies.delete('platform_session')` (`:44-48`) |
| `tier === 'free'` **ou** status ∉ `['active','trialing']` | Permitido **apenas** se `pathname === '/dashboard'` ou `startsWith('/dashboard/')`; caso contrário `307` → `/upgrade` (`:50-59`) |
| `tier === 'economy'` | Bloqueado em `/profile*` e `/acting-coach*` → `/upgrade`; demais caminhos liberados (`:61-66`) |
| Qualquer outro tier (`business`) | `NextResponse.next()` (`:68`) |

A lista de status considerados ativos (`['active','trialing']`) está **duplicada** em `proxy.ts:51`, `lib/billing.ts:147` e `app/api/webhooks/stripe/route.ts:223,264`.

**Ramo legado Kajabi** — `proxy.ts:74-121` (inalcançável com o default `STRIPE`): exige cookie `kajabi_session`, verifica HS256 com o mesmo segredo, e para `/profile*` ou `/acting-coach*` compara a claim `offers` com o conjunto CSV `KAJABI_ECONOMY_OFFER_ID`; se o usuário só tem ofertas "economy", redireciona para `/upgrade` (`:94-115`). Cookies inválidos são apagados (`:118-120`).

**Matcher exato** (`proxy.ts:129-140`):

```
/api/billing/success
/dashboard/:path*
/chat/:path*
/auditions/:path*
/personal-dna/:path*
/settings/:path*
/profile/:path*
/acting-coach/:path*
```

**Fora do matcher (não protegidos no edge):** `/upgrade`, `/login`, `/`, `/dna-vault`, `/reader-copilot`, `/actors/*`, e **todas** as rotas de API de IA/billing exceto `/api/billing/success`. Ou seja, `/api/billing/checkout`, `/api/billing/portal`, `/api/create-portal-session`, `/api/dna/*`, `/api/coach/*`, `/api/auditions/*`, `/api/actor-copilot/*`, `/api/profile/*` e `/api/webhooks/stripe` não passam pelo middleware — a autenticação delas é feita dentro de cada handler (ver 3.3).

**Testes do middleware** (`proxy.test.ts`): cobrem apenas o ramo Stripe — sem cookie → `/login` (`:36-45`), token inválido limpa cookie (`:50-62`), economy em `/acting-coach` → `/upgrade` (`:67-81`), business libera (`:86-101`), bypass de `/api/billing/success` (`:103-110`). O ramo Kajabi **não tem teste**. Divergência sutil: o teste nunca mocka `NextResponse.next()` como 200 sem header, mas o código de produção também não define `x-middleware-next` manualmente — o teste depende do comportamento interno do Next (`proxy.test.ts:96-100`).

---

## 2. Tiers de assinatura

### 2.1 Identificadores e tipos (`lib/billing.ts`)

```ts
type SubscriptionTier = 'free' | 'economy' | 'business';        // billing.ts:7
type SubscriptionStatus =
  | 'active' | 'trialing' | 'canceled' | 'incomplete'
  | 'past_due' | 'unpaid';                                       // billing.ts:12-18
type BillingCycle = 'monthly' | 'annual';                        // billing.ts:20
```

`UserBilling` (documento de billing): `uid, customerId?, subscriptionId?, tier, status, priceId?, currentPeriodEnd?, cancelAtPeriodEnd?, hasAccess?, trialStart?, trialEnd?, hasUsedTrial?` — `lib/billing.ts:26-39`.

`PlatformSessionPayload = { tier, isActive, status }` — `lib/billing.ts:45-49`. A função `buildPlatformSessionPayload()` (`lib/billing.ts:146-155`) que a produz **nunca é chamada** (código morto; confirmado por grep em todo o repositório).

### 2.2 Matriz tier → Stripe Price ID

`getStripePriceIdForTier(tier, billingCycle = 'monthly')` — `lib/billing.ts:72-97`:

| Tier | `monthly` | `annual` |
|---|---|---|
| `economy` | `STRIPE_ECONOMY_PRICE_ID` | `STRIPE_ECONOMY_ANNUAL_PRICE_ID` (erro se ausente) |
| `business` | `STRIPE_BUSINESS_PRICE_ID` | `STRIPE_BUSINESS_ANNUAL_PRICE_ID` (erro se ausente) |
| `free` | lança `Error('The "free" tier does not map to a Stripe Price ID.')` | idem |

Mapeamento reverso `mapStripePriceToTier(priceId)` — `lib/billing.ts:104-119`: `economy` mensal **ou** anual → `'economy'`; `business` mensal **ou** anual → `'business'`; `undefined`/desconhecido → `'free'` com `console.warn`.

**Hard-fail na importação do módulo** (`lib/billing.ts:52-64`): lança erro se `STRIPE_ECONOMY_PRICE_ID`, `STRIPE_BUSINESS_PRICE_ID` **ou** `STRIPE_WEBHOOK_SECRET` estiverem ausentes. Consequência: qualquer ambiente sem essas variáveis não consegue sequer importar `lib/billing.ts` (checkout, webhook, success, testes).

### 2.3 Preços

Não há preços em código de servidor — vivem no Stripe. Os únicos números:

| Fonte | Economy | Business | Ciclo |
|---|---|---|---|
| UI de upgrade (USD, hardcoded) | `$19.00` / `$15.00` | `$29.00` / `$23.00` | mensal / anual ("-20%") — `app/(interior)/upgrade/page.tsx:209,225,200` |
| CSV legado Kajabi (GBP) | `£19.00` | — | `Month` — `subscriptions.csv:2-4` |
| Migração (Price IDs literais) | `price_1TuCsh…` (M) / `price_1TwOUR…` (Y) | `price_1TuCsv…` (M) / `price_1TwO6v…` (Y) | `scripts/01-generate-migration-links.ts:41-46` |

Há **inconsistência de moeda**: a UI atual vende em USD, os dados legados/migração são GBP `£19.00` (`subscriptions.csv:2-4`).

### 2.4 Trial

- Duração: **14 dias**. `trial_period_days: 14` na criação do Checkout (`app/api/billing/checkout/route.ts:139`) e copy "14-day free trial" (`app/login/page.tsx:257,265,283,350,531`).
- Regra de elegibilidade: `hasUsedTrial` é lido primeiro de `users/{uid}/billing/current` e, se falso, de `users/{uid}` raiz (`checkout/route.ts:72-89`).
- Se `hasUsedTrial` e a requisição for explicitamente trial (`isTrial`, `trial` ou `tier === 'trial'`) → **400** `"A free trial has already been used for this account."` (`checkout/route.ts:48,91-93`).
- **Ponto crítico:** `const isTrial = !hasUsedTrial;` (`checkout/route.ts:96`) — ou seja, **todo primeiro checkout ganha 14 dias de trial automaticamente**, mesmo quando o usuário clica "Upgrade" sem pedir trial, e `payment_method_collection: 'always'` é aplicado (`:141`).
- `tier` ausente ou `'trial'` faz `selectedTier` cair em `'business'` (`checkout/route.ts:49`) — um trial pode ser criado como Business por default.
- Intenção de trial persiste em `sessionStorage` (`trial_intent`, `trial_tier`) e dispara checkout automático pós-auth (`login/page.tsx:67-121`, `AuthContext.tsx:78-111`).

### 2.5 Status e como o tier efetivo é calculado

- Somente `active` e `trialing` concedem acesso; nos demais o tier efetivo é rebaixado para `free` (`lib/billing.ts:147-153` — função morta — e a mesma regra em `proxy.ts:51-52` e no `hasAccess` do webhook, `webhooks/stripe/route.ts:223,264`).
- O JWT **persiste o tier bruto** do documento (`callback/route.ts:40,52`); quem decide se ele vale é o `proxy.ts` cruzando `tier` × `subscriptionStatus`. Um usuário `past_due` com `tier: 'business'` continua com `tier: 'business'` no token e seria redirecionado a `/upgrade` pelo proxy (status não ativo).

### 2.6 Onde o tier/entitlement é armazenado no Firestore

| Caminho | Campos | Escrito por |
|---|---|---|
| `users/{uid}/billing/current` | `customerId`, `subscriptionId`, `priceId`, `tier`, `status`, `subscriptionStatus`, `hasAccess`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `cancelAt`, `trialStart`, `trialEnd`, `hasUsedTrial`, `migrationSource`, `migratedAt`, `updatedAt` | webhook (`webhooks/stripe/route.ts:130-140`); seed no checkout (`checkout/route.ts:110-115`) |
| `users/{uid}` (raiz, espelho) | `stripeCustomerId`, `subscriptionStatus`, `hasAccess`, `tier`, `cancelAtPeriodEnd`, `cancelAt`, `hasUsedTrial`, `updatedAt` (+ `email` usado na resolução) | webhook (`webhooks/stripe/route.ts:142-157`) |

Leituras: `callback/route.ts:35-46`, `checkout/route.ts:65-89`, `billing/portal/route.ts:51-64`, `create-portal-session/route.ts:56-70`, `billing/success/route.ts:47-66`.

---

## 3. Regras de gating por tier

### 3.1 O que cada tier promete (copy da UI)

`app/(interior)/upgrade/page.tsx:215-238`:

| Tier | Features listadas na UI | Onde é aplicado de fato |
|---|---|---|
| `economy` | "Access to Personal DNA Extraction chats"; "Full Audition Breakdown generation features"; "Multi-step Audition Wizard access"; "Standard storage metrics limits" | Nenhuma verificação de código, exceto bloqueio de `/profile*` e `/acting-coach*` |
| `business` | "Everything included in Economy Class"; "Exclusive access to the AI Acting Coach"; "Deep character lens profile analysis modules"; "Priority processing speeds on document extractions"; "Full Actor Profile management tools" | Acesso total no edge |

### 3.2 Valores de limite

**Não existe nenhum limite numérico de uso (audições, mensagens de chat, quotas, DNA) no código.** Buscas por `MAX_`, `maxAuditions`, `maxMessages`, `quota`, `LIMIT`, contagens (`count()`, `.size >=`) só retornam:

- `MAX_HISTORY_MESSAGES = 20` — janela de histórico enviada ao LLM no coach, **não** é limite comercial (`app/api/coach/chat/route.ts:8,102`).
- `REQUIRED_THEMES = 4` e `HQ_EXTRACTIONS_FOR_COMPLETION = 5` — regras de progresso da DNA, não tier (`hooks/use-chat.ts:569-570`).
- `MAX_DOCUMENT_SIZE_BYTES = 20MB` (`lib/document-processing.ts:18`), `MAX_FILE_SIZE = 20MB` (`lib/schemas/audition.ts:3`), 2MB foto (`settings/page.tsx:177`), 5MB (`photos-section.tsx:46`), 100MB CV (`cv-upload-section.tsx:28`) — limites técnicos.
- `TOAST_LIMIT = 1` (`hooks/use-toast.ts:8`).

Portanto "max auditions"/"max chat messages"/"DNA access" **não têm valores implementados**; a única diferenciação real é acesso a rotas.

### 3.3 Onde as regras são aplicadas (e onde não são)

| Camada | O que aplica | Referência |
|---|---|---|
| Edge (`proxy.ts`) | Auth (cookie JWT) + tier/status por prefixo de rota | `proxy.ts:18-69,129-140` |
| Client (`ProtectedRoute`) | Apenas autenticação Firebase (existe usuário?) | `lib/context/ProtectedRoute.tsx:19-23` |
| Client (UI) | Cosmético: rótulo "Manage Plan"/"Upgrade Plan" no sidebar se `tier === 'business'` (`components/app-sidebar.tsx:51,175`); botão "Current Plan" no card do tier ativo (`upgrade/page.tsx:96,212,229`); badge de status em Settings (`settings/page.tsx:534-555`). **Nenhum bloqueio de feature.** | — |
| Server (rotas de API) | **Apenas autenticação.** Todas as rotas de IA validam `Authorization: Bearer <Firebase ID token>` e derivam `userPath` do `uid`; **não consultam tier, status ou `hasAccess`** | `app/api/dna/chat/route.ts:24-28,52-66`; `app/api/coach/chat/route.ts:13-16,41-50`; `app/api/dna/synthesize/route.ts:35`; `app/api/auditions/analyzeBrief/route.ts:158`; `app/api/profile/autofill/route.ts:298` |
| Server (billing) | Auth por cookie **ou** ID token; regras de negócio de trial/customer | `checkout/route.ts:26-46`; `billing/portal/route.ts:16-47` |

**Consequência arquitetural:** como nenhuma rota `/api/dna/*`, `/api/coach/*`, `/api/auditions/*`, `/api/actor-copilot/*` está no matcher do `proxy.ts` e nenhum handler checa tier, um usuário **free/inadimplente autenticado no Firebase** pode consumir todos os recursos de IA diretamente por API (incluindo Acting Coach, que a UI vende como exclusivo de Business). O gating é bypassável pulando a navegação de página.

**Gate de produto (não de tier):** `auditionsUnlocked` é calculado pelo progresso da extração de DNA e persistido na sessão (`lib/chat-types.ts:41`, `hooks/use-chat.ts:557,690`), não pelo tier.

**README desatualizado:** `README.md:141` descreve `chat-sidebar.tsx` como "DNA tracking drawer with tier-aware control gates" — **não há nenhuma referência a `tier` em `components/chat-sidebar.tsx`** (grep confirmado).

---

## 4. Fluxo Stripe

### 4.1 Criação de Checkout — `POST /api/billing/checkout`

`app/api/billing/checkout/route.ts`:

1. Parse defensivo do JSON → 400 `"Malformed JSON request body"` (`:17-22`).
2. Autenticação: cookie `platform_session` **ou** `idToken` no body verificado por `auth.verifyIdToken` (`:30-42`); sem `uid`/`email` → 401 (`:44-46`).
3. `isExplicitTrialReq = isTrial || trial || tier === 'trial'`; `selectedTier = tier && tier !== 'trial' ? tier : 'business'`; `billingCycle` default `'monthly'` (`:48-50`).
4. Validação: apenas `economy` e `business` (400 caso contrário) (`:52-54`).
5. Resolve `priceId` via `getStripePriceIdForTier` (400 com a mensagem do erro) (`:57-62`).
6. Lê billing + regra de trial (`:64-96`, ver 2.4).
7. Lazy-create de cliente Stripe se não houver `customerId`, com `metadata.platformUserId` e `metadata.firebaseUid`, e seed do doc de billing `{ customerId, tier:'free', status:'canceled', updatedAt }` (`:99-116`).
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
| `subscription_data.trial_period_days` | `14` (somente se `isTrial`) |
| `payment_method_collection` | `'always'` (somente se `isTrial`) |
| `success_url` | `${NEXT_PUBLIC_APP_URL \|\| 'http://localhost:3000'}/api/billing/success?session_id={CHECKOUT_SESSION_ID}` |
| `cancel_url` | `${appUrl}/api/billing/cancelled` |
| `metadata` | `{ platformUserId, firebaseUid, targetTier, billingCycle, isTrial: 'true'\|'false' }` |

9. Resposta: `{ url: checkoutSession.url }` (`:154`).

> **Rota ausente:** `cancel_url` aponta para `/api/billing/cancelled`, que **não existe** no repositório (`find app/api -name route.ts` listado integralmente) → cancelar no Stripe resulta em 404.

### 4.2 Customer Portal — dois endpoints duplicados

| Endpoint | Auth | Resolução do customer | `return_url` | Status |
|---|---|---|---|---|
| `POST /api/billing/portal` | cookie → `Authorization: Bearer` → body `idToken` (`billing/portal/route.ts:19-43`) | `users/{uid}/billing/current.customerId` → `users/{uid}.stripeCustomerId \|\| .customerId` (`:50-64`) | `STRIPE_CUSTOMER_PORTAL_RETURN_URL \|\| ${appUrl}/settings` (`:75-76`) | 200 |
| `POST /api/create-portal-session` | idêntico (`create-portal-session/route.ts:19-44`) | idêntico (`:54-70`) | sempre `${appUrl}/settings` (`:81-82`) | 200 |

Ambos respondem **400** `"Bad Request: No active billing profile exists for this account."` quando não há `stripeCustomerId` (`billing/portal/route.ts:67-72`; `create-portal-session/route.ts:73-78`), e criam `stripe.billingPortal.sessions.create({ customer, return_url })`.

**A UI usa o endpoint legado:** `app/(interior)/settings/page.tsx:105-130` chama `/api/create-portal-session` (com `Authorization: Bearer <idToken>` **e** body `{ idToken }`). `/api/billing/portal` é, na prática, **código morto/duplicado** (só aparece nos próprios testes).

### 4.3 Callback de sucesso — `GET /api/billing/success`

`app/api/billing/success/route.ts` (rota **isenta de auth** no proxy, `proxy.ts:26-30`):

1. Lê `session_id` da query; ausente → redirect `/dashboard` (`:23-28`).
2. `stripe.checkout.sessions.retrieve(sessionId, { expand: ['customer_details'] })` (`:32-34`).
3. `uid = sessionDetails.client_reference_id`; ausente → redirect `/dashboard` (`:36-42`).
4. Lê `users/{uid}/billing/current` como fonte autoritativa de `tier`/`status` (comentário explícito em `:44-46`); defaults `free`/`canceled` (`:47-52`).
5. E-mail: `customer_details.email` → fallback `users/{uid}.email` (`:57-66`).
6. Monta `PlatformSession` e chama `setPlatformSession` (`:76-92`), retornando `NextResponse.redirect('/dashboard')` (`:72`).

> O próprio código manifesta dúvida sobre o cookie ser anexado ao redirect em `:87-92`. Não há teste para esta rota (não existe `success/route.test.ts`).

### 4.4 Webhook — `POST /api/webhooks/stripe`

`app/api/webhooks/stripe/route.ts` — `export const dynamic = 'force-dynamic'` (`:8`).

**Verificação de assinatura:** header `stripe-signature` obrigatório (400 se ausente, `:162-165`); corpo lido como texto cru `req.text()` (`:167`); `verifyStripeWebhookEvent` → `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)` (`lib/billing.ts:129-138`); falha → 400 `"Invalid Webhook Cryptographic Signature"` (`:170-175`).

**Resolução de `platformUserId`** (`resolvePlatformUserId`, `:48-125`) — cascata:
1. `session.client_reference_id` ou metadata (`platformUserId` → `userId` → `uid` → `firebaseUID` → `firebaseUserId`) (`:33-43,54-56`).
2. `collectionGroup('billing').where('customerId','==', customerId).limit(1)` e extrai o segmento após `users` (`:61-79`) — requer índice de collection group.
3. `users.where('stripeCustomerId','==', customerId).limit(1)` (`:81-93`).
4. `stripe.customers.retrieve(customerId)` → metadata ou e-mail (`:95-108`).
5. `users.where('email','==', email.toLowerCase().trim()).limit(1)` (`:111-122`).

Se nada resolve → apenas `logger.warn` e `break` (evento descartado silenciosamente, `:192-195,254-257`).

**Eventos tratados** (`:179-320`):

| Evento | Mutações |
|---|---|
| `checkout.session.completed` (`:180-241`) | Resolve uid; busca `subscriptionId`; `priceId` da subscription (fallback `listLineItems` limit 1); `tier = metadata.targetTier \|\| mapStripePriceToTier(priceId) \|\| 'free'`; `isMigrationFlow = metadata.flow === 'subscriber_migration'`; `isTrialSession = metadata.isTrial === 'true' \|\| subscription.status === 'trialing'`; `subStatus = subscription.status \|\| (isTrial ? 'trialing' : 'active')`; `hasAccess = ['trialing','active'].includes(subStatus)`; grava `customerId, subscriptionId, priceId, tier, status, hasAccess, hasUsedTrial, trialStart, trialEnd, migrationSource, migratedAt` |
| `customer.subscription.created/updated/deleted` (`:243-292`) | `tier` do price; `isDeleted = deleted \|\| status canceled \|\| unpaid`; `hasAccess = !isDeleted && ['trialing','active'].includes(status)`; `currentPeriodEnd = subscription.current_period_end ?? firstItem.current_period_end ?? now`; `cancelAtPeriodEnd`; `cancelAt = subscription.cancel_at ?? (cancelAtPeriodEnd ? currentPeriodEnd : null)`; se deletado → `tier:'free'`, `status:'canceled'`, `cancelAtPeriodEnd:false`, `cancelAt:null` |
| `invoice.payment_succeeded` / `invoice.payment_failed` (`:294-315`) | `status = 'active'` / `'past_due'`; `hasAccess = isPaid`; grava **apenas** `{ customerId, status, hasAccess }` |
| default (`:317-319`) | `logger.debug` e 200 |

**Mutação Firestore** (`syncUserBilling`, `:130-158`):

```ts
// billing/current
payload = sanitizeFirestorePayload({ ...data, subscriptionStatus: data.status, updatedAt: ISO })
await db.doc(`users/${uid}/billing/current`).set(payload, { merge: true })

// users/{uid} (espelho)
userPayload = { stripeCustomerId, subscriptionStatus, hasAccess, tier, cancelAtPeriodEnd, cancelAt, updatedAt }
if (data.hasUsedTrial !== undefined) userPayload.hasUsedTrial = data.hasUsedTrial
await db.doc(`users/${uid}`).set(sanitizeFirestorePayload(userPayload), { merge: true })
```

`sanitizeFirestorePayload` (`:14-20`) converte `undefined → null` para evitar crash do Admin SDK.

**Idempotência:** **não existe** deduplicação por `event.id` — nenhuma coleção de eventos processados. O `set(..., { merge: true })` torna replays majoritariamente convergentes para valores iguais, **mas não para os campos que viram `null`** (ver 6.2/6.3) nem para `migratedAt`, regenerado a cada replay (`:236`). Retorno sempre `{ received: true }` 200. Não há verificação de `event.livemode` nem reentrega com retry (o `README.md:829` registra "Add retry handling for Stripe webhook retries" como TODO).

---

## 5. Modelo de dados Firestore (o que auth/billing revelam)

### 5.1 Coleções e caminhos

```
users/{uid}                          # perfil raiz + espelho de billing (email, stripeCustomerId, tier, hasAccess, ...)
users/{uid}/billing/current          # UserBilling — fonte autoritativa para a sessão
users/{userPath}/profile/master      # userPath = `${uid}_${firstName}` (sanitizado)
users/{userPath}/dnaVault
users/{userPath}/auditions/{auditionId}
users/{userPath}/dnaSessions/{sessionId}/messages
users/{userPath}/coachSessions/{sessionId}
users/{userPath}/sessions/{sessionId}
users/{userPath}/chatLogs
actorProfiles/{uid}                  # perfil público (lib/firestore.utils.ts:39; coach/chat:62)
actorProfiles (collection)           # app/actors/[slug]/index.md/route.ts:14
```

**Inconsistência de chave:** billing/sessão usam `users/{uid}` (`callback/route.ts:35`, `webhooks/stripe/route.ts:131`), mas todo o conteúdo do app usa `users/{uid}_{firstName}` (`app/api/dna/chat/route.ts:64-66`, `app/api/coach/chat/route.ts:65-67`). Não é um bug por si, mas cria dois namespaces para a mesma pessoa — e o `firstName` deriva de `displayName` (`dna/chat:56-63`), podendo mudar e "mover" os dados de lugar.

### 5.2 Regras de segurança — `firestore.rules`

```
match /{document=**} {
  allow read, write: if request.auth != null;
}
```

`firestore.rules:6-8`, com o comentário `// This is a permissive rule for development - tighten for production` (`:4-5`).

**Implicação:** qualquer usuário autenticado no Firebase (inclusive um free recém-cadastrado) pode **ler e escrever qualquer documento de qualquer usuário** — incluindo `users/{outroUid}`, `users/{outroUid}/billing/current`, `dnaVault`, audições etc. Não há checagem de posse (`request.auth.uid == userId`) nem de tier/`hasAccess`. Combinado com o SDK client (`lib/firestore.utils.ts`, `dna-vault/page.tsx`, `settings/page.tsx` escrevem direto do browser), isso é o achado de maior severidade do levantamento.

### 5.3 Tipos de campo relevantes

- Auth/billing: ver tabela 2.6.
- `updatedAt` é gravado como string ISO (`webhooks/stripe/route.ts:137,149`) e não como `Timestamp` — as coleções de conteúdo usam `serverTimestamp()` (`lib/firestore.utils.ts:28`; `hooks/use-chat.ts:687`).

---

## 6. Inconsistências, duplicações, TODOs e pontos de risco

### 6.1 Duplicação/legado

| # | Achado | Evidência |
|---|---|---|
| 6.1.1 | **Dois endpoints de portal** (`/api/billing/portal` e `/api/create-portal-session`) quase idênticos; a UI usa o **legado** e o moderno só existe nos testes | `billing/portal/route.ts` vs `create-portal-session/route.ts`; `settings/page.tsx:115` |
| 6.1.2 | **Rota de cancelamento inexistente** referenciada como `cancel_url` | `checkout/route.ts:143` vs ausência de `app/api/billing/cancelled/` |
| 6.1.3 | **Dois clientes Stripe independentes**: `lib/stripe.ts:11-16` (com `apiVersion: '2026-05-27.dahlia'` e `appInfo`) vs `lib/stripe/migrationService.ts:12` (`new Stripe(apiKey)` sem versão/`appInfo`) | — |
| 6.1.4 | **Price IDs em dois lugares divergentes**: env (`STRIPE_*_PRICE_ID`) no runtime vs literais hardcoded no script de migração | `lib/billing.ts:52-55` vs `scripts/01-generate-migration-links.ts:41-46` |
| 6.1.5 | **Ramo Kajabi legado inalcançável** com `BILLING_ENGINE=STRIPE` default; `KAJABI_ECONOMY_OFFER_ID` não consta no `env.example`; branch sem teste | `proxy.ts:9,35,74-121`; `env.example` (18 linhas, sem a var) |
| 6.1.6 | **Código morto**: `buildPlatformSessionPayload` + `PlatformSessionPayload` nunca usados | `lib/billing.ts:45-49,146-155` |

### 6.2 Bugs de escrita no Firestore (webhook)

| # | Achado | Evidência |
|---|---|---|
| 6.2.1 | `invoice.payment_succeeded/failed` **não passam `tier`**, então `syncUserBilling` grava `tier: null` em `users/{uid}` (merge sobrescreve o tier existente) e força `cancelAtPeriodEnd: false` | `webhooks/stripe/route.ts:307-311` + `:142-150` |
| 6.2.2 | `hasUsedTrial: undefined` é sanitizado para `null`, sobrescrevendo `true` no doc de billing em replays não-trial (`checkout.session.completed` e `subscription.*`) | `:14-20`, `:232`, `:282` |
| 6.2.3 | `migratedAt` regenerado a cada replay de `checkout.session.completed` (não idempotente para auditoria) | `:236` |
| 6.2.4 | Eventos sem `uid` resolvível são descartados apenas com `logger.warn` (sem fila/retry) | `:192-195`, `:254-257` |
| 6.2.5 | Sem deduplicação por `event.id`; sem checagem de `livemode` | `:160-322` |
| 6.2.6 | Se `stripe.subscriptions.retrieve` falhar e não houver metadata de trial, `subStatus` assume `'active'` | `:201-222` |

### 6.3 Riscos de autenticação/autorização

| # | Risco | Severidade | Evidência |
|---|---|---|---|
| 6.3.1 | Regras do Firestore liberam leitura/escrita de **todos** os documentos para qualquer autenticado (cross-tenant) | **Alta** | `firestore.rules:6-8` |
| 6.3.2 | **Sem enforcement de tier no servidor**: rotas de IA só checam Firebase ID token; gating existe apenas na navegação de página (edge). Bypass trivial por chamada direta à API | **Alta** | `dna/chat/route.ts:24-28`; `coach/chat/route.ts:13-16`; matcher em `proxy.ts:129-140` |
| 6.3.3 | `/api/billing/success` é isento de auth e emite `platform_session` a partir do `client_reference_id` do `session_id` da query, **sem verificar se a Checkout Session pertence ao chamador** — vetor de fixação de sessão/impersonação para quem obtiver um `session_id` | **Alta** | `proxy.ts:26-30`; `billing/success/route.ts:24-42,72-92` |
| 6.3.4 | JWT de 7 dias sem revogação; logout só apaga o cookie (stateless); falha no logout é engolida no cliente | Média | `lib/session.ts:38,94-97`; `AuthContext.tsx:283-287`; `README.md:670,831` |
| 6.3.5 | `GET /api/auth/callback` responde 401 mas o `AuthContext` cai para `free` sem encerrar a sessão do Firebase — usuário "logado" sem entitlement vê a UI | Baixa | `callback/route.ts:80-82`; `AuthContext.tsx:310-323` |
| 6.3.6 | Cookie `sameSite: 'lax'` (e `secure` só em produção) — mais fraco que o documentado no README | Média | `lib/session.ts:71-72` vs `README.md:639-640` |
| 6.3.7 | `lib/billing.ts` lança na importação sem env de Stripe — pode derrubar build/deploy e testes de módulos não relacionados | Média | `lib/billing.ts:58-64` |
| 6.3.8 | Duas origens de sessão (cookie JWT vs Firebase ID token) coexistem nas mesmas rotas, sem versão/`aud` no JWT; um token Firebase válido ignora tier | Média | `checkout/route.ts:30-42`; `billing/portal/route.ts:19-43` |
| 6.3.9 | Rotas não cobertas pelo matcher: `/dna-vault`, `/reader-copilot`, `/actors/*`, `/upgrade`; auth só client-side via `ProtectedRoute` | Média | `proxy.ts:129-140`; `app/(interior)/layout.tsx:24` |

### 6.4 TODOs

- `lib/firebase.ts:8` — validação de env com Zod no build.
- `lib/firebase.admin.ts:17` — mesma ideia para segredos do Admin.
- `README.md:825-831` — Zod para env; rate limiting em auth; retry de webhook Stripe; migrar execução de IA para server-side; blacklist de JWT no logout.
- `firestore.rules:4-5` — "tighten for production".

### 6.5 Variáveis de ambiente

`env.example` (18 linhas) cobre Firebase client/admin, `JWT_SECRET`, `BILLING_ENGINE` e as 4 price IDs + webhook secret. **Ausentes** e usadas no código: `NEXT_PUBLIC_APP_URL` (`checkout/route.ts:119`), `APP_URL` (portal, `:75`), `STRIPE_CUSTOMER_PORTAL_RETURN_URL` (`billing/portal/route.ts:76`), `KAJABI_ECONOMY_OFFER_ID` (`proxy.ts:97`), `RESEND_API_KEY` (`scripts/02-send-migration-emails.ts:5`). O código aceita `JWT_SECRET_KEY` **ou** `JWT_SECRET` (`lib/session.ts:21`), mas só o segundo é documentado.

### 6.6 Duplicação da lista de status ativos

A tripla `['active','trialing']` aparece em `lib/billing.ts:147`, `proxy.ts:51` e `app/api/webhooks/stripe/route.ts:223,264` — quatro cópias independentes da mesma regra de negócio; alterar uma não altera as outras.

---

## 7. Resumo executivo por camada

| Camada | Autenticação | Autorização por tier |
|---|---|---|
| Navegador (React) | Firebase Auth (Google popup / e-mail+senha) | Nenhuma barreira real; apenas rótulos e `ProtectedRoute` (auth-only) |
| Edge (`proxy.ts`) | Valida JWT `platform_session` (HS256, 7d) | Por prefixo de rota: free/inativo só `/dashboard*`; economy sem `/profile*` e `/acting-coach*`; business tudo |
| API Routes (IA/billing) | Firebase ID token (`Bearer`) ou cookie de sessão | **Inexistente** nas rotas de IA; billing valida trial/customer |
| Firestore | Firebase Auth (client SDK) + Admin SDK (bypass) | Regras liberam tudo para qualquer autenticado |
| Stripe | Assinatura de webhook (HMAC via `STRIPE_WEBHOOK_SECRET`) | Tier derivado de price ID/metadata e status `active`/`trialing` |

---

## 8. README × código (divergências explícitas)

| Afirmação no README | Realidade no código |
|---|---|
| `sameSite: 'strict'` e `secure: true` no cookie de sessão (`README.md:636-643`) | `sameSite: 'lax'` e `secure: NODE_ENV === 'production'` (`lib/session.ts:71-72`) |
| Cookie gravado em `callback/route.ts:71/73` (`README.md:650-651`) | A gravação está em `lib/session.ts:65-76`; `callback/route.ts` tem 96 linhas e apenas chama `setPlatformSession` |
| Lista `/api/billing/portal` como o serviço de portal (`README.md:224`) | A UI usa `/api/create-portal-session` (`settings/page.tsx:115`); `/api/billing/portal` é duplicado não usado |
| `chat-sidebar.tsx` com "tier-aware control gates" (`README.md:141`) | Nenhuma referência a tier no arquivo |
| "Known TODOs" cobre rate limiting, blacklist, retry (`README.md:825-831`) | Correto, mas omite: ausência de enforcement de tier no servidor, regras Firestore abertas, rota `/api/billing/cancelled` inexistente e idempotência de webhook |
| `app/api/auth/callback/route.ts` com 183 linhas (`README.md:813`) | O arquivo tem 96 linhas |
| Firestore Collections (`README.md:313-323`) | Não documenta `users/{uid}/billing/current` nem o espelho `users/{uid}`, que são o núcleo do billing |
| Configuração (`README.md:756-781`) | Omite `NEXT_PUBLIC_APP_URL`, `APP_URL`, `STRIPE_CUSTOMER_PORTAL_RETURN_URL`, `KAJABI_ECONOMY_OFFER_ID`, `RESEND_API_KEY` e `JWT_SECRET_KEY` |

---

## 9. Índice de evidências (arquivo:linha)

- Sessão/JWT: `lib/session.ts:2,9-27,34-40,48-58,65-76,82-88,94-97`
- Callback: `app/api/auth/callback/route.ts:21-26,35-46,49-58,60-63,76-91`
- Logout: `app/api/auth/logout/route.ts:10-18`; `lib/context/AuthContext.tsx:275-288`
- Middleware: `proxy.ts:9,18-69,74-121,129-140`; testes `proxy.test.ts:36-110`
- ProtectedRoute/layout: `lib/context/ProtectedRoute.tsx:19-23,54`; `app/(interior)/layout.tsx:24-36`
- Tiers/preços: `lib/billing.ts:7,12-20,26-39,45-49,52-64,72-97,104-119,146-155`; `app/(interior)/upgrade/page.tsx:200,209,215-238`; `subscriptions.csv:2-4`
- Trial: `app/api/billing/checkout/route.ts:48-50,64-96,139,141`; `app/login/page.tsx:67-86`; `AuthContext.tsx:78-111`
- Checkout: `app/api/billing/checkout/route.ts:17-46,99-116,119-154`
- Portal: `app/api/billing/portal/route.ts:19-43,50-76`; `app/api/create-portal-session/route.ts:19-44,54-82`; `settings/page.tsx:105-136`
- Success: `app/api/billing/success/route.ts:23-42,47-66,72-92`
- Webhook: `app/api/webhooks/stripe/route.ts:8,14-20,48-125,130-158,160-175,179-320`
- Firestore: `firestore.rules:4-8`; `lib/firestore.utils.ts:24,39,57`; `app/api/dna/chat/route.ts:64-66`; `app/api/coach/chat/route.ts:61-62`
- Migração: `lib/stripe/migrationService.ts:12,43-62,73-133`; `scripts/01-generate-migration-links.ts:41-46,79-152`
- Env: `env.example:1-18`
