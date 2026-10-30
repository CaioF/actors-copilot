'use client';

type TrialCheckoutResult = { url: string } | { error: string };

let inFlight: Promise<TrialCheckoutResult> | null = null;

/**
 * Starts the 14-day trial checkout once per page load. Both the login page and
 * AuthContext trigger this after sign-in; sharing one in-flight promise keeps
 * them from creating duplicate Stripe customers/sessions.
 */
export function startTrialCheckout(getIdToken: () => Promise<string | undefined>): Promise<TrialCheckoutResult> {
    if (inFlight) return inFlight;

    inFlight = (async (): Promise<TrialCheckoutResult> => {
        const trialTier = sessionStorage.getItem('trial_tier') || 'business';
        const requestId = sessionStorage.getItem('trial_request_id') ?? crypto.randomUUID();
        sessionStorage.setItem('trial_request_id', requestId);

        try {
            const idToken = await getIdToken();
            const res = await fetch('/api/billing/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tier: trialTier, isTrial: true, idToken, requestId }),
            });
            const data = await res.json();

            if (res.ok && data.url) {
                sessionStorage.removeItem('trial_intent');
                sessionStorage.removeItem('trial_tier');
                sessionStorage.removeItem('trial_request_id');
                return { url: data.url as string };
            }
            // Stripe can cache a failed idempotent request, so retries need a fresh key.
            sessionStorage.removeItem('trial_request_id');
            inFlight = null;
            return { error: (data?.error as string) || 'Could not start your free trial checkout.' };
        } catch {
            sessionStorage.removeItem('trial_request_id');
            inFlight = null;
            return { error: 'Could not start your free trial checkout.' };
        }
    })();

    return inFlight;
}
