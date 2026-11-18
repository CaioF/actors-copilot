jest.mock('@/lib/firebase.admin', () => ({
  db: {
    collection: (name: string) => ({
      get: async () => ({ docs: name === 'affiliates' ? [{ id: 'lucas', data: () => ({ name: 'Lucas', rate: 0.3 }) }] : [] }),
      where: () => ({ get: async () => ({ docs: [
        { id: 'real', data: () => ({ email: 'real@example.com' }) },
        { id: 'qa', data: () => ({ email: 'test@example.com', qaSimulation: { active: true } }) },
      ] }) }),
    }),
    doc: (path: string) => ({ path, get: async () => ({ data: () => ({ customerId: path.includes('/qa/') ? 'cus_qa' : 'cus_real', tier: 'economy', status: 'trialing' }) }) }),
    getAll: async (...refs: Array<{ path: string }>) => refs.map(ref => ({ data: () => ref.path === 'qaAffiliateSimulations/qa' ? { active: true, affiliateCode: 'lucas' } : undefined })),
  },
}));
jest.mock('@/lib/stripe', () => ({ stripe: { invoices: { list: jest.fn(async () => ({ data: [{ id: 'inv', currency: 'usd', amount_paid: 1900, created: 1 }] })) } } }));
jest.mock('@/lib/qa-affiliate-integrity', () => ({ isValidQaRun: jest.fn(() => true) }));

import { stripe } from '@/lib/stripe';
import { buildAffiliateReport } from './affiliates';

it('excludes simulated test accounts from real referral and revenue totals', async () => {
  const [row] = await buildAffiliateReport();
  expect(row.referredCount).toBe(1);
  expect(row.qaReferredCount).toBe(1);
  expect(row.convertedCount).toBe(1);
  expect(row.totals[0]).toMatchObject({ netCollected: 1900, commission: 570 });
  expect(row.members.find(member => member.uid === 'qa')).toMatchObject({ qaSimulation: true, netCollected: 0, converted: false });
  expect(stripe.invoices.list).toHaveBeenCalledTimes(1);
});
