# Relatório 2 — Design System (The Actor's Copilot)

> Projeto: `/workspace/projects/Caio/actors-copilot`
> Base: **Tailwind CSS v4.2.0** (config-in-CSS, sem `tailwind.config.*`) · **shadcn/ui** estilo `new-york` sobre **Radix UI** · ícones **lucide-react**
> Toda afirmação é rastreável a `caminho:linha`.

---

## 1. Sumário executivo

| Aspecto | Decisão |
|---|---|
| Motor de CSS | Tailwind v4 via `@tailwindcss/postcss` — **não existe** `tailwind.config.ts/js`; tema é 100% CSS (`app/globals.css`) |
| Configuração shadcn | `components.json` → `style: "new-york"`, `rsc: true`, `tsx: true`, `baseColor: "neutral"`, `cssVariables: true`, `prefix: ""`, `iconLibrary: "lucide"`, `tailwind.config: ""` (vazio) |
| Tokens | 46 CSS custom properties em `:root` + 35 em `.dark`; mapeadas para utilitários em `@theme inline` |
| Marca | Laranja `#EE6312` (light) / `#F06A1C` (dark) como `--primary`; fundo creme `#f6ecda` |
| Fontes | **Antonio** (`--font-title` → `font-title`) e **Inter** (`--font-sans`), ambas via `next/font/google` com `subsets: ['latin']` |
| Raio base | `--radius: 0.75rem` (12px); escala `sm/md/lg/xl` derivada por `calc()` |
| Dark mode | `next-themes` com `attribute="class"`, `defaultTheme="light"`, `enableSystem`; variante Tailwind custom `@variant dark (&:where(.dark, .dark *))` |
| Utilitário custom | apenas `.custom-scrollbar` |
| Tipografia longa | `@plugin "@tailwindcss/typography"` + `prose prose-neutral dark:prose-invert` usado em 3 arquivos de resultado de audição |
| Cobertura real dos primitivos | Dos **52** arquivos em `components/ui/`, apenas **17** são importados fora de `components/ui/`; `Card`, `Badge`, `Tabs`, `Select`, `Sheet`, `Table`, `Form`, `Chart`, `Sonner` etc. **não são usados** — a UI real é majoritariamente markup Tailwind artesanal |

---

## 2. Configuração de build e caminhos

### 2.1 `postcss.config.mjs` (8 linhas)
```js
plugins: { '@tailwindcss/postcss': {} }
```
Único plugin. **Sem** `autoprefixer` no pipeline (a dependência existe em `package.json:46` mas não é registrada no PostCSS — o Tailwind v4 faz o prefixamento via Lightning CSS).

### 2.2 `next.config.mjs` (8 linhas)
```js
const nextConfig = { images: { unoptimized: true } }
```
Nada de `rewrites`/`redirects`/`headers`/`experimental`.

### 2.3 `tsconfig.json`
| Item | Valor |
|---|---|
| `target` | `ES6` |
| `module` / `moduleResolution` | `esnext` / `bundler` |
| `jsx` | `react-jsx` |
| `strict` | `true` |
| `plugins` | `[{ name: 'next' }]` |
| **Alias** | `"@/*": ["./*"]` (raiz do projeto, `tsconfig.json:25-29`) |
| `include` | `next-env.d.ts`, `**/*.ts`, `**/*.tsx`, `.next/types/**/*.ts`, `.next/dev/types/**/*.ts` |

### 2.4 `components.json` (21 linhas)
| Chave | Valor |
|---|---|
| `$schema` | `https://ui.shadcn.com/schema.json` |
| `style` | `new-york` |
| `rsc` | `true` |
| `tsx` | `true` |
| `tailwind.config` | `""` (vazio — v4 CSS-first) |
| `tailwind.css` | `app/globals.css` |
| `tailwind.baseColor` | `neutral` |
| `tailwind.cssVariables` | `true` |
| `tailwind.prefix` | `""` |
| `iconLibrary` | `lucide` |
| `aliases.components` | `@/components` |
| `aliases.utils` | `@/lib/utils` |
| `aliases.ui` | `@/components/ui` |
| `aliases.lib` | `@/lib` |
| `aliases.hooks` | `@/hooks` |

### 2.5 `lib/utils.ts` (13 linhas)
```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
```
`cn()` é o único helper de classes; usado por **todos** os primitivos e por vários componentes de app.

---

## 3. Fontes

`app/layout.tsx:2,10-11` — única ocorrência de `next/font` no repositório:
```tsx
import { Antonio, Inter } from 'next/font/google'
const antonio = Antonio({ subsets: ['latin'], variable: '--font-antonio' })
const inter   = Inter({ subsets: ['latin'], variable: '--font-inter' })
```
Aplicação das variáveis (`app/layout.tsx:32`): `<body className={`${inter.variable} ${antonio.variable}`}>`.

| Fonte | Variável CSS | Token Tailwind | Utilitário | Uso |
|---|---|---|---|---|
| **Antonio** (sans condensada, display) | `--font-antonio` | `--font-title` | `font-title` | 117 ocorrências em 20 diretórios — todos os títulos (`h1`/`h2`/`h3`), preços, labels de seção, logo textual |
| **Inter** (sans variável) | `--font-inter` | `--font-sans` | `font-sans` (default) | Corpo de texto; aplicado implicitamente |
| *Geist Mono* | — | `--font-mono: 'Geist Mono', 'Geist Mono Fallback'` (`globals.css:90`) | `font-mono` | **Fonte não carregada** em nenhum lugar — cai no monospace do sistema. Único uso real: `components/ui/chart.tsx:233` (`font-mono tabular-nums` em tooltip) |

Notas:
- Nenhum `weight` é declarado (fontes variáveis); `display` fica no default (`swap`) do `next/font`.
- **`font-sans` explícito é raro** (8 ocorrências), usado para *reverter* para Inter dentro de blocos que herdam display/serif: `app/(interior)/auditions/[id]/page.tsx:360,365`, `components/auditions/step/step-result.tsx:118`, `step-result-brief.tsx:102`, `step-review.tsx:20`, `components/ui/kbd.tsx:8`, `components/chat-messages.tsx:61`, `components/ai-thinking-block.tsx:39`.
- `font-serif` aparece pontualmente em texto de sides (`app/(interior)/reader-copilot/page.tsx:205,235`, `app/(interior)/dna-vault/page.tsx:562`) — família default do Tailwind (não carregada).
- O body **não** recebe `font-sans` explicitamente: o preflight do Tailwind v4 usa `--default-font-family` → `--font-sans` → Inter.

---

## 4. Tokens de design — `app/globals.css`

### 4.1 Cabeçalho e diretivas (`globals.css:1-6`)
```css
@import 'tailwindcss';         /* linha 1 */
@import 'tw-animate-css';      /* linha 2 — classes animate-in/out, fade/zoom/slide */
@plugin "@tailwindcss/typography";              /* linha 4 */
@variant dark (&:where(.dark, .dark *));        /* linha 6 */
```

### 4.2 Tokens de cor — TEMA CLARO (`:root`, `globals.css:8-46`)

