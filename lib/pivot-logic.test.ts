import {
  shouldTriggerPivot,
  updateTracker,
  resetTrackerForSection,
  DEFAULT_THRESHOLDS,
  type ExtractionTracker,
} from './pivot-logic';

const minimalTracker: ExtractionTracker = {
  currentSection: 'childhood',
  extractedThemes: [],
  hqExtractionHistory: [],
  questionCounter: 0,
  pivotFlag: false,
};

describe('shouldTriggerPivot', () => {
  it('does NOT trigger on first message (questionCounter: 0)', () => {
    const result = shouldTriggerPivot({ ...minimalTracker, questionCounter: 0 }, DEFAULT_THRESHOLDS);
    expect(result.shouldPivot).toBe(false);
  });

  it('triggers when question threshold exceeded (16 > 15)', () => {
    const result = shouldTriggerPivot({ ...minimalTracker, questionCounter: 16 }, DEFAULT_THRESHOLDS);
    expect(result.shouldPivot).toBe(true);
    expect(result.reason).toContain('question');
  });

  it('does NOT trigger at exactly the question threshold (15)', () => {
    const result = shouldTriggerPivot({ ...minimalTracker, questionCounter: 15 }, DEFAULT_THRESHOLDS);
    expect(result.shouldPivot).toBe(false);
  });

  it('triggers when theme repetition >= 3 in window', () => {
    const tracker: ExtractionTracker = {
      ...minimalTracker,
      hqExtractionHistory: ['foundational_event', 'foundational_event', 'foundational_event'],
      questionCounter: 5,
    };
    const result = shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS);
    expect(result.shouldPivot).toBe(true);
    expect(result.reason).toContain('repetition');
  });

  it('does NOT trigger when repetition is below threshold (2 of any theme) and diversity is OK', () => {
    // Full window (5), 4 unique themes — diversity OK, max repetition is 2
    const tracker: ExtractionTracker = {
      ...minimalTracker,
      hqExtractionHistory: ['a', 'a', 'b', 'c', 'd'],
      questionCounter: 5,
    };
    const result = shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS);
    expect(result.shouldPivot).toBe(false);
  });

  it('triggers when diversity < 4 unique themes in 5 items', () => {
    const tracker: ExtractionTracker = {
      ...minimalTracker,
      hqExtractionHistory: ['a', 'a', 'b', 'b', 'c'],
      questionCounter: 5,
    };
    const result = shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS);
    expect(result.shouldPivot).toBe(true);
    expect(result.reason).toContain('diversity');
  });

  it('does NOT trigger with exactly 4 unique themes', () => {
    const tracker: ExtractionTracker = {
      ...minimalTracker,
      hqExtractionHistory: ['a', 'b', 'c', 'd', 'a'],
      questionCounter: 5,
    };
    const result = shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS);
    expect(result.shouldPivot).toBe(false);
  });

  it('does NOT fire diversity check on empty history', () => {
    const tracker: ExtractionTracker = {
      ...minimalTracker,
      hqExtractionHistory: [],
      questionCounter: 3,
    };
    const result = shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS);
    expect(result.shouldPivot).toBe(false);
  });

  it('does NOT trigger diversity pivot before the history reaches the full window size', () => {
    const partialHistories = [['a'], ['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd']];

    partialHistories.forEach((hqExtractionHistory) => {
      const tracker: ExtractionTracker = {
        ...minimalTracker,
        hqExtractionHistory,
        questionCounter: hqExtractionHistory.length,
      };

      const result = shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS);
      expect(result.shouldPivot).toBe(false);
    });
  });

  it('is independent of the existing pivotFlag on the tracker', () => {
    const tracker: ExtractionTracker = {
      ...minimalTracker,
      pivotFlag: true,
      hqExtractionHistory: ['a', 'b', 'c', 'd', 'e'],
      questionCounter: 3,
    };
    const result = shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS);
    expect(result.shouldPivot).toBe(false);
  });
});

