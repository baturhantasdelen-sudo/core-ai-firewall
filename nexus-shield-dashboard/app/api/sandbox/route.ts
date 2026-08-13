import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  PROMPT_INJECTION_BLOCK_DETAIL,
  quickSecurityScan,
} from '@/lib/engine/injection';
import { sanitizePlaygroundInput } from '@/lib/engine/sanitize';
import type { Profile } from '@/lib/engine/types';
import {
  VISITOR_COOKIE,
  getUsageSnapshot,
  recordSandboxUsage,
  resolveUsageContext,
  usageLimitResponse,
} from '@/lib/usage/quota';

export const runtime = 'nodejs';

const sandboxRequestSchema = z.object({
  user_input: z.string().min(1),
  session_id: z.string().min(1).optional(),
  target_model: z.string().optional(),
  policy: z
    .object({
      profile: z.enum(['TR', 'GLOBAL', 'US']).optional(),
    })
    .passthrough()
    .optional(),
});

function attachVisitorCookie(response: NextResponse, visitorId: string, shouldSet: boolean) {
  if (shouldSet) {
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }
}

export async function POST(req: NextRequest) {
  const { org, visitorId, setVisitorCookie } = await resolveUsageContext(req);

  const snapshot = await getUsageSnapshot(org, org ? null : visitorId);
  if (!snapshot.allowed) {
    const res = NextResponse.json(usageLimitResponse(snapshot), { status: 403 });
    attachVisitorCookie(res, visitorId, setVisitorCookie);
    return res;
  }

  let payload: z.infer<typeof sandboxRequestSchema>;
  try {
    const body = await req.json();
    const parsed = sandboxRequestSchema.safeParse(body);
    if (!parsed.success) {
      const res = NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
      attachVisitorCookie(res, visitorId, setVisitorCookie);
      return res;
    }
    payload = parsed.data;
  } catch {
    const res = NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    attachVisitorCookie(res, visitorId, setVisitorCookie);
    return res;
  }

  const started = performance.now();
  const userInput = payload.user_input;
  const profile = (payload.policy?.profile ?? 'TR') as Profile;

  if (quickSecurityScan(userInput)) {
    const latencyMs = performance.now() - started;
    await recordSandboxUsage({
      orgId: org?.id ?? null,
      visitorId,
      status: 'blocked',
      latencyMs,
    });

    const res = NextResponse.json(
      {
        error: PROMPT_INJECTION_BLOCK_DETAIL,
        detail: PROMPT_INJECTION_BLOCK_DETAIL,
        code: 'PROMPT_INJECTION_BLOCKED',
        latency_ms: latencyMs,
      },
      { status: 403 },
    );
    res.headers.set('X-Nexus-Latency-Ms', latencyMs.toFixed(2));
    attachVisitorCookie(res, visitorId, setVisitorCookie);
    return res;
  }

  const sanitizeResult = await sanitizePlaygroundInput(userInput, {
    profile,
    policy: payload.policy ?? { profile: 'TR' },
  });
  const latencyMs = performance.now() - started;

  await recordSandboxUsage({
    orgId: org?.id ?? null,
    visitorId,
    status: 'passed',
    latencyMs,
  });

  const responseBody = {
    status: sanitizeResult.pii_detected ? 'clean' : 'success',
    redacted_input: sanitizeResult.redacted_input,
    sanitized_prompt: sanitizeResult.sanitized_prompt,
    sanitizedPrompt: sanitizeResult.sanitizedPrompt,
    pii_detected: sanitizeResult.pii_detected,
    masked_types: sanitizeResult.masked_types,
    pii_masked_count: sanitizeResult.pii_masked_count,
    findings: sanitizeResult.findings.map((finding) => ({
      type: finding.type,
      rule_id: finding.ruleId,
      line: finding.line,
      preview: finding.preview,
      category: finding.category,
      validation: finding.validation ?? null,
    })),
    result: sanitizeResult.pii_detected
      ? 'PII redacted — upstream LLM call skipped.'
      : `Processed response: '${sanitizeResult.sanitizedPrompt}' passed clean.`,
    latency_ms: Math.round(latencyMs * 100) / 100,
    engine: 'nexus-shield-modular',
    profile,
  };

  const res = NextResponse.json(responseBody, { status: 200 });
  res.headers.set('X-Nexus-Latency-Ms', latencyMs.toFixed(2));
  attachVisitorCookie(res, visitorId, setVisitorCookie);
  return res;
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/sandbox',
    method: 'POST',
    auth: 'none (visitor quota)',
    body: {
      user_input: 'Sample prompt text',
      session_id: 'playground-demo',
      policy: { profile: 'TR' },
    },
    response: {
      sanitized_prompt: 'Masked text forwarded to LLM',
      pii_masked_count: 2,
      masked_types: ['TCKN', 'Credit Card'],
    },
  });
}
