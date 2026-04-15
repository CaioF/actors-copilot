# Feature: Local Extraction Tracker for Smart Pivoting

## Context Summary

### Problem
The current pivot mechanism in `app/api/dna/chat/route.ts` relies on:
1. `isMandatoryPivot` - hardcoded to `false` (the intended `questionCount % 15 === 0` was commented out)
2. `isShort` - active, triggers when user input < 15 chars
3. AI's own judgment via "MOMENTUM CHECK" directive

There is **no deterministic mechanism** to influence when the AI should more heavily consider pivoting based on extraction quality and theme diversity.

### Data Flow Gap
```
hooks/use-chat.ts          →  app/api/dna/chat/route.ts
─────────────────────────  →  ──────────────────────────
• Tracks sectionThemes      →  Receives: content, currentSection,
• Tracks sectionHqCounts      actorName, history, previouslyAsked
• Updates Firestore         →  Does NOT receive: sectionThemes,
                               sectionHqCounts, or any extraction
                               tracking state
```

The extraction data exists at the client level but is never passed to the API route for pivot decisions.

### Proposed Solution
A **fully local** extraction tracker stored as React state in `use-chat.ts` that:
1. Tracks HQ extractions and theme diversity per section
2. Computes a `pivotFlag` when conditions are met
3. Sends `pivotFlag` to the API route to influence the AI to more heavily consider pivoting
4. Resets when the user changes sections

---

## Architecture

### Domain-Driven Design (DDD) Analysis

| Layer | Current Implementation | Proposed Change |
|-------|----------------------|----------------|
| **Domain** | `DNASession` interface tracks `sectionThemes` and `sectionHqCounts` at session level in Firestore; `ARENA_THEMES` taxonomy | **CORRECTION**: Domain types (`ExtractionTracker`, `DEFAULT_THRESHOLDS`, pure functions) now live in `lib/pivot-logic.ts`, NOT in hooks/ |
| **Application** | `use-chat.ts` handles sendMessage, section changes, progress calculation | `use-chat.ts` imports domain types from `lib/`, manages tracker state with `updateTrackerState` wrapper |
| **Infrastructure** | Firestore persistence of `sectionThemes`, `sectionHqCounts` | No Firestore changes - tracker persists to localStorage |
| **Presentation** | Pivot controlled by AI judgment via `dynamicCommand` in API route | Client sends `pivotFlag` to influence `dynamicCommand` selection |

### Test-Driven Development (TDD) Approach

1. **First**: Write unit tests for the tracker logic (pure functions)
2. **Second**: Implement the tracker interface and state management
3. **Third**: Integrate with existing `sendMessage` flow
4. **Fourth**: Verify end-to-end behavior with console logs

---

## Implementation Plan

### Phase 1: Type Definitions & Pure Logic

> ⚠️ **DDD Note**: Domain types and constants belong in `lib/pivot-logic.ts`, NOT in `hooks/use-chat.ts`. This keeps domain logic separate from React orchestration. `use-chat.ts` will import from `lib/`.

> ℹ️ **Status**: `lib/pivot-logic.ts` is already implemented on this branch (Phases 1.1 and 1.2 complete). Remaining Phase 1 work is **Phase 1.3** (localStorage helpers in `hooks/use-chat.ts`) and **Phase 1.4** (unit tests against the existing implementation).

#### 1.1 Define `ExtractionTracker` Interface and Constants

**File**: `lib/pivot-logic.ts` (new file)

```typescript
/**
 * Domain type: tracks extraction state for pivot decisions.
 * Stored in localStorage for persistence across page refreshes.
 */
export interface ExtractionTracker {
  currentSection: string;
  extractedThemes: string[];       // Unique themes found in current section
  hqExtractionHistory: string[];   // FIFO sliding window of recent HQ extraction themes (max 5)
  questionCounter: number;          // Messages sent in current section
  pivotFlag: boolean;              // Use-once flag for heavy pivot
}

/**
 * Sliding Window Semantics: `hqExtractionHistory` uses **FIFO** (First-In-First-Out) behavior.
 * When hqExtractionHistory.length > windowSize, the oldest item is removed.
 * Example: windowSize=5, current length=5, adding new item → remove oldest, then add (length stays 5)
 */

/**
 * Single source of truth for pivot thresholds.
 * Production code uses this; tests can override for boundary testing.
 */
export const DEFAULT_THRESHOLDS = {
  windowSize: 5,            // Max items in hqExtractionHistory (FIFO)
  requiredDiversity: 4,     // Min unique themes required in window (aligned with REQUIRED_THEMES)
  questionThreshold: 15,    // Pivot when questionCounter > 15 (strict >)
  repetitionThreshold: 3,   // Max same-theme occurrences allowed in window before pivot
} as const;
```

#### 1.2 Pure Functions for Tracker Logic

**File**: `lib/pivot-logic.ts` (new file)

