# Record the Lucas referral from signup to the operator dashboard

One continuous, English-language Chromium recording follows the address actually displayed for Lucas in the affiliate panel. The browser creates a fresh Firebase account, follows the application's redirects and opens a real hosted Stripe Checkout. In confirmation mode, a protected operator form substitutes for the provider's payment confirmation. It issues an HTTP 303 that Chrome follows. An open Checkout or a passing Jest test alone cannot establish a completed browser run.

## Browser journey and acceptance criteria

| Step | Operator or actor interaction | Evidence the recorder requires |
| --- | --- | --- |
| 1 | In a fresh Chrome profile, sign in at `/admin-dashboard`. Click **Affiliates** and find **Coupon code: LUCAS**. | Read the referral address from that row. Click it, or select, copy and open it in the address bar on deployments that display plain text. |
| 2 | Leave the selected **Create Account** tab as it is. Enter the designated new email and a password and submit. | Firebase accepts the signup. The actor lands on **Your free trial is ready to start** via the app's redirect. |
| 3 | Choose **Monthly**, **Economy Class**, **USD** and **Start my free trial**. | The trial screen shows the first-payment discount. Its second `POST /api/billing/recovery` opens Checkout. The hosted order summary shows LUCAS, 20% for one billing cycle, $0 today and $15.20 after trial for the current offer. A changed offer fails this check for review. |
| 4 | In demo mode open the operator's **QA payment confirmation** page for the exact session visible in Chrome and click **Confirm demo trial**. | The server checks the authenticated operator and buyer, the operator key, open checkout, mapped customer, promotion code, affiliate and trial eligibility. A successful native form POST redirects the browser to the actual dashboard. |
| 5 | Reopen the operator dashboard. Inspect the same signup, then click **Affiliates** again. | The same email has Lucas as referrer, **Trial** and **Simulated QA**. The affiliate row shows a separately labeled simulated referral. The recorder removes its receipt and records the cleanup result. |

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

For a pre-merge run, start the branch and the recorder in separate terminals with the same loopback origin. The default dev server origin is `http://localhost:3105`. In an ignored `.env.qa-browser.local` set `AC_BASE_URL=http://localhost:3105` and the operator variables. Launch the server from the branch checkout.

```sh
node --env-file=.env --env-file=.env.qa.local --env-file=.env.qa-signup-RUN.local --env-file=.env.qa-browser.local qa/affiliates/start-local.mjs
node --env-file=.env.qa.local --env-file=.env.qa-signup-RUN.local --env-file=.env.qa-browser.local qa/affiliates/run-simulation.mjs --confirm-demo
```

On a deployed build, set `AC_BASE_URL=https://app.theactorscopilot.com`. Observation mode works independently of the demo route: `--observe` stops at the real open checkout and verifies the new member's referral in admin. For `--confirm-demo`, the deployed server must contain this branch and have the same `QA_SIMULATION_SECRET`, `QA_SIMULATION_ALLOWED_AFFILIATES=lucas`, exact `QA_SIMULATION_SIGNUP_EMAIL` and `QA_SIMULATION_ENABLED=true`. The deployment picks up environment changes at build/redeploy time. The feature defaults off. Existing designated identities can instead be authorized with both `QA_SIMULATION_ALLOWED_UIDS` and `QA_SIMULATION_ALLOWED_EMAILS`; the fresh-signup recorder deliberately requires a new exact address.

## Boundaries, verification and recovery

- The only simulated event is Stripe's checkout completion and return. The signup uses the real UI. Production checkout creation can create a live customer and open session. This exercise covers the application's trial presentation and admin reporting. A paid invoice, a Stripe subscription or a signed webhook requires separate Stripe testing.
- The server issues a signed, generation-bound receipt for at most 15 minutes in `qaAffiliateSimulations`. It never overwrites member, billing or payout records. Concurrent retries use the same run ID. A signed demo cookie expires with the receipt. Cleanup deletes the owning receipt and clears the current browser's demo cookie; previously issued cookies expire within that same window.
- When cleanup fails, the local report identifies the run. An authenticated operator can repeat the documented `DELETE /api/admin/affiliate-qa` with the same run ID and the exact QA UID, the matching bearer key and JSON body. Once the receipt expires it no longer appears in reporting. Keep the signing key until cleanup is complete.
- Final evidence lives in `qa/affiliates/evidence/signup-<UTC>/affiliate.mp4`, accompanied by `take.webm` and `report.json`. A failed run retains partial evidence. Use a run only if the report says `demo-complete`, HTTP 303 and `cleanup: verified`. The runner verifies a full FFmpeg decode. Review the picture before sharing. Videos, reports, configuration and keys stay local and ignored by Git.
- For the automated boundary and regression checks run `pnpm exec jest --runInBand --runTestsByPath app/api/admin/affiliate-qa/route.test.ts __tests__/integration/affiliate-qa-simulation.test.ts lib/context/AuthContext.test.tsx lib/admin-dashboard/qa-affiliate-report.test.ts`. The native browser run is the evidence for actual redirects and hosted prices.
