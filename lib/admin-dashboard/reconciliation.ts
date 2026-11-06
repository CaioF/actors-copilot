/**
 * Reconciliation between the Firestore billing state and the live Stripe
 * state, for the admin dashboard.
 *
 * The dashboard must not repeat the mistake the projection made: it shows
 * what the account believes about itself, not what Stripe believes. This
 * module takes both sides and reports where they disagree.
 *
 * It is deliberately pure. Every function here takes plain data and returns
 * plain data, so the rules can be tested without Firestore or Stripe, and the
 * same rules can run against production data from a script.
 */

/**
 * The Stripe status of a subscription, as far as this module cares.
 */
export type StripeSubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'
  | 'canceled';

/**
 * The billing state a member account believes it is in.
 */
export type BillingStatus =
  | 'active'
  | 'trialing'
  | 'canceled'
  | 'past_due'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

/**
 * The subset of a Stripe subscription this module reads.
 */
export interface StripeSubscriptionSnapshot {
  subscriptionId: string;
  customerId: string | null;
  status: StripeSubscriptionStatus;
  /** Epoch seconds. Null when Stripe does not report a period end. */
  currentPeriodEnd: number | null;
  /** Epoch seconds. Null when there is no trial. */
  trialEnd: number | null;
  cancelAtPeriodEnd: boolean;
  /** Epoch seconds. Null when the subscription is not scheduled to cancel. */
  cancelAt: number | null;
  priceId: string | null;
}

/**
 * The subset of a Firestore billing document this module reads.
 */
export interface BillingDocumentSnapshot {
  uid: string;
  email: string | null;
  tier: 'free' | 'economy' | 'business';
  status: BillingStatus | null;
  hasAccess: boolean | null;
  subscriptionId: string | null;
  customerId: string | null;
  priceId: string | null;
  /** Epoch seconds. */
  currentPeriodEnd: number | null;
  /** Epoch seconds. */
  trialEnd: number | null;
  cancelAtPeriodEnd: boolean;
  /** Epoch seconds. */
  cancelAt: number | null;
  /**
   * Whether the Firebase Authentication account still exists.
   *
   * A billing document outlives the account it belongs to, and that is the
   * case that keeps billing after the member is gone.
   */
  accountExists: boolean;
}

/**
 * Why a member's two sources of truth disagree.
 *
 * The ordering matters: the first matching reason is the one reported, so
 * the list runs from "the entitlement is wrong" to "the metadata is stale".
 */
export type DivergenceReason =
  /** Firestore grants access but Stripe has no live subscription. */
  | 'access_without_subscription'
  /** Firestore points at a subscription that Stripe no longer has. */
  | 'subscription_not_found'
  /** Firestore points at a subscription while Stripe has a different one. */
  | 'subscription_mismatch'
  /** The stored status is not the status Stripe reports. */
  | 'status_mismatch'
  /** The stored tier is not the tier the Stripe price maps to. */
  | 'tier_mismatch'
  /** The stored period end does not match the Stripe period end. */
  | 'period_end_mismatch'
  /**
   * The account was deleted from Firebase Authentication but Stripe still
   * bills it.
   */
  | 'deleted_account_still_billing';

/**
 * The severity of a divergence, from most to least urgent.
 *
 * - `critical`: the member has access they are not paying for, or pays for
 *   access they do not have. An operator has to act.
 * - `warning`: the two sides disagree about a detail. The member is still
 *   served correctly, but the dashboard would be showing something stale.
 * - `none`: the two sides agree.
 */
export type DivergenceSeverity = 'critical' | 'warning' | 'none';

export interface Divergence {
  reason: DivergenceReason;
  severity: DivergenceSeverity;
  /** Human-readable detail for the report. Carries no PII beyond the uid. */
  detail: string;
}

/**
 * The reconciled view of one member account.
 */
export interface ReconciledMember {
  uid: string;
  email: string | null;
  tier: 'free' | 'economy' | 'business';
  /** The status the billing document reports. */
  billingStatus: BillingStatus | null;
  /** The status Stripe reports, or null when Stripe has no subscription. */
  stripeStatus: StripeSubscriptionStatus | null;
  /** The subscription id the billing document points at. */
  subscriptionId: string | null;
  customerId: string | null;
  /** True when the account has access in Firestore. */
  hasAccess: boolean;
  /** True when the Firebase Authentication account still exists. */
  accountExists: boolean;
  /** Epoch seconds. The end of the trial or of the current period. */
  endsAt: number | null;
  cancelAtPeriodEnd: boolean;
  divergences: Divergence[];
  severity: DivergenceSeverity;
}

/**
 * A member that exists in Stripe but whose account was deleted from
 * Firebase Authentication.
 *
 * This is the case that can still bill: the account is gone from the app,
 * but the subscription keeps renewing.
 */
