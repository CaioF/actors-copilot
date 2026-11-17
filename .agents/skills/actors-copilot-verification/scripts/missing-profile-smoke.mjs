#!/usr/bin/env node
// Read-only, signed-out check using an unguessable synthetic slug.
import {randomUUID} from 'node:crypto';

const origin = process.argv[2];
let base;
try {
  base = new URL(origin);
  const local = base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (!(base.protocol === 'https:' || local) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error();
} catch {
  console.error('Pass an HTTPS origin or local HTTP origin, for example http://localhost:3000');
  process.exit(2);
}

const slug = `verification-missing-${randomUUID()}`;
try {
  for (const [suffix, expectedType] of [['', 'text/html'], ['/index.md', 'text/markdown']]) {
    const response = await fetch(new URL(`/actors/${slug}${suffix}`, base), {
      redirect:'manual', signal:AbortSignal.timeout(30000),
    });
    const body = await response.text();
    if (response.status !== 404 || !response.headers.get('content-type')?.includes(expectedType) || !body.includes('Profile Not Found')) {
      throw new Error(`${suffix || '/'}: expected a ${expectedType} 404 with the missing-profile message; got HTTP ${response.status}`);
    }
    console.log(JSON.stringify({representation:suffix ? 'markdown' : 'html', status:response.status, notFound:true}));
  }
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
