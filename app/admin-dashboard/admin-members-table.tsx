'use client';

import { useState } from 'react';
import type { AdminMemberDto } from '@/app/api/admin/members/route';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const stateLabels: Record<AdminMemberDto['membershipState'], string> = {
  trial: 'Trial',
  paid: 'Paid',
  paid_cancelling: 'Paid, canceling',
  past_due: 'Past due',
  paused: 'Paused',
  incomplete: 'Incomplete',
  incomplete_expired: 'Incomplete expired',
  unpaid: 'Unpaid',
  canceled: 'Canceled',
  no_plan: 'No plan',
  inactive: 'Inactive',
};

const activeStates = new Set<AdminMemberDto['membershipState']>([
  'trial',
  'paid',
  'paid_cancelling',
]);

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

interface AdminMembersTableProps {
  members: AdminMemberDto[];
  loading?: boolean;
  reload?: () => void;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function endDate(member: AdminMemberDto): number | null {
  return member.membershipState === 'trial'
    ? member.trialEnd
    : member.currentPeriodEnd;
}

export function AdminMembersTable({
  members,
  loading = false,
  reload = () => window.location.reload(),
}: AdminMembersTableProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutError('');

    try {
      const response = await fetch('/api/admin/logout', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Logout failed');
      }
      reload();
    } catch {
      setLogoutError('Unable to log out. Please try again.');
      setIsLoggingOut(false);
    }
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
              Member dashboard
            </h1>
          </div>
          <Button
            className="self-start border-[#3D4A3C]/30 text-[#3D4A3C] sm:self-auto"
            disabled={isLoggingOut}
            onClick={handleLogout}
            type="button"
            variant="outline"
          >
            {isLoggingOut ? 'Logging out...' : 'Log out'}
          </Button>
        </header>

        <div aria-live="polite" className="text-sm text-red-700" role={logoutError ? 'alert' : undefined}>
          {logoutError}
        </div>

        <Card className="overflow-hidden border-[#3D4A3C]/15 bg-white">
          <CardHeader className="border-b border-[#3D4A3C]/10">
            <CardTitle className="text-lg text-[#3D4A3C]">Members</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {loading ? (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground" role="status">
                Loading members...
              </p>
            ) : members.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                No members found.
              </p>
            ) : (
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow className="bg-[#3D4A3C]/5 hover:bg-[#3D4A3C]/5">
                    <TableHead className="px-6 text-[#3D4A3C]">Name</TableHead>
                    <TableHead className="px-6 text-[#3D4A3C]">Email</TableHead>
                    <TableHead className="px-6 text-[#3D4A3C]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    const membershipEnd = endDate(member);
                    return (
                      <TableRow key={member.uid}>
                        <TableCell className="px-6 font-medium text-[#283228]">
                          {member.displayName}
                        </TableCell>
                        <TableCell className="px-6 text-muted-foreground">
                          {member.email}
                        </TableCell>
                        <TableCell className="px-6">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              className={activeStates.has(member.membershipState)
                                ? 'border-[#3D4A3C]/20 bg-[#3D4A3C]/10 text-[#3D4A3C]'
                                : 'border-[#E8721A]/25 bg-[#E8721A]/10 text-[#9A4308]'}
                              variant="outline"
                            >
                              {stateLabels[member.membershipState]}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {titleCase(member.tier)}
                              {membershipEnd
                                ? ` · Ends ${dateFormatter.format(new Date(membershipEnd * 1000))}`
                                : ''}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
