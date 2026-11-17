# Access and billing

## Entry and behavior

- `/login`: switch Log In / Create Account, email/password or Google, password visibility, remember-me, forgotten password. Check validation, loading, errors and resulting navigation; do not create an account against an unknown backend.
- Login callback exchanges Firebase identity for a platform session (`lib/context/AuthContext.tsx`, `app/api/auth/callback/route.ts`). Both client auth and server cookie matter. Test signed out, expired/invalid session and reload; logout should remove access.
- `proxy.ts` matcher protects specified routes, not every path in the interior group. With Stripe engine, missing/invalid session redirects to login; free or inactive sessions are allowed on dashboard and otherwise routed to upgrade on matched paths; active economy is redirected from profile and acting coach; active business passes. `/api/billing/success` and admin have special handling. Check the actual matcher and `ProtectedRoute` separately before asserting protection for `/reader-copilot`, `/dna-vault` or `/upgrade`.
- `/upgrade` chooses plan and calls checkout; `/settings` opens billing portal. `/start-trial` handles flagged recovery and calls recovery checkout. Test success, cancellation, repeat request, recovery error and return to the same origin only in a verified Stripe test environment. A redirect to Stripe alone does not prove entitlement: confirm a real test subscription and webhook result, then refresh the session and check access.
- `/admin-dashboard` has a separate admin session and login; admin APIs require that session. Members and affiliates are sensitive administrative data; use isolated fixtures.

## Boundaries and checks

Stripe webhook owns access/tier/status; never manufacture entitlement by Firestore writes. Checkout must reuse mapped customer and preserve idempotency. Check test-mode price configuration, origin and webhook signing; do not submit live payment or mutate a real subscription. Recovery state lives on the user record and is cleared when a real subscription exists. Account deletion is destructive and is not a smoke-test step.

Source: `app/login/page.tsx`, `app/start-trial/page.tsx`, `app/(interior)/upgrade/page.tsx`, `app/(interior)/settings/page.tsx`, `proxy.ts`, `lib/billing-checkout.ts`, `app/api/billing/`, `app/api/webhooks/stripe/route.ts`, `lib/admin-dashboard/`. Existing tests: `proxy.test.ts`, `app/login/page.test.tsx`, `app/start-trial/page.test.tsx`, `app/api/auth/callback/route.test.ts`, `app/api/billing/{checkout,recovery,portal}/route.test.ts`, `app/api/webhooks/stripe/route.test.ts`, `__tests__/integration/admin-dashboard-flow.test.tsx`.
