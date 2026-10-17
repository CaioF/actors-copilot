import { db } from '@/lib/firebase.admin';
import type { AdminMemberProjection } from './domain';
import {
  deleteAdminMember,
  getAdminMember,
  listAdminMembers,
  upsertAdminMember,
} from './repository';

jest.mock('@/lib/firebase.admin', () => ({
  db: {
    collection: jest.fn(),
    doc: jest.fn(),
  },
}));

const member: AdminMemberProjection = {
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
};

describe('admin member repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads exactly adminMembers/{uid} and returns an allowlisted plain object', async () => {
    const get = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ ...member, uid: 'untrusted-uid', privateProfile: { dna: true } }),
    });
    (db.doc as jest.Mock).mockReturnValue({ get });

    const result = await getAdminMember(member.uid);

    expect(result).toEqual(member);
    expect(db.doc).toHaveBeenCalledWith('adminMembers/user-123');
    expect(Object.keys(result as AdminMemberProjection)).toEqual(
      Object.keys(member),
    );
  });

  it('returns null when the target projection does not exist', async () => {
    (db.doc as jest.Mock).mockReturnValue({
      get: jest.fn().mockResolvedValue({ exists: false }),
    });

    await expect(getAdminMember('missing-user')).resolves.toBeNull();
  });

  it('lists adminMembers as plain allowlisted domain objects', async () => {
    (db.collection as jest.Mock).mockReturnValue({
      get: jest.fn().mockResolvedValue({
        docs: [
          {
            id: member.uid,
            data: () => ({ ...member, ignored: 'not exposed' }),
          },
        ],
      }),
    });

    await expect(listAdminMembers()).resolves.toEqual([member]);
    expect(db.collection).toHaveBeenCalledWith('adminMembers');
  });

  it('returns an empty array when the projection collection is empty', async () => {
    (db.collection as jest.Mock).mockReturnValue({
      get: jest.fn().mockResolvedValue({ docs: [] }),
    });

    await expect(listAdminMembers()).resolves.toEqual([]);
  });

  it('merge-upserts the exact target projection without replacing unrelated fields', async () => {
    const set = jest.fn().mockResolvedValue(undefined);
    (db.doc as jest.Mock).mockReturnValue({ set });

    await upsertAdminMember(member);

    expect(db.doc).toHaveBeenCalledWith('adminMembers/user-123');
    expect(set).toHaveBeenCalledWith(member, { merge: true });
  });

  it('deletes only the requested projection document', async () => {
    const deleteDocument = jest.fn().mockResolvedValue(undefined);
    (db.doc as jest.Mock).mockReturnValue({ delete: deleteDocument });

    await deleteAdminMember('user-123');

    expect(db.doc).toHaveBeenCalledTimes(1);
    expect(db.doc).toHaveBeenCalledWith('adminMembers/user-123');
    expect(deleteDocument).toHaveBeenCalledTimes(1);
  });
});
