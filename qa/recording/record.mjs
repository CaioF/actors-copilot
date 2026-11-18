import assert from "node:assert/strict";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout as pause } from "node:timers/promises";
import { chromium } from "playwright";
import { expect } from "playwright/test";
import { signIn, origin } from "./session.mjs";

const [journey, option] = process.argv.slice(2);
const allowed = ["affiliate", "brief", "sides", "coach", "coach-fixture"];
if (
  !allowed.includes(journey) ||
  (option && option !== "--submit") ||
  process.argv.length > 4
)
  throw new Error(
    "Choose affiliate, brief, sides, coach or coach-fixture, optionally with --submit.",
  );
if (journey === "coach-fixture" && option)
  throw new Error("The fixture always submits locally.");
const submit = option === "--submit";
const viewport = { width: 1440, height: 900 };
const runId = new Date().toISOString().replaceAll(":", "-");
const dir = fileURLToPath(
  new URL("./evidence/" + journey + "-" + runId + "/", import.meta.url),
);
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport, locale: "en-US" });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const report = {
  journey,
  submit,
  origin,
  browser: browser.version(),
  viewport,
  status: "running",
  clips: [],
  checks: [],
};
let current;
let stage = "setup";
const action = (name) => {
  stage = name;
};
const checkpoint = (name) =>
  report.checks.push({
    name,
    clip: current?.name,
    ms: current ? Math.round(performance.now() - current.start) : null,
  });

async function begin(name) {
  assert(!current);
  await page.screencast.showActions({
    cursor: "pointer",
    duration: 650,
    style: {
      title: "display:none",
      highlight: "outline: 2px solid #e86d22",
      point:
        "width: 10px; height: 10px; border: 2px solid white; border-radius: 50%; background: #76350d",
    },
  });
  await page.screencast.start({
    path: dir + name + ".partial.webm",
    size: viewport,
    fps: 30,
  });
  current = { name, start: performance.now() };
  await pause(750);
}
async function end() {
  const durationMs = Math.round(performance.now() - current.start);
  await page.screencast.stop();
  await page.screencast.hideActions();
  const { name } = current;
  current = undefined;
  await rename(dir + name + ".partial.webm", dir + name + ".webm");
  report.clips.push({
    name,
    durationMs,
  });
}
async function choose(locator) {
  await locator.hover();
  await pause(350);
  await locator.click();
}
async function type(field, text) {
  await choose(field);
  await field.pressSequentially(text, { delay: 65 });
  await expect(field).toHaveValue(text);
}
const button = (name) => page.getByRole("button", { name, exact: true });

async function memberHome() {
  await signIn(page);
  const intro = page.getByRole("button", { name: "Close intro video" });
  await page.addLocatorHandler(intro, () => intro.click(), { times: 1 });
  await page.goto(origin + "/dashboard", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "My Acting Copilot" }),
  ).toBeVisible();
  await page.addStyleTag({
    content: 'header a[href="/profile"] {visibility:hidden !important}',
  });
}

async function audition() {
  await memberHome();
  const sides = journey === "sides";
  const link = page.getByRole("link", {
    name: sides ? "Start Scene Study" : "Upload Casting Brief and sides",
    exact: true,
  });
  await begin(journey);
  action("open wizard from dashboard");
  await choose(link);
  await page.waitForURL("**/auditions/new/" + journey);
  checkpoint("Opened " + journey + " wizard");
  const project = "The Last Ferry";
  await type(page.locator("#project"), project);
  await type(page.locator("#role"), "Mara");
  await choose(button("Next"));
  const details = page.getByPlaceholder("Paste your details here...");
  action("enter fictional material");
  const text = sides
    ? "MARA: You kept the ticket.\nELI: I thought you might come back."
    : "Mara runs the night ferry. Her brother returns with a ticket she sold him ten years ago.";
  // An actor typically pastes the script. Use the browser clipboard and real paste keys.
  await choose(details);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin,
  });
  await page.evaluate((value) => navigator.clipboard.writeText(value), text);
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+V" : "Control+V",
  );
  await expect(details).toHaveValue(text);
  await pause(1100);
  await choose(button("Next"));
  action("verify audition review");
  await expect(
    page.getByRole("heading", { name: "Ready to Generate" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: sides ? "Sides" : "Character Brief",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(project, { exact: true })).toBeVisible();
  await expect(page.getByText("Mara", { exact: true })).toBeVisible();
  await expect(page.getByText(/Text pasted \(\d+ words\)/)).toBeVisible();
  const generate = button("Generate Breakdown");
  await expect(generate).toBeEnabled();
  checkpoint("Review displays the project, role and attached material");
  await pause(1400);
  if (submit) {
    action("generate breakdown");
    const endpoint =
      "/api/auditions/" + (sides ? "analyzeSides" : "analyzeBrief");
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url() === origin + endpoint && r.request().method() === "POST",
        { timeout: 180000 },
      ),
      choose(generate),
    ]);
    assert(response.ok(), "Analysis failed");
    await expect(
      page.getByRole("button", { name: /^Save (Output|& Close)$/ }),
    ).toBeVisible({ timeout: 30000 });
    await expect(
      page.getByRole("heading", { name: "Mara", exact: true }),
    ).toBeVisible();
    checkpoint("Analysis returned and rendered a breakdown for Mara");
    await pause(2400);
    await page.mouse.wheel(0, 340);
  }
}

