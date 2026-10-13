# Relatório 1 — Inventário de Páginas, Rotas e Route Handlers

> Projeto: **The Actor's Copilot** (`/workspace/projects/Caio/actors-copilot`)
> Stack: Next.js `16.1.6` (App Router) · React `19.2.4` · TypeScript `5.7.3` · Tailwind CSS `4.2.0`
> Escopo: **todas** as rotas sob `app/`, incluindo páginas, layouts, `not-found`, route groups e API route handlers.
> Método: leitura direta do código-fonte. Toda afirmação é rastreável a `caminho:linha`. Nada foi inferido de documentação externa sem indicar a fonte.

---

## 1. Sumário executivo

| Métrica | Valor |
|---|---|
| `page.tsx` | **17** (13 no grupo `(interior)` + `/`, `/login`, `/chat`, `/actors/[slug]`) |
| `layout.tsx` | **4** — `app/layout.tsx`, `app/(interior)/layout.tsx`, `app/chat/layout.tsx`, `app/actors/layout.tsx` |
| `not-found.tsx` | **1** (`app/actors/[slug]/not-found.tsx`) — **não existe** `app/not-found.tsx` global |
| `route.ts` (route handlers) | **20** (19 sob `app/api/**` + 1 em `app/actors/[slug]/index.md/`) |
| Client Components de página | **12** (`"use client"`) |
| Server Components de página | **5** |
| Route groups | 1 — `(interior)` |
| Segmentos dinâmicos | `[slug]` (perfil público), `[id]` (audições e reader-copilot) |
| Catch-all (`[...x]`) | **nenhum** |
| Middleware/proxy | `proxy.ts` (raiz do projeto; convenção `proxy.ts` do Next.js 16, que substitui `middleware.ts`) |
| Rotas com `metadata` | 2 (root layout + `generateMetadata` em `app/actors/[slug]/page.tsx`) |
| Rotas com `redirect()`/`rewrites()` | **nenhuma** — não há `redirect()` em `app/**` nem `rewrites()` em `next.config.mjs` |

---

## 2. Árvore de diretórios de `app/`

```
app/
├── layout.tsx                                  # Root layout (Server)
├── page.tsx                                    # / (landing, Server)
├── globals.css
├── login/page.tsx                              # /login (Client)
├── chat/
│   ├── layout.tsx                              # layout do /chat (Server, só SidebarProvider)
│   └── page.tsx                                # /chat (Client)
├── (interior)/                                 # ROUTE GROUP (não aparece na URL)
│   ├── layout.tsx                              # Shell autenticado (Server)
│   ├── dashboard/page.tsx                      # /dashboard
│   ├── personal-dna/page.tsx                   # /personal-dna (Server, placeholder)
│   ├── dna-vault/page.tsx                      # /dna-vault
│   ├── auditions/
│   │   ├── page.tsx                            # /auditions
│   │   ├── [id]/page.tsx                       # /auditions/[id]
│   │   └── new/                                # ⚠️ SEM page.tsx → /auditions/new = 404
│   │       ├── brief/page.tsx                  # /auditions/new/brief (Server async)
│   │       └── sides/page.tsx                  # /auditions/new/sides (Server async)
│   ├── reader-copilot/
│   │   ├── page.tsx                            # /reader-copilot
│   │   └── [id]/page.tsx                       # /reader-copilot/[id]
│   ├── acting-coach/page.tsx                   # /acting-coach
│   ├── profile/page.tsx                        # /profile
│   ├── settings/page.tsx                       # /settings
│   └── upgrade/page.tsx                        # /upgrade
├── actors/
│   ├── layout.tsx                              # Layout público (Server)
│   └── [slug]/
│       ├── page.tsx                            # /actors/[slug] (Server async)
│       ├── not-found.tsx                       # UI de 404 do perfil
│       └── index.md/route.ts                   # GET /actors/[slug]/index.md
└── api/
    ├── actor-copilot/{parse-script,tts}/route.ts
    ├── auditions/{analyzeBrief,analyzeSides}/route.ts
    ├── auth/{callback,logout}/route.ts
    ├── billing/{checkout,portal,success}/route.ts
    ├── coach/{chat,updateDna}/route.ts
    ├── create-portal-session/route.ts
    ├── dna/{baseline,chat,synthesize}/route.ts
    ├── dna/transcribe/{chat,history}/route.ts
    ├── profile/autofill/route.ts
    └── webhooks/stripe/route.ts
```

