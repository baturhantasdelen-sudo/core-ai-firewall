import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { BillingInterval } from '@/config/pricing';
import { createProCheckoutSession } from '@/lib/stripe/create-checkout-session';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

const checkoutRequestSchema = z.object({
  org_id: z.string().uuid('org_id must be a valid UUID'),
  billing_interval: z.enum(['month', 'year']).default('month'),
});

function getAppUrl(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = checkoutRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { org_id: orgId, billing_interval: billingInterval } = parsed.data;

    const supabase = getSupabaseAdmin();
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, stripe_customer_id')
      .eq('id', orgId)
      .maybeSingle<{ id: string; stripe_customer_id: string | null }>();

    if (orgError) {
      return NextResponse.json(
        { error: `Failed to look up organization: ${orgError.message}` },
        { status: 500 },
      );
    }

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const session = await createProCheckoutSession({
      orgId,
      customerId: org.stripe_customer_id,
      billingInterval: billingInterval as BillingInterval,
      appUrl: getAppUrl(req),
    });

    return NextResponse.json(
      { url: session.url, session_id: session.id },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