```typescript
/**
 * Determines if pivot conditions are met based on extraction tracker state.
 * Pure function - no side effects.
 *
 * CONDITIONS (any one being true triggers pivot):
 * - questionCounter > questionThreshold (e.g., 16 > 15 triggers, 15 does NOT)
 * - Max repetition of any theme >= repetitionThreshold in window
 * - Unique themes < requiredDiversity in window
 */
export function shouldTriggerPivot(
  tracker: ExtractionTracker,
  thresholds: {
    windowSize: number;
    requiredDiversity: number;
    questionThreshold: number;
    repetitionThreshold: number;
  }
): { shouldPivot: boolean; reason: string } {
  // Implementation...
}

/**
 * Updates the tracker with new extraction data.
 * Pure function - returns new tracker state.
 *
 * BEHAVIOR:
 * - questionCounter: ALWAYS increments by 1 (every message counts)
 * - hqExtractionHistory: Only appends themes IF has_actionable_pattern === true
 * - extractedThemes: Only merges themes IF has_actionable_pattern === true
 * - pivotFlag: ALWAYS reset to `false` in the returned state. The caller
 *   (use-chat sendMessage, Phase 3.1) computes `shouldTriggerPivot` against
 *   this fresh state and then writes the new `pivotFlag` via `updateTrackerState`
 *   BEFORE the next user message is sent. The flag is evaluated turn-by-turn,
 *   not persisted across turns.
 *
 * FIFO Sliding Window: When hqExtractionHistory.length > windowSize,
 * the oldest items are dropped before adding new themes.
 *
 * Theme Prefix Handling: MemListener may return themes with section prefixes
 * (e.g., 'childhood: foundational_event'). The implementation strips everything
 * up to and including the first ':' then trims whitespace. Themes without a
 * colon are trimmed only. Themes that become empty after stripping are skipped.
 *
 * Cross-section themes: `hqExtractionHistory` stores the stripped theme name
 * regardless of which section the theme belongs to (no ARENA_THEMES filtering).
 * This is intentional: diversity signal should reflect what the AI actually
 * extracted, not just the themes that matched the current section taxonomy.
 */
export function updateTracker(
  tracker: ExtractionTracker,
  extraction: { themes_extracted?: string[]; has_actionable_pattern?: boolean },
  currentSection: string
): ExtractionTracker {
  // Implementation...
}

/**
 * Resets tracker for a new section.
 * Note: Does NOT modify extractedThemes - caller should repopulate from session data.
 */
export function resetTrackerForSection(tracker: ExtractionTracker, newSection: string): ExtractionTracker {
  // Implementation...
}
```

#### 1.3 localStorage Persistence Functions

**File**: `hooks/use-chat.ts`

```typescript
const TRACKER_STORAGE_KEY_PREFIX = 'dna_extraction_tracker_';

/**
 * Loads extraction tracker from localStorage.
 * SSR-safe: returns null if called on server.
 * Key includes userPath to prevent collision across users on same device.
 */
function loadTrackerFromStorage(userPath: string, sessionId: string): ExtractionTracker | null {
  if (typeof window === 'undefined') return null;
  if (!userPath) return null; // Guard: no user yet
  try {
    const key = `${TRACKER_STORAGE_KEY_PREFIX}${userPath}_${sessionId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as ExtractionTracker;
    }
  } catch (e) {
    console.warn('[ExtractionTracker] Failed to load from localStorage:', e);
  }
  return null;
}

/**
 * Saves extraction tracker to localStorage.
 * SSR-safe: no-op if called on server.
 */
function saveTrackerToStorage(userPath: string, sessionId: string, tracker: ExtractionTracker): void {
  if (typeof window === 'undefined') return;
  if (!userPath) return;
  try {
    const key = `${TRACKER_STORAGE_KEY_PREFIX}${userPath}_${sessionId}`;
    localStorage.setItem(key, JSON.stringify(tracker));
  } catch (e) {
    console.warn('[ExtractionTracker] Failed to save to localStorage:', e);
  }
}

/**
 * Clears extraction tracker from localStorage.
 */
function clearTrackerFromStorage(userPath: string, sessionId: string): void {
  if (typeof window === 'undefined') return;
  if (!userPath) return;
  try {
    const key = `${TRACKER_STORAGE_KEY_PREFIX}${userPath}_${sessionId}`;
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('[ExtractionTracker] Failed to clear from localStorage:', e);
  }
}
```

#### 1.4 Write Unit Tests

**File**: `lib/pivot-logic.test.ts` (new file)

```typescript
import { shouldTriggerPivot, updateTracker, resetTrackerForSection, DEFAULT_THRESHOLDS, type ExtractionTracker } from './pivot-logic';

const minimalTracker: ExtractionTracker = {
  currentSection: 'childhood',
  extractedThemes: [],
  hqExtractionHistory: [],
  questionCounter: 0,
  pivotFlag: false,
};