Diretórios que **não** contêm `page.tsx` ou `route.ts` (portanto não geram rota): `app/(interior)/auditions/new/` (ver §7.1), `app/api/dna/transcribe/` (só subpastas).

---

## 3. Tabela mestra de rotas (páginas e layouts)

| URL | Arquivo | Segmento / tipo | RSC? | Papel `page`/`layout` | Proteção de auth | `metadata` |
|---|---|---|---|---|---|---|
| `/` | `app/page.tsx` | estático | **Server** | `page` — landing com holofote/spotlight animado (`Image /image.png`, `/spotlight.png`) e CTA-link para `/dashboard` | Pública | herdada do root |
| `/login` | `app/login/page.tsx` | estático | **Client** (`"use client"` L1) | `page` — login/signup Firebase (e-mail/senha + Google), reset de senha, detecção de intenção de trial via query `?trial`/`?plan`/`?mode` | Pública | herdada |
| `/chat` | `app/chat/page.tsx` | estático | **Client** (L1) | `page` — chat de extração de DNA (Personal DNA), capítulos/sessões, atalhos, modais de break/help/upload | Proxy (matcher `/chat/:path*`) — **sem `ProtectedRoute`** | herdada |
| *(layout)* | `app/chat/layout.tsx` | layout | Server | envolve `/chat` apenas com `SidebarProvider` (L4) | — | — |
| `/dashboard` | `app/(interior)/dashboard/page.tsx` | estático | **Client** (L1) | `page` — hub: hero "My Acting Copilot", 3 cards (Personal DNA → `/chat`, Audition Breakdown → `/auditions/new/brief`, Independent Study → `/auditions/new/sides`), banner de gravação de memória, CTA "Upload Baseline", modal de vídeo intro | Proxy (`/dashboard/:path*`) + `ProtectedRoute` | herdada |
| `/personal-dna` | `app/(interior)/personal-dna/page.tsx` | estático | **Server** | `page` — placeholder estático: título + botão "Start Building DNA" **sem `onClick`/link** (rota órfã) | Proxy + `ProtectedRoute` | herdada |
| `/dna-vault` | `app/(interior)/dna-vault/page.tsx` | estático | **Client** (L1) | `page` — abas internas `overview`/`insights`/`memory` (state, não `Tabs`), `HeroSummary`, `DnaVaultGrid`, busca/filtro por seção | `ProtectedRoute` **apenas** — ⚠️ **não** está no matcher do proxy | herdada |
| `/auditions` | `app/(interior)/auditions/page.tsx` | estático | **Client** (L1) | `page` — tracker (lista + busca + filtros `All/Draft/Processing/Completed` + CRUD, edição inline, `AlertDialog` de exclusão, atalhos para wizard com `?enrichAuditionId=`) | Proxy + `ProtectedRoute` | herdada |
| `/auditions/new/brief` | `app/(interior)/auditions/new/brief/page.tsx` | estático (2 segmentos) | **Server async** (L13, `searchParams` é `Promise`) | `page` — renderiza `<AuditionWizard mode="brief" auditionId={enrichAuditionId} />` (L23) | Proxy + `ProtectedRoute` | herdada |
| `/auditions/new/sides` | `app/(interior)/auditions/new/sides/page.tsx` | estático | **Server async** (L13) | `page` — `<AuditionWizard mode="sides" .../>` (L23) | Proxy + `ProtectedRoute` | herdada |
| `/auditions/[id]` | `app/(interior)/auditions/[id]/page.tsx` | **dinâmico `[id]`** | **Client** (L1) + `Suspense` (L44–50) | `page` — detalhe da audição; renderiza `StepResultSides` e/ou `StepResultBrief` (com abas quando há ambas), bloco oculto `PerformanceMapPrintBlock` + `useReactToPrint` (L72) | Proxy + `ProtectedRoute` | herdada |
| `/reader-copilot` | `app/(interior)/reader-copilot/page.tsx` | estático | **Client** (L1) | `page` — launcher do ensaio: lista audições com `sidesText`, textarea de script novo, chama `/api/actor-copilot/parse-script` e monta `ActorCopilotRehearsal` | `ProtectedRoute` apenas — ⚠️ fora do matcher | herdada |
| `/reader-copilot/[id]` | `app/(interior)/reader-copilot/[id]/page.tsx` | **dinâmico `[id]`** | **Client** (L1) + `Suspense` (L20–31) | `page` — carrega audição por id e entra direto no `ActorCopilotRehearsal` | `ProtectedRoute` apenas — ⚠️ fora do matcher | herdada |
| `/acting-coach` | `app/(interior)/acting-coach/page.tsx` | estático | **Client** (L1) | `page` — chat do Acting Coach com `FlightPlan` (10 estágios), `AuditionPlanCard`, `RehearsalRunner`, `QuickPromptsDropdown`; auto-start de Character Coach via `?auditionId=` | Proxy + `ProtectedRoute` | herdada |
| `/profile` | `app/(interior)/profile/page.tsx` | estático | **Client** (L1) | `page` — editor do perfil profissional (react-hook-form + zod), autosave com debounce, `ProfileHeader`, `ActorProfileForm`, `ImdbAutofill`, `ProfileLivePreview` | Proxy + `ProtectedRoute` | herdada |
| `/settings` | `app/(interior)/settings/page.tsx` | estático | **Client** (L1) | `page` — conta (nome, foto, senha), billing (portal Stripe via `/api/create-portal-session`), Danger Zone (apagar chats/conta/perfil) | Proxy + `ProtectedRoute` | herdada |
| `/upgrade` | `app/(interior)/upgrade/page.tsx` | estático | **Client** (L1) | `page` — 2 planos (Economy / Business) + toggle mensal/anual; POST `/api/billing/checkout` | `ProtectedRoute` apenas — ⚠️ fora do matcher (é o destino dos redirects do proxy) | herdada |
| `/actors/[slug]` | `app/actors/[slug]/page.tsx` | **dinâmico `[slug]`** | **Server async** (L43) | `page` — perfil público; `notFound()` quando `getPublicProfile` retorna vazio (L47); seções Hero/Photos/Details/Showreels/About/Credits/Training/Skills + botão "Download CV" | Pública (sem guard) | ✅ `generateMetadata` L16–41 (title, description, `openGraph.type: "profile"`, `alternates.types["text/markdown"]`) |
| *(layout)* | `app/actors/layout.tsx` | layout | Server | `PublicNavbar` + `<main>` + `PublicFooter`, fundo `bg-[#F0E8DC]` | Pública | — |
| *(404)* | `app/actors/[slug]/not-found.tsx` | `not-found` | Server | UI "Profile Not Found" com link de volta para `/` | Pública | — |
| *(layout)* | `app/(interior)/layout.tsx` | layout | Server | `SidebarProvider` → `ProtectedRoute` → `AppSidebar` + coluna de conteúdo + `DashboardFooter` + `MicFab` (importado mas **não renderizado**, L2 vs L20–34) | **`ProtectedRoute` (client guard)** | — |
| *(layout)* | `app/layout.tsx` | root layout | Server | `<html lang="en" suppressHydrationWarning>` + `ThemeProvider` + `AuthProvider` + `PostHogProvider` + `Toaster` + `<Analytics />` | — | ✅ `metadata` L13–16 |

