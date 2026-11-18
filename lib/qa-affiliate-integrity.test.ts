import { isValidQaRun, signQaRun } from './qa-affiliate-integrity';

it('binds the QA record and its Firestore generation to the test UID and secret', () => {
  process.env.QA_SIMULATION_SECRET = 'a'.repeat(64);
  try {
    const run = { state: 'active', generation: '100:1', checkout: 'checkout-digest' };
    const signed = { ...run, signature: signQaRun('qa-user', run) };
    expect(isValidQaRun('qa-user', signed)).toBe(true);
    expect(isValidQaRun('other-user', signed)).toBe(false);
    expect(isValidQaRun('qa-user', { ...signed, state: 'pending' })).toBe(false);
    expect(isValidQaRun('qa-user', { ...signed, generation: '100:2' })).toBe(false);
    process.env.QA_SIMULATION_SECRET = 'b'.repeat(64);
    expect(isValidQaRun('qa-user', signed)).toBe(false);
  } finally {
    delete process.env.QA_SIMULATION_SECRET;
  }
});
