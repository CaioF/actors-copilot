# 03 — Páginas e Rotas

> Inventário completo das rotas do App Router, o que cada uma faz, se é Server ou Client Component, como é protegida e quais componentes/hooks usa.
> Verificado no código do commit `32f7f74`.

---

## 1. Mapa geral

```
/                                  → Landing (pública)
/login                             → Autenticação (pública)
/actors/[slug]                     → Perfil público do ator (pública)
/actors/[slug]/index.md            → Mesmo perfil em Markdown (para LLMs) (pública)

── grupo (interior): layout autenticado com sidebar ─────────────────
/dashboard                         → Hub principal
/chat                              → Personal DNA (conversa socrática) ⚠️ fora do grupo
/personal-dna                      → CTA estática (não é o chat)
/dna-vault                         → Visualização do Master Profile
/auditions                         → Audition Tracker (lista)
/auditions/new/brief               → Wizard: Casting Brief Breakdown
/auditions/new/sides               → Wizard: Character Breakdown (sides)
/auditions/[id]                    → Detalhe da audição
/reader-copilot                    → Seletor de cena para ensaio
/reader-copilot/[id]               → Ensaio de uma audição específica
/acting-coach                      → Chat do Acting Coach (geral ou de personagem)
/profile                           → Editor do perfil profissional
/settings                          → Conta, billing e exclusão de dados
/upgrade                           → Planos (Economy / Business)

── API ─────────────────────────────────────────────────────────────
/api/auth/callback                 POST, GET
/api/auth/logout                   POST
/api/billing/checkout              POST
/api/billing/portal                POST
/api/billing/success               GET
/api/create-portal-session         POST
/api/webhooks/stripe               POST
/api/dna/chat                      POST
/api/dna/synthesize                POST
/api/dna/baseline                  POST
/api/dna/transcribe/chat           POST
/api/dna/transcribe/history        POST
/api/auditions/analyzeBrief        POST
/api/auditions/analyzeSides        POST
/api/coach/chat                    POST
/api/coach/updateDna               POST
/api/profile/autofill              POST
/api/actor-copilot/parse-script    POST
/api/actor-copilot/tts             POST
```

> ❗ **Não existe rota `/auditions/new`**. Apenas `/auditions/new/brief` e `/auditions/new/sides`. O README do repositório lista `/auditions/new` — está incorreto. Não há `page.tsx` em `auditions/new/`, nem `redirect()` em `app/**`, nem `rewrites()` em `next.config.mjs` → `/auditions/new` responde **404**.

**Contagem:** 17 `page.tsx` (12 Client · 5 Server) · 4 `layout.tsx` · 1 `not-found.tsx` (só em `/actors/[slug]`) · 20 route handlers · 1 route group (`(interior)`) · 2 segmentos dinâmicos (`[slug]`, `[id]`) · nenhum catch-all, Server Action ou `generateStaticParams`.

> ⚠️ **Faltam arquivos de convenção globais:** não há `app/not-found.tsx`, `app/error.tsx` nem `app/loading.tsx`. Erros e 404 fora de `/actors/[slug]` caem no padrão do Next.
>
> ⚠️ **`generateMetadata` só existe em `app/actors/[slug]/page.tsx`.** Demais páginas herdam apenas o `metadata` do root layout (`title: 'The Actors Copilot - Self Tape Copilot'`).
>
> ⚠️ `next.config.mjs` define `images.unoptimized: true` — o otimizador de imagens do Next está desligado no app inteiro.

---

## 2. Rotas públicas

### `/` — Landing
- **Arquivo:** `app/page.tsx` (Server Component, 118 linhas)
- **Função:** página de boas-vindas/teaser de marca. Fundo escuro (`#152323`) com "spotlight" e gradientes, título em Antonio (`Welcome to / The Actors Copilot / your acting assistant`) e um logotipo (`/image.png`) que é um `<Link href="/dashboard">`.
- **Proteção:** nenhuma. Clicar no emblema leva para `/dashboard`, que então cai no middleware → `/login` se não autenticado.
- **Observação:** não há CTA de login explícito; a navegação acontece pelo logo.

