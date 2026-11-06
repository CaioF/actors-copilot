import type { AdminMemberProjection } from '@/lib/admin-dashboard/domain';
import { listAdminMemberSnapshot } from '@/lib/admin-dashboard/members';
import { getAdminSession } from '@/lib/admin-dashboard/session';
import { logger } from '@/lib/logger';
import { GET, serializeAdminMember } from './route';

jest.mock('@/lib/admin-dashboard/members', () => ({
  listAdminMemberSnapshot: jest.fn(),
}));

jest.mock('@/lib/admin-dashboard/session', () => ({
  getAdminSession: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn() },
}));

const cacheControl = 'private, no-store';

function projection(
  overrides: Partial<AdminMemberProjection> = {},
): AdminMemberProjection {
  return {
    uid: 'user-123',
    email: 'actor@example.com',
    displayName: 'Example Actor',
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
    createdAt: '2026-01-02T03:05:00.000Z',
    updatedAt: '2026-01-03T04:05:06.000Z',
    ...overrides,
  };
}

describe('GET /api/admin/members', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAdminSession as jest.Mock).mockResolvedValue({ sub: 'admin' });
    (listAdminMemberSnapshot as jest.Mock).mockResolvedValue({
      members: [],
      archived: [],
    });
  });

  it.each([
    'missing session',
    'malformed session',
    'expired session',
    'member session only',
  ])('returns 401 before repository access for a %s', async () => {
    (getAdminSession as jest.Mock).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(response.headers.get('cache-control')).toBe(cacheControl);
    expect(getAdminSession).toHaveBeenCalledTimes(1);
    expect(listAdminMemberSnapshot).not.toHaveBeenCalled();
  });

  it('verifies the Admin Session before making exactly one list call', async () => {
    await GET();

    expect(getAdminSession).toHaveBeenCalledTimes(1);
    expect(listAdminMemberSnapshot).toHaveBeenCalledTimes(1);
    expect((getAdminSession as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (listAdminMemberSnapshot as jest.Mock).mock.invocationCallOrder[0],
    );
  });

  it('returns an empty JSON payload with private no-store caching', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ members: [], archived: [] });
    expect(response.headers.get('cache-control')).toBe(cacheControl);
  });

  it('sorts with fixed English case-insensitive displayName, email, then UID ordering', async () => {
    (listAdminMemberSnapshot as jest.Mock).mockResolvedValue({
      members: [
        projection({ uid: 'user-z', displayName: 'Bob', email: 'first@example.com' }),
        projection({ uid: 'user-c', displayName: 'alice', email: 'same@example.com' }),
        projection({ uid: 'user-b', displayName: 'ALICE', email: 'Same@example.com' }),
        projection({ uid: 'user-a', displayName: 'Alice', email: 'alpha@example.com' }),
      ],
      archived: [],
    });

    const response = await GET();
    const { members } = await response.json();

    expect(members.map((member: { uid: string }) => member.uid)).toEqual([
      'user-a',
      'user-b',
      'user-c',
      'user-z',
    ]);
  });

  it('returns only the exact public DTO allowlist', async () => {
    const member = projection();
    (listAdminMemberSnapshot as jest.Mock).mockResolvedValue({
      members: [{ ...member, privateProfile: { fullName: 'Private Name' } }],
      archived: [],
    });

    const response = await GET();
    const body = await response.json();

    expect(body.members).toEqual([serializeAdminMember(member)]);
    expect(Object.keys(body.members[0])).toEqual([
      'uid',
      'displayName',
      'email',
      'tier',
      'subscriptionStatus',
      'membershipState',
      'trialEnd',
      'currentPeriodEnd',
      'cancelAtPeriodEnd',
    ]);
    expect(JSON.stringify(body)).not.toContain('cus_123');
    expect(JSON.stringify(body)).not.toContain('sub_123');
    expect(JSON.stringify(body)).not.toContain('price_123');
    expect(body.members[0]).not.toHaveProperty('trialStart');
    expect(body.members[0]).not.toHaveProperty('cancelAt');
    expect(body.members[0]).not.toHaveProperty('authCreatedAt');
    expect(body.members[0]).not.toHaveProperty('createdAt');
    expect(body.members[0]).not.toHaveProperty('updatedAt');
    expect(body.members[0]).not.toHaveProperty('privateProfile');
  });

  it('returns the archived accounts in their own list', async () => {
    (listAdminMemberSnapshot as jest.Mock).mockResolvedValue({
      members: [projection()],
      archived: [
        projection({
          uid: 'deleted-user',
          email: 'deleted@example.com',
          membershipState: 'canceled',
          tier: 'free',
        }),
      ],
    });

    const response = await GET();
    const body = await response.json();

    expect(body.members).toHaveLength(1);
    expect(body.archived).toHaveLength(1);
    expect(body.archived[0]).toMatchObject({
      uid: 'deleted-user',
      email: 'deleted@example.com',
      membershipState: 'canceled',
    });
  });

  it('returns and logs a generic sanitized 500 on repository failure', async () => {
    const failure = Object.assign(
      new TypeError('secret raw message for actor@example.com'),
      { code: 'firestore/internal' },
    );
    (listAdminMemberSnapshot as jest.Mock).mockRejectedValue(failure);

    const response = await GET();
    const responseText = await response.text();
    const logCalls = (logger.error as jest.Mock).mock.calls;
    const serializedLogs = JSON.stringify(logCalls);

    expect(response.status).toBe(500);
    expect(JSON.parse(responseText)).toEqual({ error: 'Unable to load members' });
    expect(response.headers.get('cache-control')).toBe(cacheControl);
    expect(logger.error).toHaveBeenCalledWith({
      route: '/api/admin/members',
      errorClass: 'TypeError',
      errorCode: 'firestore/internal',
    });
    expect(serializedLogs).not.toContain('secret raw message');
    expect(serializedLogs).not.toContain('actor@example.com');
    expect(responseText).not.toContain('secret raw message');
    expect(responseText).not.toContain('actor@example.com');
  });
});
