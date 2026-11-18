#!/usr/bin/env node
// Read-only smoke probe for a locally running Actors Copilot checkout.
const origin = process.argv[2] ?? 'http://localhost:3000';
let base;
try {
  base = new URL(origin);
  if (base.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) ||
      base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error();
} catch {
  console.error('Use a local HTTP origin, for example http://localhost:3000');
  process.exit(2);
}

async function check(path, validate) {
  const response = await fetch(new URL(path, base), {
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
  });
  await validate(response);
  console.log(`PASS ${path}`);
}

try {
  await check('/login', async response => {
    const body = await response.text();
    if (response.status !== 200 || !body.includes('Welcome back')) {
      throw new Error(`Expected login page (HTTP ${response.status})`);
    }
  });
  await check('/dashboard', async response => {
    const location = response.headers.get('location');
    if (![307, 308].includes(response.status) || !location ||
        new URL(location, base).origin !== base.origin || new URL(location, base).pathname !== '/login') {
      throw new Error(`Expected redirect to local /login (HTTP ${response.status})`);
    }
  });
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
