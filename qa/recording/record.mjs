import assert from "node:assert/strict";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout as pause } from "node:timers/promises";
import { chromium } from "playwright";
import { expect } from "playwright/test";
import { signIn, origin } from "./session.mjs";

const [journey, option] = process.argv.slice(2);
const allowed = ["brief", "sides", "coach", "coach-fixture"];
if (
  !allowed.includes(journey) ||
  (option && option !== "--submit") ||
  process.argv.length > 4
)
  throw new Error(
    "Choose brief, sides, coach or coach-fixture, optionally with --submit.",
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
page.setDefaultTimeout(120000);
const report = {
  journey,
  submit,
  origin,
  browser: browser.version(),
  language: "en-US",
  authentication: journey === "coach-fixture" ? "component fixture" : "browser sign-in form",
  viewport,
  status: "running",
  routes: [],
  clips: [],
  checks: [],
};
page.on("framenavigated", frame => {
  if (frame !== page.mainFrame()) return;
  const url = new URL(frame.url());
  if (url.origin === origin && /^\/(dashboard|login|start-trial|upgrade|acting-coach|auditions\/new\/(brief|sides))$/.test(url.pathname))
    report.routes.push(url.pathname);
});
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
  await page.waitForURL(origin + "/dashboard");
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
  await page.waitForURL(url => url.pathname === "/auditions/new/" + journey, {waitUntil:"domcontentloaded",timeout:120000});
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
  const basics = page.getByRole("heading", {name:"Basics",exact:true}).locator("..");
  await expect(basics.getByText(project, {exact:true})).toBeVisible();
  await expect(basics.getByText("Mara", {exact:true})).toBeVisible();
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
  // The route chosen by the application establishes whether this account can enter.
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
    await begin("coach-entry");
    checkpoint(
      "Member was directed to plan selection when opening Acting Coach",
    );
    report.outcome = "upgrade-required";
    if (submit)
      throw new Error("A Business membership is required for coach submission");
    return;
  }
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


try {
  if (journey === "coach" || journey === "coach-fixture") await coach();
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
