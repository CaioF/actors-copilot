# DNA / Chat Engine — Relatório Técnico de Regras de Negócio

**Projeto:** The Actor's Copilot (`/workspace/projects/Caio/actors-copilot`)
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Firebase Firestore · Firebase AI (`firebase/ai`) sobre Vertex AI (Gemini)
**Escopo:** todos os arquivos listados na tarefa, mais os descobertos por grep (`lib/pivot-logic.ts`, `app/api/coach/updateDna/route.ts`, `components/auditions/audition-wizard.tsx`, `hooks/use-acting-coach.ts`, `hooks/use-chat-time-tracker.ts`, `firestore.rules`).
**Método:** leitura integral de `lib/prompts.ts` (1473 linhas), rotas de API, hooks e componentes. **O código é a fonte de verdade**; divergências com o `README.md` estão na §9.

> Marcadores usados: `[CÓDIGO MORTO]` = exportado mas sem consumidor de produção; `[ORFÃO]` = consumido apenas por testes; `[INCONSISTÊNCIA]` = divergência entre partes do próprio código.

---

## 0. Sumário executivo

O fluxo "Personal DNA" é um pipeline de **dois agentes** chamado a cada mensagem do ator:

1. **YAN / "The Coach"** — modelo conversacional `gemini-3.1-pro-preview`, responde de forma **bloqueante** com a próxima pergunta socrática (`app/api/dna/chat/route.ts:200-217, 255-257`).
2. **MEMLISTENER** — modelo `gemini-2.5-pro` com *function calling*, roda **em background** via `after()` (`app/api/dna/chat/route.ts:205-209, 260-315`) e grava extrações psicológicas direto em `users/{userPath}/profile/master`.

O "Master Profile" canônico descrito em `SYNTHESIZER_PROMPT` (o **UAP — Unique Actor Profile**) **nunca é gerado no fluxo principal**: `POST /api/dna/synthesize` lê a subcoleção `users/{userPath}/dnaVault` (`app/api/dna/synthesize/route.ts:44`), que **não é escrita por nenhum arquivo de produção** (`[INCONSISTÊNCIA]` crítica — §4 e §7). Na prática, o "Vault" exibido em `/dna-vault` é um *parse* direto do `profile/master` bruto (`app/(interior)/dna-vault/page.tsx:73-101` → `lib/dna/dna-parser.ts:49`).

O progresso de sessão exibido no cliente (barras, conclusão de seção, desbloqueio de audições) é **inatingível**, porque depende de `responseData.aiData.extractions`, que a rota sempre devolve como `null` (`app/api/dna/chat/route.ts:319-325`), enquanto todo o cálculo de progresso está dentro de `if (aiExtractions)` (`hooks/use-chat.ts:569-641`).

---

## 1. O modelo de DNA

### 1.1 Duas taxonomias coexistindo: 12 arenas × 4 capítulos

**12 arenas** — `DNA_SECTIONS` (`lib/chat-types.ts:80-93`):

| # | `id` | `label` |
|---|------|---------|
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

**4 capítulos** — `DNA_CHAPTERS` (`lib/chat-types.ts:110-147`). São **a unidade real de navegação da UI** (`app/chat/page.tsx:42, 57-70`, `components/chat-sidebar.tsx:287-333`):

| `id` | Título | Arenas | `unlockReward` |
|------|--------|--------|----------------|
| `chapter_1` | Foundation & Persona | `identity`, `childhood`, `beliefs` | 🚀 Unlocks AI Audition Prep & Acting Coach |
| `chapter_2` | World & Relational Power | `school_authority`, `belonging`, `relationships`, `power` | 🎭 Unlocks Subconscious Archetype & Dynamic Character Matching |
| `chapter_3` | Inner Shadow & Vulnerability | `shame`, `loss`, `conflict` | 🔥 Unlocks High-Stakes Emotional Trigger Analysis |
| `chapter_4` | Core Fuel & Creative Drive | `desire`, `joy` | 👑 Unlocks Master DNA Profile & Full Vault Synthesis |

> `[INCONSISTÊNCIA]` O `activeSection` enviado à API é sempre um **capítulo** (`app/chat/page.tsx:42`, `hooks/use-chat.ts:740-743`), não uma arena. Logo `SECTION_PROMPTS[currentSection]` cai no fallback `SECTION_PROMPTS['identity']` apenas para ids desconhecidos; para `chapter_*` usa o prompt do capítulo (`app/api/dna/chat/route.ts:40`). Os 12 prompts de arena (`identity`, `childhood`, …) são **efetivamente código morto no fluxo atual**.

### 1.2 Categorias do Vault (a camada de exibição) — 4 categorias

Definidas em `components/dna-vault/DnaVaultGrid.tsx:22-39` (`CATEGORY_CONFIG`) e replicadas na lógica de completude de `lib/dna/dna-parser.ts:313-318`:

1. `Core Traits & Persona`
2. `Values, Motivations & Emotional Reservoirs`
3. `Communication & Vocal Dynamics`
4. `Physicality & Instincts`

`DnaAttribute` = `{ id, name, category, strength?, description?, tags?[] }` (`components/dna-vault/DnaVaultGrid.tsx:9-16`). `strength` é um número 0..1 exibido como barra percentual em `components/dna-vault/AttributeRow.tsx:6-18`.

### 1.3 Taxonomia de temas controlados (`ARENA_THEMES`) — 63 temas

`lib/chat-types.ts:155-243`. Cada arena tem 5–6 temas; `relationships` e `childhood` e `shame` têm 6, as demais 5 (total **63**). `THEME_DISPLAY_NAMES` (`lib/chat-types.ts:250-328`) dá o label humano (mais `novel_theme: "Novel Theme"`). Exemplos: `identity` → `self_narrative, core_traits, values_anchor, public_vs_private, growth_narrative`; `shame` → `shame_origin, shame_trigger, shame_coping, shame_relationships, shame_body, shame_identity`.

> `[INCONSISTÊNCIA]` `themes_extracted` **não existe** no schema de function calling (`lib/dna/extraction/extraction-tool-schema.ts`) e um teste **exige a ausência**: `expect(paramKeys).not.toContain('themes_extracted')` (`lib/dna/extraction/extraction-tool-schema.test.ts:19-24`). Portanto o MEMLISTENER não tem como devolver temas; a taxonomia só alimenta ferramentas de UI e o motor de pivô (`lib/pivot-logic.ts:134-151`), que na prática nunca recebe dados (`[INCONSISTÊNCIA]` — §3 e §8).

