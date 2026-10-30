import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Starting your free trial - The Actors Copilot',
  description: 'One quick step to activate your free trial of The Actors Copilot.',
  robots: { index: false, follow: false },
};

export default function StartTrialLayout({ children }: { children: React.ReactNode }) {
  return children;
}
