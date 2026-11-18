# Record the Lucas referral from signup to the operator dashboard

One continuous, English-language Chromium recording follows the address actually displayed for Lucas in the affiliate panel. The browser creates a fresh Firebase account, follows the application's redirects and opens a real hosted Stripe Checkout. In confirmation mode, a protected operator form substitutes for the provider's payment confirmation. It issues an HTTP 303 that Chrome follows. An open Checkout or a passing Jest test alone cannot establish a completed browser run.

## Browser journey and acceptance criteria

These internal recordings show the browser's full viewport. In the operator panel, keep the other rows, table headings, balances, buttons and Transfers section visible. In Stripe, show the hosted order summary alongside its payment form. Use the app's normal password fields and leave the card fields empty. Store captures in the local Git-ignored evidence directory.

If the operator encounters **Admin access** while opening **Affiliates**, sign in through the displayed form. If it returns to **Member dashboard**, click **Affiliates** again. Keep that interaction in the same recording. Success requires the affiliate panel to be visible at the end.

On Windows the recorder focuses Chrome’s native address bar and checks its value before pressing Enter. Run `node --test qa/affiliates/check-camera.mjs` on an interactive Windows desktop to verify both operator destinations against a local fixture.

| Step | Operator or actor interaction | Evidence the recorder requires |
| --- | --- | --- |
| 1 | In a fresh Chrome profile, sign in at `/admin-dashboard`. Click **Affiliates** and find **Coupon code: LUCAS**. | Read the referral address from that row. Click it, or select, copy and open it in the address bar on deployments that display plain text. |
| 2 | Leave the selected **Create Account** tab as it is. Enter the designated new email and a password and submit. | Firebase accepts the signup. The actor lands on **Your free trial is ready to start** via the app's redirect. |
| 3 | Choose **Monthly**, the requested class, **USD** and **Start my free trial**. | The trial page and the hosted Stripe Checkout show LUCAS. The Checkout order summary names the chosen class, shows 20% off one billing cycle and $0 due today. The discounted monthly total is $15.20 for Economy or $23.20 for Business. |
| 4 | Open **QA payment confirmation** for the Checkout actually displayed and click **Confirm demo trial**. | The operator endpoint verifies the buyer, affiliate, promotion and purchased line item against the configured price. Chrome follows the POST's 303 to `GET /api/billing/success?session_id=…`. That handler issues the buyer session and redirects to the dashboard. The recorder checks the session reports `trialing` and the chosen tier. |
| 5 | Reopen the operator dashboard. Find the same email, then click **Affiliates**. | One row must show **lucas**, **Trial**, the chosen plan and **Simulated QA**. The affiliate row shows the separate simulated referral count. After the video ends, the recorder removes the receipt, reloads the member list and verifies **lucas**, **No plan**, **Free**. |

## Trace a reported member status

Match the exact email to its Firebase Auth UID. The member list reads `users/{uid}.affiliateCode` and `users/{uid}/billing/current` at request time. The `adminMembers/{uid}` projection supplies the display name and archived records. For the Stripe customer in the billing document, compare Checkout status, purchased price and subscription history. The following states can all occur for the same QA buyer.

| Point in the journey | Provider and Firestore evidence | Member row |
| --- | --- | --- |
| Signup or open Checkout | The referral is present. Creating a customer or selecting a price does not start a subscription. Older checkout-only billing documents may carry a placeholder `canceled`. | **lucas · No plan · Free** |
| QA confirmation | The selected tier, checkout fingerprint, referral and expiration are signed in `qaAffiliateSimulations`. The signed-in buyer follows the ordinary success route. | **lucas · Trial · Business** (or **Economy**) **· Simulated QA** |
| Cleanup or receipt expiry | The demo no longer contributes a tier or QA referral. A genuine link attribution survives. | **lucas · No plan · Free** for a fresh buyer |
| Real trial or cancellation | A real subscription has its own ID and lifecycle in Stripe. Its webhook writes the tier, status and trial dates to billing. A zero-dollar initial invoice can arrive on either side of those lifecycle events. | **Trial** with the subscribed plan while the trial is active. A documented cancellation remains **Canceled**. |

The fresh signup itself is a genuine link attribution. The demo contributes a separate QA count. A conversion, collected revenue, commission or transfer requires real financial activity. The genuine Stripe customer and open Checkout created during the browser visit, plus the synthetic Firebase account and its genuine attribution, can remain after cleanup. The test uses no card.

## Prepare a fresh run

Use Node 22+, pnpm 9, FFmpeg and visible Chromium on Windows or X11 Linux with `xdotool`. Start at the root of the app repository.

```sh
pnpm install --frozen-lockfile
pnpm --dir qa/affiliates install --frozen-lockfile --ignore-workspace
pnpm --dir qa/affiliates exec playwright install chromium
node qa/affiliates/setup-local.mjs
```

The last command creates a 256-bit key in ignored `.env.qa.local` if needed and prints the filename of a **new** ignored signup environment containing an exact reserved address and a password. In the examples below, substitute that filename for `.env.qa-signup-RUN.local`. Reusing an already registered address correctly fails the signup test.

The app server needs its regular Firebase, Stripe, admin-login and session configuration. `lib/firebase.admin.ts` uses the service account and the configured Firestore database, as do the maintenance scripts. A local app can connect to live backends. Set `AC_ADMIN_USERNAME` and `AC_ADMIN_PASSWORD` to the operator login in the recorder's environment (or an ignored file). Set `AC_FFMPEG_PATH` or `AC_CHROME_PATH` only if needed.

