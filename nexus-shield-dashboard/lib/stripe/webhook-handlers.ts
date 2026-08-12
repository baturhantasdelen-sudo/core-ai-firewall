import type Stripe from 'stripe';
import { getSupabaseAdmin } from '@/lib/supabase';
import { PLAN_SCAN_LIMITS } from '@/config/plans';

export async function activateOrganization(orgId: string, customerId: string | null) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('organizations')
    .update({
      stripe_subscription_status: 'active',
      monthly_scan_limit: PLAN_SCAN_LIMITS.pro,
      ...(customerId ? { stripe_customer_id: customerId } : {}),
    })
    .eq('id', orgId);

  if (error) {
    throw new Error(`Failed to activate organization ${orgId}: ${error.message}`);
  }
}

export async function downgradeOrganizationByCustomerId(customerId: string) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('organizations')
    .update({
      stripe_subscription_status: 'free',
      monthly_scan_limit: PLAN_SCAN_LIMITS.free,
    })
    .eq('stripe_customer_id', customerId);

  if (error) {
    throw new Error(`Failed to downgrade organization for customer ${customerId}: ${error.message}`);
  }
}

export function extractCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null;
  return typeof customer === 'string' ? customer : customer.id;
}

export async function handleStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.client_reference_id ?? session.metadata?.org_id;

      if (!orgId) {
        console.error('checkout.session.completed missing org reference', session.id);
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
      const isInactive = subscription.status === 'canceled' || subscription.status === 'unpaid';

      if (customerId && isInactive) {
        await downgradeOrganizationByCustomerId(customerId);
      }
      break;
    }

    default:
      break;
  }
}
