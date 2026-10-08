import { evaluateAgentAction } from '@/lib/engine/action-firewall';
import {
  evaluatePolicyGate,
  parseEnterprisePolicyDocument,
} from '@/lib/policy-as-code/parser';
import { isIntentAllowedInWorkGraph } from '@/lib/policy-as-code/workgraph';
import type { EnterpriseAgentPolicy } from '@/lib/policy-as-code/types';
import {
  runActionVerificationEngine,
  runAgentDiscoveryEngine,
  runAuthorityEngine,
  runRiskEngine,
  runTransactionVerificationEngine,
} from '@/lib/nexus-core/engines';
import { runOutcomeVerificationEngine } from '@/lib/nexus-core/outcome-verification';
import { buildUarV2Receipt, runEvidenceEngine } from '@/lib/nexus-core/evidence';
import { applyAutonomousContainment } from '@/lib/nexus-core/containment';
import { buildUar20Receipt } from '@/lib/nexus-core/uar/builder';
import { persistUar20Proof } from '@/lib/nexus-core/proof/store';
import type { SevenEnginePipelineResult, VerifyActionRequest } from '@/lib/nexus-core/types';

export type { VerifyActionRequest, SevenEnginePipelineResult, NexusRiskDecision } from '@/lib/nexus-core/types';

function resolvePolicy(req: VerifyActionRequest): EnterpriseAgentPolicy | undefined {
  if (req.policy) return req.policy;
  if (req.policyYaml?.trim()) {
    return parseEnterprisePolicyDocument(req.policyYaml);
  }
  return undefined;
}

function extractPaymentAmount(args: Record<string, unknown>): number | undefined {
  for (const key of ['amount', 'payment_amount', 'total', 'value']) {
    const raw = args[key];
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const parsed = Number.parseFloat(raw.replace(/[$,]/g, ''));
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return undefined;
}

/** Orchestrates Nexus Shield core engines including Outcome Verification Motor. */
export function runSevenEnginePipeline(req: VerifyActionRequest): SevenEnginePipelineResult {
  const started = performance.now();
  const authority = req.authority;
  const { snapshot, asset } = runAgentDiscoveryEngine(req);
  const authorityReport = runAuthorityEngine(asset, authority);
  const actionVerification = runActionVerificationEngine(req.userIntent, req.toolCall);
  const outcomeVerification = runOutcomeVerificationEngine(req);
  const policy = resolvePolicy(req);

  const parsedIntent = req.userIntent.toUpperCase().replace(/\s+/g, '_');
  let policyEvaluation: SevenEnginePipelineResult['policyEvaluation'];

  if (policy) {
    policyEvaluation = evaluatePolicyGate(
      policy,
      parsedIntent,
      req.toolCall.name,
      extractPaymentAmount(req.toolCall.args),
    );

    if (req.workGraphNodeId && policy.workgraph) {
      const wgOk = isIntentAllowedInWorkGraph(policy.workgraph, req.workGraphNodeId, parsedIntent);
      if (!wgOk) {
        policyEvaluation = {
          allowed: false,
          requiresApproval: false,
          reason: `workgraph node ${req.workGraphNodeId} disallows intent`,
        };
      }
    }
  }

  const firewall = evaluateAgentAction({
    agentId: req.agentId,
    userIntent: req.userIntent,
    toolCall: req.toolCall,
    agentCapabilities: authority,
    evidence: req.evidenceBundle
      ? {
          erpTransactionId: req.evidenceBundle.transactionId,
          dbModificationHash: req.evidenceBundle.databaseRecordHash,
          signedApiResponse:
            req.evidenceBundle.bankApiResponse ?? req.evidenceBundle.executionLog,
        }
      : undefined,
  });

  const transactionVerification = runTransactionVerificationEngine(req);

  const violations = [...firewall.violations];
  if (authorityReport.privilegeEscalationDetected) {
    violations.push('Authority engine: privilege escalation detected');
  }
  if (outcomeVerification.false_success_detected) {
    violations.push(
      outcomeVerification.divergence_reason ??
        'Outcome verification: False Success / Ghost Action detected',
    );
  } else if (outcomeVerification.status === 'UNVERIFIED') {
    violations.push(outcomeVerification.divergence_reason ?? 'Outcome verification: UNVERIFIED');
  }
  if (transactionVerification.falseSuccessSuspected && !outcomeVerification.false_success_detected) {
    violations.push('Transaction verification: false success / ghost action suspected');
  }
  if (policyEvaluation && !policyEvaluation.allowed) {
    violations.push(`Policy-as-code: ${policyEvaluation.reason ?? 'denied'}`);
  }

  let decision = runRiskEngine(
    firewall,
    transactionVerification,
    outcomeVerification,
    policyEvaluation?.requiresApproval,
  );

  if (policyEvaluation && !policyEvaluation.allowed) {
    decision = 'BLOCK';
  }

  const containment = applyAutonomousContainment({
    agentId: req.agentId,
    parentAgentId: req.parentAgentId,
    decision,
    actionVerification,
    outcome: outcomeVerification,
    authority: authorityReport,
  });

  decision = containment.decision;
  violations.push(...containment.reasons);

  const evidence = runEvidenceEngine(req, policy ?? {}, decision, outcomeVerification.status);
  const uarReceipt = buildUarV2Receipt({
    req,
    decision,
    authority: authorityReport,
    outcome: outcomeVerification,
    evidence,
    containment,
  });

  const uar20 = buildUar20Receipt({
    req,
    decision,
    authority: authorityReport,
    outcome: outcomeVerification,
    evidence,
    policyHash: undefined,
  });
  persistUar20Proof(uar20);

  return {
    decision,
    firewall,
    discovery: snapshot,
    authority: authorityReport,
    actionVerification,
    outcomeVerification,
    transactionVerification,
    policyEvaluation,
    evidence,
    containment,
    uarReceipt,
    uar20,
    violations,
    capabilitiesRevoked: containment.capabilitiesRevoked || (firewall.capabilitiesRevoked ?? false),
    agentStatus: containment.agentStatus,
    latencyMs: Math.round((performance.now() - started) * 100) / 100,
  };
}
