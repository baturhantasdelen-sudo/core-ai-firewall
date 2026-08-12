import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { verifyGithubSignature } from '@/lib/github/verify-signature';
import {
  handleGithubPushEvent,
  handleGithubPullRequestEvent,
  GithubPushPayload,
  GithubPullRequestPayload,
} from '@/lib/services/github-scanner';

export const runtime = 'nodejs';

// Webhook handler returns 200 immediately; `after()` continues the scan in the
// same serverless invocation. Vercel Pro allows up to 60s (300s on Enterprise).
export const maxDuration = 60;

const HANDLED_PULL_REQUEST_ACTIONS = new Set(['opened', 'synchronize']);

function logBackgroundError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[github-webhook] ${context} failed: ${message}`);
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: 'Missing GITHUB_WEBHOOK_SECRET' }, { status: 500 });
  }

  // Signature verification requires the exact raw bytes GitHub signed, so we
  // must read the body as text before any JSON parsing occurs.
  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256');

  if (!verifyGithubSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  const eventName = req.headers.get('x-github-event');

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (eventName === 'ping') {
    return NextResponse.json({ pong: true }, { status: 200 });
  }

  if (eventName === 'push') {
    const pushPayload = payload as unknown as GithubPushPayload;

    // Schedule the scan to run after the response is flushed so GitHub gets
    // a fast 200 OK instead of timing out while we fetch diffs and scan them.
    after(() => handleGithubPushEvent(pushPayload).catch((error) => logBackgroundError('push scan', error)));

    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (eventName === 'pull_request') {
    const prPayload = payload as unknown as GithubPullRequestPayload;

    if (!HANDLED_PULL_REQUEST_ACTIONS.has(prPayload.action)) {
      return NextResponse.json({ ignored: true, action: prPayload.action }, { status: 200 });
    }

    after(() =>
      handleGithubPullRequestEvent(prPayload).catch((error) => logBackgroundError('pull_request scan', error)),
    );

    return NextResponse.json({ received: true }, { status: 200 });
  }

  return NextResponse.json({ ignored: true, event: eventName }, { status: 200 });
}
