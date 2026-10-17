import type { UserRecord } from 'firebase-admin/auth';
import { auth, db } from '@/lib/firebase.admin';
import { deleteAdminMember } from '@/lib/admin-dashboard/repository';
import { POST } from './route';
import { backfillAdminMembers } from '@/scripts/backfill-admin-members';

jest.mock('@/lib/firebase.admin', () => ({
  auth: {
    verifyIdToken: jest.fn(),
    deleteUser: jest.fn(),
  },
  db: { doc: jest.fn() },
}));

jest.mock('@/lib/admin-dashboard/repository', () => ({
  deleteAdminMember: jest.fn(),
}));

jest.mock('@/lib/admin-dashboard/sync', () => ({
  syncAdminMember: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn() },
}));

function request(authorization = 'Bearer valid-token') {
  return new Request('http://localhost/api/account/delete', {
    method: 'POST',
    headers: { Authorization: authorization },
    body: JSON.stringify({ uid: 'attacker-controlled-uid' }),
  });
}

describe('POST /api/account/delete', () => {
  const nowSeconds = 1_800_000_000;
  const calls: string[] = [];
  const deletes = new Map<string, jest.Mock>();

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(nowSeconds * 1000);
    jest.clearAllMocks();
    calls.length = 0;
    deletes.clear();
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({
      uid: 'verified-uid',
      auth_time: nowSeconds - 60,
    });
    (db.doc as jest.Mock).mockImplementation((path: string) => {
      const deleteDocument = jest.fn(async () => {
        calls.push(path);
      });
      deletes.set(path, deleteDocument);
      return { delete: deleteDocument };
    });
    (deleteAdminMember as jest.Mock).mockImplementation(async () => {
      calls.push('adminMembers/verified-uid');
    });
    (auth.deleteUser as jest.Mock).mockImplementation(async () => {
      calls.push('auth/verified-uid');
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('requires a strict verified Bearer token', async () => {
    const res = await POST(request('Basic token'));

    expect(res.status).toBe(401);
    expect(auth.verifyIdToken).not.toHaveBeenCalled();
    expect(db.doc).not.toHaveBeenCalled();
  });

  it.each([
    [{ uid: 'verified-uid' }, 'missing'],
    [{ uid: 'verified-uid', auth_time: nowSeconds - 301 }, 'stale'],
    [{ uid: 'verified-uid', auth_time: 'recent' }, 'invalid'],
  ])('requires a recent auth_time claim (%s, %s)', async (decodedToken, _case) => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue(decodedToken);

    const res = await POST(request());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: 'Recent authentication required. Please sign in again.',
      code: 'requires-recent-login',
    });
    expect(db.doc).not.toHaveBeenCalled();
    expect(auth.deleteUser).not.toHaveBeenCalled();
  });

  it('uses only the token UID and deletes bounded data in order with Auth last', async () => {
    const res = await POST(request());

    expect(res.status).toBe(200);
    expect(auth.verifyIdToken).toHaveBeenCalledWith('valid-token');
    expect(calls).toEqual([
      'users/verified-uid/billing/current',
      'users/verified-uid',
      'actorProfiles/verified-uid',
      'adminMembers/verified-uid',
      'auth/verified-uid',
    ]);
    expect(db.doc).not.toHaveBeenCalledWith(expect.stringContaining('attacker-controlled-uid'));
  });

  it('treats already-missing documents and Auth user as a successful retry', async () => {
    (db.doc as jest.Mock).mockImplementation((path: string) => ({
      delete: jest.fn().mockRejectedValue({ code: 5, path }),
    }));
    (deleteAdminMember as jest.Mock).mockRejectedValue({ code: 'not-found' });
    (auth.deleteUser as jest.Mock).mockRejectedValue({ code: 'auth/user-not-found' });

    const res = await POST(request());

    expect(res.status).toBe(200);
    expect(auth.deleteUser).toHaveBeenCalledWith('verified-uid');
  });

  it('reports failed resources, attempts remaining cleanup, and preserves Auth for retry', async () => {
    (db.doc as jest.Mock).mockImplementation((path: string) => ({
      delete: jest.fn().mockImplementation(async () => {
        calls.push(path);
        if (path.endsWith('/billing/current')) throw new Error('billing unavailable');
      }),
    }));

    const res = await POST(request());
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toEqual({
      error: 'Account deletion incomplete. Please retry.',
      failedResources: ['billing'],
    });
    expect(calls).toEqual([
      'users/verified-uid/billing/current',
      'users/verified-uid',
      'actorProfiles/verified-uid',
      'adminMembers/verified-uid',
    ]);
    expect(auth.deleteUser).not.toHaveBeenCalled();
  });
});

describe('backfillAdminMembers', () => {
  it('paginates positionally, runs sequentially, passes prefetched users, and isolates failures', async () => {
    const users = ['one', 'two', 'three'].map((uid) => ({ uid }) as UserRecord);
    const listUsers = jest
      .fn()
      .mockResolvedValueOnce({ users: users.slice(0, 2), pageToken: 'page-2' })
      .mockResolvedValueOnce({ users: users.slice(2) });
    let active = 0;
    let maxActive = 0;
    const sync = jest.fn(async (uid: string) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      if (uid === 'two') throw new Error('isolated failure');
    });

    const result = await backfillAdminMembers({ listUsers }, sync);

    expect(listUsers.mock.calls).toEqual([
      [1000, undefined],
      [1000, 'page-2'],
    ]);
    expect(sync.mock.calls).toEqual([
      ['one', { authUser: users[0] }],
      ['two', { authUser: users[1] }],
      ['three', { authUser: users[2] }],
    ]);
    expect(maxActive).toBe(1);
    expect(result).toEqual({ processed: 3, succeeded: 2, failed: 1 });
  });

  it('is repeat-safe and targets the same user IDs on every run', async () => {
    const user = { uid: 'repeat-user' } as UserRecord;
    const listUsers = jest.fn().mockResolvedValue({ users: [user] });
    const sync = jest.fn().mockResolvedValue(undefined);

    await backfillAdminMembers({ listUsers }, sync);
    await backfillAdminMembers({ listUsers }, sync);

    expect(sync.mock.calls.map(([uid]) => uid)).toEqual(['repeat-user', 'repeat-user']);
    expect(sync.mock.calls[0][1]).toEqual({ authUser: user });
    expect(sync.mock.calls[1][1]).toEqual({ authUser: user });
  });
});
