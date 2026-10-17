import type { UserRecord } from 'firebase-admin/auth';
import { auth, db } from '@/lib/firebase.admin';
import type { AdminMemberProjection } from './domain';
import { getAdminMember, upsertAdminMember } from './repository';
import { syncAdminMember } from './sync';

jest.mock('@/lib/firebase.admin', () => ({
  auth: {
    getUser: jest.fn(),
  },
  db: {
    doc: jest.fn(),
  },
}));

jest.mock('./repository', () => ({
  getAdminMember: jest.fn(),
  upsertAdminMember: jest.fn(),
}));

const uid = 'user-123';
const firstSyncTime = '2026-02-03T04:05:06.000Z';

function authUser(
  overrides: Omit<Partial<UserRecord>, 'metadata'> & {
    metadata?: { creationTime?: string };
  } = {},
): UserRecord {
  return {
    uid,
    email: 'auth@example.com',
    displayName: 'Auth Actor',
    metadata: {
      creationTime: 'Fri, 02 Jan 2026 03:04:05 GMT',
      ...overrides.metadata,
    },
    ...overrides,
  } as UserRecord;
}

function snapshot(data?: Record<string, unknown>) {
  return {
    exists: data !== undefined,
    data: () => data,
  };
}

function projection(
  overrides: Partial<AdminMemberProjection> = {},
): AdminMemberProjection {
  return {
    uid,
    email: 'auth@example.com',
    displayName: 'Profile Actor',
    tier: 'business',
    subscriptionStatus: 'active',
    membershipState: 'paid',
    trialStart: 1_700_000_000,
    trialEnd: 1_701_209_600,
    currentPeriodEnd: 1_703_888_000,
    cancelAtPeriodEnd: false,
    cancelAt: null,
    customerId: 'cus_123',
    subscriptionId: 'sub_123',
    priceId: 'price_123',
    authCreatedAt: '2026-01-02T03:04:05.000Z',
    createdAt: firstSyncTime,
    updatedAt: firstSyncTime,
    ...overrides,
  };
}

function mockSourceDocuments(
  actorData?: Record<string, unknown>,
  billingData?: Record<string, unknown>,
) {
  (db.doc as jest.Mock).mockImplementation((path: string) => ({
    get: jest.fn().mockResolvedValue(
      path === `actorProfiles/${uid}`
        ? snapshot(actorData)
        : snapshot(billingData),
    ),
  }));
}

