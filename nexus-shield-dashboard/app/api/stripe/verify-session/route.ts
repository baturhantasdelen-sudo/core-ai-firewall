import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getStripe } from '@/lib/stripe';
import { getAuthContext } from '@/lib/auth/session';
import { activateFromCheckoutSession } from '@/lib/stripe/webhook-handlers';

export const runtime = 'nodejs';

const verifySessionSchema = z.object({
  session_id: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const logPrefix = '[Stripe Verify Session]';

  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = verifySessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { session_id: sessionId } = parsed.data;
    console.log(logPrefix, 'Verifying checkout session', {
      sessionId,
      orgId: auth.org.id,
      userId: auth.userId,
    });

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    console.log(logPrefix, 'Retrieved session from Stripe', {
      sessionId: session.id,
      status: session.status,
      paymentStatus: session.payment_status,
      mode: session.mode,
      clientReferenceId: session.client_reference_id,
      metadata: session.metadata,
    });

    const result = await activateFromCheckoutSession(session, auth.org.id);

    console.log(logPrefix, 'Organization activated via client fallback', result);

    return NextResponse.json(
      {
        success: true,
        orgId: result.orgId,
        plan: 'pro',
        message: 'Subscription verified and organization activated',
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Session verification failed';
    console.error(logPrefix, 'Verification failed', message, error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