### `/login` — Autenticação
- **Arquivo:** `app/login/page.tsx` (Client Component, 553 linhas)
- **Função:** tela única com dois modos alternáveis (`"login"` | `"signup"`). Suporta:
  - Google OAuth (`loginWithGoogle`)
  - E-mail/senha (`loginWithEmail` / `signupWithEmail`)
  - Reset de senha (`sendPasswordReset`)
- **Parâmetros de URL:**
  - `?mode=signup` abre no modo cadastro
  - `?plan=economy|business` grava `sessionStorage.trial_intent = "14d"` e `trial_tier`, para iniciar o **checkout de trial de 14 dias** logo após a autenticação
- **Pós-login:** `AuthContext.handlePostAuthRedirect()` → se houver `trial_intent`, chama `/api/billing/checkout` com `isTrial: true` e redireciona para o Stripe; senão vai para `/dashboard`.
- **Proteção:** pública, mas `/login` **não está no matcher** do middleware.

### `/actors/[slug]` — Perfil público do ator
- **Arquivo:** `app/actors/[slug]/page.tsx` (Server Component, 95 linhas) + `app/actors/layout.tsx`
- **Layout (`app/actors/layout.tsx`):** `PublicNavbar` + `<main>` + `PublicFooter`, sobre fundo `#F0E8DC` — chrome totalmente independente do app autenticado.
- **Função:** renderiza o perfil profissional publicado para casting directors. Busca em `actorProfiles` por `slug` + `status == "published"` (`lib/get-public-profile.ts`, envolto em `React.cache`).
- **Seções renderizadas condicionalmente:** `HeroSection`, `PhotosSection`, `DetailsSection`, `ShowreelsSection`, `AboutSection`, `CreditsSection`, `TrainingSection`, `SkillsSection`, botão de download do CV.
- **SEO:** `generateMetadata` gera título/descrição/OpenGraph, e declara `alternates.types["text/markdown"] = /actors/{slug}/index.md`.
- **404:** `app/actors/[slug]/not-found.tsx` para slug inexistente/não publicado.

### `/actors/[slug]/index.md` — Perfil em Markdown (LLM-friendly)
- **Arquivo:** `app/actors/[slug]/index.md/route.ts` (Route Handler, GET, 61 linhas)
- **Função:** mesma consulta do perfil público, convertida para Markdown por `lib/profile-to-markdown.ts` e servida como `text/markdown` com `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`. Usa o SDK Admin.
- **Uso:** agentes/LLMs podem consumir o perfil de forma estruturada.

> ⚠️ `/actors/**` **não passa** pelo middleware — é intencionalmente público, mas depende de o perfil estar `published`.

---

## 3. Rotas autenticadas — grupo `(interior)`

Todas herdam `app/(interior)/layout.tsx`, que envolve tudo em:
`SidebarProvider → ProtectedRoute → AppSidebar + coluna de conteúdo + DashboardFooter`.

> 🟢 As 13 páginas do grupo: `dashboard`, `personal-dna`, `dna-vault`, `auditions`, `auditions/new/brief`, `auditions/new/sides`, `auditions/[id]`, `reader-copilot`, `reader-copilot/[id]`, `acting-coach`, `profile`, `settings`, `upgrade`.
>
> 🟡 `MicFab` é **importado mas nunca renderizado** em `app/(interior)/layout.tsx:2` — código morto nesse layout.

> ⚠️ O grupo `(interior)` **não** inclui `/chat`: `app/chat/layout.tsx` é um layout separado que só envolve a página em `SidebarProvider` (5 linhas). Portanto `/chat` **não tem sidebar do app nem `ProtectedRoute`** — depende exclusivamente do middleware de borda e do 401 das APIs. Ele monta o próprio chrome (header + `ChatSidebar` interno).

