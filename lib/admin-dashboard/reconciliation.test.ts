import {
  isInsideTrialWindow,
  isLiveSubscriptionStatus,
  reconcileMember,
  reconcileMembers,
  type BillingDocumentSnapshot,
  type PriceTierMapper,
  type StripeSubscriptionSnapshot,
  type StripeSubscriptionStatus,
} from './reconciliation';

const NOW = 1_800_000_000;

/**
 * Maps the two prices the tests use. Anything else is an unknown price.
 */
const mapPriceToTier: PriceTierMapper = (priceId) => {
  if (priceId === 'price_economy') return 'economy';
  if (priceId === 'price_business') return 'business';
  return 'free';
};

function billing(
  overrides: Partial<BillingDocumentSnapshot> = {},
): BillingDocumentSnapshot {
  return {
    uid: 'user-123',
    email: 'actor@example.com',
    tier: 'business',
    status: 'active',
    hasAccess: true,
    subscriptionId: 'sub_123',
    customerId: 'cus_123',
    priceId: 'price_business',
    currentPeriodEnd: 1_803_888_000,
    trialEnd: null,
    cancelAtPeriodEnd: false,
    cancelAt: null,
    accountExists: true,
    ...overrides,
  };
}

function subscription(
  overrides: Partial<StripeSubscriptionSnapshot> = {},
): StripeSubscriptionSnapshot {
  return {
    subscriptionId: 'sub_123',
    customerId: 'cus_123',
    status: 'active',
    currentPeriodEnd: 1_803_888_000,
    trialEnd: null,
    cancelAtPeriodEnd: false,
    cancelAt: null,
    priceId: 'price_business',
    ...overrides,
  };
}

function reasons(member: ReturnType<typeof reconcileMember>): string[] {
  return member.divergences.map((divergence) => divergence.reason);
}

describe('isLiveSubscriptionStatus', () => {
  it.each<{ status: StripeSubscriptionStatus | null | undefined; expected: boolean }>([
    { status: 'active', expected: true },
    { status: 'trialing', expected: true },
    { status: 'past_due', expected: true },
    { status: 'unpaid', expected: true },
    { status: 'incomplete', expected: true },
    { status: 'incomplete_expired', expected: true },
    { status: 'paused', expected: true },
    { status: 'canceled', expected: false },
    { status: null, expected: false },
    { status: undefined, expected: false },
  ])('reports $status as live=$expected', ({ status, expected }) => {
    expect(isLiveSubscriptionStatus(status)).toBe(expected);
  });
});

describe('reconcileMember', () => {
  it('reports no divergence when both sources agree', () => {
    const member = reconcileMember(
      billing(),
      [subscription()],
      mapPriceToTier,
    );

    expect(member.divergences).toEqual([]);
    expect(member.severity).toBe('none');
    expect(member.stripeStatus).toBe('active');
  });

  it('reports a critical divergence when access is granted without a live subscription', () => {
    const member = reconcileMember(
      billing(),
      [],
      mapPriceToTier,
    );

    expect(reasons(member)).toContain('access_without_subscription');
    expect(member.severity).toBe('critical');
  });

  it('does not report access without a subscription when the account has no access', () => {
    const member = reconcileMember(
      billing({ hasAccess: false, status: 'canceled', tier: 'free' }),
      [],
      mapPriceToTier,
    );

    expect(reasons(member)).not.toContain('access_without_subscription');
  });

  it('reports a critical divergence when the subscription is gone from Stripe', () => {
    const member = reconcileMember(
      billing(),
      [],
      mapPriceToTier,
    );

    expect(reasons(member)).toContain('subscription_not_found');
  });

  it('reports a warning when Firestore points at a different subscription than the live one', () => {
    const member = reconcileMember(
      billing({ subscriptionId: 'sub_old' }),
      [
        subscription({ subscriptionId: 'sub_old', status: 'canceled' }),
        subscription({ subscriptionId: 'sub_new' }),
      ],
      mapPriceToTier,
    );

    expect(reasons(member)).toContain('subscription_mismatch');
    expect(member.stripeStatus).toBe('active');
  });

  it('reports a warning when the statuses differ', () => {
    const member = reconcileMember(
      billing({ status: 'canceled' }),
      [subscription({ status: 'active' })],
      mapPriceToTier,
    );

    expect(reasons(member)).toContain('status_mismatch');
    expect(member.severity).toBe('warning');
  });

  it('reports a warning when the tiers differ', () => {
    const member = reconcileMember(
      billing({ tier: 'business', priceId: 'price_business' }),
      [subscription({ priceId: 'price_economy' })],
      mapPriceToTier,
    );

    expect(reasons(member)).toContain('tier_mismatch');
  });

  it('reports a warning when the period ends differ', () => {
    const member = reconcileMember(
      billing({ currentPeriodEnd: 1_803_888_000 }),
      [subscription({ currentPeriodEnd: 1_900_000_000 })],
      mapPriceToTier,
    );

    expect(reasons(member)).toContain('period_end_mismatch');
  });

  it('keeps a critical divergence critical even when other warnings exist', () => {
    const member = reconcileMember(
      billing({ subscriptionId: 'sub_gone', tier: 'business' }),
      [subscription({ subscriptionId: 'sub_other', priceId: 'price_economy' })],
      mapPriceToTier,
    );

    expect(member.severity).toBe('critical');
    expect(reasons(member)).toContain('subscription_not_found');
    expect(reasons(member)).toContain('tier_mismatch');
  });

  it('exposes the end of the trial or of the period, preferring the trial', () => {
    const member = reconcileMember(
      billing({ trialEnd: NOW + 86_400, currentPeriodEnd: NOW + 86_400 * 30 }),
      [subscription()],
      mapPriceToTier,
    );

    expect(member.endsAt).toBe(NOW + 86_400);
  });

  it('does not treat a trialing subscription as absent', () => {
    const member = reconcileMember(
      billing({ status: 'trialing', trialEnd: NOW + 86_400 }),
      [subscription({ status: 'trialing', trialEnd: NOW + 86_400 })],
      mapPriceToTier,
    );

    expect(member.severity).toBe('none');
    expect(member.stripeStatus).toBe('trialing');
  });

  it('reports a critical divergence when a deleted account is still billed', () => {
    const member = reconcileMember(
      billing({ accountExists: false }),
      [subscription()],
      mapPriceToTier,
    );

    expect(reasons(member)).toContain('deleted_account_still_billing');
    expect(member.severity).toBe('critical');
    expect(member.accountExists).toBe(false);
  });

  it('does not report a deleted account as still billed when Stripe has no live subscription', () => {
    const member = reconcileMember(
      billing({ accountExists: false, status: 'canceled', hasAccess: false, tier: 'free' }),
      [],
      mapPriceToTier,
    );

    expect(reasons(member)).not.toContain('deleted_account_still_billing');
  });
});