describe('shouldTriggerPivot', () => {

  it('should NOT trigger pivot on first message (questionCounter: 0)', () => {
    const tracker = { ...minimalTracker, questionCounter: 0 };
    const result = shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS);
    expect(result.shouldPivot).toBe(false);
  });

  it('should trigger pivot when question threshold exceeded (16 > 15)', () => {
    const tracker = { ...minimalTracker, questionCounter: 16 };
    const result = shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS);
    expect(result.shouldPivot).toBe(true);
    expect(result.reason).toContain('question');
  });

  it('should NOT trigger pivot at exactly question threshold (15)', () => {
    const tracker = { ...minimalTracker, questionCounter: 15 };
    const result = shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS);
    expect(result.shouldPivot).toBe(false);
  });

  it('should trigger pivot when theme repetition >= 3 in window', () => {
    const tracker = {
      ...minimalTracker,
      hqExtractionHistory: ['foundational_event', 'foundational_event', 'foundational_event'],
      questionCounter: 5,
    };
    const result = shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS);
    expect(result.shouldPivot).toBe(true);
    expect(result.reason).toContain('repetition');
  });

  it('should NOT trigger pivot when repetition is below threshold (2)', () => {
    const tracker = {
      ...minimalTracker,
      hqExtractionHistory: ['foundational_event', 'foundational_event'],
      questionCounter: 3,
    };
    const result = shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS);
    expect(result.shouldPivot).toBe(false);
  });

  it('should trigger pivot when diversity < 4 unique themes in 5 items', () => {
    const tracker = {
      ...minimalTracker,
      hqExtractionHistory: ['a', 'a', 'b', 'b', 'c'], // only 3 unique
      questionCounter: 5,
    };
    const result = shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS);
    expect(result.shouldPivot).toBe(true);
    expect(result.reason).toContain('diversity');
  });

  it('should NOT trigger pivot with exactly 4 unique themes (threshold met)', () => {
    const tracker = {
      ...minimalTracker,
      hqExtractionHistory: ['a', 'b', 'c', 'd', 'a'], // 4 unique
      questionCounter: 5,
    };
    const result = shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS);
    expect(result.shouldPivot).toBe(false);
  });

  it('should trigger pivot on diversity grounds even with pivotFlag already true', () => {
    const tracker = {
      ...minimalTracker,
      pivotFlag: true,  // Flag already set - doesn't block new triggers
      hqExtractionHistory: [],  // Empty history = 0 unique < 4
      questionCounter: 3,
    };
    const result = shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS);
    // shouldPivot checks conditions, doesn't check existing flag
    // With empty history, diversity check triggers: 0 unique < 4 required
    expect(result.shouldPivot).toBe(true);
    expect(result.reason).toContain('diversity');
  });
});

describe('updateTracker', () => {

  it('should increment questionCounter on every update', () => {
    const result = updateTracker(minimalTracker, { has_actionable_pattern: false }, 'childhood');
    expect(result.questionCounter).toBe(1);
  });

  it('should NOT add to hqExtractionHistory when not HQ extraction', () => {
    const tracker = { ...minimalTracker, hqExtractionHistory: [] };
    const result = updateTracker(tracker, { has_actionable_pattern: false }, 'childhood');
    expect(result.hqExtractionHistory).toEqual([]);
  });

  it('should add themes to hqExtractionHistory on HQ extraction (FIFO sliding window)', () => {
    const tracker = { ...minimalTracker, hqExtractionHistory: ['a', 'b'] };
    const result = updateTracker(tracker, {
      has_actionable_pattern: true,
      themes_extracted: ['c', 'd'],
    }, 'childhood');
    // FIFO: oldest items pushed out when window exceeds 5
    expect(result.hqExtractionHistory).toEqual(['a', 'b', 'c', 'd']);
  });

  it('should enforce FIFO sliding window at exactly window size + 1', () => {
    const fullTracker: ExtractionTracker = {
      ...minimalTracker,
      hqExtractionHistory: ['a', 'b', 'c', 'd', 'e'], // already at 5
    };
    const result = updateTracker(fullTracker, {
      has_actionable_pattern: true,
      themes_extracted: ['f'],
    }, 'childhood');
    // FIFO: oldest ('a') should be removed, 'f' added
    expect(result.hqExtractionHistory).toEqual(['b', 'c', 'd', 'e', 'f']);
    expect(result.hqExtractionHistory).toHaveLength(5);
  });

  it('should not update extractedThemes when themes_extracted is empty', () => {
    const tracker = { ...minimalTracker, extractedThemes: ['foundational_event'] };
    const result = updateTracker(tracker, {
      has_actionable_pattern: true,
      themes_extracted: [],
    }, 'childhood');
    expect(result.extractedThemes).toEqual(['foundational_event']);
  });

  it('should update extractedThemes with new unique themes only', () => {
    const tracker = {
      ...minimalTracker,
      extractedThemes: ['foundational_event'],
    };
    const result = updateTracker(tracker, {
      has_actionable_pattern: true,
      themes_extracted: ['foundational_event', 'early_memory'],
    }, 'childhood');
    // 'foundational_event' is duplicate, only 'early_memory' added
    expect(result.extractedThemes).toContain('foundational_event');
    expect(result.extractedThemes).toContain('early_memory');
    expect(result.extractedThemes).toHaveLength(2);
  });

  it('should strip section prefix from themes (e.g., "childhood: foundational_event")', () => {
    const tracker = { ...minimalTracker, hqExtractionHistory: [] };
    const result = updateTracker(tracker, {
      has_actionable_pattern: true,
      themes_extracted: ['childhood: foundational_event', 'loss: grief_event'],
    }, 'childhood');
    // Prefixes should be stripped - only 'foundational_event' and 'grief_event' stored
    expect(result.hqExtractionHistory).toContain('foundational_event');
    expect(result.hqExtractionHistory).toContain('grief_event');
    expect(result.hqExtractionHistory).not.toContain('childhood: foundational_event');
  });
});

