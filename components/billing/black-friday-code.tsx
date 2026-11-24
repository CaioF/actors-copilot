'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import type { BillingCycle } from '@/lib/billing';
import {
  BLACK_FRIDAY_END,
  BLACK_FRIDAY_START,
  isBlackFridayOpen,
  isBlackFridayPlan,
} from '@/lib/black-friday';

export function useBlackFridayCode(cycle: BillingCycle, currency: string) {
  const [value, setValue] = useState('');
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const nextChange = now < BLACK_FRIDAY_START ? BLACK_FRIDAY_START : BLACK_FRIDAY_END;
    if (now >= nextChange) return;
    const delay = Math.min(nextChange - now, 2_147_483_647);
    const timer = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [now]);

  const visible = isBlackFridayPlan(cycle, currency) && isBlackFridayOpen(now);
  return {
    code: visible ? value.trim() : '',
    field: visible ? { value, onChange: setValue } : null,
  };
}

export function BlackFridayCodeField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-medium">Black Friday code</span>
      <Input
        className="uppercase"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={32}
      />
    </label>
  );
}
