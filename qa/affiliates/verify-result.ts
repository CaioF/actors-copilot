import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deleteApp, getApp } from 'firebase-admin/app';
import { extractSessionAffiliateCandidates } from '@/lib/admin-dashboard/affiliates';
import { adminSubscriptionStatus } from '@/lib/admin-dashboard/domain';
import { getStripePriceIdForTier } from '@/lib/billing';
import { auth, db } from '@/lib/firebase.admin';
import { qaCheckoutFingerprint, realEntitlement } from '@/lib/qa-affiliate-run';
import { stripe } from '@/lib/stripe';

// Read-only post-run check, scoped to the exact signup and Checkout filmed.
async function verify() {
  const directory = process.argv[2];
  const email = process.env.QA_SIMULATION_SIGNUP_EMAIL?.trim().toLowerCase();
  assert(directory && email && /^[a-z0-9.+_-]+@example\.test$/.test(email), 'Provide the run directory and its reserved QA email.');
  const run = JSON.parse(await readFile(join(directory, 'report.json'), 'utf8'));
  assert(run.status === 'demo-complete' && run.demoHttpStatus === 303 && run.cleanup === 'verified', 'The recorded run did not complete.');
  assert((run.tier === 'business' || run.tier === 'economy') && /^[a-f0-9]{64}$/.test(run.checkoutFingerprint), 'Missing selected tier or Checkout fingerprint.');
  assert.deepEqual(run.session, { tier: run.tier, subscriptionStatus: 'trialing' });
  assert.deepEqual(run.afterCleanup, { status: 'No plan', tier: 'Free', referredBy: 'lucas' });

  const { uid } = await auth.getUserByEmail(email);
  const handle = createHash('sha256').update('affiliate-qa:' + uid).digest('hex');
  const [member, billing, receipt, affiliate] = await db.getAll(
    db.doc(`users/${uid}`), db.doc(`users/${uid}/billing/current`),
    db.doc('qaAffiliateSimulations/' + handle), db.doc('affiliates/lucas'),
  );
  const customer = billing.get('customerId');
  assert(typeof customer === 'string' && member.get('affiliateCode') === 'lucas', 'Customer mapping or referral missing.');
  assert(!receipt.exists && !realEntitlement(billing.data()) && !realEntitlement(member.data()), 'A demo or subscription remains.');
  assert.equal(adminSubscriptionStatus(billing.data() ?? {}), null);
  const [subscriptions, invoices] = await Promise.all([
    stripe.subscriptions.list({ customer, status: 'all', limit: 1 }),
    stripe.invoices.list({ customer, status: 'paid', limit: 1 }),
  ]);
  assert(!subscriptions.data.length && !invoices.data.length, 'This buyer has real subscription or invoice activity.');

  for await (const candidate of stripe.checkout.sessions.list({ customer, limit: 100 })) {
    if (qaCheckoutFingerprint(candidate.id) !== run.checkoutFingerprint) continue;
    const checkout = await stripe.checkout.sessions.retrieve(candidate.id, { expand: ['line_items'] });
    assert(checkout.client_reference_id === uid && checkout.metadata?.platformUserId === uid);
    assert(checkout.mode === 'subscription' && checkout.status !== 'complete' && !checkout.subscription);
    assert(checkout.success_url && new URL(checkout.success_url).origin === run.origin);
    assert(checkout.metadata.targetTier === run.tier && checkout.metadata.billingCycle === 'monthly' && checkout.metadata.isTrial === 'true');
    assert(checkout.line_items?.data[0]?.price?.id === getStripePriceIdForTier(run.tier, 'monthly'));
    const promotion = affiliate.get('promotionCodeId');
    assert(typeof promotion === 'string' && extractSessionAffiliateCandidates(checkout).promotionCodeIds.includes(promotion));
    console.info(JSON.stringify({
      origin: run.origin, recordedTier: run.tier, trialStatus: run.session.subscriptionStatus,
      stripeCheckoutStatus: checkout.status, verifiedReferral: 'lucas',
      qaReceiptRemoved: true, realSubscriptions: 0, paidInvoices: 0,
    }));
    return;
  }
  throw new Error('The recorded Checkout does not belong to this buyer.');
}

verify().finally(() => deleteApp(getApp())).catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