describe('resetTrackerForSection', () => {

  it('should reset hqExtractionHistory to empty array', () => {
    const trackerWithHistory: ExtractionTracker = {
      ...minimalTracker,
      hqExtractionHistory: ['a', 'b', 'c'],
      extractedThemes: ['foundational_event', 'early_memory'],
      questionCounter: 10,
      pivotFlag: true,
    };
    const result = resetTrackerForSection(trackerWithHistory, 'shame');
    expect(result.hqExtractionHistory).toEqual([]);
  });

  it('should reset questionCounter to 0', () => {
    const trackerWithHistory: ExtractionTracker = { ...minimalTracker, questionCounter: 10 };
    const result = resetTrackerForSection(trackerWithHistory, 'shame');
    expect(result.questionCounter).toBe(0);
  });

  it('should reset pivotFlag to false', () => {
    const trackerWithHistory: ExtractionTracker = { ...minimalTracker, pivotFlag: true };
    const result = resetTrackerForSection(trackerWithHistory, 'shame');
    expect(result.pivotFlag).toBe(false);
  });

  it('should update currentSection to new section', () => {
    const tracker = { ...minimalTracker, currentSection: 'childhood' };
    const result = resetTrackerForSection(tracker, 'shame');
    expect(result.currentSection).toBe('shame');
  });

  it('should preserve extractedThemes from session data (passed separately)', () => {
    // Note: resetTrackerForSection does NOT modify extractedThemes - it passes through
    // The caller (use-chat.ts Phase 4.1) constructs new state directly with sessionThemes
    const tracker = { ...minimalTracker, extractedThemes: ['foundational_event'] };
    const result = resetTrackerForSection(tracker, 'shame');
    // extractedThemes is NOT modified by resetTrackerForSection - preserved as-is
    expect(result.extractedThemes).toEqual(['foundational_event']);
  });
});

describe('Integration: Full pivot cycle', () => {

  it('should trigger pivot after HQ extractions with theme repetition', () => {
    let tracker = minimalTracker;

    // Simulate 3 HQ extractions all with same theme
    for (let i = 0; i < 3; i++) {
      tracker = updateTracker(tracker, {
        has_actionable_pattern: true,
        themes_extracted: ['foundational_event'],
      }, 'childhood');
    }

    expect(tracker.hqExtractionHistory).toEqual(['foundational_event', 'foundational_event', 'foundational_event']);

    const { shouldPivot, reason } = shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS);
    expect(shouldPivot).toBe(true);
    expect(reason).toContain('repetition');
  });

  it('should NOT trigger pivot after diverse HQ extractions', () => {
    let tracker = minimalTracker;

    // Simulate 5 HQ extractions with different themes
    const diverseThemes = ['a', 'b', 'c', 'd', 'e'];
    for (const theme of diverseThemes) {
      tracker = updateTracker(tracker, {
        has_actionable_pattern: true,
        themes_extracted: [theme],
      }, 'childhood');
    }

    expect(tracker.hqExtractionHistory).toHaveLength(5);

    const { shouldPivot } = shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS);
    expect(shouldPivot).toBe(false);
  });
});
```

---

### Phase 2: State Management Integration

> **Import**: Phase 2.x code in `hooks/use-chat.ts` should import from `lib/pivot-logic.ts`:
> ```typescript
> import { type ExtractionTracker, DEFAULT_THRESHOLDS } from '@/lib/pivot-logic';
> ```

#### 2.1 Add Tracker State to useChat Hook

**File**: `hooks/use-chat.ts`

```typescript
// Import domain types and constants from lib/
import { type ExtractionTracker, DEFAULT_THRESHOLDS } from '@/lib/pivot-logic';

// Add around line 91 (near other state declarations)
const [extractionTracker, setExtractionTracker] = useState<ExtractionTracker>({
  currentSection: 'identity',
  extractedThemes: [],
  hqExtractionHistory: [],
  questionCounter: 0,
  pivotFlag: false,
});
```

> ⚠️ **IMPORTANT**: `extractionTracker` must be added to the hook's return statement (around line 617):
> ```typescript
> return {
>   messages,
>   session,
>   sendMessage,
>   changeSection,
>   isLoading,
>   isReprocessing,
>   streamingContent,
>   isInitializing,
>   firebaseAvailable,
>   extractionTracker,  // ADD THIS
> };
> ```

#### 2.2 Initialize Tracker with localStorage Persistence

**File**: `hooks/use-chat.ts` (in the `onSnapshot` callback after `setSession`)

> ⚠️ **Important**: This must go inside the `onSnapshot` callback (around line 170) AFTER `setSession(snapshot.data() as DNASession)`, not in a separate useEffect. This ensures userPath is available before loading.

```typescript
// Inside onSnapshot callback, after setSession:
// ...
setSession(snapshot.data() as DNASession);