### 1.4 Constantes e prompts exportados por `lib/prompts.ts`

| Constante/Função | Linhas | Papel |
|---|---|---|
| `SYSTEM_PROMPT` | `21-62` | Persona "The Coach", regras socráticas, zero-repetição, validação de segurança |
| `SECTION_PROMPTS` (Record, 16 chaves) | `69-472` | Diretivas por arena **e** por capítulo (`chapter_1..4`) |
| `SECTION_INTROS` (Record, 18 chaves) | `479-619` | Mensagens de abertura injetadas na UI; inclui `sensory_anchors` e `boundaries_ethics` |
| `SYNTHESIZER_PROMPT` | `628-671` | Sintetiza extrações no **UAP / Master Profile** (JSON estrito) |
| `THEATHER_MODE_PROMPT` | `674-699` | Modo teatro (audição) |
| `COMMERCIAL_MODE_PROMPT` | `701-737` | Modo comercial (audição) |
| `getAuditionCoachPrompt(isStandalone, projectType?, breakdownDepth?)` | `745-1078` | Breakdown de 21 seções (cinematic completo), 6 seções (quick/commercial) |
| `BRIEF_ANALYSIS_PROMPT` | `1080-1103` | Orquestrador de casting brief |
| `BRIEF_CINEMATIC_PROMPT` | `1105-1129` | Diretivas TV/Film |
| `BRIEF_THEATER_PROMPT` | `1131-1155` | Diretivas teatro |
| `BRIEF_COMMERCIAL_PROMPT` | `1158-1193` | Diretivas comercial |
| `IMDB_AUTOFILL_PROMPT` | `1195-1280` | Biografia pública + DNA |
| `ACTING_COACH_SYSTEM_PROMPT` | `1282-1420` | Acting Coach geral (RAG); define `trigger_dna_extraction` |
| `CHARACTER_COACH_SYSTEM_PROMPT` | `1427-1473` | Character Coach (persona Tracey Collis), 10 estágios |

Os únicos diretamente usados pelo motor de DNA são `SYSTEM_PROMPT`, `SECTION_PROMPTS`, `SECTION_INTROS` (via `hooks/use-chat.ts:20`) e `SYNTHESIZER_PROMPT`.

### 1.5 Mapeamento extração bruta → `profile/master`

O MEMLISTENER emite (schema de `lib/dna/extraction/extraction-tool-schema.ts:3-111`) e a rota grava com `FieldValue.arrayUnion` em **dot-paths** (`app/api/dna/chat/route.ts:278-299`):

| Campo da função `update_master_profile` | Tipo | Destino Firestore |
|---|---|---|
| `is_valuable_extraction` | boolean | (não persistido) |
| `new_traits[]` | string[] | `psychology.traits` |
| `defense_mechanisms[]` | string[] | `psychology.defenseMechanisms` |
| `leaf_snippets[]` | string[] | `psychology.leafSnippets` (`{quote, section, timestamp}`) |
| `holistic_analysis` | string | `psychology.analysisTimeline` (`{inference, section, timestamp}`) |
| `somatic_tells[]` | string[] | `physicality.somaticTells` |
| `core_values[]` | string[] | `psychology.coreValues` |
| `relational_dynamics[]` | string[] | `psychology.relationalDynamics` |
| `milestones[]` | `{event, emotional_cost}[]` | `history.milestones` (+ `section`, `discoveredAt`) |
| `core_wounds_and_fears[]` | string[] | `acting_fuel.coreWounds` |
| `unmet_needs[]` | string[] | `acting_fuel.unmetNeeds` |
| `public_masks[]` | string[] | `acting_fuel.publicMasks` |
| `archetype_signals[]` | string[] | `acting_fuel.archetypes` |
| `key_entities_and_arenas[]` | string[] | `history.keyEntities` |
| `emotional_baseline{conflict_response, internal_friction, vulnerability_management}` | object | **Não gravado** pela rota de chat (`[INCONSISTÊNCIA]`); gravado por baseline/transcribe em `psychology.emotionalBaseline.*` |
| `intellectual_framework{cognitive_style, attention_to_detail}` | object | idem acima |
| `progress_assessment{has_actionable_pattern, depth_score}` | object (required) | usado só como *quality gate*, não persistido |

O schema tem **17 propriedades de topo**; apenas `progress_assessment` é `required` (`lib/dna/extraction/extraction-tool-schema.ts:106-109`).

### 1.6 O "Master Profile" sintetizado (UAP) — schema de saída

`SYNTHESIZER_PROMPT` (`lib/prompts.ts:628-671`) define o JSON exato que o sintetizador deve devolver:

```
actor_summary                       (string, 3 frases)
ai_coaching_manual {
  communication_style, resistance_markers, breakthrough_tactics
}
emotional_transference_map {
  core_driver, usable_triggers[3-4], emotional_dead_zones[]
}
relationship_blueprints {
  handling_authority, handling_intimacy, handling_conflict
}
physical_instrument {
  default_armor, involuntary_tells[]
}
performance_traps[]  (3 avisos)
```

Diretivas textuais do prompt (`lib/prompts.ts:633-637`): (1) construir o "coaching manual" de como o cérebro do ator funciona; (2) mapear a "transferência" de relacionamentos reais; (3) identificar as "Performance Traps" (onde o ator vai *fingir*); (4) inferir profundidade em "Usable Triggers" e "Dead Zones". O input declarado é um array JSON de extrações com `emotional_baseline`, `intellectual_framework`, `milestones`, `instrument_dna`, `behaviours`, `themes` — nomes que **não batem** com os campos reais gravados (`[INCONSISTÊNCIA]`; ver §4).

### 1.7 Completude do Vault

`lib/dna/dna-parser.ts:305-333`:
- Se `profile/master.completion` ∈ (0,1] ou `dnaCompletion` existir, usa o valor.
- Senão: **4 categorias × 25%**, meta de **8 traits por categoria**; `completion = clamp(Σ min(count/8,1)·0,25, 0.05, 1)`.
- O resumo (`aiSummary`) cai em cascata: `aiSummary` → `baselineSummary` → últimas 3 `analysisTimeline` → top 5 traits → texto padrão (`lib/dna/dna-parser.ts:289-303`).
- `totalChatSeconds` vem de `profile/master.totalChatSeconds` (incrementado por `hooks/use-chat-time-tracker.ts:57-61`) ou `totalChatDurationSeconds`.