### `/dashboard` — Hub principal
- **Arquivo:** `app/(interior)/dashboard/page.tsx` (Client, 254 linhas). Título: **"My Self Tape Copilot"**.
- **Função:** hub com hero (`/image1.png`, citação de Stella Adler), grid de 3 cards de entrada (Personal DNA → `/chat`, Audition Breakdown → `/auditions/new/brief`, Scene Study → `/auditions/new/sides`).
- **Regras:**
  - Se a URL trouxer `?session_id=` (retorno do Stripe), faz `router.refresh()` e limpa a query.
  - Na primeira visita (por usuário), abre o `IntroVideoModal`; a flag `hasSeenIntroVideo` vive em `actorProfiles/{uid}` via `lib/firestore.utils.ts`.

### `/chat` — Personal DNA (conversa socrática)
- **Arquivo:** `app/chat/page.tsx` (Client, 244 linhas) + `app/chat/layout.tsx`
- **Função:** a experiência central de extração. Usa `useChat()` (mensagens, sessão, envio, troca de seção, streaming) + `useSessionTimer()` (check-in de pausa) + `useChatTimeTracker()` (tempo de sessão).
- **UI:** `ChatSidebar` (progresso por capítulo/arena), `ChatMessages`, `ChatInput` (com microfone/upload), `ChatHelpModal`, `HistoryUploadModal`, `BreakCheckInModal`.
- **Regras:** navega por **4 capítulos** (`DNA_CHAPTERS`: `chapter_1`..`chapter_4`), não pelas 12 arenas diretamente. O nome do ator vem do `displayName` do Firebase.
- **Proteção:** middleware (está no matcher) + `useChat` exige `Authorization: Bearer <idToken>`.

### `/personal-dna` — CTA estática (rota órfã)
- **Arquivo:** `app/(interior)/personal-dna/page.tsx` (Server, 27 linhas)
- **Função:** apenas uma tela com botão "Start Building DNA" **sem `href`/handler**. Não é o chat real (esse é `/chat`). O botão da sidebar "Personal DNA" aponta para `/chat`.
- **Status:** candidata a remoção ou a redirect para `/chat`.

### `/dna-vault` — Visualização do DNA
- **Arquivo:** `app/(interior)/dna-vault/page.tsx` (Client, 594 linhas). Título: **"Personal DNA Vault"**.
- **Função:** apresenta o DNA em **abas internas** (`overview` / `insights` / `memory`, controladas por state — não pelo componente `Tabs`), com `HeroSummary`, `DnaVaultGrid`, `AccordionCard`, `AttributeRow`, `TraitBadge`, busca e filtro por seção.
- **Dados:** faz *parse* de `users/{userPath}/profile/master` via `lib/dna/dna-parser.ts:49`; também **tenta** ler a subcoleção `dnaVault` (que nunca é escrita — ver doc 02 §4.11).
- **Proteção:** ⚠️ **não está no matcher** do middleware — só `ProtectedRoute` (autenticação, sem gate de tier).

### `/auditions` — Audition Tracker
- **Arquivo:** `app/(interior)/auditions/page.tsx` (Client, 549 linhas). Título: **"Audition Tracker"**.
- **Função:** lista as audições de `users/{userPath}/auditions` com busca, filtros de status **All / Draft / Processing / Completed**, CRUD (edição inline "Edit Audition Details" + `AlertDialog` de exclusão) e ações: abrir detalhe, imprimir, refazer breakdown (brief/sides com `?enrichAuditionId=`).
- **Navegação:** `router.push('/auditions/new/brief?enrichAuditionId=...')`, `/auditions/new/sides?...`, `/auditions/{id}`, `/auditions/{id}?action=print`.

### `/auditions/new/brief` — Wizard (Casting Brief Breakdown)
- **Arquivo:** `app/(interior)/auditions/new/brief/page.tsx` (Server, 27 linhas). Título: **"New Casting Brief Breakdown"**.
- **Função:** página fina que renderiza `<AuditionWizard mode="brief" auditionId={searchParams.enrichAuditionId} />`.
- **Uso:** transformar e-mail/PDF de casting em checklist cronológico + fatos críticos.