> **Nota RSC:** das 17 páginas, **12 são Client Components** (`"use client"`) e **5 são Server Components**: `app/page.tsx`, `app/(interior)/personal-dna/page.tsx`, `app/(interior)/auditions/new/brief/page.tsx`, `app/(interior)/auditions/new/sides/page.tsx`, `app/actors/[slug]/page.tsx`.

---

## 4. Bloco `(interior)` — detalhamento

### 4.1 O que é o grupo
`(interior)` é um **Route Group**: os parênteses removem o segmento da URL. Todas as **13** páginas abaixo herdam `app/(interior)/layout.tsx`:

`dashboard`, `personal-dna`, `dna-vault`, `auditions`, `auditions/new/brief`, `auditions/new/sides`, `auditions/[id]`, `reader-copilot`, `reader-copilot/[id]`, `acting-coach`, `profile`, `settings`, `upgrade`.

### 4.2 Composição do layout (`app/(interior)/layout.tsx`)
```
SidebarProvider (lib/context/SidebarContext.tsx)
└── div.flex.h-screen.bg-background
    └── ProtectedRoute                      # guard client-side (Firebase)
        ├── AppSidebar                      # components/app-sidebar.tsx
        └── div.flex-1.flex-col
            ├── {children}
            └── DashboardFooter
```
Evidência: `app/(interior)/layout.tsx:20-35`. Observações:
- `MicFab` é **importado** (`:2`) e **nunca renderizado** — código morto neste layout.
- `ProtectedRoute` (`lib/context/ProtectedRoute.tsx:14`) renderiza um splash animado enquanto `loading` (`:25-52`) e `router.push('/login')` se `!user` (`:19-23`); renderiza `null` se `!user && !loading` (`:54`). **Não checa `tier`**.
- `/chat` **não** usa este layout (tem `app/chat/layout.tsx` próprio) → **não** passa por `ProtectedRoute`.

