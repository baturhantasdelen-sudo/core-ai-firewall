import type Stripe from 'stripe';
import { getStripe, PRO_PLAN_ANNUAL_USD, PRO_PLAN_MONTHLY_USD } from '@/lib/stripe';
import type { BillingInterval } from '@/config/pricing';

export interface CreateCheckoutSessionInput {
  orgId: string;
  userId: string;
  customerId?: string | null;
  billingInterval: BillingInterval;
  appUrl: string;
}

export async function createProCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const { orgId, userId, customerId, billingInterval, appUrl } = input;

  const organizationId = orgId?.trim();
  const authUserId = userId?.trim();

  if (!organizationId) {
    throw new Error('Organization ID is required for Stripe checkout');
  }

  if (!authUserId) {
    throw new Error('User ID is required for Stripe checkout');
  }

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

  const sessionMetadata = {
    organization_id: organizationId,
    user_id: authUserId,
    org_id: organizationId,
    billing_interval: billingInterval,
    plan: 'pro',
  };

  console.log('[Stripe Checkout] Creating subscription session', {
    organizationId,
    billingInterval,
    priceId: priceId ?? 'dynamic_price_data',
    mode: 'subscription',
  });

  if (priceId && !priceId.startsWith('price_')) {
    console.warn('[Stripe Checkout] Price ID does not look like a Stripe price_ id', priceId);
  }

  return stripe.checkout.sessions.create({
    mode: 'subscription',
    client_reference_id: organizationId,
    customer: customerId ?? undefined,
    line_items: lineItems,
    metadata: sessionMetadata,
    subscription_data: {
      metadata: {
        organization_id: organizationId,
        user_id: authUserId,
        org_id: organizationId,
        plan: 'pro',
      },
    },
    success_url: `${appUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/#pricing?payment=cancelled`,
  });
}
