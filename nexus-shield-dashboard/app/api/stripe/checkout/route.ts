import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getStripe, PRO_PLAN_PRICE_USD } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

const checkoutRequestSchema = z.object({
  org_id: z.string().uuid('org_id must be a valid UUID'),
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

    const { org_id: orgId } = parsed.data;

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

    const stripe = getStripe();
    const appUrl = getAppUrl(req);
    const proPriceId = process.env.STRIPE_PRO_PRICE_ID;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      client_reference_id: orgId,
      customer: org.stripe_customer_id ?? undefined,
      line_items: [
        proPriceId
          ? { price: proPriceId, quantity: 1 }
          : {
              quantity: 1,
              price_data: {
                currency: 'usd',
                product_data: {
                  name: 'Nexus Shield Pro',
                  description: 'Unlimited scans, centralized dashboard, custom regex, priority support.',
                },
                unit_amount: PRO_PLAN_PRICE_USD * 100,
                recurring: { interval: 'month' },
              },
            },
      ],
      success_url: `${appUrl}/dashboard?payment=success`,
      cancel_url: `${appUrl}/pricing?payment=cancelled`,
    });

    return NextResponse.json({ url: session.url, session_id: session.id }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