### 4.3 Componentes/hooks-chave por página
| Rota | Componentes | Hooks / libs |
|---|---|---|
| `/dashboard` | `DashboardHeader`, `MemoryRecordingBanner`, `HistoryUploadModal`, `IntroVideoModal` | `useAuth`, `useRouter`, `useSearchParams`, `getHasSeenIntroVideo`/`markHasSeenIntroVideo` |
| `/personal-dna` | `DashboardHeader` | — (sem estado) |
| `/dna-vault` | `DashboardHeader`, `Skeleton`, `HeroSummary`, `DnaVaultGrid`, ícones lucide | `useAuth`, `useEffect`, `useState`, `useMemo`, `getDb`, `parseDnaProfileData` |
| `/auditions` | `DashboardHeader`, `AlertDialog*` | `useToast` (`hooks/use-toast`), `onAuthStateChanged`, Firestore `collection/query/orderBy/getDocs/deleteDoc/doc/updateDoc` |
| `/auditions/new/{brief,sides}` | `DashboardHeader`, `AuditionWizard` | `searchParams` (Promise) |
| `/auditions/[id]` | `StepResultSides`, `StepResultBrief`, `PerformanceMapPrintBlock` | `useParams`, `useSearchParams`, `useRouter`, `useReactToPrint`, `useMemo`, `useRef` |
| `/reader-copilot` | `DashboardHeader`, `ActorCopilotRehearsal` | `useAuth`-free (usa `getAuth().onAuthStateChanged` direto), `useState`, `useEffect`, `useRouter` |
| `/reader-copilot/[id]` | `ActorCopilotRehearsal` | `useParams`, `useRouter`, `onAuthStateChanged`, `getDoc` |
| `/acting-coach` | `ChatInput`, `DashboardHeader`, `QuickPromptsDropdown`, `DropdownMenu*`, `FlightPlan`, `RehearsalRunner`, `AuditionPlanCard` | `useActingCoach`, `useSearchParams`, `formatDistanceToNow`, `renderMarkdown` |
| `/profile` | `DashboardHeader`, `ProfileHeader`, `ActorProfileForm`, `ImdbAutofill`, `ProfileLivePreview` | `useForm`/`FormProvider`, `zodResolver`, `useAuth`, `useLoadingText`, `useState/useEffect/useRef/useCallback` |
| `/settings` | `DashboardHeader`, `AlertDialog*`, `SectionHeader` (local) | `useAuth` (`sendPasswordReset`), `writeBatch`, `deleteDoc`, `getDocs` |
| `/upgrade` | `DashboardHeader`, `PricingCard` (local) | `useAuth`, `useState`, `cn` |

---

## 5. Route handlers HTTP — tabela completa

Todos arquivos são `route.ts` (Server-only). "Proxy?" indica se o caminho é coberto pelo `matcher` de `proxy.ts` (`proxy.ts:129-140`).

