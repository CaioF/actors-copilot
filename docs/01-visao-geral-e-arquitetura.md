# 01 — Visão Geral e Arquitetura

> Documentação de onboarding do **The Actor's Copilot** (`CaioF/actors-copilot`).
> Base de código analisada: commit `32f7f74` (branch `main`, merge do PR #71 "new-design").

---

## 1. O que é o produto

**The Actor's Copilot** é uma plataforma SaaS (Next.js) de preparação de **self-tape / audições** para atores. O diferencial é que ela não entrega apenas um "quebra-texto" de cena: ela primeiro extrai o **DNA Pessoal** do ator — um perfil psicológico (traumas, feridas centrais, necessidades não atendidas, máscaras públicas, arquétipos, valores, dinâmicas relacionais) obtido por conversa socrática com uma IA chamada **"The Coach" (YAN)** — e depois usa esse DNA como lente para analisar personagens, briefings de casting e cenas.

Fluxo mental do produto:

```
      Conversa socrática (Personal DNA)          Análise de audição
      ────────────────────────────────►    ────────────────────────────►
      extrai "regras de negócio"          usa o DNA como lente para
      psicológicas do ator                decupar sides + casting brief
                    │                                   │
                    ▼                                   ▼
            Master Profile (DNA Vault)  ───────►  Performance Map + Coach
                    │
                    └──────► Acting Coach (chat livre), Reader Copilot (ensaio
                             com leitura de falas), Perfil público para casting
```

**Módulos de produto:**

| Módulo | Rota principal | O que faz |
|---|---|---|
| Personal DNA | `/chat` | Conversa socrática dual-agent que extrai o perfil psicológico |
| DNA Vault | `/dna-vault` | Visualização do Master Profile sintetizado |
| Auditions | `/auditions` | Lista/gestão de audições e breakdowns |
| Casting Brief Breakdown | `/auditions/new/brief` | Wizard que transforma e-mail/PDF de casting em checklist cronológico |
| Scene Study (Sides) | `/auditions/new/sides` | Wizard que decupa as falas em um "Performance Map" |
| Reader Copilot | `/reader-copilot` | Ensaiador: lê as falas do outro personagem junto com o ator |
| Acting Coach | `/acting-coach` | Chat livre de técnica/atuação com contexto do ator e da audição |
| Actor Profile | `/profile` + `/actors/[slug]` | Perfil profissional editável + página pública para casting |
| Billing | `/upgrade` | Planos Economy Class e Business Class via Stripe |

---

## 2. Stack técnica

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router, RSC) | `16.1.6` |
| UI | React | `19.2.4` |
| Linguagem | TypeScript (strict) | `5.7.3` |
| Estilo | Tailwind CSS v4 (CSS-first, `@import 'tailwindcss'`) | `4.2.0` |
| Componentes | shadcn/ui (style `new-york`) + Radix UI + CVA | — |
| Ícones | lucide-react | `0.564.0` |
| Fontes | `Antonio` (títulos) + `Inter` (texto) via `next/font/google` | — |
| Auth | Firebase Auth (Google OAuth + e-mail/senha) | `11.3.0` |
| Banco | Cloud Firestore + Firebase Admin SDK | `11.3.0` / `13.7.0` |
| Sessão | JWT HS256 assinado com `jose`, cookie httpOnly | `6.2.1` |
| IA | Google Gemini via `@google/genai` / Firebase AI SDK | `1.48.0` |
| Pagamentos | Stripe (Checkout, Customer Portal, Webhooks) | `22.2.1` |
| Formulários | react-hook-form + Zod | `7.54.1` / `3.24.1` |
| Parsing de documentos | `mammoth` (DOCX), `pdf2json` (PDF), `csv-parser` | — |
| E-mail | `resend` | `6.18.0` |
| Analytics | `posthog-js` + `@vercel/analytics` | — |
| Logging | `pino` + `pino-pretty` | — |
| Testes | Jest + Testing Library | `30.3.0` |
| Gerenciador | pnpm (lockfile presente) | — |
| Deploy | Vercel | — |

---

## 3. Como rodar o projeto