`[INCONSISTÊNCIA]` de camadas: `lib/dna/dna-parser.ts:1` importa `DnaAttribute` de um **componente React** (`@/components/dna-vault/DnaVaultGrid`), invertendo a direção de dependência.

---

## 2. Regras conversacionais (YAN / "The Coach")

### 2.1 Persona

O prompt **não usa o nome "YAN"** — a persona declarada é `"The Coach"` (`lib/prompts.ts:23`). "YAN" aparece apenas em comentário/JSDoc da rota (`app/api/dna/chat/route.ts:11-14, 199`). Caracterização: "perceptive investigator inside The Actor's Copilot", que fala como "a brilliant, highly perceptive human in a normal conversation" (`lib/prompts.ts:23-24`). Objetivo declarado: "extract profound, behavioral, and psychological truths… mining raw human material" (`lib/prompts.ts:24`).

### 2.2 Regras mestras (MASTER RULES) — `lib/prompts.ts:26-35`

| # | Regra | Implicação |
|---|-------|-----------|
| 1 | **PSYCHOLOGICAL FLUIDITY** | Conversa natural; **não repetir a resposta do usuário** |
| 2 | **ZERO REPETITION & PIVOTING** | Nunca repetir pergunta ou variação; se vago/"não lembro", não insistir — pivotar de rota |
| 3 | **MOMENTUM OVER MINUTIAE** | Extraído o "core trigger", avançar |
| 4 | **EXPOSE THE CONTRADICTIONS** | Desafiar racionalizações com cirurgia, sem acusar |
| 5 | **THE UNRELIABLE NARRATOR (SPOT THE LIE)** | Não confiar; nunca chamar de mentiroso; perguntar o que a insegurança esconde |
| 6 | **THE SOMATIC ANCHOR** | Forçar reviver sensorialmente (5 sentidos), não coreografia do evento |
| 7 | Não parafrasear/resumir o input do usuário |
| 8 | **THE SAFETY VALVE** | Frase textual de saída segura: *"Is this getting too heavy for you? Please feel free to end the session and come back whenever you feel more comfortable."* Priorizar bem-estar sobre extração |
| 9 | **ACCESSIBLE & GROUNDED LANGUAGE** | Proibido vocabulário acadêmico/pretensioso |

### 2.3 Algoritmo por resposta — `lib/prompts.ts:40-44`

`THE ANCHOR` (ouvir e achar emoção/ferida) → `THE ALIGNMENT` (escolher a "Follow-up Route") → `THE CONTRADICTION CHECK` (se resposta polida/intelectualizada, ativar a contradição da rota) → `THE PIVOT` (se rota esgotada ou ego travado, mudar de rota).

### 2.4 Tom / metodologia socrática — `lib/prompts.ts:46-52`

- "SOCRATIC MIRROR": não repetir, não validar, não dar conselhos de vida; só perguntas profundas.
- Nunca dar respostas ou *life advice*.
- Exigir respostas longas, detalhadas, sensoriais.
- Tratar toda justificativa como potencial encobrimento.

### 2.5 Restrições duras e formato — `lib/prompts.ts:54-61`

- Proibido repetir; proibido parafrasear.
- **OUTPUT TEXT ONLY** — sem JSON, sem resumos, sem interpretações.
- Explorar novas experiências; não travar no mesmo momento.

### 2.6 Segurança / limites emocionais

- **Safety valve** (regra 8, `lib/prompts.ts:34`).
- **Protocolo de grounding** acionado por frase-gatilho exata: `content.includes("Please help me ground myself and close the session.")` → ordem para **cessar toda extração**, validar, guiar exercício sensorial (5-4-3-2-1 ou respiração) e encerrar (`app/api/dna/chat/route.ts:91, 103-111`). O botão "End Session" da UI envia exatamente essa frase (`app/chat/page.tsx:195-199`).
- `shouldExtract` desliga o MEMLISTENER em end/skip/resume (`app/api/dna/chat/route.ts:260`).

### 2.7 Idioma

Regra única e explícita no topo do system prompt: `"Answer with the same language as the user's latest input."` (`lib/prompts.ts:22`). (O `CHARACTER_COACH_SYSTEM_PROMPT` é a exceção: força *British English*, `lib/prompts.ts:1428`.)

### 2.8 Sequenciamento de perguntas e injeção dinâmica

A rota **não usa tool calling para o YAN** — ela injeta um `dynamicCommand` textual conforme flags (`app/api/dna/chat/route.ts:86-160`):

| Condição | Diretiva |
|---|---|
| `isEndSession` | INITIATE GROUNDING PROTOCOL (`104-111`) |
| `isShort` (input < 15 chars) e `!pivotFlag` | Instigar profundidade, não aceitar resposta curta (`112-116`) |
| `isSkipCommand` ∈ {`"Pass"`, `"Change the subject, next question"`} | Pivotar imediatamente, não perguntar por quê (`117-123`) |
| `isMandatoryPivot` | **Sempre `false`** (`88`) — o desvio obrigatório nunca dispara |
| `pivotFlag === true` | THEME EXHAUSTION DETECTED — considerar pivotar (`128-132`) |
| `isResumeSessionContinue` (`"Pick up where I left off"`) | Boas-vindas + retomar (`133-140`) |
| `isResumeSessionNew` (`"Start something new"`) | Boas-vindas + rota nova (`141-148`) |
| `isFirstIdentityResponse` (`currentSection==='identity'` e sem perguntas) | **BASELINE GATEKEEPER**: exigir idade + local + elevator pitch (`149-156`) |
| default | MOMENTUM CHECK: uma pergunta; pivotar se esgotado (`157-159`) |

O prompt final concatena: diretiva de seção + `baselineContext` (resumo do baseline) + **blacklist** de perguntas + estado + diretiva + eventual aviso de documento anexado (`app/api/dna/chat/route.ts:162-185`).

**Anti-repetição:** `previouslyAsked.slice(-6)` vira lista `Prior AI Question: "..."` que o modelo é "STRICTLY FORBIDDEN from repeating" (`app/api/dna/chat/route.ts:42-45, 168-170`). O cliente alimenta `askedQuestions` com **o texto integral da resposta da IA** (`selectedQuestions: [aiResponseText]`, `app/api/dna/chat/route.ts:324`; acumulado em `hooks/use-chat.ts:679`).

