# Chrome and Puppeteer field guide

The repository pins `puppeteer-core`; it does not download Chrome. Use Node 22.12+ and a compatible local Chrome, `pnpm install --frozen-lockfile`, and an isolated browser profile. The inspector starts a fresh headless Chrome, closes it in `finally`, and uses Puppeteer's Chrome DevTools Protocol transport. It does not attach to the user's everyday browser or expose a remote debugging port. When manually using CDP, bind it to localhost and use a separate `--user-data-dir`: Chrome 136+ ignores remote-debugging switches for the default profile. See [Chrome's guidance](https://developer.chrome.com/blog/remote-debugging-port) and [Puppeteer launch options](https://pptr.dev/api/puppeteer.launchoptions).

## Run the inspector

Set variables in the current shell without committing them. Obtain credentials securely; do not save passwords, session cookies, Firebase ID tokens, or traces containing them in the repository. Use a disposable test identity and identify the environment. PowerShell example (replace placeholders locally):

```powershell
$env:AC_BASE_URL = 'https://app.theactorscopilot.com'
$env:AC_CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:AC_TEST_EMAIL = '<test-account-email>'
$env:AC_TEST_PASSWORD = '<test-account-password>'
node .agents/skills/actors-copilot-verification/scripts/inspect-ui.mjs /dashboard /auditions /reader-copilot
```

The default is ordinary UI sign-in; the inspector waits for navigation out of `/login`. It emits requested/final path, visible headings, buttons, fields and links, but no form values. Output may include account-specific labels; inspect before sharing. Pages wait for the interior sidebar or chat input, not network idle. Data-dependent sections can still load later; use feature-specific observable conditions before asserting them. The inspector is an exploration aid, not an exhaustive regression suite.

A production attempt on 2026-11-17 showed an intermittent login/redirect loop in the integrated browser and once in fresh headless Chrome. Direct Firebase sign-in and `/api/auth/callback` returned a real platform cookie and Economy access. To explore other features when normal UI sign-in is blocked, set `AC_SEED_SESSION=1` and `AC_FIREBASE_API_KEY` for the Firebase project used by the target; the inspector obtains a genuine Firebase token, exchanges it with the target callback, installs the returned platform cookie in the isolated browser, then signs in through the UI. `NEXT_PUBLIC_FIREBASE_API_KEY` is also accepted. **This setup seam does not verify ordinary sign-in.** Never construct entitlements or write billing fields to bypass gating.

With `AC_CHECK_WIZARD=1`, pass `/auditions/new/brief` and/or `/auditions/new/sides` to fill synthetic project/role/text, reach review, verify Generate is enabled and confirm text survives Back. It does not generate or save by default. Optional `AC_GENERATE=1` invokes the real AI endpoint, saves a uniquely named synthetic audition and checks it after reload. This incurs a provider call and leaves a test record in the selected account; use only where that effect is intended and never pass customer material. A response and a saved record do not prove the quality of the generated content. A production test account is not an isolated backend.

To exercise document extraction for sides, set `AC_SIDES_FILE` to the absolute path of `fixtures/synthetic-sides.docx` within this skill, then run `/auditions/new/sides` with `AC_CHECK_WIZARD=1` and, if a real generation and saved fixture are intended, `AC_GENERATE=1`. The file is fictional and tracked. Follow with the linked Reader check using the printed unique fixture title. Unset `AC_SIDES_FILE` for text-input checks.

With `AC_CHECK_READER=1` and `/reader-copilot`, the inspector submits a fictional two-person script to the real parsing endpoint, selects ALEX and waits for the Partner Voices control. It does not record audio or prove playback. Provider calls may incur cost.

With `AC_MOBILE=1` the viewport is 390×844. Add `AC_CHECK_NAV=1` and `/dashboard` to open the mobile menu, navigate to Auditions and verify the menu closes. This checks one navigation path, not general responsive or accessibility compliance.

With `AC_CHECK_DNA=1` and `/chat`, it types a uniquely marked fictional message, waits for the real DNA endpoint, processing to finish and an assistant bubble, then reloads and checks the exchange again. It persists test conversation data and may cause extractions; use an authorized disposable identity. See the DNA map for observed evidence. Do not automatically retry submission after a timeout: the message or response may already have been saved.

With `AC_CHECK_SAVED=1`, `AC_TEST_PROJECT=<unique fixture title>` and `/auditions`, it searches for that named fixture and opens its detail. `AC_CHECK_ENRICH=1` additionally chooses Attach Sides on a brief-only fixture, sends fictional sides to the real analysis service, saves and verifies both analyses on the same detail URL. This mutates the existing fixture and is not repeatable against the same already-enriched record; create a fresh, explicitly disposable brief first. Record the fixture and effect.

With `AC_CHECK_PICKER=1`, `AC_TEST_PROJECT=<unique fixture title>` and `/auditions/new/sides`, it selects that named saved audition, waits for its result and clears the selection. It checks that the new-scene project field is blank; it does not generate, save or delete anything.

With `AC_CHECK_SAVED=1`, `AC_CHECK_LINKED_READER=1` and an identified synthetic audition, the inspector opens its detail, chooses Rehearse Scene and expects the linked Reader to open; it then tests mute, change-character and return-to-detail. It fails with a clear `missingSides` observation if the UI instead reports no script sides text. This invokes the real parser on a working fixture. See the Reader feature map for the observed failure on one enriched fixture.

For individual journeys, use `page.locator('button ::-p-text(Next)').click()` or `page.locator('#project').fill(...)` only after confirming current UI; prefer accessible names and roles when available. `#project` and `#role` are source-backed fallbacks because their visual labels are not associated HTML labels. Wait for a specific observable end state. Capture sanitized screenshots only when needed; never commit browser profiles, auth state or customer data. Use `await page.createCDPSession()` for network/console evidence when useful, without logging request bodies, auth headers or cookies. An API 200 does not prove UI, persistence or webhook delivery.

Record origin, deployment/commit if known, account tier/status, viewport, setup seam, action, outcome and skips. Close browser and clear shell credential variables. Production tests must use the specifically authorized accounts and synthetic fixtures; follow current instructions and AGENTS.md for subscription and destructive actions.
