/** Claim a legacy trial redirect once, before any asynchronous checkout work. */
export function consumeTrialIntent(): string | null {
  if (typeof window === 'undefined' || !sessionStorage.getItem('trial_intent')) return null;
  const tier = sessionStorage.getItem('trial_tier') || 'business';
  sessionStorage.removeItem('trial_intent');
  sessionStorage.removeItem('trial_tier');
  return tier;
}
