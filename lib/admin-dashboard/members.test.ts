import { auth, db } from '@/lib/firebase.admin';
import type { AdminMemberProjection } from './domain';
import { listAdminMemberSnapshot } from './members';
import { listAdminMembers } from './repository';

jest.mock('@/lib/firebase.admin', () => ({
  auth: {
    listUsers: jest.fn(),
  },
  db: {
    doc: jest.fn(),
    getAll: jest.fn(),
  },
}));

jest.mock('./repository', () => ({
  listAdminMembers: jest.fn(),
}));

const NOW = 1_800_000_000;

function projection(
  overrides: Partial<AdminMemberProjection> = {},
): AdminMemberProjection {
  return {
    uid: 'user-123',
    email: 'actor@example.com',
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
    authCreatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function authUser(
  uid: string,
  email: string,
  displayName?: string,
): Record<string, unknown> {
  return {
    uid,
    email,
    displayName,
    metadata: { creationTime: '2026-01-01T00:00:00.000Z' },
  };
}

/**
 * Mocks the batched reads of `users/{uid}/billing/current` and `users/{uid}`.
 *
 * The two documents are told apart by the length of their path, so a test can
 * give a member a referral without touching its billing document.
 */
function mockDocuments(
  billing: Record<string, Record<string, unknown>>,
  members: Record<string, Record<string, unknown>> = {},
): void {
  (db.doc as jest.Mock).mockImplementation((path: string) => ({ path }));
  (db.getAll as jest.Mock).mockImplementation(async (...references: Array<{ path: string }>) =>
    references.map((reference) => {
      const segments = reference.path.split('/');
      const uid = segments[1];
      const data = segments.length === 2 ? members[uid] : billing[uid];

      return {
        exists: Boolean(data),
        data: () => data ?? {},
      };
    }),
  );
}

/**
 * Mocks the batch read of `users/{uid}/billing/current` documents.
 */
function mockBillingDocuments(
  documents: Record<string, Record<string, unknown>>,
): void {
  mockDocuments(documents);
}

describe('listAdminMemberSnapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth.listUsers as jest.Mock).mockResolvedValue({ users: [] });
    (listAdminMembers as jest.Mock).mockResolvedValue([]);
    mockBillingDocuments({});
  });

  it('lists the accounts that still exist in Firebase Authentication', async () => {
    (auth.listUsers as jest.Mock).mockResolvedValue({
      users: [authUser('live-uid', 'live@example.com', 'Live Actor')],
    });
    (listAdminMembers as jest.Mock).mockResolvedValue([
      projection({ uid: 'live-uid', email: 'live@example.com', displayName: 'Live Actor' }),
    ]);

    const snapshot = await listAdminMemberSnapshot(NOW);

    expect(snapshot.members).toHaveLength(1);
    expect(snapshot.members[0]).toMatchObject({
      uid: 'live-uid',
      email: 'live@example.com',
      displayName: 'Live Actor',
    });
    expect(snapshot.archived).toEqual([]);
  });

  it('reads the tier and the status from the billing document, not from the projection', async () => {
    (auth.listUsers as jest.Mock).mockResolvedValue({
      users: [authUser('live-uid', 'live@example.com')],
    });
    (listAdminMembers as jest.Mock).mockResolvedValue([
      projection({
        uid: 'live-uid',
        email: 'live@example.com',
        tier: 'free',
        subscriptionStatus: 'canceled',
        membershipState: 'canceled',
      }),
    ]);
    mockBillingDocuments({
      'live-uid': {
        tier: 'business',
        status: 'active',
        hasAccess: true,
        trialStart: NOW - 100,
        trialEnd: NOW + 100,
        currentPeriodEnd: NOW + 100,
        customerId: 'cus_live',
        subscriptionId: 'sub_live',
        priceId: 'price_live',
      },
    });

    const snapshot = await listAdminMemberSnapshot(NOW);

    expect(snapshot.members[0]).toMatchObject({
      tier: 'business',
      subscriptionStatus: 'active',
      membershipState: 'trial',
      trialEnd: NOW + 100,
      customerId: 'cus_live',
    });
  });

  it('reports a member whose trial window is still open as a trial', async () => {
    (auth.listUsers as jest.Mock).mockResolvedValue({
      users: [authUser('trial-uid', 'trial@example.com')],
    });
    mockBillingDocuments({
      'trial-uid': {
        tier: 'business',
        status: 'active',
        trialStart: NOW - 86_400,
        trialEnd: NOW + 86_400,
        currentPeriodEnd: NOW + 86_400,
      },
    });

    const snapshot = await listAdminMemberSnapshot(NOW);

    expect(snapshot.members[0].membershipState).toBe('trial');
  });

  it('reports a member as paid once the trial window has closed', async () => {
    (auth.listUsers as jest.Mock).mockResolvedValue({
      users: [authUser('paid-uid', 'paid@example.com')],
    });
    mockBillingDocuments({
      'paid-uid': {
        tier: 'business',
        status: 'active',
        trialStart: NOW - 86_400 * 30,
        trialEnd: NOW - 86_400,
        currentPeriodEnd: NOW + 86_400 * 30,
      },
    });

    const snapshot = await listAdminMemberSnapshot(NOW);

    expect(snapshot.members[0].membershipState).toBe('paid');
  });

  it('keeps a canceled subscription canceled even while the trial window is open', async () => {
    (auth.listUsers as jest.Mock).mockResolvedValue({
      users: [authUser('canceled-uid', 'canceled@example.com')],
    });
    mockBillingDocuments({
      'canceled-uid': {
        tier: 'free',
        status: 'canceled',
        trialStart: NOW - 100,
        trialEnd: NOW + 100,
      },
    });

    const snapshot = await listAdminMemberSnapshot(NOW);

    expect(snapshot.members[0].membershipState).toBe('canceled');
  });

  it('reports an account without a billing document as having no plan', async () => {
    (auth.listUsers as jest.Mock).mockResolvedValue({
      users: [authUser('free-uid', 'free@example.com')],
    });

    const snapshot = await listAdminMemberSnapshot(NOW);

    expect(snapshot.members[0]).toMatchObject({
      tier: 'free',
      subscriptionStatus: null,
      membershipState: 'no_plan',
      trialEnd: null,
      currentPeriodEnd: null,
    });
  });

  it('moves the projection rows of deleted accounts to the archived list', async () => {
    (auth.listUsers as jest.Mock).mockResolvedValue({
      users: [authUser('live-uid', 'live@example.com')],
    });
    (listAdminMembers as jest.Mock).mockResolvedValue([
      projection({ uid: 'live-uid', email: 'live@example.com' }),
      projection({
        uid: 'deleted-uid',
        email: 'deleted@example.com',
        displayName: 'Deleted Actor',
        tier: 'free',
        subscriptionStatus: 'canceled',
        membershipState: 'canceled',
      }),
    ]);
    mockBillingDocuments({
      'deleted-uid': {
        tier: 'business',
        status: 'active',
        trialStart: NOW - 100,
        trialEnd: NOW + 100,
        currentPeriodEnd: NOW + 100,
      },
    });

    const snapshot = await listAdminMemberSnapshot(NOW);

    expect(snapshot.members.map((member) => member.uid)).toEqual(['live-uid']);
    expect(snapshot.archived).toHaveLength(1);
    expect(snapshot.archived[0]).toMatchObject({
      uid: 'deleted-uid',
      email: 'deleted@example.com',
      displayName: 'Deleted Actor',
      tier: 'business',
      membershipState: 'trial',
    });
  });

  it('pages through every authentication user', async () => {
    (auth.listUsers as jest.Mock)
      .mockResolvedValueOnce({ users: [authUser('page-1', 'one@example.com')], pageToken: 'next' })
      .mockResolvedValueOnce({ users: [authUser('page-2', 'two@example.com')] });

    const snapshot = await listAdminMemberSnapshot(NOW);

    expect(auth.listUsers).toHaveBeenCalledTimes(2);
    expect(snapshot.members.map((member) => member.uid)).toEqual(['page-1', 'page-2']);
  });

  it('reads the billing documents and the referrals in batches', async () => {
    (auth.listUsers as jest.Mock).mockResolvedValue({
      users: Array.from({ length: 120 }, (_value, index) =>
        authUser(`user-${index}`, `user-${index}@example.com`),
      ),
    });

    await listAdminMemberSnapshot(NOW);

    // 120 accounts: two batches for the billing documents, two for the referrals.
    expect(db.getAll).toHaveBeenCalledTimes(4);
    expect((db.getAll as jest.Mock).mock.calls[0]).toHaveLength(100);
    expect((db.getAll as jest.Mock).mock.calls[1]).toHaveLength(20);
    expect((db.getAll as jest.Mock).mock.calls[2]).toHaveLength(100);
    expect((db.getAll as jest.Mock).mock.calls[3]).toHaveLength(20);
  });

  it('reads the referral from the member document, not from the projection', async () => {
    (auth.listUsers as jest.Mock).mockResolvedValue({
      users: [authUser('live-uid', 'live@example.com')],
    });
    (listAdminMembers as jest.Mock).mockResolvedValue([
      projection({ uid: 'live-uid', referredBy: null }),
    ]);
    mockDocuments({}, { 'live-uid': { affiliateCode: 'lucas' } });

    const snapshot = await listAdminMemberSnapshot(NOW);

    expect(snapshot.members[0].referredBy).toBe('lucas');
  });

  it('falls back to the projection for an account whose member document is gone', async () => {
    (auth.listUsers as jest.Mock).mockResolvedValue({ users: [] });
    (listAdminMembers as jest.Mock).mockResolvedValue([
      projection({ uid: 'gone-uid', email: 'gone@example.com', referredBy: 'lucas' }),
    ]);
    mockDocuments({});

    const snapshot = await listAdminMemberSnapshot(NOW);

    expect(snapshot.archived[0].referredBy).toBe('lucas');
  });
});
