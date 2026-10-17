import {
  type AdminMemberProjection,
  classifyMembership,
  resolveAdminDisplayName,
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