describe('syncAdminMember', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(firstSyncTime));
    jest.clearAllMocks();
    (auth.getUser as jest.Mock).mockResolvedValue(authUser());
    (getAdminMember as jest.Mock).mockResolvedValue(null);
    (upsertAdminMember as jest.Mock).mockResolvedValue(undefined);
    mockSourceDocuments(
      { fullName: '  Profile Actor  ', privateDna: 'never copy this' },
      {
        tier: 'business',
        status: 'active',
        trialStart: 1_700_000_000,
        trialEnd: 1_701_209_600,
        currentPeriodEnd: 1_703_888_000,
        cancelAtPeriodEnd: false,
        cancelAt: null,
        customerId: 'cus_123',
        subscriptionId: 'sub_123',
        priceId: 'price_123',
        rawStripeObject: { secret: true },
      },
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses exact source paths, source precedence, raw billing values, and a minimized projection', async () => {
    const result = await syncAdminMember(uid);

    expect(auth.getUser).toHaveBeenCalledWith(uid);
    expect(db.doc).toHaveBeenCalledWith('actorProfiles/user-123');
    expect(db.doc).toHaveBeenCalledWith('users/user-123/billing/current');
    expect(getAdminMember).toHaveBeenCalledWith(uid);
    expect(result).toEqual(projection());
    expect(upsertAdminMember).toHaveBeenCalledWith(result);
    expect(Object.keys(result)).toEqual(Object.keys(projection()));
  });

  it('normalizes the Firebase SDK RFC creationTime to ISO', async () => {
    const result = await syncAdminMember(uid);

    expect(result.authCreatedAt).toBe('2026-01-02T03:04:05.000Z');
  });

  it.each([undefined, 'not-a-real-date'])(
    'uses synchronizedAt when Auth creationTime is missing or invalid (%s)',
    async (creationTime) => {
      (auth.getUser as jest.Mock).mockResolvedValue(
        authUser({ metadata: { creationTime } }),
      );

      const result = await syncAdminMember(uid);

      expect(result.authCreatedAt).toBe(firstSyncTime);
      expect(result.authCreatedAt).toBe(result.updatedAt);
    },
  );

  it('uses valid defaults when profile and billing documents are absent', async () => {
    mockSourceDocuments();
    (auth.getUser as jest.Mock).mockResolvedValue(
      authUser({ displayName: undefined, email: undefined }),
    );

    const result = await syncAdminMember(uid);

    expect(result).toEqual(
      projection({
        email: '',
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
      }),
    );
  });

  it('falls through whitespace profile names to the Auth display name', async () => {
    mockSourceDocuments({ fullName: '   ' });

    const result = await syncAdminMember(uid);

    expect(result.displayName).toBe('Auth Actor');
  });

  it('preserves unknown raw statuses and epoch-second dates', async () => {
    mockSourceDocuments(undefined, {
      status: 'future_status',
      tier: 'economy',
      trialStart: 1_700_000_001,
      trialEnd: 1_700_000_002,
      currentPeriodEnd: 1_700_000_003,
      cancelAt: 1_700_000_004,
    });

    const result = await syncAdminMember(uid);

    expect(result).toEqual(
      expect.objectContaining({
        subscriptionStatus: 'future_status',
        membershipState: 'inactive',
        trialStart: 1_700_000_001,
        trialEnd: 1_700_000_002,
        currentPeriodEnd: 1_700_000_003,
        cancelAt: 1_700_000_004,
      }),
    );
  });

  it('uses a prefetched Auth user without another Auth lookup', async () => {
    const prefetched = authUser({ email: 'prefetched@example.com' });

    const result = await syncAdminMember(uid, { authUser: prefetched });

    expect(auth.getUser).not.toHaveBeenCalled();
    expect(result.email).toBe('prefetched@example.com');
  });

  it('sets createdAt and updatedAt to synchronizedAt on the first sync', async () => {
    const result = await syncAdminMember(uid);

    expect(result.createdAt).toBe(firstSyncTime);
    expect(result.updatedAt).toBe(firstSyncTime);
  });

  it('preserves existing createdAt while updatedAt advances', async () => {
    const originalCreatedAt = '2025-10-01T00:00:00.000Z';
    (getAdminMember as jest.Mock).mockResolvedValue(
      projection({ createdAt: originalCreatedAt }),
    );
    jest.setSystemTime(new Date('2026-02-04T05:06:07.000Z'));

    const result = await syncAdminMember(uid);

    expect(result.createdAt).toBe(originalCreatedAt);
    expect(result.updatedAt).toBe('2026-02-04T05:06:07.000Z');
  });

  it('repeated syncs target one document while retaining the first creation time', async () => {
    let persisted: AdminMemberProjection | null = null;
    (getAdminMember as jest.Mock).mockImplementation(async () => persisted);
    (upsertAdminMember as jest.Mock).mockImplementation(
      async (next: AdminMemberProjection) => {
        persisted = next;
      },
    );

    const first = await syncAdminMember(uid);
    jest.setSystemTime(new Date('2026-03-04T05:06:07.000Z'));
    const second = await syncAdminMember(uid);

    expect(upsertAdminMember).toHaveBeenCalledTimes(2);
    expect(first.uid).toBe(uid);
    expect(second.uid).toBe(uid);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).toBe('2026-03-04T05:06:07.000Z');
  });

  it.each([
    ['Auth', () => (auth.getUser as jest.Mock).mockRejectedValue(new Error('Auth failed'))],
    [
      'actor profile',
      () =>
        (db.doc as jest.Mock).mockImplementation((path: string) => ({
          get: jest.fn().mockImplementation(() =>
            path.startsWith('actorProfiles/')
              ? Promise.reject(new Error('Profile failed'))
              : Promise.resolve(snapshot()),
          ),
        })),
    ],
    [
      'billing',
      () =>
        (db.doc as jest.Mock).mockImplementation((path: string) => ({
          get: jest.fn().mockImplementation(() =>
            path.includes('/billing/')
              ? Promise.reject(new Error('Billing failed'))
              : Promise.resolve(snapshot()),
          ),
        })),
    ],
    [
      'existing projection',
      () =>
        (getAdminMember as jest.Mock).mockRejectedValue(
          new Error('Projection failed'),
        ),
    ],
  ])('does not upsert when the %s read fails', async (_source, failRead) => {
    failRead();

    await expect(syncAdminMember(uid)).rejects.toThrow();
    expect(upsertAdminMember).not.toHaveBeenCalled();
  });
});