| Token | Valor (light) | Linha | Utilitários gerados |
|---|---|---|---|
| `--background` | `#f6ecda` | 9 | `bg-background`, `text-background` |
| `--foreground` | `#2A3328` | 10 | `bg-foreground`, `text-foreground` |
| `--card` | `#FFFFFF` | 11 | `bg-card` |
| `--card-foreground` | `#2A3328` | 12 | `text-card-foreground` |
| `--popover` | `#ffffff` | 13 | `bg-popover` |
| `--popover-foreground` | `#2C3328` | 14 | `text-popover-foreground` |
| `--primary` | `#EE6312` | 15 | `bg-primary`, `text-primary`, `border-primary`, `ring-primary` |
| `--primary-foreground` | `#FFFFFF` | 16 | `text-primary-foreground` |
| `--secondary` | `#4A5548` | 17 | `bg-secondary`, `text-secondary` |
| `--secondary-foreground` | `#F5F0E8` | 18 | `text-secondary-foreground` |
| `--muted` | `#E8DFD0` | 19 | `bg-muted` |
| `--muted-foreground` | `#5C6659` | 20 | `text-muted-foreground` |
| `--accent` | `#D4DDD6` | 21 | `bg-accent`, `text-accent` |
| `--accent-foreground` | `#2C3328` | 22 | `text-accent-foreground` |
| `--destructive` | `#C45A3C` | 23 | `bg-destructive`, `text-destructive` |
| `--destructive-foreground` | `#ffffff` | 24 | `text-destructive-foreground` |
| `--border` | `#DDD6CA` | 25 | `border-border` |
| `--input` | `#E8DFD0` | 26 | `border-input`, `bg-input` |
| `--ring` | `#E8721A` | 27 | `ring-ring` |
| `--chart-1` | `#E8721A` | 28 | `bg-chart-1` … (via `@theme`) |
| `--chart-2` | `#3D4A3C` | 29 | `bg-chart-2` |
| `--chart-3` | `#8B5E3C` | 30 | `bg-chart-3` |
| `--chart-4` | `#D4DDD6` | 31 | `bg-chart-4` |
| `--chart-5` | `#E8DFD0` | 32 | `bg-chart-5` |
| `--radius` | `0.75rem` | 33 | base da escala (não gera utilitário direto) |
| `--sidebar-bg` | `#3D4A3C` | 35 | `bg-sidebar` (via `--color-sidebar`, **não** `bg-sidebar-bg`) |
| `--sidebar-foreground` | `#F5F0E8` | 36 | `text-sidebar-foreground` |
| `--sidebar-primary` | `#E8721A` | 37 | `bg-sidebar-primary` |
| `--sidebar-primary-foreground` | `#2C3328` | 38 | `text-sidebar-primary-foreground` |
| `--sidebar-accent` | `rgba(255,255,255,0.08)` | 39 | `bg-sidebar-accent` |
| `--sidebar-accent-foreground` | `#F5F0E8` | 40 | `text-sidebar-accent-foreground` |
| `--sidebar-border` | `rgba(255,255,255,0.1)` | 41 | `border-sidebar-border` |
| `--sidebar-ring` | `#E8721A` | 42 | `ring-sidebar-ring` |
| `--danger` | `#8B5E3C` | 44 | ⚠️ **sem utilitário** (não mapeado em `@theme`) |
| `--danger-foreground` | `#F5F0E8` | 45 | ⚠️ **sem utilitário** |
| `--danger-text` | `#C45A3C` | 46 | ⚠️ **sem utilitário** |

### 4.3 Tokens de cor — TEMA ESCURO (`.dark`, `globals.css:49-85`)

| Token | Valor (dark) | Linha |
|---|---|---|
| `--background` | `#111513` | 50 |
| `--foreground` | `#F0F4EF` | 51 |
| `--card` | `#1c221e` | 52 |
| `--card-foreground` | `#F0F4EF` | 53 |
| `--popover` | `#111827` | 54 |
| `--popover-foreground` | `#F8FAFC` | 55 |
| `--primary` | `#F06A1C` | 56 |
| `--primary-foreground` | `#FFFFFF` | 57 |
| `--secondary` | `#94A3B8` | 58 |
| `--secondary-foreground` | `#E2E8F0` | 59 |
| `--muted` | `#242B27` | 60 |
| `--muted-foreground` | `#9AA597` | 61 |
| `--accent` | `#111827` | 62 |
| `--accent-foreground` | `#E2E8F0` | 63 |
| `--destructive` | `#FB923C` | 64 |
| `--destructive-foreground` | `#ffffff` | 65 |
| `--border` | `#2B332E` | 66 |
| `--input` | `#1F2937` | 67 |
| `--ring` | `#FB923C` | 68 |
| `--chart-1` | `#FB923C` | 69 |
| `--chart-2` | `#334155` | 70 |
| `--chart-3` | `#7C2D12` | 71 |
| `--chart-4` | `#334155` | 72 |
| `--chart-5` | `#475569` | 73 |
| `--sidebar-bg` | `#1C221F` | 74 |
| `--sidebar-foreground` | `#B5C0B3` | 75 |
| `--sidebar-accent` | `rgba(255,255,255,0.08)` | 76 |
| `--sidebar-border` | `rgba(255,255,255,0.08)` | 77 |
| `--sidebar-primary` | `#FB923C` | 78 |
| `--sidebar-primary-foreground` | `#111827` | 79 |
| `--sidebar-accent-foreground` | `#E2E8F0` | 80 |
| `--sidebar-ring` | `#FB923C` | 81 |
| `--danger` | `#F97316` | 82 |
| `--danger-foreground` | `#F8FAFC` | 83 |
| `--danger-text` | `#FB923C` | 84 |

> `--radius` **não** é redefinido em `.dark` → o raio é invariante ao tema.

### 4.4 `@theme inline` (`globals.css:87-127`) — mapeamento token → utilitário

| Token de tema | Valor | Linha |
|---|---|---|
| `--font-sans` | `var(--font-inter), 'Inter', sans-serif` | 88 |
| `--font-title` | `var(--font-antonio), sans-serif` | 89 |
| `--font-mono` | `'Geist Mono', 'Geist Mono Fallback'` | 90 |
| `--color-background` | `var(--background)` | 91 |
| `--color-foreground` | `var(--foreground)` | 92 |
| `--color-card` | `var(--card)` | 93 |
| `--color-card-foreground` | `var(--card-foreground)` | 94 |
| `--color-popover` | `var(--popover)` | 95 |
| `--color-popover-foreground` | `var(--popover-foreground)` | 96 |
| `--color-primary` | `var(--primary)` | 97 |
| `--color-primary-foreground` | `var(--primary-foreground)` | 98 |
| `--color-secondary` | `var(--secondary)` | 99 |
| `--color-secondary-foreground` | `var(--secondary-foreground)` | 100 |
| `--color-muted` | `var(--muted)` | 101 |
| `--color-muted-foreground` | `var(--muted-foreground)` | 102 |
| `--color-accent` | `var(--accent)` | 103 |
| `--color-accent-foreground` | `var(--accent-foreground)` | 104 |
| `--color-destructive` | `var(--destructive)` | 105 |
| `--color-destructive-foreground` | `var(--destructive-foreground)` | 106 |
| `--color-border` | `var(--border)` | 107 |
| `--color-input` | `var(--input)` | 108 |
| `--color-ring` | `var(--ring)` | 109 |
| `--color-chart-1`…`--color-chart-5` | `var(--chart-1)`…`var(--chart-5)` | 110-114 |
| `--radius-sm` | `calc(var(--radius) - 4px)` | 115 |
| `--radius-md` | `calc(var(--radius) - 2px)` | 116 |
| `--radius-lg` | `var(--radius)` | 117 |
| `--radius-xl` | `calc(var(--radius) + 4px)` | 118 |
| `--color-sidebar` | `var(--sidebar-bg)` | 119 |
| `--color-sidebar-foreground` | `var(--sidebar-foreground)` | 120 |
| `--color-sidebar-primary` | `var(--sidebar-primary)` | 121 |
| `--color-sidebar-primary-foreground` | `var(--sidebar-primary-foreground)` | 122 |
| `--color-sidebar-accent` | `var(--sidebar-accent)` | 123 |
| `--color-sidebar-accent-foreground` | `var(--sidebar-accent-foreground)` | 124 |
| `--color-sidebar-border` | `var(--sidebar-border)` | 125 |
| `--color-sidebar-ring` | `var(--sidebar-ring)` | 126 |

