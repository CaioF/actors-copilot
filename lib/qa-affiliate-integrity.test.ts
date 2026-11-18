import { isValidQaRun, signQaRun } from './qa-affiliate-integrity';

it('binds the QA record and its original snapshot to the test UID and secret', () => {
  process.env.QA_SIMULATION_SECRET = 'a'.repeat(64);
  try {
    const run = { active: true, rootBefore: { tier: { present: true, value: 'free' } } };
    const signed = { ...run, signature: signQaRun('qa-user', run) };
    expect(isValidQaRun('qa-user', signed)).toBe(true);
    expect(isValidQaRun('other-user', signed)).toBe(false);
    expect(isValidQaRun('qa-user', { ...signed, active: false })).toBe(false);
    expect(isValidQaRun('qa-user', { ...signed, rootBefore: { tier: { present: true, value: 'business' } } })).toBe(false);
    process.env.QA_SIMULATION_SECRET = 'b'.repeat(64);
    expect(isValidQaRun('qa-user', signed)).toBe(false);
  } finally { delete process.env.QA_SIMULATION_SECRET; }
});
