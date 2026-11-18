import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as hold } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { expect } from "playwright/test";
import {
  installPrivacyScreen,
  showAffiliate,
  showMemberComparison,
  showOrderSummary,
} from "./affiliate-screen.mjs";

const local = "https://recording.example.test";
const referralUrl = local + "/login?ref=lucas";
const email = "actor@example.test";
const privatePanel = '<div class="private-zone">Private details</div>';
function html(content) {
  return `<!doctype html><meta charset="utf-8"><style>
    .private-zone { position:fixed;inset:0;background:#ff00ff;z-index:1000;pointer-events:none }
    .public-marker { display:inline-block;width:200px;height:40px;background:#00ff00 }
  </style><body>${privatePanel}${content}</body>`;
}
function table(headings, rows) {
  const title =
    headings[0] === "Name" ? "Member dashboard" : "Affiliate program";
  return (
    "<main><header><h1>" +
    title +
    '</h1></header><section data-slot="card"><table><thead><tr>' +
    headings.map((h) => "<th>" + h + "</th>").join("") +
    "</tr></thead><tbody>" +
    rows
      .map(
        (cells) =>
          "<tr>" + cells.map((c) => "<td>" + c + "</td>").join("") + "</tr>",
      )
      .join("") +
    "</tbody></table></section></main>"
  );
}

test("only approved checkout and admin fields reach the continuous recording", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const context = await browser.newContext({
    viewport: { width: 640, height: 480 },
    serviceWorkers: "block",
  });
  const coupon =
    '<div>Coupon code: <span class="public-marker">LUCAS</span></div>';
  const link = "<span>" + referralUrl + "</span>";
  const pages = new Map([
    [
      "https://checkout.stripe.com/order",
      '<div class="OrderSummaryColumn"><input name="promotionCode" aria-label="Add promotion code"></div><input aria-label="Card number">',
    ],
    [
      "https://checkout.stripe.com/layout-change",
      '<div class="OrderSummaryColumn"><input name="cardNumber"></div>',
    ],
    [
      local + "/members",
      table(
        ["Name", "Email", "Referred by", "Status"],
        [
          ["Private name", email, "<span>—</span>", "Free"],
          ["Another member", "other@example.test", "lucas", "Private status"],
        ],
      ),
    ],
    [
      local + "/mixed",
      table(
        ["Affiliate", "Money"],
        [
          [coupon, "10"],
          [link, "20"],
        ],
      ),
    ],
    [
      local + "/affiliate",
      table(
        ["Affiliate", "Money"],
        [[coupon + link + "<span>Private contact</span>", "Private balance"]],
      ),
    ],
    [local + "/unexpected", ""],
  ]);
  await context.route("**/*", (r) => {
    const pageBody = pages.get(r.request().url());
    return pageBody === undefined
      ? r.abort()
      : r.fulfill({ contentType: "text/html", body: html(pageBody) });
  });
  const page = await context.newPage();
  await installPrivacyScreen(page);
  const evidence = fileURLToPath(new URL("./evidence/", import.meta.url));
  await mkdir(evidence, { recursive: true });
  const dir = await mkdtemp(join(evidence, "privacy-test-"));
  const native = join(dir, "privacy.webm");
  await page.screencast.start({
    path: native,
    size: { width: 640, height: 480 },
    fps: 15,
  });
  try {
    await page.goto("https://checkout.stripe.com/order");
    await showOrderSummary(page);
    await expect(page.getByLabel("Add promotion code")).toBeVisible();
    await expect(page.getByLabel("Card number")).toBeHidden();
    await page.goto("https://checkout.stripe.com/layout-change");
    await assert.rejects(showOrderSummary(page), /Unexpected checkout layout/);
    await expect(page.locator("[name=cardNumber]")).toBeHidden();
    await page.goto(local + "/members");
    await showMemberComparison(page, [
      { email, referral: "—", label: "A · Entrada manual" },
    ]);
    await expect(page.getByText(email, { exact: true })).toBeHidden();
    await expect(page.getByText("Private name", { exact: true })).toBeHidden();
    await expect(
      page.getByText("Private status", { exact: true }),
    ).toBeHidden();
    await expect(page.getByText("—", { exact: true })).toBeVisible();
    await page.goto(local + "/mixed");
    await assert.rejects(
      showAffiliate(page, "LUCAS", referralUrl),
      /one affiliate/,
    );
    await expect(page.getByText("LUCAS", { exact: true })).toBeHidden();
    await page.goto(local + "/affiliate");
    const visible = await showAffiliate(page, "LUCAS", referralUrl);
    await expect(visible.coupon).toBeVisible();
    await expect(visible.link).toBeVisible();
    await expect(
      page.getByText("Private contact", { exact: true }),
    ).toBeHidden();
    await expect(
      page.getByText("Private balance", { exact: true }),
    ).toBeHidden();
    await hold(650);
    // A client-side redraw of the table starts masked again, even on the same URL.
    await page.locator("tbody").evaluate((el) => {
      el.innerHTML = '<tr><td class="private-zone">Unreviewed row</td></tr>';
    });
    await expect(page.getByText("Unreviewed row")).toBeHidden();
    await page.goto(local + "/unexpected");
    await expect(page.getByText("Private details")).toBeHidden();
    await hold(400);
  } finally {
    await page.screencast.stop();
  }

  const rgb = execFileSync(
    process.env.AC_FFMPEG_PATH || "ffmpeg",
    [
      "-nostdin",
      "-v",
      "error",
      "-xerror",
      "-i",
      native,
      "-vf",
      "scale=80:60:flags=neighbor",
      "-pix_fmt",
      "rgb24",
      "-f",
      "rawvideo",
      "pipe:1",
    ],
    { maxBuffer: 32 * 1024 * 1024, windowsHide: true },
  );
  let green = 0;
  for (let i = 0; i < rgb.length; i += 3) {
    const r = rgb[i],
      g = rgb[i + 1],
      b = rgb[i + 2];
    if (r > 180 && g < 75 && b > 180)
      assert.fail("Private magenta marker reached a recorded frame");
    if (r < 75 && g > 180 && b < 75) green++;
  }
  assert(
    green > 20,
    "The allowed green coupon marker should be readable on camera",
  );
});