### `/auditions/new/sides` — Wizard (Character Breakdown / Scene Study)
- **Arquivo:** `app/(interior)/auditions/new/sides/page.tsx` (Server, 27 linhas). Título: **"New Character Breakdown"**.
- **Função:** `<AuditionWizard mode="sides" ... />` — decupagem das falas em Performance Map.

### `/auditions/[id]` — Detalhe da audição
- **Arquivo:** `app/(interior)/auditions/[id]/page.tsx` (Client, 428 linhas)
- **Função:** mostra o Performance Map/resultado da análise; botões para:
  - abrir Reader Copilot (`/reader-copilot/{id}`)
  - refazer brief/sides (`/auditions/new/brief|sides?enrichAuditionId={id}`)
  - iniciar Acting Coach no contexto da audição (`/acting-coach?...`)
  - imprimir (`?action=print`, com `PerformanceMapPrintBlock`)

### `/reader-copilot` — Ensaiador (seletor)
- **Arquivo:** `app/(interior)/reader-copilot/page.tsx` (Client, 261 linhas). Título: **"Reader Copilot"**.
- **Função:** lista até 15 audições que têm `sidesText`, permite colar/upload de um roteiro próprio, chama `/api/actor-copilot/parse-script` e então renderiza `<ActorCopilotRehearsal />`.
- **Regra:** lê `users/{uid}_{FirstName}/auditions` ordenado por `createdAt desc`, filtrando os que possuem texto de sides.
- **Proteção:** ⚠️ **não está no matcher** do middleware.

### `/reader-copilot/[id]` — Ensaio de uma audição
- **Arquivo:** `app/(interior)/reader-copilot/[id]/page.tsx` (Client, 152 linhas)
- **Função:** carrega a audição e abre o ensaio direto; `onExit` volta para `/auditions/{id}`.

### `/acting-coach` — Chat do Acting Coach
- **Arquivo:** `app/(interior)/acting-coach/page.tsx` (Client, 355 linhas)
- **Parâmetros:** `?auditionId=...` → modo **Character Coach** (vinculado a uma audição); sem parâmetro → modo **general**.
- **Função:** chat com `useActingCoach()`, `FlightPlan`, `RehearsalRunner`, `AuditionPlanCard`, `QuickPromptsDropdown`, `CoachSuggestionChips`, indicador de sessão e "Currently working on: {sessionFocus}".
- **Regras:** `coachType: "general" | "character"`; histórico limitado; foco flutuante (`sessionFocus`, `stepIndex`, `mode`, `phase`) persistido por sessão.
- **Proteção:** middleware **bloqueia para tier `economy`** (recurso Business) → `/upgrade`.

### `/profile` — Editor do perfil profissional
- **Arquivo:** `app/(interior)/profile/page.tsx` (Client, 401 linhas). Título: **"My Profile"**.
- **Função:** formulário com `useForm<ActorProfile>` + Zod; auto-save com debounce de 2s; `publishProfile()` grava `status: "published"` + `publishedAt`; slug gerado de `fullName`.
- **Composição:** `ProfileHeader` (publish/save/URL) + `ActorProfileForm` (coluna esquerda) + `ProfileLivePreview` (coluna direita, sticky) + `ImdbAutofill`.
- **Persistência:** `actorProfiles/{uid}` com `merge: true`.
- **Proteção:** middleware **bloqueia para tier `economy`**.

