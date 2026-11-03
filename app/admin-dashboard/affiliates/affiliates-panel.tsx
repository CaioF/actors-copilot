'use client';

import { useState } from 'react';
import type { AffiliatePayoutRecord, AffiliateReportRow } from '@/lib/admin-dashboard/affiliates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * Formats an amount expressed in minor units.
 *
 * The currency code is always shown: the operator compares several currencies
 * in the same column and the symbol alone is not enough.
 */
function formatMoney(amount: number, currency: string): string {
  const code = currency.toUpperCase();

  return `${(amount / 100).toFixed(2)} ${code}`;
}

function formatTotals(
  totals: AffiliateReportRow['totals'],
  pick: (total: AffiliateReportRow['totals'][number]) => number,
): string {
  if (totals.length === 0) return '—';

  return totals.map((total) => formatMoney(pick(total), total.currency)).join(' · ');
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

interface AffiliatesPanelProps {
  report: AffiliateReportRow[];
  payouts: AffiliatePayoutRecord[];
  reload?: () => void;
}

export function AffiliatesPanel({
  report,
  payouts,
  reload = () => window.location.reload(),
}: AffiliatesPanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [payingFor, setPayingFor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(path: string, body: unknown) {
    setBusy(true);
    setError('');

    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        setError('The change could not be saved.');
        return;
      }

      reload();
    } catch {
      setError('The change could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const rate = Number(form.get('rate') ?? '30') / 100;

    void submit('/api/admin/affiliates', {
      code: String(form.get('code') ?? ''),
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      rate: Number.isFinite(rate) ? rate : 0.3,
      notes: String(form.get('notes') ?? ''),
      active: true,
    });
  }

  function handlePayout(event: React.FormEvent<HTMLFormElement>, affiliateCode: string) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const amount = Number(form.get('amount') ?? '0');

    void submit('/api/admin/affiliate-payouts', {
      affiliateCode,
      amount: Math.round(amount * 100),
      currency: String(form.get('currency') ?? 'usd'),
      method: String(form.get('method') ?? ''),
      reference: String(form.get('reference') ?? ''),
      note: String(form.get('note') ?? ''),
    });
  }

  return (
    <main className="min-h-screen bg-[#F4F1E8] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[#3D4A3C]/15 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8721A]">
              Internal operator
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-antonio)] text-4xl text-[#3D4A3C]">
              Affiliate program
            </h1>
          </div>
          <a
            className="inline-flex h-9 items-center rounded-md border border-[#3D4A3C]/30 px-4 text-sm font-medium text-[#3D4A3C] hover:bg-[#3D4A3C]/5"
            href="/admin-dashboard"
          >
            Back to members
          </a>
        </header>

        <div aria-live="polite" className="text-sm text-red-700" role={error ? 'alert' : undefined}>
          {error}
        </div>

        <Card className="overflow-hidden border-[#3D4A3C]/15 bg-white">
          <CardHeader className="flex-row items-center justify-between border-b border-[#3D4A3C]/10">
            <CardTitle className="text-lg text-[#3D4A3C]">Affiliates</CardTitle>
            <Button
              className="bg-[#3D4A3C] text-white hover:bg-[#303B30]"
              disabled={busy}
              onClick={() => setIsCreating((open) => !open)}
              type="button"
            >
              {isCreating ? 'Cancel' : 'Add affiliate'}
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            {isCreating ? (
              <form className="space-y-4 border-b border-[#3D4A3C]/10 p-6" onSubmit={handleCreate}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#3D4A3C]" htmlFor="affiliate-code">
                      Code
                    </label>
                    <Input id="affiliate-code" name="code" placeholder="tracey" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#3D4A3C]" htmlFor="affiliate-name">
                      Name
                    </label>
                    <Input id="affiliate-name" name="name" placeholder="Tracey Collis" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#3D4A3C]" htmlFor="affiliate-email">
                      Payout email
                    </label>
                    <Input id="affiliate-email" name="email" type="email" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#3D4A3C]" htmlFor="affiliate-rate">
                      Commission rate (%)
                    </label>
                    <Input defaultValue="30" id="affiliate-rate" name="rate" type="number" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#3D4A3C]" htmlFor="affiliate-notes">
                    Notes
                  </label>
                  <Input id="affiliate-notes" name="notes" />
                </div>
                <Button
                  className="bg-[#3D4A3C] text-white hover:bg-[#303B30]"
                  disabled={busy}
                  type="submit"
                >
                  {busy ? 'Saving...' : 'Save affiliate'}
                </Button>
              </form>
            ) : null}

            {report.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                No affiliates registered yet.
              </p>
            ) : (
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow className="bg-[#3D4A3C]/5 hover:bg-[#3D4A3C]/5">
                    <TableHead className="px-6 text-[#3D4A3C]">Affiliate</TableHead>
                    <TableHead className="px-6 text-[#3D4A3C]">Referred</TableHead>
                    <TableHead className="px-6 text-[#3D4A3C]">Collected</TableHead>
                    <TableHead className="px-6 text-[#3D4A3C]">Commission</TableHead>
                    <TableHead className="px-6 text-[#3D4A3C]">Paid</TableHead>
                    <TableHead className="px-6 text-[#3D4A3C]">Pending</TableHead>
                    <TableHead className="px-6 text-[#3D4A3C]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.map((affiliate) => (
                    <tr key={affiliate.code}>
                      <TableCell className="px-6 align-top">
                        <div className="font-medium text-[#283228]">{affiliate.name || affiliate.code}</div>
                        <div className="text-xs text-muted-foreground">{affiliate.code}</div>
                        {affiliate.email ? (
                          <div className="text-xs text-muted-foreground">{affiliate.email}</div>
                        ) : null}
                        <Badge
                          className="mt-1 border-[#3D4A3C]/20 bg-[#3D4A3C]/10 text-[#3D4A3C]"
                          variant="outline"
                        >
                          {Math.round(affiliate.rate * 100)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 align-top text-sm text-muted-foreground">
                        {affiliate.referredCount} referred · {affiliate.convertedCount} converted
                      </TableCell>
                      <TableCell className="px-6 align-top text-sm text-muted-foreground">
                        {formatTotals(affiliate.totals, (total) => total.netCollected)}
                      </TableCell>
                      <TableCell className="px-6 align-top text-sm text-muted-foreground">
                        {formatTotals(affiliate.totals, (total) => total.commission)}
                      </TableCell>
                      <TableCell className="px-6 align-top text-sm text-muted-foreground">
                        {formatTotals(affiliate.totals, (total) => total.paidOut)}
                      </TableCell>
                      <TableCell className="px-6 align-top text-sm font-medium text-[#283228]">
                        {formatTotals(affiliate.totals, (total) => total.pending)}
                      </TableCell>
                      <TableCell className="px-6 align-top">
                        <Button
                          className="border-[#3D4A3C]/30 text-[#3D4A3C]"
                          onClick={() =>
                            setPayingFor((current) => (current === affiliate.code ? null : affiliate.code))
                          }
                          type="button"
                          variant="outline"
                        >
                          {payingFor === affiliate.code ? 'Close' : 'Pay'}
                        </Button>
                      </TableCell>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {payingFor ? (
          <Card className="border-[#3D4A3C]/15 bg-white">
            <CardHeader className="border-b border-[#3D4A3C]/10">
              <CardTitle className="text-lg text-[#3D4A3C]">Record a transfer</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(event) => handlePayout(event, payingFor)}
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#3D4A3C]" htmlFor="payout-amount">
                    Amount
                  </label>
                  <Input id="payout-amount" name="amount" placeholder="87.00" step="0.01" type="number" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#3D4A3C]" htmlFor="payout-currency">
                    Currency
                  </label>
                  <Input defaultValue="usd" id="payout-currency" name="currency" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#3D4A3C]" htmlFor="payout-method">
                    Method
                  </label>
                  <Input id="payout-method" name="method" placeholder="Bank transfer" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#3D4A3C]" htmlFor="payout-reference">
                    Reference
                  </label>
                  <Input id="payout-reference" name="reference" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium text-[#3D4A3C]" htmlFor="payout-note">
                    Note
                  </label>
                  <Input id="payout-note" name="note" />
                </div>
                <Button
                  className="bg-[#3D4A3C] text-white hover:bg-[#303B30]"
                  disabled={busy}
                  type="submit"
                >
                  {busy ? 'Saving...' : 'Record transfer'}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card className="overflow-hidden border-[#3D4A3C]/15 bg-white">
          <CardHeader className="border-b border-[#3D4A3C]/10">
            <CardTitle className="text-lg text-[#3D4A3C]">Transfers</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {payouts.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                No transfers recorded yet.
              </p>
            ) : (
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow className="bg-[#3D4A3C]/5 hover:bg-[#3D4A3C]/5">
                    <TableHead className="px-6 text-[#3D4A3C]">Date</TableHead>
                    <TableHead className="px-6 text-[#3D4A3C]">Affiliate</TableHead>
                    <TableHead className="px-6 text-[#3D4A3C]">Amount</TableHead>
                    <TableHead className="px-6 text-[#3D4A3C]">Method</TableHead>
                    <TableHead className="px-6 text-[#3D4A3C]">Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell className="px-6 text-sm text-muted-foreground">
                        {payout.paidAt ? dateFormatter.format(new Date(payout.paidAt)) : '—'}
                      </TableCell>
                      <TableCell className="px-6 font-medium text-[#283228]">
                        {payout.affiliateCode}
                      </TableCell>
                      <TableCell className="px-6 text-sm text-muted-foreground">
                        {formatMoney(payout.amount, payout.currency)}
                      </TableCell>
                      <TableCell className="px-6 text-sm text-muted-foreground">
                        {payout.method || '—'}
                      </TableCell>
                      <TableCell className="px-6 text-sm text-muted-foreground">
                        {payout.reference || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
