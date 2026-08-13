import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase';
import { PLAN_SCAN_LIMITS } from '@/config/plans';

const LOG_PREFIX = '[Stripe Webhook]';

function resolveOrgIdFromMetadata(metadata: Stripe.Metadata | null | undefined): string | null {
  if (!metadata) return null;
  return metadata.organization_id?.trim() ?? metadata.org_id?.trim() ?? null;
}

export async function activateOrganization(orgId: string, customerId: string | null) {
  console.log(LOG_PREFIX, 'Activating organization', { orgId, customerId });

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('organizations')
    .update({
      stripe_subscription_status: 'active',
      monthly_scan_limit: PLAN_SCAN_LIMITS.pro,
      ...(customerId ? { stripe_customer_id: customerId } : {}),
    })
    .eq('id', orgId)
    .select('id, stripe_subscription_status, monthly_scan_limit, stripe_customer_id')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to activate organization ${orgId}: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Organization ${orgId} not found during activation`);
  }

  console.log(LOG_PREFIX, 'Organization activated', data);
}

export async function downgradeOrganizationByCustomerId(customerId: string) {
  console.log(LOG_PREFIX, 'Downgrading organization for customer', customerId);

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

  console.log(LOG_PREFIX, 'Organization downgraded for customer', customerId);
}

export function extractCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null;
  return typeof customer === 'string' ? customer : customer.id;
}

async function findOrgIdByCustomerId(customerId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle<{ id: string }>();

  if (error) {
    console.error(LOG_PREFIX, 'Failed customer lookup', customerId, error.message);
    return null;
  }

  return data?.id ?? null;
}

async function findOrgIdByEmail(email: string): Promise<string | null> {
  console.log(LOG_PREFIX, 'Looking up organization by email', email);

  const supabase = getSupabaseAdmin();
  const normalizedEmail = email.trim().toLowerCase();

  const { data: usersData, error: userError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (userError) {
    console.error(LOG_PREFIX, 'Failed to list auth users', userError.message);
    return null;
  }

  const authUser = usersData.users.find(
    (user) => user.email?.trim().toLowerCase() === normalizedEmail,
  );

  if (!authUser) {
    console.log(LOG_PREFIX, 'No auth user found for email', normalizedEmail);
    return null;
  }

  const { data: membership, error: memberError } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', authUser.id)
    .maybeSingle<{ org_id: string }>();

  if (memberError) {
    console.error(LOG_PREFIX, 'Failed org_members lookup', memberError.message);
    return null;
  }

  if (membership?.org_id) {
    console.log(LOG_PREFIX, 'Resolved org via email', { email: normalizedEmail, orgId: membership.org_id });
  }

  return membership?.org_id ?? null;
}

async function resolveOrgIdFromCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<string | null> {
  console.log(LOG_PREFIX, 'Resolving org from checkout session', {
    sessionId: session.id,
    clientReferenceId: session.client_reference_id,
    metadata: session.metadata,
    customerEmail: session.customer_email ?? session.customer_details?.email,
  });

  if (session.client_reference_id?.trim()) {
    console.log(LOG_PREFIX, 'Using client_reference_id', session.client_reference_id);
    return session.client_reference_id.trim();
  }

  const fromMetadata = resolveOrgIdFromMetadata(session.metadata);
  if (fromMetadata) {
    console.log(LOG_PREFIX, 'Using session.metadata.organization_id', fromMetadata);
    return fromMetadata;
  }

  const email = session.customer_email ?? session.customer_details?.email;
  if (email) {
    const orgId = await findOrgIdByEmail(email);
    if (orgId) return orgId;
  }

  console.error(LOG_PREFIX, 'Could not resolve organization for checkout session', session.id);
  return null;
}

async function resolveOrgIdFromSubscription(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  console.log(LOG_PREFIX, 'Resolving org from subscription', {
    subscriptionId: subscription.id,
    metadata: subscription.metadata,
    customerId: extractCustomerId(subscription.customer),
  });

  const fromMetadata = resolveOrgIdFromMetadata(subscription.metadata);
  if (fromMetadata) {
    console.log(LOG_PREFIX, 'Using subscription.metadata.organization_id', fromMetadata);
    return fromMetadata;
  }

  const customerId = extractCustomerId(subscription.customer);
  if (customerId) {
    const orgId = await findOrgIdByCustomerId(customerId);
    if (orgId) {
      console.log(LOG_PREFIX, 'Resolved org via stripe_customer_id', { customerId, orgId });
      return orgId;
    }
  }

  return null;
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const orgId = await resolveOrgIdFromCheckoutSession(session);

  if (!orgId) {
    console.error(LOG_PREFIX, 'checkout.session.completed missing org reference', session.id);
    return;
  }

  await activateOrganization(orgId, extractCustomerId(session.customer));
}

async function handleSubscriptionActivated(
  subscription: Stripe.Subscription,
  source: string,
): Promise<void> {
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    console.log(LOG_PREFIX, `Skipping ${source} — subscription not active`, subscription.status);
    return;
  }

  const orgId = await resolveOrgIdFromSubscription(subscription);
  if (!orgId) {
    console.error(LOG_PREFIX, `${source} could not resolve organization`, subscription.id);
    return;
  }

  await activateOrganization(orgId, extractCustomerId(subscription.customer));
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const invoiceWithLegacy = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };

  if (invoiceWithLegacy.subscription) {
    return typeof invoiceWithLegacy.subscription === 'string'
      ? invoiceWithLegacy.subscription
      : invoiceWithLegacy.subscription.id;
  }

  const parentSubscription = invoice.parent?.subscription_details?.subscription;
  if (parentSubscription) {
    return typeof parentSubscription === 'string' ? parentSubscription : parentSubscription.id;
  }

  return null;
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = getInvoiceSubscriptionId(invoice);

  console.log(LOG_PREFIX, 'invoice.payment_succeeded', {
    invoiceId: invoice.id,
    customerId: extractCustomerId(invoice.customer),
    subscriptionId,
  });

  let orgId = resolveOrgIdFromMetadata(invoice.metadata);

  if (!orgId && subscriptionId) {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    orgId = await resolveOrgIdFromSubscription(subscription);
  }

  if (!orgId && invoice.customer_email) {
    orgId = await findOrgIdByEmail(invoice.customer_email);
  }

  if (!orgId) {
    const customerId = extractCustomerId(invoice.customer);
    if (customerId) {
      orgId = await findOrgIdByCustomerId(customerId);
    }
  }

  if (!orgId) {
    console.error(LOG_PREFIX, 'invoice.payment_succeeded could not resolve organization', invoice.id);
    return;
  }

  await activateOrganization(orgId, extractCustomerId(invoice.customer));
}

export async function handleStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  console.log(LOG_PREFIX, 'Processing event', { type: event.type, id: event.id });

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutSessionCompleted(session);
      break;
    }

    case 'customer.subscription.created': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionActivated(subscription, 'customer.subscription.created');
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaymentSucceeded(invoice);
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
      } else if (subscription.status === 'active' || subscription.status === 'trialing') {
        await handleSubscriptionActivated(subscription, 'customer.subscription.updated');
      }
      break;
    }

    default:
      console.log(LOG_PREFIX, 'Unhandled event type', event.type);
      break;
  }

  console.log(LOG_PREFIX, 'Finished processing event', { type: event.type, id: event.id });
}
