# Relatório de Pesquisa Técnica — Auditions, Acting Coach e Actor Profile

**Repositório:** `/workspace/projects/Caio/actors-copilot`
**Stack:** Next.js 16.1.6 (App Router), React 19.2.4, TypeScript, Firebase (Firestore/Auth/Storage) + `firebase/ai` (Vertex AI), Zod, react-hook-form, Stripe (`package.json:1-80`).
**Commit de referência:** `32f7f74` (`git log --oneline -1`).
**Método:** leitura direta do código; todo `path:line` abaixo é verificável. O código é a fonte da verdade — divergências com o `README.md` estão na seção **D**.

> **Nota de escopo:** `lib/document-processing.ts` **não** pertence ao domínio de Auditions; ele processa documentos anexados ao chat (`.docx`/`.rtf`/markdown → `PromptPart`) e é consumido por `app/api/coach/chat/route.ts:6,141`. Já `lib/pivot-logic.ts` **não** é usado por Auditions — é exclusivo do chat de DNA (`hooks/use-chat.ts:24-27,543-554`). Ver §A.6 e §B.7.

---

## 0. Sumário executivo (achados de maior impacto)

| # | Achado | Evidência |
|---|---|---|
| 1 | **`sidesText` nunca é persistido** pelo wizard de audição. `newAuditionDoc()` e `buildMergeUpdate()` não incluem o campo. Consequência em cascata: `/reader-copilot/[id]` sempre falha, `parse-script` não acha texto, a seção "EXACT SIDES TEXT" do prompt do Character Coach nunca aparece e o `RehearsalRunner` do Stage 9 fica vazio. | `components/auditions/audition-wizard.tsx:446-463,470-494`; `app/(interior)/reader-copilot/[id]/page.tsx:77-81`; `app/api/actor-copilot/parse-script/route.ts:35-45`; `lib/acting-coach/build-coach-prompt.ts:79-86` |
| 2 | **O "RAG"/corpus do Acting Coach é código morto.** O route passa `excerpts: []` e o modelo é hardcoded; ingestão, chunking, config e schema de resposta existem apenas para testes. | `app/api/coach/chat/route.ts:124,137`; `lib/acting-coach/infrastructure/*`, `domain/chunk-acting-text.ts` (sem uso em produção) |
| 3 | **`profile/master` tem dois schemas incompatíveis.** O sintetizador grava `{status, lastUpdated, dataPointsAnalyzed, profile:{...}}`; o chat de DNA, o coach e o updateDna gravam campos planos `psychology.*`/`acting_fuel.*` no mesmo doc. O UAP (`actor_summary`, `ai_coaching_manual`, `performance_traps`) **nunca é consumido estruturalmente** por código algum. | `app/api/dna/synthesize/route.ts:103-111`; `hooks/use-chat.ts:605-625`; `app/api/coach/updateDna/route.ts:207-215`; `lib/prompts.ts:646-670` |
| 4 | **Zod do profile é decorativo.** `zodResolver` é instalado, mas `handleSubmit` nunca é chamado — save/publish persistem `getValues()` cru. Só `bio≤500`, `min/max` 1–100 da playing age e atributos HTML `type` valem. | `app/(interior)/profile/page.tsx:46,65,213`; `lib/profile-types.ts:113-170` |
| 5 | **Slug de perfil não é único** e `getPublicProfile` faz `.limit(1)` — dois atores com o mesmo nome colidem e um "rouba" a URL do outro. | `lib/profile-types.ts:235-242`; `lib/get-public-profile.ts:12-17` |
| 6 | **Middleware de tier** barra `/profile` e `/acting-coach` para o tier `economy` (só `business`/superior passa); `/auditions` não é explicitamente barrado. | `proxy.ts:23,44-58,91,118-129`; `lib/billing.ts:6` |
| 7 | **Análise de cor (analyzeSides) tem 80s de timeout para PDF; a de brief tem 60s** e o brief rejeita `sidesFile`; o wizard envia `actorTimezone`, que é **descartado** pelo Zod (campo inexistente no schema). | `analyzeSides/route.ts:75` vs `analyzeBrief/route.ts:54`; `audition-wizard.tsx:331` vs `lib/schemas/audition.ts:27-49` |
| 8 | **Estados "Draft"/"Processing" nunca são escritos.** O wizard grava sempre `status: "completed"`; só o modal de edição permite mudar (em minúsculas). | `audition-wizard.tsx:462`; `app/(interior)/auditions/page.tsx:135-138,178` |
| 9 | **Código morto confirmado:** `step-generating.tsx` (0 bytes), `routeBrief.ts` (duplicata), `ActingCoachCitations`, `CoachSuggestionChips`, `COACH_REPLY_SCHEMA`, `resetTrackerForSection`. | §A.7, §B.9, §F |
| 10 | **Sem `firestore.indexes.json`** no repo, mas a deduplicação exige índice composto `project+role+analysisType`. Há fallback silencioso em caso de erro. | `audition-wizard.tsx:509-522`; ausência de arquivo |

---

# A) AUDITIONS

## A.1 Modelo de domínio

### A.1.1 `AuditionFormData` — estado do formulário (`lib/audition-types.ts:54-72`)

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `projectType` | `"cinematic" \| "commercial" \| "theater"` | sim (default `cinematic`) | união tipada aqui; o Zod aceita `"theater"` (`lib/schemas/audition.ts:28`) mas a UI usa o rótulo "Theater" (`step-basic.tsx:23-27`) |
| `breakdownDepth` | `"complete" \| "quick"` opcional | não | só é oferecido para `cinematic` + modo `sides` (`step-basic.tsx:101`) |
| `project` | `string` | sim (na prática) | Zod: `.max(150).trim()`; `.trim()` **após** `.max()` — string de 151 chars com espaços pode falhar antes do trim |
| `role` | `string` | sim (na prática) | `.max(100).trim()` |
| `deadline` | `string?` | não | `datetime-local` (ex.: `2026-04-15T17:00`); Zod `.max(50)` |
| `auditionTimezone` | `string?` | não | IANA tz do projeto; ~48 opções em `step-basic.tsx:250-313` |
| `castingDirectorName` | `string?` | não | `.max(150)`; **só é exibido no modo brief** (`step-basic.tsx:156`) |
| `sidesFile` | `File \| null` | condicional | PDF/`.docx`, ≤20MB |
| `sidesText` | `string` | condicional | alternativa ao arquivo |
| `briefFile` | `File \| null` | condicional | idem |
| `briefText` | `string` | condicional | idem |

`initialAuditionData` (`lib/audition-types.ts:74-86`) define os defaults. `AuditionStep = 1|2|3|4|5`, com o comentário "**5 is the generating state**" (`lib/audition-types.ts:7`) — **o passo 5 não existe na prática** (ver §A.2).

### A.1.2 Schema Zod de transporte (`lib/schemas/audition.ts:27-49`)

Campos que **só existem no request FormData**, não no `AuditionFormData`:

| Campo | Tipo/limite | Uso |
|---|---|---|
| `actorName` | `.max(200)`, default `"Actor"` | personaliza intro/outro do prompt |
| `userPath` | `.max(500)`, **obrigatório** | `{uid}_{firstName}`; validação de posse no backend |
| `priorSidesSummary` / `priorBriefSummary` | `string`, default `""` | truncados a 1500 chars no backend (`analyzeSides:144`, `analyzeBrief:126`) |
| `criticalBriefFactsPayload` | `.max(10000)`, default `""` | JSON serializado de `CriticalBriefFact[]` — canal não-lossy |
| `previousTake` | `.max(5000)` opcional | usado no "Alternative Take" |
| `isStandalone` | `"true" \| "false"` opcional | `mode === "sides" && !auditionId` (`audition-wizard.tsx:68,358`) |
| `actorTimezone` | **AUSENTE do schema** | enviado em `audition-wizard.tsx:331`, descartado pelo Zod (strip de chaves desconhecidas) → **parâmetro morto** |

### A.1.3 Regras de arquivo (`lib/schemas/audition.ts:3-23`)

- `MAX_FILE_SIZE = 20 * 1024 * 1024` (20MB) — linha 3.
- `ALLOWED_MIME_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]` — linhas 4-7.
- `auditionFileSchema` usa `z.any().superRefine(...)`: exige `instanceof File`, checa tamanho e aceita `.docx` **pela extensão** mesmo com MIME errado (`!ALLOWED_MIME_TYPES.includes(f.type) && !f.name.toLowerCase().endsWith(".docx")`) — linhas 9-23.
- **Cliente não valida tamanho** em `step-upload.tsx` (só tipo: linhas 62-64, 87-89); o limite de 20MB e a mensagem "max. 20MB" (`step-upload.tsx:142`) são apenas textuais. Um arquivo de 300MB é aceito na UI e rejeitado só no servidor.

### A.1.4 `AuditionDocument` — shape persistido (`lib/audition-types.ts:35-52`)

| Campo | Tipo | Significado |
|---|---|---|
| `project` / `role` | `string` | metadados; `trim()` aplicado na gravação |
| `deadline` / `auditionTimezone` | `string \| null` | como digitado/selecionado |
| `actorLocalDeadline` | `string \| null` | deadline convertido para o tz do ator via `calculateLocalDeadline` (`lib/time-utils.ts:5-24`), formato `"PP, p z"` |
| `castingDirectorName` | `string \| null` | |
| `breakdownDepth` | `"complete" \| "quick"` | |
| `performanceMap` | `PerformanceMap \| null` | **legado**: mapa único da versão anterior |
| `sidesPerformanceMap` | `PerformanceMap \| null` | mapa gerado por `analyzeSides` |
| `briefPerformanceMap` | `PerformanceMap \| null` | mapa gerado por `analyzeBrief` (inclui `criticalBriefFacts` embutido) |
| `criticalBriefFacts` | `CriticalBriefFact[] \| null` | espelho top-level, para consumo downstream |
| `hasSides` / `hasBrief` | `boolean` | distinguem schema novo de legado |
| `analysisType` | `"sides" \| "brief"` | define qual componente renderiza na página de detalhe |
| `createdAt` | `any` (Timestamp) | `serverTimestamp()` |
| `status` | `string` | ver §A.5 |

Sub-tipos: `PerformanceSection {title, items[]}`, `PerformanceMap {intro?, sections[], outro?}`, `CriticalBriefFact {label, value, importance: "critical"|"important"}` (`lib/audition-types.ts:9-24`), `BriefAnalysisResult extends PerformanceMap { criticalBriefFacts? }` (linhas 31-33).