```bash
# 1. Dependências (o repositório usa pnpm)
pnpm install

# 2. Variáveis de ambiente
cp env.example .env.local   # preencher (ver seção 4)

# 3. Desenvolvimento
pnpm dev          # http://localhost:3000

# 4. Qualidade
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm test         # Jest
pnpm build        # build de produção
```

**Git hooks (Husky):**
- `pre-commit` → roda `pnpm test`
- `pre-push` → roda `pnpm test`

**CI (`.github/workflows/ci.yml`):** dispara em push/PR para `main` e `develop`; roda `pnpm lint`, `pnpm test` e `tsc --noEmit` em Node 22 com pnpm 9.

---

## 4. Variáveis de ambiente

`env.example` documenta o conjunto mínimo, mas o código referencia outras. Lista consolidada (extraída do código):

**Firebase client (públicas):**
`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`, `NEXT_PUBLIC_FIREBASE_DATABASE_ID`

**Firebase Admin (server-only):**
`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (quebras de linha convertidas com `.replace(/\\n/g, '\n')`)

**Sessão / app:**
`JWT_SECRET_KEY` (ou fallback `JWT_SECRET`), `APP_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `VERCEL_URL`

**Stripe:**
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_ECONOMY_PRICE_ID`, `STRIPE_BUSINESS_PRICE_ID`, `STRIPE_ECONOMY_ANNUAL_PRICE_ID`, `STRIPE_BUSINESS_ANNUAL_PRICE_ID`, `STRIPE_CUSTOMER_PORTAL_RETURN_URL`, `BILLING_ENGINE` (default `STRIPE`)

**IA / serviços externos:**
`FIRECRAWL_API_KEY` (autofill de IMDb), `ACTING_COACH_GENERATION_MODEL`

**Observabilidade:**
`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `LOG_LEVEL`, `NEXT_PUBLIC_LOG_LEVEL`

> ⚠️ **Atenção:** `env.example` **não** lista `FIRECRAWL_API_KEY`, as chaves do PostHog, `ACTING_COACH_GENERATION_MODEL`, `APP_URL`/`NEXT_PUBLIC_SITE_URL` nem `STRIPE_CUSTOMER_PORTAL_RETURN_URL`. Um ambiente novo configurado só por ele quebra o autofill de IMDb e o Acting Coach.
>
> ⚠️ `lib/billing.ts` e `lib/session.ts` lançam erro **em tempo de import** se `STRIPE_*`, `STRIPE_WEBHOOK_SECRET` ou `JWT_SECRET` não existirem. Isso significa que o app não sobe sem essas variáveis.

---

## 5. Estrutura de diretórios

```
actors-copilot/
├── app/                          # Next.js App Router
│   ├── (interior)/               # Grupo de rotas AUTENTICADAS (layout com sidebar)
│   │   ├── layout.tsx            # Sidebar + ProtectedRoute + footer
│   │   ├── dashboard/            # Hub principal
│   │   ├── acting-coach/         # Chat do Acting Coach
│   │   ├── auditions/            # Lista, detalhe e wizards (/new/brief, /new/sides)
│   │   ├── dna-vault/            # Visualização do Master Profile
│   │   ├── personal-dna/         # Página-CTA (o chat real fica em /chat)
│   │   ├── profile/              # Formulário do perfil profissional
│   │   ├── reader-copilot/       # Ensaiador de cenas
│   │   ├── settings/             # Conta, billing e exclusão de dados
│   │   └── upgrade/              # Pricing / planos
│   ├── actors/[slug]/            # Perfil público (rota aberta, SEO) + index.md (LLM)
│   ├── api/                      # Route Handlers (backend)
│   ├── chat/                     # Chat do Personal DNA (fora do grupo interior)
│   ├── login/                    # Autenticação
│   ├── layout.tsx                # Layout raiz (providers + fontes)
│   ├── page.tsx                  # Landing page
│   └── globals.css               # Design tokens + Tailwind
├── components/
│   ├── ui/                       # ~56 primitivos shadcn/ui
│   ├── auditions/                # Wizard e steps
│   ├── actor-copilot/            # Reader Copilot (ensaio)
│   ├── acting-coach/             # Flight plan, rehearsal runner, cards
│   ├── dna-vault/                # Grid, accordion, visualização
│   ├── profile/                  # Seções do formulário de perfil
│   ├── public-profile/           # Componentes do perfil público
│   └── *.tsx                     # Sidebar, headers, chat, modais
├── hooks/                        # Hooks de cliente (use-chat, use-acting-coach, ...)
├── lib/
│   ├── acting-coach/             # Domínio do coach (application/domain/infrastructure)
│   ├── actor-copilot/            # Parser de roteiro
│   ├── context/                  # AuthContext, ProtectedRoute, SidebarContext
│   ├── dna/                      # Parser de DNA + pipeline de extração
│   ├── schemas/                  # Schemas Zod (audition)
│   ├── showreels/                # Extração de thumbnail e storage
│   ├── stripe/                   # Serviço de migração
│   ├── prompts.ts                # ⭐ Todos os prompts de IA (fonte da verdade comportamental)
│   ├── questions.ts              # Banco de perguntas socráticas
│   ├── chat-types.ts             # ⭐ Tipos do DNA, 12 arenas, 4 capítulos, taxonomia de temas
│   ├── billing.ts                # ⭐ Tier ↔ Price ID, status, sessão
│   ├── session.ts                # ⭐ JWT / cookie de sessão
│   ├── firebase.ts / firebase.admin.ts
│   └── ...
├── proxy.ts                      # ⭐ Middleware de borda (auth + tier gating)
├── firestore.rules               # Regras de segurança (⚠️ permissivas)
├── scripts/python/               # Ingestão legada do corpus do coach (Pinecone)
└── docs/                         # Esta documentação
```