### `/settings` — Conta, billing e exclusão de dados
- **Arquivo:** `app/(interior)/settings/page.tsx` (Client, 719 linhas). Título: **"Settings"**.
- **Função:**
  - editar `displayName`; upload de avatar (máx. 2MB) para `avatars/{uid}.{ext}` no Storage
  - reset de senha por e-mail
  - gerenciar assinatura → `/api/create-portal-session` (Stripe Customer Portal)
  - **excluir dados de chat** (batch delete de `dnaSessions/*`, `coachSessions/*` + mensagens, `profile/master`)
  - **excluir conta** (o acima + `dnaVault/*`, `auditions/*`, doc raiz do usuário, avatar no Storage e a conta Firebase Auth)
  - excluir apenas o perfil público (`actorProfiles/{uid}`)
- **Proteção:** middleware (está no matcher).

### `/upgrade` — Planos
- **Arquivo:** `app/(interior)/upgrade/page.tsx` (Client, 253 linhas). Título: **"Choose your plan."**
- **Função:** toggle mensal/anual e dois `PricingCard`:
  - **Economy Class** — US$ 19,00/mês ou US$ 15,00/mês (anual, −20%)
  - **Business Class** — US$ 29,00/mês ou US$ 23,00/mês (anual, −20%)
- **Ação:** `POST /api/billing/checkout { tier, billingCycle }` → redireciona para o Stripe.
- **Proteção:** ⚠️ `/upgrade` **não está no matcher**, então é acessível a qualquer autenticado (inclusive `free`) — o que é necessário, já que é o destino dos redirects de bloqueio.

---

## 4. API endpoints (detalhado)

### Autenticação e sessão

| Rota | Métodos | Auth | O que faz |
|---|---|---|---|
| `/api/auth/callback` | `POST` | Firebase ID token no body | `verifyIdToken` → lê `users/{uid}/billing/current` → assina JWT (`platform_session`) com tier/status/customerId e seta cookie httpOnly. Retorna `{ success, user: { uid, email, tier, subscriptionStatus } }`. |
| `/api/auth/callback` | `GET` | Cookie `platform_session` | Hidrata o frontend: `{ authenticated, tier, subscriptionStatus, stripeCustomerId }` ou `401`. |
| `/api/auth/logout` | `POST` | — | Apaga o cookie `platform_session`. |

### Billing

| Rota | Método | O que faz |
|---|---|---|
| `/api/billing/checkout` | POST | Cria sessão de Checkout Stripe para `tier` + `billingCycle` (mensal/anual) ou trial de 14 dias (`isTrial`). Retorna `{ url }`. |
| `/api/billing/portal` | POST | Cria sessão do Customer Portal (endpoint "novo"). |
| `/api/create-portal-session` | POST | Também cria sessão do Customer Portal (endpoint "legado", usado por `/settings`). ⚠️ Duplicidade. |
| `/api/billing/success` | GET | Página de retorno do Stripe; **isenta do middleware** (`proxy.ts:26-30`) e redireciona para `/dashboard`. |
| `/api/webhooks/stripe` | POST | Verifica assinatura (`verifyStripeWebhookEvent`) e sincroniza assinatura → `users/{uid}/billing/current`. |

### Personal DNA

| Rota | Método | O que faz |
|---|---|---|
| `/api/dna/chat` | POST | Núcleo da extração. `Bearer` obrigatório. Roda **YAN** (`gemini-3.1-pro-preview`) de forma bloqueante e **MEMLISTENER** (`gemini-2.5-pro`, temp 0.1, function calling) em background via `after()`. Retorna `{ aiData: { coach_reply, extractions: null }, selectedQuestions: [...] }`. |
| `/api/dna/synthesize` | POST | Sintetiza as extrações no Master Profile (com cache). |
| `/api/dna/baseline` | POST | Upload de documento-base (PDF/texto) para extração em lote. |
| `/api/dna/transcribe/chat` | POST | Transcreve áudio do chat. |
| `/api/dna/transcribe/history` | POST | Transcreve áudio + extração psicológica. |

### Audições

