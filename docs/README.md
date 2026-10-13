# Documentação — The Actor's Copilot

Documentação de onboarding e referência técnica do repositório **`CaioF/actors-copilot`** (clone local em `actors-copilot/`).

**Commit de referência:** `32f7f74` (branch `main`, merge do PR #71 "new-design").
**Fonte de verdade:** o **código**. O `README.md` original está desatualizado em vários pontos — as divergências estão marcadas com ⚠️/🔴 ao longo desta documentação.

---

## Por onde começar

| Se você quer… | Leia |
|---|---|
| **Assumir o trabalho do Green Room agora** | [`HANDOFF-green-room.md`](./HANDOFF-green-room.md) |
| Entender o produto, a stack e subir o projeto | [`01-visao-geral-e-arquitetura.md`](./01-visao-geral-e-arquitetura.md) |
| Entender **como as coisas devem funcionar** (regras de negócio) | [`02-regras-de-negocio.md`](./02-regras-de-negocio.md) |
| Saber **quais telas e endpoints existem** | [`03-paginas-e-rotas.md`](./03-paginas-e-rotas.md) |
| Trabalhar na **UI** (tokens, componentes, cores) | [`04-design-system.md`](./04-design-system.md) |
| Implementar/validar a integração comercial **Stripe × Skool Green Room** | [`05-integracao-stripe-skool-green-room.md`](./05-integracao-stripe-skool-green-room.md) |
| Ver a investigação crua que embasou tudo | [`_research/`](./_research/) |

---

## TL;DR do projeto

**O que é:** SaaS de preparação de self-tape/audição. Uma IA ("The Coach") extrai o **DNA Pessoal** do ator por conversa socrática (perfil psicológico) e usa esse DNA como lente para decupar *sides* e *casting briefs*, ensaiar cenas e dar coaching.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 (CSS-first) · shadcn/ui + Radix · Firebase (Auth, Firestore, Storage) · Gemini via `@google/genai`/Firebase AI · Stripe · Zod + react-hook-form · Jest.

**Como rodar:**

```bash
cd actors-copilot
pnpm install
cp env.example .env.local   # preencher (ver doc 01 §4 — env.example está incompleto)
pnpm dev
```

**Rotas principais:** `/` (landing) · `/login` · `/dashboard` · `/chat` (Personal DNA) · `/dna-vault` · `/auditions` (+ `/new/brief`, `/new/sides`, `/[id]`) · `/reader-copilot` · `/acting-coach` · `/profile` · `/settings` · `/upgrade` · `/actors/[slug]` (perfil público).

---

## Mapa mental do código

```
app/(interior)/**      → páginas autenticadas (layout com sidebar + ProtectedRoute)
app/chat/              → Personal DNA (layout próprio, sem ProtectedRoute)
app/actors/[slug]/     → perfil público + export markdown para LLMs
app/api/**             → backend (route handlers)
components/ui/**       → 52 primitivos shadcn (só 7 usados em telas)
components/**          → componentes de produto
hooks/**               → use-chat (DNA), use-acting-coach, timers
lib/prompts.ts         → ⭐ toda a "inteligência" de IA (1473 linhas)
lib/chat-types.ts      → ⭐ 12 arenas, 4 capítulos, taxonomia de temas
lib/billing.ts         → ⭐ tiers × Stripe Price IDs
lib/session.ts         → ⭐ JWT/cookie de sessão
proxy.ts               → ⭐ middleware de borda (auth + gate de tier)
firestore.rules        → ⚠️ permissivas (desenvolvimento)
```

---

## ⚠️ As 10 coisas que você precisa saber antes de mexer

| # | Fato | Por quê importa |
|---|---|---|
| 1 | **`userPath = {uid}_{primeiroNome}`** em quase todo o Firestore | Se o usuário renomear o perfil, o app "perde" os dados. Billing usa `{uid}` puro — dois namespaces. |
| 2 | **`firestore.rules` libera tudo para qualquer autenticado** | Qualquer usuário lê/escreve dados de qualquer outro. 🔴 Bloqueante para produção. |
| 3 | **Não há enforcement de tier no servidor** | As APIs de IA só checam o Firebase ID token. Free/inadimplente pode usar tudo via chamada direta. |
| 4 | **`sidesText` nunca é persistido** pelo wizard de audição | Reader Copilot, Stage 9 do coach e "EXACT SIDES TEXT" ficam vazios. |
| 5 | **A síntese do DNA (`/api/dna/synthesize`) sempre retorna 400** | Ela lê `dnaVault`, que nenhum código escreve. O "Master Profile/UAP" nunca é gerado. |
| 6 | **O progresso do DNA é inatingível** | A API devolve `extractions: null`; o cálculo de progresso/conclusão/desbloqueio fica num `if` morto. Progresso fixo em 25%. |
| 7 | **Os 12 `SECTION_PROMPTS` de arena são código morto** | A UI navega por 4 **capítulos** (`chapter_1..4`), não pelas 12 arenas. |
| 8 | **O RAG do Acting Coach não roda** | `excerpts: []` sempre; o modelo é hardcoded e a env `ACTING_COACH_GENERATION_MODEL` não tem efeito. |
| 9 | **A validação Zod do perfil não executa** | `zodResolver` instalado, mas `handleSubmit` nunca é chamado — só o `maxLength` do DOM vale. |
| 10 | **`/auditions/new` é 404** e `/personal-dna` é um CTA morto | Só existem `/auditions/new/brief` e `/auditions/new/sides`. |

Lista completa priorizada: [doc 02, §11 — Backlog](./02-regras-de-negocio.md#11-backlog-priorizado-de-correções).

---

## Arquivos de pesquisa (`_research/`)

Relatórios técnicos detalhados, com citações `arquivo:linha`, que serviram de base para os documentos acima:

| Arquivo | Conteúdo |
|---|---|
| `auth-billing.md` | Autenticação, sessão JWT, tiers, Stripe, webhooks, Firestore rules |
| `dna-engine.md` | Motor de DNA: prompts, extração, pivô, síntese, baseline, voz, bugs |
| `auditions-coach-profile.md` | Audições, Acting Coach, perfil do ator, gating, código morto |
| `pages-inventory.md` | Inventário completo de páginas, layouts e route handlers |
| `design-system.md` | Tokens, tipografia, 52 primitivos, adoção real, dívidas |

> Os relatórios em `_research/` são **notas de investigação**: mais longos, mais repetitivos e mais "crus" que os documentos numerados. Use-os para aprofundar um achado específico.
