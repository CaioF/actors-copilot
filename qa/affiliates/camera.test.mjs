import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium} from 'playwright';
import {affiliateRow,header,installMask,stripeSummary} from './camera.mjs';

test('the actual camera reveals the selected affiliate and order summary only',async()=>{
  const browser=await chromium.launch();
  const origin='https://qa.example.test';
  try {
    const page=await browser.newPage();
    await installMask(page,origin);
    const address=origin+'/login?ref=lucas';
    await page.route(origin+'/**',route=>route.fulfill({contentType:'text/html',body:`
      <header><h1>Affiliate program</h1><a href="/admin-dashboard">Back to members</a></header>
      <div data-slot="card"><table><thead><tr><th>Affiliate</th><th>Collected</th></tr></thead>
      <tbody><tr><td><em>Coupon code: LUCAS</em> <a href="${address}">${address}</a></td><td>Private amount</td></tr>
      <tr><td>Unrelated member</td><td>Private amount</td></tr></tbody></table></div>`}));
    await page.goto(origin+'/admin-dashboard/affiliates');
    assert.equal(await page.getByText('Coupon code: LUCAS').isVisible(),false);
    await header(page);
    const affiliate=await affiliateRow(page,origin);
    assert.equal(await affiliate.link.isVisible(),true);
    assert.equal(await page.getByText('Unrelated member').isVisible(),false);
    assert.equal(await page.getByText('Private amount').first().isVisible(),false);
    await page.route('https://checkout.stripe.com/**',route=>route.fulfill({contentType:'text/html',body:`
      <aside class="OrderSummaryColumn"><p>LUCAS</p><p>20% off 1 billing cycle</p>
      <p>Total after trial $15.20</p><p>Total due today $0.00</p></aside>
      <label>Payment details<input autocomplete="cc-number"></label>`}));
    await page.goto('https://checkout.stripe.com/fixture');
    await stripeSummary(page);
    assert.equal(await page.getByText('LUCAS',{exact:true}).isVisible(),true);
    assert.equal(await page.getByLabel('Payment details').isVisible(),false);
  }finally{await browser.close();}
});