export interface OrphanSubscription {
  subscriptionId: string;
  customerId: string | null;
  status: StripeSubscriptionStatus;
  email: string | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  tier: 'free' | 'economy' | 'business';
}

/**
 * The result of reconciling the whole member base.
 */
export interface ReconciliationReport {
  /** Epoch seconds used to evaluate the trial and period windows. */
  now: number;
  members: ReconciledMember[];
  orphans: OrphanSubscription[];
  /** Counts per divergence reason. */
  counts: Record<DivergenceReason, number>;
  /** How many members diverge in a critical way. */
  criticalCount: number;
  /** How many members diverge in a non-critical way. */
  warningCount: number;
  /** Members whose two sources agree. */
  cleanCount: number;
}

const DIVERGENCE_REASONS: DivergenceReason[] = [
  'access_without_subscription',
  'subscription_not_found',
  'subscription_mismatch',
  'status_mismatch',
  'tier_mismatch',
  'period_end_mismatch',
  'deleted_account_still_billing',
];

/**
 * Stripe statuses that represent a subscription that still bills or serves.
 */
const LIVE_SUBSCRIPTION_STATUSES: ReadonlySet<StripeSubscriptionStatus> = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'incomplete',
  'incomplete_expired',
  'paused',
]);

/**
 * Reports whether a Stripe subscription is still live.
 *
 * A canceled subscription is the only status that means "gone"; the others
 * still represent a subscription Stripe bills, even when the payment failed.
 *
 * @param status - The status Stripe reports.
 * @returns True when the subscription is not canceled.
 */
export function isLiveSubscriptionStatus(
  status: StripeSubscriptionStatus | null | undefined,
): boolean {
  if (!status) {
    return false;
  }

  return status !== 'canceled' && LIVE_SUBSCRIPTION_STATUSES.has(status);
}

/**
 * Reports whether the account is entitled to access according to its own
 * billing document.
 *
 * @param billing - The billing document snapshot.
 * @returns True when the document grants access.
 */
export function grantsAccess(billing: BillingDocumentSnapshot): boolean {
  return billing.hasAccess === true;
}

/**
 * The tier a Stripe price maps to.
 *
 * The mapping is injected so this module stays free of Stripe and env
 * dependencies: the caller passes the mapper that already exists in
 * `lib/billing.ts`.
 */
export type PriceTierMapper = (priceId: string | undefined) =>
  | 'free'
  | 'economy'
  | 'business';

/**
 * Reconciles one member account against the live Stripe state.
 *
 * The rules, in the order they are applied:
 *
 * 1. Firestore grants access but Stripe has no live subscription. The
 *    account is served without anyone paying. This is the most serious
 *    divergence, because it is both an inflated member count and free
 *    access.
 * 2. The subscription the document points at is gone from Stripe.
 * 3. Stripe has a live subscription the document does not know about. The
 *    document points at an older subscription, so a link to Stripe from the
 *    dashboard would land on a dead subscription.
 * 4. The statuses differ.
 * 5. The tiers differ.
 * 6. The period ends differ.
 *
 * @param billing - The billing document of the account.
 * @param stripeSubscriptions - Every Stripe subscription visible to the app.
 * @param mapPriceToTier - Maps a Stripe price id to a platform tier.
 * @returns The reconciled member, with the divergences that were found.
 */
