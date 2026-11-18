import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, expect } from 'playwright/test';
import { navigateAddress } from './browser-address.mjs';
import { affiliateRow, header, memberRow, openAffiliates, stripeSummary } from './camera.mjs';

test('recording preserves complete operator tables, controls and the hosted checkout', async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const origin = 'https://qa.example.test';
  const email = 'qa.lucas@example.test';
  const address = origin + '/login?ref=lucas';

  await page.route(origin + '/admin-dashboard', route => route.fulfill({
    contentType: 'text/html',
    body: `<header><p>Internal operator</p><h1>Member dashboard</h1>
      <a href="/admin-dashboard/affiliates">Affiliates</a><button>Log out</button></header>
      <h2>Members</h2><table><thead><tr><th>Name</th><th>Email</th><th>Referred by</th><th>Status</th></tr></thead>
      <tbody><tr><td>Test Actor</td><td>${email}</td><td>lucas</td><td><b>Trial</b> <b>Simulated QA</b></td></tr>
      <tr><td>Second actor</td><td>second@example.test</td><td>partner</td><td>Paid</td></tr></tbody></table>`,
  }));
  await page.route(origin + '/admin-dashboard/affiliates', route => route.fulfill({
    contentType: 'text/html',
    body: `<header><p>Internal operator</p><h1>Affiliate program</h1><a href="/admin-dashboard">Back to members</a></header>
      <section><h2>Affiliates</h2><button>Add affiliate</button><table><thead><tr>
      <th>Affiliate</th><th>Referred</th><th>Collected</th><th>Commission</th><th>Paid</th><th>Pending</th><th>Actions</th>
      </tr></thead><tbody><tr><td>Lucas <span>Coupon code: LUCAS</span> <a href="${address}">${address}</a></td>
      <td>2 referred · 0 converted <div>1 simulated QA referral(s), excluded from real totals</div></td>
      <td>12.00 USD</td><td>3.60 USD</td><td>1.25 USD</td><td>2.35 USD</td><td><button>Pay</button></td></tr>
      <tr><td>Second affiliate</td><td>5 referred</td><td colspan="5">24.00 USD</td></tr></tbody></table></section>
      <section><h2>Transfers</h2><p>Sample transfer</p></section>`,
  }));
  await page.goto(origin + '/admin-dashboard');
  const affiliates = await header(page);
  await memberRow(page, email, true);
  await expect(page.getByText('Second actor')).toBeVisible();
  await expect(page.getByText('Test Actor')).toBeVisible();
  await openAffiliates(page, affiliates, () => assert.fail('Unexpected sign-in prompt'));
  const referral = await affiliateRow(page, origin, true);
  assert.equal(referral.address, address);
  await expect(page.getByText('12.00 USD')).toBeVisible();
  await expect(page.getByText('2.35 USD')).toBeVisible();
  await expect(page.getByText('Second affiliate')).toBeVisible();
  await expect(page.getByText('Sample transfer')).toBeVisible();

  await page.route('https://js.stripe.com/payment-frame', route => route.fulfill({
    contentType: 'text/html',
    body: `<p>${email}</p><label>Card number<input autocomplete="cc-number"></label><button>Start trial</button>`,
  }));
  await page.route('https://checkout.stripe.com/fixture', route => route.fulfill({
    contentType: 'text/html',
    body: `<aside class="OrderSummaryColumn"><p>LUCAS</p><p>20% off 1 billing cycle</p>
      <p>Total after trial $15.20</p><p>Total due today $0.00</p></aside>
      <iframe title="Payment form" src="https://js.stripe.com/payment-frame"></iframe>`,
  }));
  await page.goto('https://checkout.stripe.com/fixture');
  await stripeSummary(page);
  const payment = page.frameLocator('iframe[title="Payment form"]');
  await expect(payment.getByText(email)).toBeVisible();
  await expect(payment.getByLabel('Card number')).toBeVisible();
  await expect(payment.getByRole('button', { name: 'Start trial' })).toBeVisible();
});

test('the operator resumes through the visible sign-in form if the panel asks for credentials', async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const origin = 'https://qa.example.test';
  let signIns = 0;
  await page.route(origin + '/admin-dashboard', route => route.fulfill({
    contentType: 'text/html',
    body: '<header><p>Internal operator</p><h1>Member dashboard</h1><a href="/admin-dashboard/affiliates">Affiliates</a></header>',
  }));
  await page.route(origin + '/admin-dashboard/affiliates', route => route.fulfill({
    contentType: 'text/html',
    body: signIns
      ? '<header><p>Internal operator</p><h1>Affiliate program</h1><a href="/admin-dashboard">Back to members</a></header>'
      : `<h1>Admin access</h1><button onclick="location.assign('/admin-dashboard')">Log in</button>`,
  }));
  await page.goto(origin + '/admin-dashboard');
  await openAffiliates(page, await header(page), async () => {
    signIns++;
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
  });
  assert.equal(signIns, 1);
  await expect(page.getByRole('heading', { name: 'Affiliate program' })).toBeVisible();
});

test('Windows enters the exact operator URLs in Chrome’s native address bar', {
  skip: process.platform !== 'win32',
}, async (t) => {
  const browser = await chromium.launch({ headless: false, args: ['--lang=en-US'] });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const origin = 'https://operator.example.test';
  await page.route(origin + '/**', route => route.fulfill({
    contentType: 'text/html',
    body: '<h1>Operator destination</h1>',
  }));
  await page.goto(origin + '/login');
  for (const path of ['/api/admin/affiliate-qa', '/admin-dashboard']) {
    await navigateAddress(page, origin + path);
    assert.equal(page.url(), origin + path);
  }
});