**Limites de rodada/turno:**
- Pivô automático (cliente) quando `questionCounter >= 15`, ou repetição de tema ≥3 na janela de 5, ou <4 temas únicos com janela cheia (`lib/pivot-logic.ts:18-23, 62-96`).
- Sem limite de sessões/rodadas no código; `sessionNumber: 2` e `totalSessions: 7` são **defaults hardcoded** (`hooks/use-chat.ts:177-178, 260-267`).
- `DEFAULT_SESSION_ID = "session-1"` (`hooks/use-chat.ts:33`).

### 2.9 Quando a síntese é acionada

**Não há gatilho automático.** A única chamada a `/api/dna/synthesize` em produção é o wizard de audição (`components/auditions/audition-wizard.tsx:309`, "STAGE 1: SMART DNA SYNTHESIS"), antes de gerar o breakdown. A página `/dna-vault` **não** chama síntese. O `ACTING_COACH_SYSTEM_PROMPT` define `action: {type: "trigger_dna_extraction"}` (`lib/prompts.ts:1364-1376`), mas isso executa `POST /api/coach/updateDna`, não a síntese.

---

## 3. Pipeline de extração

### 3.1 Schema de function calling

`EXTRACTION_FUNCTION_DECLARATION` (`lib/dna/extraction/extraction-tool-schema.ts:3-111`), função `update_master_profile`; wrapper `EXTRACTION_TOOL = { functionDeclarations: [ ... ] }` (`113-115`). Descrição: extrair **apenas** dados novos; não extrair se o usuário repete, faz small talk ou é superficial (`4-5`). `leaf_snippets` deve conter citações **verbatim** (`23-27`). `somatic_tells` é explicitamente "Crucial for acting" (`32-36`). `archetype_signals` são "whispers, not headlines" (`90-94`). `progress_assessment.depth_score` é 0–10 (`100-107`).

### 3.2 Como o MEMLISTENER é invocado

`app/api/dna/chat/route.ts:204-209` (modelo), `219-233` (prompt), `260-315` (execução):

- Modelo `gemini-2.5-pro`, `temperature: 0.1`, `tools: [EXTRACTION_TOOL]`, backend Vertex **central** (`aiCentral`).
- Contexto: **últimas 7 mensagens** (`history.slice(-7)`, linha `219`) + o input mais recente entre aspas.
- A instrução textual repete a regra de "silent psychological profiler" e manda devolver `progress_assessment.has_actionable_pattern=false` com arrays vazios se for superficial (`221-233`).
- Executado em `after(backgroundTask)` se disponível, senão fire-and-forget (`310-314`); erros são engolidos com `console.error` (`305-307`).

### 3.3 Quality gate e persistência

`isHighQuality = has_actionable_pattern === true && depth_score >= 4` (`app/api/dna/chat/route.ts:271-275`). Só então monta `updatePayload` e faz `profileRef.set(..., {merge:true})` (`278-300`). `milestones` e `leaf_snippets` recebem `section` e timestamp ISO (`282-283, 290`). Não há deduplicação explícita no servidor — a única proteção é `arrayUnion` (dedup por igualdade de valor) e a instrução "ONLY NEW" no prompt.

### 3.4 Dedup/merge/confidence — o que realmente existe

| Mecanismo | Onde | Observação |
|---|---|---|
| Dedup exato de arrays | `arrayUnion` (`route.ts:279-297`) | Só remove duplicata idêntica |
| Dedup de temas (cliente) | `hooks/use-chat.ts:586-593` | Filtra por `ARENA_THEMES` + `novel_theme`, dedup intra-array; **bloco inatingível** (ver 3.5) |
| "Confidence" | `progress_assessment.depth_score` | Usado como gate ≥4, **não** é strength por atributo |
| Strength de exibição | `lib/dna/dna-parser.ts:58, 103, 110, …` | Hardcoded por tipo (ex.: trait 0.9, core value 0.95, milestone 0.85) |
| Sem dedup semântico | — | Nenhuma similaridade/embedding no pipeline |

### 3.5 `[INCONSISTÊNCIA]` — a extração nunca chega ao cliente

A rota responde `{ aiData: { coach_reply, extractions: null }, selectedQuestions: [aiResponseText] }` (`app/api/dna/chat/route.ts:319-325`). O cliente (`hooks/use-chat.ts:508-511`) portanto recebe `aiExtractions = null` e `aiAssessment = null`, tornando **inalcançável** todo o bloco `if (aiExtractions)` (`hooks/use-chat.ts:569-641`), que contém: escrita client-side no `profile/master`, contagem de extrações, temas, conclusão de seção, progresso e desbloqueio de audições. Consequência: `progress` cai no fallback `Math.min(totalProgressPercentage || 25, 100)` = **25% fixo** (`hooks/use-chat.ts:677`), `completedSections` permanece vazio e `auditionsUnlocked` nunca é ligado (`643`). O Vault só é populado pelo worker de background do servidor.

### 3.6 Motor de pivô

`lib/pivot-logic.ts`: `ExtractionTracker {currentSection, extractedThemes[], hqExtractionHistory[], questionCounter, pivotFlag}` (`6-12`); thresholds `windowSize 5`, `requiredDiversity 4`, `questionThreshold 15`, `repetitionThreshold 3` (`18-23`). `updateTracker` incrementa `questionCounter` sempre, anexa temas só se `has_actionable_pattern===true`, mantém janela FIFO de 5 e **sempre** zera `pivotFlag` (`125-160`); o chamador recomputa com `shouldTriggerPivot` (`hooks/use-chat.ts:543-554`). Como `themes_extracted`/`has_actionable_pattern` nunca chegam (3.5), **apenas a condição `questionCounter >= 15` pode disparar** na prática.

### 3.7 `[CÓDIGO MORTO]` / `[ORFÃO]`

- `lib/dna/extraction/run-extraction.ts` (`runCoachTriggeredExtraction`) — **`[ORFÃO]`**: referenciado apenas por `lib/dna/extraction/run-extraction.test.ts`. Duplica a lógica da rota, com modelo fixo `gemini-2.5-pro` e `temperature 0.1` (`run-extraction.ts:16-20`).
- `lib/dna/response-shortcuts.ts` (`SECTION_RESPONSE_SHORTCUTS`, `getResponseShortcuts`) — **`[CÓDIGO MORTO]`**: nenhum importador (grep global).
- `lib/questions.ts` (`QUESTIONS`) — **`[CÓDIGO MORTO]`**: nenhum importador; as chaves (`family`, `shame_pride`, `loss_and_change`, `desire_ambition`, `joy_passion`, `conflict_style`, `sensory_anchors`, `boundaries_ethics`) **não batem** com `DNA_SECTIONS` (`lib/questions.ts:22-407` vs `lib/chat-types.ts:80-93`), apesar do comentário em `lib/chat-types.ts:77` exigir alinhamento.
- `SECTION_INTROS.sensory_anchors` e `.boundaries_ethics` (`lib/prompts.ts:604-618`) não têm seção correspondente em `DNA_SECTIONS` nem `SECTION_PROMPTS`.
- `lib/quick-prompts.ts` — só usado pelo Acting Coach (`app/(interior)/acting-coach/page.tsx:10`), não pelo DNA.

