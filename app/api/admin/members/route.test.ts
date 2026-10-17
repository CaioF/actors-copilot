import type { AdminMemberProjection } from '@/lib/admin-dashboard/domain';
import { listAdminMembers } from '@/lib/admin-dashboard/repository';
import { getAdminSession } from '@/lib/admin-dashboard/session';
import { logger } from '@/lib/logger';
import { GET, serializeAdminMember } from './route';

jest.mock('@/lib/admin-dashboard/repository', () => ({
  listAdminMembers: jest.fn(),
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
    (listAdminMembers as jest.Mock).mockResolvedValue([]);
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
    expect(listAdminMembers).not.toHaveBeenCalled();
  });

  it('verifies the Admin Session before making exactly one list call', async () => {
    await GET();

    expect(getAdminSession).toHaveBeenCalledTimes(1);
    expect(listAdminMembers).toHaveBeenCalledTimes(1);
    expect((getAdminSession as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (listAdminMembers as jest.Mock).mock.invocationCallOrder[0],
    );
  });

  it('returns an empty JSON array with private no-store caching', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(response.headers.get('cache-control')).toBe(cacheControl);
  });

  it('sorts with fixed English case-insensitive displayName, email, then UID ordering', async () => {
    (listAdminMembers as jest.Mock).mockResolvedValue([
      projection({ uid: 'user-z', displayName: 'Bob', email: 'first@example.com' }),
      projection({ uid: 'user-c', displayName: 'alice', email: 'same@example.com' }),
      projection({ uid: 'user-b', displayName: 'ALICE', email: 'Same@example.com' }),
      projection({ uid: 'user-a', displayName: 'Alice', email: 'alpha@example.com' }),
    ]);

    const response = await GET();
    const members = await response.json();

    expect(members.map((member: { uid: string }) => member.uid)).toEqual([
      'user-a',
      'user-b',
      'user-c',
      'user-z',
    ]);
  });

  it('returns only the exact public DTO allowlist', async () => {
    const member = projection();
    (listAdminMembers as jest.Mock).mockResolvedValue([
      { ...member, privateProfile: { fullName: 'Private Name' } },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(body).toEqual([serializeAdminMember(member)]);
    expect(Object.keys(body[0])).toEqual([
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
    expect(body[0]).not.toHaveProperty('trialStart');
    expect(body[0]).not.toHaveProperty('cancelAt');
    expect(body[0]).not.toHaveProperty('authCreatedAt');
    expect(body[0]).not.toHaveProperty('createdAt');
    expect(body[0]).not.toHaveProperty('updatedAt');
    expect(body[0]).not.toHaveProperty('privateProfile');
  });

  it('returns and logs a generic sanitized 500 on repository failure', async () => {
    const failure = Object.assign(
      new TypeError('secret raw message for actor@example.com'),
      { code: 'firestore/internal' },
    );
    (listAdminMembers as jest.Mock).mockRejectedValue(failure);

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
