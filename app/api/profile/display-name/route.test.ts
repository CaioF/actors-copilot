import { auth } from '@/lib/firebase.admin';
import { syncAdminMember } from '@/lib/admin-dashboard/sync';
import { POST } from './route';

jest.mock('@/lib/firebase.admin', () => ({
  auth: {
    verifyIdToken: jest.fn(),
    updateUser: jest.fn(),
  },
}));

jest.mock('@/lib/admin-dashboard/sync', () => ({
  syncAdminMember: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn() },
}));

function request(body: unknown, authorization = 'Bearer valid-token') {
  return new Request('http://localhost/api/profile/display-name', {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/profile/display-name', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'verified-uid' });
    (auth.updateUser as jest.Mock).mockResolvedValue({});
    (syncAdminMember as jest.Mock).mockResolvedValue(undefined);
  });

  it.each([
    [undefined, ''],
    ['Basic token', 'Basic token'],
    ['Bearer', 'Bearer'],
    ['Bearer token extra', 'Bearer token extra'],
  ])('requires one strict Bearer token (%s)', async (_case, authorization) => {
    const req = request({ displayName: 'Actor' }, authorization);
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(auth.verifyIdToken).not.toHaveBeenCalled();
  });

  it('returns 401 when Firebase rejects the token', async () => {
    (auth.verifyIdToken as jest.Mock).mockRejectedValue(new Error('invalid'));

    const res = await POST(request({ displayName: 'Actor' }));

    expect(res.status).toBe(401);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it.each([
    [{}, 'missing'],
    [{ displayName: '' }, 'empty'],
    [{ displayName: '   ' }, 'whitespace'],
    [{ displayName: 'a'.repeat(151) }, 'too long'],
    [{ displayName: 'Actor', uid: 'attacker-uid' }, 'extra field'],
  ])('rejects invalid body: %s (%s)', async (body, _case) => {
    const res = await POST(request(body));

    expect(res.status).toBe(400);
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(syncAdminMember).not.toHaveBeenCalled();
  });

  it('derives UID from the verified token, trims the name, updates Auth, then syncs', async () => {
    const res = await POST(request({ displayName: '  Verified Actor  ' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, displayName: 'Verified Actor' });
    expect(auth.verifyIdToken).toHaveBeenCalledWith('valid-token');
    expect(auth.updateUser).toHaveBeenCalledWith('verified-uid', {
      displayName: 'Verified Actor',
    });
    expect(syncAdminMember).toHaveBeenCalledWith('verified-uid');
    expect((auth.updateUser as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (syncAdminMember as jest.Mock).mock.invocationCallOrder[0],
    );
  });

  it('returns an actionable failure when projection sync fails after Auth update', async () => {
    (syncAdminMember as jest.Mock).mockRejectedValue(new Error('projection failed'));

    const res = await POST(request({ displayName: 'Actor' }));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toEqual({
      error: 'Display name was updated, but profile synchronization failed. Please retry.',
    });
    expect(auth.updateUser).toHaveBeenCalledTimes(1);
  });
});
