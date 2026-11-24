import assert from 'node:assert/strict';
import { expect } from 'playwright/test';

export async function header(page) {
  await expect(page.getByText('Internal operator', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^(Member dashboard|Affiliate program)$/ })).toBeVisible();
  const nav = page.getByRole('link', { name: /^(Affiliates|Back to members)$/ });
  await expect(nav).toBeVisible();
  return nav;
}

export async function openAffiliates(page, link, signInOperator) {
  const origin = new URL(page.url()).origin;
  const panel = page.getByRole('heading', { name: 'Affiliate program', exact: true });
  const login = page.getByRole('heading', { name: 'Admin access', exact: true });
  await link.click();
  await expect(panel.or(login)).toBeVisible({ timeout: 90000 });
  if (await login.isVisible()) {
    await signInOperator();
    const members = page.getByRole('heading', { name: 'Member dashboard', exact: true });
    await expect(panel.or(members)).toBeVisible({ timeout: 90000 });
    if (await members.isVisible()) await page.getByRole('link', { name: 'Affiliates', exact: true }).click();
  }
  await expect(panel).toBeVisible({ timeout: 90000 });
  await page.waitForURL(origin + '/admin-dashboard/affiliates', { waitUntil: 'domcontentloaded' });
  await header(page);
}

export async function affiliateRow(page, appOrigin, withDemo = false) {
  const referral = page.getByText(/\/login\?ref=lucas$/);
  const row = page.getByRole('row').filter({ has: referral });
  await expect(row).toHaveCount(1);
  const coupon = row.getByText(/^Coupon code:\s*[a-z0-9-]+$/i);
  await expect(coupon).toBeVisible();
  const promotionCode = (await coupon.innerText()).trim().split(/\s+/).at(-1);
  assert(/^[a-z0-9-]+$/i.test(promotionCode));

  const table = page.getByRole('table').filter({ has: row });
  await expect(table.getByRole('columnheader')).toContainText([
    'Affiliate', 'Referred', 'Collected', 'Commission', 'Paid', 'Pending', 'Actions',
  ]);
  await expect(page.getByRole('button', { name: 'Add affiliate', exact: true })).toBeVisible();
  await expect(page.getByText('Transfers', { exact: true })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Pay', exact: true })).toBeVisible();

  const link = row.getByRole('cell').first().getByText(/^https?:\/\/[^\s]+\/login\?[^\s]+$/);
  await expect(link).toBeVisible();
  const address = (await link.innerText()).trim();
  const url = new URL(address);
  assert.equal(url.origin, appOrigin);
  assert.equal(url.pathname, '/login');
  assert.equal(url.searchParams.get('ref'), 'lucas');
  if (withDemo) {
    const demo = row.getByText(/^[1-9]\d* simulated QA referral\(s\), excluded from real totals$/);
    await expect(demo).toBeVisible();
    await demo.hover();
  } else {
    await link.hover();
  }
  return { link, address, promotionCode };
}

export async function memberRow(page, email, tierLabel, simulated = true) {
  assert(/^[a-z0-9._+-]+@example\.test$/i.test(email));
  const account = page.getByText(email, { exact: true });
  const row = page.getByRole('row').filter({ has: account });
  await expect(row).toHaveCount(1);
  const table = page.getByRole('table').filter({ has: row });
  await expect(table.getByRole('columnheader')).toContainText(['Name', 'Email', 'Referred by', 'Status']);
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible();
  await expect(row.getByText('lucas', { exact: true })).toBeVisible();
  if (simulated) {
    await expect(row.getByText('Simulated QA', { exact: true })).toBeVisible();
    await expect(row.getByText('Trial', { exact: true })).toBeVisible();
    await expect(row.getByText(tierLabel, { exact: true })).toBeVisible();
  } else {
    await expect(row.getByText('Checkout pending', { exact: true })).toBeVisible();
    await expect(row.getByText(tierLabel + ' selected', { exact: true })).toBeVisible();
    await expect(row.getByText('Simulated QA', { exact: true })).toHaveCount(0);
  }
  await account.hover();
}

export async function stripeSummary(page, tierLabel, promotionCode) {
  assert.equal(new URL(page.url()).origin, 'https://checkout.stripe.com');
  const region = page.locator('.OrderSummaryColumn');
  await expect(region).toBeVisible({ timeout: 60000 });
  await expect(region).toContainText(tierLabel + ' Class');
  await expect(region.getByText(new RegExp('^' + promotionCode + '$', 'i'))).toBeVisible({ timeout: 45000 });
  await expect(region.getByText(/20% off 1 billing cycle/i)).toBeVisible();
  const discountedPrice = tierLabel === 'Business' ? /Total after trial\s*\$23\.20/i : /Total after trial\s*\$15\.20/i;
  await expect(region).toContainText(discountedPrice);
  await expect(region).toContainText(/Total due today\s*\$0\.00/i);
  // In hosted Checkout the order summary and payment form can live in different frames.
  await expect.poll(async () => {
    for (const frame of page.frames()) {
      if (frame !== page.mainFrame() && !frame.url().startsWith('https://js.stripe.com/')) continue;
      const submit = frame.getByRole('button', { name: /^(Start (?:free )?trial|Subscribe)\b/i }).first();
      if (!(await submit.isVisible())) continue;
      if (frame === page.mainFrame()) return true;
      const iframe = await frame.frameElement();
      const visible = await iframe.isVisible();
      await iframe.dispose();
      if (visible) return true;
    }
    return false;
  }, { timeout: 45000, message: 'Hosted Checkout payment form visible alongside the discount' }).toBe(true);
}
