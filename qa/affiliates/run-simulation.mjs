import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { setTimeout as hold } from 'node:timers/promises';
import { chromium } from 'playwright';
import { expect as playwrightExpect } from 'playwright/test';
const expect = playwrightExpect.configure({ timeout: 90000 });
import { navigateAddress } from './browser-address.mjs';
import { affiliateRow, header, memberRow, openAffiliates, stripeSummary } from './camera.mjs';

const mode = process.argv[2];
assert(
  ['--observe', '--recover', '--confirm-demo'].includes(mode),
  'Choose --observe, --recover or --confirm-demo. Each creates a new QA account through the signup form.',
);
const recover = mode === '--recover';
const confirm = mode === '--confirm-demo';
const tier = process.env.AC_TRIAL_TIER || 'economy';
assert(['economy', 'business'].includes(tier), 'AC_TRIAL_TIER must be economy or business.');
const tierLabel = tier === 'business' ? 'Business' : 'Economy';
const origin = new URL(process.env.AC_BASE_URL || 'https://app.theactorscopilot.com').origin;
assert(
  origin === 'https://app.theactorscopilot.com' ||
    ['localhost', '127.0.0.1'].includes(new URL(origin).hostname),
);
const email = (process.env.AC_SIGNUP_EMAIL || process.env.QA_SIMULATION_SIGNUP_EMAIL || '')
  .trim()
  .toLowerCase();
const password = process.env.AC_SIGNUP_PASSWORD;
assert(
  /^[a-z0-9._+-]+@example\.test$/.test(email) &&
    password?.length >= 12 &&
    process.env.AC_ADMIN_USERNAME &&
    process.env.AC_ADMIN_PASSWORD,
  'Configure the fresh synthetic signup and operator credentials.',
);
if (confirm)
  assert(
    /^[a-f0-9]{64}$/i.test(process.env.QA_SIMULATION_SECRET || ''),
    'Configure the QA endpoint secret.',
  );
