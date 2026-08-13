import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { handleStripeWebhookEvent } from '@/lib/stripe/webhook-handlers';

export const runtime = 'nodejs';

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

  try {
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    console.log('[Stripe Webhook] Received event', { type: event.type, id: event.id });
    await handleStripeWebhookEvent(event);
    console.log('[Stripe Webhook] Successfully handled event', { type: event.type, id: event.id });
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    console.error('[Stripe Webhook] Error', message);
    const status = message.includes('signature') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
