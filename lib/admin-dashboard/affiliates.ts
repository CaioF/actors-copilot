import { db } from '@/lib/firebase.admin';
import { stripe } from '@/lib/stripe';
import { DEFAULT_COMMISSION_RATE, normalizeAffiliateCode } from '@/lib/affiliate-attribution';

/**
 * Affiliate program, server side.
 *
 * The attribution lives in Firestore (`users/{uid}.affiliateCode`) and the
 * money lives in Stripe. The join between them is the Stripe customer id that
 * the billing document already stores, so no referral data ever reaches the
 * entitlement path.
 *
 * The commission is a percentage of what was actually collected: the sum of the
 * paid invoices of the referred accounts, minus the amount credited back after
 * the payment. A trial invoice is worth zero and a refunded invoice stops
 * counting.
 */

const AFFILIATES_COLLECTION = 'affiliates';
const PAYOUTS_COLLECTION = 'affiliatePayouts';
const USERS_COLLECTION = 'users';

/** Every amount in this module is expressed in the minor unit of its currency. */
export type MinorUnits = number;

export interface AffiliateRecord {
  code: string;
  name: string;
  email: string;
  /** Commission rate applied to the net collected, between 0 and 1. */
  rate: number;
  active: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliatePayoutRecord {
  id: string;
  affiliateCode: string;
  amount: MinorUnits;
  currency: string;
  method: string;
  reference: string;
  note: string;
  paidAt: string;
  createdAt: string;
}

export interface AffiliateCurrencyTotals {
  currency: string;
  /** Net amount collected from the referred accounts. */
  netCollected: MinorUnits;
  /** Commission earned over the collected amount. */
  commission: MinorUnits;
  /** Commission already transferred to the affiliate. */
  paidOut: MinorUnits;
  /** Commission still pending transfer. */
  pending: MinorUnits;
}

export interface AffiliateReferredMember {
  uid: string;
  email: string;
  tier: string;
  status: string;
  /** Currency of the account, when it has one. */
  currency: string | null;
  /** Net amount collected from this account. */
  netCollected: MinorUnits;
  /** True when the account paid at least once. */
  converted: boolean;
  /** True when the account was excluded as a self referral. */
  selfReferral: boolean;
  /** Epoch milliseconds of the referral click, when it is known. */
  capturedAt?: number;
}

export interface AffiliateReportRow {
  code: string;
  name: string;
  email: string;
  rate: number;
  active: boolean;
  notes: string;
  referredCount: number;
  convertedCount: number;
  totals: AffiliateCurrencyTotals[];
  members: AffiliateReferredMember[];
}

/** Minimal shape of a Stripe invoice used by the commission math. */
export interface CollectedInvoice {
  currency: string;
  amount_paid?: number | null;
  post_payment_credit_notes_amount?: number | null;
}

/**
 * Sums the net amount collected per currency.
 *
 * The net of an invoice is what was paid minus what was credited back after
 * the payment. Invoices that were never paid, and invoices whose whole amount
 * was refunded, contribute nothing.
 *
 * @param invoices - The invoices to sum.
 * @returns The net collected amount per currency, in minor units.
 */
export function netCollectedFromInvoices(
  invoices: CollectedInvoice[],
): Map<string, MinorUnits> {
  const totals = new Map<string, MinorUnits>();

  for (const invoice of invoices) {
    const paid = invoice.amount_paid ?? 0;
    const credited = invoice.post_payment_credit_notes_amount ?? 0;
    const net = Math.max(0, paid - credited);

    if (net === 0) continue;

    totals.set(invoice.currency, (totals.get(invoice.currency) ?? 0) + net);
  }

  return totals;
}

/**
 * Applies the commission rate to a collected amount.
 *
 * @param netCollected - The net collected amount, in minor units.
 * @param rate - The commission rate.
 * @returns The commission in minor units, rounded to the nearest unit.
 */
export function computeCommission(netCollected: MinorUnits, rate: number): MinorUnits {
  if (netCollected <= 0) return 0;

  return Math.round(netCollected * rate);
}

/**
 * Reads the paid invoices of a Stripe customer.
 *
 * @param customerId - The Stripe customer id.
 * @param sinceMs - Epoch milliseconds; invoices created before it are ignored.
 * @returns The invoices that were paid.
 */
async function listPaidInvoices(customerId: string, sinceMs?: number): Promise<CollectedInvoice[]> {
  const invoices: CollectedInvoice[] = [];
  let cursor: string | undefined;

  do {
    const page = await stripe.invoices.list({
      customer: customerId,
      status: 'paid',
      limit: 100,
      ...(cursor ? { starting_after: cursor } : {}),
    });

    cursor = page.data.length === 100 ? page.data[page.data.length - 1].id : undefined;

    for (const invoice of page.data) {
      if (typeof sinceMs === 'number' && invoice.created * 1000 < sinceMs) continue;

      invoices.push({
        currency: invoice.currency,
        amount_paid: invoice.amount_paid,
        post_payment_credit_notes_amount:
          (invoice as unknown as { post_payment_credit_notes_amount?: number | null })
            .post_payment_credit_notes_amount,
      });
    }
  } while (cursor);

  return invoices;
}

/**
 * Lists the registered affiliates.
 *
 * @returns Every affiliate, ordered by code.
 */
export async function listAffiliates(): Promise<AffiliateRecord[]> {
  const snapshot = await db.collection(AFFILIATES_COLLECTION).get();

  return snapshot.docs
    .map((document) => toAffiliateRecord(document.id, document.data() ?? {}))
    .sort((left, right) => left.code.localeCompare(right.code));
}

function toAffiliateRecord(code: string, data: Record<string, unknown>): AffiliateRecord {
  return {
    code,
    name: typeof data.name === 'string' ? data.name : '',
    email: typeof data.email === 'string' ? data.email : '',
    rate: typeof data.rate === 'number' ? data.rate : DEFAULT_COMMISSION_RATE,
    active: data.active !== false,
    notes: typeof data.notes === 'string' ? data.notes : '',
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };
}

export interface UpsertAffiliateInput {
  code: string;
  name?: string;
  email?: string;
  rate?: number;
  active?: boolean;
  notes?: string;
}

/**
 * Creates or updates an affiliate.
 *
 * @param input - The affiliate data.
 * @returns The stored affiliate.
 */
export async function upsertAffiliate(input: UpsertAffiliateInput): Promise<AffiliateRecord> {
  const code = normalizeAffiliateCode(input.code);

  if (!code) {
    throw new Error('Invalid affiliate code');
  }

  const rate =
    typeof input.rate === 'number' && Number.isFinite(input.rate)
      ? Math.min(1, Math.max(0, input.rate))
      : DEFAULT_COMMISSION_RATE;

  const now = new Date().toISOString();
  const reference = db.doc(`${AFFILIATES_COLLECTION}/${code}`);
  const existing = await reference.get();
  const createdAt =
    existing.exists && typeof existing.data()?.createdAt === 'string'
      ? (existing.data()?.createdAt as string)
      : now;

  const record: AffiliateRecord = {
    code,
    name: input.name ?? '',
    email: input.email ?? '',
    rate,
    active: input.active !== false,
    notes: input.notes ?? '',
    createdAt,
    updatedAt: now,
  };

  await reference.set(record, { merge: true });

  return record;
}

/**
 * Lists the manual transfers already recorded.
 *
 * @returns Every recorded payout, newest first.
 */
export async function listAffiliatePayouts(): Promise<AffiliatePayoutRecord[]> {
  const snapshot = await db.collection(PAYOUTS_COLLECTION).get();

  return snapshot.docs
    .map((document) => toPayoutRecord(document.id, document.data() ?? {}))
    .sort((left, right) => right.paidAt.localeCompare(left.paidAt));
}

function toPayoutRecord(id: string, data: Record<string, unknown>): AffiliatePayoutRecord {
  return {
    id,
    affiliateCode: typeof data.affiliateCode === 'string' ? data.affiliateCode : '',
    amount: typeof data.amount === 'number' ? data.amount : 0,
    currency: typeof data.currency === 'string' ? data.currency : 'usd',
    method: typeof data.method === 'string' ? data.method : '',
    reference: typeof data.reference === 'string' ? data.reference : '',
    note: typeof data.note === 'string' ? data.note : '',
    paidAt: typeof data.paidAt === 'string' ? data.paidAt : '',
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
  };
}

export interface RecordAffiliatePayoutInput {
  affiliateCode: string;
  amount: number;
  currency: string;
  method?: string;
  reference?: string;
  note?: string;
  paidAt?: string;
}

/**
 * Records a manual transfer to an affiliate.
 *
 * @param input - The payout data.
 * @returns The stored payout.
 */
export async function recordAffiliatePayout(
  input: RecordAffiliatePayoutInput,
): Promise<AffiliatePayoutRecord> {
  const affiliateCode = normalizeAffiliateCode(input.affiliateCode);

  if (!affiliateCode) {
    throw new Error('Invalid affiliate code');
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Invalid payout amount');
  }

  const currency = (input.currency || 'usd').trim().toLowerCase();
  const now = new Date().toISOString();

  const reference = db.collection(PAYOUTS_COLLECTION).doc();
  const record: AffiliatePayoutRecord = {
    id: reference.id,
    affiliateCode,
    amount: Math.round(input.amount),
    currency,
    method: input.method ?? '',
    reference: input.reference ?? '',
    note: input.note ?? '',
    paidAt: input.paidAt ?? now,
    createdAt: now,
  };

  await reference.set(record);

  return record;
}

/**
 * Builds the commission report of every affiliate.
 *
 * For each affiliate it joins the accounts that carry its code with the amount
 * those accounts actually paid, applies the commission rate and subtracts the
 * transfers already recorded.
 *
 * @returns One report row per affiliate.
 */
export async function buildAffiliateReport(): Promise<AffiliateReportRow[]> {
  const [affiliates, payouts] = await Promise.all([listAffiliates(), listAffiliatePayouts()]);

  const paidOutByAffiliate = new Map<string, Map<string, MinorUnits>>();
  for (const payout of payouts) {
    const perCurrency = paidOutByAffiliate.get(payout.affiliateCode) ?? new Map<string, MinorUnits>();
    perCurrency.set(payout.currency, (perCurrency.get(payout.currency) ?? 0) + payout.amount);
    paidOutByAffiliate.set(payout.affiliateCode, perCurrency);
  }

  const rows: AffiliateReportRow[] = [];

  for (const affiliate of affiliates) {
    const referred = await db
      .collection(USERS_COLLECTION)
      .where('affiliateCode', '==', affiliate.code)
      .get();

    const members: AffiliateReferredMember[] = [];
    const collected = new Map<string, MinorUnits>();

    for (const document of referred.docs) {
      const data = document.data() ?? {};
      const email = typeof data.email === 'string' ? data.email : '';
      const selfReferral =
        affiliate.email.length > 0 && email.toLowerCase() === affiliate.email.toLowerCase();

      const billing = (
        await db.doc(`${USERS_COLLECTION}/${document.id}/billing/current`).get()
      ).data() as Record<string, unknown> | undefined;
      const customerId = typeof billing?.customerId === 'string' ? billing.customerId : null;
      const capturedAt =
        typeof data.affiliateCapturedAt === 'number' ? data.affiliateCapturedAt : undefined;

      let memberTotals = new Map<string, MinorUnits>();
      if (!selfReferral && customerId) {
        memberTotals = netCollectedFromInvoices(await listPaidInvoices(customerId, capturedAt));
      }

      for (const [currency, amount] of memberTotals) {
        collected.set(currency, (collected.get(currency) ?? 0) + amount);
      }

      const memberCurrency = memberTotals.size === 1 ? [...memberTotals.keys()][0] : null;
      const memberTotal = [...memberTotals.values()].reduce((sum, amount) => sum + amount, 0);

      members.push({
        uid: document.id,
        email,
        tier: typeof billing?.tier === 'string' ? billing.tier : 'free',
        status: typeof billing?.status === 'string' ? billing.status : 'canceled',
        currency: memberCurrency,
        netCollected: memberTotal,
        converted: memberTotal > 0,
        selfReferral,
        ...(typeof capturedAt === 'number' ? { capturedAt } : {}),
      });
    }

    const paidOut = paidOutByAffiliate.get(affiliate.code) ?? new Map<string, MinorUnits>();
    const currencies = new Set<string>([
      ...collected.keys(),
      ...paidOut.keys(),
    ]);

    const totals: AffiliateCurrencyTotals[] = [...currencies]
      .sort()
      .map((currency) => {
        const netCollected = collected.get(currency) ?? 0;
        const commission = computeCommission(netCollected, affiliate.rate);
        const paidOutAmount = paidOut.get(currency) ?? 0;

        return {
          currency,
          netCollected,
          commission,
          paidOut: paidOutAmount,
          pending: commission - paidOutAmount,
        };
      });

    rows.push({
      code: affiliate.code,
      name: affiliate.name,
      email: affiliate.email,
      rate: affiliate.rate,
      active: affiliate.active,
      notes: affiliate.notes,
      referredCount: members.length,
      convertedCount: members.filter((member) => member.converted).length,
      totals,
      members: members.sort((left, right) => right.netCollected - left.netCollected),
    });
  }

  return rows;
}
