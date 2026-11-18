import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const local = fileURLToPath(new URL(".", import.meta.url));
export async function mountCoach(page, prompt, reply) {
  const cssPath = resolve(root, "app/globals.css");
  const stylesheet = await postcss([tailwind({ base: root })]).process(
    await readFile(cssPath, "utf8"),
    { from: cssPath },
  );
  const adapter = resolve(local, "adapters.jsx");
  const bundle = await build({
    absWorkingDir: root,
    entryPoints: [resolve(local, "entry.jsx")],
    bundle: true,
    minify: true,
    write: false,
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    jsx: "automatic",
    alias: {
      "@/hooks/use-acting-coach": adapter,
      "@/components/dashboard-header": adapter,
      "next/navigation": adapter,
      "next/image": resolve(local, "image.jsx"),
    },
  });
  const origin = "http://coach.localhost";
  const html =
    '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/app.css"><div id="root" class="flex h-screen flex-col bg-background text-foreground"></div><script src="/app.js"></script>';
  const files = new Map([
    ["/", ["text/html", html]],
    ["/app.css", ["text/css", stylesheet.css]],
    [
      "/logo.png",
      ["image/png", await readFile(resolve(root, "public/logo.png"))],
    ],
    ["/app.js", ["application/javascript", bundle.outputFiles[0].contents]],
  ]);
  await page.context().route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (
      url.pathname === "/api/coach/chat" &&
      route.request().method() === "POST" &&
      route.request().postDataJSON().content === prompt
    ) {
      return route.fulfill({ json: { aiData: { coach_reply: reply } } });
    }
    const asset = files.get(url.pathname);
    if (!asset) return route.fulfill({ status: 404, body: "" });
    await route.fulfill({ contentType: asset[0], body: Buffer.from(asset[1]) });
  });
  await page.goto(origin);
  return origin;
}
