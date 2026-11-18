import assert from "node:assert/strict";
import { expect } from "playwright/test";

// Install before navigating the recording page. New documents,
// client-side replacements and unexpected destinations start with no page content visible.
export async function installPrivacyScreen(page) {
  await page.addInitScript(() => {
    if (window !== window.top) return;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`
        html { background: #f4f1e8 !important; }
        html[data-camera="stripe"] { background: #202322 !important; }
        html body, html body *, html body *::before, html body *::after { visibility:hidden !important; }
        html body [data-film-shell],
        html body [data-film-region], html body [data-film-region] *,
        html body #qa-recording-note, html body #qa-recording-note * { visibility:visible !important; }
        html body [data-film-region] :is(iframe,video) { visibility:hidden !important; }
        html[data-camera="admin"] [data-slot="card"]:not([data-film-card]),
        html[data-camera="admin"] tbody tr:not([data-film-row]),
        html[data-camera="admin"] tr > :is(th,td):not([data-film-column]) { display:none !important; }
        html[data-camera="admin"] table { min-width:0 !important; }
        html[data-camera="admin"] td[data-film-alias] { font-size:0 !important; }
        html[data-camera="admin"] tr[data-film-row] [data-film-region],
        html[data-camera="admin"] tr[data-film-row] [data-film-region] * { font-size:18px !important; line-height:1.5 !important; }
        html[data-camera="admin"] td[data-film-alias]::after {
          content:attr(data-film-alias); visibility:visible !important; font:600 16px system-ui;
        }
        html body #qa-recording-note {
          position:fixed; bottom:4vh; left:50%; transform:translateX(-50%);
          width:min(900px,88vw); box-sizing:border-box; z-index:2147483647;
          border:1px solid #d7d6cb; border-left:5px solid #c55426; border-radius:9px;
          background:#fffdf7; color:#29352c; box-shadow:0 4px 16px #0002; padding:14px 22px;
          font:500 19px/1.4 system-ui,sans-serif; pointer-events:none;
        }
        #qa-recording-note small { display:block; color:#5e655f; font:600 12px/1.6 system-ui,sans-serif; }
        html[data-camera="stripe"] body #qa-recording-note {
          bottom:auto; top:20%; left:54%; width:32%; transform:none;
        }
        html[data-camera="stripe"] .OrderSummaryColumn[data-film-region] {
          transform-origin:top left; transform:scale(1.18);
        }
        html[data-camera="plan"] body #qa-recording-note {
          bottom:auto; top:5%; left:50%; width:min(820px,82vw);
        }
    `);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  });
}

async function checkMask(page) {
  assert.equal(
    await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).visibility),
    "hidden",
    "Recording mask is missing",
  );
}

export async function caption(page, role, message) {
  await page.evaluate(
    ({ role, message }) => {
      let note = document.getElementById("qa-recording-note");
      if (!note) {
        note = document.createElement("aside");
        note.id = "qa-recording-note";
        document.body.append(note);
      }
      const label = document.createElement("small");
      label.textContent = "QA  ·  " + role + "  ·  " + location.hostname;
      note.replaceChildren(label, document.createTextNode(message));
    },
    { role, message },
  );
}

export async function showOrderSummary(page) {
  assert.equal(new URL(page.url()).origin, "https://checkout.stripe.com");
  const summary = page.locator(".OrderSummaryColumn");
  await summary.waitFor({ state: "attached", timeout: 60000 });
  await checkMask(page);
  await summary.evaluate((el) => {
    // Only the product summary and the promotion-code input belong in the recording.
    const unexpected = el.querySelector(
      'iframe,input:not([name="promotionCode"]),select,textarea',
    );
    if (unexpected || /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(el.textContent))
      throw Error("Unexpected checkout layout");
    document.documentElement.dataset.camera = "stripe";
    el.dataset.filmRegion = "";
  });
  await expect(summary).toBeVisible();
  return summary;
}