describe('updateTracker', () => {
  it('increments questionCounter on every update, even without HQ', () => {
    const result = updateTracker(minimalTracker, { has_actionable_pattern: false }, 'childhood');
    expect(result.questionCounter).toBe(1);
  });

  it('does NOT append to hqExtractionHistory when not HQ', () => {
    const tracker = { ...minimalTracker, hqExtractionHistory: [] };
    const result = updateTracker(tracker, { has_actionable_pattern: false, themes_extracted: ['x'] }, 'childhood');
    expect(result.hqExtractionHistory).toEqual([]);
  });

  it('appends new themes to hqExtractionHistory on HQ extraction', () => {
    const tracker = { ...minimalTracker, hqExtractionHistory: ['a', 'b'] };
    const result = updateTracker(tracker, {
      has_actionable_pattern: true,
      themes_extracted: ['c', 'd'],
    }, 'childhood');
    expect(result.hqExtractionHistory).toEqual(['a', 'b', 'c', 'd']);
  });

  it('enforces FIFO sliding window at windowSize + 1', () => {
    const full: ExtractionTracker = {
      ...minimalTracker,
      hqExtractionHistory: ['a', 'b', 'c', 'd', 'e'],
    };
    const result = updateTracker(full, {
      has_actionable_pattern: true,
      themes_extracted: ['f'],
    }, 'childhood');
    expect(result.hqExtractionHistory).toEqual(['b', 'c', 'd', 'e', 'f']);
    expect(result.hqExtractionHistory).toHaveLength(5);
  });

  it('leaves extractedThemes unchanged when themes_extracted is empty on HQ', () => {
    const tracker = { ...minimalTracker, extractedThemes: ['foundational_event'] };
    const result = updateTracker(tracker, {
      has_actionable_pattern: true,
      themes_extracted: [],
    }, 'childhood');
    expect(result.extractedThemes).toEqual(['foundational_event']);
  });

  it('merges only unique new themes into extractedThemes', () => {
    const tracker = { ...minimalTracker, extractedThemes: ['foundational_event'] };
    const result = updateTracker(tracker, {
      has_actionable_pattern: true,
      themes_extracted: ['foundational_event', 'early_memory'],
    }, 'childhood');
    expect(result.extractedThemes).toEqual(['foundational_event', 'early_memory']);
  });

  it('strips section prefixes from themes', () => {
    const tracker = { ...minimalTracker, hqExtractionHistory: [] };
    const result = updateTracker(tracker, {
      has_actionable_pattern: true,
      themes_extracted: ['childhood: foundational_event', 'loss: grief_event'],
    }, 'childhood');
    expect(result.hqExtractionHistory).toEqual(['foundational_event', 'grief_event']);
  });

  it('skips themes that become empty after stripping (e.g. "childhood:")', () => {
    const tracker = { ...minimalTracker, hqExtractionHistory: [] };
    const result = updateTracker(tracker, {
      has_actionable_pattern: true,
      themes_extracted: ['childhood:', '  ', 'real_theme'],
    }, 'childhood');
    expect(result.hqExtractionHistory).toEqual(['real_theme']);
  });

  it('ALWAYS returns pivotFlag: false, even if tracker.pivotFlag was true', () => {
    // Contract: callers (sendMessage in use-chat.ts) own the pivotFlag decision.
    // They compute shouldTriggerPivot against this fresh state and overwrite
    // the flag before persisting. Don't "fix" this without understanding it.
    const tracker: ExtractionTracker = { ...minimalTracker, pivotFlag: true };
    const result = updateTracker(tracker, { has_actionable_pattern: false }, 'childhood');
    expect(result.pivotFlag).toBe(false);
  });

  it('updates currentSection even when no HQ extraction happens', () => {
    const result = updateTracker(minimalTracker, { has_actionable_pattern: false }, 'shame');
    expect(result.currentSection).toBe('shame');
  });

  it('accepts custom thresholds for windowSize', () => {
    const full: ExtractionTracker = {
      ...minimalTracker,
      hqExtractionHistory: ['a', 'b', 'c'],
    };
    const result = updateTracker(
      full,
      { has_actionable_pattern: true, themes_extracted: ['d'] },
      'childhood',
      { ...DEFAULT_THRESHOLDS, windowSize: 2 }
    );
    expect(result.hqExtractionHistory).toEqual(['c', 'd']);
  });
});

