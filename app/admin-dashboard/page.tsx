import {
  serializeAdminMember,
  type AdminMemberDto,
} from '@/app/api/admin/members/route';
import { listAdminMembers } from '@/lib/admin-dashboard/repository';
import { getAdminSession } from '@/lib/admin-dashboard/session';
import { AdminLoginForm } from './admin-login-form';
import { AdminMembersTable } from './admin-members-table';

export const dynamic = 'force-dynamic';

const memberCollator = new Intl.Collator('en', { sensitivity: 'base' });

async function loadMembers(): Promise<AdminMemberDto[] | null> {
  try {
    const projections = await listAdminMembers();
    return [...projections]
      .sort((left, right) =>
        memberCollator.compare(left.displayName, right.displayName)
        || memberCollator.compare(left.email, right.email)
        || memberCollator.compare(left.uid, right.uid))
      .map((member) => serializeAdminMember(member));
  } catch {
    return null;
  }
}

export default async function AdminDashboardPage() {
  const session = await getAdminSession();

  if (!session) {
    return <AdminLoginForm />;
  }

  const members = await loadMembers();

  if (!members) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F1E8] px-4 py-12">
        <div className="max-w-md rounded-xl border border-[#3D4A3C]/15 bg-white p-8 text-center shadow-sm" role="alert">
          <h1 className="font-[family-name:var(--font-antonio)] text-3xl text-[#3D4A3C]">
            Unable to load members
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            The member list is temporarily unavailable.
          </p>
          <a
            className="mt-6 inline-flex h-9 items-center rounded-md bg-[#3D4A3C] px-4 text-sm font-medium text-white hover:bg-[#303B30]"
            href="/admin-dashboard"
          >
            Try again
          </a>
        </div>
      </main>
    );
  }

  return <AdminMembersTable members={members} />;
}
