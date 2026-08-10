import Stripe from 'stripe';

let cachedClient: Stripe | null = null;

/**
 * Server-only Stripe client. Never import this from a Client Component —
 * it relies on the secret key and must stay on the server.
 */
export function getStripe(): Stripe {
  if (cachedClient) {
    return cachedClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable');
  }

  cachedClient = new Stripe(secretKey, {
    typescript: true,
  });

  return cachedClient;
}

export const PRO_PLAN_PRICE_USD = 79;
