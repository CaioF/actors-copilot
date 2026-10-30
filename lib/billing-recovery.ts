import { db } from '@/lib/firebase.admin';
import { logger } from '@/lib/logger';
import type { SubscriptionTier } from '@/lib/billing';
import { DEFAULT_CURRENCY, type RequestedCurrency } from '@/lib/plan-selection';

/**
 * Billing recovery flag.
 *
 * Marks an account whose checkout attempt failed because of a server-side
 * configuration fault (e.g. inactive Stripe Price IDs). While the flag is
 * pending, the login callback re-opens a checkout session so the user can
 * complete the purchase instead of being stuck on the upgrade screen.
 *
 * The flag never grants entitlement on its own: the subscription is still
 * created by Stripe and persisted by the webhook.
 */
export interface BillingRecoveryFlag {
  required: boolean;
  tier: SubscriptionTier;
  currency?: RequestedCurrency;
  reason?: string;
  attempt?: number;
  lastAttemptAt?: string | null;
  expiresAt?: string | null;
  resolvedAt?: string | null;
}

export const DEFAULT_RECOVERY_TIER: SubscriptionTier = 'business';
export const DEFAULT_RECOVERY_CURRENCY: RequestedCurrency = DEFAULT_CURRENCY;

/**
 * Decides whether a stored recovery flag must still be honoured.
 *
 * A flag is pending when it is explicitly required, has not been resolved and
 * has not expired.
 *
 * @param flag - The raw flag value read from Firestore.
 * @returns {boolean} True when the checkout recovery flow must run.
 */
export function isRecoveryPending(flag: unknown): flag is BillingRecoveryFlag {
  if (!flag || typeof flag !== 'object') return false;

  const candidate = flag as BillingRecoveryFlag;
  if (candidate.required !== true) return false;
  if (candidate.resolvedAt) return false;

  if (candidate.expiresAt) {
    const expiry = new Date(candidate.expiresAt).getTime();
    if (!Number.isNaN(expiry) && expiry < Date.now()) return false;
  }

  return true;
}

/**
 * Reads the pending billing recovery flag for a platform user.
 *
 * @param uid - The platform user identifier.
 * @returns {Promise<BillingRecoveryFlag | null>} The pending flag, or null when absent/expired.
 */
export async function readBillingRecoveryFlag(uid: string): Promise<BillingRecoveryFlag | null> {
  try {
    const snap = await db.doc(`users/${uid}`).get();
    if (!snap.exists) return null;

    const raw = (snap.data() ?? {}).billingRecovery as BillingRecoveryFlag | undefined;
    return isRecoveryPending(raw) ? raw : null;
  } catch (error) {
    logger.warn({ err: error, msg: 'Could not read the billing recovery flag' });
    return null;
  }
}

/**
 * Marks a recovery flag as satisfied once the subscription really exists.
 *
 * Uses dotted field paths so the rest of the flag payload survives the update.
 *
 * @param uid - The platform user identifier.
 */
export async function markBillingRecoveryResolved(uid: string): Promise<void> {
  try {
    await db.doc(`users/${uid}`).update({
      'billingRecovery.required': false,
      'billingRecovery.resolvedAt': new Date().toISOString(),
    } as Record<string, unknown>);
  } catch (error) {
    logger.warn({ err: error, msg: 'Could not clear the billing recovery flag' });
  }
}