export function reconcileMember(
  billing: BillingDocumentSnapshot,
  stripeSubscriptions: readonly StripeSubscriptionSnapshot[],
  mapPriceToTier: PriceTierMapper,
): ReconciledMember {
  const divergences: Divergence[] = [];

  const subscriptionById = new Map(
    stripeSubscriptions.map((subscription) => [subscription.subscriptionId, subscription]),
  );

  // The subscription the account claims to have.
  const claimed = billing.subscriptionId
    ? subscriptionById.get(billing.subscriptionId) ?? null
    : null;

  // The subscription Stripe actually has for this customer. A customer can
  // only have one live subscription per price, so the live one wins.
  const live = stripeSubscriptions.find(
    (subscription) =>
      isLiveSubscriptionStatus(subscription.status) &&
      subscription.customerId !== null &&
      subscription.customerId === billing.customerId,
  ) ?? null;

  const stripeStatus = live?.status ?? null;

  if (grantsAccess(billing) && !live) {
    divergences.push({
      reason: 'access_without_subscription',
      severity: 'critical',
      detail: `Firestore grants access (tier ${billing.tier}) but Stripe has no live subscription for customer ${billing.customerId ?? 'none'}.`,
    });
  }

  if (billing.subscriptionId && !claimed) {
    divergences.push({
      reason: 'subscription_not_found',
      severity: 'critical',
      detail: `Firestore points at subscription ${billing.subscriptionId}, which Stripe no longer has.`,
    });
  }

  if (
    claimed
    && live
    && claimed.subscriptionId !== live.subscriptionId
  ) {
    divergences.push({
      reason: 'subscription_mismatch',
      severity: 'warning',
      detail: `Firestore points at subscription ${claimed.subscriptionId}, but Stripe has the live subscription ${live.subscriptionId} for the same customer.`,
    });
  }

  if (stripeStatus && billing.status && stripeStatus !== billing.status) {
    divergences.push({
      reason: 'status_mismatch',
      severity: 'warning',
      detail: `Firestore reports status ${billing.status}, Stripe reports ${stripeStatus}.`,
    });
  }

  if (live && live.priceId) {
    const stripeTier = mapPriceToTier(live.priceId);

    if (stripeTier !== billing.tier) {
      divergences.push({
        reason: 'tier_mismatch',
        severity: 'warning',
        detail: `Firestore reports tier ${billing.tier}, Stripe price ${live.priceId} maps to tier ${stripeTier}.`,
      });
    }
  }

  if (
    live
    && billing.currentPeriodEnd !== null
    && live.currentPeriodEnd !== null
    && billing.currentPeriodEnd !== live.currentPeriodEnd
  ) {
    divergences.push({
      reason: 'period_end_mismatch',
      severity: 'warning',
      detail: `Firestore reports the period ending ${billing.currentPeriodEnd}, Stripe reports ${live.currentPeriodEnd}.`,
    });
  }

  if (!billing.accountExists && live) {
    divergences.push({
      reason: 'deleted_account_still_billing',
      severity: 'critical',
      detail: `The Firebase account was deleted but Stripe still bills subscription ${live.subscriptionId} (status ${live.status}).`,
    });
  }

  const severity: DivergenceSeverity = divergences.some(
    (divergence) => divergence.severity === 'critical',
  )
    ? 'critical'
    : divergences.length > 0
      ? 'warning'
      : 'none';

  return {
    uid: billing.uid,
    email: billing.email,
    tier: billing.tier,
    billingStatus: billing.status,
    stripeStatus,
    subscriptionId: billing.subscriptionId,
    customerId: billing.customerId,
    hasAccess: grantsAccess(billing),
    accountExists: billing.accountExists,
    endsAt: billing.trialEnd ?? billing.currentPeriodEnd,
    cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
    divergences,
    severity,
  };
}

/**
 * Reconciles every billing document against the live Stripe state.
 *
 * @param billingDocuments - Every billing document of the member base.
 * @param stripeSubscriptions - Every Stripe subscription visible to the app.
 * @param mapPriceToTier - Maps a Stripe price id to a platform tier.
 * @param now - Epoch seconds used to evaluate the trial and period windows.
 * @returns The full reconciliation report.
 */
export function reconcileMembers(
  billingDocuments: readonly BillingDocumentSnapshot[],
  stripeSubscriptions: readonly StripeSubscriptionSnapshot[],
  mapPriceToTier: PriceTierMapper,
  now = Math.floor(Date.now() / 1000),
): ReconciliationReport {
  const members = billingDocuments.map((billing) =>
    reconcileMember(billing, stripeSubscriptions, mapPriceToTier),
  );

  const knownCustomers = new Set(
    billingDocuments
      .map((billing) => billing.customerId)
      .filter((customerId): customerId is string => customerId !== null),
  );

  const knownSubscriptions = new Set(
    billingDocuments
      .map((billing) => billing.subscriptionId)
      .filter((subscriptionId): subscriptionId is string => subscriptionId !== null),
  );

  const orphans: OrphanSubscription[] = stripeSubscriptions
    .filter(
      (subscription) =>
        isLiveSubscriptionStatus(subscription.status) &&
        !knownSubscriptions.has(subscription.subscriptionId) &&
        (subscription.customerId === null || !knownCustomers.has(subscription.customerId)),
    )
    .map((subscription) => ({
      subscriptionId: subscription.subscriptionId,
      customerId: subscription.customerId,
      status: subscription.status,
      email: null,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      tier: subscription.priceId ? mapPriceToTier(subscription.priceId) : 'free',
    }));

  const counts = DIVERGENCE_REASONS.reduce(
    (accumulator, reason) => {
      accumulator[reason] = members.filter((member) =>
        member.divergences.some((divergence) => divergence.reason === reason),
      ).length;

      return accumulator;
    },
    {} as Record<DivergenceReason, number>,
  );

  return {
    now,
    members,
    orphans,
    counts,
    criticalCount: members.filter((member) => member.severity === 'critical').length,
    warningCount: members.filter((member) => member.severity === 'warning').length,
    cleanCount: members.filter((member) => member.severity === 'none').length,
  };
}

/**
 * Reports whether a member is inside an open trial window.
 *
 * @param trialEnd - Epoch seconds when the trial ends, when known.
 * @param now - Epoch seconds to evaluate the window against.
 * @returns True while the trial window is still open.
 */
export function isInsideTrialWindow(
  trialEnd: number | null,
  now: number,
): boolean {
  return typeof trialEnd === 'number' && Number.isFinite(trialEnd) && trialEnd > now;
}