**Lacunas e armadilhas do mapeamento:**
- `--danger`, `--danger-foreground`, `--danger-text` **não** têm `--color-*` → não existem `bg-danger`/`text-danger`; só funcionam via `bg-[var(--danger)]`. Na prática, `--danger*` **não é referenciado em nenhum componente** (o "Danger Zone" de `/settings` usa `bg-primary`, `app/(interior)/settings/page.tsx:60-68,609`).
- `--sidebar-bg` só é acessível como `bg-sidebar`; não existe `bg-sidebar-bg`.
- `--radius-2xl` e `--radius-3xl` **não** são sobrescritos → permanecem nos defaults do Tailwind v4 (`1rem` e `1.5rem`), enquanto `rounded-2xl` (83 usos) e `rounded-3xl` (36 usos) são muito usados.
- `--font-mono` aponta para Geist Mono, que **não é carregada**.
- Não há `--breakpoint-*`, `--spacing-*`, `--shadow-*`, `--ease-*`, `--animate-*` customizados em `@theme` — tudo isso usa os defaults do Tailwind v4 (as animações `animate-in/out`, `animate-caret-blink` e `animate-accordion-*` vêm do `tw-animate-css`).

### 4.5 Escala de raio efetiva

| Utilitário | Fórmula | Valor computado |
|---|---|---|
| `rounded-sm` | `calc(var(--radius) - 4px)` | **8px** |
| `rounded-md` | `calc(var(--radius) - 2px)` | **10px** |
| `rounded-lg` | `var(--radius)` | **12px** |
| `rounded-xl` | `calc(var(--radius) + 4px)` | **16px** |
| `rounded-2xl` | default Tailwind v4 | **16px** |
| `rounded-3xl` | default Tailwind v4 | **24px** |
| `rounded-xs` | default Tailwind v4 | **2px** |
| `rounded-[calc(var(--radius)-5px)]` | ad-hoc em `input-group`/`kbd` | **7px** |

Frequência real de uso: `rounded-full` 252 · `rounded-2xl` 83 · `rounded-xl` 74 · `rounded-md` 58 · `rounded-lg` 48 · `rounded-3xl` 36 · `rounded-sm` 18.

### 4.6 `@layer base` (`globals.css:129-136`)
```css
* { @apply border-border outline-ring/50; }   /* borda padrão + outline translúcido em todos os elementos */
body { @apply bg-background text-foreground; }
```

### 4.7 Utilitários custom (`@layer utilities`, `globals.css:138-158`)
Único utilitário: `.custom-scrollbar`

| Regra | Valor | Linha |
|---|---|---|
| `::-webkit-scrollbar` | `width: 6px` | 140-142 |
| `::-webkit-scrollbar-track` | `background: transparent` | 145-147 |
| `::-webkit-scrollbar-thumb` | `background-color: #4b6354; border-radius: 10px` | 150-153 |
| `::-webkit-scrollbar-thumb:hover` | `background-color: #f97316` | 156-158 |

Uso: `app/chat/page.tsx:134` (`custom-scrollbar` no container de mensagens). Fora isso há classes utilitárias pontuais do Tailwind v4 sem equivalente (ex.: `scrollbar-none` em `components/app-sidebar.tsx:112` — que **não existe** no Tailwind nem em plugin, logo é uma classe inerte).

---

## 5. Dark mode e tema

### 5.1 Estratégia
| Camada | Implementação |
|---|---|
| Variante Tailwind | `@variant dark (&:where(.dark, .dark *))` (`globals.css:6`) — estratégia por **classe**, aplicada ao `<html>` |
| Provider | `components/theme-provider.tsx:9-11` — wrapper fino do `next-themes` |
| Montagem | `app/layout.tsx:33` — `<ThemeProvider attribute="class" defaultTheme="light" enableSystem>` |
| Anti-flash | `app/layout.tsx:31` — `<html lang="en" suppressHydrationWarning>` |
| Toggle | `components/theme-toggle.tsx` (Client, `"use client"` L1) |

### 5.2 `components/theme-toggle.tsx` (106 linhas)
- Usa `useTheme()` do `next-themes` (`:4`) e guarda `mounted` para evitar mismatch de hidratação (`:13-18`, retorna `<div className="h-9 w-9" />`).
- Botão principal: `h-9 rounded-full border border-border bg-popover/70 px-3 text-xs font-medium` com `aria-label="Select theme"` (`:29-33`).
- Dropdown **hand-rolled** (não usa `DropdownMenu`): overlay `fixed inset-0 z-40` para clique-fora (`:42-45`) e painel `absolute right-0 z-50 mt-2 w-36 rounded-xl border border-border bg-popover p-1 shadow-lg ring-1 ring-black/10` (`:47`).
- Três opções: `light` / `dark` / `system`, cada uma com ícone lucide (`Sun`, `Moon`, `Monitor`) e `Check` quando ativa; cores de ícone fixas `text-amber-500` / `text-indigo-400` / `text-slate-400` e check `text-[#E8721A]` (`:53-100`).
- **Não** usa `role="menu"`, `aria-expanded` nem focus trap — é um dropdown acessível apenas parcialmente.

### 5.3 Uso de `dark:`
72 ocorrências de `dark:` em `app/` e `components/`. Os pontos mais densos estão nos primitivos shadcn (`button`, `input`, `select`, `textarea`, `checkbox`, `tabs`, `switch`) e em `dialog`/`alert-dialog`, que fixam `dark:bg-neutral-950 dark:text-neutral-100 dark:border-neutral-800` **fora** da paleta de tokens (`components/ui/dialog.tsx:63`, `components/ui/alert-dialog.tsx:57`).

---

## 6. Primitivos shadcn/ui — inventário completo (`components/ui/`)

**52 arquivos**, todos `"use client"` quando usam Radix/hooks. Convenções transversais: `data-slot="<kebab-name>"` em todos os elementos; `function Component(...)` + bloco `export { ... }` no fim; `React.ComponentProps<typeof Primitive>`.