---

## 4. Síntese do Master Profile

**Rota:** `POST /api/dna/synthesize` (`app/api/dna/synthesize/route.ts:13-124`).

| Etapa | Comportamento | Linhas |
|---|---|---|
| Auth | `Authorization: Bearer`; `auth.verifyIdToken` | `16-23` |
| Autorização de path | `userPath` deve começar com `${uid}_`, senão **403 + security alert** | `29-32` |
| Leitura do perfil | `users/{userPath}/profile/master` | `35-42` |
| Fonte de dados | `users/{userPath}/dnaVault` ordenado por `timestamp asc` | `44-45` |
| Vazio | **400** `'No DNA extractions found. Complete a session first.'` | `47-49` |
| Cache | Compara `latestExtractionDoc.timestamp` do vault com `profile.lastUpdated`; se `latest <= existing`, devolve `cached: true` | `51-64` |
| Compilação | `[{section, date, extractions}]` por doc | `67-74` |
| Modelo | `gemini-2.5-flash`, `responseMimeType: "application/json"`, `temperature 0.3`, `systemInstruction` = `SYNTHESIZER_PROMPT` | `80-87` |
| Prompt | `"Here is the actor's raw DNA Vault data. Synthesize it exactly as instructed:\n\n" + JSON.stringify(compiledRawData)` | `89` |
| Parse | `JSON.parse`; falha → **502** `'AI returned malformed data.'` | `94-100` |
| Persistência | `profile/master` ← `{status:"synthesis_complete", lastUpdated: ISO, dataPointsAnalyzed, profile: masterProfile}` com `merge:true` (sobrescreve `lastUpdated` como **string**, não Timestamp) | `103-111` |

### 4.1 `[INCONSISTÊNCIA]` crítica — a fonte `dnaVault` nunca é escrita

Grep global por `dnaVault` retorna **apenas leitores/deletores**: `app/api/dna/synthesize/route.ts:44`, `app/(interior)/dna-vault/page.tsx:78-93`, `app/(interior)/settings/page.tsx:335-336`. Nenhum `addDoc`/`set`/`update` em `dnaVault` existe no código de produção. Logo:

1. `POST /api/dna/synthesize` sempre cai no **400** antes de qualquer síntese (salvo dados legados/manuais no console do Firestore).
2. O caller `components/auditions/audition-wizard.tsx:309-318` faz `await dnaResponse.json()` **sem checar `response.ok`**, então o erro é silencioso e o breakdown segue usando o `profile/master` cru (que é o que `analyzeSides` de fato lê: `app/api/auditions/analyzeSides/route.ts:179-187`).
3. O campo `profile` (UAP) definido em §1.6 **não é produzido pelo app**; o `dna-parser` até sabe lê-lo (`lib/dna/dna-parser.ts:216-230`), mas ele não existe.

### 4.2 Formato de input real vs. declarado

O `SYNTHESIZER_PROMPT` declara receber campos `instrument_dna`, `behaviours`, `themes` (`lib/prompts.ts:640`), mas o payload compilado contém `extractions` com a estrutura bruta do MEMLISTENER (`psychology.*`, `acting_fuel.*`, `history.*`, `physicality.*`) — nenhum dos três nomes declarados. `[INCONSISTÊNCIA]` de contrato de prompt.

### 4.3 Caching

A estratégia é *timestamp-based* e **não sobrevive ao bug 4.1**. Como o cache só é avaliado **depois** da checagem de vazio (`47-49`), ele nunca é alcançado. Adicionalmente, compara `lastUpdated` (escrito como `new Date().toISOString()` na síntese, ou `FieldValue.serverTimestamp()` nas extrações) — coerção via `new Date(...)` em `route.ts:41`.

---

## 5. Ingestão de baseline (documento)

**Rota:** `POST /api/dna/baseline` (`app/api/dna/baseline/route.ts:78-351`), multipart (`file` ou `text`).

### 5.1 Tipos aceitos e validações

| Item | Valor | Linhas |
|---|---|---|
| MIME permitidos | `application/pdf`, `text/plain`, `application/msword`, `…wordprocessingml.document` | `103-108` |
| Fallback por extensão | `.doc` / `.docx` aceitos mesmo sem MIME correto | `109-111` |
| Erro | 400 `'Unsupported file type. Please upload PDF, TXT, or DOCX.'` | `112` |
| Tamanho/conteúdo mínimo | `finalContent.trim().length < 50` → 400 `'Content too short for AI analysis.'` | `131-134` |
| Sem arquivo nem texto | 400 `'No content provided'` | `95-97` |

### 5.2 Parsing

- **PDF** via `pdf2json` (`PDFParser(null, 1)` + `getRawTextContent()`), com **timeout de 60 s** via `Promise.race` (`43-69`). Faz `decodeURIComponent` com fallback para o texto bruto (`53-58`).
- **DOCX** via `mammoth.extractRawText({ buffer })` (`119-123`).
- **Texto** via `file.text()` (`124-126`).
- Não há **chunking**: `finalContent` inteiro é enviado em uma única chamada (`282-291`). Não há batching/limite de tokens explícito.

> O modal de UI (`components/history-upload-modal.tsx:117-124`) reutiliza `StepUpload`, cujo `accept` é herdado do componente de audições; a rota aceita `.doc/.docx`, mas o `chat-input.tsx:303` lista `.pdf,.txt,.doc,.docx,.rtf,.md,.markdown`.

### 5.3 Extração em lote

