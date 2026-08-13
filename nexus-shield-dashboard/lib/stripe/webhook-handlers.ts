import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase';
import { PLAN_SCAN_LIMITS } from '@/config/plans';

const LOG_PREFIX = '[Stripe Webhook]';
const DB_ERROR_PREFIX = '[Stripe Webhook DB Error]:';

/** Matches `schema.sql` — organizations table columns */
const ORG_UPDATE_FIELDS = {
  stripe_subscription_status: 'active' as const,
  monthly_scan_limit: PLAN_SCAN_LIMITS.pro,
};

function logDbError(context: string, error: unknown) {
  console.error(DB_ERROR_PREFIX, context, error);
}

function resolveOrgIdFromMetadata(metadata: Stripe.Metadata | null | undefined): string | null {
  if (!metadata) return null;
  return metadata.organization_id?.trim() ?? metadata.org_id?.trim() ?? null;
}

function resolveEmailFromSession(session: Stripe.Checkout.Session): string | null {
  const email = session.customer_details?.email ?? session.customer_email;
  return email?.trim().toLowerCase() ?? null;
}

export async function activateOrganization(orgId: string, customerId: string | null) {
  console.log(LOG_PREFIX, 'Activating organization', { orgId, customerId });

  const supabase = getSupabaseAdmin();

  const { data: existing, error: lookupError } = await supabase
    .from('organizations')
    .select('id, stripe_subscription_status, monthly_scan_limit, stripe_customer_id')
    .eq('id', orgId)
    .maybeSingle();

  if (lookupError) {
    logDbError('Pre-activation lookup failed', { orgId, lookupError });
    throw new Error(`Failed to lookup organization ${orgId}: ${lookupError.message}`);
  }

  if (!existing) {
    logDbError('No organization row found before update', { orgId });
    throw new Error(`Organization ${orgId} not found during activation`);
  }

  console.log(LOG_PREFIX, 'Organization found before activation', existing);

  const { data, error } = await supabase
    .from('organizations')
    .update({
      stripe_subscription_status: ORG_UPDATE_FIELDS.stripe_subscription_status,
      monthly_scan_limit: ORG_UPDATE_FIELDS.monthly_scan_limit,
      ...(customerId ? { stripe_customer_id: customerId } : {}),
    })
    .eq('id', orgId)
    .select('id, stripe_subscription_status, monthly_scan_limit, stripe_customer_id')
    .maybeSingle();

  if (error) {
    logDbError('Organization activation update failed', { orgId, customerId, error });
    throw new Error(`Failed to activate organization ${orgId}: ${error.message}`);
  }

  if (!data) {
    logDbError('Update returned no rows — organization may not exist or RLS blocked write', {
      orgId,
      customerId,
    });
    throw new Error(`Organization ${orgId} was not updated (0 rows affected)`);
  }

  console.log(LOG_PREFIX, 'Organization activated', data);
}

export async function downgradeOrganizationByCustomerId(customerId: string) {
  console.log(LOG_PREFIX, 'Downgrading organization for customer', customerId);

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('organizations')
    .update({
      stripe_subscription_status: 'free',
      monthly_scan_limit: PLAN_SCAN_LIMITS.free,
    })
    .eq('stripe_customer_id', customerId)
    .select('id, stripe_subscription_status, monthly_scan_limit, stripe_customer_id');

  if (error) {
    logDbError('Organization downgrade failed', { customerId, error });
    throw new Error(`Failed to downgrade organization for customer ${customerId}: ${error.message}`);
  }

  if (!data?.length) {
    logDbError('Downgrade returned no rows', { customerId });
  } else {
    console.log(LOG_PREFIX, 'Organization downgraded', data);
  }
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
    logDbError('Customer ID lookup failed', { customerId, error });
    return null;
  }

  return data?.id ?? null;
}

async function findOrgIdByEmail(email: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();
  console.log(LOG_PREFIX, 'Email fallback — resolving org via auth.users → org_members', {
    email: normalizedEmail,
  });

  const supabase = getSupabaseAdmin();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data: usersData, error: userError } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (userError) {
      logDbError('auth.users listUsers failed during email fallback', { email: normalizedEmail, userError });
      return null;
    }

    const authUser = usersData.users.find(
      (user) => user.email?.trim().toLowerCase() === normalizedEmail,
    );

    if (authUser) {
      console.log(LOG_PREFIX, 'Email fallback — matched auth user', {
        email: normalizedEmail,
        userId: authUser.id,
      });

      const { data: membership, error: memberError } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', authUser.id)
        .maybeSingle<{ org_id: string }>();

      if (memberError) {
        logDbError('org_members lookup failed during email fallback', {
          email: normalizedEmail,
          userId: authUser.id,
          memberError,
        });
        return null;
      }

      if (!membership?.org_id) {
        logDbError('No org_members row for auth user during email fallback', {
          email: normalizedEmail,
          userId: authUser.id,
        });
        return null;
      }

      console.log(LOG_PREFIX, 'Email fallback — resolved organization', {
        email: normalizedEmail,
        orgId: membership.org_id,
      });
      return membership.org_id;
    }

    if (usersData.users.length < perPage) {
      console.log(LOG_PREFIX, 'Email fallback — no auth user found', { email: normalizedEmail });
      return null;
    }

    page += 1;
  }
}

async function resolveOrgIdFromCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<string | null> {
  const resolvedEmail = resolveEmailFromSession(session);

  console.log(LOG_PREFIX, 'Resolving org from checkout session', {
    sessionId: session.id,
    clientReferenceId: session.client_reference_id,
    metadata: session.metadata,
    customerEmail: resolvedEmail,
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

  if (resolvedEmail) {
    const orgId = await findOrgIdByEmail(resolvedEmail);
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
  try {
    await activateFromCheckoutSession(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Activation failed';
    console.error(LOG_PREFIX, 'checkout.session.completed activation failed', message, error);
  }
}

export async function activateFromCheckoutSession(
  session: Stripe.Checkout.Session,
  expectedOrgId?: string,
): Promise<{ orgId: string; activated: true }> {
  if (session.mode !== 'subscription') {
    throw new Error(`Invalid checkout session mode: ${session.mode}`);
  }

  if (session.status !== 'complete') {
    throw new Error(`Checkout session is not complete (status: ${session.status ?? 'unknown'})`);
  }

  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    throw new Error(`Payment not completed (payment_status: ${session.payment_status ?? 'unknown'})`);
  }

  const orgId = await resolveOrgIdFromCheckoutSession(session);

  if (!orgId) {
    throw new Error('Could not resolve organization from checkout session');
  }

  if (expectedOrgId && orgId !== expectedOrgId) {
    throw new Error('Checkout session does not belong to this organization');
  }

  await activateOrganization(orgId, extractCustomerId(session.customer));
  return { orgId, activated: true };
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
    customerEmail: invoice.customer_email,
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
