import type Stripe from 'stripe';
import { getStripe, PRO_PLAN_ANNUAL_USD, PRO_PLAN_MONTHLY_USD } from '@/lib/stripe';
import type { BillingInterval } from '@/config/pricing';

export interface CreateCheckoutSessionInput {
  orgId: string;
  customerId?: string | null;
  billingInterval: BillingInterval;
  appUrl: string;
}

export async function createProCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const { orgId, customerId, billingInterval, appUrl } = input;

  const monthlyPriceId =
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID?.trim() ??
    process.env.STRIPE_PRO_PRICE_ID?.trim();
  const yearlyPriceId = process.env.STRIPE_PRO_YEARLY_PRICE_ID?.trim();

  const priceId = billingInterval === 'year' ? yearlyPriceId : monthlyPriceId;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Nexus Shield Pro',
              description:
                '500K API requests/mo, SCA & secret scanning, GitHub Checks, prompt injection firewall.',
            },
            unit_amount:
              billingInterval === 'year' ? PRO_PLAN_ANNUAL_USD * 100 : PRO_PLAN_MONTHLY_USD * 100,
            recurring: { interval: billingInterval },
          },
        },
      ];

  return stripe.checkout.sessions.create({
    mode: 'subscription',
    client_reference_id: orgId,
    customer: customerId ?? undefined,
    line_items: lineItems,
    metadata: {
      org_id: orgId,
      billing_interval: billingInterval,
      plan: 'pro',
    },
    subscription_data: {
      metadata: {
        org_id: orgId,
        plan: 'pro',
      },
    },
    success_url: `${appUrl}/dashboard?payment=success`,
    cancel_url: `${appUrl}/#pricing?payment=cancelled`,
  });
}
