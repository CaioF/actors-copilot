import type { UserRecord } from 'firebase-admin/auth';

interface AuthUserPage {
  users: UserRecord[];
  pageToken?: string;
}

interface AuthListClient {
  listUsers(maxResults: number, pageToken?: string): Promise<AuthUserPage>;
}

type SyncMember = (
  uid: string,
  overrides: { authUser: UserRecord },
) => Promise<unknown>;

export interface BackfillSummary {
  processed: number;
  succeeded: number;
  failed: number;
}

export async function backfillAdminMembers(
  authClient: AuthListClient,
  syncMember: SyncMember,
): Promise<BackfillSummary> {
  const summary: BackfillSummary = { processed: 0, succeeded: 0, failed: 0 };
  let pageToken: string | undefined;

  do {
    const page = await authClient.listUsers(1000, pageToken);

    for (const authUser of page.users) {
      summary.processed += 1;
      try {
        await syncMember(authUser.uid, { authUser });
        summary.succeeded += 1;
      } catch {
        summary.failed += 1;
      }
    }

    pageToken = page.pageToken;
  } while (pageToken);

  return summary;
}

const scriptPath = process.argv[1] ?? '';
const isCliEntry = /(?:^|[\\/])backfill-admin-members\.ts$/.test(scriptPath);

if (isCliEntry) {
  Promise.all([
    import('@/lib/firebase.admin'),
    import('@/lib/admin-dashboard/sync'),
  ])
    .then(([firebaseAdmin, adminSync]) => (
      backfillAdminMembers(firebaseAdmin.auth, adminSync.syncAdminMember)
    ))
    .then((summary) => {
      process.stdout.write(`${JSON.stringify(summary)}\n`);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Admin member backfill failed before completion: ${message}`);
      process.exitCode = 1;
    });
}