export async function showEconomyCard(page) {
  const buy = page
    .locator("button")
    .filter({ hasText: /^Upgrade to Economy Class$/ });
  await buy.waitFor({ state: "attached" });
  await checkMask(page);
  await buy.evaluate((button) => {
    const card = button.closest(".rounded-3xl");
    if (
      !card ||
      !card.textContent.includes("Economy") ||
      card.querySelector("input,iframe") ||
      card.textContent.includes("@")
    ) {
      throw Error("Unexpected plan card");
    }
    card.dataset.filmRegion = "";
    document.documentElement.dataset.camera = "plan";
    card.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await buy.scrollIntoViewIfNeeded();
  await expect(buy).toBeEnabled();
  return buy;
}

export async function readMember(page, email) {
  // getByText matches the email cell itself (it has no nested span in the current table).
  const row = page
    .locator("tbody tr")
    .filter({ has: page.getByText(email, { exact: true }) });
  await row.waitFor({ state: "attached" });
  assert.equal(await row.count(), 1);
  const cells = row.locator("td");
  assert.equal(
    (await cells.nth(1).textContent()).trim().toLowerCase(),
    email.toLowerCase(),
  );
  return {
    row,
    referral: (await cells.nth(2).textContent()).trim().toLowerCase(),
  };
}

// Select a real card/row and collapse all other rows/cards. No financial cells,
// original names or member emails are made visible. Only read-only UI is used.
async function showAdminRow(row, { columns, alias, mode }) {
  await row.evaluate(
    (tr, { columns, alias, mode }) => {
      const card = tr.closest('[data-slot="card"]');
      const table = tr.closest("table");
      if (!card || !table) throw Error("Expected an admin report table");
      const title = document.querySelector("header h1");
      const memberTable = mode === "member";
      const expectedColumns = memberTable
        ? ["Name", "Referred by"]
        : ["Affiliate"];
      if (
        title?.textContent.trim() !==
          (memberTable ? "Member dashboard" : "Affiliate program") ||
        !columns.every(
          (col, index) =>
            table.tHead?.rows[0]?.cells[col]?.textContent.trim() ===
            expectedColumns[index],
        )
      ) {
        throw Error("Unexpected admin headings");
      }
      document.documentElement.dataset.camera = "admin";
      card.dataset.filmCard = "";
      tr.dataset.filmRow = "";
      for (const node of [
        document.querySelector("main"),
        title,
        card,
        table,
        tr,
      ]) {
        if (node) node.dataset.filmShell = "";
      }
      for (const col of columns) {
        const heading = table.tHead.rows[0].cells[col];
        heading.dataset.filmColumn = "";
        heading.dataset.filmShell = "";
        tr.cells[col].dataset.filmColumn = "";
      }
      if (mode === "member") {
        // CSS draws the alias over the masked native name cell. Keep its real text hidden.
        tr.cells[0].dataset.filmAlias = alias;
        tr.cells[2].dataset.filmRegion = "";
      }
      const link = document.querySelector(
        'header a[href="/admin-dashboard/affiliates"]',
      );
      if (link && link.textContent.trim() === "Affiliates")
        link.dataset.filmRegion = "";
    },
    { columns, alias, mode },
  );
}

export async function showMemberComparison(page, members) {
  await checkMask(page);
  for (const { email, referral, label } of members) {
    const { row, referral: actual } = await readMember(page, email);
    assert.equal(
      actual,
      referral,
      "Unexpected Referred by value for QA member",
    );
    await showAdminRow(row, { columns: [0, 2], alias: label, mode: "member" });
    await expect(row.locator("td").nth(2)).toBeVisible();
  }
}

export async function showAffiliate(page, code, referralUrl) {
  await checkMask(page);
  const coupon = page.getByText("Coupon code: " + code, { exact: true });
  const row = page.locator("tbody tr").filter({ has: coupon });
  await row.waitFor({ state: "attached", timeout: 60000 });
  assert.equal(await row.count(), 1);
  const cell = row.locator("td").first();
  assert.equal(
    await cell.getByText("Coupon code: " + code, { exact: true }).count(),
    1,
  );
  const link = cell.getByText(referralUrl, { exact: true });
  assert.equal(
    await link.count(),
    1,
    "Coupon and referral link must belong to one affiliate",
  );
  await showAdminRow(row, { columns: [0], mode: "affiliate" });
  // Mark just the validated strings, not the whole cell (which also contains contact data).
  for (const text of [coupon, link]) {
    await text.evaluate((el) => (el.dataset.filmRegion = ""));
    await expect(text).toBeVisible();
  }
  return { coupon, link };
}