const ffmpeg = process.env.AC_FFMPEG_PATH || 'ffmpeg';
execFileSync(ffmpeg, ['-version'], { stdio: 'ignore', windowsHide: true });
const dir = fileURLToPath(
  new URL('./evidence/signup-' + new Date().toISOString().replaceAll(':', '-') + '/', import.meta.url),
);
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  headless: false,
  args: ['--lang=en-US'],
  ...(process.env.AC_CHROME_PATH ? { executablePath: process.env.AC_CHROME_PATH } : {}),
});
const context = await browser.newContext({
  locale: 'en-US',
  viewport: { width: 1440, height: 900 },
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await context.newPage();
page.setDefaultTimeout(120000);
const report = {
  origin,
  language: 'en-US',
  browser: browser.version(),
  journey: recover ? 'unfinished-checkout' : 'affiliate-signup',
  recoveryVersion: 1,
  tier,
  presentation: 'full browser viewport',
  status: 'incomplete',
  confirmation: 'not attempted',
  timeline: [],
  cleanup: 'not needed',
};
let runId;
let stage = 'operator login',
  record = false,
  started,
  cleanup = false,
  uid;
report.requests = [];
page.on('response', (r) => {
  const url = new URL(r.url());
  if (
    url.origin === origin &&
    ['/api/auth/callback', '/api/billing/recovery', '/api/billing/affiliate', '/api/billing/success'].includes(url.pathname)
  )
    report.requests.push({ method: r.request().method(), path: url.pathname, status: r.status() });
});
function mark(name) {
  report.timeline.push({ name, ms: Math.round(performance.now() - started) });
}
async function click(locator) {
  await locator.hover();
  await hold(320);
  await locator.click();
}
async function assertSavedChoice(actorPage) {
  await expect(actorPage).toHaveURL(origin + '/start-trial');
  await expect(actorPage.getByRole('heading', { name: 'Finish setting up your free trial' })).toBeVisible();
  for (const name of [new RegExp('^' + tierLabel + ' Class', 'i'), 'Monthly', 'USD']) {
    await expect(actorPage.getByRole('button', { name, pressed: true, exact: typeof name === 'string' })).toBeVisible();
  }
  await expect(actorPage.getByText(/LUCAS applied.*20% off/i)).toBeVisible();
}
async function resumeSameCheckout(buyer, checkoutId) {
  const [response] = await Promise.all([
    buyer.waitForResponse(r => new URL(r.url()).pathname === '/api/billing/recovery' &&
      r.request().method() === 'POST' && r.request().postDataJSON()?.tier === tier),
    click(buyer.getByRole('button', { name: 'Resume checkout' })),
  ]);
  assert(response.ok(), 'The app could not resume Checkout');
  await buyer.waitForURL(url => url.origin === 'https://checkout.stripe.com',
    { waitUntil: 'domcontentloaded', timeout: 90000 });
  assert(new URL(buyer.url()).pathname.endsWith('/' + checkoutId), 'Resume must reopen the original Stripe Checkout');
}
async function signInOperator() {
  if (record) mark('Operator signs in again at the admin prompt');
  await page.getByLabel('Username', { exact: true }).fill(process.env.AC_ADMIN_USERNAME);
  await page.getByLabel('Password', { exact: true }).fill(process.env.AC_ADMIN_PASSWORD);
  await click(page.getByRole('button', { name: 'Log in', exact: true }));
}
async function watch(name, task) {
  stage = name;
  return task();
}
function demoCall(method, body) {
  return context.request.fetch(origin + '/api/admin/affiliate-qa', {
    method,
    headers: { authorization: 'Bearer ' + process.env.QA_SIMULATION_SECRET },
    data: body,
    maxRedirects: 0,
    timeout: 60000,
  });
}
async function encodeRecording() {
  execFileSync(
    ffmpeg,
    [
      '-nostdin',
      '-v',
      'error',
      '-xerror',
      '-i',
      'take.webm',
      '-map',
      '0:v:0',
      '-an',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-threads',
      '4',
      '-preset',
      'veryfast',
      '-crf',
      '19',
      '-movflags',
      '+faststart',
      'affiliate.partial.mp4',
    ],
    { cwd: dir, windowsHide: true },
  );
  execFileSync(
    ffmpeg,
    [
      '-nostdin',
      '-v',
      'error',
      '-xerror',
      '-i',
      'affiliate.partial.mp4',
      '-map',
      '0:v:0',
      '-f',
      'null',
      '-',
    ],
    { cwd: dir, windowsHide: true },
  );
  await rename(join(dir, 'affiliate.partial.mp4'), join(dir, 'affiliate.mp4'));
}

try {
  // Open the operator's entry point once. All application routes after registration are observed.
  await page.goto(origin + '/admin-dashboard', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await signInOperator();
  await page.locator('header h1').filter({ hasText: 'Member dashboard' }).waitFor({ state: 'attached' });
  const affiliates = await header(page);
  await page.screencast.showActions({
    cursor: 'pointer',
    duration: 550,
    style: { title: 'display:none', highlight: 'outline:2px solid #d97237' },
  });
  await page.screencast.start({
    path: join(dir, 'take.partial.webm'),
    fps: 30,
    size: { width: 1440, height: 900 },
  });
  record = true;
  started = performance.now();
  mark('Member dashboard after operator login');
  await hold(2000);
  await openAffiliates(page, affiliates, signInOperator);
  const { address, link } = await watch('locating the referral in the affiliate row', () =>
    affiliateRow(page, origin),
  );
  mark('Lucas coupon and referral address in the operator panel');
  await hold(3200);
  stage = 'opening the referral address displayed by admin';
  if (await link.evaluate((el) => Boolean(el.closest('a[href]')))) {
    await click(link);
    await page.waitForURL(address);
  } else {
    await link.click({ clickCount: 3 });
    await page.keyboard.press('Control+c');
    assert.equal((await page.evaluate(() => navigator.clipboard.readText())).trim(), address);
    await navigateAddress(page, address, true);
  }
  const submit = page.locator('button[type=submit]').filter({ hasText: /^Create Account$/ });
  await expect(submit).toBeVisible();
  await expect(page.getByRole('heading', { name: /Create Your Account/i })).toBeVisible();
  mark('Create Account selected on arrival');
  await hold(1600);
  stage = 'registering the new QA member through the form';
  await click(page.locator('input[type=email]'));
  await page.locator('input[type=email]').pressSequentially(email, { delay: 38 });
  await page.locator('input[type=password]').fill(password);
  await expect(page.locator('input[type=password]')).toHaveAttribute('type', 'password');
  await hold(700);
  const [signupResponse] = await Promise.all([
    page.waitForResponse(
      (r) =>
        new URL(r.url()).hostname === 'identitytoolkit.googleapis.com' &&
        new URL(r.url()).pathname.endsWith('accounts:signUp') &&
        r.request().method() === 'POST',
    ),
    click(submit),
  ]);
  assert(signupResponse.ok(), 'Signup was rejected');
  uid = (await signupResponse.json()).localId;
  assert.equal(typeof uid, 'string');
  mark('Firebase accepted the new account from the Create Account form');
  stage = 'waiting for the automatic trial-ready redirect';
  await page.waitForURL(origin + '/start-trial', { timeout: 90000 });
  await expect(page.getByRole('heading', { name: 'Your free trial is ready to start' })).toBeVisible();
  mark('New account automatically redirected to Your free trial is ready to start');
  await hold(2400);
  stage = 'choosing ' + tierLabel + ' monthly in the trial screen';
  await click(page.getByRole('button', { name: /Monthly/i }).first());
  await click(page.getByRole('button', { name: new RegExp('^' + tierLabel + ' Class', 'i') }));
  await click(page.getByRole('button', { name: 'USD', exact: true }));
  await expect(page.getByText(/LUCAS applied.*20% off/i)).toBeVisible();
  mark(tierLabel + ' selected and affiliate discount displayed on the trial page');
  await hold(1600);
  stage = 'opening the hosted checkout using Start my free trial';
  const [checkoutResponse] = await Promise.all([
    page.waitForResponse(
      (r) =>
        new URL(r.url()).origin === origin &&
        new URL(r.url()).pathname === '/api/billing/recovery' &&
        r.request().method() === 'POST',
    ),
    click(page.getByRole('button', { name: 'Start my free trial', exact: true })),
  ]);
  assert(checkoutResponse.ok(), 'The app could not start checkout');
  await page.waitForURL((url) => url.origin === 'https://checkout.stripe.com', {
    waitUntil: 'domcontentloaded',
  });
  // Chrome can discard the fetch body once it replaces the document. Read the
  // session from the checkout that the browser actually reached.
  const checkoutId = new URL(page.url()).pathname.match(/\bcs_(?:live|test)_[A-Za-z0-9]+\b/)?.[0];
  assert(checkoutId);
  report.checkoutFingerprint = createHash('sha256').update(checkoutId).digest('hex');
  stage = 'reading the applied coupon in Stripe Checkout';
  await stripeSummary(page, tierLabel);
  mark('Hosted Stripe Checkout shows ' + tierLabel + ', LUCAS, 20% for one cycle and $0 today');
  await hold(3500);
  if (confirm) {
    stage = 'confirming this exact open checkout with the demo endpoint';
    // Move from the hosted provider to its single, explicitly labeled substitute.
    await navigateAddress(page, origin + '/api/admin/affiliate-qa');
    await expect(page.getByRole('heading', { name: 'QA payment confirmation' })).toBeVisible();
    runId = await page.locator('input[name=runId]').inputValue();
    report.runId = runId;
    await page.getByLabel('Hosted checkout ID').fill(checkoutId);
    await page.getByLabel('Affiliate code').fill('lucas');
    await page.getByLabel('Operator key').fill(process.env.QA_SIMULATION_SECRET);
    mark('Operator uses QA payment confirmation for the observed hosted checkout');
    await hold(1600);
    cleanup = true;
    const successUrl = new URL('/api/billing/success', origin);
    successUrl.searchParams.set('session_id', checkoutId);
    let successResponse;
    page.on('response', (response) => {
      if (response.url() === successUrl.href && response.request().isNavigationRequest())
        successResponse = response;
    });
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => new URL(r.url()).pathname === '/api/admin/affiliate-qa' && r.request().method() === 'POST',
      ),
      click(page.getByRole('button', { name: 'Confirm demo trial' })),
    ]);
    report.demoHttpStatus = response.status();
    if (response.status() !== 303) {
      if ([400, 403, 404, 409].includes(response.status())) cleanup = false;
      const data = await response.json().catch(() => null);
      if (typeof data?.error === 'string' && /^[A-Za-z .]{1,90}$/.test(data.error))
        report.demoError = data.error;
      throw Error('Demo confirmation was not accepted');
    }
    assert.equal(new URL(await response.headerValue('location'), origin).href, successUrl.href);
    await page.waitForURL(origin + '/dashboard');
    assert(successResponse && successResponse.request().method() === 'GET', 'Checkout success return was skipped');
    assert([302, 303, 307].includes(successResponse.status()));
    assert.equal(new URL(await successResponse.headerValue('location'), origin).href, origin + '/dashboard');
    assert((await successResponse.headerValues('set-cookie')).some((cookie) => cookie.startsWith('platform_session=')),
      'Checkout success did not issue the buyer session');
    const sessionResponse = await context.request.get(origin + '/api/auth/callback');
    assert(sessionResponse.ok());
    const session = await sessionResponse.json();
    assert.equal(session.authenticated, true);
    assert.equal(session.subscriptionStatus, 'trialing');
    assert.equal(session.tier, tier);
    report.confirmation = 'Browser followed the QA 303 through checkout success to the dashboard';
    report.session = { tier: session.tier, subscriptionStatus: session.subscriptionStatus };
    mark('Browser followed checkout success and the signed-in session shows a ' + tierLabel + ' trial');
    const skip = page.getByRole('button', { name: 'Close intro video' });
    await page.addLocatorHandler(skip, () => skip.click(), { times: 1 });
    const dashboard = page.getByRole('heading', { name: 'My Acting Copilot', exact: true });
    await expect(dashboard).toBeVisible();
    mark('Dashboard displayed after the demo return');
    await hold(2200);
  } else {
    report.confirmation = 'Checkout left open; no payment or demo confirmation';
    if (recover) {
      stage = 'reopening the app after leaving hosted Checkout';
      await navigateAddress(page, origin + '/dashboard');
      await assertSavedChoice(page);
      mark('Returning from an unfinished checkout restores the selected plan and Lucas discount');
      await hold(2600);
      stage = 'resuming the original Stripe Checkout';
      await resumeSameCheckout(page, checkoutId);
      await stripeSummary(page, tierLabel);
      mark('Resume checkout reopens the same hosted Stripe session');
    }
  }
  stage = 'returning to the operator dashboard';
  await navigateAddress(page, origin + '/admin-dashboard');
  const nav = await header(page);
  await memberRow(page, email, tierLabel, confirm);
  mark(
    confirm ? 'Same member shows Lucas, Trial, ' + tierLabel + ' and Simulated QA' : 'Same member shows Lucas, Checkout pending, and ' + tierLabel + ' selected',
  );
  await hold(4000);
  await openAffiliates(page, nav, signInOperator);
  await affiliateRow(page, origin, confirm);
  mark(
    confirm
      ? 'Lucas shows the separately labeled simulated referral'
      : 'Lucas coupon and referral link verified again',
  );
  await hold(4000);
  await expect(page.getByRole('heading', { name: 'Affiliate program', exact: true })).toBeVisible();
  await page.screencast.stop();
  record = false;
  await rename(join(dir, 'take.partial.webm'), join(dir, 'take.webm'));
  if (recover) {
    stage = 'signing back in from a clean browser context after closing the buyer tab';
    await page.close();
    const otherDevice = await browser.newContext({ locale: 'en-US' });
    try {
      const buyer = await otherDevice.newPage();
      await buyer.goto(origin + '/login');
      await buyer.locator('input[type=email]').fill(email);
      await buyer.locator('input[type=password]').fill(password);
      await buyer.locator('button[type=submit]').filter({ hasText: 'Sign In' }).click();
      await assertSavedChoice(buyer);
      await resumeSameCheckout(buyer, checkoutId);
      report.freshLoginResumedOriginalCheckout = true;
    } finally {
      await otherDevice.close();
    }
  }
  report.status = confirm ? 'demo-complete' : recover ? 'recovery-verified' : 'observed-through-checkout';
} catch (error) {
  report.failedStage = stage;
  if (!page.isClosed()) await page.screenshot({ path: join(dir, 'failure.png') }).catch(() => {});
  const line = error.stack?.match(/(?:run-simulation|camera|browser-address)\.mjs:\d+:\d+/)?.[0];
  console.error('Stopped at ' + stage + ' (' + [error.name, line].filter(Boolean).join(', ') + ')');
  process.exitCode = 1;
} finally {
  if (record) await page.screencast.stop().catch(() => {});
  if (cleanup) {
    try {
      const resp = await demoCall('DELETE', { uid, runId });
      if (!resp.ok() || (await resp.json()).cleaned !== true) throw Error();
      report.cleanup = 'verified';
    } catch {
      report.qaUid = uid;
      report.cleanup = 'requires operator review';
      report.status = 'incomplete';
      report.failedStage ??= 'removing the QA receipt';
      process.exitCode = 1;
    }
  }
  if (report.status === 'demo-complete' && report.cleanup === 'verified') {
    try {
      await page.getByRole('link', { name: 'Back to members', exact: true }).click();
      const members = page.getByRole('heading', { name: 'Member dashboard', exact: true });
      const login = page.getByRole('heading', { name: 'Admin access', exact: true });
      await expect(members.or(login)).toBeVisible();
      if (await login.isVisible()) await signInOperator();
      await expect(members).toBeVisible();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await memberRow(page, email, tierLabel, false);
      report.afterCleanup = { status: 'Checkout pending', tier: 'Free', selectedTier: tier, referredBy: 'lucas' };
    } catch {
      report.status = 'incomplete';
      report.failedStage = 'verifying the original member row after cleanup';
      process.exitCode = 1;
    }
  }
  await browser.close();
  if (report.status !== 'incomplete') {
    try {
      await encodeRecording();
    } catch {
      report.status = 'incomplete';
      report.failedStage = 'encoding the continuous recording';
      process.exitCode = 1;
    }
  }
  await writeFile(join(dir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(report.status, dir);
}
