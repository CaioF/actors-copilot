import { stripe } from '@/lib/stripe';

/**
 * Affiliate coupon codes in Stripe.
 *
 * Every affiliate gets a customer-facing promotion code on one shared coupon.
 * The code is what a customer types at checkout; the affiliate it belongs to
 * travels in the promotion code's metadata, so the webhook can attribute the
 * sale without trusting anything the browser sends.
 *
 * The coupon is the discount itself, and Stripe coupons are immutable once
 * created: the percentage is fixed when the coupon is first made. Changing it
 * means creating a new coupon under a new id.
 */

/** Id of the shared coupon every affiliate code points at. */
const DEFAULT_AFFILIATE_COUPON_ID = 'affiliate_default';

/** Percentage taken off the first payment by the shared coupon. */
const DEFAULT_AFFILIATE_DISCOUNT_PERCENT = 20;

/** How the shared coupon id is resolved. */
export function affiliateCouponId(): string {
  return process.env.STRIPE_AFFILIATE_COUPON_ID?.trim() || DEFAULT_AFFILIATE_COUPON_ID;
}

/** How the shared coupon discount is resolved. */
export function affiliateDiscountPercent(): number {
  const raw = process.env.STRIPE_AFFILIATE_DISCOUNT_PERCENT;
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
    return DEFAULT_AFFILIATE_DISCOUNT_PERCENT;
  }
  return parsed;
}

export interface AffiliatePromotionCode {
  /** Id of the shared coupon the code belongs to. */
  couponId: string;
  /** Customer-facing code, e.g. `LUCAS`. */
  promotionCode: string;
  /** Stripe id of the promotion code. */
  promotionCodeId: string;
}

/**
 * Returns the shared affiliate coupon, creating it the first time.
 *
 * The coupon id is deterministic, so a second call finds the existing coupon
 * instead of minting a second one with a different discount.
 */
export async function ensureAffiliateCoupon(): Promise<{ id: string }> {
  const id = affiliateCouponId();

  try {
    return await stripe.coupons.create({
      id,
      percent_off: affiliateDiscountPercent(),
      duration: 'once',
      name: `Affiliate ${affiliateDiscountPercent()}% off the first payment`,
      metadata: { role: 'affiliate' },
    });
  } catch (error) {
    // The coupon already exists: that is the normal path after the first run.
    try {
      const existing = await stripe.coupons.retrieve(id);
      if ((existing as { deleted?: boolean }).deleted) throw error;
      return existing as { id: string };
    } catch (retrieveError) {
      throw error;
    }
  }
}

/**
 * Returns the Stripe promotion code for an affiliate, creating it if needed.
 *
 * The code is the affiliate's own code in upper case, so `lucas` becomes
 * `LUCAS`. Promotion codes are case insensitive in Stripe, and the affiliate
 * is stored in the metadata so the webhook can resolve it without a lookup by
 * name.
 *
 * `first_time_transaction` keeps the discount for new sign-ups only: an
 * existing customer who types the code gets no discount, so a code can never
 * become a way to buy a plan cheaper than the published price.
 *
 * @param code - The normalised affiliate code.
 * @returns The coupon and promotion code ids.
 */
export async function ensureAffiliatePromotionCode(
  code: string,
): Promise<AffiliatePromotionCode> {
  const coupon = await ensureAffiliateCoupon();
  const customerFacingCode = code.toUpperCase();

  const existing = await stripe.promotionCodes.list({
    code: customerFacingCode,
    active: true,
    limit: 1,
  });

  if (existing.data.length > 0) {
    const promotion = existing.data[0];
    if (promotion.metadata?.affiliateCode !== code) {
      await stripe.promotionCodes.update(promotion.id, {
        metadata: { affiliateCode: code },
      });
    }
    return {
      couponId: coupon.id,
      promotionCode: promotion.code,
      promotionCodeId: promotion.id,
    };
  }

  const promotion = await stripe.promotionCodes.create({
    promotion: { type: 'coupon', coupon: coupon.id },
    code: customerFacingCode,
    restrictions: { first_time_transaction: true },
    metadata: { affiliateCode: code },
  });

  return {
    couponId: coupon.id,
    promotionCode: promotion.code,
    promotionCodeId: promotion.id,
  };
}

/**
 * Reads the affiliate a Stripe promotion code belongs to.
 *
 * @param promotionCodeId - The Stripe promotion code id.
 * @returns The affiliate code, or null when the code is not one of ours.
 */
export async function readPromotionCodeAffiliateCode(
  promotionCodeId: string,
): Promise<string | null> {
  try {
    const promotion = await stripe.promotionCodes.retrieve(promotionCodeId);
    const code = promotion.metadata?.affiliateCode;
    return typeof code === 'string' && code.length > 0 ? code : null;
  } catch {
    return null;
  }
}