> **Nota:** `sidesText` **não faz parte de `AuditionDocument`** — é exatamente o achado #1 do sumário.

## A.2 Wizard: passos, validação e navegação

`AuditionWizard({mode, auditionId})` (`components/auditions/audition-wizard.tsx:54`) serve os dois modos (`sides` / `brief`) e o modo *enrichment* (quando `auditionId` vem de `?enrichAuditionId=`).

| Passo | Título | Componente | O que valida |
|---|---|---|---|
| 1 | Basics | `StepBasics` (`step/step-basic.tsx`) | **nenhuma validação bloqueante**; só seletor de categoria + inputs. `deadline`/`auditionTimezone`/`castingDirectorName` só aparecem quando `mode==="brief"` |
| 2 | Upload (Sides ou Casting Brief) | `StepUpload` (`step/step-upload.tsx`) | cliente valida **apenas o tipo** (PDF/`.docx`); toast destrutivo em caso de tipo inválido |
| 3 | Review & Generate | `StepReview` (`step/step-review.tsx`) | resumo read-only; botão "Generate Breakdown" fica `disabled={!canGenerate}` |
| 4 | Generating → Result | inline em `audition-wizard.tsx:757-880` | spinner e depois `StepResultSides` ou `StepResultBrief` |

- O `Stepper` (`components/auditions/stepper.tsx:9-13`) mostra apenas **3** passos (Basics / Upload / Review & Generate) e é **ocultado** quando `currentStep >= 4` (`audition-wizard.tsx:681`).
- `handleNext` faz `Math.min(prev+1, 4)` (`audition-wizard.tsx:123-126`) — **o passo 5 nunca é alcançado**. `step-generating.tsx` está **vazio (0 bytes)**; a tela de loading foi reimplementada inline (`audition-wizard.tsx:759-774`).
- **Regra de pré-requisito única** (`findMissingPrerequisite`, linhas 154-184), usada tanto para desabilitar o botão quanto para o toast pré-flight:
  1. `project.trim()` não vazio (senão, volta ao passo 1);
  2. `role.trim()` não vazio (passo 1);
  3. modo `sides`: `sidesText.trim()` OU `sidesFile` (passo 2);
  4. modo `brief`: `briefText.trim()` OU `briefFile` (passo 2).
- Timeout/erro de geração devolve o usuário ao passo 2 (erro de dados) ou 3 (erro de rede) — linhas 391, 402.
- `handleDelete` (linhas 142-147) usa `window.confirm` e **apenas limpa o estado local** — **não apaga nada no Firestore**; o botão "Delete" na tela de resultado é, portanto, enganoso.

## A.3 Pipelines de análise: `analyzeSides` vs `analyzeBrief` (e `routeBrief.ts`)

### A.3.1 Comparativo

| Dimensão | `POST /api/auditions/analyzeSides` | `POST /api/auditions/analyzeBrief` |
|---|---|---|
| Arquivo | `app/api/auditions/analyzeSides/route.ts` (327 linhas) | `app/api/auditions/analyzeBrief/route.ts` (285 linhas) |
| System prompt | `getAuditionCoachPrompt(isStandalone, projectType, breakdownDepth)` | `BRIEF_ANALYSIS_PROMPT` + sub-prompt por categoria |
| Sub-prompts de categoria | `COMMERCIAL_MODE_PROMPT`, `THEATHER_MODE_PROMPT` (cinematic não tem) | `BRIEF_CINEMATIC_PROMPT`, `BRIEF_THEATER_PROMPT`, `BRIEF_COMMERCIAL_PROMPT` |
| Modelo | `gemini-3.1-pro-preview`, `VertexAIBackend('global')` | idem |
| `responseMimeType` | `application/json` + `responseSchema` | idem |
| Entrada principal | `sidesText` ou `sidesFile` (PDF/`.docx`) | `briefText` ou `briefFile` |
| Blocos de prompt | `<actor_dna>`, `<context>`, `<audition_sides>`, `<prior_brief_analysis>` (opcional), `<critical_brief_facts>` (opcional), `<alternative_take_instruction>` (opcional) | `<actor_dna>`, `<context>`, `<casting_brief>`, `<prior_sides_analysis>` (opcional) + REMINDER sobre `criticalBriefFacts` |
| Timeout de PDF | **80s** (linha 75) | **60s** (linha 54) |
| Rejeita arquivo do outro tipo | **não** (aceita `briefFile` e ignora) | **sim** — `if (formData.has("sidesFile")) → 400` (linhas 84-89) |
| `breakdownDepth` | lido e passado ao prompt (linha 138) | **ignorado** (não está em `textFields`) |
| Saída | `{ success, message, data: PerformanceMap }` | idem |
| Seções esperadas no mapa | 21 (completo) / 6 (quick) / 6 (comercial) | dinâmicas (a IA nomeia); comerciais exigem brevidade |
| Erros | 401 token; 403 path; 400 validação/sem texto; 502 JSON inválido; 500 outros | idem |

### A.3.2 Fluxo comum (passo a passo, com linhas de `analyzeSides`)

1. **Auth**: `Authorization: Bearer <idToken>` obrigatório → 401 (linhas 92-99).
2. **Extração do FormData** em `textFields` (104-123) — `sidesFile`/`briefFile` também entram, mas o Zod os valida por `superRefine`.
3. **Validação Zod** (125-131) → 400 com `details: issues`.
4. **Checagem de posse**: `!userPath.startsWith(`${authenticatedUserId}_`)` → 403 + log de "SECURITY ALERT" (148-155).
5. **Parsing do arquivo** (157-169): `pdf2json` (`getRawTextContent()` + `decodeURIComponent`, com fallback para o texto bruto) ou `mammoth.extractRawText` para `.docx`. Timeout via `Promise.race` (52-79).
6. **Sem texto** → 400 (171-176).
7. **Contexto de DNA**: lê `users/{userPath}/profile/master` e faz `JSON.stringify(profileData, null, 2)` como `actorDNAContext` (179-188). Se não existir, instrui coaching genérico.
8. **Instrução de categoria** por `projectType` (191-197).
9. **Modelo** com `systemInstruction` (o prompt de sistema vai no papel `user`) e `responseSchema` (207-244).
10. **Prompt de usuário** (262-299) + `previousTakePrompt` quando é regeneração (246-259).
11. **Inferência** e `JSON.parse` — JSON malformado → 502 (302-311).
12. Retorno (314-318).

O `responseSchema` de ambos os endpoints declara `intro`, `sections[{title, items[]}]`, `outro` (**required**) e `criticalBriefFacts[{label, value, importance}]` (opcional no schema do Gemini; `required` só dos três primeiros) — `analyzeSides:212-243`, `analyzeBrief:190-221`.

### A.3.3 Regras de negócio embutidas nos prompts

- **DNA é a lente (canônica)**: "<actor_dna> CRITICAL INSTRUCTION: You MUST use this profile as the psychological lens for your entire breakdown. Do not just tack it on at the end." (`analyzeSides:267-273`; `analyzeBrief:231-237`).
- **Contrato "LOCKED" de 21 seções**: `lib/prompts.ts:920-1077` — ordem exata, Objective com 4 hard rules e 4 seções banidas, Tactics com verbos ativos, "NO therapy", "BEHAVIOR OVER EMOTION", "DNA IS THE LENS", `criticalBriefFacts` verbatim, **MULTI-SCENE AWARENESS** (`prompts.ts:936`), The In-Between com fallback obrigatório `"N/A - Only one scene provided."` (1044).
- **Modo comercial**: abandona as 21 seções e exige exatamente 6 (`prompts.ts:803-811`), com regra de brevidade 1-2 frases (733-736).
- **Modo theater**: 5 pilares (physicality/animal work, fourth wall, vocal architecture, power dynamics/turnkey, stage command) — `prompts.ts:674-699`.
- **Modo quick cinematic**: 6 seções fixas, `prompts.ts:882-890`.
- **Alternative Take / "pivot"**: quando `previousTake` existe, injeta `<alternative_take_instruction>` mandando **inverter** a direção criativa (emoção↔frieza, táticas/monólogo interno/bold choice opostos), sem dizer isso no output (`analyzeSides:246-259`). O cliente trunca as seções a 2000 chars (`audition-wizard.tsx:350-355`) e salva o take anterior como um doc `"{project} V1"` (`audition-wizard.tsx:418-441`). **"Alternative Take" só existe no modo `sides`** (`audition-wizard.tsx:800`).
- **Critical Brief Facts**: canal estruturado e não-truncado. O brief os produz; o wizard os serializa em `criticalBriefFactsPayload` ao rodar sides (`audition-wizard.tsx:299-301`); o prompt os marca como "non-negotiable... honored verbatim" e exige eco no array de saída (`analyzeSides:292-294`). Parser tolerante descarta payload malformado sem falhar (`analyzeSides:25-43`).
- **Síntese Brief→Sides**: no modo `brief`, o prompt recebe `<prior_sides_analysis>` para casar psicologia macro (brief) com ação imediata (sides); a regra "o Brief nunca sobrepõe o texto dos sides" está em `prompts.ts:934`.
- **`isStandalone`** só altera o texto de `intro`/`outro` (encorajamento), não o conteúdo analítico (`prompts.ts:754-760, 763-769, 842-848`).

### A.3.4 `routeBrief.ts` — duplicata morta

`app/api/auditions/analyzeBrief/routeBrief.ts` é **byte-a-byte idêntico** a `route.ts`, exceto por espaços em branco (diff real: linhas 185-188, 224, 232-238). Nenhum import/rota aponta para ele (`grep "routeBrief"` → 0 resultados fora do próprio arquivo). Next.js só registra `route.ts`, portanto `routeBrief.ts` **nunca é executado**. É código morto puro (provável resíduo de refactor).

## A.4 Rehearsal / Reader Copilot (parse-script e TTS)

### A.4.1 `POST /api/actor-copilot/parse-script` (`app/api/actor-copilot/parse-script/route.ts`)

