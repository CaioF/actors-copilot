# 04 — Design System

> Documentação do sistema visual do **The Actor's Copilot**: tokens, tipografia, primitivos, padrões de layout e convenções para trabalhar na UI.
>
> Base: **Tailwind CSS v4.2.0** (CSS-first, sem `tailwind.config.*`) · **shadcn/ui** estilo `new-york` sobre **Radix UI** · ícones **lucide-react** · React `19.2.4`.

---

## Sumário

1. [Visão geral e princípios](#1-visão-geral-e-princípios)
2. [Configuração e arquivos](#2-configuração-e-arquivos)
3. [Tipografia](#3-tipografia)
4. [Tokens de cor](#4-tokens-de-cor)
5. [Raio, espaçamento, sombras e movimento](#5-raio-espaçamento-sombras-e-movimento)
6. [Dark mode](#6-dark-mode)
7. [Primitivos shadcn/ui](#7-primitivos-shadcnui)
8. [Adoção real dos primitivos](#8-adoção-real-dos-primitivos)
9. [Padrões de layout do produto](#9-padrões-de-layout-do-produto)
10. [Cores hard-coded e divergências de marca](#10-cores-hard-coded-e-divergências-de-marca)
11. [Responsividade](#11-responsividade)
12. [Acessibilidade](#12-acessibilidade)
13. [Como trabalhar no design system](#13-como-trabalhar-no-design-system)
14. [Dívidas e lacunas](#14-dívidas-e-lacunas)

---

## 1. Visão geral e princípios

| Aspecto | Decisão |
|---|---|
| Motor de CSS | Tailwind v4 via `@tailwindcss/postcss` — **não existe** `tailwind.config.ts/js`; o tema é 100% CSS em `app/globals.css` |
| Configuração shadcn | `components.json` → `style: "new-york"`, `rsc: true`, `tsx: true`, `baseColor: "neutral"`, `cssVariables: true`, `prefix: ""`, `iconLibrary: "lucide"`, `tailwind.config: ""` |
| Tokens | **46** CSS custom properties em `:root` + **35** em `.dark`, mapeadas para utilitários em `@theme inline` |
| Marca | Laranja `#EE6312` (light) / `#F06A1C` (dark) como `--primary`; fundo creme `#f6ecda` |
| Títulos | **Antonio** (`font-title`) — condensada, em maiúsculas, display |
| Corpo | **Inter** (`font-sans`, default) |
| Raio base | `--radius: 0.75rem` (12px), com escala derivada |
| Dark mode | `next-themes` com `attribute="class"`; variante Tailwind `@variant dark (&:where(.dark, .dark *))` |
| Utilitário custom | apenas `.custom-scrollbar` |
| Tipografia longa | `@plugin "@tailwindcss/typography"` + `prose prose-neutral dark:prose-invert` (usado em resultados de audição) |

**Princípio observado na prática:** o design system "de fábrica" (Card/Badge/Tabs/Select/Table) **quase não governa a UI real**. As telas do produto são majoritariamente **markup Tailwind artesanal**, com muitos hex hard-coded. Ao trabalhar aqui, prefira **tokens** (`bg-background`, `text-foreground`, `bg-primary`) em código novo e trate os hex fixos como legado a migrar.

---

## 2. Configuração e arquivos

### 2.1 `app/globals.css` — a fonte do tema

```css
@import 'tailwindcss';                       /* base v4 */
@import 'tw-animate-css';                    /* animate-in/out, fade, zoom, slide */
@plugin "@tailwindcss/typography";           /* classe `prose` */
@variant dark (&:where(.dark, .dark *));     /* dark por classe */
```

### 2.2 `postcss.config.mjs`

```js
plugins: { '@tailwindcss/postcss': {} }
```

Único plugin. **Sem** `autoprefixer` no pipeline (a dependência existe no `package.json`, mas o Tailwind v4 faz o prefixamento via Lightning CSS).

### 2.3 `components.json`

| Chave | Valor |
|---|---|
| `style` | `new-york` |
| `rsc` / `tsx` | `true` / `true` |
| `tailwind.config` | `""` (vazio — v4 CSS-first) |
| `tailwind.css` | `app/globals.css` |
| `tailwind.baseColor` | `neutral` |
| `tailwind.cssVariables` | `true` |
| `iconLibrary` | `lucide` |
| `aliases` | `@/components` · `@/lib/utils` · `@/components/ui` · `@/lib` · `@/hooks` |

### 2.4 `lib/utils.ts` — o único helper de classes

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
```

`cn()` é usado por **todos** os primitivos e por vários componentes de app. **Sempre use `cn()`** para compor/sobrescrever classes.

### 2.5 Aliases e caminhos

`tsconfig.json` define `"@/*": ["./*"]` (raiz do projeto, sem `src/`). `target: ES6`, `strict: true`, `jsx: react-jsx`, `moduleResolution: bundler`.

### 2.6 `next.config.mjs`

```js
const nextConfig = { images: { unoptimized: true } }
```

⚠️ O **otimizador de imagens do Next está desligado** no app inteiro. Ao usar `next/image`, não conte com otimização automática.

---

## 3. Tipografia

Carregadas via `next/font/google` em `app/layout.tsx:10-11`, aplicadas no `<body>` (`:32`):

```tsx
const antonio = Antonio({ subsets: ['latin'], variable: '--font-antonio' })
const inter   = Inter({ subsets: ['latin'], variable: '--font-inter' })
```

| Fonte | Variável CSS | Token Tailwind | Utilitário | Uso |
|---|---|---|---|---|
| **Antonio** | `--font-antonio` | `--font-title` | `font-title` | **117 usos** — todos os títulos (`h1`/`h2`/`h3`), preços, labels de seção, logo textual |
| **Inter** | `--font-inter` | `--font-sans` | `font-sans` (default) | Corpo de texto; aplicado implicitamente pelo preflight |
| *Geist Mono* | — | `--font-mono` | `font-mono` | ⚠️ **Fonte não carregada** — cai no monospace do sistema. Único uso: tooltip do `chart.tsx` |

**Convenções:**

| Convenção | Regra observada |
|---|---|
| Títulos | `font-title` + `font-bold`/`font-extrabold`, frequentemente com `uppercase` e `tracking-wide`/`tracking-wider` |
| Corpo | `text-xs` / `text-sm` predominam; `text-base` em inputs (com `md:text-sm`) |
| Escala de títulos | `text-xl`→`text-2xl` (headers de página) · `text-3xl`/`text-4xl` (seções/hub) · `text-5xl`→`text-9xl` (landing/login) |
| Micro-labels | `text-[10px] font-bold tracking-widest uppercase text-muted-foreground` |
| `font-sans` explícito | Raro (8 usos) — serve para **reverter** para Inter dentro de blocos que herdam display/serif |
| `font-serif` | Pontual em texto de sides (`reader-copilot`, `dna-vault`) — família default do Tailwind (não carregada) |
| `prose` | **Sim, usado** — 8 ocorrências em 3 arquivos de resultado/impressão de audição, sempre `prose prose-neutral dark:prose-invert max-w-none` |

---

## 4. Tokens de cor

### 4.1 Tema claro (`:root`, `app/globals.css:8-46`)

| Token | Valor | Utilitários gerados |
|---|---|---|
| `--background` | `#f6ecda` | `bg-background`, `text-background` |
| `--foreground` | `#2A3328` | `bg-foreground`, `text-foreground` |
| `--card` | `#FFFFFF` | `bg-card` |
| `--card-foreground` | `#2A3328` | `text-card-foreground` |
| `--popover` | `#ffffff` | `bg-popover` |
| `--popover-foreground` | `#2C3328` | `text-popover-foreground` |
| **`--primary`** | **`#EE6312`** | `bg-primary`, `text-primary`, `border-primary`, `ring-primary` |
| `--primary-foreground` | `#FFFFFF` | `text-primary-foreground` |
| `--secondary` | `#4A5548` | `bg-secondary`, `text-secondary` |
| `--secondary-foreground` | `#F5F0E8` | `text-secondary-foreground` |
| `--muted` | `#E8DFD0` | `bg-muted` |
| `--muted-foreground` | `#5C6659` | `text-muted-foreground` |
| `--accent` | `#D4DDD6` | `bg-accent`, `text-accent` |
| `--accent-foreground` | `#2C3328` | `text-accent-foreground` |
| `--destructive` | `#C45A3C` | `bg-destructive`, `text-destructive` |
| `--destructive-foreground` | `#ffffff` | `text-destructive-foreground` |
| `--border` | `#DDD6CA` | `border-border` |
| `--input` | `#E8DFD0` | `border-input`, `bg-input` |
| `--ring` | `#E8721A` | `ring-ring` |
| `--chart-1` | `#E8721A` | `bg-chart-1` |
| `--chart-2` | `#3D4A3C` | `bg-chart-2` |
| `--chart-3` | `#8B5E3C` | `bg-chart-3` |
| `--chart-4` | `#D4DDD6` | `bg-chart-4` |
| `--chart-5` | `#E8DFD0` | `bg-chart-5` |
| `--radius` | `0.75rem` | base da escala (não gera utilitário) |
| `--sidebar-bg` | `#3D4A3C` | `bg-sidebar` (via `--color-sidebar`) |
| `--sidebar-foreground` | `#F5F0E8` | `text-sidebar-foreground` |
| `--sidebar-primary` | `#E8721A` | `bg-sidebar-primary` |
| `--sidebar-primary-foreground` | `#2C3328` | `text-sidebar-primary-foreground` |
| `--sidebar-accent` | `rgba(255,255,255,0.08)` | `bg-sidebar-accent` |
| `--sidebar-accent-foreground` | `#F5F0E8` | `text-sidebar-accent-foreground` |
| `--sidebar-border` | `rgba(255,255,255,0.1)` | `border-sidebar-border` |
| `--sidebar-ring` | `#E8721A` | `ring-sidebar-ring` |
| `--danger` | `#8B5E3C` | ⚠️ **sem utilitário** (não mapeado em `@theme`) |
| `--danger-foreground` | `#F5F0E8` | ⚠️ sem utilitário |
| `--danger-text` | `#C45A3C` | ⚠️ sem utilitário |

### 4.2 Tema escuro (`.dark`, `app/globals.css:49-85`)

| Token | Valor dark | Token | Valor dark |
|---|---|---|---|
| `--background` | `#111513` | `--chart-1` | `#FB923C` |
| `--foreground` | `#F0F4EF` | `--chart-2` | `#334155` |
| `--card` | `#1c221e` | `--chart-3` | `#7C2D12` |
| `--card-foreground` | `#F0F4EF` | `--chart-4` | `#334155` |
| `--popover` | `#111827` | `--chart-5` | `#475569` |
| `--popover-foreground` | `#F8FAFC` | `--sidebar-bg` | `#1C221F` |
| `--primary` | `#F06A1C` | `--sidebar-foreground` | `#B5C0B3` |
| `--primary-foreground` | `#FFFFFF` | `--sidebar-accent` | `rgba(255,255,255,0.08)` |
| `--secondary` | `#94A3B8` | `--sidebar-border` | `rgba(255,255,255,0.08)` |
| `--secondary-foreground` | `#E2E8F0` | `--sidebar-primary` | `#FB923C` |
| `--muted` | `#242B27` | `--sidebar-primary-foreground` | `#111827` |
| `--muted-foreground` | `#9AA597` | `--sidebar-accent-foreground` | `#E2E8F0` |
| `--accent` | `#111827` | `--sidebar-ring` | `#FB923C` |
| `--accent-foreground` | `#E2E8F0` | `--danger` | `#F97316` |
| `--destructive` | `#FB923C` | `--danger-foreground` | `#F8FAFC` |
| `--destructive-foreground` | `#ffffff` | `--danger-text` | `#FB923C` |
| `--border` | `#2B332E` | `--input` | `#1F2937` |
| `--ring` | `#FB923C` | | |

> `--radius` **não** é redefinido em `.dark` → o raio é invariante ao tema.

### 4.3 Mapeamento `@theme inline` e armadilhas

`@theme inline` (`globals.css:87-127`) mapeia cada token para `--color-*` (mais `--font-sans`/`--font-title`/`--font-mono` e a escala de raio).

**Armadilhas confirmadas:**
- 🔴 `--danger`, `--danger-foreground`, `--danger-text` **não têm `--color-*`** → **não existem** `bg-danger`/`text-danger`. Só funcionam via `bg-[var(--danger)]`. Na prática, `--danger*` **não é referenciado em nenhum componente** (o "Danger Zone" de `/settings` usa `bg-primary`).
- ⚠️ `--sidebar-bg` só é acessível como `bg-sidebar`; **não existe** `bg-sidebar-bg`.
- ⚠️ `--radius-2xl`/`--radius-3xl` **não** são sobrescritos → usam os defaults do Tailwind v4 (`1rem` e `1.5rem`), apesar de `rounded-2xl` (83 usos) e `rounded-3xl` (36 usos) serem muito utilizados.
- ⚠️ `--font-mono` aponta para Geist Mono, que **não é carregada**.
- Não há `--breakpoint-*`, `--spacing-*`, `--shadow-*`, `--ease-*` ou `--animate-*` customizados — tudo usa os defaults do v4 (animações vêm do `tw-animate-css`).

### 4.4 `@layer base`

```css
*    { @apply border-border outline-ring/50; }   /* borda padrão + outline translúcido */
body { @apply bg-background text-foreground; }
```

### 4.5 Utilitário custom

Único utilitário: **`.custom-scrollbar`** (scrollbar fina de 6px, thumb `#4b6354`, hover `#f97316`). Usado em `app/chat/page.tsx:134`.

> ⚠️ `scrollbar-none` (em `components/app-sidebar.tsx:112`) **não existe** no Tailwind nem em plugin → classe inerte.

---

## 5. Raio, espaçamento, sombras e movimento

### 5.1 Escala de raio efetiva

| Utilitário | Fórmula | Valor |
|---|---|---|
| `rounded-xs` | default v4 | 2px |
| `rounded-sm` | `calc(var(--radius) - 4px)` | **8px** |
| `rounded-md` | `calc(var(--radius) - 2px)` | **10px** |
| `rounded-lg` | `var(--radius)` | **12px** |
| `rounded-xl` | `calc(var(--radius) + 4px)` | **16px** |
| `rounded-2xl` | default v4 | **16px** |
| `rounded-3xl` | default v4 | **24px** |
| `rounded-[calc(var(--radius)-5px)]` | ad-hoc (`input-group`, `kbd`) | **7px** |

Frequência: `rounded-full` 252 · `rounded-2xl` 83 · `rounded-xl` 74 · `rounded-md` 58 · `rounded-lg` 48 · `rounded-3xl` 36 · `rounded-sm` 18.

### 5.2 Espaçamento

Escala default (`--spacing: 0.25rem`), sem customização. Padrões recorrentes:
- Containers: `px-4 sm:px-8` + `py-6` ou `p-4 sm:p-8`
- Cards: `p-6` / `p-8 sm:p-12`
- Grids: `gap-6` / `gap-8`; seções `space-y-8`
- Grids típicos: `grid-cols-1 md:grid-cols-3` (dashboard) · `md:grid-cols-2` (planos) · `md:grid-cols-2 lg:grid-cols-3` (reader) · `grid-cols-1 lg:grid-cols-[1fr_280px]` (resultado de audição)

### 5.3 Sombras

| Classe | Usos | Contexto |
|---|---|---|
| `shadow-sm` | 114 | padrão de cards/superfícies |
| `shadow-md` | 27 | popovers/menus, hover de card |
| `shadow-lg` | 24 | modais, dropdowns, botões de destaque |
| `shadow-xs` | 19 | inputs, selects, toggles (novo `xs` do v4) |
| `shadow-2xs` | 12 | botões-pílula do chat |
| `shadow-2xl` | 10 | modais/overlays |
| `shadow-xl` | 9 | painéis, sidebar |

### 5.4 Movimento

- **Transições:** `transition-colors` (197 usos) é o padrão; `transition-all` (134) em botões/cards; `transition-transform` (18); `transition-opacity` (7).
- **Durações:** `duration-200` (32), `duration-300` (18), `duration-500` (6), `duration-150` (5).
- **Animações:** `animate-in` (44) / `animate-out` (22) do `tw-animate-css`; `animate-spin` (21) loaders; `animate-pulse` (21) skeletons; `animate-bounce` (14) no splash do `ProtectedRoute`; `animate-ping` (3).
- **Micro-interações:** `hover:scale-105` (logos/landing), `active:scale-[0.98]` (botão de plano), `group-hover:translate-x-1` (setas).
- 🔴 **`prefers-reduced-motion` não é tratado** em nenhum lugar.

### 5.5 Foco e bordas

- **Padrão de foco dos primitivos:** `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]` (71 ocorrências).
- **Estado inválido:** `aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive`.
- **Bordas:** `border-border` em geral; `border-border/30` (card, footer) e `border-border/50` (header, divisor) para suavizar.
- Reset global de outline em `globals.css:131`.

---

## 6. Dark mode

| Camada | Implementação |
|---|---|
| Variante Tailwind | `@variant dark (&:where(.dark, .dark *))` — estratégia por **classe** no `<html>` |
| Provider | `components/theme-provider.tsx` — wrapper fino do `next-themes` |
| Montagem | `app/layout.tsx:33` — `<ThemeProvider attribute="class" defaultTheme="light" enableSystem>` |
| Anti-flash | `app/layout.tsx:31` — `<html lang="en" suppressHydrationWarning>` |
| Toggle | `components/theme-toggle.tsx` (dropdown hand-rolled com light/dark/system) |

- **72 ocorrências** de `dark:` em `app/` e `components/`. Os pontos mais densos estão nos primitivos shadcn.
- ⚠️ `dialog.tsx` e `alert-dialog.tsx` fixam `dark:bg-neutral-950 dark:text-neutral-100 dark:border-neutral-800` **fora** da paleta de tokens.
- 🔴 **Muitos componentes do produto não respondem ao dark mode** porque usam hex fixos (ver §10). Ex.: a sidebar real (`bg-[#2A3B31]`), o perfil público e a landing.

---

## 7. Primitivos shadcn/ui

**52 arquivos** em `components/ui/`. Convenções transversais:
- `"use client"` quando usam Radix/hooks;
- `data-slot="<kebab-name>"` em todos os elementos;
- `function Component(...)` + bloco `export { ... }` no fim;
- tipagem via `React.ComponentProps<typeof Primitive>`;
- variantes com **CVA** (`class-variance-authority`).

### 7.1 Inventário

| Arquivo | Primitivo / lib | Exporta (resumo) |
|---|---|---|
| `accordion.tsx` | Radix Accordion | `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` |
| `alert-dialog.tsx` | Radix Alert Dialog | `AlertDialog`, `…Trigger`, `…Content`, `…Header`, `…Footer`, `…Title`, `…Description`, `…Action`, `…Cancel`, `…Portal`, `…Overlay` |
| `alert.tsx` | HTML + CVA | `Alert`, `AlertTitle`, `AlertDescription` |
| `aspect-ratio.tsx` | Radix Aspect Ratio | `AspectRatio` |
| `avatar.tsx` | Radix Avatar | `Avatar`, `AvatarImage`, `AvatarFallback` |
| `badge.tsx` | Slot + CVA | `Badge`, `badgeVariants` |
| `breadcrumb.tsx` | Slot | `Breadcrumb`, `…List`, `…Item`, `…Link`, `…Page`, `…Separator`, `…Ellipsis` |
| `button-group.tsx` | Slot + CVA | `ButtonGroup`, `…Separator`, `…Text`, `buttonGroupVariants` |
| `button.tsx` | Slot + CVA | `Button`, `buttonVariants` |
| `calendar.tsx` | `react-day-picker` v9 | `Calendar`, `CalendarDayButton` |
| `card.tsx` | HTML | `Card`, `…Header`, `…Title`, `…Description`, `…Action`, `…Content`, `…Footer` |
| `carousel.tsx` | `embla-carousel-react` | `Carousel`, `…Content`, `…Item`, `…Previous`, `…Next`, `CarouselApi` |
| `chart.tsx` | `recharts` | `ChartContainer`, `ChartTooltip`, `…Content`, `ChartLegend`, `…Content`, `ChartStyle` |
| `checkbox.tsx` | Radix Checkbox | `Checkbox` |
| `collapsible.tsx` | Radix Collapsible | `Collapsible`, `…Trigger`, `…Content` |
| `command.tsx` | `cmdk` | `Command`, `…Dialog`, `…Input`, `…List`, `…Empty`, `…Group`, `…Item`, `…Shortcut`, `…Separator` |
| `context-menu.tsx` | Radix Context Menu | 15 exports |
| `dialog.tsx` | Radix Dialog | `Dialog`, `…Close`, `…Content`, `…Description`, `…Footer`, `…Header`, `…Overlay`, `…Portal`, `…Title`, `…Trigger` |
| `drawer.tsx` | `vaul` | `Drawer`, `…Portal`, `…Overlay`, `…Trigger`, `…Close`, `…Content`, `…Header`, `…Footer`, `…Title`, `…Description` |
| `dropdown-menu.tsx` | Radix Dropdown Menu | 15 exports |
| `empty.tsx` | HTML + CVA | `Empty`, `…Header`, `…Title`, `…Description`, `…Content`, `…Media` |
| `field.tsx` | HTML + CVA | `Field`, `…Label`, `…Description`, `…Error`, `…Group`, `…Legend`, `…Separator`, `…Set`, `…Content`, `…Title` |
| `form.tsx` | Radix Label + RHF | `useFormField`, `Form`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`, `FormField` |
| `hover-card.tsx` | Radix Hover Card | `HoverCard`, `…Trigger`, `…Content` |
| `input-group.tsx` | HTML + CVA | `InputGroup`, `…Addon`, `…Button`, `…Text`, `…Input`, `…Textarea` |
| `input-otp.tsx` | `input-otp` | `InputOTP`, `…Group`, `…Slot`, `…Separator` |
| `input.tsx` | HTML | `Input` |
| `item.tsx` | Slot + CVA | `Item`, `…Media`, `…Content`, `…Actions`, `…Group`, `…Separator`, `…Title`, `…Description`, `…Header`, `…Footer` |
| `kbd.tsx` | HTML | `Kbd`, `KbdGroup` |
| `label.tsx` | Radix Label | `Label` |
| `menubar.tsx` | Radix Menubar | 16 exports |
| `navigation-menu.tsx` | Radix Navigation Menu + CVA | `…Root`, `…List`, `…Item`, `…Content`, `…Trigger`, `…Link`, `…Indicator`, `…Viewport`, `navigationMenuTriggerStyle` |
| `pagination.tsx` | `buttonVariants` | `Pagination`, `…Content`, `…Link`, `…Item`, `…Previous`, `…Next`, `…Ellipsis` |
| `popover.tsx` | Radix Popover | `Popover`, `…Trigger`, `…Content`, `…Anchor` |
| `progress.tsx` | Radix Progress | `Progress` |
| `radio-group.tsx` | Radix Radio Group | `RadioGroup`, `RadioGroupItem` |
| `resizable.tsx` | `react-resizable-panels` | `ResizablePanelGroup`, `…Panel`, `…Handle` |
| `scroll-area.tsx` | Radix Scroll Area | `ScrollArea`, `ScrollBar` |
| `select.tsx` | Radix Select | `Select`, `…Content`, `…Group`, `…Item`, `…Label`, `…ScrollUpButton`, `…ScrollDownButton`, `…Separator`, `…Trigger`, `…Value` |
| `separator.tsx` | Radix Separator | `Separator` |
| `sheet.tsx` | Radix Dialog | `Sheet`, `…Trigger`, `…Close`, `…Content`, `…Header`, `…Footer`, `…Title`, `…Description` |
| `sidebar.tsx` | Slot + `useIsMobile` | 24 exports (`Sidebar`…`useSidebar`) — **não usado** |
| `skeleton.tsx` | HTML | `Skeleton` |
| `slider.tsx` | Radix Slider | `Slider` |
| `sonner.tsx` | `sonner` | `Toaster` — **não usado** |
| `spinner.tsx` | lucide `Loader2Icon` | `Spinner` |
| `switch.tsx` | Radix Switch | `Switch` |
| `table.tsx` | HTML | `Table`, `…Header`, `…Body`, `…Footer`, `…Row`, `…Head`, `…Cell`, `…Caption` |
| `tabs.tsx` | Radix Tabs | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` |
| `textarea.tsx` | HTML | `Textarea` |
| `toast.tsx` | Radix Toast + CVA | `ToastProvider`, `…Viewport`, `Toast`, `…Title`, `…Description`, `…Close`, `…Action` |
| `toaster.tsx` | Radix Toast via `useToast` | `Toaster` — **é o montado no root layout** |
| `toggle.tsx` | Radix Toggle + CVA | `Toggle`, `toggleVariants` |
| `toggle-group.tsx` | Radix Toggle Group | `ToggleGroup`, `ToggleGroupItem` |
| `tooltip.tsx` | Radix Tooltip | `Tooltip`, `…Trigger`, `…Content`, `…Provider` |

### 7.2 Variantes exatas dos primitivos core

**`Button`** (`components/ui/button.tsx`) — `asChild` via `Slot`:

| `variant` | Classes |
|---|---|
| `default` | `bg-primary text-primary-foreground hover:bg-primary/90` |
| `destructive` | `bg-destructive text-white hover:bg-destructive/90 … dark:bg-destructive/60` |
| `outline` | `border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 …` |
| `secondary` | `bg-secondary text-secondary-foreground hover:bg-secondary/80` |
| `ghost` | `hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50` |
| `link` | `text-primary underline-offset-4 hover:underline` |

| `size` | Classes |
|---|---|
| `default` | `h-9 px-4 py-2 has-[>svg]:px-3` |
| `sm` | `h-8 rounded-md gap-1.5 px-3` |
| `lg` | `h-10 rounded-md px-6` |
| `icon` / `icon-sm` / `icon-lg` | `size-9` / `size-8` / `size-10` |

**`Badge`**: `default` · `secondary` · `destructive` · `outline` (base com `rounded-md border px-2 py-0.5 text-xs font-medium`).

**`Alert`**: `default` (`bg-card text-card-foreground`) · `destructive`.

**`Toast`**: `default` (`border bg-background text-foreground`) · `destructive`.

**`Toggle`**: `variant` `default`/`outline` × `size` `default`(`h-9 px-2 min-w-9`)/`sm`/`lg`.

**`Item`**: `variant` `default`/`outline`/`muted` × `size` `default`(`p-4 gap-4`)/`sm`.
**`ItemMedia`**: `default`/`icon`/`image`. **`EmptyMedia`**: `default`/`icon`.
**`ButtonGroup`**: `orientation` `horizontal`/`vertical`.
**`Field`**: `orientation` `vertical`(default)/`horizontal`/`responsive` (container queries).
**`InputGroupAddon`**: `align` `inline-start`/`inline-end`/`block-start`/`block-end`. **`InputGroupButton`**: `size` `xs`/`sm`/`icon-xs`/`icon-sm`.
**`SelectTrigger`**: `size` `sm`/`default`. **`SelectContent`**: `position` `popper`/`item-aligned`.
**`Sheet`**: `side` `right`/`left`/`top`/`bottom`.
**`Sidebar`** (não usado): `side` `left`/`right` · `variant` `sidebar`/`floating`/`inset` · `collapsible` `offcanvas`/`icon`/`none`.

### 7.3 Classes-base de referência

| Componente | Classe principal |
|---|---|
| `Input` | `border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs … md:text-sm` + foco/inválido |
| `Textarea` | `field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs md:text-sm` |
| `Card` | `bg-card text-card-foreground flex flex-col gap-6 rounded-xl border border-border/30 py-6 shadow-sm transition-colors` |
| `TabsList` | `bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]` |
| `Progress` | trilha `bg-primary/20 relative h-2 w-full overflow-hidden rounded-full`; indicador `bg-primary` |
| `Skeleton` | `bg-accent animate-pulse rounded-md` |
| `Spinner` | `Loader2Icon` com `role="status" aria-label="Loading"` |
| `TooltipContent` | `bg-foreground text-background z-50 w-fit rounded-md px-3 py-1.5 text-xs` |
| `Separator` | `bg-border shrink-0 data-[orientation=horizontal]:h-px …` |
| `Switch` | `data-[state=checked]:bg-primary data-[state=unchecked]:bg-input h-[1.15rem] w-8 rounded-full` |

> ⚠️ **Bug latente:** o variant `outline` do `sidebarMenuButtonVariants` usa `hsl(var(--sidebar-border))`, mas os tokens são hex/`rgba`, não canais HSL → a sombra resolve para um valor inválido (`components/ui/sidebar.tsx:479`).

---

## 8. Adoção real dos primitivos

Este é o achado mais importante para quem for trabalhar na UI:

**Dos 52 primitivos, apenas 7 são importados por telas do produto:**

| Primitivo | Importadores |
|---|---|
| `alert-dialog` | `auditions/page.tsx`, `settings/page.tsx`, `audition-wizard.tsx` |
| `skeleton` | `dna-vault/page.tsx`, `chat-messages.tsx` |
| `avatar` | `chat-messages.tsx`, `dashboard-header.tsx` |
| `dialog` | `break-check-in-modal.tsx` |
| `popover` | `quick-prompts-dropdown.tsx` |
| `command` | `quick-prompts-dropdown.tsx` |
| `dropdown-menu` | `acting-coach/page.tsx` |

Os demais são importados **apenas entre primitivos** (`button`, `input`, `label`, `textarea`, `sheet`, `tooltip`, `toggle`, `toast`, `separator`) ou **nunca** (`card`, `badge`, `tabs`, `select`, `table`, `form`, `chart`, `accordion`, `alert`, `drawer`, `empty`, `field`, `item`, `kbd`, `progress`, `radio-group`, `scroll-area`, `sidebar`, `slider`, `switch`, `sonner`, `spinner`, `calendar`, `carousel`, `context-menu`, `hover-card`, `input-otp`, `menubar`, `navigation-menu`, `pagination`, `aspect-ratio`, `breadcrumb`, `button-group`, `checkbox`, `collapsible`, `input-group`, `resizable`, `toggle-group`).

**Consequências práticas:**
1. O design system "de fábrica" **não governa** a UI. As telas usam `div` + Tailwind direto.
2. `Card`, `Badge`, `Tabs`, `Select`, `Table`, `Form` são **peso morto** — você pode usá-los em código novo, mas saiba que o padrão vigente é o markup artesanal.
3. Há **duplicações**: duas sidebars (`components/ui/sidebar.tsx`, 726 linhas, não usada × `components/app-sidebar.tsx`, usada) e dois toasters (Radix `toaster.tsx` montado × `sonner.tsx` não montado).

---

## 9. Padrões de layout do produto

### 9.1 `components/app-sidebar.tsx` — a sidebar real (226 linhas, Client)

- Usa `useSidebar()` **do app** (`lib/context/SidebarContext.tsx`), não o do shadcn.
- 🔴 **Cores hard-coded, fora dos tokens:** `bg-[#2A3B31]`, `text-[#E8E6E3]`, `border-[#B36B22]`, `bg-[#3B3A2C]/60`. **Não reage a dark mode.**
- Largura fixa `w-64`; `fixed inset-y-0 left-0 z-40` no mobile, `md:relative md:translate-x-0` no desktop.
- Estrutura: logo (`/logo.png`) → "Quick Actions" → "MENU" → botão Upgrade/Manage Plan → link externo Skool → Settings → Logout.
- **Estado ativo:** `pathname === item.href` (igualdade exata — **não** marca subrotas).
- Padrão de item: `flex items-center gap-3.5 rounded-md px-2 py-2 text-sm font-medium`, ativo `text-white font-semibold` / inativo `text-white/70 hover:text-white`.
- Overlay mobile com `aria-label="Close menu"`.

### 9.2 `components/dashboard-header.tsx` — cabeçalho padrão (123 linhas, Client)

- Props: `title?`, `titleSlot?`, `extraActions?`, `className?`.
- Marcado por `flex bg-card items-center justify-between gap-3 px-4 sm:px-8 mb-4 py-4 border-b border-border/50 transition-colors`.
- Título: `truncate font-title text-xl font-bold text-foreground sm:text-2xl`.
- Ações à direita: `extraActions` → `ThemeToggle` → botão suporte (Mail) → `/settings` → `/profile` com `Avatar` + primeiro nome. Todos os botões de ícone: `flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground` + `aria-label`.
- Botão de menu mobile via `useSidebar().setIsOpen(true)`.
- Modal "Need Help?" hand-rolled (`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm` + `rounded-2xl bg-popover p-6 shadow-xl`), e-mail `support@theactorscopilot.com`.

### 9.3 `components/dashboard-footer.tsx` (26 linhas, Server)

`shrink-0 flex flex-wrap items-center justify-center gap-6 px-8 py-6 text-xs text-muted-foreground border-t border-border/30 mt-auto`. Três selos com ícones `text-primary/70`: **NDA Safe** (Lock) · **Delete Anytime** (Trash2) · **Private By Default** (Shield).

### 9.4 Perfil público (`components/public-profile/*`, 11 arquivos) — paleta própria

Server Components com **paleta hard-coded** (não usa tokens):

| Componente | Padrão |
|---|---|
| `public-navbar.tsx` | `sticky top-0 z-50 border-b border-[#3A4F5A]/30 bg-[#3A4F5A] px-6 py-3`; logo + "Actor Profile" em `font-title text-sm font-bold text-[#F5F0E8]` |
| `public-footer.tsx` | fileira de privacidade (`text-xs text-[#656565]`) + barra `bg-[#3A4F5A]` |
| `hero-section.tsx` | foto `h-52 w-44 rounded-2xl bg-[#555A4A]`; nome `font-title text-2xl font-bold text-[#212121]`; botões `rounded-full bg-[#FF751F] text-white` e `border-[#C7C7C7] bg-white`; card de representação `rounded-xl border-[#C7C0B5] bg-[#F0E9DE] p-5 lg:w-64` |
| demais seções | títulos `font-title`, paleta `#212121`/`#656565`/`#7E7E7E`/`#F0E9DE` |

Fundo do layout: `bg-[#F0E8DC]` (`app/actors/layout.tsx:10`).

### 9.5 Landing (`app/page.tsx`, Server)

Paleta própria de "palco": fundo `bg-[#152323]`, títulos `font-title` em `#EFEADD`/`#F2671A`, gradientes radiais inline e `StartEmblem` (link para `/dashboard` com `aria-label`, `hover:scale-105`).

### 9.6 Splash de carregamento (`ProtectedRoute`)

Fundo `#F0E8DC`, círculos `animate-ping`/`animate-pulse` em `#E8721A`, logo em `#3D4A3C`, três pontos `animate-bounce` e texto rotativo de `lib/loading-texts.ts`. Puramente visual (sem `aria-live`).

---

## 10. Cores hard-coded e divergências de marca

🔴 **O laranja da marca está duplicado em 4 valores diferentes:**

| Valor | Onde | Papel |
|---|---|---|
| `#EE6312` | `--primary` (light) | token oficial |
| `#F06A1C` | `--primary` (dark) | token oficial dark |
| `#E8721A` | `--ring`, `--chart-1`, `--sidebar-primary`, `--sidebar-ring` + **muitos hard-codes** | divergência |
| `#F2671A` | landing (`app/page.tsx`) | divergência |
| `#FF751F` | perfil público (`hero-section.tsx`, `actors/[slug]/page.tsx`) | divergência |

**Outros hex recorrentes fora dos tokens:**

| Hex | Onde | Deveria ser |
|---|---|---|
| `#2A3B31` | sidebar real | `bg-sidebar` |
| `#3D4A3C` | `--sidebar-bg`, splash | `bg-sidebar` |
| `#3A4F5A` | navbar/footer público | token próprio |
| `#F0E8DC` | fundo do perfil público, splash | `bg-background` |
| `#212121` / `#656565` / `#7E7E7E` | perfil público | `text-foreground` / `text-muted-foreground` |
| `#2C3328` / `#6B6B6B` | `personal-dna` | `text-foreground` / `text-muted-foreground` |

> ⚠️ **Regra prática:** ao criar telas **internas**, use tokens. Ao mexer em **sidebar, perfil público ou landing**, você está na zona de paleta hard-coded — mudanças de tema não as afetam.

---

## 11. Responsividade

Breakpoints **default do Tailwind v4** (nenhum `--breakpoint-*` customizado):

| Prefixo | Largura | Usos em `app/`+`components/` |
|---|---|---|
| `sm:` | ≥ 640px | **250** |
| `md:` | ≥ 768px | **92** |
| `lg:` | ≥ 1024px | **26** |
| `xl:` | ≥ 1280px | **1** |
| `2xl:` | ≥ 1536px | 0 |

- Há também o breakpoint **JS** `768px` em `hooks/use-mobile.ts` (`matchMedia('(max-width: 767px)')`), alinhado com `md:`.
- Estratégia dominante: **mobile-first**, com a sidebar virando off-canvas abaixo de `md` (`-translate-x-full md:translate-x-0`) e grids colapsando para 1 coluna.
- O app usa **container queries** em 3 pontos: `@container/card-header` (`card.tsx`), `@container/field-group` (`field.tsx`) e `@md/field-group:`.

---

## 12. Acessibilidade

| Padrão | Evidência |
|---|---|
| Primitivos Radix | 34 dos 52 arquivos usam Radix → foco/teclado/`aria-*` herdados |
| `aria-label` | 32 ocorrências; botões de ícone sempre rotulados |
| `aria-invalid` | 32 (estilização de erro em inputs/selects/checkbox/switch) |
| `aria-hidden` | 7 (ícones decorativos) |
| `aria-disabled` | 7 (`toggle`, `sidebar`, `navigation-menu`) |
| Hit area | `after:absolute after:-inset-2` em botões de menu do `sidebar.tsx` |
| `role="status"` | `Spinner` |
| `aria-live` | apenas **1** ocorrência |
| `sr-only` | títulos de diálogo/`Close` em `dialog`, `sheet`, `carousel` |

**Pontos fracos a corrigir:**
- `ThemeToggle` sem `role="menu"`, `aria-expanded` ou focus trap.
- Modais hand-rolled (`dashboard-header`, e vários `window.confirm`/`alert`) sem focus trap.
- Abas do `/dna-vault` são `<button>` sem `role="tab"`.
- Splash do `ProtectedRoute` sem `aria-live`.
- 🔴 `prefers-reduced-motion` não tratado.

---

## 13. Como trabalhar no design system

**Checklist para uma tela/componente novo:**

1. **Use tokens**: `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, `ring-ring`.
2. **Título** → `font-title` + `font-bold` + (se for display) `uppercase tracking-wide`.
3. **Corpo** → Inter (default), `text-sm`/`text-xs`.
4. **Raio** → `rounded-lg`/`rounded-xl`/`rounded-2xl` conforme a hierarquia; `rounded-full` para pílulas/botões de destaque.
5. **Foco** → garanta `focus-visible:ring-ring/50 focus-visible:ring-[3px]` (normalmente herdado do primitivo).
6. **Dark mode** → teste com a classe `.dark` no `<html>`; se usou hex, **não vai mudar**.
7. **Ícones** → `lucide-react`, `size-4` por padrão (o `Button` ajusta automaticamente).
8. **Botões** → prefira o primitivo `<Button variant=... size=...>`; para botões de ícone, use `size="icon"` + `aria-label`.
9. **Composição de classes condicional** → sempre `cn(...)`.
10. **Formulários** → o padrão vigente é `react-hook-form` + `zodResolver`, mas atenção: no perfil o resolver **não é executado** (ver doc 02 §7.2).

**Adicionar um primitivo shadcn novo:**

```bash
pnpm dlx shadcn@latest add <componente> --cwd .
# ou copie o arquivo para components/ui/ seguindo as convenções:
# "use client" (se Radix/hooks) · data-slot · export { ... } no fim
```

`components.json` já está configurado (`new-york`, RSC, CSS variables, aliases). O Tailwind v4 não precisa de `tailwind.config`.

---

## 14. Dívidas e lacunas

| # | Item | Impacto |
|---|---|---|
| 1 | Tokens `--sidebar-*` existem mas a sidebar real usa hex fixos | Não responde a dark mode |
| 2 | `--danger`/`--danger-foreground`/`--danger-text` **sem utilitário** e sem uso | Tokens mortos |
| 3 | `--font-mono` aponta para Geist Mono **não carregada** | `font-mono` cai no fallback |
| 4 | `--radius-2xl`/`--radius-3xl` não sobrescritos, mas muito usados | Escala de raio inconsistente com o token base |
| 5 | Variant `outline` da sidebar com `hsl(var(--sidebar-border))` sobre hex | Sombra inválida (bug) |
| 6 | `scrollbar-none` inexistente em `app-sidebar.tsx` | Classe inerte |
| 7 | Duas sidebars e dois toasters | Duplicação/confusão |
| 8 | 4 laranjas diferentes | Inconsistência de marca |
| 9 | 45 dos 52 primitivos não usados nas telas | Peso morto / expectativa errada |
| 10 | Sem `prefers-reduced-motion`, sem focus trap nos modais artesanais, sem `role="tab"` nas abas do vault | Acessibilidade |
| 11 | `images.unoptimized: true` global | Performance de imagens |
| 12 | Muitos `window.confirm`/`alert` nativos em vez de `Dialog`/`Toast` | UX inconsistente |
