import Stripe from 'stripe';
import { stripe } from './stripe';

/**
 * Supported subscription tiers for the platform.
 */
export type SubscriptionTier = 'free' | 'economy' | 'business';

/**
 * Valid subscription statuses synchronized from Stripe.
 */
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'canceled'
  | 'incomplete'
  | 'past_due'
  | 'unpaid';

export type BillingCycle = 'monthly' | 'annual';

/**
 * Community access is modelled independently from the app tier.
 *
 * The Skool "The Actors Copilot Green Room" is a SINGLE membership:
 * - it is included at no extra cost with Economy Class and Business Class;
 * - it is also sold on its own (community-only, no app access).
 *
 * Therefore Economy and Business must never be represented as different
 * levels of Skool access.
 */
export type CommunityEntitlement = 'none' | 'green_room';

/**
 * Represents the structure of the billing document stored in Firestore 
 * at the path: `users/{uid}/billing/current` or mapped from user data.
 */
export interface UserBilling {
  uid: string;
  customerId?: string;
  subscriptionId?: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  priceId?: string;
  currentPeriodEnd?: number; // Epoch timestamp in seconds
  cancelAtPeriodEnd?: boolean;
  hasAccess?: boolean;
  /** Skool Green Room membership, independent from the app tier. */
  community?: CommunityEntitlement;
  trialStart?: number | null;
  trialEnd?: number | null;
  hasUsedTrial?: boolean;
}

/**
 * Represents the light payload injected into the user's platform session 
 * to gate access to AI tools efficiently without refetching the database.
 */
export interface PlatformSessionPayload {
  tier: SubscriptionTier;
  isActive: boolean;
  status: SubscriptionStatus;
}

// Runtime environment validation for operational integrity
const economyPriceId = process.env.STRIPE_ECONOMY_PRICE_ID;
const businessPriceId = process.env.STRIPE_BUSINESS_PRICE_ID;
const economyAnnualPriceId = process.env.STRIPE_ECONOMY_ANNUAL_PRICE_ID;
const businessAnnualPriceId = process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID;

/**
 * Community-only product (The Actors Copilot Green Room on Skool).
 * Intentionally optional: existing deployments must keep booting without it.
 */
const greenRoomPriceId = process.env.STRIPE_GREEN_ROOM_PRICE_ID;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!economyPriceId || !businessPriceId) {
  throw new Error('❌ CRITICAL: Stripe Price IDs are missing from environment variables.');
}

if (!webhookSecret) {
  throw new Error('❌ CRITICAL: STRIPE_WEBHOOK_SECRET is missing from environment variables.');
}

/**
 * Maps an internal platform subscription tier to its respective Stripe Price ID.
 * * @param {SubscriptionTier} tier - The target platform subscription tier.
 * @returns {string} The corresponding Stripe Price ID.
 * @throws {Error} If an unsupported or invalid tier is provided.
 */
export function getStripePriceIdForTier(tier: SubscriptionTier, billingCycle: BillingCycle = 'monthly'): string {
  switch (tier) {
    case 'economy':
      if (billingCycle === 'annual') {
        if (!economyAnnualPriceId) {
          throw new Error('Missing STRIPE_ECONOMY_ANNUAL_PRICE_ID for annual billing cycle.');
        }
        return economyAnnualPriceId;
      }
      return economyPriceId as string;
    case 'business':
      if (billingCycle === 'annual') {
        if (!businessAnnualPriceId) {
          throw new Error('Missing STRIPE_BUSINESS_ANNUAL_PRICE_ID for annual billing cycle.');
        }
        return businessAnnualPriceId;
      }
      return businessPriceId as string;
    case 'free':
      throw new Error('The "free" tier does not map to a Stripe Price ID.');
    default: {
      const exhaustiveCheck: never = tier;
      throw new Error(`Unsupported subscription tier: ${exhaustiveCheck}`);
    }
  }
}

/**
 * Maps a Stripe Price ID back to the corresponding platform subscription tier.
 * * @param {string | undefined} priceId - The Stripe Price ID received from the API or Webhook.
 * @returns {SubscriptionTier} The resolved subscription tier ('free' if unmapped or empty).
 */
