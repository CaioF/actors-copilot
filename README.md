# The Actor's Copilot

An AI-powered self-tape audition preparation platform that extracts an actor's psychological "Personal DNA" through Socratic questioning, synthesizes a Master Profile, and generates personalized audition coaching.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Front-End Architecture](#front-end-architecture)
- [API & Backend Routes](#api--backend-routes)
- [Database & Data Models](#database--data-models)
- [AI/ML Architecture](#aiml-architecture)
- [Prompt Engineering](#prompt-engineering)
- [Authentication & Security](#authentication--security)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Configuration](#configuration)
- [Actor Profile Page](#actor-profile-page)
- [Sidebar Navigation](#sidebar-navigation)
- [Profile Components](#profile-components)
- [ActorProfile Schema](#actorprofile-schema)
- [Acting Coach](#acting-coach)

---

## Tech Stack

| Category | Technology | Version |
|----------|------------|---------|
| **Framework** | Next.js | 16.1.6 |
| **UI Library** | React | 19.2.4 |
| **Language** | TypeScript | 5.x |
| **Styling** | Tailwind CSS | 4.2.0 |
| **Component Primitives** | Radix UI | Latest |
| **Component Library** | shadcn/ui | - |
| **State Management** | React Context + Custom Hooks | - |
| **Auth** | Firebase Auth | 11.3.0 |
| **Database** | Firebase Firestore | 11.3.0 |
| **AI** | Google Gemini (@google/genai) | 1.48.0 |
| **Forms** | React Hook Form + Zod | 7.54.1 / 3.24.1 |
| **JWT** | jose | 6.2.1 |
| **Icons** | Lucide React | 0.564.0 |
| **Package Manager** | pnpm | - |
| **Testing** | Jest | 30.3.0 |
| **Deployment** | Vercel | - |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Client                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ React 19    │  │ Next.js App  │  │ Firebase Auth     │   │
│  │ Components  │  │ Router       │  │ (Google/Email)    │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Next.js Server                            │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Route       │  │ API Routes   │  │ Firebase Admin   │   │
│  │ Handlers    │  │ /api/dna/*   │  │ (Server-side)    │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│   Firebase Firestore    │  │   Google Gemini AI      │
│   (User Data Storage)   │  │   (Vertex AI)            │
└─────────────────────────┘  └─────────────────────────┘
```

### Key Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/login` | Public authentication |
| `/dashboard` | Main authenticated hub |
| `/chat` | Standalone AI chat |
| `/personal-dna` | Actor personality/profile builder entry |
| `/profile` | Actor's professional profile form |
| `/auditions` | Audition management list |
| `/auditions/new` | Multi-step audition wizard |
| `/auditions/[id]` | Audition detail view |
| `/settings` | User settings & account management |
| `/acting-coach` | AI Acting Coach with RAG-powered responses |

---

## Project Structure

```
actors-copilot/
├── app/                          # Next.js App Router
│   ├── (interior)/               # Route group for authenticated pages
│   │   ├── auditions/
│   │   │   ├── [id]/page.tsx    # Audition detail
│   │   │   ├── new/page.tsx     # Create audition
│   │   │   └── page.tsx         # Auditions list
│   │   ├── dashboard/page.tsx   # Dashboard
│   │   ├── personal-dna/page.tsx
│   │   ├── profile/
│   │   │   └── page.tsx         # Actor profile (244 lines)
│   │   ├── settings/page.tsx
│   │   └── layout.tsx           # Authenticated layout
│   ├── api/                     # Route Handlers
│   │    auditions/
│   │   │   ├── analyzeSides/    # Extracts performance notes from script pages
│   │   │   └── analyzeBrief/    # Extracts chronological workflows from casting notes
│   │   ├── auth/callback/
│   │   ├── auth/logout/
│   │   └── dna/
│   │       ├── baseline/
│   │       ├── chat/
│   │       ├── synthesize/
│   │       └── transcribe/
│   ├── chat/page.tsx
│   ├── login/page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                      # 56 shadcn/ui components
│   ├── auditions/               # Audition wizard components
│   |   ├── audition-wizard.tsx  # Multi-step wizard container
│   └── step/                    # Wizard steps
│       ├── step-upload.tsx      # File upload (PDF/DOCX)
│       ├── step-basic.tsx       # Project/role info
│       ├── step-review.tsx      # Review before submission
│       ├── step-generating.tsx  # AI processing state
│       ├── step-result.tsx      # V1 Results display (Sides)
│       └── step-result-brief.tsx # Dynamic AI JSON renderer (Briefs)
│   ├── profile/                  # Profile page components
│   │   ├── profile-header.tsx
│   │   ├── actor-profile-form.tsx
│   │   ├── profile-live-preview.tsx
│   │   └── sections/           # 11 form sections
│   ├── chat-input.tsx
│   ├── chat-messages.tsx
│   ├── ai-thinking-block.tsx
│   ├── app-sidebar.tsx         # Sidebar navigation
│   └── ...
├── lib/
│   ├── context/
│   │   ├── AuthContext.tsx     # Firebase auth + Kajabi
│   │   └── ProtectedRoute.tsx
│   ├── firebase.ts             # Client SDK
│   ├── firebase.admin.ts       # Server SDK
│   ├── prompts.ts              # AI prompt templates
│   ├── questions.ts            # Question bank
│   ├── profile-types.ts        # ActorProfile schema
│   └── ...
├── hooks/
│   ├── use-chat.ts             # Chat state management (545 lines)
│   ├── use-mobile.ts
│   ├── use-toast.ts
│   └── use-loading-text.ts     # Loading text hook
└── firestore.rules
```

---

## Front-End Architecture

### Component Hierarchy

The application uses **shadcn/ui** style component patterns with Radix UI primitives:

```
components/ui/          # 56 reusable primitives (button, dialog, form, etc.)
├── button.tsx          # CVA-based with variants
├── dialog.tsx
├── drawer.tsx
├── form.tsx
├── input.tsx
├── tabs.tsx
└── ...

components/
├── auditions/
│   ├── autition-wizard.tsx    # Multi-step wizard container
│   └── step/                  # Wizard steps
│       ├── step-upload.tsx     # File upload (PDF/DOCX)
│       ├── step-basic.tsx      # Project/role info
│       ├── step-review.tsx    # Review before submission
│       ├── step-generating.tsx # AI processing state
│       └── step-result.tsx    # Results display
├── chat-input.tsx             # Message input with mic support
├── chat-messages.tsx          # Message list with streaming indicator
├── ai-thinking-block.tsx      # "Coach is analyzing..." UI
├── mic-fab.tsx                # Floating action button for mic
└── memory-recording-banner.tsx
```

### State Management

**1. React Context (Global State)**
- `AuthContext` (`lib/context/AuthContext.tsx:36`)
  - User authentication state
  - Login methods: Google OAuth, Email/Password
  - Firebase `onAuthStateChanged` listener

**2. Custom Hooks**
- `useChat` (`hooks/use-chat.ts:38`) - Main chat/DNA state management
  - Manages messages, session, isLoading, streaming
  - Firebase real-time listeners for session and messages
  - 3-attempt retry on AI failure
- `useMobile` - Responsive detection
- `useToast` - Toast notification system

### UI Framework

- **Radix UI** primitives for accessibility
- **Tailwind CSS** for styling
- **class-variance-authority (CVA)** for component variants
- **clsx + tailwind-merge** via `cn()` utility

---

## API & Backend Routes

### Authentication

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/callback` | POST | Firebase token verification + Kajabi purchase validation + JWT session cookie |
| `/api/auth/logout` | POST | Destroy session cookie |

### DNA (Personal DNA Extraction)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/dna/chat` | POST | Dual-agent Socratic conversation (YAN chat + MemListener extraction) |
| `/api/dna/synthesize` | POST | Synthesize DNA extractions into Master Profile (with caching) |
| `/api/dna/baseline` | POST | Upload baseline document (PDF/text) for bulk extraction |
| `/api/dna/transcribe/chat` | POST | Audio transcription for chat input |
| `/api/dna/transcribe/history` | POST | Audio transcription + psychological extraction |

### Auditions

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auditions/analyzeSides` | POST | Synthesize script pages into psychological performance coaching |
| `/api/auditions/analyzeBrief` | POST | Transform unstructured casting emails/PDFs into chronological checklists |

### Profile

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/profile/autofill` | POST | IMDB AI Autofill - scrape IMDB profile and synthesize with DNA |

### Acting Coach

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/coach/chat` | POST | RAG-powered acting coach with conversation history, audition context, and library grounding |

### IMDB AI Autofill Feature

The IMDB AI Autofill feature (`/api/profile/autofill`) allows actors to paste their IMDB URL and auto-fill their profile using Vertex AI synthesis combining IMDB career data with their DNA psychological profile.

**Flow:**
1. User pastes IMDB URL (e.g., `https://www.imdb.com/name/nm0000000/`)
2. Firecrawl API scrapes IMDB page, bypassing AWS WAF JavaScript challenge
3. API fetches actor's DNA profile from Firestore (`users/{userPath}/profile/master`)
4. Vertex AI synthesizes IMDB data with DNA (archetypes, traits, values, influences)
5. Structured data returned to client for merge with existing profile

**Implementation:**
- `app/api/profile/autofill/route.ts` - API route with auth, Firecrawl, Vertex AI
- `app/api/profile/autofill/route.test.ts` - 21 passing tests
- `components/profile/imdb-autofill.tsx` - UI component with loading/success/error states
- `lib/imdb-types.ts` - Firecrawl and ActorProfile types
- `lib/prompts.ts` - `IMDB_AUTOFILL_PROMPT` for Vertex AI synthesis

**Data Extracted:**
- fullName, slug, headshot, additionalPhotos (up to 10)
- bio (AI-synthesized with DNA)
- height, heightUnit, location, gender, nationalities
- awardsCallout, skillsAndAccents
- credits (filmography with categorization)
- showreels (video URLs)

**DNA Enrichment:**
The AI prompt instructs synthesis of career facts with creative DNA for authentic biography.

### Response Pattern

All endpoints follow consistent response patterns:

```typescript
// Success
{ success: true, data: {...} }

// Error
{ error: "Descriptive message" }
```

### Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request / validation |
| 401 | Unauthorized (missing token) |
| 403 | Forbidden (unauthorized path access) |
| 500 | Internal error |

---

## Database & Data Models

### Firestore Collections

```
users/{userPath}/
├── profile/master              # Actor's Master Profile
├── masterProfile/current        # Synthesized profile (cached)
├── dnaSessions/{sessionId}/    # DNA session metadata
│   └── messages/              # Chat messages subcollection
├── coachSessions/{sessionId}/  # Acting Coach session metadata
│   └── messages/              # Coach chat messages subcollection
├── auditions/                 # Audition breakdowns
└── dnaVault/                  # Raw DNA extractions (for synthesis)
```

### Key Interfaces

**ChatMessage** (`lib/chat-types.ts:7-13`)
```typescript
{
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Timestamp | null
  section: string
}
```

**DNASession** (`lib/chat-types.ts:20-36`)
```typescript
{
  id: string
  sessionNumber: number
  totalSessions: number
  currentSection: string
  progress: number (0-100)
  status: "active" | "paused" | "completed"
  totalExtractions: number
  sectionHqCounts: Record<string, number>    // Section -> HQ extraction count
  completedSections: string[]
  sectionThemes: Partial<Record<DNASectionId, string[]>>  // Theme tracking
  auditionsUnlocked: boolean
  askedQuestions: string[]
}
```

**CoachSession** (`lib/chat-types.ts:47`)
```typescript
{
  id: string
  createdAt: Timestamp | null
  lastActiveAt: Timestamp | null
  status: "active" | "completed"
  title: string | null
  linkedAuditionId: string | null
  messageCount: number
  sessionFocus: string | null       // Floating focus — in-flight exercise description
  stepIndex: number                 // Model-incremented exercise step
  mode: "guided" | "informational" | "transition" | null
  phase: string | null              // Model-tracked sub-state within the focus
}
```

**CoachMessage** (`lib/chat-types.ts:61`)
```typescript
{
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Timestamp | null
}
```

### Master Profile Schema

Stored in `users/{userPath}/profile/master`:

```typescript
{
  psychology: {
    traits: string[]           // Psychological traits
    defenseMechanisms: string[]
    leafSnippets: Array<{quote: string, section: string, timestamp: string}>
    coreValues: string[]
    relationalDynamics: string[]
    emotionalBaseline: {
      conflictResponse: string
      internalFriction: string
      vulnerabilityManagement: string
    }
    intellectualFramework: {
      cognitiveStyle: string
      attentionToDetail: string
    }
  }
  acting_fuel: {
    coreWounds: string[]
    unmetNeeds: string[]
    publicMasks: string[]
    archetypes: string[]
  }
  history: {
    milestones: Array<{event: string, emotional_cost: string}>
    keyEntities: string[]
  }
  physicality: {
    somaticTells: string[]
  }
  baselineHistory: string
  lastUpdated: Timestamp
}
```

### DNA Sections (12 Total)

| ID | Label |
|----|-------|
| `childhood` | Early Childhood and Home |
| `school_authority` | School, Authority and the Outside World |
| `identity` | Identity and Self-Story |
| `belonging` | Belonging and Exclusion |
| `relationships` | Relationships and Attachment |
| `power` | Power and Authority |
| `shame` | Shame and Self-Worth |
| `loss` | Loss and Change |
| `desire` | Desire and Ambition |
| `joy` | Joy and Vitality |
| `conflict` | Conflict and Pressure |
| `beliefs` | Beliefs and Life Patterns |

### Arena Themes (Extraction Diversity)

Each arena has a predefined set of psychological themes (`ARENA_THEMES` in `lib/chat-types.ts`) that the MemListener agent tags each extraction with. This ensures diverse psychological exploration within each arena.

**Example themes for `shame` arena:**
- `shame_origin` - Where shame first rooted
- `shame_trigger` - Situations that provoke shame
- `shame_coping` - How they manage shame
- `shame_relationships` - How shame affects relationships
- `shame_body` - Physical sensation of shame
- `shame_identity` - How shame defines self-view

See `lib/chat-types.ts` for complete theme taxonomy across all 12 arenas.

### Extraction Diversity Tracking

To ensure meaningful psychological exploration, section completion requires:

1. **Minimum extractions:** 5 high-quality extractions
2. **Theme diversity:** At least 4 unique themes covered

**Progress formula** (`hooks/use-chat.ts`):
- Completed sections: 100% / 12 = 8.33% each
- Incomplete sections: 60% diversity score + 40% count score weighted

**Section completion logic:**
```typescript
const meetsThemeRequirement = uniqueThemes.size >= 4;
const meetsCountRequirement = hqCount >= 5;
const isComplete = meetsCountRequirement && meetsThemeRequirement;
```

**UI:** Progress rings in `components/chat-sidebar.tsx` show extraction progress per section, with hover tooltips displaying explored vs. missing themes.

---

## AI/ML Architecture

### AI Provider

**Google Vertex AI via Firebase AI SDK**
- Model: `gemini-3.1-pro` - Main conversational and analysis
- Model: `gemini-2.5-flash` - Fast transcription

### Dual-Agent Pattern (`app/api/dna/chat/route.ts`)

```
┌─────────────────────────────────────────────┐
│           User Message                       │
└─────────────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
┌───────────────────┐   ┌───────────────────┐
│  Agent 1: YAN     │   │  Agent 2: MEMLIST │
│  (Conversational) │   │  (Extraction)     │
│                   │   │                   │
│  gemini-3.1-pro   │   │  gemini-2.5-pro   │
│  temp: 1          │   │  temp: 0.1        │
│                   │   │                   │
│  Produces next    │   │  Function calling │
│  Socratic question│   │  to update_master │
└───────────────────┘   │  _profile         │
        │               └───────────────────┘
        ▼
┌───────────────────┐
│  Promise.all     │
│  (parallel exec) │
└───────────────────┘
```

### Psychological Extraction Schema

The MemListener agent extracts via `update_master_profile` function:

| Field | Type | Description |
|-------|------|-------------|
| `is_valuable_extraction` | boolean | Whether input has new value |
| `new_traits` | string[] | Discovered traits |
| `defense_mechanisms` | string[] | Behavioral shields |
| `leaf_snippets` | string[] | Impactful verbatim quotes |
| `somatic_tells` | string[] | Physical reactions |
| `core_values` | string[] | Moral baselines |
| `relational_dynamics` | string[] | Power/intimacy patterns |
| `milestones` | Array | Life events with emotional cost |
| `core_wounds_and_fears` | string[] | Psychological scars |
| `unmet_needs` | string[] | Subconscious desires |
| `public_masks` | string[] | Social personas |
| `emotional_baseline` | object | Conflict/vulnerability patterns |
| `archetype_signals` | string[] | e.g., "The Protector" |
| `progress_assessment` | object | depth_score, actionable patterns |
| `themes_extracted` | string[] | Theme tags from ARENA_THEMES taxonomy |
| `diversity_note` | string | Note about thematic diversity of extraction |

### Pivot Engine

Dynamic question routing based on:
- **Frustration detection**: Hard pivot to different topic
- **Mandatory pivot**: Every 10 questions for diversity
- **Momentum check**: Continue or pivot based on depth

### Token Management

- Input bounds: Project name max 150 chars, role max 100 chars
- History truncation: Last 7 messages for context
- Question blacklist: Last 4 questions to prevent repetition

---

## Prompt Engineering

All prompts centralized in `lib/prompts.ts` (1203 lines).

### Prompt Templates

| Prompt | Line | Purpose |
|--------|------|---------|
| `SYSTEM_PROMPT` | 12 | Core "Coach" persona, Socratic rules |
| `SECTION_PROMPTS` | 59-756 | 12 thematic arena directives |
| `SECTION_INTROS` | 763-879 | Introduction messages per section |
| `SYNTHESIZER_PROMPT` | 888 | Master Profile synthesis |
| `AUDITION_COACH_PROMPT` | 993 | V2 Deep character breakdown (DNA Lens) |
| `THEATHER_MODE_PROMPT` | 934 | Theater-specific coaching |
| `COMMERCIAL_MODE_PROMPT` | 961 | Commercial audition coaching |
| `BRIEF_ANALYSIS_PROMPT`| --- | Base orchestrator for Casting Brief JSON extraction |
| `BRIEF_THEATER_PROMPT` | 934 | Theatre-specific directives (Tour schedules, understudies) |
| `BRIEF_COMMERCIAL_PROMPT` | 961 | Commercial directives (Buyout simplification, competitor checks) |
| `BRIEF_CINEMATIC_PROMPT`| --- | TV/Film directives (NDAs, creative village, multi-part slates) |
| `BULK_SYSTEM_PROMPT` | (inline) | Document extraction |

### System Prompt Rules

- Zero-repetition constraint (never ask same question twice)
- Socratic Method focus (ask, don't answer)
- Trauma-informed routing (acknowledge pain, pivot safely)
- Momentum over minutiae (move narrative forward)

### Audition Modes

**Cinematic** (default): Full character analysis with 12 sections. Powered by the V2 Prompt, which forces the LLM to use the actor's DNA Vault as the primary psychological lens (e.g., answering specific mandatory questions about how the actor's core wounds map to the character's tactics).

**Theater** (`lib/prompts.ts:934-959`):
- Physicality & Animal Work
- Spatial Awareness & Fourth Wall
- Vocal Architecture
- Power Dynamics & Turnkey Moment
- Stage Command

**Commercial** (`lib/prompts.ts:961-985`):
- Nugget of Truth (personal connection)
- Turnkey Moment (problem → relief shift)
- Anti-Cliché Tilt ("Care Less" tactic)
- Commercial Whisper (authenticity)

### Brief Injection

The system uses a dynamic injection architecture for Casting Briefs. `BRIEF_ANALYSIS_PROMPT` forces a strict JSON schema and delegates the extraction logic to injected sub-prompts based on the project type:

**Cinematic** (`CINEMATIC_MODE_PROMPT`):
- Focuses on NDA urgency, multi-part slate instructions, and mapping the "Creative Village" (Directors/Showrunners).
- Sides analysis is powered by the V2 Prompt (DNA Lens).

**Theater** (`THEATHER_MODE_PROMPT`):
- Explicit mapping of rehearsal/tour schedules, home-base rules, and multi-character tracking for Understudies/Covers.

**Commercial** (`COMMERCIAL_MODE_PROMPT`):
- Strict extraction of competitor conflicts ("Conflict Checks"), simplified buyout/fee rules, and exact recording restrictions.

---

## Authentication & Security

### Authentication Flow

```
1. User logs in via:
   ├── Google OAuth (Firebase popup)
   └── Email/Password (Firebase)

2. Firebase returns ID token → sent to /api/auth/callback

3. Backend verifies Firebase token
   └── Checks Kajabi purchase via API

4. If valid: JWT signed → HTTP-only cookie set
   └── Redirect to /dashboard

5. API requests: Bearer token (Firebase ID token) in header
   └── Server verifies → checks userPath ownership → processes

6. Logout: Cookie deleted + Firebase signOut
```

### JWT Session Cookie

```typescript
cookieStore.set('kajabi_session', token, {
    httpOnly: true,           // XSS protection
    secure: true,             // HTTPS-only
    sameSite: 'strict',       // CSRF protection
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
});
```

### Security Features

| Feature | Location | Implementation |
|---------|----------|---------------|
| HTTP-only Cookies | `callback/route.ts:71` | Prevents XSS token theft |
| SameSite=Strict | `callback/route.ts:73` | CSRF protection |
| JWT Expiration | `callback/route.ts:65` | 24-hour tokens |
| User Path Validation | `analyze/route.ts:112` | Prevents unauthorized access |
| File Validation | `analyze/route.ts:73-109` | MIME whitelist, 20MB limit |

### Environment Variables (Security Sensitive)

| Variable | Purpose |
|----------|---------|
| `FIREBASE_PRIVATE_KEY` | Firebase Admin SDK |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin SDK |
| `KAJABI_CLIENT_ID` | Kajabi API auth |
| `KAJABI_CLIENT_SECRET` | Kajabi API auth |
| `JWT_SECRET` | Session JWT signing |

### Known Security Considerations

| Issue | Severity | Status |
|-------|----------|--------|
| No rate limiting on auth endpoints | Medium | TODO noted |
| No JWT blacklisting on logout | Low | TODO noted |
| No global auth middleware | Medium | Per-route enforcement |
| Client-side AI execution exposes prompts | Medium | TODO noted |

---

## Error Handling

### Retry Pattern (`hooks/use-chat.ts:320-394`)

```typescript
let attempt = 0;
const maxAttempts = 3;
while (attempt < maxAttempts && !success) {
    try {
        // API call
        success = true;
    } catch (error) {
        attempt++;
        if (attempt < maxAttempts) await new Promise(resolve => setTimeout(resolve, 2000));
    }
}
```

### Firebase Error Mapping (`lib/context/AuthContext.tsx:83-165`)

```typescript
if (error.code === 'auth/popup-closed-by-user') return; // Silent
if (error.code === 'auth/account-exists-with-different-credential')
    throw new Error("This email is already registered...");
```

### Logging Patterns

- Console logging with emoji prefixes for visibility
- Security alerts for unauthorized access attempts
- Toast notifications for user-facing errors
- Native `alert()` for critical blocking errors

---

## Testing

### Testing Framework

- **Jest** (`jest.config.mjs`)
- Test command: `npm test`

### Test Coverage

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `app/api/auth/callback/route.test.ts` | 1+ | Auth callback |
| `lib/chat-types.test.ts` | 31 | ARENA_THEMES, THEME_DISPLAY_NAMES, deduplication logic, diversity-weighted progress, backward compatibility |
| `app/api/profile/autofill/route.test.ts` | 21+ | IMDB autofill |
| Other test files | Various | Auth context, loading text, etc. |

### Test Patterns

| Pattern | Purpose |
|---------|---------|
| `describe()` blocks | Test suites |
| `beforeEach()` | Setup |
| Mocking `@/lib/firebase-admin` | Auth verification |
| Mocking `next/headers` | Cookie access |
| Mocking `jose` | JWT signing |
| Mocking `global.fetch` | Kajabi API calls |

### Test Coverage Areas

| Area | Status |
|------|--------|
| Auth callback | Covered |
| IMDB autofill | Covered |
| Theme taxonomy & display names | Covered |
| Progress calculation with diversity weighting | Covered |
| Backward compatibility | Covered |

### Missing Testing

- No e2e tests (Playwright/Cypress)
- No component tests (React Testing Library)
- No snapshot tests

---

## Configuration

### Environment Variables

**Firebase Client (public):**
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
NEXT_PUBLIC_FIREBASE_DATABASE_ID
```

**Firebase Admin (server-only):**
```
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

**Kajabi Integration:**
```
KAJABI_CLIENT_ID
KAJABI_CLIENT_SECRET
NEXT_PUBLIC_KAJABI_REDIRECT_URI
NEXT_PUBLIC_KAJABI_DOMAIN
KAJABI_REQUIRED_OFFER_ID
```

**Session:**
```
JWT_SECRET
```

### Firebase Singleton Pattern

```typescript
// lib/firebase.ts - Client
export function getDb(): Firestore {
  if (!_db) {
    _db = getFirestore(getApp(), databaseId);
  }
  return _db;
}

// lib/firebase.admin.ts - Server
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
```

---

## Key Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `app/(interior)/profile/page.tsx` | 244 | Actor profile page |
| `components/profile/profile-header.tsx` | 137 | Publish/save controls |
| `components/profile/actor-profile-form.tsx` | 89 | Form container with 11 sections |
| `components/profile/profile-live-preview.tsx` | ~180 | Real-time preview card |
| `lib/profile-types.ts` | 225 | ActorProfile schema + validation |
| `app/api/dna/chat/route.ts` | 266 | Dual-agent Socratic extraction |
| `app/api/dna/synthesize/route.ts` | 123 | Master Profile synthesis |
| `app/api/dna/baseline/route.ts` | 283 | Document upload + extraction |
| `app/api/auditions/analyze/route.ts` | 255 | Audition coaching |
| `app/api/auth/callback/route.ts` | 183 | Auth + Kajabi verification |
| `components/app-sidebar.tsx` | ~130 | Sidebar navigation |
| `lib/prompts.ts` | 1203 | All AI prompts |
| `lib/questions.ts` | 386 | Question bank |
| `hooks/use-chat.ts` | 545 | DNA chat state management |
| `hooks/use-acting-coach.ts` | 363 | Acting Coach hook — Firestore persistence, floating focus |
| `lib/acting-coach/contracts.ts` | 64 | Coach request/response interfaces |
| `lib/acting-coach/build-coach-prompt.ts` | 72 | Prompt composition with focus injection |
| `lib/context/AuthContext.tsx` | 227 | Auth context |

---

## Known TODOs

- Add Zod schema validation for env vars at build time
- Implement rate limiting on auth endpoints
- Cache Kajabi access token
- Add retry mechanism for Kajabi API timeouts
- Migrate AI execution to server-side (security improvement)
- Implement JWT blacklisting on logout

---

## Actor Profile Page

### Route: `/profile`

The Actor Profile page (`app/(interior)/profile/page.tsx`) is a comprehensive form for actors to create and manage their professional profile visible to casting directors and industry professionals.

### Page Architecture

```
app/(interior)/profile/page.tsx (244 lines)
├── useAuth() hook for authentication state
├── useForm<ActorProfile>() with Zod resolver
├── saveDraft() - auto-save with 2s debounce
├── publishProfile() - publishes with status="published"
└── FormProvider
    ├── ProfileHeader (publish/save controls + profile URL)
    ├── ActorProfileForm (left column, scrollable)
    └── ProfileLivePreview (right column, sticky)
```

### Key Features

| Feature | Implementation |
|---------|---------------|
| **Auto-save** | 2-second debounce after form changes |
| **Manual save** | Flushes pending debounce, saves immediately |
| **Publish** | Sets `status: "published"`, adds `publishedAt` timestamp |
| **Slug generation** | Auto-generates URL-safe slug from fullName |
| **Loading state** | Animated loading with rotating text messages |
| **Offline handling** | Graceful fallback when Firestore unavailable |

### Save Status States

```typescript
type SaveStatus = "idle" | "saving" | "saved" | "error";
```

| Status | Visual Indicator |
|--------|-----------------|
| `idle` | No indicator shown |
| `saving` | Spinning loader + "Saving..." |
| `saved` | Cloud icon + "Saved" (clears after 3s) |
| `error` | CloudOff icon + "Save failed" |

### Data Flow

```
User edits form
    ↓
form.watch() triggers
    ↓
debouncedSave() waits 2s
    ↓
saveDraft() → Firestore: actorProfiles/{user.uid}
    ↓
merge: true (preserves existing fields)
```

### Firestore Document

**Path:** `actorProfiles/{user.uid}`

**Save payload:**
```typescript
{
  ...formData,
  status: "draft" | "published",
  lastUpdated: serverTimestamp(),
  publishedAt?: serverTimestamp(),  // Only on publish
}
```

---

## Sidebar Navigation

### File: `components/app-sidebar.tsx`

The sidebar provides authenticated navigation with a clean menu structure.

### Menu Items

```typescript
const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Personal DNA", href: "/chat", icon: MessageCircle },
  { label: "Auditions", href: "/auditions", icon: Monitor },
  { label: "Profile", href: "/profile", icon: User },
  { label: "Settings", href: "/settings", icon: Settings },
]
```

### Sidebar Structure

| Section | Lines | Content |
|---------|-------|---------|
| Logo | 41-54 | Links to /dashboard |
| Quick Actions | 56-78 | New DNA Session, New Audition buttons |
| Menu | 80-115 | Navigation items with active state detection |
| Premium | 119-130 | Upgrade CTA |

### Active State Detection

```typescript
const isActive = pathname === item.href;
```

Active item styling: `bg-[#E8721A]/15 text-[#E8721A]`

### Layout

- **Width:** 220px
- **Height:** Full viewport
- **Background:** `#3D4A3C` (dark green-gray)

---

## Profile Components

### Component Hierarchy

```
components/profile/
├── profile-header.tsx              # Publish/save controls, profile URL
├── actor-profile-form.tsx          # Container for all form sections
├── profile-live-preview.tsx        # Real-time preview card
└── sections/
    ├── photos-section.tsx          # Headshot + additional photos
    ├── basic-info-section.tsx      # Name, age range, location, gender
    ├── physical-details-section.tsx # Height, eyes, hair, ethnicity, etc.
    ├── about-me-section.tsx        # Awards callout, bio
    ├── agent-section.tsx           # Agency contact info
    ├── showreels-section.tsx       # Video reel URLs
    ├── credits-section.tsx         # Film/TV/Stage credits
    ├── training-section.tsx         # Acting training
    ├── external-profiles-section.tsx # 21 platform URLs
    ├── skills-accents-section.tsx   # Skills & accents chips
    └── cv-upload-section.tsx        # PDF CV upload
```

### ProfileHeader (`components/profile/profile-header.tsx`)

**Props:**
```typescript
interface ProfileHeaderProps {
  onPublish: () => void;
  onSave: () => void;
  saveStatus: SaveStatus;
}
```

**Features:**
- Profile URL display with slug: `theactorscopilot.com/actors/{slug}`
- Copy link button with 2s "Copied!" feedback
- Unpublish button (when published → sets status to draft)
- Save status indicator (saving/saved/error)

### ActorProfileForm (`components/profile/actor-profile-form.tsx`)

**11 form sections** wrapped in styled `SectionCard` containers:

| Section | Key Fields |
|---------|------------|
| PhotosSection | headshot (max 5MB), additionalPhotos[] (max 10) |
| BasicInfoSection | fullName*, playingAgeMin/Max, location*, gender* |
| PhysicalDetailsSection | height, heightUnit (imperial/metric), eyeColour*, hairColour*, nationalities[], workPermits[], ethnicity*, appearance[] |
| AboutMeSection | awardsCallout*, bio (max 500 chars) |
| AgentSection | agencyName*, agencyEmail*, agencyWebsite*, agencyPhone*, showContactPublicly |
| ShowreelsSection | {title, url}[] |
| CreditsSection | {category, title, role, year, productionCompany, featured}[] |
| TrainingSection | {category, institution, qualification, years}[] |
| ExternalProfilesSection | 21 platform URL fields (IMDB, Spotlight, etc.) |
| SkillsAccentsSection | skillsAndAccents[] (chip-based) |
| CvUploadSection | cvUrl, cvFilename (PDF only, max 100MB) |

### ImdbAutofill (`components/profile/imdb-autofill.tsx`)

AI Autofill component for importing actor data from IMDB.

**Props:**
```typescript
interface ImdbAutofillProps {
  onSuccess: (data: Partial<ActorProfile>) => void;
}
```

**States:**
- `idle` - Default input form
- `loading` - Spinner + "Importing..." button
- `success` - Check icon + "Profile updated!" (3s auto-reset)
- `error` - Error message + Retry button

**Features:**
- Firebase Auth token for API authentication
- Firecrawl API for IMDB scraping
- Debounced save triggered on success
- URL validation (IMDB format: `/name/nm\d+`)

### ProfileLivePreview (`components/profile/profile-live-preview.tsx`)

**Real-time preview** using `useWatch()` from react-hook-form:

**Watches these fields:**
```typescript
fullName, playingAgeMin, playingAgeMax, location, agencyName
height, eyeColour, hairColour
awardsCallout, bio, credits, skillsAndAccents
showreels, cvUrl, headshot
```

**Preview Sections:**
- Header: Headshot (64x64 circular), name, playing age, location, agency
- Physical Details: Height, eye color, hair color (2-column)
- Awards Callout: Orange award icon + text
- Bio: Biography text
- Credits: Up to 3 featured credits
- Skills: Up to 6 skill pills
- Action Buttons: Showreel, Download CV
- Footer: "View full public profile" link

**Styling:**
- Background: `#3D4A3C`
- Text: `#C7C7C7` (light gray)
- Accent: `#E8721A` (orange)
- Container: Sticky top-8, rounded-2xl

---

## ActorProfile Schema

### File: `lib/profile-types.ts`

### Complete Schema

```typescript
export const actorProfileSchema = z.object({
  // Meta
  slug: z.string(),
  status: z.enum(["draft", "published"]),
  
  // Photos
  headshot: z.string().nullable(),
  additionalPhotos: z.array(z.string()),
  
  // Basic Info
  fullName: z.string().min(1, "Full name is required"),
  playingAgeMin: z.number().nullable(),
  playingAgeMax: z.number().nullable(),
  location: z.string(),
  gender: z.string(),
  
  // Physical Details
  height: z.string(),
  heightUnit: z.enum(["imperial", "metric"]),
  eyeColour: z.string(),
  hairColour: z.string(),
  nationalities: z.array(z.string()),
  workPermits: z.array(z.string()),  // ["UK", "EU", "US", "South Africa", "Other"]
  ethnicity: z.string(),
  appearance: z.array(z.string()),
  
  // About Me
  awardsCallout: z.string(),
  bio: z.string().max(500),
  
  // Agent
  agencyName: z.string(),
  agencyEmail: z.string(),
  agencyWebsite: z.string(),
  agencyPhone: z.string(),
  showContactPublicly: z.boolean(),
  
  // Showreels
  showreels: z.array(z.object({
    title: z.string(),
    url: z.string()
  })),
  
  // Credits
  credits: z.array(z.object({
    category: z.enum(["television", "feature_film", "stage", "commercial", "further"]),
    title: z.string(),
    role: z.string(),
    year: z.string(),
    productionCompany: z.string(),
    featured: z.boolean()
  })),
  
  // Training
  training: z.array(z.object({
    category: z.enum(["television", "feature_film", "stage", "commercial", "further"]),
    institution: z.string(),
    qualification: z.string(),
    years: z.string()
  })),
  
  // External Profiles (21 fields)
  externalProfiles: z.object({ /* 21 platform URL fields */ }),
  
  // Skills
  skillsAndAccents: z.array(z.string()),
  
  // CV
  cvUrl: z.string().nullable(),
  cvFilename: z.string().nullable()
});
```

### Default Values

```typescript
export const defaultActorProfile: ActorProfile = {
  slug: "",
  status: "draft",
  headshot: null,
  additionalPhotos: [],
  fullName: "",
  playingAgeMin: null,
  playingAgeMax: null,
  location: "",
  gender: "",
  height: "",
  heightUnit: "imperial",
  eyeColour: "",
  hairColour: "",
  nationalities: [],
  workPermits: [],
  ethnicity: "",
  appearance: [],
  awardsCallout: "",
  bio: "",
  agencyName: "",
  agencyEmail: "",
  agencyWebsite: "",
  agencyPhone: "",
  showContactPublicly: false,
  showreels: [],
  credits: [],
  training: [],
  externalProfiles: { /* all 21 fields = "" */ },
  skillsAndAccents: [],
  cvUrl: null,
  cvFilename: null
};
```

### Helper Functions

**`generateSlug(name: string): string`**
- Converts name to URL-safe identifier
- Lowercase, removes non-alphanumeric, replaces spaces with hyphens

### Storage Paths

| Data | Path |
|------|------|
| Profile document | `actorProfiles/{user.uid}` |
| Headshot | `profiles/{user.uid}/headshot.{ext}` |
| Additional photos | `profiles/{user.uid}/photos/{index}.{ext}` |
| CV | `profiles/{user.uid}/cv.pdf` |

---

## Acting Coach

### Overview

The Acting Coach (`/acting-coach`) is a free-form conversational AI assistant grounded in a curated acting library. Unlike the Socratic Personal DNA extraction, the Coach answers questions about acting technique, character development, audition prep, and career guidance using retrieval-augmented generation (RAG) over a vector database of acting texts.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Client                           │
│  useActingCoach() hook                                     │
│  ├── POST /api/coach/chat { content, history, auditionId, currentFocus } │
│  ├── Firestore persistence (addDoc + onSnapshot)          │
│  └── Renders coach_reply in chat UI                       │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              /api/coach/chat Route                           │
│  1. Verify Firebase ID token → userPath                    │
│  2. Load actor baseline from Firestore                    │
│  3. Load audition summaries (project, role, date)          │
│  4. Load full audition context if auditionId is provided   │
│  5. Compose prompt with baseline + no-reference guidance + history + currentFocus │
│  6. Generate structured JSON reply via Vertex AI Gemini   │
│  7. Parse JSON envelope → return { aiData: { coach_reply, session_focus, step_index, mode, phase } } │
└─────────────────────────────────────────────────────────────┘
                             │
               ┌─────────────┴─────────────┐
               ▼                           ▼
        ┌──────────────┐          ┌──────────────────────┐
        │ Google Gemini │          │ Firebase Firestore   │
        │ (Generation)  │          │ (Profile + Auditions)│
        │              │          │                      │
        │ gemini-3.1-  │          │ users/{userPath}/    │
        │ pro-preview  │          │   profile/master     │
        │              │          │   /auditions/{id}    │
        └──────────────┘          └──────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `app/api/coach/chat/route.ts` | HTTP endpoint — auth, orchestration, logging |
| `lib/acting-coach/build-coach-prompt.ts` | Composes prompt from baseline, no-reference guidance, history, audition context |
| `lib/acting-coach/application/get-audition-context.ts` | Reads audition summaries from Firestore |
| `lib/prompts.ts` | `ACTING_COACH_SYSTEM_PROMPT` — coach persona and methodology |
| `hooks/use-acting-coach.ts` | Client hook — message state, sendMessage, startNewSession, clearSessionFocus, Firestore persistence |
| `app/(interior)/acting-coach/page.tsx` | Coach UI — welcome bubble, suggestion chips, chat messages, session indicator, focus indicator |
| `components/coach-suggestion-chips.tsx` | Clickable prompt suggestions |
| `scripts/python/ingest_acting_library.py` | Corpus ingestion script |

### Prompt Composition

The coach prompt (`buildCoachPrompt`) assembles these sections in order:

```
# SYSTEM ROLE & PERSONA
(ACTING_COACH_SYSTEM_PROMPT from lib/prompts.ts)
  Modes: guided (≤60 words, one step per turn), informational (factual),
  transition (topic pivot). Explicit boundaries prohibit naming specific
  practitioners and emitting citation markers.

# ACTOR CONTEXT
{actorBaselineSummary from Firestore}

# AUDITION BREAKDOWN
{project, role, performanceMap from selected audition}
(only if auditionId provided)

# ACTOR'S AUDITIONS
{project} — {role} ({id}) per audition

# NO REFERENCE MATERIAL
Gemini-only guidance: answer from general acting craft and actor/audition context;
do not invent source books, quotes, citation numbers, or library references.

# CONVERSATION HISTORY
Actor: message
Coach: message
... (last 20 messages)

# CURRENT FOCUS
Session focus: {sessionFocus}
Step index: {stepIndex}
Mode: {mode}
Phase: {phase}
(only if sessionFocus is set — anchors the model to the in-flight exercise)

# ACTOR'S QUESTION
{current question}
```

### Configuration

**Environment Variables:**

| Variable | Description |
|----------|-------------|
| `ACTING_COACH_GENERATION_MODEL` | Gemini model (e.g., `gemini-2.0-flash`) |
| `GOOGLE_CLOUD_PROJECT` | GCP project (may be required by other Vertex AI features) |
| `GOOGLE_CLOUD_LOCATION` | GCP location (e.g., `us-central1`) |

### Legacy Corpus Ingestion

The Acting Coach chat route no longer uses Pinecone or runtime corpus retrieval. The old Python ingestion script at `scripts/python/ingest_acting_library.py` is retained as legacy tooling only.

**Prerequisites:**
1. Create a Pinecone index with:
   - Model: `llama-text-embed-v2`
   - `field_map: {"text": "text"}`
   - Dimension: 1024
2. Place corpus files in `./book_sources/` (or set `ACTING_COACH_CORPUS_DIR`)

**Run ingestion:**
```bash
cd scripts/python
./venv/bin/pip install pinecone python-dotenv
./venv/bin/python ingest_acting_library.py
```

**Ingestion flow:**
1. Load `book_sources/sources_open.txt`
2. Chunk text (~800 chars, 100 char overlap)
3. Upsert records with `_id`, `text`, `source`, `chunk_index`
4. Pinecone server-side embeds using `llama-text-embed-v2`
5. Smoke-test with a search query

### Conversation Features

| Feature | Implementation |
|---------|----------------|
| **History** | Last 20 messages passed to prompt to maintain context |
| **Audition context** | Summary list of all auditions injected into every prompt |
| **Full audition breakdown** | Loaded on demand when `auditionId` provided |
| **New Session** | `startNewSession()` creates a new Firestore session doc with a fresh UUID |
| **Suggestion chips** | 4 preset prompts: deepen objective, redirect help, spiraling, apply to DNA |
| **Welcome bubble** | Shown when `messages.length === 0` |
| **Session persistence** | Messages and session metadata survive page refresh via Firestore `onSnapshot` |
| **Floating focus** | Model tracks exercise state across turns (`sessionFocus`/`stepIndex`/`mode`/`phase`) |
| **Focus indicator** | Page header shows "Currently working on: {sessionFocus}" with tap-to-clear |
| **Delete Chat Data** | Settings page deletes all `coachSessions` and messages atomically with DNA data |

### Data Flow

```
User types message
    ↓
useActingCoach.sendMessage()
    ↓
POST /api/coach/chat { content, history, auditionId, currentFocus }
    ↓
1. verifyIdToken → userPath
2. getUserAuditionsSummary(userPath, db)
   (gracefully degrades if Firestore unavailable)
3. getAuditionFullData(userPath, auditionId, db) when auditionId is provided
4. buildCoachPrompt({ actorBaseline, excerpts: [], history, auditionSummaries, currentFocus })
5. Gemini generateContent(prompt)
6. Parse JSON envelope → defensive fallback on malformed JSON
7. return { aiData: { coach_reply, session_focus, step_index, mode, phase } }
    ↓
useActingCoach writes assistant message + updates session doc (lastActiveAt, messageCount, focus fields)
    ↓
onSnapshot fires → UI renders new message bubble from Firestore
```

### Privacy

Conversation history is persisted to Firestore (see [Firestore Persistence](#firestore-persistence) above). Message history sent with each request is capped at 20 messages. Audition data is read from Firestore but never written by the Coach. Citation markers and practitioner attributions are suppressed in model output via prompt constraints. Previously stateless (v1); session persistence was added in the acting-coach-session-persistence plan.