- `BULK_SYSTEM_PROMPT` inline (`143-153`): "elite Psychological Profiler and Dramaturg"; instrui a ser "aggressive and comprehensive", ler nas entrelinhas, identificar Public Masks e **não inventar** dados ausentes.
- Modelo `gemini-2.5-pro`, `temperature 0.2`, `thinkingConfig.thinkingLevel = "MEDIUM"` (`155-159`; `@ts-expect-error` por ser experimental).
- **Schema de função duplicado inline** (`160-279`) — cópia do schema de `extraction-tool-schema.ts` **mais** `baseline_summary` ("cohesive, highly dense 2-to-3 paragraph psychological summary… AI Coach's core memory", `261-264`).
- Persistência (`304-338`): `baselineHistory` (texto integral), `lastUpdated`, `baselineSummary`, e `arrayUnion` em `psychology.*`, `history.milestones` (com `section:"baseline_upload"`), `acting_fuel.*`, `psychology.emotionalBaseline.*`, `history.keyEntities`.
- Retorno: `{success, message, extractionsCount}` (`340-344`).

---

## 6. Voz / transcrição

Há **dois** caminhos de áudio, ambos client-side via `MediaRecorder` + `FileReader` (base64), sem streaming.

### 6.1 `POST /api/dna/transcribe/chat` — apenas transcrição (input do chat)

`app/api/dna/transcribe/chat/route.ts:11-62`: valida Bearer, `gemini-2.5-flash`, `temperature 0.1`, prompt `"Transcribe this audio exactly as spoken. Do not add any conversational filler. Return only the raw text."` (`44-47`). Rejeita texto < 2 chars (`51-53`). Consumido por `components/chat-input.tsx:227-277` (botão de microfone → preenche o textarea; `VoiceWaveform` "Listening..." em `50-68`).

### 6.2 `POST /api/dna/transcribe/history` — transcrição + extração psicológica ("Capture a Memory")

`app/api/dna/transcribe/history/route.ts:54-298`:
1. `gemini-2.5-flash` transcreve; rejeita < 5 chars (`79-96`).
2. `gemini-2.5-pro`, `temperature 0.1`, `thinkingConfig.thinkingLevel = "HIGH"`, schema de função inline **duplicado** (`99-219`).
3. Prompt: "The actor just recorded a raw, spoken memory… extract maximum psychological value. Read between the lines." (`221-227`).
4. Grava `rawMemories` (`arrayUnion {text, timestamp}`) e os mesmos dot-paths do chat, **incluindo** `emotional_baseline` e `intellectual_framework` (`248-290`) — aqui sim, ao contrário da rota de chat.
5. Retorna `{success, text}` (`292`).

UI: `components/memory-recording-banner.tsx:24-90` ("Capture a Memory" / "Memory Saved!"), sem upload de áudio persistido — o áudio só existe em memória até a resposta.

### 6.3 Consumidor do texto

O texto transcrito entra como `content` normal em `sendMessage`, logo os mesmos guard-rails conversacionais se aplicam (`app/api/dna/chat/route.ts`).

---

## 7. Estado / persistência

### 7.1 Caminhos Firestore efetivamente usados

Prefixo padrão: `users/{userPath}/` onde `userPath = ${uid}_${firstName}` (primeiro nome sanitizado `[^a-zA-Z0-9]` → `""`, fallback `"Actor"`): `hooks/use-chat.ts:208-217`, `app/api/dna/chat/route.ts:54-66`, `app/api/dna/baseline/route.ts:300-302`, `app/api/dna/transcribe/history/route.ts:241-243`.

| Caminho | Conteúdo | Escritor(es) | Leitor(es) |
|---|---|---|---|
| `users/{userPath}/profile/master` | Perfil mestre (dot-paths de §1.5, `baselineSummary`, `baselineHistory`, `rawMemories`, `totalChatSeconds`, `lastUpdated`, `profile`/UAP) | `chat/route.ts:299`, `baseline/route.ts:338`, `transcribe/history/route.ts:290`, `coach/updateDna/route.ts:218`, `hooks/use-chat-time-tracker.ts:57-61`, `hooks/use-chat.ts:639`(inatingível), `hooks/use-acting-coach.ts:270-276`, `synthesize/route.ts:111` | `chat/route.ts:73-83` (baselineSummary), `dna-vault/page.tsx:73`, `analyzeSides:179`, `analyzeBrief:158`, `autofill:298`, `coach/chat:61` |
| `users/{userPath}/dnaSessions/{sessionId}` | Metadados da sessão (ver 7.2) | `hooks/use-chat.ts:269, 683-692, 740-743` | `hooks/use-chat.ts:233-239` |
| `users/{userPath}/dnaSessions/{sessionId}/messages` | Mensagens do chat (`{role, content, timestamp, section, attachmentName?}`) | `hooks/use-chat.ts:324, 410, 529, 695, 754` | `hooks/use-chat.ts:306-334` |
| `users/{userPath}/dnaVault/{docId}` | "Raw DNA extractions (for synthesis)" — **nunca escrito** | — | `synthesize/route.ts:44`, `dna-vault/page.tsx:80`, `settings/page.tsx:335` |
| `users/{userPath}/coachSessions/{sessionId}` + `/messages` | Sessões do Acting/Character Coach | `hooks/use-acting-coach.ts:229-256` | — |
| `users/{userPath}/sessions/{sessionId}` | `lastDnaAnalysis` | `app/api/coach/updateDna/route.ts:222-223` | — |

**Exclusão de dados** (`app/(interior)/settings/page.tsx:239-341`): apaga `dnaSessions` + `messages`, `dnaVault`, e `profile/master`.

### 7.2 Campos de `dnaSessions/{sessionId}`

Escritos em `hooks/use-chat.ts:683-692` e `740-743`: `lastActiveAt`, `totalExtractions`, `sectionHqCounts`, `sectionThemes`, `completedSections`, `progress`, `auditionsUnlocked`, `askedQuestions`, `currentSection`.
Defaults na criação: `sessionNumber:2`, `totalSessions:7`, `progress:10`, `durationMinutes:18`, `status:"active"` (`hooks/use-chat.ts:259-268`).

### 7.3 Regras de negócio de completude (constantes)

| Constante | Valor | Onde |
|---|---|---|
| `REQUIRED_THEMES` | 4 | `hooks/use-chat.ts:564` |
| `HQ_EXTRACTIONS_FOR_COMPLETION` | 5 | `hooks/use-chat.ts:565`, `components/chat-sidebar.tsx:172` |
| `TOTAL_CHAPTERS` | 4 | `hooks/use-chat.ts:645` |
| `DIVERSITY_WEIGHT` / `COUNT_WEIGHT` | 0.6 / 0.4 | `hooks/use-chat.ts:646-647` |
| Peso por capítulo | 100/4 = 25% | `hooks/use-chat.ts:651-675` |
| Desbloqueio de audições | `newCompletedSecs.length >= 2` | `hooks/use-chat.ts:643` |
| `depth_score` mínimo p/ HQ | 4 | `hooks/use-chat.ts:548-549, 572-575` |
| Síntese considerada pronta | `status === "synthesis_complete"` | `synthesize/route.ts:104` |