| Método | URL | Arquivo | Propósito | Autenticação exigida | Proxy? |
|---|---|---|---|---|---|
| `POST` | `/api/actor-copilot/parse-script` | `app/api/actor-copilot/parse-script/route.ts:9` | Converte texto de sides em `SceneData` estruturado (personagens + diálogo) para o ensaio interativo | `Authorization: Bearer <Firebase ID token>` → 401 se ausente (`:12-15`), `verifyIdToken` (`:18`); 403 se o `userPath` do body não contém o `uid` do token (`:32`) | Não |
| `POST` | `/api/actor-copilot/tts` | `app/api/actor-copilot/tts/route.ts:37` | Gera áudio TTS expressivo via Gemini Flash com fallback de modelo; retorna WAV | Bearer + `verifyIdToken` (`:40-46`); 400 se `text` ausente | Não |
| `POST` | `/api/auditions/analyzeSides` | `app/api/auditions/analyzeSides/route.ts:89` | Análise de sides (texto/PDF/DOCX via `pdf2json`/`mammoth`) → performance map personalizado com o DNA | Bearer + `verifyIdToken` (`:92-98`); 403 ownership (`:154`) | Não |
| `POST` | `/api/auditions/analyzeBrief` | `app/api/auditions/analyzeBrief/route.ts:68` | Análise de brief/notas de casting → concepção de personagem + world-building | Bearer + `verifyIdToken` (`:71-77`); 403 ownership (`:131`) | Não |
| `POST` | `/api/auth/callback` | `app/api/auth/callback/route.ts:12` | Valida `idToken` do Firebase, hidrata tier/status do Firestore e emite o cookie `platform_session` (JWT HS256, 7d, httpOnly) | Recebe `idToken` no body; 400 se ausente (`:17`) | Não |
| `GET` | `/api/auth/callback` | `app/api/auth/callback/route.ts:76` | Devolve o estado de entitlement atual a partir do cookie de sessão | `platform_session`; 401 com `{authenticated:false,tier:'free'}` se ausente (`:81`) | Não |
| `POST` | `/api/auth/logout` | `app/api/auth/logout/route.ts:10` | Apaga o cookie `platform_session` | Nenhuma | Não |
| `POST` | `/api/billing/checkout` | `app/api/billing/checkout/route.ts:14` | Cria Stripe Checkout Session (mensal/anual, trial 14d) para `economy`/`business` | `platform_session` **ou** `idToken` no body (401 em `:45`) | Não |
| `POST` | `/api/billing/portal` | `app/api/billing/portal/route.ts:14` | Cria Stripe Customer Portal Session | `platform_session` + Bearer opcional (401 em `:46`) | Não |
| `GET` | `/api/billing/success` | `app/api/billing/success/route.ts:21` | Retorno do Stripe: valida a session, lê o tier autoritativo no Firestore, **reemite** o `platform_session` e redireciona para `/dashboard` | Nenhuma — **explicitamente isenta** no proxy (`proxy.ts:26-30`) | ✅ **Sim** (mas isenta) |
| `POST` | `/api/coach/chat` | `app/api/coach/chat/route.ts:10` | Resposta do Acting Coach com contexto de audição + DNA; histórico limitado a 20 mensagens (`MAX_HISTORY_MESSAGES`) | Bearer (`:14-17`) + `verifyOrDecodeIdToken`/`verifyIdToken` (`:39-42`) | Não |
| `POST` | `/api/coach/updateDna` | `app/api/coach/updateDna/route.ts:68` | Extrai DNA psicológico do transcript e persiste no Master Profile | Bearer + `verifyIdToken` (`:71-77`) | Não |
| `POST` | `/api/create-portal-session` | `app/api/create-portal-session/route.ts:14` | **Duplicata** de `/api/billing/portal`; é a rota realmente chamada por `/settings` (`app/(interior)/settings/page.tsx:115`) | `platform_session` **ou** `idToken` no body (401 em `:48-49`) | Não |
| `POST` | `/api/dna/baseline` | `app/api/dna/baseline/route.ts:78` | Processa documento baseline (PDF/texto) → extração de DNA e gravação no Firestore | Bearer + `verifyIdToken` (`:81-87`) | Não |
| `POST` | `/api/dna/chat` | `app/api/dna/chat/route.ts:19` | Chat de extração: YAN (Socrático) bloqueante + MEMLISTENER (profiler) em background via `after()` do Next | Bearer (`:23-26`) + verify (`:49-52`) | Não |
| `POST` | `/api/dna/synthesize` | `app/api/dna/synthesize/route.ts:13` | Sintetiza o Master Profile a partir do vault, com cache inteligente | Bearer + `verifyIdToken` (`:16-22`); 403 ownership (`:31`) | Não |
| `POST` | `/api/dna/transcribe/chat` | `app/api/dna/transcribe/chat/route.ts:11` | Transcreve áudio (base64) → texto | Bearer + `verifyIdToken` (`:14-19`) | Não |
| `POST` | `/api/dna/transcribe/history` | `app/api/dna/transcribe/history/route.ts:54` | Transcreve áudio **e** extrai/persiste DNA da memória falada | Bearer + `verifyIdToken` (`:57-62`) | Não |
| `POST` | `/api/profile/autofill` | `app/api/profile/autofill/route.ts:179` | Scrape do IMDB (Firecrawl) + síntese IA com o DNA existente → autofill de perfil | Bearer + `verifyIdToken` (`:186-200`) | Não |
| `POST` | `/api/webhooks/stripe` | `app/api/webhooks/stripe/route.ts:160` | Webhook Stripe (checkout/subscription events); sincroniza billing no Firestore. `export const dynamic = 'force-dynamic'` (`:8`) | **Assinatura Stripe** (400 se header ausente, `:164`) | Não |
| `GET` | `/actors/[slug]/index.md` | `app/actors/[slug]/index.md/route.ts:7` | Perfil público em **Markdown** (`text/markdown`), somente `status == "published"`; 404 com corpo Markdown | Nenhuma | Não |

