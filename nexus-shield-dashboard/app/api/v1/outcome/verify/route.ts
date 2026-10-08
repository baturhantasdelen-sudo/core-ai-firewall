import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey, extractApiKey } from '@/lib/auth/api-key';
import { buildUarV2OutcomeExtension } from '@/lib/nexus-core/outcome/uar-bridge';
import { runOutcomeVerificationSync, defaultVerificationPlan } from '@/lib/nexus-core/outcome/verifier';
import type { ExpectedOutcome } from '@/lib/nexus-core/outcome/models';

export const runtime = 'nodejs';

const verifySchema = z.object({
  agent_id: z.string().min(1),
  action_id: z.string().min(1),
  expected_outcome: z.object({
    outcome_id: z.string(),
    action_id: z.string(),
    type: z.string(),
    expected_state: z.record(z.string(), z.unknown()),
    constraints: z.any().optional(),
    verification_deadline: z.string().optional(),
    required_evidence: z.array(z.string()).optional(),
  }),
  verification_plan: z
    .object({
      sources: z.array(z.string()),
      required_sources: z.array(z.string()),
      timeout_ms: z.number(),
      polling: z.object({
        strategy: z.enum(['exponential', 'fixed']),
        intervals_ms: z.array(z.number()),
      }),
    })
    .optional(),
  adapter_id: z.enum(['mock', 'generic_http', 'database', 'inline']).default('mock'),
  tool_response: z.object({ status_code: z.number(), body: z.string() }).optional(),
  observed_state_override: z.record(z.string(), z.unknown()).optional(),
  mock_fixture: z.string().optional(),
  resource_id: z.string().optional(),
  blocked_action: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const apiKey = extractApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: 'Unauthorized: Missing API key' }, { status: 401 });
  }
  const org = await authenticateApiKey(apiKey);
  if (!org) {
    return NextResponse.json({ error: 'Unauthorized: Invalid API key' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const result = runOutcomeVerificationSync({
    agent_id: data.agent_id,
    action_id: data.action_id,
    expected_outcome: data.expected_outcome as ExpectedOutcome,
    verification_plan: data.verification_plan ?? defaultVerificationPlan(),
    adapter_id: data.adapter_id,
    tool_response: data.tool_response,
    observed_state_override: data.observed_state_override,
    mock_fixture: data.mock_fixture,
    resource_id: data.resource_id,
    blocked_action: data.blocked_action,
  });

  const uar_extension = buildUarV2OutcomeExtension(result);

  return NextResponse.json({
    verification: result,
    verification_status: result.status,
    evidence_ids: result.evidence.map((e) => e.evidence_id),
    outcome_diff: result.diff,
    uar_v2_outcome: uar_extension,
  });
}
