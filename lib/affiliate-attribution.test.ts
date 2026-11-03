/** @jest-environment jsdom */

/**
 * Tests for the affiliate referral attribution.
 *
 * The attribution decides who gets the commission, so the rules that decide
 * when a referral is still valid have to be pinned: the code shape, the
 * attribution window, and the fact that an expired referral is dropped instead
 * of being revived later.
 */

import {
  AFFILIATE_STORAGE_KEY,
  AFFILIATE_WINDOW_DAYS,
  buildAffiliateAttribution,
  clearAffiliateAttribution,
  isAffiliateAttributionExpired,
  normalizeAffiliateCode,
  readAffiliateAttribution,
  saveAffiliateAttribution,
} from './affiliate-attribution';

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

describe('normalizeAffiliateCode', () => {
  it('keeps a well formed code', () => {
    expect(normalizeAffiliateCode('tracey')).toBe('tracey');
    expect(normalizeAffiliateCode('actor-42')).toBe('actor-42');
    expect(normalizeAffiliateCode('the_cfrt.uk')).toBe('the_cfrt.uk');
  });

  it('lowercases and trims the raw value', () => {
    expect(normalizeAffiliateCode('  Tracey  ')).toBe('tracey');
  });

  it('rejects a value that cannot be a code', () => {
    expect(normalizeAffiliateCode(null)).toBeNull();
    expect(normalizeAffiliateCode(undefined)).toBeNull();
    expect(normalizeAffiliateCode('')).toBeNull();
    expect(normalizeAffiliateCode('ab')).toBeNull();
    expect(normalizeAffiliateCode('a'.repeat(41))).toBeNull();
  });

  it('rejects a code with characters that would break the query string', () => {
    expect(normalizeAffiliateCode('tracey<script>')).toBeNull();
    expect(normalizeAffiliateCode('tracey&ref=other')).toBeNull();
    expect(normalizeAffiliateCode('tracey/../admin')).toBeNull();
    expect(normalizeAffiliateCode('-tracey')).toBeNull();
  });
});

describe('isAffiliateAttributionExpired', () => {
  it('keeps an attribution inside the window', () => {
    expect(
      isAffiliateAttributionExpired({ code: 'tracey', capturedAt: NOW, landingPath: '/' }, NOW),
    ).toBe(false);
    expect(
      isAffiliateAttributionExpired(
        { code: 'tracey', capturedAt: NOW - AFFILIATE_WINDOW_DAYS * DAY, landingPath: '/' },
        NOW,
      ),
    ).toBe(false);
  });

  it('expires an attribution older than the window', () => {
    expect(
      isAffiliateAttributionExpired(
        { code: 'tracey', capturedAt: NOW - (AFFILIATE_WINDOW_DAYS + 1) * DAY, landingPath: '/' },
        NOW,
      ),
    ).toBe(true);
  });
});

describe('buildAffiliateAttribution', () => {
  it('accepts a valid code inside the window', () => {
    expect(buildAffiliateAttribution('Tracey', NOW - DAY, NOW)).toEqual({
      code: 'tracey',
      capturedAt: NOW - DAY,
      landingPath: '/',
    });
  });

  it('rejects an expired attribution', () => {
    expect(
      buildAffiliateAttribution('tracey', NOW - (AFFILIATE_WINDOW_DAYS + 1) * DAY, NOW),
    ).toBeNull();
  });

  it('rejects a timestamp in the future', () => {
    expect(buildAffiliateAttribution('tracey', NOW + DAY, NOW)).toBeNull();
  });

  it('rejects a missing or malformed timestamp', () => {
    expect(buildAffiliateAttribution('tracey', undefined, NOW)).toBeNull();
    expect(buildAffiliateAttribution('tracey', Number.NaN, NOW)).toBeNull();
  });

  it('rejects an invalid code', () => {
    expect(buildAffiliateAttribution('!!', NOW, NOW)).toBeNull();
  });
});

describe('browser storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round trips an attribution', () => {
    saveAffiliateAttribution({ code: 'tracey', capturedAt: NOW, landingPath: '/upgrade' });

    expect(readAffiliateAttribution(NOW)).toEqual({
      code: 'tracey',
      capturedAt: NOW,
      landingPath: '/upgrade',
    });
  });

  it('drops an expired attribution and removes it from storage', () => {
    saveAffiliateAttribution({
      code: 'tracey',
      capturedAt: NOW - (AFFILIATE_WINDOW_DAYS + 1) * DAY,
      landingPath: '/',
    });

    expect(readAffiliateAttribution(NOW)).toBeNull();
    expect(window.localStorage.getItem(AFFILIATE_STORAGE_KEY)).toBeNull();
  });

  it('drops a stored value that is not a valid attribution', () => {
    window.localStorage.setItem(AFFILIATE_STORAGE_KEY, JSON.stringify({ code: '!!' }));

    expect(readAffiliateAttribution(NOW)).toBeNull();
    expect(window.localStorage.getItem(AFFILIATE_STORAGE_KEY)).toBeNull();
  });

  it('clears the attribution on request', () => {
    saveAffiliateAttribution({ code: 'tracey', capturedAt: NOW, landingPath: '/' });
    clearAffiliateAttribution();

    expect(readAffiliateAttribution(NOW)).toBeNull();
  });
});
