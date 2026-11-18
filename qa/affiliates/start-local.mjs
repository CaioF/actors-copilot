import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const base = new URL(process.env.AC_BASE_URL || 'http://localhost:3105');
if (!['localhost', '127.0.0.1'].includes(base.hostname) || base.protocol !== 'http:' || !base.port) {
  throw new Error('Choose a loopback HTTP origin with a port for the pre-merge server.');
}
// Next worker processes must not inherit Node's --env-file command line flags.
const child = spawn(
  process.execPath,
  [
    require.resolve('next/dist/bin/next'),
    'dev',
    '--webpack',
    '--hostname',
    '127.0.0.1',
    '--port',
    base.port,
  ],
  {
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, NEXT_PUBLIC_APP_URL: base.origin },
  },
);
child.on('error', () => {
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
