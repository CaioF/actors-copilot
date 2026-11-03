/**
 * Affiliate referral attribution.
 *
 * The referral link carries `?ref=CODE`. The code is captured in the browser on
 * the first landing, kept for the attribution window and written to Firestore
 * once, when the account is created.
 *
 * Stripe is never involved in the attribution: the commission is computed by
 * joining the attributed accounts with the Stripe customer id that the billing
 * document already stores. That keeps the referral flow completely outside the
 * entitlement path, where the webhook is the only writer.
 */

/** Query parameter that carries the affiliate code on the referral link. */
export const AFFILIATE_PARAM = 'ref';

/** Storage key of the captured attribution in the browser. */
export const AFFILIATE_STORAGE_KEY = 'affiliate_attribution';

/**
 * How long a captured referral keeps its value.
 *
 * Long enough to cover the decision cycle of an actor who researches for weeks
 * before signing up, short enough that an affiliate can defend the attribution
 * of a customer who complains about it.
 */
export const AFFILIATE_WINDOW_DAYS = 60;

/** Default commission rate applied to the net amount collected. */
export const DEFAULT_COMMISSION_RATE = 0.3;

const MIN_CODE_LENGTH = 3;
const MAX_CODE_LENGTH = 40;
const CODE_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export interface AffiliateAttribution {
  /** Normalized affiliate code. */
  code: string;
  /** Epoch milliseconds of the moment the referral link was opened. */
  capturedAt: number;
  /** Path where the referral link was opened, for the operator's reference. */
  landingPath: string;
}

/**
 * Normalizes a raw referral code.
 *
 * @param raw - The value taken from the query string.
 * @returns The normalized code, or null when the value cannot be a code.
 */
export function normalizeAffiliateCode(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const value = raw.trim().toLowerCase();

  if (!CODE_PATTERN.test(value)) return null;
  if (value.length < MIN_CODE_LENGTH || value.length > MAX_CODE_LENGTH) return null;

  return value;
}

/**
 * Tells whether a captured attribution is still inside the attribution window.
 *
 * @param attribution - The captured attribution.
 * @param now - Current epoch milliseconds.
 * @returns True when the attribution expired.
 */
export function isAffiliateAttributionExpired(
  attribution: AffiliateAttribution,
  now: number = Date.now(),
): boolean {
  const windowMs = AFFILIATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  return now - attribution.capturedAt > windowMs;
}

/**
 * Builds an attribution from a raw code without touching the browser storage.
 *
 * Used by the server to validate what the client claims.
 *
 * @param rawCode - The code sent by the client.
 * @param capturedAt - Epoch milliseconds of the moment the link was opened.
 * @param now - Current epoch milliseconds.
 * @returns The attribution when the code and the window are valid.
 */
export function buildAffiliateAttribution(
  rawCode: string | null | undefined,
  capturedAt: number | number | undefined,
  now: number = Date.now(),
): AffiliateAttribution | null {
  const code = normalizeAffiliateCode(rawCode);

  if (!code) return null;
  if (!Number.isFinite(capturedAt as number)) return null;

  const timestamp = capturedAt as number;

  // A timestamp in the future means the client is inventing one.
  if (timestamp > now) return null;

  const attribution: AffiliateAttribution = { code, capturedAt: timestamp, landingPath: '/' };

  if (isAffiliateAttributionExpired(attribution, now)) return null;

  return attribution;
}

/**
 * Captures a referral code and persists it in the browser.
 *
 * @param rawCode - The code taken from the query string.
 * @param landingPath - Path where the referral link was opened.
 * @param now - Current epoch milliseconds.
 * @returns The stored attribution, or null when the code is not valid.
 */
export function captureAffiliateAttribution(
  rawCode: string | null | undefined,
  landingPath: string,
  now: number = Date.now(),
): AffiliateAttribution | null {
  const code = normalizeAffiliateCode(rawCode);

  if (!code) return null;

  const attribution: AffiliateAttribution = {
    code,
    capturedAt: now,
    landingPath: landingPath || '/',
  };

  saveAffiliateAttribution(attribution);

  return attribution;
}

/**
 * Persists the attribution in the browser.
 *
 * `localStorage` and not `sessionStorage`: the referral has to survive the tab
 * being closed and the email verification round trip.
 *
 * @param attribution - The attribution to persist.
 */
export function saveAffiliateAttribution(attribution: AffiliateAttribution): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(AFFILIATE_STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // Storage can be unavailable (private mode); the referral is simply lost.
  }
}

/**
 * Reads the persisted attribution while it is still inside the window.
 *
 * An expired attribution is removed instead of being returned, so a stale code
 * cannot be revived by a later visit.
 *
 * @param now - Current epoch milliseconds.
 * @returns The stored attribution, or null when there is none or it expired.
 */
export function readAffiliateAttribution(now: number = Date.now()): AffiliateAttribution | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(AFFILIATE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AffiliateAttribution>;
    const code = normalizeAffiliateCode(parsed.code);
    const capturedAt = parsed.capturedAt;

    if (!code || !Number.isFinite(capturedAt as number)) {
      clearAffiliateAttribution();
      return null;
    }

    const attribution: AffiliateAttribution = {
      code,
      capturedAt: capturedAt as number,
      landingPath: typeof parsed.landingPath === 'string' ? parsed.landingPath : '/',
    };

    if (isAffiliateAttributionExpired(attribution, now)) {
      clearAffiliateAttribution();
      return null;
    }

    return attribution;
  } catch {
    return null;
  }
}

/**
 * Removes the persisted attribution.
 */
export function clearAffiliateAttribution(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(AFFILIATE_STORAGE_KEY);
  } catch {
    // ignore
  }
}
