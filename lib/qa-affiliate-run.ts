import { createHash } from 'node:crypto';
import type { DocumentData } from 'firebase-admin/firestore';
import { auth, db } from '@/lib/firebase.admin';
import { isValidQaRun, signQaRun } from '@/lib/qa-affiliate-integrity';

export const QA_WINDOW_MS = 15 * 60_000;
type Source = 'link' | 'coupon';
type Snapshot = {
  data(): DocumentData | undefined;
  createTime?: { seconds: number; nanoseconds: number };
};
export type QaTrial = {
  id: string;
  affiliateCode: string;
  source: Source;
  tier: 'economy' | 'business';
  checkout: string;
  expiresAt: number;
};

export function configuredList(name: string): string[] {
  return (process.env[name] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function signupEmail(): string | undefined {
  const email = process.env.QA_SIMULATION_SIGNUP_EMAIL?.trim().toLowerCase();
  return email && /^[a-z0-9.+_-]+@example\.test$/.test(email) ? email : undefined;
}

export function eligibleIdentity(uid: string, email: string): boolean {
  const address = email.toLowerCase();
  return (
    process.env.QA_SIMULATION_ENABLED === 'true' &&
    (address === signupEmail() ||
      (configuredList('QA_SIMULATION_ALLOWED_UIDS').includes(uid) &&
        configuredList('QA_SIMULATION_ALLOWED_EMAILS').some((item) => item.toLowerCase() === address)))
  );
}

export function issuedForNewSignup(email: string) {
  return email.toLowerCase() === signupEmail();
}

export function realEntitlement(data: DocumentData = {}) {
  return (
    data.hasAccess === true ||
    Boolean(data.subscriptionId || data.stripeSubscriptionId) ||
    [data.status, data.subscriptionStatus].some((status) => status === 'active' || status === 'trialing')
  );
}

function generation(snapshot: Snapshot) {
  return snapshot.createTime && `${snapshot.createTime.seconds}:${snapshot.createTime.nanoseconds}`;
}

export function qaCheckoutFingerprint(checkoutId: string): string {
  return createHash('sha256').update(checkoutId).digest('hex');
}

// Signed receipts issued before tier was recorded were exclusively Economy.
function receiptTier(data: DocumentData): QaTrial['tier'] | null {
  if (data.tier === undefined || data.tier === 'economy') return 'economy';
  return data.tier === 'business' ? 'business' : null;
}

function activeRun(uid: string, snapshot: Snapshot): QaTrial | null {
  const data = snapshot.data();
  const created = generation(snapshot);
  if (
    !data ||
    !created ||
    data.state !== 'active' ||
    data.generation !== created ||
    typeof data.id !== 'string' ||
    typeof data.expiresAt !== 'number' ||
    data.expiresAt <= Date.now() ||
    !configuredList('QA_SIMULATION_ALLOWED_AFFILIATES').includes(data.affiliateCode) ||
    !isValidQaRun(uid, data)
  )
    return null;
  const tier = receiptTier(data);
  if (!tier) return null;
  return {
    id: data.id,
    affiliateCode: data.affiliateCode,
    source: data.source,
    tier,
    checkout: data.checkout,
    expiresAt: data.expiresAt,
  };
}

function recordFor(uid: string) {
  // Opaque document names and synthetic state only. Account, billing, and Stripe records stay with their normal owners.
  const handle = createHash('sha256')
    .update('affiliate-qa:' + uid)
    .digest('hex');
  return db.collection('qaAffiliateSimulations').doc(handle);
}

export async function readQaTrial(uid: string, email: string): Promise<QaTrial | null> {
  if (!eligibleIdentity(uid, email)) return null;
  return activeRun(uid, await recordFor(uid).get());
}

export async function listQaTrials(): Promise<Map<string, QaTrial>> {
  const trials = new Map<string, QaTrial>();
  if (process.env.QA_SIMULATION_ENABLED !== 'true') return trials;
  const candidates = configuredList('QA_SIMULATION_ALLOWED_UIDS').map(
    (uid) => ({ uid }) as { uid: string } | { email: string },
  );
  const email = signupEmail();
  if (email) candidates.push({ email });
  for (let i = 0; i < candidates.length; i += 100) {
    const { users } = await auth.getUsers(candidates.slice(i, i + 100));
    await Promise.all(
      users.map(async (user) => {
        if (!user.email || user.disabled) return;
        const trial = await readQaTrial(user.uid, user.email);
        if (trial) trials.set(user.uid, trial);
      }),
    );
  }
  return trials;
}

function signed(uid: string, fields: Record<string, unknown>) {
  return { ...fields, signature: signQaRun(uid, fields) };
}

// The first transaction reserves the run. Only the second can issue an active
// receipt, after Firestore assigns an immutable document creation timestamp.
// A repeated request can finish its reservation. Restoring deleted bytes creates
// a different document generation and grants no access.
export async function startQaTrial(
  uid: string,
  request: Omit<QaTrial, 'expiresAt'>,
): Promise<QaTrial | null> {
  const ref = recordFor(uid);
  const reserve = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prior = snap.data();
    if (prior) {
      if (!isValidQaRun(uid, prior)) return false;
      if (prior.expiresAt > Date.now())
        return (
          prior.id === request.id &&
          prior.checkout === request.checkout &&
          receiptTier(prior) === request.tier &&
          prior.affiliateCode === request.affiliateCode &&
          prior.source === request.source
        );
    }
    const pending = { ...request, expiresAt: Date.now() + QA_WINDOW_MS, state: 'pending' };
    tx.set(ref, signed(uid, pending));
    return true;
  });
  if (!reserve) return null;
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (
      !data ||
      data.id !== request.id ||
      data.checkout !== request.checkout ||
      receiptTier(data) !== request.tier ||
      data.affiliateCode !== request.affiliateCode ||
      data.source !== request.source ||
      data.expiresAt <= Date.now() ||
      !isValidQaRun(uid, data)
    )
      return null;
    if (data.state === 'active') return activeRun(uid, snap);
    const created = generation(snap);
    if (data.state !== 'pending' || !created) return null;
    const trial = { ...request, expiresAt: data.expiresAt as number };
    tx.set(ref, signed(uid, { ...trial, state: 'active', generation: created }));
    return trial;
  });
}

export async function endQaTrial(uid: string, runId: string) {
  const ref = recordFor(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (!data) return true;
    if (
      data.id !== runId ||
      !isValidQaRun(uid, data) ||
      (data.state === 'active' && data.generation !== generation(snap))
    )
      return false;
    tx.delete(ref);
    return true;
  });
}
