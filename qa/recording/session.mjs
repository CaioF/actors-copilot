// A fresh browser profile signs in through the same form as a returning actor.
export const origin = new URL(process.env.AC_BASE_URL || 'https://app.theactorscopilot.com').origin;
if (origin !== 'https://app.theactorscopilot.com' && !['localhost','127.0.0.1'].includes(new URL(origin).hostname)) {
  throw new Error('Choose the production app or a local checkout.');
}

export async function signIn(page, {email=process.env.AC_TEST_EMAIL,password=process.env.AC_TEST_PASSWORD}={}) {
  if (!email || !password) throw new Error('Configure the authorized test member.');
  await page.goto(origin + '/login', {waitUntil:'load'});
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  const accepted = page.waitForResponse(response => new URL(response.url()).origin === origin &&
    new URL(response.url()).pathname === '/api/auth/callback' && response.request().method() === 'POST');
  const [exchange] = await Promise.all([accepted, page.getByRole('button',{name:'Sign In',exact:true}).click()]);
  if (!exchange.ok()) throw new Error('The application rejected the user session.');
  await page.waitForURL(url => url.origin === origin && url.pathname === '/dashboard', {timeout:90000});
}
