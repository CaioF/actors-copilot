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
export function getStripePriceIdForTier(tier: SubscriptionTier): string {
  switch (tier) {
    case 'economy':
      return economyPriceId as string;
    case 'business':
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

  switch (priceId) {
    case economyPriceId:
      return 'economy';
    case 'price_economy_yearly_placeholder': // Reserved for future scalability if needed
    case businessPriceId:
      return 'business';
    default:
      // Graceful degradation: log unexpected price IDs but default to free to protect UX
      console.warn(`⚠️ Unmapped Stripe Price ID detected: ${priceId}. Defaulting to "free" tier.`);
      return 'free';
  }
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