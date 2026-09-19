import type Stripe from 'stripe';
import {
  getStripe,
  PRO_PLAN_ANNUAL_USD,
  PRO_PLAN_MONTHLY_USD,
  TEAM_PLAN_ANNUAL_USD,
  TEAM_PLAN_MONTHLY_USD,
} from '@/lib/stripe';
import type { BillingInterval } from '@/config/pricing';

export type CheckoutPlan = 'pro' | 'team';

export interface CreateCheckoutSessionInput {
  orgId: string;
  userId: string;
  customerId?: string | null;
  billingInterval: BillingInterval;
  appUrl: string;
  plan?: CheckoutPlan;
}

export async function createProCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const { orgId, userId, customerId, billingInterval, appUrl, plan = 'pro' } = input;

  const organizationId = orgId?.trim();
  const authUserId = userId?.trim();

  if (!organizationId) {
    throw new Error('Organization ID is required for Stripe checkout');
  }

  if (!authUserId) {
    throw new Error('User ID is required for Stripe checkout');
  }

  const isTeam = plan === 'team';
  const monthlyPriceId = isTeam
    ? process.env.STRIPE_TEAM_MONTHLY_PRICE_ID?.trim()
    : (process.env.STRIPE_PRO_MONTHLY_PRICE_ID?.trim() ??
      process.env.STRIPE_PRO_PRICE_ID?.trim());
  const yearlyPriceId = isTeam
    ? process.env.STRIPE_TEAM_YEARLY_PRICE_ID?.trim()
    : process.env.STRIPE_PRO_YEARLY_PRICE_ID?.trim();

  const priceId = billingInterval === 'year' ? yearlyPriceId : monthlyPriceId;
  const monthlyUsd = isTeam ? TEAM_PLAN_MONTHLY_USD : PRO_PLAN_MONTHLY_USD;
  const annualUsd = isTeam ? TEAM_PLAN_ANNUAL_USD : PRO_PLAN_ANNUAL_USD;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            product_data: {
              name: isTeam ? 'Nexus Shield Team' : 'Nexus Shield Pro',
              description: isTeam
                ? '25 agents, 1M tool calls/mo, HITL approval, custom MCP proxy, Slack/Teams alerts.'
                : '5 agents, 100K tool calls/mo, sub-10ms intercept, SHA-256 evidence chain.',
            },
            unit_amount: billingInterval === 'year' ? annualUsd * 100 : monthlyUsd * 100,
            recurring: { interval: billingInterval },
          },
        },
      ];

  const sessionMetadata = {
    organization_id: organizationId,
    user_id: authUserId,
    org_id: organizationId,
    billing_interval: billingInterval,
    plan,
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
        plan,
      },
    },
    success_url: `${appUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/pricing?payment=cancelled`,
  });
}