// Load tracker from localStorage (keyed by userPath + sessionId to prevent cross-user collision)
if (userPath) {
  const storedTracker = loadTrackerFromStorage(userPath, sessionId);

  if (storedTracker) {
    // If stored tracker is for a different section, reset it
    if (storedTracker.currentSection !== snapshot.data().currentSection) {
      const freshTracker: ExtractionTracker = {
        currentSection: snapshot.data().currentSection,
        extractedThemes: snapshot.data().sectionThemes?.[snapshot.data().currentSection as DNASectionId] || [],
        hqExtractionHistory: [],
        questionCounter: 0,
        pivotFlag: false,
      };
      updateTrackerState(freshTracker);
    } else {
      // Same section - restore from localStorage
      updateTrackerState(storedTracker);
    }
  } else {
    // No stored tracker - initialize from session data
    const initialTracker: ExtractionTracker = {
      currentSection: snapshot.data().currentSection,
      extractedThemes: snapshot.data().sectionThemes?.[snapshot.data().currentSection as DNASectionId] || [],
      hqExtractionHistory: [],
      questionCounter: 0,
      pivotFlag: false,
    };
    updateTrackerState(initialTracker);
  }
}
```

> **Design Decision**: localStorage persistence ensures the tracker survives page refreshes. On refresh, if the user is still in the same section, we restore their conversation momentum. If they've navigated to a different section (via direct URL or sidebar), we reset the tracker for that section.

#### 2.3 Save Tracker to localStorage on Every Update

**File**: `hooks/use-chat.ts`

> ⚠️ **IMPORTANT**: Every call to `setExtractionTracker` must also persist to localStorage.

Create a wrapper function:

```typescript
// Wrapper that updates state AND persists to localStorage.
// userPath is included in the storage key to prevent cross-user collision,
// so it must be captured in the closure and listed in the dep array.
const updateTrackerState = useCallback((updater: ExtractionTracker | ((prev: ExtractionTracker) => ExtractionTracker)) => {
  setExtractionTracker(prev => {
    const next = typeof updater === 'function' ? updater(prev) : updater;
    // Persist to localStorage on every state change
    saveTrackerToStorage(userPath ?? '', sessionId, next);
    return next;
  });
}, [userPath, sessionId]);
```

Then replace all `setExtractionTracker` calls with `updateTrackerState` throughout the implementation:
- Phase 3.1: `updateTrackerState(...)` instead of `setExtractionTracker(...)`
- Phase 4.1: `updateTrackerState(...)` for section change reset

> **Note**: There is no "reset pivotFlag after use" phase. The design deliberately does NOT reset the flag after a single use. Each successful message exchange recomputes `shouldTriggerPivot` against fresh state and overwrites `pivotFlag` with the new result (see Phase 3.1 and the write-through behavior of `updateTracker`, documented in Phase 1.2).

#### 2.4 Session End Handling

**File**: `hooks/use-chat.ts`

> ⚠️ **No existing cleanup effect exists** in use-chat.ts. The auth listener at lines 134-155 only sets `userPath = null` on logout. Since localStorage is keyed by `sessionId` (which includes the user's UID), different users get different keys. Orphaned entries won't be accessed.

**Decision**: Omit explicit logout cleanup. If needed in future:
> Add a `useEffect` watching `userPath`:
> ```typescript
> useEffect(() => {
>   if (firebaseAvailable && userPath === null && sessionId) {
>     clearTrackerFromStorage(sessionId);
>   }
> }, [userPath, sessionId, firebaseAvailable]);
> ```

---

### Phase 3: Tracker Updates on Message Exchange

#### 3.1 Update Tracker After Each Extraction

**File**: `hooks/use-chat.ts` (in the success block after line 439)

> ⚠️ **Important**: The tracker update must occur **after confirmed successful API response**. The `aiExtractions` data only exists inside the success block (try/catch loop that sets `success = true` at line 413).
>
> Note: `isHighQuality` is defined at lines 460-463.

```typescript
// After line 439 (after addDoc persists assistant message).
// Runs only in the success branch; `aiAssessment` and `aiExtractions` are in scope.
const updatedTracker = updateTracker(extractionTracker, {
  themes_extracted: aiExtractions?.themes_extracted,
  has_actionable_pattern:
    aiAssessment?.has_actionable_pattern === true && aiAssessment?.depth_score >= 4,
}, currentSection);

// Check if pivot should trigger for the NEXT message, based on the updated tracker.
const { shouldPivot } = shouldTriggerPivot(updatedTracker, DEFAULT_THRESHOLDS);

// Write-through: updateTracker always returns pivotFlag:false. We overwrite
// with the freshly-computed decision before persisting, so the NEXT API call
// sees the correct flag. This replaces the earlier "reset after use" design.
updateTrackerState({
  ...updatedTracker,
  pivotFlag: shouldPivot,
});
```

#### 3.2 Send pivotFlag to API

**File**: `hooks/use-chat.ts` (around line 387-393)

```typescript
body: JSON.stringify({
  content: content.trim(),
  currentSection,
  actorName,
  history: chatHistory,
  previouslyAsked,
  pivotFlag: extractionTracker.pivotFlag,  // NEW
})
```

#### 3.3 Consume pivotFlag in API Route

**File**: `app/api/dna/chat/route.ts` (around line 95)

```typescript
// Parse pivotFlag from request
const { pivotFlag } = body; // Add to destructuring around line 64

