import { NextResponse } from 'next/server';
import { getPlatformSession } from '@/lib/session';
import { db } from '@/lib/firebase.admin';
import { stripe } from '@/lib/stripe';
import { findAffiliateByCode } from '@/lib/admin-dashboard/affiliates';

/**
 * GET /api/billing/affiliate
 *
 * Reports the affiliate offer that applies to the signed in member, so the
 * app can show it before the member hands over to Stripe.
 *
 * The discount itself is applied by Stripe on the checkout session. This
 * endpoint only makes it visible: during a free trial the amount due today
 * is zero, so a discount on the first real invoice is invisible on the
 * Stripe page and the member has to be told about it here.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getPlatformSession();
    if (!session?.uid) {
      return NextResponse.json({ affiliate: null });
    }

    const userDoc = await db.doc(`users/${session.uid}`).get();
    const code = (userDoc.data() as { affiliateCode?: unknown } | undefined)?.affiliateCode;

    if (typeof code !== 'string' || code.length === 0) {
      return NextResponse.json({ affiliate: null });
    }

    const affiliate = await findAffiliateByCode(code);
    if (!affiliate?.couponId) {
      return NextResponse.json({ affiliate: null });
    }

    const coupon = await stripe.coupons.retrieve(affiliate.couponId);
    const percentOff = coupon.percent_off;

    if (typeof percentOff !== 'number' || percentOff <= 0) {
      return NextResponse.json({ affiliate: null });
    }

    return NextResponse.json({
      affiliate: {
        code: affiliate.code,
        promotionCode: affiliate.promotionCode,
        percentOff,
      },
    });
  } catch (error) {
    // The offer is a nice to have: the discount is applied by Stripe either
    // way, so a failure here must never break the page.
    return NextResponse.json({ affiliate: null });
  }
}
