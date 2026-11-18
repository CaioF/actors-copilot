import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as hold } from "node:timers/promises";
import { chromium } from "playwright";
import { expect } from "playwright/test";
import { origin, signIn } from "./session.mjs";
import {
  caption,
  installPrivacyScreen,
  readMember,
  showAffiliate,
  showEconomyCard,
  showMemberComparison,
  showOrderSummary,
} from "./affiliate-screen.mjs";

const manual = {
  email: process.env.AC_TEST_EMAIL,
  password: process.env.AC_TEST_PASSWORD,
};
const referred = {
  email: process.env.AC_REFERRED_EMAIL,
  password: process.env.AC_REFERRED_PASSWORD,
};
const admin = {
  username: process.env.AC_ADMIN_USERNAME,
  password: process.env.AC_ADMIN_PASSWORD,
};
if (
  ![
    ...Object.values(manual),
    ...Object.values(referred),
    ...Object.values(admin),
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  ].every(Boolean) ||
  manual.email.toLowerCase() === referred.email.toLowerCase()
) {
  throw Error(
    "Provide the two distinct QA identities, Firebase API key and operator credentials listed in README.md",
  );
}
const ffmpeg = process.env.AC_FFMPEG_PATH || "ffmpeg";
execFileSync(ffmpeg, ["-version"], { stdio: "ignore", windowsHide: true });
const code = "LUCAS";
const ref = "lucas";
const referralUrl = new URL("/login?ref=" + ref, origin).href;
const viewport = { width: 1440, height: 900 };
const settings = { viewport, locale: "en-US" };
const dir = fileURLToPath(
  new URL(
    "./evidence/affiliate-coupon-" +
      new Date().toISOString().replaceAll(":", "-") +
      "/",
    import.meta.url,
  ),
);
await mkdir(dir, { recursive: true });
const report = {
  origin,
  viewport,
  capture: "incomplete",
  tests: {},
  observed: {},
  timeline: [],
};
const browser = await chromium.launch();
report.browser = browser.version();
let page;
let recording = false;
let start;
let stage = "preparation";
function mark(name) {
  report.timeline.push({ ms: Math.round(performance.now() - start), name });
}
async function stageNote(name, title, message) {
  stage = name;
  await caption(page, title, message);
  mark(name);
}
async function choose(target) {
  await target.hover();
  await hold(380);
  await target.click();
}
async function checkMember(context, linked) {
  const session = await context.request.get(origin + "/api/auth/callback");
  const offer = await context.request.get(origin + "/api/billing/affiliate");
  assert(session.ok() && offer.ok(), "Could not verify buyer setup");
  const account = await session.json();
  assert(
    account.authenticated && account.tier === "free",
    "Use a Free test member",
  );
  const { affiliate } = await offer.json();
  if (linked) {
    assert(
      affiliate?.code === ref &&
        affiliate?.promotionCode === code &&
        affiliate?.percentOff === 20,
      "Expected the Lucas offer for the linked test actor",
    );
  } else {
    assert.equal(
      affiliate,
      null,
      "The manual-code test requires a member without affiliate attribution",
    );
  }
}
// Sign in on a separate tab. Only the buyer's plan, hosted checkout and read-only
// admin UI are recorded. Each buyer opens Stripe from the plan on the same page.
async function prepareBuyer(context, identity, linked) {
  const setup = await context.newPage();
  try {
    if (linked) {
      // Reset this disposable browser's app storage between the two identities.
      const cdp = await context.newCDPSession(setup);
      try {
        await cdp.send("Storage.clearDataForOrigin", {
          origin,
          storageTypes: "all",
        });
      } finally {
        await cdp.detach();
      }
      await context.clearCookies();
      await setup.goto(referralUrl, { waitUntil: "domcontentloaded" });
      await setup.waitForFunction(
        (expected) =>
          JSON.parse(localStorage.getItem("affiliate_attribution") || "{}")
            .code === expected,
        ref,
      );
    }
    await signIn(setup, identity);
    await checkMember(context, linked);
    if (!linked)
      assert.equal(
        await setup.evaluate(() =>
          localStorage.getItem("affiliate_attribution"),
        ),
        null,
      );
  } finally {
    await setup.close();
  }
}
async function operatorCookie() {
  const operator = await browser.newContext(settings);
  try {
    const res = await operator.request.post(origin + "/api/admin/login", {
      data: admin,
      maxRedirects: 0,
    });
    assert(res.ok(), "Operator authentication failed");
    const p = await operator.newPage();
    await p.goto(origin + "/admin-dashboard", {
      waitUntil: "domcontentloaded",
    });
    assert.equal((await readMember(p, manual.email)).referral, "—");
    assert.equal((await readMember(p, referred.email)).referral, ref);
    const cookie = (await operator.cookies(origin)).find(
      (c) => c.name === "admin_session",
    );
    assert(cookie?.httpOnly, "Missing admin session");
    return cookie;
  } finally {
    await operator.close();
  }
}
async function verifyTotals(summary, expectedAfterTrial) {
  let observed;
  await expect
    .poll(async () => {
      const text = await summary.innerText();
      observed = {
        afterTrial: text.match(/Total after trial\s*(\$[\d,.]+)/i)?.[1],
        dueToday: text.match(/Total due today\s*(\$[\d,.]+)/i)?.[1],
      };
      return observed;
    })
    .toEqual({ afterTrial: expectedAfterTrial, dueToday: "$0.00" });
  return observed;
}
async function verifyDiscount(summary) {
  const badge = summary.getByText(code, { exact: true });
  const offer = summary.getByText(/20% off 1 billing cycle/i);
  await expect(badge).toBeVisible({ timeout: 45000 });
  await expect(offer).toBeVisible();
  return {
    code: (await badge.innerText()).trim(),
    offer: (await offer.innerText()).trim(),
    ...(await verifyTotals(summary, "$15.20")),
  };
}
async function typeCoupon(summary) {
  const input = summary.getByRole("textbox", { name: /promotion code/i });
  if (await summary.getByText(code, { exact: true }).isVisible()) {
    const remove = summary.getByRole("button", {
      name: /remove.*(code|discount|promotion|lucas)/i,
    });
    await remove.click({ timeout: 5000 });
  }
  await expect(input).toBeVisible();
  await verifyTotals(summary, "$19.00");
  await stageNote(
    "manual-before",
    "Stripe · Cuenta A",
    "Entrada manual. Economy cuesta USD 19 después del trial. La cuenta entró sin referencia.",
  );
  await hold(2000);
  await choose(input);
  await input.pressSequentially(code, { delay: 210 });
  await expect(input).toHaveValue(code);
  await hold(1100);
  mark("manual-apply");
  await choose(summary.getByRole("button", { name: "Apply", exact: true }));
  const discount = summary.getByText(code, { exact: true });
  const rejection = summary.getByText("This promotion code is invalid.", {
    exact: true,
  });
  await expect(
    discount.or(rejection).filter({ visible: true }).first(),
  ).toBeVisible({ timeout: 45000 });
  if (await rejection.isVisible()) {
    const totals = await verifyTotals(summary, "$19.00");
    await expect(discount).not.toBeVisible();
    report.observed.manual = {
      code,
      response: (await rejection.innerText()).trim(),
      ...totals,
    };
    report.tests.manual = "rejected";
    await stageNote(
      "manual-rejected",
      "Stripe · Cuenta A",
      "Stripe rechazó el código escrito. El total después del trial sigue en USD 19.",
    );
  } else {
    report.observed.manual = await verifyDiscount(summary);
    report.tests.manual = "applied";
    await stageNote(
      "manual-applied",
      "Stripe · Cuenta A",
      "Stripe aceptó el código escrito y aplicó el descuento durante el primer ciclo.",
    );
  }
  await hold(3600);
}
async function openEconomy() {
  stage = "opening the Economy plan";
  await page.goto(origin + "/upgrade", { waitUntil: "domcontentloaded" });
  return showEconomyCard(page);
}
async function openCheckout(economy) {
  stage = "opening hosted Economy checkout";
  await choose(economy);
  await page.waitForURL("https://checkout.stripe.com/**", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  return showOrderSummary(page);
}
async function enterLinkedCheckout() {
  const economy = await openEconomy();
  await stageNote(
    "linked-plan",
    "Aplicación · Cuenta B",
    "Prueba por enlace. Esta cuenta de prueba ya figura como referida por Lucas.",
  );
  await hold(2600);
  const summary = await openCheckout(economy);
  const discount = await verifyDiscount(summary);
  report.observed.linked = discount;
  report.tests.linked = "applied";
  await stageNote(
    "linked-applied",
    "Stripe · Cuenta B",
    "LUCAS aparece aplicado al abrir el checkout. USD 15,20 tras el trial y USD 0 hoy.",
  );
  await summary.getByText(discount.code, { exact: true }).hover();
  await hold(4000);
  return discount.code;
}
async function verifyInAdmin(context, cookie, observedCode) {
  stage = "opening the admin member table";
  await context.clearCookies({ name: "platform_session" });
  await context.addCookies([cookie]);
  await page.goto(origin + "/admin-dashboard", {
    waitUntil: "domcontentloaded",
  });
  await showMemberComparison(page, [
    { email: manual.email, referral: "—", label: "A · Entrada manual" },
    { email: referred.email, referral: ref, label: "B · Por enlace" },
  ]);
  report.tests.memberAttribution = "baseline-confirmed";
  await stageNote(
    "admin-members",
    "Admin · Miembros",
    "Referred by conserva los valores iniciales. A sigue sin referido y B ya estaba vinculada a Lucas. Identidades ocultas.",
  );
  await page.getByRole("columnheader", { name: "Referred by" }).hover();
  await hold(4300);
  await choose(page.getByRole("link", { name: "Affiliates", exact: true }));
  await page.waitForURL(origin + "/admin-dashboard/affiliates", {
    waitUntil: "domcontentloaded",
  });
  const { coupon, link } = await showAffiliate(page, observedCode, referralUrl);
  await stageNote(
    "admin-coupon",
    "Admin · Afiliados",
    "En la fila del afiliado se verifican el mismo código y el enlace de referencia. Los checkouts quedaron sin completar.",
  );
  await coupon.hover();
  await hold(1500);
  await link.hover();
  await hold(3200);
  report.observed.admin = {
    coupon: (await coupon.innerText()).trim(),
    referralUrl: (await link.innerText()).trim(),
  };
  report.tests.adminCoupon = "matched-checkout-code-and-referral-link";
}
try {
  stage = "checking admin baseline";
  const cookie = await operatorCookie();
  const context = await browser.newContext(settings);
  stage = "checking manual account";
  await prepareBuyer(context, manual, false);
  page = await context.newPage();
  await installPrivacyScreen(page);
  const firstPlan = await openEconomy();
  await caption(
    page,
    "Aplicación · Cuenta A",
    "Abrimos Economy con una cuenta sin referido para escribir el cupón en Stripe.",
  );
  await page.screencast.showActions({
    cursor: "pointer",
    duration: 650,
    style: { title: "display:none", highlight: "outline:2px solid #ec812c" },
  });
  await page.screencast.start({
    path: join(dir, "take.partial.webm"),
    size: viewport,
    fps: 30,
  });
  recording = true;
  start = performance.now();
  mark("manual-plan");
  await hold(2400);
  const summary = await openCheckout(firstPlan);
  stage = "applying manual coupon";
  await typeCoupon(summary);
  stage = "switching to the referred test member";
  await prepareBuyer(context, referred, true);
  await page.bringToFront();
  const observedCode = await enterLinkedCheckout();
  await verifyInAdmin(context, cookie, observedCode);
  await page.screencast.stop();
  recording = false;
  await rename(join(dir, "take.partial.webm"), join(dir, "take.webm"));
  stage = "encoding continuous recording";
  // One video stream throughout. No concatenation, capture restart, skip or speed change.
  execFileSync(
    ffmpeg,
    [
      "-nostdin",
      "-v",
      "error",
      "-xerror",
      "-i",
      "take.webm",
      "-map",
      "0:v:0",
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-threads",
      "4",
      "-preset",
      "veryfast",
      "-crf",
      "19",
      "-movflags",
      "+faststart",
      "affiliate.partial.mp4",
    ],
    { cwd: dir, windowsHide: true },
  );
  execFileSync(
    ffmpeg,
    [
      "-nostdin",
      "-v",
      "error",
      "-xerror",
      "-i",
      "affiliate.partial.mp4",
      "-map",
      "0:v:0",
      "-f",
      "null",
      "-",
    ],
    { cwd: dir, windowsHide: true },
  );
  await rename(join(dir, "affiliate.partial.mp4"), join(dir, "affiliate.mp4"));
  report.capture = "complete";
  if (report.tests.manual === "rejected") process.exitCode = 2;
} catch (error) {
  report.failedStage = stage;
  const location = error.stack?.match(
    /affiliate-(?:screen|coupon)\.mjs:\d+:\d+/,
  )?.[0];
  console.error(
    "Capture interrupted at " +
      stage +
      " (" +
      [error.name, location].filter(Boolean).join(", ") +
      ")",
  );
  process.exitCode = 1;
} finally {
  if (recording) await page.screencast.stop().catch(() => {});
  await browser.close();
  await writeFile(join(dir, "report.json"), JSON.stringify(report, null, 2));
  console.log(report.capture, report.tests, dir);
}
