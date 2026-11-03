'use client';

import { useEffect } from 'react';
import {
  AFFILIATE_PARAM,
  captureAffiliateAttribution,
  readAffiliateAttribution,
} from '@/lib/affiliate-attribution';

/**
 * Captures the affiliate code carried by the referral link.
 *
 * The code is read from the query string on any landing and kept in the
 * browser until the account is created. Nothing is rendered: the component
 * only records where the visit came from.
 *
 * First touch wins. A referral that is still inside the attribution window is
 * never replaced by a later link, so the affiliate that brought the member in
 * keeps the credit.
 */
export function AffiliateCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(AFFILIATE_PARAM);

    if (!raw) return;
    if (readAffiliateAttribution()) return;

    captureAffiliateAttribution(raw, window.location.pathname);
  }, []);

  return null;
}
