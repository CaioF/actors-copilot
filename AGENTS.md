# The Actors Copilot — Agent Guide

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · Firebase (Auth + Firestore) · Stripe · Vercel

Package manager: **pnpm 9** (CI and Vercel both read `pnpm-lock.yaml`).

## Deployment workflow — important

**Normal feature development never deploys by hand.**

1. Branch off `main` (`git checkout -b feat/...`).
2. Commit and push the branch.
3. Open a Pull Request targeting `main`.
4. **Wait for the user's explicit approval before merging.** GitHub Actions
   (`.github/workflows/ci.yml`) runs lint + tests + typecheck, and the Vercel Git integration
   auto-deploys `main` to production the moment the PR is merged. Report the PR number, the CI
   result and the commit, then ask to merge. Never merge on your own initiative: merging is the
   user's decision, because merging is what ships to production.

`vercel deploy --prod` is reserved for **production incidents (hotfixes)**, and it is a
production write: describe the incident, ask for permission, and run it only after the answer.

> If you ship a hotfix with `vercel deploy --prod`, you **must** open a PR with the same changes
> and merge it into `main` right after (with the user's approval, like any other PR). Otherwise
> the next automatic deploy triggered by a push to `main` silently reverts the hotfix.

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

**Explicit QA exception:** an operator may simulate a trial for specifically authorized test
accounts through the disabled-by-default, allowlisted QA simulation endpoint. Simulated access
is not a Stripe subscription or payment. It must be marked as QA, excluded from real affiliate
revenue, protected by admin authentication and a separate secret, and cleaned up after testing.
The endpoint must reject accounts with a real active/trialing subscription and fail closed when
its allowlists or secret are missing. A fresh browser signup may use one exact preapproved address at `example.test`; existing identities require an exact UID and email. The endpoint verifies the already-open checkout and records a signed 15-minute QA receipt. The Stripe webhook retains ownership of real billing documents.

## Trial recovery flow

The initial trial signup records `users/{uid}.billingRecovery`. Choosing a plan records its tier,
billing cycle and currency before the app requests hosted Stripe Checkout. This navigation state
survives a closed tab, a failed request, an expired Checkout and a sign-in on another device.

- Email and Google sign-in and restored member sessions check for pending recovery. A returning
  actor lands on `/start-trial`, reviews their selection and explicitly clicks **Resume checkout**.
- `POST /api/billing/recovery` without a selection reads the state. Submitting a selection reuses
  a matching open Stripe session or opens a new one when the previous session expired. If Stripe
  already completed Checkout, the actor can check for webhook confirmation without starting again.
- Older records with a customer and a checkout attempt can qualify even when the old customer
  record says `free/canceled`. The recovery page looks up that actor’s actual choice in Stripe.
  Subscription history, used trials and resolved recovery flags take precedence.
- The admin member row shows **Checkout pending** and the selected plan when known. Entitlement
  stays Free until the webhook records the subscription. An authorized QA receipt temporarily
  shows **Trial** and its plan. The underlying recovery survives receipt removal.
- The existing operator-reviewed restart for invalid historical billing retains its own checks.
  See [the browser procedure](qa/affiliates/README.md#reproduce-an-unfinished-first-checkout).

## Local environment caveat

The local `node_modules` is installed with **bun**, which ignores the lockfile resolutions. This can
produce a `tsc --noEmit` error that CI and Vercel do not have — for example `stripe` resolves to
`22.6.2` locally while `pnpm-lock.yaml` pins `22.2.1`, and the two disagree on the `apiVersion`
literal. **Do not "fix" those errors by editing the source**: reinstall with pnpm instead, or
confirm against CI before touching the code.

## Environment variables

`.env` (local, gitignored) and `env.example` document every variable. The Stripe Price IDs must
point to **active** prices in live mode; an inactive price makes every checkout fail with a 500.
