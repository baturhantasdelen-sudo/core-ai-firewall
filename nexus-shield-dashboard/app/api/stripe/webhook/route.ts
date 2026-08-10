import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

async function activateOrganization(orgId: string, customerId: string | null) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('organizations')
    .update({
      stripe_subscription_status: 'active',
      ...(customerId ? { stripe_customer_id: customerId } : {}),
    })
    .eq('id', orgId);

  if (error) {
    throw new Error(`Failed to activate organization ${orgId}: ${error.message}`);
  }
}

async function downgradeOrganizationByCustomerId(customerId: string) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('organizations')
    .update({ stripe_subscription_status: 'free' })
    .eq('stripe_customer_id', customerId);

  if (error) {
    throw new Error(`Failed to downgrade organization for customer ${customerId}: ${error.message}`);
  }
}

function extractCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  return typeof customer === 'string' ? customer : customer.id;
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: 'Missing STRIPE_WEBHOOK_SECRET' }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid signature';
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.client_reference_id;

        if (!orgId) {
          console.error('checkout.session.completed missing client_reference_id', session.id);
          break;
        }

        await activateOrganization(orgId, extractCustomerId(session.customer));
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = extractCustomerId(subscription.customer);

        if (customerId) {
          await downgradeOrganizationByCustomerId(customerId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = extractCustomerId(subscription.customer);
        const isCancelled = subscription.status === 'canceled';

        if (customerId && isCancelled) {
          await downgradeOrganizationByCustomerId(customerId);
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
