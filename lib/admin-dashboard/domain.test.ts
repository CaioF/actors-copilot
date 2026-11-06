import {
  type AdminMemberProjection,
  classifyMembership,
  isTrialWindowOpen,
  resolveAdminDisplayName,
  resolveMembershipState,
} from './domain';

describe('classifyMembership', () => {
  it.each([
    { status: 'trialing', cancelAtPeriodEnd: false, expected: 'trial' },
    { status: 'trialing', cancelAtPeriodEnd: true, expected: 'trial' },
    { status: 'active', cancelAtPeriodEnd: false, expected: 'paid' },
    { status: 'active', cancelAtPeriodEnd: true, expected: 'paid_cancelling' },
    { status: 'past_due', cancelAtPeriodEnd: false, expected: 'past_due' },
    { status: 'paused', cancelAtPeriodEnd: false, expected: 'paused' },
    { status: 'incomplete', cancelAtPeriodEnd: false, expected: 'incomplete' },
    { status: 'incomplete_expired', cancelAtPeriodEnd: false, expected: 'incomplete_expired' },
    { status: 'unpaid', cancelAtPeriodEnd: false, expected: 'unpaid' },
    { status: 'canceled', cancelAtPeriodEnd: false, expected: 'canceled' },
    { status: null, cancelAtPeriodEnd: false, expected: 'no_plan' },
    { status: undefined, cancelAtPeriodEnd: false, expected: 'no_plan' },
    { status: 'future_stripe_status', cancelAtPeriodEnd: false, expected: 'inactive' },
  ])('maps $status to $expected', ({ status, cancelAtPeriodEnd, expected }) => {
    expect(classifyMembership(status, cancelAtPeriodEnd)).toBe(expected);
  });
});

describe('isTrialWindowOpen', () => {
  const now = 1_800_000_000;

  it.each([
    { trialStart: now - 86_400, trialEnd: now + 86_400, expected: true },
    { trialStart: null, trialEnd: now + 86_400, expected: true },
    { trialStart: now - 86_400, trialEnd: now, expected: false },
    { trialStart: now - 86_400, trialEnd: now - 1, expected: false },
    { trialStart: now + 86_400, trialEnd: now + 172_800, expected: false },
    { trialStart: null, trialEnd: null, expected: false },
    { trialStart: now - 86_400, trialEnd: undefined, expected: false },
  ])(
    'reports the window $trialStart -> $trialEnd as $expected',
    ({ trialStart, trialEnd, expected }) => {
      expect(isTrialWindowOpen(trialStart, trialEnd, now)).toBe(expected);
    },
  );
});

describe('resolveMembershipState', () => {
  const now = 1_800_000_000;

  it('keeps a trialing status as a trial', () => {
    expect(
      resolveMembershipState({
        status: 'trialing',
        trialStart: now - 86_400,
        trialEnd: now + 86_400,
        now,
      }),
    ).toBe('trial');
  });

  it('reports an active subscription with an open trial window as a trial', () => {
    expect(
      resolveMembershipState({
        status: 'active',
        trialStart: now - 86_400,
        trialEnd: now + 86_400,
        now,
      }),
    ).toBe('trial');
  });

  it('reports an active subscription without a trial window as paid', () => {
    expect(
      resolveMembershipState({
        status: 'active',
        trialStart: now - 86_400 * 30,
        trialEnd: now - 86_400,
        now,
      }),
    ).toBe('paid');
  });

  it('reports an active subscription that will cancel as paid and canceling', () => {
    expect(
      resolveMembershipState({
        status: 'active',
        cancelAtPeriodEnd: true,
        now,
      }),
    ).toBe('paid_cancelling');
  });

  it('never overrides a status that is not active', () => {
    expect(
      resolveMembershipState({
        status: 'canceled',
        trialStart: now - 86_400,
        trialEnd: now + 86_400,
        now,
      }),
    ).toBe('canceled');
    expect(resolveMembershipState({ status: 'past_due', now })).toBe('past_due');
    expect(resolveMembershipState({ status: null, now })).toBe('no_plan');
  });
});

describe('resolveAdminDisplayName', () => {
  it.each([
    {
      actorFullName: '  Actor Profile Name  ',
      authDisplayName: 'Auth Name',
      expected: 'Actor Profile Name',
    },
    {
      actorFullName: '   ',
      authDisplayName: '  Auth Name  ',
      expected: 'Auth Name',
    },
    { actorFullName: '   ', authDisplayName: '\t', expected: 'Actor' },
    { actorFullName: null, authDisplayName: null, expected: 'Actor' },
    { actorFullName: undefined, authDisplayName: undefined, expected: 'Actor' },
  ])(
    'resolves actor=$actorFullName and auth=$authDisplayName to $expected',
    ({ actorFullName, authDisplayName, expected }) => {
      expect(resolveAdminDisplayName(actorFullName, authDisplayName)).toBe(expected);
    },
  );
});

describe('AdminMemberProjection', () => {
  it('is a JSON-serializable projection of identity and membership data', () => {
    const projection: AdminMemberProjection = {
      uid: 'user-123',
      email: 'actor@example.com',
      displayName: 'Example Actor',
      tier: 'business',
      subscriptionStatus: 'active',
      membershipState: 'paid_cancelling',
      trialStart: 1_700_000_000,
      trialEnd: 1_701_209_600,
      currentPeriodEnd: 1_703_888_000,
      cancelAtPeriodEnd: true,
      cancelAt: 1_703_888_000,
      customerId: 'cus_123',
      subscriptionId: 'sub_123',
      priceId: 'price_123',
      authCreatedAt: '2026-01-02T03:04:05.000Z',
      createdAt: '2026-01-02T03:05:00.000Z',
      updatedAt: '2026-01-03T04:05:06.000Z',
    };

    expect(JSON.parse(JSON.stringify(projection))).toEqual(projection);
  });

  it('represents missing billing values with nulls', () => {
    const projection: AdminMemberProjection = {
      uid: 'user-456',
      email: 'new.actor@example.com',
      displayName: 'Actor',
      tier: 'free',
      subscriptionStatus: null,
      membershipState: 'no_plan',
      trialStart: null,
      trialEnd: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      cancelAt: null,
      customerId: null,
      subscriptionId: null,
      priceId: null,
      authCreatedAt: '2026-01-02T03:04:05.000Z',
      createdAt: '2026-01-02T03:05:00.000Z',
      updatedAt: '2026-01-02T03:05:00.000Z',
    };

    expect(projection.subscriptionStatus).toBeNull();
    expect(projection.membershipState).toBe('no_plan');
  });
});