---

## 6. Arquitetura em alto nível

```
┌──────────────────────────── Navegador ────────────────────────────┐
│  React 19 (RSC + Client Components)                               │
│  AuthContext  ──►  Firebase Auth (Google / e-mail)                │
│  use-chat / use-acting-coach  ──►  Firestore (client SDK, realtime)│
└───────────────────────────────┬───────────────────────────────────┘
                                │ fetch (Bearer = Firebase ID Token)
                                ▼
┌──────────────────── Next.js (Vercel) ────────────────────────────┐
│  proxy.ts (Edge Middleware)                                       │
│   ├── lê cookie platform_session (JWT HS256)                      │
│   ├── decide: login → upgrade → rota                               │
│   └── matcher: /dashboard /chat /auditions /personal-dna          │
│                /settings /profile /acting-coach /api/billing/success│
│                                                                   │
│  API Routes (Node runtime)                                        │
│   ├── /api/auth/*        sessão JWT + cookie                      │
│   ├── /api/billing/*     Stripe Checkout / Portal                 │
│   ├── /api/webhooks/stripe  sincroniza assinatura → Firestore      │
│   ├── /api/dna/*         chat socrático, síntese, baseline, voz    │
│   ├── /api/auditions/*   analyzeBrief / analyzeSides               │
│   ├── /api/coach/*       chat do Acting Coach + updateDna          │
│   ├── /api/profile/autofill  IMDb + Firecrawl + Gemini             │
│   └── /api/actor-copilot/*   parse-script, tts                     │
└──────┬────────────────────┬──────────────────────┬────────────────┘
       ▼                    ▼                      ▼
  Firestore            Google Gemini          Stripe / Firecrawl
  (dados do usuário)   (geração + extração)   (pagamento / scraping)
```

### Dois níveis de proteção de rota

1. **Middleware de borda (`proxy.ts`)** — única fonte de verdade para *tier gating* no servidor. Lê o cookie `platform_session`, verifica o JWT e redireciona:
   - sem cookie ou JWT inválido → `/login`
   - tier `free` **ou** assinatura não-ativa (`active`/`trialing`) → só `/dashboard` passa; qualquer outra rota do matcher vai para `/upgrade`
   - tier `economy` → bloqueia `/profile*` e `/acting-coach*` (recursos Business) → `/upgrade`
   - tier `business` → libera tudo
2. **`ProtectedRoute` (client)** — apenas UX: evita "flash" de conteúdo e redireciona para `/login` quando o Firebase diz que não há usuário. A segurança real é do middleware.

