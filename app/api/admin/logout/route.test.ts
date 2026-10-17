import { deleteAdminSession } from '@/lib/admin-dashboard/session';
import { logger } from '@/lib/logger';
import { POST } from './route';

jest.mock('@/lib/admin-dashboard/session', () => ({
  deleteAdminSession: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn() },
}));

describe('POST /api/admin/logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes only the isolated admin session', async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(deleteAdminSession).toHaveBeenCalledTimes(1);
  });

  it('returns a generic failure without leaking internal details', async () => {
    (deleteAdminSession as jest.Mock).mockRejectedValue(new Error('cookie internals'));

    const response = await POST();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Unable to log out' });
    expect(JSON.stringify((logger.error as jest.Mock).mock.calls)).not.toContain('cookie internals');
  });
});