| Rota | Método | O que faz |
|---|---|---|
| `/api/auditions/analyzeBrief` | POST | Transforma casting brief (texto/PDF/DOCX) em `PerformanceMap` cronológico + `criticalBriefFacts`. Sensível ao `projectType` (`cinematic`/`theater`/`commercial`). |
| `/api/auditions/analyzeSides` | POST | Decupa as sides em `PerformanceMap` usando o DNA como lente. Suporta `breakdownDepth: "complete" \| "quick"` e canal `criticalBriefFactsPayload`. |

### Acting Coach

| Rota | Método | O que faz |
|---|---|---|
| `/api/coach/chat` | POST | Monta o prompt com baseline do ator + audições + histórico (últimas ~20 msg) + foco atual; chama Gemini; devolve envelope JSON `{ coach_reply, session_focus, step_index, mode, phase }`. |
| `/api/coach/updateDna` | POST | Permite ao usuário promover insights do coach para o DNA/Master Profile. |

### Perfil e utilitários

| Rota | Método | O que faz |
|---|---|---|
| `/api/profile/autofill` | POST | IMDb autofill: Firecrawl faz scraping da página, combina com o DNA e sintetiza um `ActorProfile` parcial. |
| `/api/actor-copilot/parse-script` | POST | Faz o parsing de um roteiro/sides em `SceneData` (personagens + falas) para o Reader Copilot. Bearer obrigatório; **403 se o `userPath` do body não contiver o `uid` do token**. |
| `/api/actor-copilot/tts` | POST | Text-to-speech expressivo via Gemini Flash (com modelo de fallback); retorna WAV. Bearer obrigatório; 400 se `text` ausente. |

---

## 5. Matriz de proteção (middleware × rota)

| Rota | No matcher? | `free` / assinatura inativa | `economy` | `business` |
|---|---|---|---|---|
| `/dashboard/**` | ✅ | permitido | permitido | permitido |
| `/chat/**` | ✅ | → `/upgrade` | permitido | permitido |
| `/auditions/**` | ✅ | → `/upgrade` | permitido | permitido |
| `/personal-dna/**` | ✅ | → `/upgrade` | permitido | permitido |
| `/settings/**` | ✅ | → `/upgrade` | permitido | permitido |
| `/profile/**` | ✅ | → `/upgrade` | **→ `/upgrade`** | permitido |
| `/acting-coach/**` | ✅ | → `/upgrade` | **→ `/upgrade`** | permitido |
| `/api/billing/success` | ✅ (isento) | passa direto | passa direto | passa direto |
| `/dna-vault/**` | ❌ | só `ProtectedRoute` | só `ProtectedRoute` | só `ProtectedRoute` |
| `/reader-copilot/**` | ❌ | só `ProtectedRoute` | só `ProtectedRoute` | só `ProtectedRoute` |
| `/upgrade`, `/login`, `/`, `/actors/**` | ❌ | público / livre | público / livre | público / livre |

---

## 6. Navegação (sidebar)

`components/app-sidebar.tsx` (227 linhas, Client). Largura 256 px (`w-64`), fundo `#2A3B31`, fecha no mobile por `useSidebar()` e no clique de rota.

**Quick Actions:**
- Audition Breakdown → `/auditions/new/brief`
- Scene Study → `/auditions/new/sides`

**Menu principal:**

| Label | href | Ícone |
|---|---|---|
| Dashboard | `/dashboard` | `Home` |
| Reader Copilot | `/reader-copilot` | `Clapperboard` |
| Personal DNA | `/chat` | `Sparkles` |
| Acting Coach | `/acting-coach` | `BookOpen` |
| Auditions | `/auditions` | `Mic` |
| Profile | `/profile` | `User` |
| DNA Vault | `/dna-vault` | `Dna` |

**Bloco de plano:** botão "Upgrade Plan" / "Manage Plan" (quando `tier === "business"`) → `/upgrade`; link externo "Skool Community" (`https://www.skool.com/the-actors-copilot`).

**Rodapé:** Settings (`/settings`), Logout.

> ⚠️ O README lista a sidebar antiga (sem Reader Copilot/DNA Vault e com `Personal DNA → /chat`). O código acima é o atual.
