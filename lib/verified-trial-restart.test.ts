import { canRestartInvalidBillingTrial } from './verified-trial-restart';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase.admin';
jest.mock('@/lib/stripe', () => ({ stripe: {
  subscriptions: { retrieve: jest.fn(), list: jest.fn() }, customers: { retrieve: jest.fn() },
} }));
jest.mock('@/lib/firebase.admin', () => ({ db: { doc: jest.fn() } }));
describe('verified invalid-billing trial restart', () => {
  const flag = { required: true, tier: 'business', invalidBillingRestart: { subscriptionId: 'sub_testmode' } };
  const bill = { customerId: 'cus_testmode', subscriptionId: 'sub_testmode' };
  const missing = Object.assign(new Error('No such resource'), { code: 'resource_missing' });
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(db.doc).mockReturnValue({get:async()=>({data:()=>({required:true,subscriptionId:'sub_testmode',expiresAt:'2099-01-01'})})} as never);
    jest.mocked(stripe.subscriptions.retrieve).mockRejectedValue(missing);
    jest.mocked(stripe.customers.retrieve).mockRejectedValue(missing);
  });
  it('accepts an explicitly reviewed missing live subscription/customer', async () => {
    await expect(canRestartInvalidBillingTrial('uid',flag,bill)).resolves.toBe(true);
  });
  it.each([null, { ...flag, required: false }, {...flag, expiresAt: '2020-01-01'},
    {...flag, resolvedAt: '2026-11-12'}, {required: true,tier:'business'}])('does not bypass normal gates for %j', async candidate => {
    await expect(canRestartInvalidBillingTrial('uid',candidate,bill)).resolves.toBe(false);
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });
  it('rejects a changed subscription binding', async () => {
    await expect(canRestartInvalidBillingTrial('uid',flag,{...bill,subscriptionId:'sub_new'})).resolves.toBe(false);
  });
  it('rejects a client-writable flag without a server-only approval', async () => {
    jest.mocked(db.doc).mockReturnValue({get:async()=>({data:()=>undefined})} as never);
    await expect(canRestartInvalidBillingTrial('uid',flag,bill)).resolves.toBe(false);
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });
  it('does not resurrect a test-mode entitlement after the trial offer expires', async () => {
    const expired = {...flag,expiresAt:'2020-01-01'};
    await expect(canRestartInvalidBillingTrial('uid',expired,bill)).resolves.toBe(false);
    await expect(canRestartInvalidBillingTrial('uid',expired,bill,true)).resolves.toBe(true);
  });
  it('rejects even a canceled subscription that exists in live mode', async () => {
    jest.mocked(stripe.subscriptions.retrieve).mockResolvedValue({status:'canceled'} as never);
    await expect(canRestartInvalidBillingTrial('uid',flag,bill)).resolves.toBe(false);
  });
  it('propagates Stripe outages instead of treating them as missing billing', async () => {
    jest.mocked(stripe.subscriptions.retrieve).mockRejectedValue(new Error('offline'));
    await expect(canRestartInvalidBillingTrial('uid',flag,bill)).rejects.toThrow('offline');
  });
  it('allows retry with a replacement customer owned by the same UID and no live plan', async () => {
    jest.mocked(stripe.customers.retrieve).mockResolvedValue({id:'cus_new',metadata:{platformUserId:'uid'}} as never);
    jest.mocked(stripe.subscriptions.list).mockReturnValue({autoPagingToArray: async()=>[]} as never);
    await expect(canRestartInvalidBillingTrial('uid',flag,{...bill,customerId:'cus_new'})).resolves.toBe(true);
  });
  it('rejects a replacement customer with an existing plan', async () => {
    jest.mocked(stripe.customers.retrieve).mockResolvedValue({id:'cus_new',metadata:{platformUserId:'uid'}} as never);
    jest.mocked(stripe.subscriptions.list).mockReturnValue({autoPagingToArray: async()=>[{status:'trialing'}]} as never);
    await expect(canRestartInvalidBillingTrial('uid',flag,bill)).resolves.toBe(false);
  });
  it('rejects a customer that belongs to another UID', async () => {
    jest.mocked(stripe.customers.retrieve).mockResolvedValue({id:'cus_other',metadata:{platformUserId:'other'}} as never);
    await expect(canRestartInvalidBillingTrial('uid',flag,bill)).resolves.toBe(false);
  });
});