// Update dynamicCommand logic (lines 109-122)
let dynamicCommand = "";
if (isShort) {
  dynamicCommand = `[User is giving very short input]
  Instigate deeper...`;
} else if (isMandatoryPivot) {
  dynamicCommand = `[SYSTEM OVERRIDE: MANDATORY THEME SHIFT]
  You have spent enough time digging into this specific memory...`;
} else if (pivotFlag) {  // NEW CONDITION
  dynamicCommand = `[THEME EXHAUSTION DETECTED]
  Our monitoring has detected potential theme exhaustion in this conversation path.
  Review the recent exchange carefully: if the last several exchanges show diminishing thematic diversity or repetitive patterns, the current conversation path may not be bearing fruit.
  Deeply consider pivoting to a new Route that explores a different psychological dimension, rather than continuing to dig deeper into the same thematic territory.`;
} else {
  dynamicCommand = `[MOMENTUM CHECK]
  Continue the Socratic extraction naturally...`;
}
```

> **Pivot Flag Persistence**: Unlike the original design, we do NOT reset pivotFlag after use. The flag persists across message boundaries. Each message evaluates conditions fresh and sets the flag for the NEXT message if conditions are met. This ensures the AI sees the pivot prompt before making its decision.
>
> **Note on Dependency Array**: Once tracker state management is added inside `sendMessage`, the `useCallback` dependency array at **line 579** will need to include `extractionTracker` and `updateTrackerState`:
> ```typescript
> }, [userPath, sessionId, session, firebaseAvailable, extractionTracker, updateTrackerState]);
> ```
> `updateTrackerState` is created with `useCallback` and depends on `sessionId`, so adding it ensures the callback uses the latest persistence function.

### Phase 4: Section Change Handling

> **Note**: Phase 4.1 constructs new tracker state directly via `updateTrackerState({...})`. It does NOT call `resetTrackerForSection()`. The `resetTrackerForSection()` function exists for potential reuse or testing but is not used in the current implementation.

#### 4.1 Reset Tracker on Section Change

**File**: `hooks/use-chat.ts` (in changeSection function, around line 589)

```typescript
const changeSection = useCallback(async (newSection: string) => {
  if (!firebaseAvailable || !session) return;

  // Reset extraction tracker for new section
  const sessionThemes = session?.sectionThemes?.[newSection as DNASectionId] || [];
  // Uses updateTrackerState wrapper which handles localStorage persistence
  updateTrackerState({
    currentSection: newSection,
    extractedThemes: sessionThemes,
    hqExtractionHistory: [],
    questionCounter: 0,
    pivotFlag: false,
  });

  // ... rest of existing logic
}, [userPath, sessionId, session, firebaseAvailable, updateTrackerState]);
```

> ⚠️ **Important**: The dependency array at **line 615** must include `updateTrackerState` since it's now called inside the callback.

---

### Phase 5: Testing & Verification

#### 5.1 Run Existing Tests

```bash
npm test
```
All existing tests (including new `lib/pivot-logic.test.ts`) must pass.

#### 5.2 Temporary Debug Logging

**File**: `hooks/use-chat.ts` (remove before merging if noisy)

```typescript
// After updating tracker
console.log('[TRACE] Extraction tracker updated:', {
  extractedThemes: updatedTracker.extractedThemes,
  hqExtractionHistory: updatedTracker.hqExtractionHistory,
  questionCounter: updatedTracker.questionCounter,
  pivotFlag: shouldPivot,
});
```

#### 5.3 End-to-End Verification Checklist

1. `npm run dev` and sign in.
2. Open DevTools → **Application → Local Storage** and watch for key `dna_extraction_tracker_<userPath>_<sessionId>`. It should appear after the first successful message and update on every send.
3. Open DevTools → **Network** and inspect the `/api/dna/chat` request body. It must include `pivotFlag: boolean`.
4. **Question threshold path**: Send 16 messages, each with input ≥15 chars, ensuring the AI's extractions return a diverse set of `themes_extracted` (so repetition/diversity do not fire first). On the 16th outbound request, confirm `pivotFlag: true`, and in the server terminal confirm the route selects the `[THEME EXHAUSTION DETECTED]` branch. The AI's reply for the 17th message should open a new Route.
5. **Repetition path**: Send a short sequence of messages designed to produce 3 identical `themes_extracted` values (e.g., keep answering with the same memory). After the 3rd HQ extraction, confirm `pivotFlag: true` on the next request.
6. **Diversity path**: Produce 5 HQ extractions with only 3 unique themes. After the 5th, confirm `pivotFlag: true`.
7. **Section change reset**: While `pivotFlag: true`, click a different section in the sidebar. Confirm localStorage shows `questionCounter: 0`, `hqExtractionHistory: []`, `pivotFlag: false`, and `extractedThemes` = the Firestore `sectionThemes[newSection]`.
8. **Page refresh**: Send a few messages in a section, refresh the page. Confirm the tracker is restored from localStorage (same `questionCounter`, same history).
9. **Rollback criteria**: If the AI pivot output is qualitatively worse (loses context, changes topic mid-story) more than the current baseline in ≥3 of 5 test runs, revert and re-tune thresholds.

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `lib/pivot-logic.ts` | **EXISTS** (already implemented on this branch) | Domain types (`ExtractionTracker` interface, `DEFAULT_THRESHOLDS`) and pure functions (`shouldTriggerPivot`, `updateTracker`, `resetTrackerForSection`) |
| `lib/pivot-logic.test.ts` | **NEW** | Unit tests importing from `lib/pivot-logic.ts` |
| `hooks/use-chat.ts` | MODIFY | Import domain types from `lib/`, add tracker state, `updateTrackerState` wrapper, localStorage functions (`loadTrackerFromStorage`, `saveTrackerToStorage`, `clearTrackerFromStorage`) |
| `app/api/dna/chat/route.ts` | MODIFY | Receive pivotFlag in request body, use in dynamicCommand selection |

---

## Assumptions Verified

### Confirmed via Code Analysis

1. **AIExtractions interface** (`hooks/use-chat.ts:38-64`) includes:
   - `themes_extracted?: string[]`
   - `progress_assessment?: { has_actionable_pattern: boolean; depth_score: number }`

2. **HQ Extraction criteria** (`hooks/use-chat.ts:460-463`):
   ```typescript
   const isHighQuality =
     aiAssessment != null &&
     aiAssessment.has_actionable_pattern === true &&
     aiAssessment.depth_score >= 4;
   ```

3. **Theme filtering** (`hooks/use-chat.ts:469-478`):
   - Only themes from `ARENA_THEMES[currentSection]` are kept
   - `novel_theme` is also allowed
   - Cross-section themes (e.g., `grief_event` in `childhood`) are filtered out

4. **API request body** (`hooks/use-chat.ts:387-393`):
   ```typescript
   { content, currentSection, actorName, history, previouslyAsked }
   ```
   Does NOT include `sectionThemes` or `sectionHqCounts`

5. **changeSection behavior** (`hooks/use-chat.ts:589-615`):
   - Updates Firestore `currentSection`
   - Injects section intro if empty
   - Does NOT reset any local tracking state

6. **Progress calculation** (`hooks/use-chat.ts:539-550`):
   - `DIVERSITY_WEIGHT = 0.6`, `COUNT_WEIGHT = 0.4`
   - Section complete when `count >= 5` AND `uniqueThemes >= 4`

### Confirmed via User-Provided Logs

1. **Extraction data structure** (from user log):
   ```
   themes_extracted: ['childhood: foundational_event', 'loss: grief_event']
   diversity_note: 'New theme: different from belonging_church'
   has_actionable_pattern: true
   depth_score: 8
   ```

2. **MemListener compares against previous themes** via `diversity_note` field

3. **Cross-section themes are filtered**: `grief_event` is in `loss` section, not `childhood` - so it was correctly filtered out when updating `sectionThemes[childhood]`

### Post-Implementation Documentation Required

After this feature is implemented, document the decision in Forgetful:
- Memory name: `"arrow/actors-copilot - Local Extraction Tracker for Smart Pivoting"`
- Topics: pivot mechanism, theme diversity, extraction tracking
- Include thresholds and rationale

This is a **new design decision** not previously documented (no prior memory found about `pivotFlag`).

---

## Security / Trust Model

`pivotFlag` is computed client-side and sent in the request body. A malicious client could spoof the flag to force the AI into pivot behavior. The blast radius is limited to the user's own session (they are coaching their own AI), so we accept this trade-off. If trust ever becomes a concern, move the tracker server-side (Firestore or per-session Redis) and derive `pivotFlag` in the API route.

---

## Threshold Rationale

| Threshold | Value | Rationale |
|-----------|-------|-----------|
| `windowSize` | 5 | Captures recent extraction patterns without being too noisy |
| `requiredDiversity` | 4 | Aligned with existing `REQUIRED_THEMES = 4` for section completion |
| `questionThreshold` | 15 | Triggers when `questionCounter > 15` (i.e., at message 16); ensures sufficient exploration before pivot |
| `repetitionThreshold` | 3 | If same theme appears 3+ times in 5 extractions, likely exhausted |

---

## Complete Flow Diagram

### User Action: Send Message

```
User types message → sendMessage() called
    ↓
