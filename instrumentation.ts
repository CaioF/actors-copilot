export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;

    try {
        const { findStripePriceProblems } = await import('./lib/stripe/env');
        const problems = await findStripePriceProblems();
        if (problems.length > 0) {
            // Logged rather than thrown so a misconfigured price can't take down the whole site.
            console.error(`[billing] Invalid Stripe configuration, checkouts will fail:\n- ${problems.join('\n- ')}`);
        }
    } catch (error) {
        console.error('[billing] Could not validate Stripe price configuration at startup:', error);
    }
}