### 5.1 Route handlers fantasma / não roteáveis
| Item | Situação |
|---|---|
| `app/api/auditions/analyzeBrief/routeBrief.ts` (285 linhas) | **Não é rota** (não se chama `route.ts`). Duplicata órfã do handler de brief; zero referências no código. |
| `app/api/billing/cancelled` | **Não existe** como rota, mas é o `cancel_url` do Stripe Checkout (`app/api/billing/checkout/route.ts:143`). Cancelar um checkout leva a **404** (e como o proxy não cobre `/api/billing/cancelled`, nem redireciona). |
| `app/api/billing/portal` | Rota existe mas **nenhum caller em produção** (só a própria JSDoc e testes). O front usa `/api/create-portal-session`. |

---

## 6. Matriz de proteção (proxy × `ProtectedRoute` × API)

### 6.1 O guard de borda: `proxy.ts`
Arquivo na **raiz do projeto** (não em `src/`), convenção `proxy.ts` do Next.js 16 — o antigo `middleware.ts` foi renomeado para `proxy.ts` e a função exportada passou a se chamar `proxy` ([docs oficiais](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)). Aqui: `export async function proxy(request: NextRequest)` (`proxy.ts:18`) + `export const config = { matcher: [...] }` (`proxy.ts:129-140`).

**Matcher efetivo (`proxy.ts:130-139`):**
```
'/api/billing/success'
'/dashboard/:path*'
'/chat/:path*'
'/auditions/:path*'
'/personal-dna/:path*'
'/settings/:path*'
'/profile/:path*'
'/acting-coach/:path*'
```
Consequências diretas:
1. **Não há** `'/api/:path*'` → a esmagadora maioria das API routes **não** passa pelo proxy; a autenticação delas é feita dentro do handler (Bearer Firebase).
2. **`/dna-vault`, `/reader-copilot`, `/reader-copilot/[id]` e `/upgrade` não estão no matcher.** `dna-vault` e `reader-copilot` ficam protegidos **apenas** pelo `ProtectedRoute` client-side (que valida login Firebase, **não** tier). Já as APIs que eles chamam (`/api/dna/*`, `/api/actor-copilot/*`) validam o Bearer token — mas **nenhuma delas valida `tier`** (grep em `app/api/**/route.ts` não encontra checagem de `tier` fora de billing/webhook).
3. `/`, `/login`, `/actors/**`, `/api/auth/**`, `/api/billing/checkout`, `/api/create-portal-session` e todas as demais APIs ficam fora do matcher.

**Lógica do proxy (engine `BILLING_ENGINE`, default `'STRIPE'` — `proxy.ts:9`):**
| Condição | Ação | Linhas |
|---|---|---|
| pathname é `/api/billing/success` | `NextResponse.next()` (bypass) | `:26-30` |
| Engine `STRIPE`, sem cookie `platform_session` | 307 → `/login` | `:36-40` |
| Cookie inválido/adulterado (`decryptSession` → null) | 307 → `/login` + `delete('platform_session')` | `:42-48` |
| `tier === 'free'` **ou** `subscriptionStatus ∉ {active, trialing}` e path **não** é `/dashboard*` | 307 → `/upgrade` | `:50-57` |
| mesmo caso, mas é `/dashboard*` | `next()` (dashboard é acessível ao free) | `:54-59` |
| `tier === 'economy'` e path começa com `/profile` ou `/acting-coach` | 307 → `/upgrade` | `:61-66` |
| `tier === 'business'` (ou outros) | `next()` | `:68` |
| Engine legado `KAJABI` | valida JWT HS256 do cookie `kajabi_session`; restringe `/profile` e `/acting-coach` por `offers` (`KAJABI_ECONOMY_OFFER_ID`) | `:74-121` |

Cobertura por teste: `proxy.test.ts` valida 401→`/login` (`:36-45`), limpeza de cookie inválido (`:50-62`), redirect de economy em `/acting-coach` (`:67-81`), `next()` para business (`:86-101`) e o bypass de `/api/billing/success` (`:103-110`).