API call made to /api/dna/chat
    ├── Body includes: content, currentSection, pivotFlag (from extractionTracker.pivotFlag)
    └── pivotFlag represents: "should AI consider pivot based on PREVIOUS extraction?"
    ↓
API processes message → returns response
    ↓
SUCCESS PATH (inside try block):
    ↓
    addDoc() — persist assistant message to Firestore (line 439)
    ↓
    Phase 3.1: Update tracker (ALWAYS runs, every message)
    │   │
    │   ├── updateTracker() called:
    │   │   ├── questionCounter ALWAYS increments by 1
    │   │   ├── IF has_actionable_pattern === true:
    │   │   │   ├── Themes from themes_extracted added to hqExtractionHistory (FIFO, max 5)
    │   │   │   └── Unique themes merged into extractedThemes
    │   │   └── IF NOT HQ:
    │   │       └── hqExtractionHistory unchanged
    │   │
    │   ├── shouldTriggerPivot() called with updated tracker:
    │   │   ├── Returns { shouldPivot: true } if ANY condition met:
    │   │   │   ├── questionCounter > 15 (strict greater-than)
    │   │   │   ├── repetition (same theme >= 3 in window)
    │   │   │   └── diversity (unique themes < 4 in window)
    │   │   └── Returns { shouldPivot: false } otherwise
    │       │
    │   └── updateTrackerState() — persists to localStorage
    │       └── Sets pivotFlag = shouldPivot (for NEXT message)
    │
    │ NOTE: We do NOT reset pivotFlag after use — it persists so the NEXT
    │ message sees the prompt. Each message evaluates conditions fresh.
    │
    └── Progress calculation continues (Firestore sync)
        └── sectionThemes, sectionHqCounts updated in Firestore