const prompt =
  "Mara has one line before the ferry leaves. Give me one playable action.";
async function coach() {
  if (journey === "coach-fixture") {
    action("mount local coach component");
    const { mountCoach } = await import("./fixture/mount.mjs");
    const endpointOrigin = await mountCoach(
      page,
      prompt,
      "Make him stay: hold out the ticket and wait for him to take it.",
    );
    report.origin = endpointOrigin;
    report.outcome = "local-scripted-response";
    await begin("coach-fixture");
    await choose(button("Character Coach (Role Focus)"));
    await expect(
      page.getByPlaceholder("Talk to your Character Coach..."),
    ).toBeVisible();
    await choose(button("24/7 General Coach"));
    return converse(endpointOrigin, true);
  }
  await memberHome();
  action("prepare clean coach conversation");
  const session = await context.request.get(origin + "/api/auth/callback");
  assert(session.ok(), "Session lookup failed");
  const { tier } = await session.json();
  if (tier !== "business") await begin("coach-entry");
  await choose(page.getByRole("link", { name: "Acting Coach", exact: true }));
  await page.waitForURL((url) =>
    ["/upgrade", "/acting-coach"].includes(url.pathname),
  );
  if (new URL(page.url()).pathname === "/upgrade") {
    await expect(
      button("Upgrade to Economy Class")
        .or(button("Upgrade to Business Class"))
        .first(),
    ).toBeVisible();
    checkpoint(
      "Member was directed to plan selection when opening Acting Coach",
    );
    report.outcome = "upgrade-required";
    if (submit)
      throw new Error("A Business membership is required for coach submission");
    return;
  }
  if (current) await end();
  const general = button("24/7 General Coach");
  await expect(general).toBeVisible({ timeout: 30000 });
  // Keep previous test conversations out of the capture.
  await choose(button("New Session"));
  await choose(general);
  await expect(
    page.getByRole("heading", { name: "Your 24/7 Coach is ready." }),
  ).toBeVisible();
  await begin("coach");
  return converse(origin, submit);
}
async function converse(endpointOrigin, sendQuestion) {
  await type(page.getByPlaceholder("Talk to your coach..."), prompt);
  const send = button("Send message");
  await expect(send).toBeEnabled();
  checkpoint("General Coach has a composed question ready to send");
  if (sendQuestion) {
    action("send coach question");
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url() === endpointOrigin + "/api/coach/chat" &&
          r.request().method() === "POST",
        { timeout: 150000 },
      ),
      choose(send),
    ]);
    assert(response.ok(), "Coach request failed");
    await expect(page.getByText(prompt, { exact: true })).toBeVisible();
    // Match the first sentence of the real response against the assistant bubble.
    const data = await response.json();
    const reply = data.aiData?.coach_reply;
    assert.equal(typeof reply, "string", "Unknown coach response contract");
    const words = reply
      .replace(/[*_#]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 4)
      .join(" ");
    assert(words.length > 4);
    await expect(
      page
        .locator("div.justify-start .space-y-3")
        .filter({ hasText: words })
        .last(),
    ).toBeVisible({ timeout: 30000 });
    checkpoint("Sent question and verified returned text in the coach reply");
    await pause(2300);
  }
}