export function mapStripePriceToTier(priceId: string | undefined): SubscriptionTier {
  if (!priceId) return 'free';

  // Community-only purchase: a valid product, but it never grants an app tier.
  if (greenRoomPriceId && priceId === greenRoomPriceId) {
    return 'free';
  }

  switch (priceId) {
    case economyPriceId:
    case economyAnnualPriceId:
      return 'economy';
    case businessPriceId:
    case businessAnnualPriceId:
      return 'business';
    default:
      // Graceful degradation: log unexpected price IDs but default to free to protect UX
      console.warn(`⚠️ Unmapped Stripe Price ID detected: ${priceId}. Defaulting to "free" tier.`);
      return 'free';
  }
}

/**
 * Returns the Stripe Price ID of the community-only Green Room membership.
 *
 * @returns {string} The `price_...` ID for the Green Room product.
 * @throws {Error} If `STRIPE_GREEN_ROOM_PRICE_ID` is not configured.
 */
export function getStripeGreenRoomPriceId(): string {
  if (!greenRoomPriceId) {
    throw new Error('Missing STRIPE_GREEN_ROOM_PRICE_ID for the Green Room membership.');
  }
  return greenRoomPriceId;
}

/**
 * Maps a Stripe Price ID to the Skool Green Room entitlement.
 *
 * All paid plans include the SAME single Green Room membership at no extra
 * cost, so the community-only price, Economy (monthly/annual) and Business
 * (monthly/annual) all resolve to `green_room`.
 *
 * @param {string | undefined} priceId - The Stripe Price ID from the API or webhook.
 * @returns {CommunityEntitlement} `green_room` when the price includes the community.
 */
export function mapStripePriceToCommunity(priceId: string | undefined): CommunityEntitlement {
  if (!priceId) return 'none';

  if (greenRoomPriceId && priceId === greenRoomPriceId) return 'green_room';

  switch (priceId) {
    case economyPriceId:
    case economyAnnualPriceId:
    case businessPriceId:
    case businessAnnualPriceId:
      return 'green_room';
    default:
      console.warn(`⚠️ Unmapped Stripe Price ID detected: ${priceId}. Defaulting community to "none".`);
      return 'none';
  }
}

/**
 * Resolves both entitlements carried by a single Stripe Price.
 *
 * `appTier` gates the app features while `community` gates the Skool Green
 * Room. A community-only purchase resolves to `appTier: 'free'` and
 * `community: 'green_room'`.
 *
 * @param {string | undefined} priceId - The Stripe Price ID from the API or webhook.
 * @returns {{ appTier: SubscriptionTier; community: CommunityEntitlement }} The resolved entitlements.
 */
export function resolveEntitlementsFromPrice(priceId: string | undefined): {
  appTier: SubscriptionTier;
  community: CommunityEntitlement;
} {
  return {
    appTier: mapStripePriceToTier(priceId),
    community: mapStripePriceToCommunity(priceId),
  };
}

/**
 * Verifies a raw webhook payload signature against the Stripe signature header.
 * Ensures the event originates exclusively from an authorized Stripe server.
 * * @param {string | Buffer} body - The raw request body string or buffer from the incoming HTTP request.
 * @param {string | string[]} signature - The 'stripe-signature' header value.
 * @returns {Stripe.Event} The validated Stripe Event object.
 * @throws {Stripe.errors.StripeSignatureVerificationError} If the signature verification fails.
 */
export function verifyStripeWebhookEvent(
  body: string | Buffer,
  signature: string | string[]
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    body,
    signature,
    webhookSecret as string
  );
}

/**
 * Constructs a minimal billing metadata payload suitable for the user session context.
 * Used by frontend guards to instantaneously evaluate feature authorization.
 * * @param {UserBilling} userBilling - The comprehensive billing record derived from the database.
 * @returns {PlatformSessionPayload} The streamlined session authorization metadata.
 */
export function buildPlatformSessionPayload(userBilling: UserBilling): PlatformSessionPayload {
  const activeStatuses: SubscriptionStatus[] = ['active', 'trialing'];
  const isActive = activeStatuses.includes(userBilling.status);

  return {
    tier: isActive ? userBilling.tier : 'free',
    status: userBilling.status,
    isActive,
  };
}