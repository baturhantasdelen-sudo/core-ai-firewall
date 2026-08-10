import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getStripe } from '@/lib/stripe';
import { getOrganizationById } from '@/lib/org-metrics';

export const runtime = 'nodejs';

const portalRequestSchema = z.object({
  org_id: z.string().uuid('org_id must be a valid UUID'),
});

function getAppUrl(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = portalRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { org_id: orgId } = parsed.data;

    const org = await getOrganizationById(orgId);

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    if (!org.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Bu organizasyonun aktif bir Stripe müşteri kaydı yok. Önce Pro plana yükseltin.' },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const appUrl = getAppUrl(req);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${appUrl}/dashboard/settings`,
    });

    return NextResponse.json({ url: portalSession.url }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