> `[INCONSISTÊNCIA]` `meetsThemeRequirement` é calculado (`hooks/use-chat.ts:596-597`) mas **nunca usado** no `if` de conclusão — a seção completa apenas com `meetsCountRequirement` (`600-602`).

### 7.4 Gating por tier / limites de mensagem

**Não existe nenhum gating de tier ou limite de mensagens no fluxo de DNA.** Verificado por grep de `tier`, `limit`, `quota`, `paywall`, `subscription` em `app/api/dna/*`, `hooks/use-chat.ts`, `components/chat-*.tsx`, `app/chat/page.tsx`, `app/(interior)/dna-vault` e `personal-dna` — zero ocorrências. O único uso de tier é cosmético: `isBusinessClass = user?.tier === "business"` em `components/app-sidebar.tsx:51` (botão de upgrade). As rotas de DNA autenticam, mas não autorizam por plano. `lib/billing.ts:7` define `'free' | 'economy' | 'business'`, mas nenhuma rota de DNA o consulta.

**Segurança de dados:** `firestore.rules` é totalmente permissivo: `allow read, write: if request.auth != null;` para `/{document=**}` (`firestore.rules:6-8`) — qualquer usuário autenticado lê/escreve qualquer `userPath` do cliente. A proteção real é apenas server-side: `synthesize` valida o prefixo do `userPath` (`synthesize/route.ts:29-32`); `chat` deriva `userPath` do token (`chat/route.ts:66`); `baseline` e `transcribe/history` derivam do token (`baseline:300-302`).

### 7.5 Fluxo de sessão no cliente

`useChat(sessionId="session-1")` (`hooks/use-chat.ts:131`) escuta `dnaSessions/{sessionId}` e a subcoleção `messages` via `onSnapshot`; se não houver nenhuma mensagem, injeta `SECTION_INTROS["chapter_1"]` (`323-329`). `changeSection` grava `currentSection` e injeta o intro da seção se ela estiver vazia (`724-762`). O tracker de pivô é espelhado em `localStorage` sob `dna_extraction_tracker_{userPath}_{sessionId}` (`hooks/use-chat.ts:35-61`). A UI filtra mensagens por capítulo (`app/chat/page.tsx:64-70`).

---

## 8. Retry, erros, streaming e inconsistências

### 8.1 Retry

- **Cliente:** `THE RETRY ENGINE` — até **3 tentativas** com **2 s** de espera entre elas (`hooks/use-chat.ts:459-525`). Se todas falharem, grava a mensagem `"I lost my train of thought for a second there. Could you rephrase what you just said?"` (`529-534`). **Não há backoff exponencial nem jitter.**
- **Servidor (`/api/dna/chat`):** sem retry; o worker do MEMLISTENER tem `try/catch` que apenas loga (`305-307`).
- **Baseline:** sem retry; `pdf2json` tem timeout de 60 s (`64-68`).
- **Síntese:** sem retry; erro de parse → 502.

### 8.2 Erros e status codes

| Rota | 400 | 401 | 403 | 500/502 |
|---|---|---|---|---|
| `/api/dna/chat` | payload de documento inválido (`32-38`) | sem Bearer (`24-27`) | — | genérico (`327-331`) |
| `/api/dna/synthesize` | vault vazio (`47-49`) | token ausente (`17-19`) | `userPath` não pertence ao uid (`29-32`) | 500 (`120-123`), 502 parse (`97-100`) |
| `/api/dna/baseline` | sem conteúdo/tipo/tamanho (`96,112,133`) | sem Bearer (`82-84`) | — | `346-351` |
| `/api/dna/transcribe/chat` | sem áudio / curto (`26,52`) | sem Bearer (`15-17`) | — | `57-61` |
| `/api/dna/transcribe/history` | sem áudio / curto (`70,95`) | sem Bearer (`58-60`) | — | `294-298` |

### 8.3 Streaming

**Não há streaming de tokens.** O YAN responde de forma bloqueante (`await chat.sendMessage`, `app/api/dna/chat/route.ts:255`) e o cliente só recebe o JSON completo. `streamingContent` existe no estado (`hooks/use-chat.ts:135`) mas **nunca é populado** (sempre `setStreamingContent("")` em `406` e `711`), então `StreamingBubble` (`components/chat-messages.tsx:275-277`) é inalcançável. A UI usa `AiThinkingBlock` + `TypingIndicator` + textos rotativos `LOADING_TEXTS.ai` ("The Coach is analyzing your response...", `lib/loading-texts.ts:6-14`).

### 8.4 Inconsistências e TODOs consolidados

1. **`dnaVault` nunca escrito** → síntese sempre 400 (§4.1) — quebra o conceito de "Master Profile".
2. **`extractions: null` na resposta** → progresso, conclusão de seção e desbloqueio de audições inatingíveis (§3.5).
3. **`themes_extracted`/`diversity_note` ausentes do schema** (e teste que exige a ausência) → motor de diversidade/pivô cego (§1.3, §3.6).
4. **`SECTION_PROMPTS` de arena não usados** porque a UI envia `chapter_*` (§1.1).
5. **`emotional_baseline`/`intellectual_framework` não persistidos na rota de chat**, mas persistidos em baseline/transcribe/history (§1.5).
6. **`lib/questions.ts` órfão e com chaves divergentes** de `DNA_SECTIONS` (§3.7).
7. **`run-extraction.ts` e `response-shortcuts.ts`** sem consumidores de produção (§3.7).
8. **`meetsThemeRequirement` calculado e ignorado** (§7.3).
9. **`isMandatoryPivot` hardcoded `false`** — o "mandatory pivot" documentado não existe (§2.8).
10. **Schema do tool duplicado 3×** (baseline, transcribe/history, coach/updateDna) além do arquivo canônico — risco de drift.
11. **Sem gating de tier/limite** no DNA (§7.4) e `firestore.rules` permissivo.
12. **Sem streaming** apesar da infra de UI (§8.3).
13. **Sombras de segurança/arquitetura:** `[TODO]` migrar prompt para Remote Config (`lib/prompts.ts:15`); `[TODO]` separar estado volátil de imutável na sessão (`lib/chat-types.ts:28`); `[TODO]` mover execução de IA para server-side — comentário em `hooks/use-chat.ts:393` **obsoleto**, pois a execução já é server-side; o que resta client-side é a escrita no `profile/master` (`hooks/use-chat.ts:605-639`).
14. **`firestore.rules`** comentário admite ser permissivo "for development - tighten for production" (`firestore.rules:5`).
15. Sem testes para os prompts de DNA (`lib/prompts.test.ts` cobre só `ACTING_COACH_SYSTEM_PROMPT`).