| Arquivo | Primitivo / biblioteca | Exporta |
|---|---|---|
| `accordion.tsx` | `@radix-ui/react-accordion` | `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` |
| `alert-dialog.tsx` | `@radix-ui/react-alert-dialog` (+ `buttonVariants`) | `AlertDialog`, `AlertDialogPortal`, `AlertDialogOverlay`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel` |
| `alert.tsx` | HTML + CVA | `Alert`, `AlertTitle`, `AlertDescription` |
| `aspect-ratio.tsx` | `@radix-ui/react-aspect-ratio` | `AspectRatio` |
| `avatar.tsx` | `@radix-ui/react-avatar` | `Avatar`, `AvatarImage`, `AvatarFallback` |
| `badge.tsx` | `@radix-ui/react-slot` + CVA | `Badge`, `badgeVariants` |
| `breadcrumb.tsx` | `@radix-ui/react-slot` | `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator`, `BreadcrumbEllipsis` |
| `button-group.tsx` | `@radix-ui/react-slot` + CVA | `ButtonGroup`, `ButtonGroupSeparator`, `ButtonGroupText`, `buttonGroupVariants` |
| `button.tsx` | `@radix-ui/react-slot` + CVA | `Button`, `buttonVariants` |
| `calendar.tsx` | `react-day-picker` v9 | `Calendar`, `CalendarDayButton` |
| `card.tsx` | HTML puro | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter` |
| `carousel.tsx` | `embla-carousel-react` | `type CarouselApi`, `Carousel`, `CarouselContent`, `CarouselItem`, `CarouselPrevious`, `CarouselNext` |
| `chart.tsx` | `recharts` | `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, `ChartStyle` |
| `checkbox.tsx` | `@radix-ui/react-checkbox` | `Checkbox` |
| `collapsible.tsx` | `@radix-ui/react-collapsible` | `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` |
| `command.tsx` | `cmdk` | `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandShortcut`, `CommandSeparator` |
| `context-menu.tsx` | `@radix-ui/react-context-menu` | 15 exports (`ContextMenu`…`ContextMenuRadioGroup`) |
| `dialog.tsx` | `@radix-ui/react-dialog` | `Dialog`, `DialogClose`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogOverlay`, `DialogPortal`, `DialogTitle`, `DialogTrigger` |
| `drawer.tsx` | `vaul` | `Drawer`, `DrawerPortal`, `DrawerOverlay`, `DrawerTrigger`, `DrawerClose`, `DrawerContent`, `DrawerHeader`, `DrawerFooter`, `DrawerTitle`, `DrawerDescription` |
| `dropdown-menu.tsx` | `@radix-ui/react-dropdown-menu` | 15 exports (`DropdownMenu`…`DropdownMenuSubContent`) |
| `empty.tsx` | HTML + CVA | `Empty`, `EmptyHeader`, `EmptyTitle`, `EmptyDescription`, `EmptyContent`, `EmptyMedia` |
| `field.tsx` | HTML + CVA | `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldGroup`, `FieldLegend`, `FieldSeparator`, `FieldSet`, `FieldContent`, `FieldTitle` |
| `form.tsx` | `@radix-ui/react-label` + `react-hook-form` | `useFormField`, `Form`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`, `FormField` |
| `hover-card.tsx` | `@radix-ui/react-hover-card` | `HoverCard`, `HoverCardTrigger`, `HoverCardContent` |
| `input-group.tsx` | HTML + CVA | `InputGroup`, `InputGroupAddon`, `InputGroupButton`, `InputGroupText`, `InputGroupInput`, `InputGroupTextarea` |
| `input-otp.tsx` | `input-otp` | `InputOTP`, `InputOTPGroup`, `InputOTPSlot`, `InputOTPSeparator` |
| `input.tsx` | HTML | `Input` |
| `item.tsx` | `@radix-ui/react-slot` + CVA | `Item`, `ItemMedia`, `ItemContent`, `ItemActions`, `ItemGroup`, `ItemSeparator`, `ItemTitle`, `ItemDescription`, `ItemHeader`, `ItemFooter` |
| `kbd.tsx` | HTML | `Kbd`, `KbdGroup` |
| `label.tsx` | `@radix-ui/react-label` | `Label` |
| `menubar.tsx` | `@radix-ui/react-menubar` | 16 exports |
| `navigation-menu.tsx` | `@radix-ui/react-navigation-menu` + CVA | `NavigationMenu`, `NavigationMenuList`, `NavigationMenuItem`, `NavigationMenuContent`, `NavigationMenuTrigger`, `NavigationMenuLink`, `NavigationMenuIndicator`, `NavigationMenuViewport`, `navigationMenuTriggerStyle` |
| `pagination.tsx` | `buttonVariants` | `Pagination`, `PaginationContent`, `PaginationLink`, `PaginationItem`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis` |
| `popover.tsx` | `@radix-ui/react-popover` | `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor` |
| `progress.tsx` | `@radix-ui/react-progress` | `Progress` |
| `radio-group.tsx` | `@radix-ui/react-radio-group` | `RadioGroup`, `RadioGroupItem` |
| `resizable.tsx` | `react-resizable-panels` | `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` |
| `scroll-area.tsx` | `@radix-ui/react-scroll-area` | `ScrollArea`, `ScrollBar` |
| `select.tsx` | `@radix-ui/react-select` | `Select`, `SelectContent`, `SelectGroup`, `SelectItem`, `SelectLabel`, `SelectScrollDownButton`, `SelectScrollUpButton`, `SelectSeparator`, `SelectTrigger`, `SelectValue` |
| `separator.tsx` | `@radix-ui/react-separator` | `Separator` |
| `sheet.tsx` | `@radix-ui/react-dialog` | `Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription` |
| `sidebar.tsx` | `@radix-ui/react-slot` + `useIsMobile` + Sheet/Tooltip/Skeleton/Input/Separator/Button | 24 exports: `Sidebar`…`useSidebar` (ver §7.1) |
| `skeleton.tsx` | HTML | `Skeleton` |
| `slider.tsx` | `@radix-ui/react-slider` | `Slider` |
| `sonner.tsx` | `sonner` | `Toaster` (versão Sonner) |
| `spinner.tsx` | `lucide-react` (`Loader2Icon`) | `Spinner` |
| `switch.tsx` | `@radix-ui/react-switch` | `Switch` |
| `table.tsx` | HTML | `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption` |
| `tabs.tsx` | `@radix-ui/react-tabs` | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` |
| `textarea.tsx` | HTML | `Textarea` |
| `toast.tsx` | `@radix-ui/react-toast` + CVA | `type ToastProps`, `type ToastActionElement`, `ToastProvider`, `ToastViewport`, `Toast`, `ToastTitle`, `ToastDescription`, `ToastClose`, `ToastAction` |
| `toaster.tsx` | `@radix-ui/react-toast` via `useToast` | `Toaster` (**é o montado no root layout**) |
| `toggle.tsx` | `@radix-ui/react-toggle` + CVA | `Toggle`, `toggleVariants` |
| `toggle-group.tsx` | `@radix-ui/react-toggle-group` | `ToggleGroup`, `ToggleGroupItem` |
| `tooltip.tsx` | `@radix-ui/react-tooltip` | `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` |

---

## 7. Primitivos core — exports, variantes e classes de token

### 7.1 `button.tsx` (61 linhas)
`buttonVariants = cva(..., {...})` em `:7`. `function Button` em `:39` (suporta `asChild` via `Slot`).

**Base (`:8`)**: `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive`

| `variant` | Classes (tokens em **negrito**) |
|---|---|
| `default` | `bg-primary text-primary-foreground hover:bg-primary/90` |
| `destructive` | `bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60` |
| `outline` | `border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50` |
| `secondary` | `bg-secondary text-secondary-foreground hover:bg-secondary/80` |
| `ghost` | `hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50` |
| `link` | `text-primary underline-offset-4 hover:underline` |

| `size` | Classes |
|---|---|
| `default` | `h-9 px-4 py-2 has-[>svg]:px-3` |
| `sm` | `h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5` |
| `lg` | `h-10 rounded-md px-6 has-[>svg]:px-4` |
| `icon` | `size-9` |
| `icon-sm` | `size-8` |
| `icon-lg` | `size-10` |

`defaultVariants: { variant: 'default', size: 'default' }` (`:52-55`).

### 7.2 `card.tsx` (93 linhas) — **não usado no app**
Sem CVA. Classes:
| Componente | Classe |
|---|---|
| `Card` (`:5`) | `bg-card text-card-foreground flex flex-col gap-6 rounded-xl border border-border/30 py-6 shadow-sm transition-colors` |
| `CardHeader` (`:18`) | `@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6` |
| `CardTitle` (`:31`) | `leading-none font-semibold` |
| `CardDescription` (`:41`) | `text-muted-foreground text-sm` |
| `CardAction` (`:51`) | `col-start-2 row-span-2 row-start-1 self-start justify-self-end` |
| `CardContent` (`:64`) | `px-6` |
| `CardFooter` (`:74`) | `flex items-center px-6 [.border-t]:pt-6` |

### 7.3 `input.tsx` (`:5`) / `textarea.tsx` (`:5`) / `label.tsx` (`:8`)
Sem variantes.
- **Input**: `file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:opacity-50 md:text-sm` + `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]` + `aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive`.
- **Textarea**: `field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs md:text-sm` + mesmos estados de foco/inválido.
- **Label** (Radix): `flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50`.

### 7.4 `form.tsx` (168) e `field.tsx` (245)
- **`form.tsx`**: integração `react-hook-form` (`FormProvider`, `Controller`) com `FormFieldContext`/`FormItemContext`. `FormItem` `:76` → `grid gap-2`; `FormLabel` `:90` → `data-[error=true]:text-destructive`; `FormDescription` `:125` → `text-muted-foreground text-sm`; `FormMessage` `:138` → `text-destructive text-sm`. `useFormField()` em `:45`.
- **`field.tsx`**: `fieldVariants = cva('group/field flex w-full gap-3 data-[invalid=true]:text-destructive', ...)` em `:57`.
  | `orientation` | Classes |
  |---|---|
  | `vertical` (default) | `flex-col [&>*]:w-full [&>.sr-only]:w-auto` |
  | `horizontal` | `flex-row items-center [&>[data-slot=field-label]]:flex-auto has-[>[data-slot=field-content]]:items-start …` |
  | `responsive` | `flex-col … @md/field-group:flex-row @md/field-group:items-center …` (container queries) |
  Componentes notáveis: `FieldGroup` usa `@container/field-group`; `FieldError` `:186` → `text-destructive text-sm font-normal`; `FieldLabel` usa `has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:border-primary`.

### 7.5 Overlays: `dialog.tsx` / `alert-dialog.tsx` / `sheet.tsx` / `drawer.tsx`
| Arquivo | Overlay | Content | Tokens |
|---|---|---|---|
| `dialog.tsx` (`:49`) | `fixed inset-0 z-50 bg-black/50` + `data-[state=open]:animate-in …` | `bg-background text-foreground … rounded-lg border p-6 shadow-lg sm:max-w-lg` + `dark:bg-neutral-950 dark:text-neutral-100 dark:border-neutral-800` (`:63`) | `bg-background`, `text-foreground`, `border` |
| `alert-dialog.tsx` (`:33`) | idem dialog | idem dialog (`:57`) | idem |
| `sheet.tsx` (`:47`) | idem | `bg-background … fixed z-50 flex flex-col gap-4 shadow-lg` + `side` (`right`/`left`/`top`/`bottom`) controlando slide + largura `w-3/4 sm:max-w-sm` | `bg-background` |
| `drawer.tsx` (`:48`) | idem | `group/drawer-content bg-background fixed z-50 flex h-auto flex-col` + variantes `data-[vaul-drawer-direction=*]` (tamanhos `3/4`, `max-h-[80vh]`, `rounded-b-lg`/`rounded-t-lg`) | `bg-background` |

Todos exportam Header/Footer/Title/Description com `gap-2` (dialog) ou `gap-1.5 p-4` (sheet/drawer) e títulos `text-lg font-semibold` / `text-foreground font-semibold`.

### 7.6 `tabs.tsx` (67) — **não usado no app**
| Componente | Classe |
|---|---|
| `TabsList` (`:21`) | `bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]` |
| `TabsTrigger` (`:37`) | `data-[state=active]:bg-background dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 … rounded-md border border-transparent px-2 py-1 text-sm font-medium data-[state=active]:shadow-sm` |
| `TabsContent` (`:53`) | `flex-1 outline-none` |

> Observação: `/dna-vault` implementa abas com **botões + `useState`** (`app/(interior)/dna-vault/page.tsx:253-299`), não com `Tabs`.

### 7.7 `badge.tsx` (46) — **não usado no app**
| `variant` | Classes |
|---|---|
| `default` | `border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90` |
| `secondary` | `border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90` |
| `destructive` | `border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 dark:bg-destructive/60` |
| `outline` | `text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground` |

Base `:8`: `inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 overflow-hidden focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive`.

### 7.8 `avatar.tsx` (53) — usado em `dashboard-header.tsx` e `chat-messages.tsx`
- `Avatar` `:8` → `relative flex size-8 shrink-0 overflow-hidden rounded-full`; `AvatarImage` `:24` → `aspect-square size-full`; `AvatarFallback` `:37` → `bg-muted flex size-full items-center justify-center rounded-full`.
- No header é sobrescrito para `h-9 w-9` com fallback `bg-secondary text-secondary-foreground text-xs` (`components/dashboard-header.tsx:87-91`).

### 7.9 `select.tsx` (185) — **não usado no app**
- `SelectTrigger` `:27` aceita `size?: 'sm' | 'default'` (`:33`, default `'default'` `:29`); altura via `data-[size=default]:h-9` / `data-[size=sm]:h-8`.
- Base do trigger: `border-input … rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30 dark:hover:bg-input/50`.
- `SelectContent` `:53` aceita `position: 'popper' | 'item-aligned'`; painel `bg-popover text-popover-foreground … rounded-md border shadow-md` com animações `data-[state=*]:zoom/in/fade` e `data-[side=*]:slide-in-from-*`.
- `SelectItem` `:101` → `focus:bg-accent focus:text-accent-foreground … rounded-sm py-1.5 pr-8 pl-2 text-sm`.

### 7.10 `dropdown-menu.tsx` (257) — usado em `acting-coach`
- 15 exports (ver §6). `DropdownMenuContent` `:34` → `bg-popover text-popover-foreground z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-md` + animações.
- `DropdownMenuItem` `:62` → `focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm data-[inset]:pl-8`; suporta `variant="destructive"` via `data-[variant=destructive]:*`.
- `DropdownMenuSeparator` `:166` → `bg-border -mx-1 my-1 h-px`; `DropdownMenuShortcut` `:179` → `text-muted-foreground ml-auto text-xs tracking-widest`.

### 7.11 `table.tsx` (116) — **não usado no app**
| Componente | Classe |
|---|---|
| `Table` (`:7`) | wrapper `relative w-full overflow-x-auto` + `<table className="w-full caption-bottom text-sm">` |
| `TableHeader` (`:22`) | `[&_tr]:border-b` |
| `TableBody` (`:32`) | `[&_tr:last-child]:border-0` |
| `TableFooter` (`:42`) | `bg-muted/50 border-t font-medium [&>tr]:last:border-b-0` |
| `TableRow` (`:55`) | `hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors` |
| `TableHead` (`:68`) | `text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap` |
| `TableCell` (`:81`) | `p-2 align-middle whitespace-nowrap` |
| `TableCaption` (`:94`) | `text-muted-foreground mt-4 text-sm` |

### 7.12 `tooltip.tsx` (61), `progress.tsx` (31), `separator.tsx` (28), `switch.tsx` (31), `checkbox.tsx` (32), `skeleton.tsx` (13), `spinner.tsx` (16), `kbd.tsx` (28)
| Componente | Classe principal |
|---|---|
| `TooltipContent` (`:37`) | `bg-foreground text-background z-50 w-fit rounded-md px-3 py-1.5 text-xs text-balance` + animações (`animate-in fade-in-0 zoom-in-95`, `data-[side]:slide-in-from-*`); arrow `bg-foreground fill-foreground size-2.5 rotate-45 rounded-[2px]` |
| `Progress` (`:8`) | trilha `bg-primary/20 relative h-2 w-full overflow-hidden rounded-full`; indicador `bg-primary h-full w-full flex-1 transition-all` |
| `Separator` (`:8`) | `bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px` |
| `Switch` (`:8`) | `peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs` |
| `Checkbox` (`:9`) | `peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary size-4 shrink-0 rounded-[4px] border shadow-xs focus-visible:ring-[3px]`; indicador `size-3.5` |
| `Skeleton` (`:3`) | `bg-accent animate-pulse rounded-md` |
| `Spinner` (`:5`) | `<Loader2Icon role="status" aria-label="Loading" className="size-4 animate-spin" />` |
| `Kbd` (`:3`) | `bg-muted w-fit text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded-sm px-1 font-sans text-xs font-medium select-none` + `[[data-slot=tooltip-content]_&]:bg-background/20` ; `KbdGroup` (`:18`) → `inline-flex items-center gap-1` |

### 7.13 `sonner.tsx` (25) vs `toast.tsx` (129) + `toaster.tsx` (35)
- **Montado no app**: `Toaster` de `components/ui/toaster.tsx` (`app/layout.tsx:7,37`) — implementação **Radix Toast** consumindo `useToast()` de `hooks/use-toast.ts` (exports: `useToast`, `toast`, `genId`, `reducer`).
- `toastVariants = cva(...)` em `toast.tsx:27`:
  | `variant` | Classes |
  |---|---|
  | `default` | `border bg-background text-foreground` |
  | `destructive` | `destructive group border-destructive bg-destructive text-destructive-foreground` |
  Base: `group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all` + `data-[state=open]:animate-in data-[state=closed]:animate-out … data-[swipe=*]:…`.
  `ToastViewport` (`:105`) → `fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]`.
- `components/ui/sonner.tsx` é uma alternativa **não usada**: `<Sonner theme={theme} className="toaster group" style={{'--normal-bg':'var(--popover)','--normal-text':'var(--popover-foreground)','--normal-border':'var(--border)'}} />` (`:13-19`).

### 7.14 `alert.tsx` (66)
`alertVariants` `:6`:
| `variant` | Classes |
|---|---|
| `default` (default) | `bg-card text-card-foreground` |
| `destructive` | `text-destructive bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90` |
Base `:7`: `relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4`.
`AlertTitle` `:37` → `col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight`; `AlertDescription` `:50` → `text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed`.

### 7.15 `command.tsx` (184) — usado por `quick-prompts-dropdown.tsx`
`Command` `:16` → `bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md` + overrides `[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3` etc. `CommandInput` `:63` → `flex h-10 w-full rounded-md bg-transparent py-3 text-sm placeholder:text-muted-foreground`. `CommandItem` `:142` → `data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground … rounded-sm px-2 py-1.5 text-sm`. `CommandDialog` `:32` envolve em `DialogContent className="overflow-hidden p-0"`. `CommandShortcut` `:158` → `text-muted-foreground ml-auto text-xs tracking-widest`.

### 7.16 `chart.tsx` (353) — **não usado no app**
`recharts` + `ChartConfig`. `ChartContainer` `:37` injeta CSS vars via `ChartStyle` `:72` e aplica `[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border … flex aspect-video justify-center text-xs`. `ChartTooltipContent` `:107` → painel `border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl`; valores `text-foreground font-mono font-medium tabular-nums`. Indicadores: `dot` (`h-2.5 w-2.5`), `line` (`w-1`), `dashed` (`w-0 border-[1.5px] border-dashed bg-transparent`). `ChartLegendContent` `:253` → `flex items-center justify-center gap-4`.

### 7.17 `input-group.tsx` (169)
`inputGroupAddonVariants` `:38` — variantes de `align`: `inline-start` (default) / `inline-end` / `block-start` / `block-end`.
`inputGroupButtonVariants` `:81` — `size`: `xs` (default) / `sm` / `icon-xs` / `icon-sm`. Raio ad-hoc `rounded-[calc(var(--radius)-5px)]`.
Container `:44`: `group/input-group border-input dark:bg-input/30 relative flex w-full items-center rounded-md border shadow-xs h-9 has-[>textarea]:h-auto` + estados de foco/inválido via `has-[[data-slot=input-group-control]:focus-visible]`.

### 7.18 `item.tsx` (193), `empty.tsx` (104), `field.tsx`, `button-group.tsx` (83), `toggle.tsx` (47), `toggle-group.tsx` (73), `navigation-menu.tsx` (166), `calendar.tsx` (213), `carousel.tsx` (241), `resizable.tsx` (56), `scroll-area.tsx` (58), `slider.tsx` (63), `radio-group.tsx` (45), `pagination.tsx` (127), `breadcrumb.tsx` (109)
| Componente | Variantes |
|---|---|
| `Item` | `itemVariants` `:33` — `variant`: `default` / `outline` / `muted`; `size`: `default` (`p-4 gap-4`) / `sm` (`py-3 px-4 gap-2.5`) |
| `ItemMedia` | `itemMediaVariants` `:74` — `variant`: `default` / `icon` (`size-8 border rounded-sm bg-muted`) / `image` (`size-10 rounded-sm overflow-hidden`) |
| `EmptyMedia` | `emptyMediaVariants` `:31` — `variant`: `default` / `icon` (`bg-muted size-10 rounded-lg`) |
| `ButtonGroup` | `buttonGroupVariants` `:7` — `orientation`: `horizontal` (default) / `vertical` |
| `Toggle` | `toggleVariants` `:9` — `variant`: `default` / `outline`; `size`: `default` (`h-9 px-2 min-w-9`) / `sm` (`h-8 px-1.5 min-w-8`) / `lg` (`h-10 px-2.5 min-w-10`) |
| `NavigationMenu` | `navigationMenuTriggerStyle` `:61` — sem variantes (CVA com classe única); `h-9 … rounded-md bg-background px-4 py-2 text-sm font-medium hover:bg-accent focus-visible:ring-[3px]` |
| `PaginationLink` | usa `buttonVariants({ variant: isActive ? 'outline' : 'ghost', size })` |
| `ScrollArea`/`Slider`/`RadioGroup`/`Resizable`/`Carousel`/`Calendar` | sem CVA; classes token-based (`bg-border`, `bg-accent`, `border-input`, `bg-primary`, `text-muted-foreground`) |

---

## 8. `components/ui/sidebar.tsx` (726 linhas) — o primitivo mais elaborado

**Não é importado por nenhum arquivo da aplicação** (o app usa `components/app-sidebar.tsx`, artesanal). Ainda assim, define o padrão "sidebar shadcn" no repositório.

- Constantes (`:28-33`): `SIDEBAR_COOKIE_NAME='sidebar_state'`, `SIDEBAR_COOKIE_MAX_AGE=604800` (7d), `SIDEBAR_WIDTH='16rem'`, `SIDEBAR_WIDTH_MOBILE='18rem'`, `SIDEBAR_WIDTH_ICON='3rem'`, `SIDEBAR_KEYBOARD_SHORTCUT='b'`.
- `SidebarProvider` `:56` — grava cookie `sidebar_state` (`:86`), atalho `Ctrl/Cmd+B` (`:97-110`), estado `expanded | collapsed` (`:114`), consome `useIsMobile()` (`hooks/use-mobile.ts`, breakpoint **768px**).
- `useSidebar()` `:47` — lança erro fora do provider (diferente do `useSidebar` do app em `lib/context/SidebarContext.tsx:24-30`, que tolera ausência de provider).
- `sidebarMenuButtonVariants` `:476` — `variant`: `default` / `outline`; `size`: `default` (`h-8 text-sm`) / `sm` (`h-7 text-xs`) / `lg` (`h-12 text-sm`).
- Tokens exclusivos: `bg-sidebar`, `text-sidebar-foreground`, `bg-sidebar-accent`, `text-sidebar-accent-foreground`, `border-sidebar-border`, `ring-sidebar-ring`, `bg-sidebar-primary`, `text-sidebar-primary-foreground`.
- Props: `Sidebar` aceita `side: 'left'|'right'`, `variant: 'sidebar'|'floating'|'inset'`, `collapsible: 'offcanvas'|'icon'|'none'` (`:154`).
- 24 exports (ver §6), todos com `data-slot="sidebar-*"`.

> ⚠️ Bug latente: o variant `outline` usa `hsl(var(--sidebar-border))`, mas os tokens são hex/`rgba`, não canais HSL — `shadow-[0_0_0_1px_hsl(var(--sidebar-border))]` (`:479`) resolve para um valor inválido.

---

## 9. Componentes de app que estabelecem padrão visual

### 9.1 `components/app-sidebar.tsx` (226 linhas) — sidebar real do produto
- Client Component (`:1`). Usa `useSidebar()` **do app** (`lib/context/SidebarContext`), não o do shadcn.
- **Cores hard-coded, fora dos tokens**: `bg-[#2A3B31]`, `text-[#E8E6E3]`, `border-[#B36B22]`, `bg-[#3B3A2C]/60` (`:83, :171`). Não reage a dark mode.
- Largura fixa `w-64`, `fixed inset-y-0 left-0 z-40` no mobile e `md:relative md:translate-x-0` no desktop — **não** usa o `SidebarProvider` do shadcn nem o cookie.
- Estrutura: logo (`/logo.png` 140×140) → "Quick Actions" (`/auditions/new/brief`, `/auditions/new/sides`) → "MENU" (`mainMenuItems`, `:30-38`) → botão Upgrade/Manage Plan → link externo Skool → `bottomMenuItems` (Settings) → Logout.
- `mainMenuItems` (`:30-38`): Dashboard `/dashboard` (Home) · Reader Copilot `/reader-copilot` (Clapperboard) · Personal DNA `/chat` (Sparkles) · Acting Coach `/acting-coach` (BookOpen) · Auditions `/auditions` (Mic) · Profile `/profile` (User) · DNA Vault `/dna-vault` (Dna).
- Estado ativo: `pathname === item.href` (igualdade exata — **não** marca subrotas, `:143`).
- Padrão de item: `flex items-center gap-3.5 rounded-md px-2 py-2 text-sm font-medium` com ativo `text-white font-semibold` / inativo `text-white/70 hover:text-white`.
- Acessibilidade: overlay mobile é `<button aria-label="Close menu">` (`:71-78`); botão de fechar mobile com `aria-label` (`:89-96`).

### 9.2 `components/dashboard-header.tsx` (123 linhas) — cabeçalho padrão de todas as páginas internas
- Client Component (`:1`). Props: `title?`, `titleSlot?`, `extraActions?`, `className?` (`:12-19`).
- Marcado por `flex bg-card items-center justify-between gap-3 px-4 sm:px-8 mb-4 py-4 border-b border-border/50 transition-colors` (`:49`).
- Título: `<h1 className="truncate font-title text-xl font-bold text-foreground sm:text-2xl">` (`:61`).
- Ações à direita (`:67-97`): `extraActions` → `ThemeToggle` → botão suporte (Mail) → link `/settings` (Settings) → link `/profile` com `Avatar` + primeiro nome. Todos os botões de ícone usam o padrão `flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground` e têm `aria-label`.
- Menu mobile via `useSidebar().setIsOpen(true)` com `aria-label="Open menu"` (`:51-58`).
- Modal "Need Help?" hand-rolled (`:100-121`): `fixed inset-0 z-50 bg-black/50 backdrop-blur-sm` + `rounded-2xl bg-popover p-6 shadow-xl border border-border`, e-mail `support@theactorscopilot.com`.

### 9.3 `components/dashboard-footer.tsx` (26 linhas) — Server Component
Padrão: `shrink-0 flex flex-wrap items-center justify-center gap-6 px-8 py-6 text-xs text-muted-foreground border-t border-border/30 mt-auto`. Três selos com ícones lucide `text-primary/70` e separador `text-border`: **NDA Safe** (Lock) · **Delete Anytime** (Trash2) · **Private By Default** (Shield).

### 9.4 `components/public-profile/*` (11 arquivos) — perfil público `/actors/[slug]`
Server Components, **paleta própria hard-coded** (não usa tokens do design system):
| Componente | Padrão |
|---|---|
| `public-navbar.tsx` | `sticky top-0 z-50 border-b border-[#3A4F5A]/30 bg-[#3A4F5A] px-6 py-3`; logo + "Actor Profile" em `font-title text-sm font-bold text-[#F5F0E8]`; ícones `text-[#F5F0E8]/70` |
| `public-footer.tsx` | fileira de privacidade (`text-xs text-[#656565]`) + barra `bg-[#3A4F5A]` com branding |
| `hero-section.tsx` | grid `flex flex-col gap-6 lg:flex-row`; foto `h-52 w-44 rounded-2xl bg-[#555A4A]`; nome `font-title text-2xl font-bold text-[#212121]`; botões `rounded-full bg-[#FF751F] text-white` e `border-[#C7C7C7] bg-white`; card de representação `rounded-xl border-[#C7C0B5] bg-[#F0E9DE] p-5 lg:w-64` |
| `details-section.tsx` · `photos-section.tsx` · `showreels-section.tsx` · `about-section.tsx` · `credits-section.tsx` · `training-section.tsx` · `skills-section.tsx` | seções com títulos `font-title` e paleta `#212121` / `#656565` / `#7E7E7E` / `#F0E9DE` |
| `platform-icon.tsx` | ícone por plataforma externa (IMDb, Spotlight etc.) |
Fundo do layout: `bg-[#F0E8DC]` (`app/actors/layout.tsx:10`).

> O laranja do perfil público é `#FF751F` (`hero-section.tsx:88`, `app/actors/[slug]/page.tsx:85`), **diferente** do `--primary #EE6312` do app interno — divergência de marca a documentar.

### 9.5 Layout raiz e landing
- `app/page.tsx` (Server) usa paleta própria de "palco": fundo `bg-[#152323]`, títulos `font-title` em `#EFEADD`/`#F2671A`, gradientes radiais inline, e `StartEmblem` (link para `/dashboard` com `aria-label="Start - Enter Dashboard"`, `hover:scale-105`).
- `app/layout.tsx` compõe: `ThemeProvider` → `AuthProvider` → `PostHogProvider` → `{children}` + `<Toaster />` + `<Analytics />`.

---

## 10. Convenções de tipografia

| Convenção | Regra observada |
|---|---|
| Títulos | `font-title` (Antonio) + `font-bold`/`font-extrabold`, frequentemente com `uppercase` e `tracking-wide`/`tracking-wider`. 117 usos. |
| Corpo | Inter (default). `text-xs` / `text-sm` predominam; `text-base` em inputs (com `md:text-sm`). |
| Escala de títulos vista | `text-xl` → `text-2xl` (headers de página), `text-3xl`/`text-4xl` (títulos de seção/hub), `text-5xl`→`text-9xl` (landing/login). |
| Micro-labels | `text-[10px] font-bold tracking-widest uppercase text-muted-foreground` (ex.: `dashboard/page.tsx:119,154,191`). |
| `prose` (@tailwindcss/typography) | **Sim, usado** — 8 ocorrências em 3 arquivos: `components/auditions/step/step-result.tsx:78,175,524`, `step-result-brief.tsx:85,238`, `performance-map-print-block.tsx:82,98,113`, sempre no formato `prose prose-neutral dark:prose-invert max-w-none` com overrides `prose-p:m-0`, `prose-strong:font-semibold`, `prose-p:text-black` (bloco de impressão). |
| `font-mono` | Apenas `chart.tsx` (tooltip, `tabular-nums`) — e a fonte não é carregada. |
| `tabular-nums` | `chart.tsx:233`, `sidebar.tsx:584` (badge de menu). |
| Sem `font-display`/`text-balance` sistemático | `text-balance`/`text-pretty` aparecem apenas dentro dos primitivos (`empty`, `item`, `tooltip`). |

---

## 11. Espaçamento, raio, sombras e movimento

### 11.1 Espaçamento
- Escala default do Tailwind v4 (`--spacing: 0.25rem`), sem customização.
- Padrões recorrentes: containers `px-4 sm:px-8` + `py-6`/`p-4 sm:p-8`; cards `p-6`/`p-8 sm:p-12`; `gap-6`/`gap-8` em grids; `space-y-8` entre seções.
- Grids: `grid-cols-1 md:grid-cols-3` (dashboard), `md:grid-cols-2` (planos), `md:grid-cols-2 lg:grid-cols-3` (reader-copilot), `grid-cols-1 lg:grid-cols-[1fr_280px]` (resultados de audição).
- Container queries: `@container/card-header` (`card.tsx:19`), `@container/field-group` (`field.tsx:44`), `@md/field-group:` — únicos usos.

### 11.2 Sombras
| Classe | Usos | Contexto |
|---|---|---|
| `shadow-sm` | 114 | padrão de cards/superfícies |
| `shadow-md` | 27 | popovers/menus, hover de card |
| `shadow-lg` | 24 | modais, dropdowns, botões primários de destaque |
| `shadow-xs` | 19 | inputs, selects, toggles (novo `xs` do v4) |
| `shadow-2xs` | 12 | botões-pílula do chat |
| `shadow-2xl` | 10 | modais/overlays |
| `shadow-xl` | 9 | painéis, sidebar |
| `shadow-none` | 8 | overrides em `input-group` |

### 11.3 Movimento
- Transições: `transition-colors` (197 usos) é o padrão; `transition-all` (134) em botões/cards; `transition-transform` (18) em hovers de ícone; `transition-opacity` (7).
- Durações: `duration-200` (32), `duration-300` (18), `duration-500` (6), `duration-150` (5).
- Animações: `animate-in` (44) / `animate-out` (22) vindas de `tw-animate-css`; `animate-spin` (21) para loaders; `animate-pulse` (21) para skeletons; `animate-bounce` (14) no splash do `ProtectedRoute`; `animate-ping` (3).
- Micro-interações: `hover:scale-105` (logo/landing), `active:scale-[0.98]` (botão de plano, `upgrade/page.tsx:98`), `group-hover:translate-x-1` (setas de card).
- `prefers-reduced-motion` **não é tratado** em nenhum lugar.

### 11.4 Foco e bordas
- Padrão de foco dos primitivos: `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]` (71 ocorrências de `focus-visible:`).
- Estado inválido: `aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive`.
- Bordas: `border-border` em geral; `border-border/30` (card, footer) e `border-border/50` (header, divisor) para suavizar.
- Reset global de outline: `* { @apply border-border outline-ring/50 }` (`globals.css:131`).

---

## 12. Breakpoints e responsividade

Breakpoints **default do Tailwind v4** (nenhum `--breakpoint-*` customizado):

| Prefixo | Largura | Usos em `app/`+`components/` |
|---|---|---|
| `sm:` | ≥ 40rem (640px) | **250** |
| `md:` | ≥ 48rem (768px) | **92** |
| `lg:` | ≥ 64rem (1024px) | **26** |
| `xl:` | ≥ 80rem (1280px) | **1** |
| `2xl:` | ≥ 96rem (1536px) | 0 |

Áreas ainda usam o breakpoint JS `768px` via `hooks/use-mobile.ts:3` (`matchMedia('(max-width: 767px)')`) — alinhado com `md:`.
Estratégia dominante: **mobile-first**, com a sidebar virando off-canvas abaixo de `md` (`components/app-sidebar.tsx:84-85`: `-translate-x-full md:translate-x-0`) e grids que colapsam para 1 coluna.

---

## 13. Acessibilidade

| Padrão | Evidência |
|---|---|
| Primitivos Radix | 34 dos 52 arquivos de `components/ui/` usam Radix → foco/teclado/`aria-*` herdados |
| `aria-label` | 32 ocorrências; botões de ícone sempre rotulados (`dashboard-header.tsx:54,74,81`; `app-sidebar.tsx:74,92,103`; `theme-toggle.tsx:32`) |
| `aria-invalid` | 32 (estilização de erro em inputs/selects/checkbox/switch) |
| `aria-hidden` | 7 (ícones decorativos em `breadcrumb`, `pagination`, `carousel`) |
| `aria-disabled` | 7 (`toggle`, `sidebar`, `navigation-menu`) |
| Público-alvo de toque | `after:absolute after:-inset-2` aumenta a hit area de botões de menu (`sidebar.tsx:578,583`) |
| `role="status"` | `Spinner` (`spinner.tsx:8`) |
| Regiões vivas | `aria-live` apenas 1 ocorrência |
| `sr-only` | Usado em títulos de diálogo/`Close` para leitores de tela (`dialog.tsx:65`, `sheet.tsx:66`, `carousel.tsx:216,218`) |
| Pontos fracos | `ThemeToggle` sem `role="menu"`/`aria-expanded`/focus trap (`theme-toggle.tsx:26-104`); modais hand-rolled (`dashboard-header.tsx:100`, `settings`/`upgrade` usam `window.confirm`/`alert`); abas do `/dna-vault` são botões sem `role="tab"`; `ProtectedRoute` com splash puramente visual |

---

## 14. Adoção real dos primitivos (grep de importações)

| Primitivo | Importadores fora de `components/ui/` |
|---|---|
| `alert-dialog` | `app/(interior)/auditions/page.tsx`, `app/(interior)/settings/page.tsx`, `components/auditions/audition-wizard.tsx` |
| `skeleton` | `app/(interior)/dna-vault/page.tsx`, `components/chat-messages.tsx` |
| `avatar` | `components/chat-messages.tsx`, `components/dashboard-header.tsx` |
| `dialog` | `components/break-check-in-modal.tsx` |
| `popover` | `components/quick-prompts-dropdown.tsx` |
| `command` | `components/quick-prompts-dropdown.tsx` |
| `dropdown-menu` | `app/(interior)/acting-coach/page.tsx` |
| `button` / `separator` / `label` / `input` / `textarea` / `sheet` / `tooltip` / `toggle` / `toast` / `toaster` | somente **entre primitivos** (`sidebar`, `pagination`, `calendar`, `carousel`, `input-group`, `field`, `form`, `item`, `button-group`, `command`, `alert-dialog`, `toaster`) |

**Nunca importados (nem por primitivos nem pelo app):** `accordion`, `alert`, `aspect-ratio`, `badge`, `breadcrumb`, `button-group`*, `calendar`*, `card`, `carousel`*, `chart`, `checkbox`, `collapsible`, `context-menu`, `drawer`, `empty`, `field`*, `form`*, `hover-card`, `input-group`*, `input-otp`, `item`*, `kbd`, `menubar`, `navigation-menu`, `pagination`*, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`*, `sidebar`, `slider`, `sonner`, `spinner`, `switch`, `table`, `tabs`, `toast`*, `toggle-group`, `toggle`*.
<sub>(*) importados apenas por/para outros primitivos, sem uso em telas do produto.</sub>

**Consequência prática:** o design system "de fábrica" (Card/Badge/Tabs/Select/Table) **não** governa a UI real. As telas são construídas com `div` + classes Tailwind diretas, o que explica a quantidade de cores hard-coded (`#2A3B31`, `#3D4A3C`, `#E8721A`, `#FF751F`, `#F0E8DC`, `#212121`, `#656565`…) que **burlam os tokens de tema e não respondem ao dark mode**.

---

## 15. Divergências e dívidas de design system

1. **Tokens de sidebar sem uso**: `--sidebar-*` existem e são mapeados, mas a sidebar real (`components/app-sidebar.tsx`) usa hex fixos e não reage a dark mode.
2. **`--danger*` sem utilitário e sem uso** (§4.4).
3. **`--font-mono` aponta para Geist Mono não carregada** (§3).
4. **Variante `outline` do sidebar** combina `hsl(var(--sidebar-border))` com valor hex/rgba → sombra inválida (`components/ui/sidebar.tsx:479,550`).
5. **`scrollbar-none`** em `app-sidebar.tsx:112` não existe no Tailwind → classe inerte.
6. **Duas implementações de sidebar**: `components/ui/sidebar.tsx` (shadcn, 726 linhas, não usado) × `components/app-sidebar.tsx` (custom, usado).
7. **Duas implementações de toast**: `components/ui/toaster.tsx` (Radix, montado) × `components/ui/sonner.tsx` (Sonner, não montado).
8. **Laranja duplicado**: `--primary #EE6312` (tokens) vs `#E8721A` (ring/chart/sidebar-primary e muitos hard-codes) vs `#F2671A` (landing) vs `#FF751F` (perfil público).
9. **`AspectRatio`/`Collapsible`/`HoverCard`/`InputOTP`/`Menubar`/`NavigationMenu`/`Resizable`/`Slider`/`Table`/`Chart`** são peso morto no bundle de tipos (não geram JS se não importados, mas sinalizam UI planejada e não entregue).
10. **Sem `prefers-reduced-motion`, sem `focus-trap` nos modais artesanais, sem `role="tab"` nas abas do vault.**

---

### Fontes externas consultadas
- [Next.js — File-system conventions: proxy.js](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) (contexto da convenção `proxy.ts` citada no Relatório 1)
