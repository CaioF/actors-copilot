// Run from the repository root. The address must be authorized on the server
// before the browser creates it. Each new recording gets a new address.
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

try {
  await writeFile(
    '.env.qa.local',
    [
      'QA_SIMULATION_ENABLED=true',
      'QA_SIMULATION_SECRET=' + randomBytes(32).toString('hex'),
      'QA_SIMULATION_ALLOWED_AFFILIATES=lucas',
      '',
    ].join('\n'),
    { flag: 'wx', mode: 0o600 },
  );
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
}
const nonce = randomUUID();
const config = '.env.qa-signup-' + nonce.slice(0, 12) + '.local';
await writeFile(
  config,
  [
    'QA_SIMULATION_SIGNUP_EMAIL=qa.actor.' + nonce + '@example.test',
    'AC_SIGNUP_PASSWORD=Aa1' + randomBytes(24).toString('hex'),
    '',
  ].join('\n'),
  { flag: 'wx', mode: 0o600 },
);
console.log('Fresh signup configuration: ' + config);
