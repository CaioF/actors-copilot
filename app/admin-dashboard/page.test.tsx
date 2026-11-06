/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { AdminMemberProjection } from '@/lib/admin-dashboard/domain';
import { listAdminMemberSnapshot } from '@/lib/admin-dashboard/members';
import { getAdminSession } from '@/lib/admin-dashboard/session';
import AdminDashboardPage, { dynamic } from './page';

jest.mock('@/lib/admin-dashboard/members', () => ({
  listAdminMemberSnapshot: jest.fn(),
}));

jest.mock('@/lib/admin-dashboard/session', () => ({
  getAdminSession: jest.fn(),
}));

// The dashboard renders the same payload the API route builds, so the route
// module is loaded for real. Only the response helper is stubbed: jsdom has
// no `Request` for `next/server` to extend.
jest.mock('next/server', () => ({
  NextResponse: { json: jest.fn() },
}));

const projection: AdminMemberProjection = {
  uid: 'private-uid',
  email: 'member@example.com',
  displayName: 'Member Name',
  tier: 'business',
  subscriptionStatus: 'active',
  membershipState: 'paid',
  trialStart: null,
  trialEnd: null,
  currentPeriodEnd: 1_800_000_000,
  cancelAtPeriodEnd: false,
  cancelAt: null,
  customerId: 'cus_private',
  subscriptionId: 'sub_private',
  priceId: 'price_private',
  authCreatedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAdminSession as jest.Mock).mockResolvedValue(null);
    (listAdminMemberSnapshot as jest.Mock).mockResolvedValue({
      members: [],
      archived: [],
    });
  });

  it('is always rendered dynamically', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('renders only the admin login experience without an Admin Session', async () => {
    render(await AdminDashboardPage());

    expect(screen.getByRole('heading', { name: 'Admin access' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
    expect(listAdminMemberSnapshot).not.toHaveBeenCalled();
  });

  it('loads projections directly and renders only the Task5 DTO fields', async () => {
    (getAdminSession as jest.Mock).mockResolvedValue({ sub: 'admin' });
    (listAdminMemberSnapshot as jest.Mock).mockResolvedValue({
      members: [projection],
      archived: [],
    });

    const { container } = render(await AdminDashboardPage());

    expect(listAdminMemberSnapshot).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Member Name')).toBeInTheDocument();
    expect(screen.getByText('member@example.com')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('private-uid');
    expect(container).not.toHaveTextContent('cus_private');
    expect(container).not.toHaveTextContent('sub_private');
    expect(container).not.toHaveTextContent('price_private');
  });

  it('renders the archived accounts apart from the live members', async () => {
    (getAdminSession as jest.Mock).mockResolvedValue({ sub: 'admin' });
    (listAdminMemberSnapshot as jest.Mock).mockResolvedValue({
      members: [projection],
      archived: [
        {
          ...projection,
          uid: 'archived-uid',
          email: 'archived@example.com',
          displayName: 'Archived Actor',
          membershipState: 'canceled',
          tier: 'free',
        },
      ],
    });

    render(await AdminDashboardPage());

    expect(screen.getByText('Archived accounts')).toBeInTheDocument();
    expect(screen.getByText('Archived Actor')).toBeInTheDocument();
    expect(screen.getByText('Deleted account')).toBeInTheDocument();
  });

  it('renders a retryable generic failure without leaking repository details or PII', async () => {
    (getAdminSession as jest.Mock).mockResolvedValue({ sub: 'admin' });
    (listAdminMemberSnapshot as jest.Mock).mockRejectedValue(
      new Error('Firestore denied member@example.com cus_private'),
    );

    const { container } = render(await AdminDashboardPage());

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load members');
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute(
      'href',
      '/admin-dashboard',
    );
    expect(container).not.toHaveTextContent('Firestore denied');
    expect(container).not.toHaveTextContent('member@example.com');
    expect(container).not.toHaveTextContent('cus_private');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('adminMembers Firestore rules boundary', () => {
  it('has no recursive database wildcard or authenticated allow that can match adminMembers', () => {
    const rules = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8');
    const adminRule = rules.match(
      /match\s+\/adminMembers\/\{document=\*\*\}\s*\{([\s\S]*?)\}/,
    );

    expect(rules).not.toMatch(/match\s+\/\{[^}]+=\*\*\}/);
    expect(rules).not.toMatch(/match\s+\/\{[^}]+\}(?:\/|\s*\{)/);
    expect(rules).toMatch(/match\s+\/users\/\{document=\*\*\}/);
    expect(rules).toMatch(/match\s+\/actorProfiles\/\{document=\*\*\}/);
    expect(rules.match(/match\s+\/adminMembers\//g)).toHaveLength(1);
    expect(adminRule?.[1]).toMatch(/allow\s+read,\s*write:\s*if\s+false\s*;/);

    expect(adminRule?.[1]).not.toMatch(/request\.auth/);

    const authenticatedRoots = [...rules.matchAll(
      /match\s+\/([A-Za-z0-9_-]+)\/\{document=\*\*\}\s*\{\s*allow[^;]*request\.auth\s*!=\s*null\s*;/g,
    )].map((match) => match[1]);
    expect(authenticatedRoots.sort()).toEqual(['actorProfiles', 'users']);
  });
});
