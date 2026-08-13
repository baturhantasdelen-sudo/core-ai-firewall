import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { handleStripeWebhookEvent } from '@/lib/stripe/webhook-handlers';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    console.error('[Stripe Webhook Error] Missing STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Missing STRIPE_WEBHOOK_SECRET' }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    console.error('[Stripe Webhook Error] Missing stripe-signature header');
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signature verification failed';
    console.error('[Stripe Webhook Error] Signature failure:', message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 },
    );
  }

  console.log('[Stripe Webhook] Received event', { type: event.type, id: event.id });

  try {
    await handleStripeWebhookEvent(event);
    console.log('[Stripe Webhook] Successfully handled event', { type: event.type, id: event.id });
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook handler failed';
    console.error('[Stripe Webhook Error] Handler failure:', message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
