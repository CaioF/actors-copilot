import { createHmac, timingSafeEqual } from 'node:crypto';

// Firestore map order is not guaranteed. Sign a canonical representation so a
// client-writable marker can never masquerade as a server-owned QA run.
function canonical(value: unknown): string {
  if (value === undefined) throw new Error('Undefined QA record field');
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

export function signQaRun(uid: string, run: Record<string, unknown>): string {
  const secret = process.env.QA_SIMULATION_SECRET || '';
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw new Error('QA signing key is not configured');
  return createHmac('sha256', Buffer.from(secret, 'hex')).update(canonical({ uid, run })).digest('hex');
}

export function isValidQaRun(uid: string, data: Record<string, unknown> | undefined): boolean {
  if (!data || typeof data.signature !== 'string' || !/^[a-f0-9]{64}$/i.test(data.signature)) return false;
  try {
    const { signature, ...run } = data;
    const expected = Buffer.from(signQaRun(uid, run), 'hex');
    return timingSafeEqual(expected, Buffer.from(signature as string, 'hex'));
  } catch { return false; }
}