### 6.2 Matriz consolidada
| Rota | Proxy (borda) | `ProtectedRoute` (client) | API (Bearer Firebase) |
|---|---|---|---|
| `/`, `/login`, `/actors/**`, `/actors/[slug]/index.md` | — | — | — |
| `/dashboard` | ✅ (free permitido) | ✅ | n/a |
| `/chat` | ✅ (free → `/upgrade`) | ❌ (layout próprio) | `/api/dna/*`, `/api/coach/*` |
| `/personal-dna` | ✅ (free → `/upgrade`) | ✅ | n/a (placeholder) |
| `/auditions`, `/auditions/new/*`, `/auditions/[id]` | ✅ | ✅ | `analyzeSides`, `analyzeBrief` |
| `/profile`, `/settings`, `/acting-coach` | ✅ (economy bloqueado em profile/acting-coach) | ✅ | `autofill`, `coach/*`, portal |
| `/dna-vault` | ❌ **fora do matcher** | ✅ | n/a (Firestore client-side) |
| `/reader-copilot`, `/reader-copilot/[id]` | ❌ **fora do matcher** | ✅ | `parse-script`, `tts` |
| `/upgrade` | ❌ **fora do matcher** (destino de redirect) | ✅ | `billing/checkout` |
| `/api/**` (exceto `billing/success`) | ❌ | ❌ | ✅ handler-a-handler (ver §5) |

### 6.3 Sessão (cookie)
`lib/session.ts`: cookie `platform_session` (`:20`), JWT HS256 assinado com `JWT_SECRET_KEY || JWT_SECRET` (`:21`), expiração **7d** (`:38`), cookie `httpOnly`, `secure` em produção, `sameSite: 'lax'`, `path: '/'`, `maxAge` 7d (`:69-75`). `lib/session.ts:23-25` **lança erro no import** se o segredo JWT não estiver configurado.
Fluxo: `AuthContext` chama `POST /api/auth/callback` com o `idToken` em login/signup (`lib/context/AuthContext.tsx:127`, `:174`, `:215`) e `GET /api/auth/callback` no `onAuthStateChanged` para hidratar `tier`/`subscriptionStatus`/`stripeCustomerId` (`:298-308`). Fallback em erro: `tier: 'free'`, `subscriptionStatus: 'canceled'` (`:316`, `:321`).

---

## 7. Redirecionamentos e reescritas — verificação

### 7.1 `/auditions/new` **não** redireciona para `/brief` nem `/sides` — ele dá 404
Verificado em três frentes:
1. **Não existe** `app/(interior)/auditions/new/page.tsx` (o diretório só contém `brief/` e `sides/`).
2. **Não existe** `redirect()` em `app/**` — grep por `redirect(` retorna apenas `router.push`/`router.replace` client-side.
3. **Não existe** `rewrites()`/`redirects()` em `next.config.mjs` (o arquivo só declara `images.unoptimized: true`, `next.config.mjs:2-6`).

Portanto, acessar `/auditions/new` cai no 404 padrão do Next (não há `app/not-found.tsx`). Todos os pontos de entrada do produto já apontam para o caminho completo:
- `app/(interior)/dashboard/page.tsx:167` → `/auditions/new/brief`
- `app/(interior)/dashboard/page.tsx:204` → `/auditions/new/sides`
- `components/app-sidebar.tsx:120` e `:127` → `brief` / `sides`
- `app/(interior)/auditions/page.tsx:488` e `:501` → `.../brief?enrichAuditionId=` / `.../sides?enrichAuditionId=`
- `app/(interior)/auditions/[id]/page.tsx:170,181,241,247` → idem
- `components/auditions/audition-wizard.tsx:665` → `router.push('/auditions/new/${otherMode}?enrichAuditionId=${id}')` (troca brief↔sides)

