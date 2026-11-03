import {
  buildAffiliateReport,
  listAffiliatePayouts,
  type AffiliatePayoutRecord,
  type AffiliateReportRow,
} from '@/lib/admin-dashboard/affiliates';
import { getAdminSession } from '@/lib/admin-dashboard/session';
import { AdminLoginForm } from '../admin-login-form';
import { AffiliatesPanel } from './affiliates-panel';

export const dynamic = 'force-dynamic';

export default async function AdminAffiliatesPage() {
  const session = await getAdminSession();

  if (!session) {
    return <AdminLoginForm redirectTo="/admin-dashboard/affiliates" />;
  }

  let report: AffiliateReportRow[];
  let payouts: AffiliatePayoutRecord[];

  try {
    [report, payouts] = await Promise.all([buildAffiliateReport(), listAffiliatePayouts()]);
  } catch {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F1E8] px-4 py-12">
        <div className="max-w-md rounded-xl border border-[#3D4A3C]/15 bg-white p-8 text-center shadow-sm" role="alert">
          <h1 className="font-[family-name:var(--font-antonio)] text-3xl text-[#3D4A3C]">
            Unable to load affiliates
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            The affiliate report is temporarily unavailable.
          </p>
          <a
            className="mt-6 inline-flex h-9 items-center rounded-md bg-[#3D4A3C] px-4 text-sm font-medium text-white hover:bg-[#303B30]"
            href="/admin-dashboard/affiliates"
          >
            Try again
          </a>
        </div>
      </main>
    );
  }

  return <AffiliatesPanel report={report} payouts={payouts} />;
}
