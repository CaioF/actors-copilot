import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error(
    'STRIPE_SECRET_KEY is missing from environment variables. Billing system failed to initialize.'
  );
}

export const stripe = new Stripe(secretKey, {
  apiVersion: '2026-05-27.dahlia', 
  appInfo: {
    name: 'The Actors Copilot',
    version: '0.1.0',
  },
});