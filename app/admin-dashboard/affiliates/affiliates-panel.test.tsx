/** @jest-environment jsdom */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import type { AffiliatePayoutRecord, AffiliateReportRow } from '@/lib/admin-dashboard/affiliates';
import { AffiliatesPanel } from './affiliates-panel';

function affiliate(overrides: Partial<AffiliateReportRow> = {}): AffiliateReportRow {
  return {
    code: 'tracey',
    name: 'Tracey Collis',
    email: 'tracey@example.com',
    rate: 0.3,
    active: true,
    notes: '',
    referredCount: 2,
    convertedCount: 1,
    totals: [
      { currency: 'usd', netCollected: 2900, commission: 870, paidOut: 300, pending: 570 },
    ],
    members: [],
    ...overrides,
  };
}

function payout(overrides: Partial<AffiliatePayoutRecord> = {}): AffiliatePayoutRecord {
  return {
    id: 'payout-1',
    affiliateCode: 'tracey',
    amount: 870,
    currency: 'usd',
    method: 'Bank transfer',
    reference: 'TX-99',
    note: '',
    paidAt: '2026-11-01T10:00:00.000Z',
    createdAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('AffiliatesPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the referral count, the commission and the pending amount', () => {
    render(<AffiliatesPanel report={[affiliate()]} payouts={[]} />);

    expect(screen.getByText('Tracey Collis')).toBeInTheDocument();
    expect(screen.getByText('tracey')).toBeInTheDocument();
    expect(screen.getByText('2 referred · 1 converted')).toBeInTheDocument();
    expect(screen.getByText('29.00 USD')).toBeInTheDocument();
    expect(screen.getByText('8.70 USD')).toBeInTheDocument();
    expect(screen.getByText('3.00 USD')).toBeInTheDocument();
    expect(screen.getByText('5.70 USD')).toBeInTheDocument();
  });

  it('renders the empty state when there is no affiliate', () => {
    render(<AffiliatesPanel report={[]} payouts={[]} />);

    expect(screen.getByText('No affiliates registered yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('records a transfer in minor units and refreshes', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    const reload = jest.fn();
    const user = userEvent.setup();

    render(<AffiliatesPanel report={[affiliate()]} payouts={[]} reload={reload} />);

    await user.click(screen.getByRole('button', { name: 'Pay' }));
    await user.type(screen.getByLabelText('Amount'), '8.70');
    await user.click(screen.getByRole('button', { name: 'Record transfer' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/admin/affiliate-payouts');
    expect(JSON.parse(init.body)).toEqual({
      affiliateCode: 'tracey',
      amount: 870,
      currency: 'usd',
      method: '',
      reference: '',
      note: '',
    });
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it('creates an affiliate with the rate expressed as a fraction', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    const reload = jest.fn();
    const user = userEvent.setup();

    render(<AffiliatesPanel report={[]} payouts={[]} reload={reload} />);

    await user.click(screen.getByRole('button', { name: 'Add affiliate' }));
    await user.type(screen.getByLabelText('Code'), 'thecfrt');
    await user.type(screen.getByLabelText('Name'), 'The CFRT');
    await user.type(screen.getByLabelText('Payout email'), 'hello@thecfrt.com');
    await user.click(screen.getByRole('button', { name: 'Save affiliate' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/admin/affiliates');
    expect(JSON.parse(init.body)).toEqual({
      code: 'thecfrt',
      name: 'The CFRT',
      email: 'hello@thecfrt.com',
      rate: 0.3,
      notes: '',
      active: true,
    });
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it('lists the transfers that were already recorded', () => {
    render(<AffiliatesPanel report={[affiliate()]} payouts={[payout()]} />);

    const table = screen.getAllByRole('table')[1];
    const row = within(table).getByText('TX-99').closest('tr') as HTMLTableRowElement;

    expect(within(row).getByText('8.70 USD')).toBeInTheDocument();
    expect(within(row).getByText('Bank transfer')).toBeInTheDocument();
  });
});