async function affiliate() {
  action("open referral");
  await page.goto(origin + "/login?ref=lucas");
  const signup = page
    .locator("button[type=submit]")
    .filter({ hasText: "Create Account" });
  await expect(signup).toBeVisible();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("affiliate_attribution") || "{}").code ===
      "lucas",
  );
  await begin("referral");
  await choose(button("Log In"));
  await expect(button("Sign In")).toBeVisible();
  await type(page.locator("input[type=email]"), "mara@example.test");
  await pause(800);
  await choose(
    page.locator("button[type=button]").filter({ hasText: /^Create Account$/ }),
  );
  await expect(signup).toBeVisible();
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("affiliate_attribution")).code,
    ),
    "lucas",
  );
  checkpoint("Referral persisted while switching login and registration");
  if (!submit) return;
  await pause(1000);
  await end();
  action("sign in off camera");
  await signIn(page);
  await page.goto(origin + "/upgrade", { waitUntil: "domcontentloaded" });
  const economy = button("Upgrade to Economy Class");
  await expect(economy).toBeVisible();
  await page.addStyleTag({
    content: 'header a[href="/profile"] {visibility:hidden !important}',
  });
  await begin("plan");
  action("compare plan billing cycles");
  await choose(page.getByRole("button", { name: /^Annual\b/ }));
  await expect(page.getByText("/year", { exact: false }).first()).toBeVisible();
  await choose(button("Monthly"));
  await expect(
    page.getByText("/month", { exact: false }).first(),
  ).toBeVisible();
  checkpoint("Switched back to monthly billing");
  // Hold the top-level redirect until encoding stops, before any Stripe form can render.
  await page.route("https://checkout.stripe.com/**", async (route) => {
    if (
      route.request().isNavigationRequest() &&
      route.request().frame() === page.mainFrame() &&
      current
    )
      await end();
    await route.continue();
  });
  action("open monthly checkout");
  await choose(economy);
  await page.waitForURL("https://checkout.stripe.com/**", { timeout: 60000 });
  await expect(page.getByText(/LUCAS/i).first()).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByText(/20%/).first()).toBeVisible();
  checkpoint("Off-camera checkout displays LUCAS and 20%");
  // Keep original pixels of just the verified labels. The surrounding Stripe form stays off camera.
  const receipt = [];
  for (const pattern of [/lucas/i, /20%/]) {
    const label = page.getByText(pattern).first();
    const value = (await label.innerText()).trim();
    const box = await label.boundingBox();
    assert(
      /^[\s\w%(),.·$€£–—:+-]{1,75}$/u.test(value) && !/\d{5}/.test(value),
      "Unexpected checkout label",
    );
    assert(
      box && box.width <= 420 && box.height <= 80,
      "Unexpected checkout label area",
    );
    receipt.push((await label.screenshot()).toString("base64"));
  }
  await page.goto("about:blank");
  await page.setContent(
    '<main style="font:26px system-ui;color:#28342c;padding:12vh 8vw"><p>Actors Copilot · QA</p><h1>Descuento del afiliado</h1><p>Recortes del checkout real de Stripe</p>' +
      receipt
        .map(
          (img) =>
            '<img style="display:block;margin:20px 0;min-height:36px" src="data:image/png;base64,' +
            img +
            '">',
        )
        .join("") +
      '<p style="font-size:19px">La prueba terminó antes de introducir una tarjeta.</p></main>',
  );
  await begin("checkout-labels");
  checkpoint("Isolated screenshots of the verified Stripe labels");
}

try {
  if (journey === "affiliate") await affiliate();
  else if (journey === "coach" || journey === "coach-fixture") await coach();
  else await audition();
  if (current) {
    await pause(1900);
    await end();
  }
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.stage = stage;
  // Browser call logs can contain account values. Only report the stage and error type.
  console.error(
    "Capture failed at " +
      stage +
      " (" +
      error.name +
      ", " +
      (error.stack
        ?.split("\n")
        .find((line) => line.includes(".mjs:"))
        ?.match(/[\w-]+\.mjs:\d+/)?.[0] || "unknown step") +
      ")",
  );
  if (current) await page.screencast.stop().catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(dir + "report.json", JSON.stringify(report, null, 2));
  console.log(report.status + " | " + dir);
}
