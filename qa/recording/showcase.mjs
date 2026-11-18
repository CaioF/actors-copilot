// Assemble only completed captures. Every cut in an analysis wait has a visible title card.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const evidence = fileURLToPath(new URL("./evidence/", import.meta.url));
const args = process.argv.slice(2);
const affiliate = args[0]?.startsWith('--affiliate=') ? resolve(args.shift().slice('--affiliate='.length)) : undefined;
const inputs = args;
if (
  (!inputs.length && !affiliate) ||
  inputs.some((name) => !/^[\w.-]+$/.test(name) || name.startsWith("."))
) {
  throw new Error("Pass completed run directory names in playback order.");
}
const dir = join(
  evidence,
  "showcase-" + new Date().toISOString().replaceAll(":", "-"),
);
await mkdir(dir, { recursive: true });
const ffmpeg = process.env.AC_FFMPEG_PATH || "ffmpeg";
const encode = (args) =>
  execFileSync(
    ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-nostdin", ...args],
    { cwd: dir },
  );
const titles = {
  brief: "Prepare a casting brief",
  sides: "Study Mara's sides",
  "coach-entry": "Open Acting Coach",
  "coach-fixture": "Rehearse a question with the coach",
  coach: "Talk to Acting Coach",
};
const segments = [];
const chapters = [";FFMETADATA1"];
let frames = 0;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
function segment(args) {
  const name = "part-" + segments.length + ".mp4";
  encode([
    ...args,
    "-an",
    "-vf",
    "fps=30,scale=1440:900,setsar=1,format=yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-threads",
    "4",
    name,
  ]);
  const progress = encode([
    "-i",
    name,
    "-map",
    "0:v:0",
    "-c",
    "copy",
    "-progress",
    "pipe:1",
    "-f",
    "null",
    "-",
  ]).toString();
  const count = Number(
    [...progress.matchAll(/^frame=(\d+)\s*$/gm)].at(-1)?.[1],
  );
  assert(count > 0, "Empty encoded segment");
  frames += count;
  segments.push(name);
}
async function card(title, subtitle, duration = 1.6) {
  await page.setContent(
    '<body style="margin:0;background:#29372f;color:#f9f3e6;font:24px system-ui"><main style="margin:230px 100px"><p></p><h1 style="font-size:60px;max-width:1140px"></h1></main></body>',
  );
  await page.locator("p").evaluate((el, s) => (el.textContent = s), subtitle);
  await page.locator("h1").evaluate((el, s) => (el.textContent = s), title);
  const png = join(dir, "card.png");
  await page.screenshot({ path: png });
  segment(["-loop", "1", "-i", png, "-t", String(duration)]);
}

try {
  if (affiliate) {
    const run = JSON.parse(await readFile(join(affiliate, "report.json"), "utf8"));
    assert(run.journey === "affiliate-signup" && run.status === "demo-complete" &&
      run.cleanup === "verified" && run.demoHttpStatus === 303 && run.language === "en-US",
      "Expected a completed affiliate browser take with verified cleanup");
    assert.equal(run.presentation, "full browser viewport", "Select a full-view affiliate recording");
    const where = run.origin === "https://app.theactorscopilot.com" ? "Production" : "Pre-merge app";
    await card("Lucas referral, checkout and admin", where + " · Stripe confirmation simulated");
    segment(["-i", join(affiliate, "affiliate.mp4")]);
    chapters.push("[CHAPTER]", "TIMEBASE=1/30", "START=0", "END="+frames, "title=Lucas referral, checkout and admin");
  }
  for (const input of inputs) {
    const report = JSON.parse(
      await readFile(join(evidence, input, "report.json"), "utf8"),
    );
    assert.equal(report.status, "passed");
    assert.equal(report.language, "en-US");
    assert.equal(report.presentation, "full browser viewport", "Select a full-view actor recording");
    assert(["browser sign-in form","component fixture"].includes(report.authentication));
    for (const clip of report.clips) {
      assert(Object.hasOwn(titles, clip.name));
      const chapterStart = frames;
      const video = resolve(evidence, input, clip.name + ".webm");
      const context =
        report.origin === "https://app.theactorscopilot.com"
          ? "Production"
          : "Local test";
      await card(
        titles[clip.name],
        context +
          (clip.name === "coach-fixture"
            ? " · Scripted response"
            : " · Actors Copilot"),
      );
      const review = report.checks.find(
        (c) => c.clip === clip.name && c.name.startsWith("Review displays"),
      );
      const result = report.checks.find(
        (c) => c.clip === clip.name && c.name.startsWith("Analysis returned"),
      );
      if (review && result && result.ms - review.ms > 14000) {
        const from = review.ms / 1000 + 5;
        const to = result.ms / 1000 - 2;
        segment(["-i", video, "-t", String(from)]);
        await card(
          "Analysis wait shortened",
          context + " · " + Math.round(to - from) + " seconds omitted",
        );
        segment(["-ss", String(to), "-i", video]);
      } else {
        segment(["-i", video]);
      }
      chapters.push(
        "[CHAPTER]",
        "TIMEBASE=1/30",
        "START=" + chapterStart,
        "END=" + frames,
        "title=" + titles[clip.name],
      );
    }
  }
  await writeFile(
    join(dir, "parts.txt"),
    segments.map((name) => "file '" + name + "'").join("\n"),
  );
  await writeFile(join(dir, "chapters.txt"), chapters.join("\n") + "\n");
  encode([
    "-f",
    "concat",
    "-safe",
    "1",
    "-i",
    "parts.txt",
    "-f",
    "ffmetadata",
    "-i",
    "chapters.txt",
    "-map",
    "0:v:0",
    "-map_chapters",
    "1",
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    "showcase.mp4",
  ]);
  encode(["-xerror", "-i", "showcase.mp4", "-map", "0:v:0", "-f", "null", "-"]);
  console.log(join(dir, "showcase.mp4"));
} finally {
  await browser.close();
}
