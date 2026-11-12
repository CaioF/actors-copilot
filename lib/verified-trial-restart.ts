import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase.admin';
import { isRecoveryPending, type BillingRecoveryFlag } from '@/lib/billing-recovery';

function missing(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as {code?: string}).code === 'resource_missing';
}

/**
 * Honors an operator-reviewed restart for a subscription that does not exist
 * in live Stripe (for example a legacy test-mode record). Entitlements remain
 * webhook-owned; this only lets the member enter a fresh Checkout trial.
 * `sessionOnly` also checks expired offers to avoid reviving a stale paid
 * session; checkout callers must use the default expiry-enforcing mode.
 */
export async function canRestartInvalidBillingTrial(
  uid: string,
  flag: unknown,
  billing: Record<string, unknown>,
  sessionOnly = false,
): Promise<boolean> {
  // Expiry ends the trial offer, but must not resurrect the old test-mode
  // entitlement when building a session after the offer expires.
  if (!flag || typeof flag !== 'object') return false;
  const recovery = flag as Partial<BillingRecoveryFlag>;
  if (!isRecoveryPending(flag) && !(sessionOnly && recovery.required === true && !recovery.resolvedAt)) return false;
  const approved = recovery.invalidBillingRestart;
  if (!approved || typeof approved.subscriptionId !== 'string' ||
      billing.subscriptionId !== approved.subscriptionId || typeof billing.customerId !== 'string') return false;
  // Root user fields are client writable in the legacy rules. The exception
  // also requires a server-only approval document, outside /users/**.
  const authorization = (await db.doc(`billingTrialRestarts/${uid}`).get()).data();
  if (authorization?.required !== true || authorization.subscriptionId !== approved.subscriptionId ||
      typeof authorization.expiresAt !== 'string' || (!sessionOnly && Date.parse(authorization.expiresAt) <= Date.now()) ||
      !Number.isFinite(Date.parse(authorization.expiresAt))) return false;

  try {
    // A real subscription in any status cannot use this special exception.
    await stripe.subscriptions.retrieve(approved.subscriptionId);
    return false;
  } catch (error) {
    if (!missing(error)) throw error;
  }

  try {
    const customer = await stripe.customers.retrieve(billing.customerId);
    if (customer.deleted) return true;
    // Once checkout replaces the missing customer, retries may use the new
    // pointer, but only if it belongs to this UID and still has no live plan.
    if (customer.metadata.platformUserId !== uid) return false;
    const subscriptions = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 100 })
      .autoPagingToArray({ limit: 1000 });
    return subscriptions.every(s => ['canceled', 'incomplete_expired'].includes(s.status));
  } catch (error) {
    if (!missing(error)) throw error;
    return true;
  }
}