For Business, set `AC_TRIAL_TIER=business` on the recorder. Economy is the default. The browser scenario covers monthly USD. The endpoint also verifies configured annual prices. A local server needs `ADMIN_USERNAME`, `ADMIN_PASSWORD` and its own `ADMIN_JWT_SECRET`. Use matching credentials for the recorder and keep the signing key on the server.

For a pre-merge run, start the branch and the recorder in separate terminals with the same loopback origin. The default dev server origin is `http://localhost:3105`. In an ignored `.env.qa-browser.local` set `AC_BASE_URL=http://localhost:3105` and the operator variables. Launch the server from the branch checkout.

```sh
node --env-file=.env --env-file=.env.qa.local --env-file=.env.qa-signup-RUN.local --env-file=.env.qa-browser.local qa/affiliates/start-local.mjs
node --env-file=.env.qa.local --env-file=.env.qa-signup-RUN.local --env-file=.env.qa-browser.local qa/affiliates/run-simulation.mjs --confirm-demo
```

On a deployed build, set `AC_BASE_URL=https://app.theactorscopilot.com`. Observation mode works independently of the demo route: `--observe` stops at the real open checkout and verifies the new member's referral in admin. For `--confirm-demo`, the deployed server must contain this branch and have the same `QA_SIMULATION_SECRET`, `QA_SIMULATION_ALLOWED_AFFILIATES=lucas`, exact `QA_SIMULATION_SIGNUP_EMAIL` and `QA_SIMULATION_ENABLED=true`. The deployment picks up environment changes at build/redeploy time. The feature defaults off. Existing designated identities can instead be authorized with both `QA_SIMULATION_ALLOWED_UIDS` and `QA_SIMULATION_ALLOWED_EMAILS`; the fresh-signup recorder deliberately requires a new exact address.

## Boundaries, verification and recovery

- Only Stripe's confirmation is simulated. Signup, the hosted order, the return through the app's billing success handler and the operator checks use their ordinary paths. The provider still has a customer and an open Checkout. Real paid invoices, subscriptions and delivery of signed webhooks require separate Stripe testing.
- The server issues a signed, generation-bound receipt for at most 15 minutes in `qaAffiliateSimulations`. It never overwrites member, billing or payout records. Concurrent retries use the same run ID. A signed demo cookie expires with the receipt. Cleanup deletes the owning receipt and clears the current browser's demo cookie; previously issued cookies expire within that same window.
- When cleanup fails, the local report identifies the run. An authenticated operator can repeat the documented `DELETE /api/admin/affiliate-qa` with the same run ID and the exact QA UID, the matching bearer key and JSON body. Once the receipt expires it no longer appears in reporting. Keep the signing key until cleanup is complete.
- Final evidence lives in `qa/affiliates/evidence/signup-<UTC>/affiliate.mp4`, accompanied by `take.webm` and `report.json`. A failed run retains partial evidence. For the internal video, verify `demo-complete`, HTTP 303, `cleanup: verified` and `presentation: full browser viewport` in the report. The runner decodes the entire MP4. Review frames from the member table, affiliate table and both sides of Checkout.
- To audit a completed monthly run against Firebase and Stripe, use its exact signup environment and evidence directory: `pnpm exec tsx --env-file=.env --env-file=.env.qa-signup-RUN.local qa/affiliates/verify-result.ts qa/affiliates/evidence/signup-<UTC>`. This read-only check matches the purchased price and actual promotion to the recorded Checkout fingerprint and confirms cleanup on that buyer. It also works after the open Stripe Checkout expires.
- For the automated boundary and regression checks run `pnpm exec jest --runInBand --runTestsByPath app/api/admin/affiliate-qa/route.test.ts __tests__/integration/affiliate-qa-simulation.test.ts lib/context/AuthContext.test.tsx lib/admin-dashboard/qa-affiliate-report.test.ts`. Run `node --test qa/affiliates/check-camera.mjs` to check table values, controls, other rows, transfer history and the payment form on synthetic pages. The production recording verifies the actual redirects and hosted prices.

## Verified run

On November 18, 2026 the pre-merge app ran on loopback with the configured live Firebase project and Stripe-hosted Checkout. Chromium 159, English locale, 1440 × 900, captured one uninterrupted journey. The new account reached the trial-ready page automatically, Stripe displayed LUCAS and the asserted amounts, and the operator submitted the protected confirmation form. Chrome followed HTTP 303 to the dashboard. The same actor and the separate simulated referral were visible in admin. The report recorded `demo-complete` and verified cleanup. The original capture and MP4 are local. This result covers the PR version; deployment and production confirmation are separate.

On production commit `90acfb0`, a fresh actor completed a full-viewport observation through the hosted payment form and referral verification. A separate full-viewport recording starts at the open Economy Checkout of the earlier demo actor. The operator confirmed that session, Chrome followed HTTP 303, the full member table showed **Trial** and **Simulated QA**, and the affiliate table displayed the separate QA count. Cleanup removed the temporary receipt. These two recordings use different QA actors. A single-take signup-to-confirmation result requires one fresh actor throughout.

On November 18, production commit `c52d2e0` (PR #117) completed that single-take Economy journey. The same buyer appeared in the full member table as **lucas · Trial · Economy · Simulated QA**. Independent reads confirmed an open live Economy Checkout, the Lucas promotion, zero subscriptions and no paid invoices. The deployed QA endpoint returned directly to the dashboard.

The selected-tier fix was exercised on the branch using a fresh buyer, the live Firebase project and a real monthly Business Stripe Checkout. The native form returned 303 to the ordinary billing success handler, which returned 307 to the dashboard. The buyer session reported `business / trialing`, the member row showed Lucas and Business, and the signed receipt recorded the same values. After cleanup the same row showed **lucas · No plan · Free**. This is a pre-merge Business result.
