import assert from 'node:assert/strict';
import { expect } from 'playwright/test';

// The camera changes visibility only. Purchase, routing and account state are
// controlled exclusively by the application and the hosted checkout.
export async function installMask(page, appOrigin) {
  await page.addInitScript((origin) => {
    if (window.top !== window) return;
    const publicForm =
      location.origin === origin &&
      ['/login', '/start-trial', '/dashboard', '/api/admin/affiliate-qa'].includes(location.pathname);
    const sheet = new CSSStyleSheet();
    let css = 'nextjs-portal {display:none !important}';
    if (!publicForm)
      css += `
      html { background:#f4f1e8 !important } html body,html body *,html body *::before,html body *::after {visibility:hidden !important}
      html body [data-camera-shell],html body [data-camera-show],html body [data-camera-show] *,
      html body form:has(#admin-username),html body form:has(#admin-username) * {visibility:visible !important}
      html body [data-camera-show] iframe {visibility:hidden !important}
      html:has([data-camera-row]) [data-slot=card]:not([data-camera-card]),html:has([data-camera-row]) tbody tr:not([data-camera-row]),
      html:has([data-camera-row]) tr > :is(td,th):not([data-camera-column]) {display:none !important}
      [data-camera-row] [data-camera-show],[data-camera-row] [data-camera-show] * {font-size:18px !important;line-height:1.5 !important}
      html:has(.OrderSummaryColumn) {background:#202322 !important}
    `;
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }, appOrigin);
}
export async function reveal(locator) {
  await locator.waitFor({ state: 'attached' });
  await locator.evaluate((el) => el.setAttribute('data-camera-show', ''));
  await expect(locator).toBeVisible();
}
export async function header(page) {
  const title = page.locator('header h1').first();
  await title.waitFor({ state: 'attached' });
  assert.match((await title.textContent()).trim(), /^(Member dashboard|Affiliate program)$/);
  await reveal(title);
  const nav = page.locator('header a').filter({ hasText: /^(Affiliates|Back to members)$/ });
  await reveal(nav);
  return nav;
}
async function rowFrame(row, headings) {
  await row.evaluate((tr, expected) => {
    const table = tr.closest('table'),
      card = tr.closest('[data-slot=card]');
    if (!card || !table) throw Error('Admin layout changed');
    card.dataset.cameraCard = '';
    tr.dataset.cameraRow = '';
    for (const el of [card, table, tr]) el.dataset.cameraShell = '';
    for (const name of expected) {
      const col = [...table.tHead.rows[0].cells].findIndex((th) => th.textContent.trim() === name);
      if (col < 0) throw Error('Admin columns changed');
      table.tHead.rows[0].cells[col].dataset.cameraShow = '';
      table.tHead.rows[0].cells[col].dataset.cameraColumn = '';
      tr.cells[col].dataset.cameraColumn = '';
    }
  }, headings);
}
export async function affiliateRow(page, appOrigin, withDemo = false) {
  const coupon = page.getByText('Coupon code: LUCAS', { exact: true });
  const row = page.locator('tbody tr').filter({ has: coupon });
  await row.waitFor({ state: 'attached' });
  assert.equal(await row.count(), 1);
  const cell = row.locator('td').first();
  const link = cell.getByText(/^https?:\/\/[^\s]+\/login\?[^\s]+$/);
  const address = (await link.textContent()).trim();
  const url = new URL(address);
  assert.equal(url.origin, appOrigin);
  assert.equal(url.pathname, '/login');
  assert.equal(url.searchParams.get('ref'), 'lucas');
  await rowFrame(row, withDemo ? ['Affiliate', 'Referred'] : ['Affiliate']);
  await reveal(coupon);
  await reveal(link);
  assert.equal((await link.innerText()).trim(), address);
  if (withDemo)
    await reveal(row.getByText(/^[1-9]\d* simulated QA referral\(s\), excluded from real totals$/));
  await link.scrollIntoViewIfNeeded();
  return { link, address };
}
export async function memberRow(page, email, demo) {
  assert(/^[a-z0-9._+-]+@example\.test$/i.test(email));
  const account = page.getByText(email, { exact: true });
  const row = page.locator('tbody tr').filter({ has: account });
  await row.waitFor({ state: 'attached' });
  assert.equal(await row.count(), 1);
  await rowFrame(row, ['Email', 'Referred by', 'Status']);
  await reveal(account);
  await reveal(row.locator('td').nth(2).getByText('lucas', { exact: true }));
  if (demo) {
    await reveal(row.getByText('Simulated QA', { exact: true }));
    await reveal(row.getByText('Trial', { exact: true }));
  }
  await account.scrollIntoViewIfNeeded();
}
export async function stripeSummary(page) {
  assert.equal(new URL(page.url()).origin, 'https://checkout.stripe.com');
  const region = page.locator('.OrderSummaryColumn');
  await region.waitFor({ state: 'attached', timeout: 60000 });
  assert(
    await region.evaluate(
      (el) =>
        !el.querySelector('iframe,input:not([name="promotionCode"]),textarea,select') &&
        !/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(el.textContent),
    ),
  );
  await reveal(region);
  await expect(region.getByText('LUCAS', { exact: true })).toBeVisible({ timeout: 45000 });
  await expect(region.getByText(/20% off 1 billing cycle/i)).toBeVisible();
  await expect(region).toContainText(/Total after trial\s*\$15\.20/i);
  await expect(region).toContainText(/Total due today\s*\$0\.00/i);
}
