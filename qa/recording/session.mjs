// Authenticate before starting the recorder. Keep both Firebase browser state and the
// app's signed session in this disposable context. Never persist storageState.
export const origin =
  process.env.AC_BASE_URL || "https://app.theactorscopilot.com";
const local = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);
if (origin !== "https://app.theactorscopilot.com" && !local.has(origin)) {
  throw new Error("Choose the production app or a local server on port 3000");
}

export async function signIn(page) {
  const {
    AC_TEST_EMAIL: email,
    AC_TEST_PASSWORD: password,
    NEXT_PUBLIC_FIREBASE_API_KEY: key,
  } = process.env;
  if (!email || !password || !key)
    throw new Error("Missing test identity or Firebase configuration");
  const tokenResponse = await fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" +
      encodeURIComponent(key),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      redirect: "error",
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!tokenResponse.ok) throw new Error("Firebase authentication failed");
  const { idToken } = await tokenResponse.json();
  const session = await fetch(origin + "/api/auth/callback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
    redirect: "error",
  });
  const cookie = session.headers
    .getSetCookie()
    .find((c) => c.startsWith("platform_session="));
  if (!session.ok || !cookie) throw new Error("App session setup failed");
  await page
    .context()
    .addCookies([
      {
        name: "platform_session",
        value: cookie.split(";")[0].slice("platform_session=".length),
        url: origin,
        httpOnly: true,
        sameSite: "Lax",
        secure: origin.startsWith("https:"),
      },
    ]);
  await page.goto(origin + "/login", { waitUntil: "domcontentloaded" });
  await page.locator("input[type=email]").fill(email);
  await page.locator("input[type=password]").fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL(
    (url) => url.origin === origin && url.pathname !== "/login",
    { waitUntil: "commit" },
  );
}