> ⚠️ O `matcher` **não inclui** `/dna-vault`, `/reader-copilot`, `/upgrade`, `/login`, `/actors/**` nem `/`. Ou seja, `/dna-vault` e `/reader-copilot` não passam pelo gate de tier no servidor (só pelo `ProtectedRoute` no cliente, que verifica autenticação mas não tier). Ver documento de Regras de Negócio, seção "Lacunas conhecidas".

---

## 7. Padrões de código que você vai encontrar

- **Aliases:** `@/*` → raiz do projeto (ver `tsconfig.json`). Sem `src/`.
- **Server vs Client:** a maioria das páginas do grupo `(interior)` é `"use client"` e fala direto com o Firestore **pelo SDK client** (sujeito a `firestore.rules`). O SDK Admin é usado apenas dentro de `app/api/**`.
- **`userPath`:** quase todo dado é gravado em `users/{uid}_{FirstNameSanitizado}/...` — ver `lib/firestore.utils.ts` e o padrão repetido em `app/api/dna/chat/route.ts:66`. É um detalhe crítico: o caminho **depende do primeiro nome** do usuário.
- **Prompts centralizados:** praticamente toda a "inteligência de negócio" de IA vive em `lib/prompts.ts`. Mexer em comportamento de IA = mexer nesse arquivo.
- **Respostas de API:** o README descreve `{ success, data }` / `{ error }`, mas na prática as rotas são heterogêneas (`{ aiData }`, `{ selectedQuestions }`, redirects, etc.). Ver os documentos específicos.
- **Testes:** co-localizados (`*.test.ts(x)` ao lado do arquivo). `testEnvironment: 'node'` global no `jest.config.mjs`, com `@/` mapeado para a raiz.

---

## 8. Documentos desta pasta

| Documento | Conteúdo |
|---|---|
| [`README.md`](./README.md) | Índice e TL;DR |
| [`01-visao-geral-e-arquitetura.md`](./01-visao-geral-e-arquitetura.md) | Este documento |
| [`02-regras-de-negocio.md`](./02-regras-de-negocio.md) | Regras de negócio por domínio (auth, billing, DNA, audições, coach, perfil) |
| [`03-paginas-e-rotas.md`](./03-paginas-e-rotas.md) | Inventário completo de páginas e endpoints |
| [`04-design-system.md`](./04-design-system.md) | Tokens, tipografia, componentes e convenções visuais |
| [`_research/`](./_research/) | Notas brutas de investigação usadas como base (referência profunda) |

---

## 9. Dívidas técnicas e armadilhas conhecidas (resumo)

| # | Item | Onde | Impacto |
|---|---|---|---|
| 1 | `firestore.rules` libera **leitura/escrita para qualquer usuário autenticado** em todo o banco | `firestore.rules` | 🔴 Crítico para produção |
| 2 | `README.md` está desatualizado em vários pontos (rotas, modelo de perfil, fluxo do coach) | `README.md` | 🟠 Confunde onboarding |
| 3 | `/auditions/new` não existe como rota (só `/new/brief` e `/new/sides`) | `app/(interior)/auditions/` | 🟡 Links/documentação quebrados |
| 4 | `personal-dna/page.tsx` é só um CTA morto; o chat real é `/chat` | `app/(interior)/personal-dna/` | 🟡 Rota órfã |
| 5 | `components/auditions/step-generating.tsx` está vazio (0 linhas) | `components/auditions/step/` | 🟢 Dead code |
| 6 | Dois endpoints de portal Stripe (`/api/billing/portal` e `/api/create-portal-session`) | `app/api/` | 🟡 Duplicação/legado |
| 7 | `userPath` derivado do primeiro nome — muda se o usuário renomear o perfil | `lib/firestore.utils.ts`, rotas | 🔴 Perda de acesso aos dados |
| 8 | Sem rate limiting em endpoints de IA/auth | `app/api/**` | 🟠 Custo/abuso |
| 9 | Billing legado Kajabi ainda presente em `proxy.ts` | `proxy.ts:71-121` | 🟢 Fallback morto se `BILLING_ENGINE=STRIPE` |
| 10 | Documentação de privacy afirma que scripts não são persistidos, mas `sidesText` é salvo em `auditions` | `app/(interior)/auditions/page.tsx` | 🟠 Revisar afirmação jurídica |
