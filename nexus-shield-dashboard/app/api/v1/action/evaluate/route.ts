import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey, extractApiKey } from '@/lib/auth/api-key';
import { runSevenEnginePipeline } from '@/lib/nexus-core/pipeline';
import { evaluateAdaptivePolicy } from '@/lib/engine/agent-policy-engine';
import { NEXUS_RUNTIME_LATENCY_METRIC } from '@/lib/brand/copy-standards';
import {
  classifyOwaspThreat,
  inferThreatCategory,
  OWASP_STANDARDS_ALIGNMENT,
  RUNTIME_PRIVACY_METADATA,
} from '@/lib/owasp/threat-mapping';

export const runtime = 'nodejs';

const evaluateSchema = z.object({
  agent_id: z.string().min(1),
  user_intent: z.string().min(1),
  tool_call: z.object({
    name: z.string().min(1),
    args: z.record(z.string(), z.unknown()).default({}),
  }),
  agent_capabilities: z.array(z.string()).default([]),
  /** Alias for agent_capabilities — effective permission boundary. */
  authority: z.array(z.string()).optional(),
  policy_yaml: z.string().optional(),
  work_graph_node_id: z.string().optional(),
  transaction_id: z.string().optional(),
  evidence_bundle: z
    .object({
      transactionId: z.string().optional(),
      bankApiResponse: z.string().optional(),
      databaseRecordHash: z.string().optional(),
      executionLog: z.string().optional(),
      authorizedAgentSignature: z.string().optional(),
    })
    .optional(),
  state_before: z.record(z.string(), z.unknown()).optional(),
  state_after: z.record(z.string(), z.unknown()).optional(),
  api_result: z
    .object({
      status_code: z.number(),
      body: z.string(),
    })
    .optional(),
  outcome_adapter: z
    .enum(['SAP', 'SALESFORCE', 'HUBSPOT', 'DATABASE', 'AWS_IAM', 'INLINE_STATE'])
    .optional(),
  parent_agent_id: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing x-api-key or x-nexus-api-key header' },
        { status: 401 },
      );
    }

    const org = await authenticateApiKey(apiKey);
    if (!org) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API key' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = evaluateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const {
      agent_id,
      user_intent,
      tool_call,
      agent_capabilities,
      authority,
      policy_yaml,
      work_graph_node_id,
      transaction_id,
      evidence_bundle,
      state_before,
      state_after,
      api_result,
      outcome_adapter,
      parent_agent_id,
    } = parsed.data;

    const effectiveAuthority =
      authority && authority.length > 0 ? authority : agent_capabilities;

    const pipeline = runSevenEnginePipeline({
      agentId: agent_id,
      userIntent: user_intent,
      toolCall: {
        name: tool_call.name,
        args: tool_call.args,
      },
      authority: effectiveAuthority,
      policyYaml: policy_yaml,
      workGraphNodeId: work_graph_node_id,
      transactionId: transaction_id,
      evidenceBundle: evidence_bundle,
      stateBefore: state_before,
      stateAfter: state_after,
      apiResult: api_result,
      outcomeAdapter: outcome_adapter,
      parentAgentId: parent_agent_id,
    });

    const result = pipeline.firewall;

    const statusCode =
      pipeline.decision === 'BLOCK'
        ? 403
        : pipeline.decision === 'REQUIRE_APPROVAL'
          ? 202
          : 200;

    const policy = evaluateAdaptivePolicy(
      {
        agentId: agent_id,
        userIntent: user_intent,
        toolName: tool_call.name,
        toolArgs: tool_call.args,
      },
      result,
    );

    const threatCategory = inferThreatCategory(pipeline.violations, tool_call.name);

    return NextResponse.json(
      {
        success: pipeline.decision !== 'BLOCK',
        decision: pipeline.decision,
        firewall_decision: result.decision,
        governance_decision: policy.decision,
        universal_action_receipt: policy.receipt,
        evidence_bundle_hash: policy.receipt.evidence_bundle_hash,
        runtime_latency_benchmark: NEXUS_RUNTIME_LATENCY_METRIC,
        risk_score: result.riskScore,
        intent_match_score: result.intentMatchScore,
        intent_divergence_percent: pipeline.actionVerification.mismatchPercent,
        agent_status: pipeline.agentStatus ?? result.agentStatus ?? 'ACTIVE',
        capabilities_revoked: pipeline.capabilitiesRevoked,
        human_in_the_loop: pipeline.containment.humanInTheLoop,
        uar_v2_receipt: pipeline.uarReceipt,
        violations: pipeline.violations,
        kill_switch_triggered: result.killSwitchTriggered,
        latency_ms: pipeline.latencyMs,
        engines: {
          discovery: pipeline.discovery,
          authority: {
            privilege_escalation: pipeline.authority.privilegeEscalationDetected,
            effective_scopes: pipeline.authority.effectiveScopes,
            risk_score: pipeline.authority.riskScore,
          },
          action_verification: {
            divergence_score: pipeline.actionVerification.divergenceScore,
            mismatch_percent: pipeline.actionVerification.mismatchPercent,
          },
          outcome_verification: {
            status: pipeline.outcomeVerification.status,
            divergence_reason: pipeline.outcomeVerification.divergence_reason,
            adapter_system: pipeline.outcomeVerification.adapter_system,
            false_success_detected: pipeline.outcomeVerification.false_success_detected,
            actual_state: pipeline.outcomeVerification.actual,
          },
          transaction_verification: pipeline.transactionVerification,
          evidence: {
            receipt_id: pipeline.evidence.receiptId,
            action_proof: pipeline.evidence.actionProof,
            evidence_hash: pipeline.evidence.evidenceHash,
            signature: pipeline.evidence.signature,
            binding_valid:
              pipeline.evidence.evidenceHash === pipeline.evidence.actionProof.actionProofHash,
          },
          containment: pipeline.containment,
          policy: pipeline.policyEvaluation,
        },
        owasp_classification: classifyOwaspThreat(threatCategory, pipeline.violations),
        standards_alignment: OWASP_STANDARDS_ALIGNMENT,
        runtime_privacy: RUNTIME_PRIVACY_METADATA,
      },
      { status: statusCode },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[action/evaluate] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/v1/action/evaluate',
    method: 'POST',
    auth: 'x-api-key or x-nexus-api-key',
    body: {
      agent_id: 'crewai-ops-agent-1',
      user_intent: 'Invoice Check for customer #4421',
      tool_call: { name: 'read_invoice', args: { customer_id: '4421' } },
      agent_capabilities: ['READ', 'API_CALL'],
      authority: ['READ', 'API_CALL'],
      policy_yaml: 'agent: finance-agent\nallowed_intents:\n  - READ_INVOICE',
      transaction_id: 'TXN-8291',
    },
    responses: {
      200: 'ALLOW',
      202: 'REQUIRE_APPROVAL',
      403: 'BLOCK',
    },
    engines: [
      'discovery',
      'authority',
      'intent',
      'action_verification',
      'risk',
      'transaction_verification',
      'evidence',
    ],
  });
}
