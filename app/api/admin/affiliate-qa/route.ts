import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase.admin';
import { getAdminSession } from '@/lib/admin-dashboard/session';
import { getPlatformSession, setPlatformSession, deletePlatformSession } from '@/lib/session';
import { extractSessionAffiliateCandidates, findAffiliateByCode } from '@/lib/admin-dashboard/affiliates';
import {
  configuredList,
  eligibleIdentity,
  endQaTrial,
  issuedForNewSignup,
  realEntitlement,
  startQaTrial,
} from '@/lib/qa-affiliate-run';
import { stripe } from '@/lib/stripe';
import { resolveAppUrl } from '@/lib/app-origin';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function requestOrigin(request: NextRequest): string {
  // Next's local server normalizes request.url; billing uses the validated
  // public Host header to generate the checkout's return URL.
  return request.headers.has('host')
    ? new URL(resolveAppUrl(request.headers)).origin
    : new URL(request.url).origin;
}

async function authorized(request: NextRequest, formKey?: unknown): Promise<boolean> {
  const secret = process.env.QA_SIMULATION_SECRET || '';
  if (process.env.QA_SIMULATION_ENABLED !== 'true' || !/^[a-f0-9]{64}$/i.test(secret)) return false;
  const form = formKey !== undefined;
  if (
    !form &&
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    return false;
  const origin = request.headers.get('origin');
  if ((form || origin) && origin !== requestOrigin(request)) return false;
  if (!(await getAdminSession())) return false;
  const token = form
    ? formKey
    : request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) return false;
  return timingSafeEqual(
    createHash('sha256').update(secret).digest(),
    createHash('sha256').update(token).digest(),
  );
}
async function customerIsUnused(customer: string): Promise<boolean> {
  let cursor: string | undefined;
  do {
    const page = await stripe.subscriptions.list({
      customer,
      status: 'all',
      limit: 100,
      ...(cursor ? { starting_after: cursor } : {}),
    });
    if (
      page.data.some(
        (subscription) => subscription.status === 'active' || subscription.status === 'trialing',
      )
    )
      return false;
    cursor = page.has_more ? page.data.at(-1)?.id : undefined;
    if (page.has_more && !cursor) throw new Error('Unable to paginate subscriptions');
  } while (cursor);
  cursor = undefined;
  do {
    const page = await stripe.invoices.list({
      customer,
      status: 'paid',
      limit: 100,
      ...(cursor ? { starting_after: cursor } : {}),
    });
    if (page.data.some((invoice) => (invoice.amount_paid || 0) > 0)) return false;
    cursor = page.has_more ? page.data.at(-1)?.id : undefined;
    if (page.has_more && !cursor) throw new Error('Unable to paginate invoices');
  } while (cursor);
  return true;
}

