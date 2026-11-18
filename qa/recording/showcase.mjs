// Assemble only completed captures. Every cut in an analysis wait has a visible title card.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const evidence = fileURLToPath(new URL("./evidence/", import.meta.url));
const inputs = process.argv.slice(2);
if (
  !inputs.length ||
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
  referral: "Abrir el enlace de Lucas",
  plan: "Elegir Economy mensual",
  "checkout-labels": "Comprobar el cupón en Stripe",
  brief: "Preparar un casting brief",
  sides: "Estudiar los sides de Mara",
  "coach-entry": "Abrir Acting Coach",
  "coach-fixture": "Ensayar una pregunta para el Coach",
  coach: "Conversar con Acting Coach",
};
const segments = [];
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
  for (const input of inputs) {
    const report = JSON.parse(
      await readFile(join(evidence, input, "report.json"), "utf8"),
    );
    assert.equal(report.status, "passed");
    for (const clip of report.clips) {
      assert(Object.hasOwn(titles, clip.name));
      const video = resolve(evidence, input, clip.name + ".webm");
      const context =
        report.origin === "https://app.theactorscopilot.com"
          ? "Producción"
          : "Prueba local";
      await card(
        titles[clip.name],
        context +
          (clip.name === "coach-fixture"
            ? " · Respuesta ficticia"
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
          "Espera de análisis abreviada",
          context + " · Se omitieron " + Math.round(to - from) + " s",
        );
        segment(["-ss", String(to), "-i", video]);
      } else {
        segment(["-i", video]);
      }
    }
  }
  await writeFile(
    join(dir, "parts.txt"),
    segments.map((name) => "file '" + name + "'").join("\n"),
  );
  encode([
    "-f",
    "concat",
    "-safe",
    "1",
    "-i",
    "parts.txt",
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
