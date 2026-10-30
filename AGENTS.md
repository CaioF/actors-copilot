# The Actors Copilot — Agent Guide

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · Firebase (Auth + Firestore) · Stripe · Vercel

Package manager: **pnpm 9** (CI and Vercel both read `pnpm-lock.yaml`).

## Deployment workflow — important

**Normal feature development never deploys by hand.**

1. Branch off `main` (`git checkout -b feat/...`).
2. Commit and push the branch.
3. Open a Pull Request targeting `main`.
4. Merge the PR. GitHub Actions (`.github/workflows/ci.yml`) runs lint + tests + typecheck, and the
   Vercel Git integration auto-deploys `main` to production.

`vercel deploy --prod` is reserved for **production incidents (hotfixes)**.

> If you ship a hotfix with `vercel deploy --prod`, you **must** open a PR with the same changes and
> merge it into `main` right after. Otherwise the next automatic deploy triggered by a push to `main`
> silently reverts the hotfix.

Production domains: `app.theactorscopilot.com`, `actors-copilot.vercel.app`,
`v0-self-tape-copilot.vercel.app`.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm run lint          # eslint
pnpm run typecheck     # tsc --noEmit
pnpm test              # jest

vercel whoami          # active Vercel account
vercel deploy         # preview
vercel deploy --prod  # production (hotfixes only)
vercel logs           # runtime logs
vercel rollback       # revert to the previous deployment
```

## Billing invariants

The entitlement is always owned by **Stripe + webhook**, never by Firestore alone.

- `users/{uid}/billing/current` is the source of truth for the tier and the Stripe customer id.
- The webhook (`app/api/webhooks/stripe/route.ts`) is the only writer of `hasAccess`, `tier` and
  `subscriptionStatus`. Writing them by hand creates entitlements that do not exist in Stripe.
- Stripe customers and checkout sessions are created with **idempotency keys**
  (`lib/billing-checkout.ts`). Never remove them: without them, two concurrent checkout requests
  mint duplicate Stripe customers.
- `POST /api/billing/checkout` reuses the customer already stored in Firestore. It only mints a new
  one when no customer is mapped yet.

## Trial recovery flow

Accounts whose first checkout failed because of a server-side fault (for example inactive Stripe
Price IDs) carry a `billingRecovery` flag on `users/{uid}`.

- `POST /api/auth/callback` reports the flag as `billingRecovery.required`.
- The client routes those accounts to `/start-trial`, a branded interstitial that explains what
  happened and hands over to the Stripe Checkout after a short countdown.
- `POST /api/billing/recovery` opens (or reuses) the checkout session for the signed in account.
- The webhook clears the flag once a real subscription exists.

## Local environment caveat

The local `node_modules` is installed with **bun**, which ignores the lockfile resolutions. This can
produce a `tsc --noEmit` error that CI and Vercel do not have — for example `stripe` resolves to
`22.6.2` locally while `pnpm-lock.yaml` pins `22.2.1`, and the two disagree on the `apiVersion`
literal. **Do not "fix" those errors by editing the source**: reinstall with pnpm instead, or
confirm against CI before touching the code.

## Environment variables

`.env` (local, gitignored) and `env.example` document every variable. The Stripe Price IDs must
point to **active** prices in live mode; an inactive price makes every checkout fail with a 500.