describe('resetTrackerForSection', () => {
  it('clears hqExtractionHistory', () => {
    const tracker: ExtractionTracker = {
      ...minimalTracker,
      hqExtractionHistory: ['a', 'b', 'c'],
    };
    expect(resetTrackerForSection(tracker, 'shame').hqExtractionHistory).toEqual([]);
  });

  it('resets questionCounter to 0', () => {
    const tracker: ExtractionTracker = { ...minimalTracker, questionCounter: 10 };
    expect(resetTrackerForSection(tracker, 'shame').questionCounter).toBe(0);
  });

  it('resets pivotFlag to false', () => {
    const tracker: ExtractionTracker = { ...minimalTracker, pivotFlag: true };
    expect(resetTrackerForSection(tracker, 'shame').pivotFlag).toBe(false);
  });

  it('updates currentSection to new section', () => {
    expect(resetTrackerForSection(minimalTracker, 'shame').currentSection).toBe('shame');
  });

  it('preserves extractedThemes (callers replace this with session data if needed)', () => {
    const tracker: ExtractionTracker = {
      ...minimalTracker,
      extractedThemes: ['foundational_event', 'early_memory', 'loss_event'],
    };
    const result = resetTrackerForSection(tracker, 'shame');
    expect(result.extractedThemes).toEqual(['foundational_event', 'early_memory', 'loss_event']);
  });
});

describe('Integration: full pivot cycle', () => {
  it('triggers pivot after HQ extractions with theme repetition', () => {
    let tracker = minimalTracker;
    for (let i = 0; i < 3; i++) {
      tracker = updateTracker(
        tracker,
        { has_actionable_pattern: true, themes_extracted: ['foundational_event'] },
        'childhood',
      );
    }
    expect(tracker.hqExtractionHistory).toEqual([
      'foundational_event',
      'foundational_event',
      'foundational_event',
    ]);
    const { shouldPivot, reason } = shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS);
    expect(shouldPivot).toBe(true);
    expect(reason).toContain('repetition');
  });

  it('does NOT trigger pivot after diverse HQ extractions', () => {
    let tracker = minimalTracker;
    for (const theme of ['a', 'b', 'c', 'd', 'e']) {
      tracker = updateTracker(
        tracker,
        { has_actionable_pattern: true, themes_extracted: [theme] },
        'childhood',
      );
    }
    expect(tracker.hqExtractionHistory).toHaveLength(5);
    expect(shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS).shouldPivot).toBe(false);
  });

  it('repetition still fires after FIFO drops earlier distinct entries', () => {
    let tracker = minimalTracker;
    // Two distinct, then three of the same — window becomes [a, b, x, x, x]
    for (const theme of ['a', 'b', 'x', 'x', 'x']) {
      tracker = updateTracker(
        tracker,
        { has_actionable_pattern: true, themes_extracted: [theme] },
        'childhood',
      );
    }
    expect(tracker.hqExtractionHistory).toEqual(['a', 'b', 'x', 'x', 'x']);
    const { shouldPivot, reason } = shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS);
    expect(shouldPivot).toBe(true);
    expect(reason).toContain('repetition');
  });

  it('write-through: caller computes shouldPivot and overwrites flag', () => {
    // Simulates the Phase 3.1 contract in use-chat.ts.
    // Seed with a diverse window so diversity/repetition are both OK initially.
    let tracker: ExtractionTracker = {
      ...minimalTracker,
      hqExtractionHistory: ['a', 'b', 'c', 'd', 'e'],
      pivotFlag: true, // stale flag from a prior turn
    };

    const trackerA = updateTracker(
      tracker,
      { has_actionable_pattern: false },
      'childhood',
    );
    // updateTracker always zeroes pivotFlag regardless of input:
    expect(trackerA.pivotFlag).toBe(false);

    // Caller recomputes and overwrites. Window is still diverse → no pivot.
    const { shouldPivot } = shouldTriggerPivot(trackerA, DEFAULT_THRESHOLDS);
    tracker = { ...trackerA, pivotFlag: shouldPivot };
    expect(tracker.pivotFlag).toBe(false);

    // Now push three same-theme HQ extractions. FIFO evicts the earliest entries.
    for (const t of ['x', 'x', 'x']) {
      tracker = updateTracker(
        tracker,
        { has_actionable_pattern: true, themes_extracted: [t] },
        'childhood',
      );
    }
    const final = shouldTriggerPivot(tracker, DEFAULT_THRESHOLDS);
    expect(final.shouldPivot).toBe(true);
    expect(final.reason).toContain('repetition');
  });
});
