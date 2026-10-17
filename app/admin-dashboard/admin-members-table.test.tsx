/** @jest-environment jsdom */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import type { AdminMemberDto } from '@/app/api/admin/members/route';
import { AdminMembersTable } from './admin-members-table';

const stateCases: Array<[AdminMemberDto['membershipState'], string]> = [
  ['trial', 'Trial'],
  ['paid', 'Paid'],
  ['paid_cancelling', 'Paid, canceling'],
  ['past_due', 'Past due'],
  ['paused', 'Paused'],
  ['incomplete', 'Incomplete'],
  ['incomplete_expired', 'Incomplete expired'],
  ['unpaid', 'Unpaid'],
  ['canceled', 'Canceled'],
  ['no_plan', 'No plan'],
  ['inactive', 'Inactive'],
];

function member(
  membershipState: AdminMemberDto['membershipState'],
  index = 0,
): AdminMemberDto {
  return {
    uid: `user-${index}`,
    displayName: `Actor ${index}`,
    email: `actor-${index}@example.com`,
    tier: membershipState === 'no_plan' ? 'free' : 'business',
    subscriptionStatus: null,
    membershipState,
    trialEnd: membershipState === 'trial' ? 1_800_000_000 : null,
    currentPeriodEnd: membershipState.startsWith('paid') ? 1_800_000_000 : null,
    cancelAtPeriodEnd: membershipState === 'paid_cancelling',
  };
}

describe('AdminMembersTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders exactly Name, Email, and Status as semantic column headers', () => {
    const { container } = render(<AdminMembersTable members={[member('paid')]} />);
    const table = screen.getByRole('table');

    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Name',
      'Email',
      'Status',
    ]);
    expect(container.querySelector('[data-slot="table-container"]')).toHaveClass('overflow-x-auto');
    expect(container.querySelector('[data-slot="table-container"] table')).toBe(table);
  });

  it('renders stable labels for every membership state', () => {
    render(
      <AdminMembersTable
        members={stateCases.map(([state], index) => member(state, index))}
      />,
    );

    for (const [state, label] of stateCases) {
      const row = screen.getByText(`Actor ${stateCases.findIndex(([value]) => value === state)}`).closest('tr');
      expect(row).not.toBeNull();
      expect(within(row as HTMLTableRowElement).getByText(label)).toBeInTheDocument();
    }
  });

  it('keeps tier and relevant end date inside the status cell', () => {
    render(<AdminMembersTable members={[member('trial')]} />);

    const row = screen.getByText('Actor 0').closest('tr') as HTMLTableRowElement;
    const cells = within(row).getAllByRole('cell');

    expect(cells).toHaveLength(3);
    expect(cells[2]).toHaveTextContent('Business');
    expect(cells[2]).toHaveTextContent('Ends');
  });

  it('renders loading and empty states without an empty table', () => {
    const { rerender } = render(<AdminMembersTable members={[]} loading />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading members...');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    rerender(<AdminMembersTable members={[]} />);
    expect(screen.getByText('No members found.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('logs out through the admin endpoint and hard-refreshes', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    const reload = jest.fn();
    global.fetch = fetchMock;
    const user = userEvent.setup();
    render(<AdminMembersTable members={[member('paid')]} reload={reload} />);

    await user.click(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/logout', { method: 'POST' });
  });
});