---

## 9. README × Código — divergências

Seções "AI/ML Architecture" (`README.md:476-546`) e "Prompt Engineering" (`549-607`), "Database & Data Models" (`309-473`), "Error Handling" (`676-708`).

| Afirmação do README | Código (fonte de verdade) |
|---|---|
| `lib/prompts.ts (1203 lines)` (`README.md:551`) | 1473 linhas |
| Tabela de linhas dos prompts (`README.md:555-568`) desatualizada: `SYSTEM_PROMPT:12`, `SECTION_PROMPTS:59-756`, `SECTION_INTROS:763-879`, `SYNTHESIZER_PROMPT:888`, `AUDITION_COACH_PROMPT:993`, `THEATHER:934`, `COMMERCIAL:961` | Reais: `SYSTEM_PROMPT:21`, `SECTION_PROMPTS:69-472`, `SECTION_INTROS:479-619`, `SYNTHESIZER_PROMPT:628`, `getAuditionCoachPrompt:745`, `THEATHER_MODE_PROMPT:674`, `COMMERCIAL_MODE_PROMPT:701` |
| Modelo main = `gemini-3.1-pro` (`README.md:481`) | `gemini-3.1-pro-preview` (`app/api/dna/chat/route.ts:201`) |
| Dual-agent executado em `Promise.all (parallel exec)` (`README.md:505-508`) | Sequencial: YAN bloqueante (`255`) e MEMLISTENER em `after()` (`310-314`); não há `Promise.all` |
| "Mandatory pivot: Every 10 questions" (`README.md:538`) | `isMandatoryPivot = false` (`route.ts:88`); limiar real = 15, calculado no cliente (`lib/pivot-logic.ts:21`) |
| "History truncation: Last 7 messages" (`README.md:544`) | YAN usa 15 (`route.ts:212`); extração usa 7 (`route.ts:219`); cliente 15 (`use-chat.ts:434`) |
| "Question blacklist: Last 4 questions" (`README.md:545`) | `slice(-6)` (`route.ts:42`) |
| Schema de extração inclui `themes_extracted` e `diversity_note` (`README.md:531-532`) | **Não existem** no schema; teste exige ausência (`extraction-tool-schema.test.ts:19-24`). Existem em `ExtractedPsychData` (`lib/chat-types.ts:373`) — tipo divergente do schema runtime |
| Firestore lista `masterProfile/current` e `dnaVault/` (`README.md:316, 322`) | `masterProfile/current` **não existe** no código; `dnaVault` só tem leitores, nunca é escrito |
| "Completed sections: 100% / 12 = 8.33% each" (`README.md:462`) | 4 capítulos, 25% cada (`use-chat.ts:645-675`); e o bloco é inatingível |
| "Section completion logic … `isComplete = meetsCountRequirement && meetsThemeRequirement`" (`README.md:465-470`) | `meetsThemeRequirement` é calculado mas ignorado no `if` (`use-chat.ts:596-602`) |
| Fluxo de síntese "with caching" (`README.md:232`) | Cache implementado, mas inalcançável porque o vault está sempre vazio (§4.1) |
| Retry "`hooks/use-chat.ts:320-394`" (`README.md:678`) | Faixa real: `459-538` |
| DNA sections com 12 itens (`README.md:423-438`) | Correto em `DNA_SECTIONS`, mas a UI opera por **4 capítulos** (`DNA_CHAPTERS`), não pelas 12 arenas |
| "The Coach" persona e "YAN" | O prompt diz `"The Coach"` (`lib/prompts.ts:23`); "YAN" só existe em JSDoc (`route.ts:11-14, 199`) |

---

## 10. Referência rápida de arquivos

| Arquivo | Papel no motor de DNA |
|---|---|
| `lib/prompts.ts` | Persona, diretivas por arena/capítulo, intros, sintetizador, prompts de audição |
| `lib/chat-types.ts` | `DNA_SECTIONS`, `DNA_CHAPTERS`, `ARENA_THEMES`, `THEME_DISPLAY_NAMES`, tipos de sessão/extração |
| `lib/questions.ts` | Banco de perguntas **órfão** (chaves divergentes) |
| `lib/dna/extraction/extraction-tool-schema.ts` | Schema canônico da função `update_master_profile` |
| `lib/dna/extraction/run-extraction.ts` | Extrator duplicado, só usado por testes |
| `lib/dna/dna-parser.ts` | Converte `profile/master` + `dnaVault` em atributos do Vault e calcula completude |
| `lib/dna/response-shortcuts.ts` | Atalhos de resposta por seção, sem consumidores |
| `app/api/dna/chat/route.ts` | Dual-agent, guard-rails conversacionais, quality gate e persistência |
| `app/api/dna/synthesize/route.ts` | Síntese UAP (quebrada por `dnaVault` vazio) |
| `app/api/dna/baseline/route.ts` | Ingestão PDF/DOCX/TXT em lote |
| `app/api/dna/transcribe/chat/route.ts` | Transcrição para o input |
| `app/api/dna/transcribe/history/route.ts` | Transcrição + extração de "memória falada" |
| `hooks/use-chat.ts` | Estado da sessão, retry, tracker, escrita client-side |
| `lib/pivot-logic.ts` | Thresholds e lógica de pivô por diversidade |
| `hooks/use-chat-time-tracker.ts` | `totalChatSeconds` em `profile/master` |
| `components/dna-vault/*` | Grid de atributos, hero summary, barras de strength |
| `app/(interior)/dna-vault/page.tsx` | Leitura direta de `profile/master` + `dnaVault` |
| `app/chat/page.tsx` | Orquestração da UI, atalhos (skip/resume/end session) |
| `components/chat-input.tsx` | Anexos (base64), microfone, atalho "Update Vault" → `/api/coach/updateDna` |
| `components/memory-recording-banner.tsx` | Captura de memória falada → `/api/dna/transcribe/history` |
| `firestore.rules` | Regra permissiva (`auth != null`) para todo o banco |
