/**
 * Domain types and pure functions for extraction tracking and smart pivoting.
 * This module contains no React or infrastructure code - only domain logic.
 */

export interface ExtractionTracker {
  currentSection: string;
  extractedThemes: string[];
  hqExtractionHistory: string[];
  questionCounter: number;
  pivotFlag: boolean;
}

/**
 * Single source of truth for pivot thresholds. Production code imports this
 * directly; tests can pass a modified object for boundary testing.
 */
export const DEFAULT_THRESHOLDS = {
  windowSize: 5,
  requiredDiversity: 4,
  questionThreshold: 15,
  repetitionThreshold: 3,
} as const;

export type PivotThresholds = {
  windowSize: number;
  requiredDiversity: number;
  questionThreshold: number;
  repetitionThreshold: number;
};

function stripThemePrefix(theme: string): string {
  const colonIndex = theme.indexOf(':');
  if (colonIndex !== -1) {
    return theme.slice(colonIndex + 1).trim();
  }
  return theme.trim();
}

function computeThemeFrequency(history: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const theme of history) {
    freq.set(theme, (freq.get(theme) || 0) + 1);
  }
  return freq;
}

/**
 * Determines if pivot conditions are met based on extraction tracker state.
 *
 * Conditions (any one is sufficient):
 * - questionCounter > questionThreshold (strict greater-than)
 * - At least one theme repeats >= repetitionThreshold times in the window
 * - Unique themes in the window < requiredDiversity
 *
 * When hqExtractionHistory is empty, only the questionCounter check can fire
 * (diversity/repetition are undefined on empty history).
 */
export function shouldTriggerPivot(
  tracker: ExtractionTracker,
  thresholds: PivotThresholds
): { shouldPivot: boolean; reason: string } {
  if (tracker.questionCounter > thresholds.questionThreshold) {
    return {
      shouldPivot: true,
      reason: `question_threshold_exceeded (${tracker.questionCounter} > ${thresholds.questionThreshold})`,
    };
  }

  if (tracker.hqExtractionHistory.length > 0) {
    const freq = computeThemeFrequency(tracker.hqExtractionHistory);
    for (const count of freq.values()) {
      if (count >= thresholds.repetitionThreshold) {
        return {
          shouldPivot: true,
          reason: `theme_repetition (max count: ${count} >= ${thresholds.repetitionThreshold})`,
        };
      }
    }

    const uniqueThemes = new Set(tracker.hqExtractionHistory).size;
    if (uniqueThemes < thresholds.requiredDiversity) {
      return {
        shouldPivot: true,
        reason: `low_diversity (${uniqueThemes} unique < ${thresholds.requiredDiversity} required)`,
      };
    }
  }

  return { shouldPivot: false, reason: 'conditions_not_met' };
}

/**
 * Updates the tracker with new extraction data. Pure function - returns new state.
 *
 * Behavior:
 * - questionCounter: always increments by 1
 * - hqExtractionHistory: appended with stripped themes_extracted iff has_actionable_pattern === true
 * - extractedThemes: merged with stripped themes_extracted iff has_actionable_pattern === true (de-duped)
 * - pivotFlag: ALWAYS reset to false in the returned state. Callers (use-chat
 *   sendMessage) are expected to recompute pivotFlag via shouldTriggerPivot
 *   and overwrite it before persisting. The flag is evaluated turn-by-turn,
 *   not persisted across turns.
 * - currentSection: set to the `currentSection` argument (the section this
 *   update belongs to), even when no extraction happened.
 *
 * Theme normalization:
 * - Themes with a ':' prefix (e.g. 'childhood: foundational_event') are split
 *   on the first colon and trimmed. Themes without a colon are trimmed only.
 * - Themes that become empty after stripping are skipped entirely.
 *
 * Cross-section themes (e.g. 'loss: grief_event' while in 'childhood') are
 * stored as-is (after prefix-stripping). Diversity signal reflects what the
 * AI actually extracted, not the ARENA_THEMES taxonomy.
 *
 * FIFO sliding window: when hqExtractionHistory grows past windowSize, the
 * oldest entries are dropped.
 */
export function updateTracker(
  tracker: ExtractionTracker,
  extraction: { themes_extracted?: string[]; has_actionable_pattern?: boolean },
  currentSection: string,
  thresholds: PivotThresholds = DEFAULT_THRESHOLDS
): ExtractionTracker {
  let hqExtractionHistory = [...tracker.hqExtractionHistory];
  const extractedThemes = [...tracker.extractedThemes];

  if (extraction.has_actionable_pattern === true && extraction.themes_extracted) {
    for (const theme of extraction.themes_extracted) {
      const strippedTheme = stripThemePrefix(theme);
      if (strippedTheme.length === 0) continue;

      hqExtractionHistory.push(strippedTheme);

      if (!extractedThemes.includes(strippedTheme)) {
        extractedThemes.push(strippedTheme);
      }
    }

    if (hqExtractionHistory.length > thresholds.windowSize) {
      hqExtractionHistory = hqExtractionHistory.slice(
        hqExtractionHistory.length - thresholds.windowSize
      );
    }
  }

  return {
    currentSection,
    extractedThemes,
    hqExtractionHistory,
    questionCounter: tracker.questionCounter + 1,
    pivotFlag: false,
  };
}

/**
 * Resets the tracker for a new section.
 * NOTE: extractedThemes is NOT cleared here - callers typically replace it
 * directly with session.sectionThemes[newSection] in use-chat.ts.
 */
export function resetTrackerForSection(
  tracker: ExtractionTracker,
  newSection: string
): ExtractionTracker {
  return {
    ...tracker,
    currentSection: newSection,
    hqExtractionHistory: [],
    questionCounter: 0,
    pivotFlag: false,
  };
}
