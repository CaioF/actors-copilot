/**
 * Read-only reconciliation of the Firestore billing state against the live
 * Stripe state.
 *
 * This is phase F0 of the admin dashboard improvement: it produces the
 * divergence report the plan asks for, without changing any entitlement and
 * without writing anything.
 *
 * Every line of the report says what Firestore believes and what Stripe
 * believes, so the operator can decide what to do with each account. The
 * remediation itself is a business decision and is deliberately not part of
 * this script.
 *
 * Usage: pnpm admin:reconcile
 */
import { auth, db } from '@/lib/firebase.admin';
import { mapStripePriceToTier } from '@/lib/billing';
import { stripe } from '@/lib/stripe';
import {
  reconcileMembers,
  type BillingDocumentSnapshot,
  type BillingStatus,
  type StripeSubscriptionSnapshot,
  type StripeSubscriptionStatus,
} from '@/lib/admin-dashboard/reconciliation';

/**
 * Maximum number of subscriptions read per Stripe page.
 */
const STRIPE_PAGE_SIZE = 100;

/**
 * Maximum number of authentication users returned per page.
 */
const AUTH_PAGE_SIZE = 1000;

type SourceData = Record<string, unknown>;

/**
 * Writes a line to stdout.
 *
 * The report is the output of this script, so it goes to stdout instead of
 * the logger: the logger is for the application, not for a report an
 * operator reads.
 */
