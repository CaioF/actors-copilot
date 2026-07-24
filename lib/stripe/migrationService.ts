import Stripe from 'stripe';

const apiKey = process.env.STRIPE_SECRET_KEY;

if (!apiKey) {
  throw new Error('[Stripe] STRIPE_SECRET_KEY is not defined in environment variables.');
}

/**
 * Singleton instance of the Stripe SDK.
 */
const stripe = new Stripe(apiKey);

/**
 * Input options required to generate a migration checkout session.
 */
export interface MigrationSessionInput {
  email: string;
  priceId: string;
  trialEndUnixTimestamp: number;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Result returned upon successful creation of a migration checkout session.
 */
export interface MigrationSessionResult {
  sessionId: string;
  url: string | null;
  customerId: string;
}

/**
 * Finds an existing Stripe Customer by email or creates a new one.
 * Ensures metadata is enriched with migration context.
 *
 * @async
 * @param email - The customer's email address.
 * @returns The resolved Stripe Customer object.
 * @throws {Error} If Stripe API request fails.
 */
async function getOrCreateCustomer(email: string): Promise<Stripe.Customer> {
  const normalizedEmail = email.trim().toLowerCase();

  const existingCustomers = await stripe.customers.list({
    email: normalizedEmail,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0];
  }

  return await stripe.customers.create({
    email: normalizedEmail,
    metadata: {
      source: 'kajabi_migration',
      migratedAt: new Date().toISOString(),
    },
  });
}

/**
 * Creates a tailored Stripe Checkout Session for Kajabi-to-Stripe subscriber migration.
 * Leverages `subscription_data.trial_end` to defer the first charge until the legacy period expires.
 *
 * @async
 * @param input - Configuration payload for the migration session.
 * @returns Details of the created checkout session including the hosted URL.
 * @throws {Error} If input validation fails or Stripe API encounters an error.
 */
export async function createMigrationCheckoutSession({
  email,
  priceId,
  trialEndUnixTimestamp,
  successUrl,
  cancelUrl,
}: MigrationSessionInput): Promise<MigrationSessionResult> {
  if (!email || !priceId || !trialEndUnixTimestamp) {
    throw new Error('[MigrationService] Missing required parameters: email, priceId, or trialEndUnixTimestamp.');
  }

  const nowUnix = Math.floor(Date.now() / 1000);

  // Safety check: trial_end must be strictly in the future for Stripe API requirements
  if (trialEndUnixTimestamp <= nowUnix + 60) {
    throw new Error(
      `[MigrationService] Invalid trial_end timestamp (${trialEndUnixTimestamp}). Must be at least 60 seconds in the future.`
    );
  }

  try {
    // 1. Resolve Stripe Customer
    const customer = await getOrCreateCustomer(email);

    // 2. Build the Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_end: trialEndUnixTimestamp,
        proration_behavior: 'none',
        metadata: {
          migrationSource: 'kajabi',
          originalEmail: email,
        },
      },
      // Prevents adding extra trial days via coupons during migration
      allow_promotion_codes: false,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        flow: 'subscriber_migration',
      },
    });

    return {
      sessionId: session.id,
      url: session.url,
      customerId: customer.id,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[MigrationService] Failed to create checkout session for ${email}:`, errorMessage);
    throw error;
  }
}