- Auth Bearer obrigatório (11-19).
- Body JSON: `{ sidesText?, auditionId?, userPath? }` (21-24).
- **Sanitização de path**: rejeita `userPath` contendo `/` ou `..`, e `auditionId` contendo `/` (26-28).
- Se `auditionId` + `userPath`: valida posse (`startsWith(uid_)`) → 403; se `sidesText` vazio, tenta ler de `users/{userPath}/auditions/{auditionId}.sidesText` (30-43) — **campo que o wizard nunca grava** (achado #1).
- Modelo `gemini-3.1-pro-preview` com system prompt de "script supervisor" (regras: ordem cronológica exata, nomes em MAIÚSCULAS, diálogo verbatim, emoção por linha, título da cena) — linhas 55-100.
- Schema de saída: `{sceneTitle, characters[], lines[{character, dialogue, emotionNote?}]}` (76-99).
- Pós-processamento: `sceneId = auditionId || "scene_{Date.now()}"`; personagens deduplicados em maiúsculas; cada linha recebe `id = "{sceneId}_line_{index}"`, `order = index` (112-130).
- Tipos em `lib/actor-copilot/script-parser.ts:6-47` (`ScriptLine`, `SceneData`, `RehearsalStatus`, `RehearsalSessionState`, `VoiceOption`).

### A.4.2 `POST /api/actor-copilot/tts` (`app/api/actor-copilot/tts/route.ts`)

- Auth Bearer, mas **não usa o uid** para nada além de validar (39-46).
- Body `{text, character?, emotionNote?, voiceName?}`; exige `text` não vazio (49-54).
- Voz default `"Puck"` (57); prompt de atuação: `Act as {speaker}. Tone: {emotionNote}. ... Speak EXACTLY: "{text}"` (59).
- Array de modelos candidatos com apenas 1 item: `["gemini-2.5-flash-tts"]` (67) — o `for` de fallback existe mas é inócuo hoje.
- `generationConfig`: `temperature: 0.2`, `responseModalities: ["AUDIO"]`, `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` (75-85, com `as any`).
- Áudio PCM/raw/L16 é embrulhado em WAV 24kHz/16-bit/mono por `wrapPcmInWav` (8-32, 107-110); demais MIME vão como data URL direto.
- Erros: 429 se `Quota exceeded`/`429`, senão 500 (133-142). Retorna `{audioUrl, voiceName, modelUsed}`.

### A.4.3 Rehearsal client

- `components/actor-copilot/actor-copilot-rehearsal.tsx` (1223 linhas): máquina de estados guiada por `RehearsalStatus`, detecção de fala via Web Speech + Web Audio (analyser), *hands-free*, cache de áudio pré-buscado (`audioCacheRef`/`audioElementCacheRef`, linhas 86-88), mapeamento voz↔personagem (`characterVoices`, 64-70).
- Endpoints usados: `/api/actor-copilot/tts` (linhas 247, 334, 412) e `/api/dna/transcribe/chat` (linha 654); **nenhuma persistência em Firestore/localStorage** no componente (grep vazio).
- `matchActorLine` (`lib/actor-copilot/script-parser.ts:74-139`) normaliza (lowercase, remove pontuação) e aplica limiares: interim exige ≥0.88 OU (≥0.75 + última palavra falada); final curto (≤3 palavras) ≥0.66 ou última palavra; final longo ≥0.75 OU (≥0.60 + fim da linha).
- `CHARACTER_VOICE_MAP` cobre 7 nomes fixos (SARAH, JOHN, MARK, ELIZABETH, DAVID, AMANDA, MICHAEL) + `default` (`script-parser.ts:144-153`); fallback round-robin (158-165).
- `AVAILABLE_GEMINI_VOICES` = 7 vozes (`script-parser.ts:49-57`).
- `components/acting-coach/rehearsal-runner.tsx` é um **runner distinto**, baseado em regex no texto (`parseSidesToLines`, 23-96), sem TTS: o ator avança cue lines com clique/Space/Enter (121-131). O Stage 9 do Flight Plan abre esse runner (`flight-plan.tsx:80-88`; `acting-coach/page.tsx:348-353`).

## A.5 Persistência no Firestore e ciclo de status

### A.5.1 Caminhos

| Caminho | Operação | Onde |
|---|---|---|
| `users/{uid}_{firstName}/auditions/{autoId}` | create (`addDoc`) | `audition-wizard.tsx:547,590` |
| `users/{uid}_{firstName}/auditions/{auditionId}` | read/update (`getDoc`/`updateDoc`) | `audition-wizard.tsx:97,252,537`; `[id]/page.tsx:104` |
| `users/{uid}_{firstName}/auditions/{id}` | delete | `app/(interior)/auditions/page.tsx:229` |
| `users/{userPath}/profile/master` | read (DNA) | `analyzeSides:179`; `analyzeBrief:158`; `coach/chat:61` |
| `users/{userPath}/dnaVault` | read (síntese de DNA) | `app/api/dna/synthesize/route.ts:44` |

O `userPath` é **sempre** `{uid}_{primeiroNomeSemCaracteresEspeciais}` (`audition-wizard.tsx:239-242`; `auditions/page.tsx:94-95`). O firstName sai de `displayName`; fallback `"Actor"`.

### A.5.2 Payload de criação (`newAuditionDoc`, `audition-wizard.tsx:446-463`)

```
project (trim), role (trim), deadline|null, auditionTimezone|null, actorLocalDeadline,
castingDirectorName|null (trim), breakdownDepth, performanceMap: resultData,
analysisType: mode, sidesPerformanceMap (se sides, senão null),
briefPerformanceMap (se brief, senão null), criticalBriefFacts: resultData?.criticalBriefFacts ?? null,
hasSides: mode==="sides", hasBrief: mode==="brief", createdAt: serverTimestamp(), status: "completed"
```

### A.5.3 Payload de merge/enrichment (`buildMergeUpdate`, linhas 470-494)

Preserva o doc existente (`...existing`), reescreve metadados e:
- modo `sides` → `{sidesPerformanceMap: resultData, hasSides: true}` e **preserva** `criticalBriefFacts` antigos (`existingFacts`);
- modo `brief` → `{briefPerformanceMap: resultData, hasBrief: true}` e **substitui** por `resultData.criticalBriefFacts ?? null`.

### A.5.4 Deduplicação e enrichment

- `findDuplicateId` (501-523) roda `where("project","==",p) + where("role","==",r) + where("analysisType","==",mode)`; erro (índice ausente) → `warn` e segue para `addDoc`. **Não há `firestore.indexes.json` no repo.**
- Se duplicata existe, abre `AlertDialog` (883-919) com 3 caminhos: Cancelar, "Create new anyway" (`performSave`/`performCoach`) ou "Enrich existing audition" → `/auditions/new/{otherMode}?enrichAuditionId={id}` (660-666).
- `performCoach` (569-612) salva e navega para `/acting-coach?auditionId=...&analysisType=...&project=...&role=...`.
- `savePreviousTake` (418-441) cria doc `"{project} V1"` **antes** de gerar o Alternative Take; falha ali não bloqueia a geração.

### A.5.5 Ciclo de status

| Valor gravado | Origem | Mapeamento exibido |
|---|---|---|
| `"completed"` | wizard, sempre (`:462`) | `Completed` (`auditions/page.tsx:137`) |
| `"draft"` / `"processing"` / `"completed"` (minúsculos) | modal de edição (`auditions/page.tsx:178`) | `Draft` / `Processing` / `Completed` |
| `"draft"` (implícito) | qualquer status não reconhecido | `Draft` (fallback `page.tsx:136`) |

**Não existe autosave/rascunho**: o wizard só persiste no fim. `"processing"` nunca é escrito por código. A página de lista ordena por `createdAt desc` (linha 121) e formata a data no cliente (`toDate().toLocaleDateString("en-US", ...)`, 130-131).

## A.6 Esclarecimento sobre "pivot logic"

`lib/pivot-logic.ts` define `ExtractionTracker`, `DEFAULT_THRESHOLDS` (`windowSize:5`, `requiredDiversity:4`, `questionThreshold:15`, `repetitionThreshold:3` — linhas 18-23), `shouldTriggerPivot` (62-96), `updateTracker` (125-160) e `resetTrackerForSection` (167-178). **Não há qualquer referência a Auditions**: os únicos consumidores são `hooks/use-chat.ts` (chat de extração de DNA) — linhas 24-27 e 543-554. Portanto:

- "pivot" no contexto de Auditions = **`previousTake`/Alternative Take** (`analyzeSides:246-259`), não o pivot engine.
- `resetTrackerForSection` é exportado mas **não usado em produção** (apenas definição; testes cobrem).
- O `README.md:534-539` descreve o Pivot Engine como "Every 10 questions", mas o código usa **15** (`pivot-logic.ts:21`) — divergência (ver §D).

## A.7 Inconsistências, código morto e TODOs (A)

| Severidade | Achado | Evidência |
|---|---|---|
| Alta | `sidesText` não persistido → quebra Reader Copilot, parse-script, "EXACT SIDES TEXT" do coach e Stage 9 runner | §0 #1 |
| Alta | `actorTimezone` enviado no FormData e descartado pelo Zod | `audition-wizard.tsx:331` vs `lib/schemas/audition.ts:27-49` |
| Média | `routeBrief.ts` é duplicata não-roteada (285 linhas mortas) | `app/api/auditions/analyzeBrief/routeBrief.ts` |
| Média | `step-generating.tsx` vazio; `AuditionStep = 5` nunca usado | `wc -c` = 0; `audition-wizard.tsx:7,123-126` |
| Média | Botão "Delete" na tela de resultado não apaga do Firestore | `audition-wizard.tsx:142-147` |
| Média | Cliente não valida 20MB (só o servidor) | `step-upload.tsx:55-102` |
| Média | Sem índice composto versionado para a query de dedupe | `audition-wizard.tsx:509-522` |
| Média | `deadline`/`auditionTimezone`/`castingDirectorName` inacessíveis no modo `sides` (UI esconde), mas o backend os aceita | `step-basic.tsx:156,210` |
| Baixa | `analysisType` do `AuditionDocument` é `"sides" \| "brief"`, mas o doc legado pode não ter; a lista faz `?? "sides"` | `auditions/page.tsx:147` |
| Baixa | `StepResultSides` assume índice fixo de seções (21 vs 20) via `sections[13]?.items[0]?.includes("N/A")` — frágil | `step/step-result.tsx:52-59` |
| Baixa | Ambas as rotas de análise stringificam o doc inteiro de DNA (inclui `status`/`dataPointsAnalyzed`), poluindo o contexto | `analyzeSides:187` |
| Baixa | `castingDirectorName` aparece no prompt mas some do prompt de sides quando o modo é sides na UI | `step-basic.tsx:156` |
| — | Nenhum `TODO/FIXME` nos arquivos do domínio A (grep vazio) | `grep -rn "TODO\|FIXME" ...` |

---

# B) ACTING COACH

## B.1 O que é

Um chat de coaching com **dois modos**, comutáveis na própria página (`app/(interior)/acting-coach/page.tsx:194-228`):

- **General Coach** ("24/7 General Coach") — persona `ACTING_COACH_SYSTEM_PROMPT` (`lib/prompts.ts:1282-1420`).
- **Character Coach** ("Role Focus") — persona `CHARACTER_COACH_SYSTEM_PROMPT`, "Tracey Collis", ancorada em uma audição e conduzindo o Flight Plan de 10 estágios (`lib/prompts.ts:1427-1473`).

A escolha é resolvida no servidor: `coachType || (auditionId ? "character" : "general")` (`app/api/coach/chat/route.ts:117`) e reforçada no `buildCoachPrompt` por `coachType === "character" || Boolean(auditionFullData && currentFocus?.currentStage)` (`build-coach-prompt.ts:29`).

Entrada típica: `GET /acting-coach?auditionId=...&project=...&role=...&analysisType=sides&coachType=character` (gerado em `auditions/[id]/page.tsx:271-275,295-299,318-322`). Ao detectar `auditionId`, a página cria automaticamente uma nova sessão *character* e envia uma mensagem inicial (`page.tsx:78-112`).

## B.2 Contrato de requisição/resposta

### Requisição (`CoachApiRequest`, `lib/acting-coach/contracts.ts:62-73`)

`{ coachType?, content, history?, auditionId?, currentFocus?, document?, targetStage? }`.
- `content` obrigatório e não vazio → 400 (`coach/chat/route.ts:26-28`).
- `document` opcional validado por `validateDocumentPayload` (`lib/document-processing.ts:33-54`): MIME na allowlist, base64, ≤20MB decodificado.
- `targetStage` sanitizado para inteiro 1..10 (linhas 22-24).

### Resposta (`CoachApiResponse`, `contracts.ts:110-124`)

```
{ aiData: { coach_reply, session_focus, step_index, mode, phase,
            current_stage?, completed_stages?, flight_plan_mode?,
            sides_text, audition_plan?, action?, extractions? } }
```

O modelo **não** é chamado com `responseSchema` — apenas `getGenerativeModel(ai, { model: "gemini-3.1-pro-preview" })` (`coach/chat/route.ts:137`). O texto é limpo de cercas ` ```json ` e parseado; falha → `{reply: rawText}` (`route.ts:157-163`). Os campos ausentes caem para o `currentFocus` anterior (168-178). `sides_text` é reenviado ao cliente a partir de `auditionFullData.sidesText` (175) para persistência na sessão.

### Persistência por turno (`hooks/use-acting-coach.ts:153-332`)

1. mensagem do usuário → `users/{userPath}/coachSessions/{sessionId}/messages` (176-181), com `documentName` opcional;
2. `history` = **todo** o array local de mensagens (171), mas o servidor corta em `MAX_HISTORY_MESSAGES = 20` (`coach/chat/route.ts:8,102`);
3. mensagem do assistente (232-238);
4. `updateDoc` da sessão: `lastActiveAt`, `messageCount: increment(1)`, `sessionFocus`, `stepIndex`, `mode`, `phase`, `coachType`, `currentStage`, `completedStages`, `flightPlanMode`, `auditionPlan` (se houver), `sidesText` (se string) — 241-256.
5. **Gate de qualidade de DNA** (259-279): só escreve no perfil se `action.type === "trigger_dna_extraction"` **e** `progress_assessment.has_actionable_pattern === true` **e** `depth_score >= 4`; grava `psychology.traits`, `psychology.coreValues`, `physicality.somaticTells` com `arrayUnion` + `lastUpdated`.
6. **Ação de perfil** (282-307): `update_actor_profile` → escreve em `actorProfiles/{uid}` com **allowlist** `COACH_WRITABLE_FIELDS` (286-291) idêntica à lista do prompt.

## B.3 Regras do prompt do coach

**General (`ACTING_COACH_SYSTEM_PROMPT`, `lib/prompts.ts:1282-1420`)**
- Um passo por vez; ≤~60 palavras no modo `guided`; no máximo 1 pergunta por turno; turno pode ser só reflexo.
- Ler pushback como informação (overwhelm → desacelerar; evasão → nomear gentilmente; recusa real → abandonar o exercício). Nunca repetir a mesma micro-pergunta.
- Modos `guided` / `informational` / `transition`; "floating focus" com `session_focus` + `step_index`.
- **BOUNDARIES** (1353-1359): não fazer terapia; não especular sobre estado psicológico; **nunca nomear/atribuir conselhos a practitioners**; **nunca incluir marcadores de citação `[1]`**; recomendar o Character Coach quando o pedido for específico de papel.
- **ACTION** (1361-1419): só `trigger_dna_extraction` (payload `{}`) — em pedido explícito do ator **no mesmo turno** (case a), ou por julgamento quando ≥3 trocas significativas + material psicológico + respiração natural (case b; na dúvida, não emitir). `update_actor_profile` só com pedido explícito + confirmação; **array replace semantics** obrigatório (1406); campos não-graváveis listados (1404).
- Exemplos few-shot completos em 1325-1351.

**Character (`CHARACTER_COACH_SYSTEM_PROMPT`, `lib/prompts.ts:1427-1473`)**
- Inglês britânico, sem em-dash, sem hype; persona "Tracey Collis".
- 4 CORE RULES: nunca repetir o breakdown; ajudar o ator a **descobrir** (não prescrever), turnos de 50-150 palavras; **diálogo verbatim** dos sides; hierarquia de fontes `Sides > Brief > Breakdown > DNA > escolhas da sessão > craft geral` (1436).
- 10 estágios nomeados (1439-1448) + sign-off obrigatório `"You are cleared for takeoff."`.
- Formato de saída JSON com `current_stage`, `completed_stages`, `flight_plan_mode`, `audition_plan` (12 campos) — 1450-1472.

## B.4 RAG / corpus: arquitetura projetada × realidade de runtime

A documentação e o código de infraestrutura descrevem um RAG com vetor DB, mas **o caminho de execução não o usa**:

| Módulo | Uso em produção | Uso em testes |
|---|---|---|
| `lib/acting-coach/infrastructure/load-corpus-documents.ts` (`loadCorpusDocuments`, extensões `.txt/.md/.pdf`, bloqueia `.doc/.docx/.epub`) | **nenhum** | `load-corpus-documents.test.ts` |
| `lib/acting-coach/domain/chunk-acting-text.ts` (`chunkActingText`, `chunkSize=800`, `overlapSize=100` — linhas 7-8) | **nenhum** | `chunk-acting-text.test.ts` |
| `lib/acting-coach/infrastructure/extract-text-from-pdf.ts` (60s) | indireto só via `loadCorpusDocuments` (também morto) | sim |
| `lib/acting-coach/infrastructure/config.ts` (`ACTING_COACH_GENERATION_MODEL` obrigatória, cacheada) | **nenhum** | `config.test.ts` |
| `lib/acting-coach/infrastructure/create-generation-model.ts` | **nenhum** | `create-generation-model.test.ts` |
| `lib/acting-coach/infrastructure/coach-reply-schema.ts` (`COACH_REPLY_SCHEMA`) | **nenhum** | `coach-reply-schema.test.ts` |
| `lib/acting-coach/application/get-audition-context.ts` | **sim** (`coach/chat/route.ts:3,69-72`) | sim |
| `lib/acting-coach/build-coach-prompt.ts` | **sim** (`coach/chat/route.ts:4,119`) | sim |

Evidência decisiva: `buildCoachPrompt({ ..., excerpts: [], ... })` (`app/api/coach/chat/route.ts:124`) — a lista de trechos é **sempre vazia**. Quando vazia, o prompt injeta um bloco explícito: `"# NO REFERENCE MATERIAL\nNo acting-library reference material is available for this turn... Do not invent source books, quotes, citation numbers, or library references."` (`build-coach-prompt.ts:189-193`). Combinado com as regras 1356-1357 do prompt, **não há citação, não há grounding externo**: as respostas vêm de conhecimento geral + contexto do ator/audição.

O modelo também é **hardcoded** (`gemini-3.1-pro-preview`, `coach/chat/route.ts:137`), ignorando `getActingCoachConfig()` — ou seja, a env `ACTING_COACH_GENERATION_MODEL` documentada no README não tem efeito no chat.

Consequências visíveis: `components/acting-coach-citations.tsx` (UI de citações com `CoachCitation[]`) existe mas **não é importado por ninguém**; `components/coach-suggestion-chips.tsx` idem (o README ainda o lista como arquivo-chave).

## B.5 Contexto de audição e atualização de DNA

### B.5.1 Leitura de contexto (`app/api/coach/chat/route.ts:61-100`)

Quatro leituras em paralelo (`Promise.allSettled`):
1. `users/{userPath}/profile/master` → `actorBaseline` (JSON completo) — 61,76-80;
2. `actorProfiles/{uid}` → `actorProfile` (JSON completo) — 62,82-86;
3. `getUserAuditionsSummary(userPath, db)` — todas as audições, ordenadas por `createdAt` desc em JS (sem `orderBy` no Firestore) — `get-audition-context.ts:4-24`;
4. `getAuditionFullData(userPath, auditionId, db)` → `users/{userPath}/auditions/{auditionId}` — `get-audition-context.ts:26-36`.

Falhas parciais só geram `warn` (92,99) e o prompt segue.

### B.5.2 Montagem do prompt (`lib/acting-coach/build-coach-prompt.ts:12-207`)

Ordem das seções: persona → `# CURRENT ACTOR` → `# ACTOR DNA & PSYCHOLOGY` → `# ACTOR PUBLIC PROFILE` → `# CURRENT SESSION FOCUS & STAGE STATE` → `# CRITICAL BRIEF FACTS` → `# EXACT SIDES TEXT (SINGLE SOURCE OF TRUTH FOR ALL DIALOGUE)` → breakdown ativo (sides+brief, ou só um, ou legado) → `# ACTOR'S AUDITIONS` (`- {project} — {role} ({id})`) → `# METHODOLOGY REFERENCE MATERIAL` ou `# NO REFERENCE MATERIAL` → `# CONVERSATION LOG` (`Actor:`/`Coach:`) → `# ACTOR'S CURRENT REQUEST`.
- `criticalBriefFacts` só entram se `label` e `value` existirem (68-70).
- `sidesText` é cercado por ```` ``` ```` e a instrução "you MUST quote verbatim... NEVER invent, re-generate, or paraphrase" (79-86) — porém **o campo está sempre vazio** com docs criados pelo wizard (achado #1).
- O header da audição inclui project, role, deadline (+tz do projeto), `actorLocalDeadline` e casting director (109-124).
- Legado: `performanceMap` só é usado quando nem sides nem brief estão presentes (`legacyOnly`, 144,158-169).

### B.5.3 Atualização de DNA — **dois caminhos concorrentes**

| Caminho | Gatilho | Modelo | Destino | Campos |
|---|---|---|---|---|
| **A. Inline (novo)** `hooks/use-acting-coach.ts:259-279` | `action.type === "trigger_dna_extraction"` + gate de qualidade (`depth_score ≥ 4`) | o mesmo do chat | `users/{userPath}/profile/master` | `psychology.traits`, `psychology.coreValues`, `physicality.somaticTells` (arrayUnion) |
| **B. Endpoint (legado)** `POST /api/coach/updateDna` | botão "Update DNA" do `ChatInput` (`components/chat-input.tsx:108-139`), com as **últimas 15** mensagens | `gemini-2.5-pro` + `thinkingLevel: "MEDIUM"` + function calling `update_master_profile` | `users/{userPath}/profile/master` **e** `users/{userPath}/sessions/{sessionId}` | `psychology.{traits,defenseMechanisms,coreValues,relationalDynamics}`, `acting_fuel.{coreWounds,unmetNeeds,publicMasks,archetypes}`, `history.keyEntities` (`updateDna/route.ts:207-215`) |

Problemas:
- O caminho B grava em `users/{userPath}/sessions/{sessionId}` — **coleção órfã**: nem `dnaSessions` (chat de DNA, `use-chat.ts:233`) nem `coachSessions` (coach, `use-acting-coach.ts:89`). Nenhum leitor usa `sessions/`.
- O prompt de B proíbe terminologia de atuação (`updateDna/route.ts:118`), enquanto o prompt do coach proíbe terapia — filosofias opostas sobre o mesmo dado.
- B roda sobre `messages` passados pelo cliente e não checa se a sessão realmente pertence ao usuário (usa `sessionId` cru).
- A extração via `lib/dna/extraction/run-extraction.ts` (function calling `EXTRACTION_TOOL`, `gemini-2.5-pro`, history das últimas 7) é usada pelo chat de DNA — não pelo coach.

## B.6 Flight Plan, Rehearsal Runner e Audition Plan

- **Estágios**: `components/acting-coach/flight-plan.tsx:15-26` define os 10 estágios (Orientate, Relationship, Want/Stakes, Actions/Beats, Subtext, Personal DNA, Strong Choices, To Camera, Ground & Run, Takeoff) e `FlightPlanStage = 1..10` (`contracts.ts:3`).
- **Navegação**: a barra mostra o estágio ativo, badge `Guided Flow` vs `Direct Stage`, e um menu de 10 cards com check de concluídos (linhas 45-143). O botão "Run Scene Now" só aparece no **estágio 9** (80-88).
- **`selectStage`** (`use-acting-coach.ts:381-388`) grava `{currentStage, flightPlanMode:"menu", sessionFocus:"Stage N"}`; a página então envia `"Let's jump to Stage N."` com `targetStage` (`acting-coach/page.tsx:134-141`), que o servidor mescla em `currentFocus` (`coach/chat/route.ts:104-115`).
- **Estado inicial da sessão**: `currentStage: 1`, `completedStages: []`, `flightPlanMode: "guided"` (`use-acting-coach.ts:107-109,351-353`).
- **`AuditionPlanData`** = 13 campos (`before_scene`, `relationship`, `want`, `stakes`, `obstacle`, `primary_action`, `shift`, `private_thought`, `contradiction`, `first_five_seconds`, `grounding`, `final_instruction`, `sign_off`) — `contracts.ts:5-19`; renderizado por `AuditionPlanCard` (`components/acting-coach/audition-plan-card.tsx:41-54`) com botão de copiar (`:17-39`). O card é renderizado sempre que `session.auditionPlan` existe (`acting-coach/page.tsx:308-314`).
- **Rehearsal Runner do coach** é o runner textual descrito em §A.4.3; recebe `sidesText={session?.sidesText || ""}` (`acting-coach/page.tsx:349`), campo dependente do achado #1.

## B.7 Session timer e time tracking — **não pertencem ao Acting Coach**

| Hook | Onde é usado | Regras |
|---|---|---|
| `hooks/use-session-timer.ts` (`DEFAULT_BREAK_INTERVAL_MS = 15 min`, linha 5) | **apenas** `app/chat/page.tsx:40` (chat de DNA) | `setTimeout` de 15 min → abre `BreakCheckInModal`; `dismissBreakPrompt` reinicia; `resetTimer` idem; `triggerBreakPrompt` manual (57-86). Sem limite de sessão, sem bloqueio, sem persistência |
| `hooks/use-chat-time-tracker.ts` | **apenas** `app/chat/page.tsx:25` (chat de DNA) | Acumula segundos em ref apenas com `document.visibilityState === "visible"`; backup em `localStorage` (`unsynced_chat_seconds_{userPath}`, a cada 5s); flush atômico a cada 60s, em `visibilitychange→hidden`, `beforeunload` e unmount; grava `totalChatSeconds: increment(delta)` em `users/{path}/profile/master` (`:54-60`). Sem limites/teto |

O Acting Coach **não** tem timer, break reminder ou contabilização de tempo — nenhum dos hooks é importado pela página do coach. O README não documenta nenhum dos dois (ver §D).

## B.8 Caminhos Firestore do domínio B

| Caminho | Conteúdo |
|---|---|
| `users/{userPath}/coachSessions/{sessionId}` | metadados da sessão (`CoachSession`, `lib/chat-types.ts:48-65`): `createdAt`, `lastActiveAt`, `status`, `title`, `linkedAuditionId`, `messageCount`, `sessionFocus`, `stepIndex`, `mode`, `phase`, `coachType`, `currentStage`, `completedStages`, `flightPlanMode`, `auditionPlan`, `sidesText` |
| `users/{userPath}/coachSessions/{sessionId}/messages/{id}` | `CoachMessage { role, content, timestamp, documentName? }` |
| `users/{userPath}/profile/master` | DNA (escrita pelo coach em ações e pelo updateDna) |
| `users/{userPath}/sessions/{sessionId}` | **órfã** — só escrita por `updateDna` (`:222`) |
| `actorProfiles/{uid}` | perfil público (escrita pela ação `update_actor_profile`) |

`DEFAULT_SESSION_ID = "coach-session-1"` (`use-acting-coach.ts:25`) é usado quando não há sessão; a lista auto-seleciona a mais recente na primeira carga (`hasAutoSelectedSession`, 141-148).

## B.9 Inconsistências, código morto e TODOs (B)

| Severidade | Achado | Evidência |
|---|---|---|
| Alta | RAG/corpus 100% morto em runtime; `excerpts: []` sempre | `coach/chat/route.ts:124`; §B.4 |
| Alta | `ACTING_COACH_GENERATION_MODEL`/`config.ts`/`create-generation-model.ts` ignorados; modelo hardcoded | `coach/chat/route.ts:137` vs `infrastructure/config.ts:20` |
| Alta | Dois caminhos de atualização de DNA com schemas e modelos diferentes; caminho B escreve em coleção órfã `sessions/` | §B.5.3 |
| Média | `COACH_REPLY_SCHEMA` existe mas nunca é passado como `responseSchema` → parse manual e frágil | `infrastructure/coach-reply-schema.ts`; `route.ts:157-163` |
| Média | `ActingCoachCitations` e `CoachSuggestionChips` não são usados por nenhum componente | grep sem imports |
| Média | `sides_text` chega `null` para audições criadas pelo wizard → Stage 9 runner sempre "No dialogue lines detected" | §0 #1 |
| Média | `useSessionTimer`/`useChatTimeTracker` são do `/chat`, não do coach (possível expectativa equivocada) | §B.7 |
| Média | `targetStage` aceito mas `phase`/`session_focus` podem voltar nulos e sobrescrever estado anterior com `?? null` | `route.ts:168-174` |
| Baixa | `history` enviado completo pelo cliente e truncado só no servidor (payload grande) | `use-acting-coach.ts:171` |
| Baixa | `clearSessionFocus` não zera `currentStage`/`completedStages` | `use-acting-coach.ts:363-371` |
| Baixa | `getUserAuditionsSummary` não usa `orderBy` (custo de leitura total) | `get-audition-context.ts:8-23` |
| Baixa | `console.log("[PERF][SERVER]...")` em produção no route do coach | `coach/chat/route.ts:12,16,57,74,149,155` |
| — | Sem `TODO/FIXME` nos arquivos do domínio B (grep vazio) | — |

---

# C) ACTOR PROFILE

## C.1 Modelo de dados `ActorProfile` (`lib/profile-types.ts:113-170`)

| Campo | Tipo | Obrigatório | Regra efetiva |
|---|---|---|---|
| `slug` | `string` | sim | sem validação; gerado por `generateSlug` (não único) |
| `status` | `"draft" \| "published"` | sim | default `"draft"` |
| `headshot` | `string \| null` | sim (nullable) | upload 5MB, PNG/JPEG/WebP no `accept` |
| `additionalPhotos` | `string[]` | sim | máx. **10** (`photos-section.tsx:70,151`) |
| `fullName` | `string` | `.min(1)` | único campo com `min` |
| `playingAgeMin` / `playingAgeMax` | `number \| null` | sim (nullable) | HTML `min=1 max=100`; **`NaN` possível** com input limpo (`valueAsNumber`) |
| `location` | `string` | sim | livre |
| `timezone` | `string` | sim | **sem UI de edição e sem exibição** — só aparece no merge do autofill (`profile/page.tsx:282`) |
| `gender` | `string` | sim | texto livre (não é select) |
| `height` | `string` | sim | texto livre; conversão por `lib/height-utils.ts` |
| `heightUnit` | `"imperial" \| "metric"` | sim | default `"imperial"` |
| `eyeColour` / `hairColour` | `string` | sim | **texto livre** (não há lista de opções) |
| `nationalities` | `string[]` | sim | badges com dedupe (sem limite) |
| `workPermits` | `string[]` | sim | opções fixas `["UK","EU","US","South Africa","Other"]` (`:23`) |
| `ethnicity` | `string` | sim | livre; **não aparece no perfil público HTML**, mas aparece no markdown/JSON-LD |
| `appearance` | `string[]` | sim | badges livres (sem limite) |
| `awardsCallout` | `string` | sim | livre |
| `bio` | `string` | `.max(500)` | único limite real do schema + `maxLength={500}` na UI |
| `agents` | `Agent[]` | sim (default `[]`) | sem limite de quantidade |
| `agencyName/Email/Website/Phone` | `string?` | opcional | **legado**: sem UI, mas gravados e usados como fallback |
| `showContactPublicly` | `boolean` | sim | default `false` |
| `showreels` | `{title, url, thumbnailUrl?}[]` | sim | sem limite; upload de vídeo 500MB |
| `credits` | `{category, title, role, year, productionCompany, featured}[]` | sim | lista aberta; sem limites de tamanho |
| `training` | `{category, institution, qualification, years}[]` | sim | reusa `CREDIT_CATEGORIES` (semanticamente estranho) |
| `externalProfiles` | objeto com **23** chaves string | sim | 22 obrigatórias + `facebook` `.optional().default("")` (`:101`); sem validação de URL |
| `skillsAndAccents` | `string[]` | sim | sem campo separado de accents |
| `cvUrl` / `cvFilename` | `string \| null` | sim | upload PDF ≤100MB |

`defaultActorProfile` em `:174-232`. `generateSlug(name)` = lowercase, remove não-alfanuméricos, espaços→`-`, colapsa hífens (`:235-242`). `normalizeAgents` migra o formato legado singular→array (`:245-265`).

> **Achado crítico (validação):** `app/(interior)/profile/page.tsx:46` instala `zodResolver(actorProfileSchema)`, mas **`handleSubmit` nunca é chamado** — `saveDraft` (`:65`) e `publishProfile` (`:213`) passam `methods.getValues()` direto para `setDoc`. Logo, `fullName.min(1)` e `bio.max(500)` **não são aplicados na gravação**; só o `maxLength` do DOM limita o bio. Tudo mais (URLs, e-mails, contagens, tamanhos) é irrestrito.

## C.2 Seções do editor

`ActorProfileForm` renderiza 11 `SectionCard`s na ordem abaixo (`components/profile/actor-profile-form.tsx:42-85`):

| # | Seção | Arquivo | Campos (RHF) | Listas hardcoded |
|---|---|---|---|---|
| 1 | Photos | `sections/photos-section.tsx` | `headshot`, `additionalPhotos` | accept `image/png,image/jpeg,image/webp` (`:127,167`) |
| 2 | Basic Info | `sections/basic-info-section.tsx` | `fullName`, `playingAgeMin/Max`, `location`, `gender` | `min/max` 1..100 (`:35-36,44-45`) |
| 3 | Physical & Professional | `sections/physical-details-section.tsx` | `height`, `heightUnit`, `eyeColour`, `hairColour`, `nationalities`, `workPermits`, `ethnicity`, `appearance` | `WORK_PERMIT_OPTIONS` (`profile-types.ts:23`) |
| 4 | About Me | `sections/about-me-section.tsx` | `awardsCallout`, `bio` | `maxLength=500` + contador (`:36,41`) |
| 5 | Agent / Representation | `sections/agent-section.tsx` | `agents[].{agencyName,agencyEmail,agencyPhone,agencyWebsite}`, `showContactPublicly` | — |
| 6 | Showreels | `sections/showreels-section.tsx` | `showreels[].{title,url,thumbnailUrl}` (+`VideoDropzone`) | `video/*`, 500MB |
| 7 | Credits | `sections/credits-section.tsx` | `credits[].{featured,title,role,year,productionCompany}` | `CREDIT_CATEGORIES`/`LABELS` (tabs) |
| 8 | Training | `sections/training-section.tsx` | `training[].{institution,qualification,years}` | reusa `CREDIT_CATEGORIES` |
| 9 | External Profiles | `sections/external-profiles-section.tsx` | `externalProfiles.{23 chaves}` | `EXTERNAL_PROFILE_FIELDS` (23) |
| 10 | Skills & Accents | `sections/skills-accents-section.tsx` | `skillsAndAccents` | — |
| 11 | CV Upload | `sections/cv-upload-section.tsx` | `cvUrl`, `cvFilename` | `application/pdf`, 100MB |

Coluna direita: `ImdbAutofill` + `ProfileLivePreview` (`profile/page.tsx:391-396`). `ProfileHeader` (`components/profile/profile-header.tsx`) mostra status, URL (`actors/{slug}`), botões Copiar/Share/Unpublish/Publish e indicador de save (`:104-178`).

Autosave: `methods.watch` → debounce **2s** (`profile/page.tsx:90-95,164-177`), com `initialLoadDone` para não salvar no `reset()` inicial; `fullName` alterado regenera o slug automaticamente (`:170-172`). Publish grava `status:"published"` + `publishedAt` (`:203-233`) e faz revert para `"draft"` em erro (`:230`).

`ProfileLivePreview` (`components/profile/profile-live-preview.tsx`) usa `useWatch` de 17 campos, prefere `agents[].agencyName` com fallback ao legado (`:32-36`), e `featuredCredits = credits?.filter(c => c.title).slice(0,3)` (`:43`) — **filtra por `title`, ignorando a flag `featured`**.

## C.3 Perfil público: slug, URL e export legível por LLM

### C.3.1 Esquema de URL

- Página pública: `/actors/{slug}` (`app/actors/[slug]/page.tsx`).
- Export markdown: `/actors/{slug}/index.md` (`app/actors/[slug]/index.md/route.ts`).
- Descoberta por `alternates.types["text/markdown"]` no `generateMetadata` (`page.tsx:35-39`) — padrão "llms.txt"/content-negotiation.
- Layout público próprio (`app/actors/layout.tsx:4-16`): `PublicNavbar` + `PublicFooter`, fundo `#F0E8DC`. Não há `robots.txt`/`sitemap` versionados no repo.
- **Acesso**: público, sem auth — `getPublicProfile` consulta com admin SDK `where("slug","==",slug).where("status","==","published").limit(1)` (`lib/get-public-profile.ts:12-17`), envolvido em `cache()` do React para deduplicar `generateMetadata` + page. A rota markdown repete a query (`index.md/route.ts:13-18`), converte Timestamps para ISO (`:30-35`), deriva `baseUrl` de `host`/`x-forwarded-proto` com fallback `NEXT_PUBLIC_SITE_URL`/`VERCEL_URL`/`localhost:3000` (`:40-50`) e serve `text/markdown; charset=utf-8` com `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` (`:54-59`). 404 também devolve markdown (`:21-25`).
- **Risco de colisão**: `generateSlug` não garante unicidade, não há verificação de slug duplicado no save, e a query usa `.limit(1)` → último doc sobrescreve o primeiro na busca pública de forma arbitrária.

### C.3.2 `profileToMarkdown` (`lib/profile-to-markdown.ts:19-260`)

Estrutura gerada, em ordem:
1. **YAML frontmatter** schema.org (`buildFrontmatter`, 510-564): `@context`, `@type: Person`, `name`, `url`, `jobTitle`, `description`, `image`, `location`, `gender`, `nationality[]`, `height`, `playingAge`, `knowsAbout[]`, `workPermits[]`, `appearance[]`, `eyeColor`, `hairColor`, `representedBy` (só se `showContactPublicly`), `dateModified`.
2. **Bloco `<!-- AI_AGENT_CONTEXT ... -->`** (`buildAIAgentBlock`, 264-336): 6 instruções numeradas para agentes de IA (role matching, skill matching, experience level, availability, visual reference, contact) + **"casting confidence signals"** dinâmicos (≥5 créditos → "Established", showreel, training, awards, work permits, headshot, CV, plataformas externas) + canonical URL + data freshness.
3. `# {fullName}` + parágrafo de resumo (`buildSummaryParagraph`, 598-626).
4. `## About` (bio), `## Casting Profile` (`buildCastingFitSection`, 340-388).
5. `## Details` (tabela chave/valor; **inclui `ethnicity`**, 646).
6. `## Credits` com contagem, agrupamento por categoria (tabelas) e `### Notable / Featured Credits` **baseada na flag `featured`** (82-96).
7. `## Showreels & Demo Reels`, `## Training & Education`, `## Skills & Accents`, `## Awards & Recognition`, `## Representation` (só se público), `## Availability & Work Authorization`, `## External Profiles & Casting Platforms`, `## Photos` (`![...](url)`), `## CV / Resume`.
8. `## Structured Data` — **JSON-LD** (`buildStructuredCastingData`, 392-506) com extensões `x-casting` (`playingAgeRange`, `appearance`, `workPermits`, `eyeColor`, `hairColor`, `ethnicity`).
9. Rodapé de contexto de IA com canonical, data e "Powered by The Actors Copilot" (247-257).

Escapes: `escYaml` (aspas/newlines) e `esc` (pipe em tabelas) — 588-596.

## C.4 IMDB Autofill (`app/api/profile/autofill/route.ts`)

Fluxo real:

1. **Auth** Bearer → 401 (`:186-201`).
2. **Body** `{url}` → 400 se ausente (`:203-223`).
3. **Validação de URL** (`:225-250`): parse robusto; allowlist de hostnames `["imdb.com","www.imdb.com","m.imdb.com"]`; pathname deve casar `/\/name\/nm\d+/`. Caso contrário → 400.
4. **Firecrawl** (`:255-267`): `POST https://api.firecrawl.dev/v2/scrape` com `Authorization: Bearer ${process.env.FIRECRAWL_API_KEY}`, body `{url, formats:["markdown"], onlyMainContent:false, waitFor:2000}`. Falha HTTP ou `success:false` → 502. **Não existe fallback scraping** (não há segundo provedor nem fetch direto do HTML) — o "bypass do WAF" é responsabilidade do Firecrawl.
5. **DNA** (`:292-307`): lê `users/{userPath}/profile/master` (admin SDK) e reduz a um contexto enxuto: `acting_fuel.archetypes`, `psychology.traits` (5), `psychology.coreValues`, `history.keyEntities` (5) — `:331-336`.
6. **Parsing determinístico** (`parseIMDBMarkdown`, `:21-170`): extrai `fullName` do `# H1`/título, `location` de "Born"/"Birth Place" (regex com corte de data), `height` (imperial `5′ 9″`/`5'9"` ou métrico `175 cm`/`1.75 m`), `knownFor` (janela de 15 linhas), categorias de créditos por headings (television/tv, feature/film/movie, stage/theatre, commercial), linhas de crédito com regex tolerante a `[Título](url)`, `**Título**` ou texto puro, dedupe por `title+year`, `featured` quando aparece em "Known For", e showreels apenas de URLs `imdb.com/video`. Fallback de bio: `metadata.description` truncado em 500 (`:154-157`). Default `fullName: "Actor Profile"` (`:160`).
7. **Síntese Vertex AI** (`:325-358`): `gemini-2.5-flash`, system `IMDB_AUTOFILL_PROMPT` (`lib/prompts.ts:1195+`), `responseMimeType: application/json`, `temperature: 0.3`; prompt = markdown bruto do IMDB + JSON do DNA. **Sem `responseSchema`** → parse por `JSON.parse` após remover cercas; em falha usa o dado determinístico como fallback (`:370-383`).
8. **Merge** (`:386-422`): IA tem prioridade por campo com fallback no determinístico; `heightUnit` inferido (`cm`/`m` → metric); converte `agency*` singular em `agents: [...]`; `externalProfiles` vem só da IA.
9. Resposta `{success, data: finalData}` (200).
10. No cliente (`components/profile/imdb-autofill.tsx`), `onSuccess` dispara `handleAutofillSuccess` (`profile/page.tsx:241-345`) com **estratégia "preencher só vazios"** (string por string, arrays com `hasRealItems`, deep-merge de `externalProfiles`) e então `methods.reset(merged)` + `debouncedSave()`.
11. `lib/imdb-types.ts` define `FirecrawlMetadata`, `FirecrawlSuccessResponse`/`ErrorResponse`, `ImdbExtractedData`, `Credit`, `Showreel`, `KnownForEntry`, `DnaProfile`, `SynthesizedProfile` — **nenhum é usado como validação em runtime** (só tipagem de fachada; o route redefine `FirecrawlMetadata` localmente em `:8-12`).

## C.5 Fotos, vídeo e CV: limites e caminhos de storage

| Recurso | Limite | MIME | Caminho no Storage | Delete |
|---|---|---|---|---|
| Headshot | 5MB (`photos-section.tsx:46`) | `accept` png/jpeg/webp, **sem checagem de MIME no código** | `profiles/{uid}/headshot.{ext}` (`:53`) | **nenhum** |
| Fotos adicionais | 5MB cada, **máx. 10** (`:74,70,151`) | idem | `profiles/{uid}/photos/{index}.{ext}` (`:82`) — índice = `additionalPhotos.length`, **pode sobrescrever em re-add após remoção** | **nenhum** |
| Showreel (vídeo) | **500MB** (`VideoDropzone.tsx:183`) | `video/*` (`:182`) | `users/{uid}/showreels/{Date.now()}_{safeName}` (`:100-102`) | sim (`deleteShowreelFile`) |
| Thumbnail do showreel | gerada no cliente | `image/jpeg` | `users/{uid}/showreels/thumbnails/{uniqueFileName}.jpg` (`:142`) | sim |
| CV | **100MB** (`cv-upload-section.tsx:28`) | `application/pdf` (`:32,109`) | `profiles/{uid}/cv.pdf` (`:41`) — nome fixo, re-upload sobrescreve | **nenhum** |

- Extração de thumbnail (`lib/showreels/extract-thumbnail.ts`): vídeo + canvas, seek em `0.1s` (ou `1.0s` se duração inválida), downscale proporcional com **cap de 512px** (OOM guard), timeout 10s, `AbortSignal`, cleanup idempotente (`URL.revokeObjectURL`) — linhas 14,53,75,100-104,30-42.
- `deleteShowreelFile` (`lib/showreels/storage.ts:11-47`): só apaga URLs que contenham `firebasestorage.googleapis.com` (protege YouTube/Vimeo), `Promise.allSettled`, chamado fire-and-forget (`showreels-section.tsx:44`). **Bug**: importa `getDb` sem usar (`:13`) e chama `getStorage()` sem `getApp()` (`:14`), divergindo do padrão do resto do repo (`getStorage(getApp())`).
- Todo upload é **client-side** para o Firebase Storage (sem rota de servidor); a segurança depende das Storage Rules (não versionadas neste repo — só `firestore.rules` existe).

## C.6 Firestore: caminhos e rules

| Caminho | Operação | Onde |
|---|---|---|
| `actorProfiles/{user.uid}` | read (`getDoc`), write (`setDoc` merge) — draft, publish e ação do coach | `profile/page.tsx:67,126,215`; `use-acting-coach.ts:301` |
| `actorProfiles` (query por slug+status) | read público | `get-public-profile.ts:12-17`; `index.md/route.ts:13-18` |
| `users/{userPath}/profile/master` | read (autofill/coach/análises) | `autofill/route.ts:298`; `coach/chat/route.ts:61` |

`firestore.rules` (arquivo inteiro, 8 linhas): `match /{document=**} { allow read, write: if request.auth != null; }` com o comentário explícito "This is a permissive rule for development - **tighten for production**". Ou seja: qualquer usuário autenticado pode ler/gravar **qualquer** documento (incluindo `actorProfiles` de terceiros). O perfil público contorna as rules via Admin SDK.

## C.7 Inconsistências, código morto e TODOs (C)

| Severidade | Achado | Evidência |
|---|---|---|
| Alta | Zod não aplicado no save/publish (resolver sem `handleSubmit`) | §C.1; `profile/page.tsx:46,65,213` |
| Alta | Slug sem unicidade + `.limit(1)` público → colisão entre atores | `profile-types.ts:235-242`; `get-public-profile.ts:16` |
| Alta | Firestore rules totalmente permissivas em produção | `firestore.rules:5-7` |
| Média | Dados públicos são `as ActorProfile` sem validação; doc parcial derruba a página (`profile.additionalPhotos.length` etc.) | `get-public-profile.ts:31`; `actors/[slug]/page.tsx:54,60,66,70,74` |
| Média | `featured` editável mas ignorado no preview e no perfil público HTML; só markdown/JSON-LD o usam | `credits-section.tsx:63`; `profile-live-preview.tsx:43`; `public-profile/credits-section.tsx:12`; `profile-to-markdown.ts:82` |
| Média | `ethnicity` coletado e exportado em markdown/JSON-LD, ausente do HTML público | `physical-details-section.tsx:215`; `profile-to-markdown.ts:496,646`; `public-profile/details-section.tsx` |
| Média | `timezone` sem UI e sem exibição | `profile-types.ts:127,183`; `profile/page.tsx:282` |
| Média | Sem delete de Storage para CV e fotos → objetos órfãos; CV com nome fixo | §C.5 |
| Média | `NaN` de `valueAsNumber` em playing age pode ir para o Firestore | `basic-info-section.tsx:32,41` |
| Média | `type="text"` em todos os `externalProfiles` (sem validação de URL) | `external-profiles-section.tsx:42` |
| Baixa | Campos legados `agency*` sem UI mas gravados e lidos como fallback — **comportamento travado por teste** | `agent-section.tsx`; `profile-live-preview.tsx:20,36`; `profile-live-preview.test.tsx:24-38` |
| Baixa | `@typescript-eslint/no-explicit-any` é apenas warning; `useRef<any>` no `VideoDropzone` com eslint-disable e `any[]` no `handleAutofillSuccess` | `eslint.config.mjs:47,85,115`; `VideoDropzone.tsx:33`; `profile/page.tsx:246` |
| Baixa | `showreels-section.tsx` grave `thumbnailUrl: ""` quando ausente; `z.string().optional()` aceita `""` | `:30` |
| Baixa | Colisão de nomes: dois componentes `PhotosSection` (editor e público) | §F |
| Baixa | `alert()` em vez de toast/logger no CV e fotos | `cv-upload-section.tsx:29,33,48`; `photos-section.tsx:47,57,71,75,86` |
| Baixa | `public-navbar.tsx:16-21` e `public-footer.tsx:33-35` têm botões sem handler | §F |
| Baixa | `platform-icon.tsx:113-115` chama o serviço de favicons do Google para cada plataforma em cada visita pública (privacidade/perf); `console.warn` em vez de logger | `platform-icon.tsx:100,113` |
| Baixa | `about-section.tsx` renderiza a bio sem quebras de linha e sem revalidação de 500 | `public-profile/about-section.tsx:9` |
| Baixa | `next.config.mjs` desativa otimização de imagens e o ESLint libera `<img>` | `next.config.mjs:3-5`; `eslint.config.mjs:53` |
| — | Sem `TODO/FIXME` nos arquivos do domínio C (grep vazio); comentários "SENIOR FIX"/"gambiarra" em `public-profile/credits-section.tsx:19-33,51,94-98` | — |

---

# D) README.md × código — divergências

| README | Código | Veredito |
|---|---|---|
| `/auditions/new` como "Multi-step audition wizard" e `new/page.tsx` (linhas 93, 108) | **não existe** `app/(interior)/auditions/new/page.tsx`; só `new/brief/` e `new/sides/` | README desatualizado |
| `app/api/auditions/analyze/route.ts` (linha 812) | só existem `analyzeBrief/` e `analyzeSides/` | README desatualizado |
| `AUDITION_COACH_PROMPT` (linha 561) | exporta-se `getAuditionCoachPrompt` | nome errado |
| "Full character analysis with 12 sections" (linha 590) | prompt exige **21** seções (`prompts.ts:971,980`) | divergente |
| Pivot engine "Every 10 questions" (`README:538`) | `questionThreshold: 15` (`pivot-logic.ts:21`) | divergente |
| RAG "over a vector database of acting texts" (`README:1202`) e `/api/coach/chat` "RAG-powered ... library grounding" (`README:254`) | `excerpts: []`, sem Pinecone/corpus; prompt proíbe citar (`build-coach-prompt.ts:189-193`; `prompts.ts:1357`) | README contradiz o runtime (o próprio README:1305 admite "no longer uses Pinecone") |
| `coach-suggestion-chips.tsx` como arquivo-chave (`README:1250`) | componente **não importado** | código morto |
| `ACTING_COACH_GENERATION_MODEL` / `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_LOCATION` (`README:1299-1301`) | chat usa `gemini-3.1-pro-preview` hardcoded; `config.ts` só é exercitada em testes | env sem efeito |
| `FIRECRAWL_API_KEY` | **usado** (`autofill/route.ts:258`) mas **ausente** do `env.example` e de qualquer tabela do README | subdocumentado |
| `NEXT_PUBLIC_SITE_URL` | usado por `profile-header.tsx:30` e `index.md/route.ts:42` | ausente do `env.example` |
| `users/{userPath}/masterProfile/current` "Synthesized profile (cached)" (`README:316`) | **nenhuma referência no código**; a síntese grava em `users/{userPath}/profile/master` (`synthesize/route.ts:35,111`) | README inventa coleção |
| `actorProfiles/{uid}` fora do bloco de coleções (`README:313-323`) | é a coleção central do perfil (`profile/page.tsx:67`) | README omite |
| "21 platform URL fields" (`README:1007`) | **23** campos (`profile-types.ts:26-50`) | divergente |
| `profile/page.tsx (244 lines)` (`README:804`) | 402 linhas | divergente |
| "Up to 3 featured credits" no preview (`README:1035-1059`) | preview filtra por `title`, não por `featured` (`profile-live-preview.tsx:43`) | divergente |
| Seções marcadas como required (`fullName*`, `location*`, `eyeColour*`...) | nenhum `required` no DOM e o Zod não roda no save | sem efeito prático |
| `/actors/{slug}` como URL pública (`README:987`) e link "View full public profile" (`README:1053`) | rota **existe** (`app/actors/[slug]/page.tsx`), mas o README não a documenta; não há link real no footer | README subdocumenta |
| Markdown/`index.md` export | **não mencionado no README**; implementado em `app/actors/[slug]/index.md/route.ts` + `lib/profile-to-markdown.ts` | README omite feature inteira |
| Session timer / break reminders / `totalChatSeconds` | **não mencionados**; implementados e usados no `/chat` | README omite |
| Flight Plan / 10 estágios / rehearsal runner | **não mencionados** em nenhum lugar do README | README omite features centrais |
| `cv-upload` "PDF only, max 100MB" (`README:1008`) | confere (`cv-upload-section.tsx:28,32`) | OK |
| Tiers `free \| economy \| business` (`README:629`) | confere (`lib/billing.ts:6`), mas o README não diz que `/profile` e `/acting-coach` exigem acima de `economy` | incompleto |
| Modelo `gemini-2.0-flash` como exemplo (`README:1299`) | runtime usa `gemini-3.1-pro-preview` (coach/análises) e `gemini-2.5-flash` (síntese/autofill) | divergente |
| Duplicata de prompt: `THEATHER_MODE_PROMPT` grafado "THEATHER" no README (562) e no código (`prompts.ts:674`) | typo consistente | OK (typo compartilhado) |
| "Mocking global.fetch — Kajabi API calls" (`README:736`) | `proxy.ts` mantém fallback Kajabi legado (`:65-...`), mas não há testes de Kajabi | provavelmente obsoleto |

---

# E) Gating por tier (todos os três domínios)

Implementado em `proxy.ts` (Edge Middleware), com dois motores:

- `BILLING_ENGINE === "STRIPE"` (default, `proxy.ts:14`): valida o cookie `platform_session` (JWE via `decryptSession`); ausente/inválido → `/login`. Se `tier === 'free'` ou status fora de `['active','trialing']` → `/upgrade`, **exceto** `/dashboard`, que é liberado (`:44-50`). Se `tier === 'economy'` e o path for "business feature" → `/upgrade` (`:52-58`).
- Caminhos "business feature": `pathname.startsWith('/profile') || pathname.startsWith('/acting-coach')` (`:23`).
- Fallback Kajabi (se `BILLING_ENGINE !== 'STRIPE'`): JWT HS256; para `/profile` e `/acting-coach`, exige `payload.offers` e reprova quem tem **apenas** ofertas "economy" (`:91-113`).
- `matcher` (`proxy.ts:118-129`): `/api/billing/success`, `/dashboard/:path*`, `/chat/:path*`, **`/auditions/:path*`**, `/personal-dna/:path*`, `/settings/:path*`, **`/profile/:path*`**, **`/acting-coach/:path*`**.

Leitura prática:
- `/profile` e `/acting-coach` → exigem tier **`business`** (ou, no mínimo, não-economy) com assinatura ativa/trial.
- `/auditions` → coberto pelo matcher, mas **não** é "business feature": só exige sessão válida/assinatura ativa (economy passa).
- Os endpoints de API (`/api/auditions/*`, `/api/coach/*`, `/api/profile/autofill`) **não estão no matcher** e fazem sua própria checagem apenas de Firebase ID Token — **não há verificação de tier no servidor** para eles. Um usuário `free` autenticado pode chamar as APIs diretamente.
- `lib/billing.ts:60-67` **lança erro no import** se `STRIPE_ECONOMY_PRICE_ID`/`STRIPE_BUSINESS_PRICE_ID`/`STRIPE_WEBHOOK_SECRET` não existirem — acoplamento rígido de env.
- Nenhum tier é aplicado dentro dos domínios A/B/C (sem `hasAccess`/`tier` nos routes ou componentes).

---

# F) Código morto / inconsistências consolidadas

**Arquivos/componentes mortos**
- `components/auditions/step-generating.tsx` — **0 bytes**; o estado "5 = generating" (`lib/audition-types.ts:7`) nunca é alcançado (`audition-wizard.tsx:123-126`).
- `app/api/auditions/analyzeBrief/routeBrief.ts` — duplicata idêntica de `route.ts`, não roteada.
- `components/acting-coach-citations.tsx` — nunca importado (e o RAG que o alimentaria não roda).
- `components/coach-suggestion-chips.tsx` — nunca importado (citado no README como arquivo-chave).
- `lib/acting-coach/infrastructure/{config,create-generation-model,coach-reply-schema,load-corpus-documents}.ts`, `lib/acting-coach/domain/{chunk-acting-text,acting-library-types}.ts`, `lib/acting-coach/infrastructure/extract-text-from-pdf.ts` — só exercitados por testes.
- `lib/pivot-logic.ts::resetTrackerForSection` — exportado sem consumidor em produção.
- `app/api/coach/updateDna/route.ts` — usado por um único botão (`chat-input.tsx:121`), com escopo duplicado/conflitante com o caminho inline do `use-acting-coach`.
- `lib/dna/extraction/run-extraction.ts` — usado só pelo chat de DNA.
- `AuditionFormData.sidesFile/briefFile` no schema (`z.any()`) e `actorTimezone` no payload: este último é integralmente descartado.

**Campos/estado sem efeito**
- `AuditionDocument.performanceMap` (legado) ainda é renderizado como fallback (`[id]/page.tsx:307-343`) mas nada o grava hoje.
- `ActorProfile.timezone`, `agencyName/Email/Website/Phone`, `training[].category` no HTML público, `credits[].featured` no HTML público.
- `SaveStatus`, `externalProfiles.facebook` (default divergente dos outros 22 campos).

**Riscos técnicos**
- `firestore.rules` permissivas (`allow read, write: if request.auth != null` em `/{document=**}`).
- Sem índices Firestore versionados apesar de queries compostas (dedupe de audição).
- APIs sensíveis sem gating de tier.
- `prompts.ts` é um monólito de 1473 linhas misturando prompts de DNA, audição, brief, autofill e coach — acoplamento alto e fonte frequente de desatualização do README.
- `JSON.stringify(profileData)` do doc `profile/master` inteiro entra nos prompts de `analyzeSides`, `analyzeBrief` e `coach/chat` — sem truncamento, podendo inflar tokens e vazar metadados internos (`status`, `dataPointsAnalyzed`).

**Nenhum `TODO`/`FIXME` textual** foi encontrado nos arquivos dos três domínios (`grep -rn "TODO\|FIXME\|XXX\|HACK"` em `lib/acting-coach`, `lib/audition-types.ts`, `lib/profile-types.ts`, `lib/pivot-logic.ts`, `components/{auditions,acting-coach,profile}`, `app/api/{auditions,coach,profile}`, `app/(interior)/{auditions,profile,acting-coach}` → vazio). Os TODOs vivos são de infraestrutura geral (`README.md:825-832`): validação de env com Zod, rate limiting em auth, retry de webhook Stripe, migração de execução de IA para o servidor (nota: as análises de audição já rodam no servidor; o item provavelmente se refere a chamadas legadas client-side) e blacklist de JWT no logout.

---

# G) Mapa rápido de arquivos por domínio

**Auditions**
`lib/schemas/audition.ts` · `lib/audition-types.ts` · `lib/pivot-logic.ts` (adjacente, usado só pelo DNA chat) · `lib/prompts.ts` (`getAuditionCoachPrompt` 745-1078, `BRIEF_ANALYSIS_PROMPT` 1080-1103, `BRIEF_*` 1105-1193) · `lib/time-utils.ts` · `app/api/auditions/analyzeSides/route.ts` · `app/api/auditions/analyzeBrief/route.ts` · `…/routeBrief.ts` (morto) · `app/api/actor-copilot/{parse-script,tts}/route.ts` · `lib/actor-copilot/script-parser.ts` · `components/auditions/{audition-wizard,stepper}.tsx` · `components/auditions/step/{step-basic,step-upload,step-review,step-result,step-result-brief,performance-map-print-block,step-generating(vazio)}.tsx` · `app/(interior)/auditions/{page.tsx,new/sides/page.tsx,new/brief/page.tsx,[id]/page.tsx}` · `components/actor-copilot/actor-copilot-rehearsal.tsx` · `app/(interior)/reader-copilot/{page.tsx,[id]/page.tsx}`

**Acting Coach**
`lib/acting-coach/contracts.ts` · `build-coach-prompt.ts` · `application/get-audition-context.ts` · `domain/{acting-library-types,chunk-acting-text}.ts` · `infrastructure/{config,create-generation-model,coach-reply-schema,extract-text-from-pdf,load-corpus-documents}.ts` · `render-markdown.tsx` · `lib/prompts.ts` (`ACTING_COACH_SYSTEM_PROMPT` 1282-1420, `CHARACTER_COACH_SYSTEM_PROMPT` 1427-1473) · `lib/chat-types.ts` (`CoachSession`, `CoachMessage`, `ExtractedPsychData`) · `app/api/coach/{chat,updateDna}/route.ts` · `hooks/{use-acting-coach,use-session-timer,use-chat-time-tracker}.ts` · `components/acting-coach/{flight-plan,rehearsal-runner,audition-plan-card}.tsx` · `components/acting-coach-citations.tsx` (morto) · `app/(interior)/acting-coach/page.tsx`

**Actor Profile**
`lib/profile-types.ts` · `lib/profile-to-markdown.ts` · `lib/get-public-profile.ts` · `lib/template-filler.ts` · `lib/imdb-types.ts` · `lib/showreels/{extract-thumbnail,storage}.ts` · `lib/height-utils.ts` · `lib/prompts.ts` (`IMDB_AUTOFILL_PROMPT` 1195+) · `app/api/profile/autofill/route.ts` · `components/profile/{actor-profile-form,profile-header,profile-live-preview,imdb-autofill}.tsx` · `components/profile/sections/*` (11 seções + `VideoDropzone`) · `components/public-profile/*` · `app/(interior)/profile/page.tsx` · `app/actors/{layout.tsx,[slug]/page.tsx,[slug]/index.md/route.ts,[slug]/not-found.tsx}`

**Infra transversal**
`proxy.ts` (tier gating) · `lib/billing.ts` · `firestore.rules` · `env.example` · `app/api/dna/synthesize/route.ts` (produz o `profile/master` consumido por A e B)