```

### User Action: Change Section

```
User clicks sidebar section → changeSection(newSection) called
    ↓
updateTrackerState() — resets tracker for new section
    ├── currentSection = newSection
    ├── extractedThemes = session.sectionThemes[newSection] (from Firestore)
    ├── hqExtractionHistory = [] (CLEARED)
    ├── questionCounter = 0 (RESET)
    └── pivotFlag = false (RESET)
    ↓
saveTrackerToStorage() — persists reset state to localStorage
    ↓
Firestore updated: currentSection = newSection
    ↓
Section intro injected if empty
```

### User Action: Page Refresh

```
Page loads → useChat hook mounts
    ↓
loadTrackerFromStorage(sessionId)
    ├── localStorage.getItem('dna_extraction_tracker_' + sessionId)
    └── Returns stored tracker or null
    ↓
IF storedTracker found:
    ├── IF storedTracker.currentSection === session.currentSection:
    │   └── Restore: setExtractionTracker(storedTracker)
    └── ELSE (section changed while page was closed):
        └── Reset tracker for new section (same as changeSection flow)
ELSE (no stored tracker):
    └── Initialize from session data
```

### Pivot Flag Lifecycle

```
Message N response processed (success branch of sendMessage):
    ↓
Phase 3.1 calls updateTracker() → returns new state with pivotFlag:false
    ↓
Phase 3.1 calls shouldTriggerPivot(newState) → { shouldPivot }
    ↓
Phase 3.1 calls updateTrackerState({ ...newState, pivotFlag: shouldPivot })
    └── persisted to React state + localStorage
    ↓
Message N+1 sent:
    ├── pivotFlag (from localStorage-backed state) included in API body
    └── route.ts picks [THEME EXHAUSTION DETECTED] branch if flag is true
    ↓
Message N+1 response processed:
    ↓
Phase 3.1 runs again: updateTracker zeroes pivotFlag, shouldTriggerPivot
recomputes from the new window, result is written back.

The flag is therefore evaluated turn-by-turn. There is NO separate "reset
after use" step — the write-through at the end of each successful turn IS
the reset.
```

---

## Edge Cases

| Edge Case | How It's Handled |
|-----------|------------------|
| **First message in section** | Tracker initializes with `questionCounter: 0`, pivot only triggers if conditions met from the start |
| **Section change mid-conversation** | `resetTrackerForSection` clears `hqExtractionHistory`, `questionCounter`, `pivotFlag`; initializes `extractedThemes` from session data |
| **pivotFlag set but user doesn't respond** | Flag stays true (localStorage-backed) until the next successful API call, at which point Phase 3.1 recomputes it against the new window |
| **No HQ extractions yet** | `hqExtractionHistory` stays empty, pivot based on `questionCounter` only |
| **All themes from ARENA_THEMES are same section** | Expected - theme filtering by section is correct behavior |
| **Duplicate themes in single extraction** | Deduplicated before adding to `extractedThemes` via `new Set()` |
| **pivotFlag and isShort both true** | `isShort` takes precedence (first in if/else chain at `route.ts:109-122`) |
| **Retries on API failure** | Tracker state not updated until success; on retry, conditions recalculated |
| **Page refresh** | Tracker restored from localStorage on mount; if section changed, tracker is reset |
| **localStorage unavailable/failed** | Tracker continues to work in-memory; graceful degradation with console warning |
| **Session end (logout)** | localStorage entry cleared via `clearTrackerFromStorage(sessionId)` |

> **Note on questionCounter vs `previouslyAsked.length`**: The tracker maintains its own `questionCounter` locally. The API route also computes `questionCount` from `previouslyAsked?.length`. These could diverge on retries. The tracker's threshold (15) aligns with the commented-out logic in the route.

---

## Future Considerations

1. **Cross-section theme awareness**: The `diversity_note` suggests MemListener knows about cross-section themes. Future enhancement could track these for smarter pivoting.

2. **Firestore sync for multi-device**: Currently tracker persists to localStorage only (single device). Could sync to Firestore for cross-device continuity.

3. **Configurable thresholds**: Could move thresholds to environment variables or user preferences.

4. **Graduated pivot pressure**: Instead of binary `pivotFlag`, could have levels (mild → moderate → strong).

5. **Analytics**: Track how often pivotFlag triggers, correlation with section completion rates, etc.