describe('reconcileMembers', () => {
  const billingDocuments = [
    billing({ uid: 'clean', subscriptionId: 'sub_clean', customerId: 'cus_clean' }),
    billing({ uid: 'orphan-access', subscriptionId: 'sub_gone', customerId: 'cus_gone' }),
  ];

  const stripeSubscriptions = [
    subscription({ subscriptionId: 'sub_clean', customerId: 'cus_clean' }),
    subscription({ subscriptionId: 'sub_stray', customerId: 'cus_stray' }),
  ];

  it('counts the members by severity', () => {
    const report = reconcileMembers(
      billingDocuments,
      stripeSubscriptions,
      mapPriceToTier,
      NOW,
    );

    expect(report.cleanCount).toBe(1);
    expect(report.criticalCount).toBe(1);
    expect(report.warningCount).toBe(0);
  });

  it('reports a live subscription that no account owns as an orphan', () => {
    const report = reconcileMembers(
      billingDocuments,
      stripeSubscriptions,
      mapPriceToTier,
      NOW,
    );

    expect(report.orphans).toHaveLength(1);
    expect(report.orphans[0]).toMatchObject({
      subscriptionId: 'sub_stray',
      customerId: 'cus_stray',
      status: 'active',
      tier: 'business',
    });
  });

  it('does not report a canceled subscription as an orphan', () => {
    const report = reconcileMembers(
      billingDocuments,
      [
        ...stripeSubscriptions,
        subscription({ subscriptionId: 'sub_old', customerId: 'cus_old', status: 'canceled' }),
      ],
      mapPriceToTier,
      NOW,
    );

    expect(report.orphans.map((orphan) => orphan.subscriptionId)).not.toContain('sub_old');
  });

  it('counts every divergence reason in the report', () => {
    const report = reconcileMembers(
      billingDocuments,
      stripeSubscriptions,
      mapPriceToTier,
      NOW,
    );

    expect(report.counts.access_without_subscription).toBe(1);
    expect(report.counts.subscription_not_found).toBe(1);
    expect(report.counts.tier_mismatch).toBe(0);
    expect(report.counts.period_end_mismatch).toBe(0);
    expect(report.counts.deleted_account_still_billing).toBe(0);
  });

  it('is reproducible: the same inputs produce the same report', () => {
    const first = reconcileMembers(billingDocuments, stripeSubscriptions, mapPriceToTier, NOW);
    const second = reconcileMembers(billingDocuments, stripeSubscriptions, mapPriceToTier, NOW);

    expect(second).toEqual(first);
  });
});

describe('isInsideTrialWindow', () => {
  it('reports an open window while the trial end is in the future', () => {
    expect(isInsideTrialWindow(NOW + 86_400, NOW)).toBe(true);
  });

  it('reports a closed window once the trial end has passed', () => {
    expect(isInsideTrialWindow(NOW - 1, NOW)).toBe(false);
  });

  it('reports a closed window when there is no trial end', () => {
    expect(isInsideTrialWindow(null, NOW)).toBe(false);
  });
});
