jest.mock('@/lib/firebase.admin', () => ({
  db: {
    collection: (name: string) => ({
      get: async () => ({
        docs: name === 'affiliates' ? [{ id: 'lucas', data: () => ({ name: 'Lucas', rate: 0.3 }) }] : [],
      }),
      where: () => ({
        get: async () => ({
          docs: [
            { id: 'real', data: () => ({ email: 'real@example.com' }) },
            { id: 'qa', data: () => ({ email: 'test@example.com' }) },
          ],
        }),
      }),
    }),
    doc: (path: string) => ({
      path,
      get: async () => ({
        data: () => ({
          customerId: path.includes('/qa/') ? 'cus_qa' : 'cus_real',
          tier: 'economy',
          status: 'trialing',
        }),
      }),
    }),
  },
}));
jest.mock('@/lib/stripe', () => ({
  stripe: {
    invoices: {
      list: jest.fn(async () => ({
        data: [{ id: 'inv', currency: 'usd', amount_paid: 1900, created: 1 }],
      })),
    },
  },
}));
jest.mock('@/lib/qa-affiliate-run', () => ({
  listQaTrials: async () => new Map([['qa', { affiliateCode: 'lucas' }]]),
}));

import { stripe } from '@/lib/stripe';
import { buildAffiliateReport } from './affiliates';

it('reports the demo separately while preserving both real referrals and their paid invoices', async () => {
  const [row] = await buildAffiliateReport();
  expect(row.referredCount).toBe(2);
  expect(row.qaReferredCount).toBe(1);
  expect(row.convertedCount).toBe(2);
  expect(row.totals[0]).toMatchObject({ netCollected: 3800, commission: 1140 });
  expect(row.members.find((member) => member.uid === 'qa')).toMatchObject({
    netCollected: 1900,
    converted: true,
  });
  expect(stripe.invoices.list).toHaveBeenCalledTimes(2);
});
