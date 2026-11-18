import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase.admin';
import { getAdminSession } from '@/lib/admin-dashboard/session';
import { findAffiliateByCode } from '@/lib/admin-dashboard/affiliates';
import { readPromotionCodeAffiliateCode } from '@/lib/affiliate-promotion-codes';
import { normalizeAffiliateCode } from '@/lib/affiliate-attribution';
import { syncAdminMember } from '@/lib/admin-dashboard/sync';
import { stripe } from '@/lib/stripe';
import { isValidQaRun, signQaRun } from '@/lib/qa-affiliate-integrity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const rootFields = ['affiliateCode', 'affiliateCapturedAt', 'tier', 'subscriptionStatus', 'hasAccess', 'hasUsedTrial', 'updatedAt', 'qaSimulation'] as const;
const billingFields = ['tier', 'status', 'subscriptionStatus', 'hasAccess', 'hasUsedTrial', 'trialStart', 'trialEnd', 'updatedAt', 'qaSimulation'] as const;
type SnapshotField = { present: boolean; value?: unknown };

function list(name: string): string[] {
  return (process.env[name] || '').split(',').map(value => value.trim()).filter(Boolean);
}

function snapshotFields(data: Record<string, unknown>, fields: readonly string[]): Record<string, SnapshotField> {
  for (const field of fields) {
    const value = data[field];
    if (value !== undefined && value !== null && !['string', 'number', 'boolean'].includes(typeof value)) throw new Error('Unsupported existing QA snapshot field');
  }
  return Object.fromEntries(fields.map(field => [field, Object.prototype.hasOwnProperty.call(data, field)
    ? { present: true, value: data[field] }
    : { present: false }]));
}

function restoreFields(fields: Record<string, SnapshotField>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([name, saved]) => [name, saved.present ? saved.value : FieldValue.delete()]));
}

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function authorized(request: NextRequest): Promise<boolean> {
  const secret = process.env.QA_SIMULATION_SECRET || '';
  if (process.env.QA_SIMULATION_ENABLED !== 'true' || !/^[a-f0-9]{64}$/i.test(secret)) return false;
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return false;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return false;
  if (!await getAdminSession()) return false;
  const token = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
  if (!token) return false;
  return timingSafeEqual(createHash('sha256').update(secret).digest(), createHash('sha256').update(token).digest());
}

async function approvedUser(uid: unknown): Promise<string | null> {
  if (typeof uid !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(uid) || !list('QA_SIMULATION_ALLOWED_UIDS').includes(uid)) return null;
  const user = await auth.getUser(uid);
  const email = user.email?.trim().toLowerCase();
  return email && list('QA_SIMULATION_ALLOWED_EMAILS').map(item => item.toLowerCase()).includes(email) ? uid : null;
}

async function customerIsUnused(customer: string): Promise<boolean> {
  let cursor: string | undefined;
  do {
    const page = await stripe.subscriptions.list({ customer, status: 'all', limit: 100, ...(cursor ? { starting_after: cursor } : {}) });
    if (page.data.some(subscription => subscription.status === 'active' || subscription.status === 'trialing')) return false;
    cursor = page.has_more ? page.data.at(-1)?.id : undefined;
    if (page.has_more && !cursor) throw new Error('Unable to paginate subscriptions');
  } while (cursor);
  cursor = undefined;
  do {
    const page = await stripe.invoices.list({ customer, status: 'paid', limit: 100, ...(cursor ? { starting_after: cursor } : {}) });
    if (page.data.some(invoice => (invoice.amount_paid || 0) > 0)) return false;
    cursor = page.has_more ? page.data.at(-1)?.id : undefined;
    if (page.has_more && !cursor) throw new Error('Unable to paginate invoices');
  } while (cursor);
  return true;
}

// Both probes are read-only in effect: the write has an impossible precondition
// on an unguessable, nonexistent document. Any response other than 403 fails closed.
async function clientRulesDenyQa(idToken: string, uid: string): Promise<boolean> {
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const database = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || '(default)';
  if (!project) return false;
  const prefix = `projects/${project}/databases/${database}/documents`;
  const docName = `${prefix}/qaAffiliateSimulations/rules-probe-${randomUUID()}`;
  const base = `https://firestore.googleapis.com/v1/${prefix}`;
  const headers = { authorization: `Bearer ${idToken}` };
  // A positive control prevents an invalid token or App Check failure from
  // being mistaken for a rules denial.
  const ownUser = await fetch(`${base}/users/${encodeURIComponent(uid)}`, { headers, signal: AbortSignal.timeout(10000) });
  if (ownUser.status !== 200) return false;
  const adminProjection = await fetch(`${base}/adminMembers/${encodeURIComponent(uid)}`, { headers, signal: AbortSignal.timeout(10000) });
  if (adminProjection.status !== 403) return false;
  const read = await fetch(`https://firestore.googleapis.com/v1/${docName}`, { headers, signal: AbortSignal.timeout(10000) });
  if (read.status !== 403) return false;
  const write = await fetch(`${base}:commit`, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, signal: AbortSignal.timeout(10000),
    body: JSON.stringify({ writes: [{ update: { name: docName, fields: { probe: { booleanValue: true } } }, currentDocument: { exists: true } }] }),
  });
  return write.status === 403;
}

