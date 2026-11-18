# Recorded Actors Copilot journeys

## A continuous affiliate checkout

Use the signup recorder delivered with [PR #115](https://github.com/CaioF/actors-copilot/pull/115). Its runbook is `qa/affiliates/README.md` on that checkout. It starts at the operator's actual Lucas row, registers the new actor, follows the app to the trial page, checks the coupon in hosted Checkout, follows the demo endpoint's real HTTP redirect and verifies the same actor in admin. The earlier edit that switched an example address between login tabs has been retired. Its clips cannot be used by the showcase.

Once that runner is present in the same checkout, `node qa/recording/affiliate-coupon.mjs --confirm-demo` forwards to it using the same environment. Its output and cleanup rules are those of the affiliate runbook.

## Casting brief, sides and Acting Coach

```sh
pnpm install --frozen-lockfile
pnpm --dir qa/recording install --frozen-lockfile
pnpm --dir qa/recording exec playwright install chromium
node --env-file=qa/recording/.env.member.local qa/recording/record.mjs brief --submit
node --env-file=qa/recording/.env.member.local qa/recording/record.mjs sides --submit
node --env-file=qa/recording/.env.coach.local qa/recording/record.mjs coach --submit
```

Use an ignored environment file with `AC_TEST_EMAIL`, `AC_TEST_PASSWORD` and optionally `AC_BASE_URL` (defaults to production). Business is required to send a Coach question. Each run starts in a fresh browser, signs in using the ordinary email form and waits for the app to deliver the dashboard. Operator credentials and actor sign-in stay off camera. The button that opens a workflow is clicked in the actual app. Synthetic actors and material are used for provider calls and saved auditions. Omitting `--submit` stops before a billable generation or Coach request.

Each successful run writes a report and the original English-language clips into ignored `qa/recording/evidence/<journey>-<UTC>/`. A failed run documents the failed stage. The standalone local `coach-fixture` exercises the component with a scripted response for CI; its report identifies it as a fixture.

## Assemble the English showcase

Set `AC_FFMPEG_PATH` if FFmpeg is outside PATH. Pass the completed affiliate evidence directory and the three independent completed actor run directory names.

```sh
node qa/recording/showcase.mjs --affiliate=/absolute/path/to/signup-UTC brief-UTC sides-UTC coach-UTC
```

The affiliate take is included from beginning to end. Chapter cards name the actual environment and the simulated Stripe confirmation. Any shortened wait for an AI analysis is labeled in English. The generated MP4, source clips, reports and chapter files stay under local Git-ignored evidence directories. The assembler rejects incomplete affiliate runs and older actor runs that predate form-based authentication.