### 7.2 Demais navegações/redirecionamentos relevantes
| Origem | Destino | Evidência |
|---|---|---|
| `/dashboard?session_id=...` (retorno Stripe) | `router.refresh()` + `router.replace('/dashboard')` | `app/(interior)/dashboard/page.tsx:32-37` |
| `AuthContext.handlePostAuthRedirect` (pós-login) | Stripe Checkout (se `sessionStorage.trial_intent`) ou `window.location.href = '/dashboard'` | `lib/context/AuthContext.tsx:78-111` |
| `/login` com `?trial`/`?plan` e usuário já logado | Checkout (trial) ou `/upgrade` | `app/login/page.tsx:88-119` |
| `AuthContext.logout()` | `signOut` + `POST /api/auth/logout` + `window.location.href = '/login'` | `lib/context/AuthContext.tsx:275-288` |
| Sidebar "Upgrade Plan" | `router.push('/upgrade')` | `components/app-sidebar.tsx:65` |
| `AuditionWizard` após salvar | `router.push('/auditions')` | `components/auditions/audition-wizard.tsx:554` |
| `ActorCopilotRehearsal` (saída) | `/auditions/(id)` (detalhe) ou retorno ao launcher | `app/(interior)/reader-copilot/[id]/page.tsx:148`, `.../reader-copilot/page.tsx:146` |
| `BreakCheckInModal` | `router.push('/dashboard')` | `components/break-check-in-modal.tsx:47` |
| Stripe Checkout cancelado | `/api/billing/cancelled` → **404 (rota inexistente)** | `app/api/billing/checkout/route.ts:143` |

---

## 8. Metadata, SEO e otimização de imagens

| Item | Onde | Conteúdo |
|---|---|---|
| `metadata` (root) | `app/layout.tsx:13-16` | `title: 'The Actors Copilot - Self Tape Copilot'`; `description: 'Your AI-powered self-tape audition preparation tool...'` |
| `generateMetadata` | `app/actors/[slug]/page.tsx:16-41` | `title: '<nome> - Actor Profile \| The Actors Copilot'`; `description` = 160 primeiros chars da bio (ou fallback); `openGraph {title, description, images: [headshot], type:'profile'}`; `alternates.types['text/markdown'] = '/actors/<slug>/index.md'` |
| Cache do Markdown | `app/actors/[slug]/index.md/route.ts:58` | `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` |
| Base URL | `app/actors/[slug]/index.md/route.ts:41-50` | `NEXT_PUBLIC_SITE_URL` → `VERCEL_URL` → `localhost:3000`; proto via `x-forwarded-proto` |
| `viewport`/`themeColor` | — | **não exportados** em lugar nenhum |
| Imagens | `next.config.mjs:3-5` | `images.unoptimized: true` (desativa o otimizador em todo o app) |
| `generateStaticParams` | — | **não usado** (nenhuma rota é pré-gerada) |
| `export const dynamic` | `app/api/webhooks/stripe/route.ts:8` | único `force-dynamic` do app |

---

## 9. Observações, inconsistências e dívidas técnicas

1. **`/auditions/new` é 404** — não há página-índice nem redirect para `brief`/`sides` (§7.1). Se o produto quer um hub de escolha, ele não existe.
2. **`/api/billing/cancelled` não existe** mas é o `cancel_url` do Stripe; cancelamento de checkout termina em 404 silencioso.
3. **`/api/billing/portal` é órfã**; o app usa `/api/create-portal-session` (duas implementações quase idênticas).
4. **`app/api/auditions/analyzeBrief/routeBrief.ts` é código morto** (não roteável, sem referências).
5. **`MicFab` nunca renderiza** (`app/(interior)/layout.tsx:2`).
6. **`/personal-dna` é uma página morta**: o botão "Start Building DNA" não tem `onClick` nem link (`app/(interior)/personal-dna/page.tsx:21-23`); a sidebar aponta "Personal DNA" para `/chat` (`components/app-sidebar.tsx:33`).
7. **Assimetria de proteção por tier**: `dna-vault` e `reader-copilot` estão fora do matcher do proxy, então um usuário `free` logado pode abrir essas telas (só `ProtectedRoute` barra, e ele não olha tier); as APIs envolvidas também não checam tier.
8. **`/chat` não passa por `ProtectedRoute`** — depende exclusivamente do proxy de borda e da resposta 401 das APIs.
9. **Sem `app/not-found.tsx` global e sem `error.tsx`/`loading.tsx`** em nenhum segmento — apenas o `not-found.tsx` de `/actors/[slug]`.
10. **Nenhum catch-all, nenhuma parallel/intercepting route, nenhum Server Action, nenhuma `generateStaticParams`.**
11. O acoplamento de identidade é frágil por design: o "userPath" é `${uid}_${firstName}` (sanitizado), reconstruído em cada página e API (ex.: `app/(interior)/auditions/page.tsx:94-96`, `app/api/coach/chat/route.ts:47-49`), com fallback `"Actor"` quando `displayName` é nulo.

---

### Fontes externas consultadas
- [Next.js — File-system conventions: proxy.js](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [Next.js — Getting Started: Proxy](https://nextjs.org/docs/app/getting-started/proxy)