function write(line: string): void {
  process.stdout.write(`${line}\n`);
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function billingStatus(value: unknown): BillingStatus | null {
  switch (value) {
    case 'active':
    case 'trialing':
    case 'canceled':
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
      return value;
    default:
      return null;
  }
}

function stripeStatus(value: unknown): StripeSubscriptionStatus {
  switch (value) {
    case 'active':
    case 'trialing':
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
    case 'canceled':
      return value;
    default:
      return 'canceled';
  }
}

function tier(value: unknown): 'free' | 'economy' | 'business' {
  return value === 'economy' || value === 'business' ? value : 'free';
}

/**
 * Reads every authentication account of the platform.
 *
 * The account list decides which billing documents belong to a member that
 * still exists and which belong to an account that was deleted.
 */
async function readAuthAccounts(): Promise<Map<string, string | null>> {
  const accounts = new Map<string, string | null>();
  let pageToken: string | undefined;

  do {
    const page = await auth.listUsers(AUTH_PAGE_SIZE, pageToken);

    for (const user of page.users) {
      accounts.set(user.uid, user.email ?? null);
    }

    pageToken = page.pageToken;
  } while (pageToken);

  return accounts;
}

/**
 * Reads every billing document of the member base.
 *
 * The collection group is used so the accounts that live under a deleted
 * parent are still counted, exactly like the dashboard counts them.
 */
async function readBillingDocuments(
  authAccounts: Map<string, string | null>,
): Promise<BillingDocumentSnapshot[]> {
  const snapshot = await db.collectionGroup('billing').get();
  const rootUsers = await db.collection('users').get();

  const rootEmails = new Map<string, string | null>();
  for (const document of rootUsers.docs) {
    rootEmails.set(
      document.id,
      typeof document.data()?.email === 'string' ? (document.data()?.email as string) : null,
    );
  }

  return snapshot.docs.map((document) => {
    const data = (document.data() ?? {}) as SourceData;
    const pathParts = document.ref.path.split('/');
    const uid = pathParts[1] ?? document.id;

    return {
      uid,
      email: authAccounts.get(uid) ?? rootEmails.get(uid) ?? null,
      tier: tier(data.tier),
      status: billingStatus(data.status),
      hasAccess: typeof data.hasAccess === 'boolean' ? data.hasAccess : null,
      subscriptionId: nullableString(data.subscriptionId),
      customerId: nullableString(data.customerId),
      priceId: nullableString(data.priceId),
      currentPeriodEnd: nullableNumber(data.currentPeriodEnd),
      trialEnd: nullableNumber(data.trialEnd),
      cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
      cancelAt: nullableNumber(data.cancelAt),
      accountExists: authAccounts.has(uid),
    };
  });
}

/**
 * Reads every Stripe subscription, including the canceled ones.
 *
 * The canceled ones matter: a document that points at a canceled
 * subscription is a divergence, and it can only be detected when the
 * canceled subscription is part of the comparison.
 */
async function readStripeSubscriptions(): Promise<StripeSubscriptionSnapshot[]> {
  const subscriptions: StripeSubscriptionSnapshot[] = [];

  for await (const subscription of stripe.subscriptions.list({
    status: 'all',
    limit: STRIPE_PAGE_SIZE,
  })) {
    const item = subscription.items.data[0];
    const periodEnd = item?.current_period_end ?? null;

    subscriptions.push({
      subscriptionId: subscription.id,
      customerId:
        typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
      status: stripeStatus(subscription.status),
      currentPeriodEnd: periodEnd,
      trialEnd: subscription.trial_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      cancelAt: subscription.cancel_at,
      priceId: item?.price?.id ?? null,
    });
  }

  return subscriptions;
}

async function main(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  const [authAccounts, stripeSubscriptions] = await Promise.all([
    readAuthAccounts(),
    readStripeSubscriptions(),
  ]);

  const billingDocuments = await readBillingDocuments(authAccounts);

  const report = reconcileMembers(
    billingDocuments,
    stripeSubscriptions,
    mapStripePriceToTier,
    now,
  );

  write('=== RESUMEN ===');
  write(`cuentas de autenticacion: ${authAccounts.size}`);
  write(`documentos de facturacion: ${billingDocuments.length}`);
  write(`suscripciones de Stripe leidas: ${stripeSubscriptions.length}`);
  write(`miembros coincidentes: ${report.cleanCount}`);
  write(`miembros con divergencia critica: ${report.criticalCount}`);
  write(`miembros con divergencia menor: ${report.warningCount}`);
  write(`suscripciones sin cuenta (huerfanas): ${report.orphans.length}`);

  write('\n=== DIVERGENCIA POR MOTIVO ===');
  for (const [reason, count] of Object.entries(report.counts)) {
    write(`${reason}: ${count}`);
  }

  write('\n=== CUENTAS CRITICAS ===');
  for (const member of report.members.filter((entry) => entry.severity === 'critical')) {
    write(JSON.stringify({
      uid: member.uid,
      email: member.email,
      tier: member.tier,
      billingStatus: member.billingStatus,
      stripeStatus: member.stripeStatus,
      subscriptionId: member.subscriptionId,
      customerId: member.customerId,
      hasAccess: member.hasAccess,
      accountExists: member.accountExists,
      divergences: member.divergences.map((divergence) => ({
        reason: divergence.reason,
        severity: divergence.severity,
        detail: divergence.detail,
      })),
    }));
  }

  write('\n=== CUENTAS CON DIVERGENCIA MENOR ===');
  for (const member of report.members.filter((entry) => entry.severity === 'warning')) {
    write(JSON.stringify({
      uid: member.uid,
      email: member.email,
      tier: member.tier,
      billingStatus: member.billingStatus,
      stripeStatus: member.stripeStatus,
      accountExists: member.accountExists,
      divergences: member.divergences.map((divergence) => divergence.reason),
    }));
  }

  write('\n=== SUSCRIPCIONES HUERFANAS (pueden seguir cobrando) ===');
  for (const orphan of report.orphans) {
    write(JSON.stringify({
      subscriptionId: orphan.subscriptionId,
      customerId: orphan.customerId,
      status: orphan.status,
      tier: orphan.tier,
      currentPeriodEnd: orphan.currentPeriodEnd,
      cancelAtPeriodEnd: orphan.cancelAtPeriodEnd,
      renewsInDays:
        orphan.currentPeriodEnd === null
          ? null
          : Math.round((orphan.currentPeriodEnd - now) / 86_400),
    }));
  }

  process.exit(0);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`La reconciliacion fallo: ${message}`);
  process.exit(1);
});
