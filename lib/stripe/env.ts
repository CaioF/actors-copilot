import { stripe } from '@/lib/stripe';

const REQUIRED_PRICES = [
    ['STRIPE_ECONOMY_PRICE_ID', 'economy monthly'],
    ['STRIPE_BUSINESS_PRICE_ID', 'business monthly'],
    ['STRIPE_ECONOMY_ANNUAL_PRICE_ID', 'economy annual'],
    ['STRIPE_BUSINESS_ANNUAL_PRICE_ID', 'business annual'],
] as const;

/**
 * Lists every configured Stripe Price that cannot be used for a new
 * subscription checkout (missing, inactive, non-recurring, or nonexistent).
 * A deactivated price does not break the build, only live checkouts, so this
 * check makes that failure visible.
 */
export async function findStripePriceProblems(): Promise<string[]> {
    const problems: string[] = [];

    await Promise.all(
        REQUIRED_PRICES.map(async ([envKey, label]) => {
            const priceId = process.env[envKey];
            if (!priceId) {
                problems.push(`${envKey} (${label}) is not set`);
                return;
            }
            try {
                const price = await stripe.prices.retrieve(priceId);
                if (!price.active) {
                    problems.push(`${envKey} (${label}) points to ${priceId}, which is INACTIVE and cannot be used in new checkouts`);
                }
                if (!price.recurring) {
                    problems.push(`${envKey} (${label}) points to ${priceId}, which is not recurring (incompatible with subscription mode)`);
                }
            } catch {
                problems.push(`${envKey} (${label}) points to ${priceId}, which does not exist in this Stripe mode`);
            }
        }),
    );

    return problems;
}

export async function assertStripePricesUsable(): Promise<void> {
    const problems = await findStripePriceProblems();
    if (problems.length > 0) {
        throw new Error(`Invalid Stripe configuration:\n- ${problems.join('\n- ')}`);
    }
}
