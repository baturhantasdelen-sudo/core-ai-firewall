import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { BillingInterval } from '@/config/pricing';
import { createProCheckoutSession } from '@/lib/stripe/create-checkout-session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthContext } from '@/lib/auth/session';
import { getSiteUrl } from '@/lib/site';

export const runtime = 'nodejs';

const checkoutRequestSchema = z.object({
  org_id: z.string().uuid().optional(),
  billing_interval: z.enum(['month', 'year']).default('month'),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = checkoutRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { billing_interval: billingInterval } = parsed.data;
    const orgId = auth.org.id;

    if (parsed.data.org_id && parsed.data.org_id !== orgId) {
      return NextResponse.json({ error: 'Forbidden organization access' }, { status: 403 });
    }

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
      appUrl: getSiteUrl(req.nextUrl.origin),
    });

    return NextResponse.json({ url: session.url, session_id: session.id }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