// This is the sole replacement for Stripe's completion and return. A native
// form POST lets the browser follow the application's real 303 response.
export async function GET(): Promise<NextResponse> {
  if (process.env.QA_SIMULATION_ENABLED !== 'true' || !(await getAdminSession()))
    return error('Not found', 404);
  const buyer = await getPlatformSession();
  if (!buyer || !eligibleIdentity(buyer.uid, buyer.email)) return error('Not found', 404);
  return new NextResponse(
    `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>QA payment confirmation</title>
<style>body{font:18px/1.55 system-ui;background:#f5f4ed;color:#20332d;max-width:36rem;margin:7vh auto;padding:24px}
label{display:block;margin:16px 0}input,button{font:inherit;padding:8px}input{display:block;width:95%}
button{background:#254236;color:white;border:0;border-radius:6px;padding:12px 18px}</style>
<main><h1>QA payment confirmation</h1><p>Simulate Stripe returning from this open checkout. No card is charged.</p>
<form method="post" autocomplete="off"><input type="hidden" name="runId" value="${randomUUID()}">
<label>Hosted checkout ID<input name="checkoutSessionId" type="password" required></label>
<label>Affiliate code<input name="affiliateCode" required></label>
<label>Operator key<input name="key" type="password" required></label>
<button>Confirm demo trial</button></form></main></html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'same-origin',
        'Content-Security-Policy':
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      },
    },
  );
}

// The browser has already signed in and opened this exact hosted checkout.
// Stripe is queried read-only. Only the demo result enters the application.
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const isForm =
      request.headers.get('content-type')?.split(';')[0] === 'application/x-www-form-urlencoded';
    const form = isForm ? await request.formData() : null;
    if (!(await authorized(request, form ? form.get('key') : undefined))) return error('Not found', 404);
    const buyer = await getPlatformSession();
    const body = form ? Object.fromEntries(form) : await request.json();
    if (!buyer || !eligibleIdentity(buyer.uid, buyer.email))
      return error('An approved buyer session is required', 403);
    if (
      typeof body?.runId !== 'string' ||
      !uuid.test(body.runId) ||
      typeof body.checkoutSessionId !== 'string' ||
      !/^cs_(?:test|live)_[A-Za-z0-9]{8,200}$/.test(body.checkoutSessionId) ||
      typeof body.affiliateCode !== 'string' ||
      !configuredList('QA_SIMULATION_ALLOWED_AFFILIATES').includes(body.affiliateCode)
    ) {
      return error('Invalid QA request', 400);
    }
    const user = await auth.getUser(buyer.uid);
    if (
      user.disabled ||
      !user.email ||
      user.email.toLowerCase() !== buyer.email.toLowerCase() ||
      !eligibleIdentity(buyer.uid, user.email)
    ) {
      return error('Test identity mismatch', 403);
    }
    if (issuedForNewSignup(user.email)) {
      const age = Date.now() - Date.parse(user.metadata.creationTime);
      if (!Number.isFinite(age) || age < 0 || age > 60 * 60_000)
        return error('This demo address requires a new signup', 409);
    }
    const [checkout, billingSnap, memberSnap, affiliate] = await Promise.all([
      stripe.checkout.sessions.retrieve(body.checkoutSessionId),
      db.doc(`users/${buyer.uid}/billing/current`).get(),
      db.doc(`users/${buyer.uid}`).get(),
      findAffiliateByCode(body.affiliateCode),
    ]);
    const billing = billingSnap.data() || {};
    const member = memberSnap.data() || {};
    const meta = checkout.metadata || {};
    if (
      !affiliate?.active ||
      !affiliate.promotionCodeId ||
      !memberSnap.exists ||
      checkout.status !== 'open' ||
      checkout.mode !== 'subscription' ||
      checkout.subscription ||
      checkout.client_reference_id !== buyer.uid ||
      meta.platformUserId !== buyer.uid ||
      meta.targetTier !== 'economy' ||
      meta.billingCycle !== 'monthly' ||
      meta.isTrial !== 'true' ||
      typeof checkout.customer !== 'string' ||
      checkout.customer !== billing.customerId ||
      !checkout.success_url ||
      new URL(checkout.success_url).origin !== requestOrigin(request)
    ) {
      return error('Checkout does not match the current QA trial', 409);
    }
    const offer = extractSessionAffiliateCandidates(checkout);
    if (
      !offer.promotionCodeIds.includes(affiliate.promotionCodeId) ||
      (meta.affiliateCode && meta.affiliateCode !== affiliate.code) ||
      (member.affiliateCode && member.affiliateCode !== affiliate.code)
    ) {
      return error('The expected coupon has not been applied to this checkout', 409);
    }
    if (
      realEntitlement(billing) ||
      realEntitlement(member) ||
      !(await customerIsUnused(checkout.customer))
    ) {
      return error('Account has real billing activity', 409);
    }
    const run = await startQaTrial(buyer.uid, {
      id: body.runId,
      affiliateCode: affiliate.code,
      source: meta.affiliateCode ? 'link' : 'coupon',
      checkout: createHash('sha256').update(checkout.id).digest('hex'),
    });
    if (!run) return error('Another demo is active or this run cannot be resumed', 409);
    await setPlatformSession({
      ...buyer,
      tier: 'economy',
      subscriptionStatus: 'trialing',
      qaExpiresAt: run.expiresAt,
    });
    if (form) {
      return new NextResponse(null, {
        status: 303,
        headers: { Location: '/dashboard', 'Cache-Control': 'no-store' },
      });
    }
    return NextResponse.json(
      { simulated: true, runId: run.id, returnPath: '/dashboard', expiresAt: run.expiresAt },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return error('Unable to confirm the demo checkout', 503);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!(await authorized(request))) return error('Not found', 404);
  try {
    const body = await request.json();
    const buyer = await getPlatformSession();
    const uid = body?.uid ?? buyer?.uid;
    if (
      typeof uid !== 'string' ||
      !/^[\w-]{1,128}$/.test(uid) ||
      typeof body.runId !== 'string' ||
      !uuid.test(body.runId)
    ) {
      return error('Invalid cleanup request', 400);
    }
    const user = await auth.getUser(uid);
    if (!user.email || !eligibleIdentity(uid, user.email)) return error('Test identity mismatch', 403);
    if (!(await endQaTrial(uid, body.runId))) return error('The requested run does not own this demo', 409);
    if (buyer?.uid === uid && buyer.qaExpiresAt) await deletePlatformSession();
    return NextResponse.json({ cleaned: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return error('Unable to clean up the demo', 503);
  }
}