// This is a test-only approximation of a completed trial, not a Stripe event.
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!await authorized(request)) return error('Not found', 404);
  try {
    const body = await request.json();
    const uid = await approvedUser(body?.uid);
    const code = typeof body?.affiliateCode === 'string' ? normalizeAffiliateCode(body.affiliateCode) : null;
    if (!uid || !code || !list('QA_SIMULATION_ALLOWED_AFFILIATES').includes(code) || !['link', 'coupon'].includes(body?.source) || typeof body?.runId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.runId)) return error('Invalid QA request', 400);
    if (typeof body.idToken !== 'string' || (await auth.verifyIdToken(body.idToken)).uid !== uid) return error('Invalid QA identity', 400);
    if (!await clientRulesDenyQa(body.idToken, uid)) return error('QA Firestore rules are not verified', 409);
    const affiliate = await findAffiliateByCode(code);
    if (!affiliate?.promotionCodeId) return error('Affiliate unavailable', 400);
    if (body.source === 'coupon' && await readPromotionCodeAffiliateCode(affiliate.promotionCodeId) !== code) return error('Promotion code does not identify this affiliate', 400);

    const userRef = db.doc(`users/${uid}`);
    const billingRef = db.doc(`users/${uid}/billing/current`);
    const runRef = db.doc(`qaAffiliateSimulations/${uid}`);
    const currentBilling = (await billingRef.get()).data() || {};
    const customerId = typeof currentBilling.customerId === 'string' ? currentBilling.customerId : null;
    if (customerId && !await customerIsUnused(customerId)) return error('Test account has a real subscription or paid invoice', 409);
    const runId = body.runId;
    const updatedAt = new Date().toISOString();
    const epoch = Math.floor(Date.now() / 1000);
    const expiresAt = Date.now() + 15 * 60 * 1000;
    const marker = { id: runId, active: true, source: body.source, createdAt: updatedAt, expiresAt };
    const created = await db.runTransaction(async transaction => {
      const [userSnap, billingSnap, runSnap] = await Promise.all([transaction.get(userRef), transaction.get(billingRef), transaction.get(runRef)]);
      if (!userSnap.exists || runSnap.exists) return false;
      const user = userSnap.data() || {};
      const billing = billingSnap.data() || {};
      if ((typeof billing.customerId === 'string' ? billing.customerId : null) !== customerId) return false;
      const statuses = [billing.status, billing.subscriptionStatus, user.subscriptionStatus];
      if (statuses.some(status => status === 'active' || status === 'trialing') || billing.hasAccess === true || user.hasAccess === true || billing.subscriptionId || billing.stripeSubscriptionId || user.stripeSubscriptionId || user.qaSimulation || billing.qaSimulation) return false;
      if (typeof user.affiliateCode === 'string' && user.affiliateCode && user.affiliateCode !== code) return false;
      const run = { id: runId, active: true, affiliateCode: code, updatedAt, expiresAt, billingExisted: billingSnap.exists, rootBefore: snapshotFields(user, rootFields), billingBefore: snapshotFields(billing, billingFields) };
      transaction.set(runRef, { ...run, signature: signQaRun(uid, run) });
      transaction.set(userRef, { affiliateCode: code, affiliateCapturedAt: user.affiliateCapturedAt ?? Date.now(), tier: 'economy', subscriptionStatus: 'trialing', hasAccess: true, hasUsedTrial: true, updatedAt, qaSimulation: marker }, { merge: true });
      transaction.set(billingRef, { tier: 'economy', status: 'trialing', subscriptionStatus: 'trialing', hasAccess: true, hasUsedTrial: true, trialStart: epoch, trialEnd: epoch + 14 * 86400, updatedAt, qaSimulation: marker }, { merge: true });
      return true;
    });
    if (!created) return error('Account has an existing simulation, real subscription, or different affiliate', 409);
    let projectionUpdated = true;
    try { await syncAdminMember(uid); } catch { projectionUpdated = false; }
    return NextResponse.json({ simulated: true, runId, affiliateCode: code, source: body.source, status: 'trialing', expiresAt, projectionUpdated }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return error('Unable to create QA simulation', 500);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!await authorized(request)) return error('Not found', 404);
  try {
    const body = await request.json();
    const uid = await approvedUser(body?.uid);
    if (!uid || typeof body?.runId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.runId)) return error('Invalid QA request', 400);
    const userRef = db.doc(`users/${uid}`);
    const billingRef = db.doc(`users/${uid}/billing/current`);
    const runRef = db.doc(`qaAffiliateSimulations/${uid}`);
    const restored = await db.runTransaction(async transaction => {
      const [userSnap, billingSnap, runSnap] = await Promise.all([transaction.get(userRef), transaction.get(billingRef), transaction.get(runRef)]);
      const run = runSnap.data();
      const user = userSnap.data() || {};
      const billing = billingSnap.data() || {};
      if (!run || !isValidQaRun(uid, run) || run.id !== body.runId || user?.qaSimulation?.id !== run.id || billing?.qaSimulation?.id !== run.id || user.updatedAt !== run.updatedAt || billing.updatedAt !== run.updatedAt) return false;
      if (billing.subscriptionId || billing.stripeSubscriptionId || user.stripeSubscriptionId || billing.status !== 'trialing' || billing.tier !== 'economy' || billing.hasAccess !== true) return false;
      if (!run.billingExisted && Object.keys(billing).some(field => !billingFields.includes(field as typeof billingFields[number]))) return false;
      transaction.set(userRef, restoreFields(run.rootBefore), { merge: true });
      if (run.billingExisted) transaction.set(billingRef, restoreFields(run.billingBefore), { merge: true });
      else transaction.delete(billingRef);
      transaction.delete(runRef);
      return true;
    });
    if (!restored) return error('Simulation changed or was not found; manual review required', 409);
    let projectionUpdated = true;
    try { await syncAdminMember(uid); } catch { projectionUpdated = false; }
    return NextResponse.json({ restored: true, projectionUpdated }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return error('Unable to restore QA simulation', 500);
  }
}
