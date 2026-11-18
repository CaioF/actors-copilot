// The protected provider handoff and its browser assertions live with the endpoint.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const recorder = new URL('../affiliates/run-simulation.mjs',import.meta.url);
if (!existsSync(fileURLToPath(recorder))) {
  throw new Error('Use the affiliate recorder on the checkout containing PR #115. See qa/recording/README.md.');
}
await import(recorder.href);
