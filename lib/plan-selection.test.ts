import { getAnnualPaymentLink } from './plan-selection';

describe('getAnnualPaymentLink', () => {
  it('keeps the account reference on the link', () => {
    const url = new URL(
      getAnnualPaymentLink('business', 'usd', { uid: 'uid-1', email: 'member@example.com' }),
    );

    expect(url.searchParams.get('client_reference_id')).toBe('uid-1');
    expect(url.searchParams.get('prefilled_email')).toBe('member@example.com');
  });

  it('prefills the affiliate promotion code so it is visible on the Stripe page', () => {
    const url = new URL(
      getAnnualPaymentLink('business', 'usd', {
        uid: 'uid-1',
        email: 'member@example.com',
        promotionCode: 'LUCAS',
      }),
    );

    expect(url.searchParams.get('prefilled_promo_code')).toBe('LUCAS');
  });

  it('leaves the promotion code out when the member has no affiliate', () => {
    const url = new URL(getAnnualPaymentLink('economy', 'eur', { uid: 'uid-1' }));

    expect(url.searchParams.get('prefilled_promo_code')).toBeNull();
  });
});
