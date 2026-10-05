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
  runEvidenceEngine,
  runRiskEngine,
  runTransactionVerificationEngine,
} from '@/lib/nexus-core/engines';
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

/** Orchestrates all seven Nexus Shield core engines for a single action evaluation. */
export function runSevenEnginePipeline(req: VerifyActionRequest): SevenEnginePipelineResult {
  const started = performance.now();
  const authority = req.authority;
  const { snapshot, asset } = runAgentDiscoveryEngine(req);
  const authorityReport = runAuthorityEngine(asset, authority);
  const actionVerification = runActionVerificationEngine(req.userIntent, req.toolCall);
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
  if (transactionVerification.falseSuccessSuspected) {
    violations.push('Transaction verification: false success / ghost action suspected');
  }
  if (policyEvaluation && !policyEvaluation.allowed) {
    violations.push(`Policy-as-code: ${policyEvaluation.reason ?? 'denied'}`);
  }

  let decision = runRiskEngine(
    firewall,
    transactionVerification,
    policyEvaluation?.requiresApproval,
  );

  if (policyEvaluation && !policyEvaluation.allowed) {
    decision = 'BLOCK';
  }

  const evidence = runEvidenceEngine(req, policy ?? {}, decision);

  return {
    decision,
    firewall,
    discovery: snapshot,
    authority: authorityReport,
    actionVerification,
    transactionVerification,
    policyEvaluation,
    evidence,
    violations,
    capabilitiesRevoked: firewall.capabilitiesRevoked ?? false,
    latencyMs: Math.round((performance.now() - started) * 100) / 100,
  };
}
