import { createHash, randomBytes } from 'node:crypto';
import type { AgentAsset, AgentCapability } from '@/lib/engine/discovery';
import {
  detectEffectiveAuthority,
  type EffectiveAuthorityReport,
} from '@/lib/engine/agents/effective-authority';
import { analyzeIntentDivergence } from '@/lib/engine/action-firewall/intent-engine';
import { verifyActionOutcome } from '@/lib/engine/evidence/evidential-verifier';
import { computeActionProofBundle } from '@/lib/accountability/action-proof';
import type {
  EngineActionVerification,
  EngineDiscoverySnapshot,
  EngineEvidenceSeal,
  EngineTransactionVerification,
  NexusRiskDecision,
  VerifyActionRequest,
} from '@/lib/nexus-core/types';
import type { ActionEvaluationResult } from '@/lib/engine/action-firewall';

const CAPABILITY_SET = new Set<string>([
  'READ',
  'WRITE',
  'EXECUTE',
  'FINANCIAL',
  'WEB_SEARCH',
  'API_CALL',
  'DB_QUERY',
]);

function toCapabilities(authority: string[]): AgentCapability[] {
  const normalized = authority.map((a) => a.toUpperCase());
  const caps = normalized.filter((a): a is AgentCapability => CAPABILITY_SET.has(a));
  return caps.length > 0 ? caps : ['API_CALL'];
}

/** Agent Discovery Engine — catalog agent scopes and MCP tools for this evaluation. */
export function runAgentDiscoveryEngine(req: VerifyActionRequest): {
  snapshot: EngineDiscoverySnapshot;
  asset: AgentAsset;
} {
  const mcpTools = req.mcpTools ?? [req.toolCall.name];
  const scopes = req.authority.length > 0 ? req.authority : ['API_CALL'];
  const asset: AgentAsset = {
    id: req.agentId,
    name: req.agentId,
    framework: 'MCP',
    mcpConnections: [{ serverName: 'runtime', tools: mcpTools }],
    capabilities: toCapabilities(scopes),
    riskLevel: scopes.some((s) => /FINANCIAL|DB|DELETE/i.test(s)) ? 'HIGH' : 'MEDIUM',
    sourceFile: 'runtime://evaluate',
  };

  return {
    snapshot: {
      agentId: req.agentId,
      cataloged: true,
      scopes,
      mcpTools,
      framework: asset.framework,
    },
    asset,
  };
}

/** Authority Engine — effective capability boundaries vs declared authority. */
export function runAuthorityEngine(asset: AgentAsset, authority: string[]): EffectiveAuthorityReport {
  const declared = authority.join(' ');
  const syntheticContent = `
    agent scopes: ${declared}
    oauth scope="${declared}"
    mcp tools: ${asset.mcpConnections.map((c) => c.tools.join(',')).join(';')}
  `;
  return detectEffectiveAuthority(asset, syntheticContent);
}

/** Intent + Action Verification engines — divergence between intent and tool call. */
export function runActionVerificationEngine(
  userIntent: string,
  toolCall: VerifyActionRequest['toolCall'],
): EngineActionVerification {
  const report = analyzeIntentDivergence(userIntent, [{ tool: toolCall.name, args: toolCall.args }]);
  const mismatchPercent = Math.round(100 - report.intentMatchScore);
  return {
    intentMatchScore: report.intentMatchScore,
    divergenceScore: report.divergenceScore,
    mismatchPercent,
    report,
  };
}

/** Transaction Verification Engine — false success / ghost action detection. */
export function runTransactionVerificationEngine(req: VerifyActionRequest): EngineTransactionVerification {
  const outcome = verifyActionOutcome(
    {
      toolName: req.toolCall.name,
      agentId: req.agentId,
      args: req.toolCall.args,
    },
    req.evidenceBundle,
  );

  const apiSuccess =
    req.apiResult !== undefined &&
    req.apiResult.status_code >= 200 &&
    req.apiResult.status_code < 300 &&
    /success|ok|completed|true/i.test(req.apiResult.body);

  let stateDeltaVerified = true;
  if (req.stateBefore !== undefined && req.stateAfter !== undefined) {
    const before = createHash('sha256').update(JSON.stringify(req.stateBefore)).digest('hex');
    const after = createHash('sha256').update(JSON.stringify(req.stateAfter)).digest('hex');
    stateDeltaVerified = before !== after;
  }

  const ghostActionSuspected =
    apiSuccess && req.stateBefore !== undefined && req.stateAfter !== undefined && !stateDeltaVerified;

  const falseSuccessSuspected =
    ghostActionSuspected ||
    (apiSuccess && outcome.verificationStatus === 'UNVERIFIED') ||
    (apiSuccess && outcome.missingProofs.length > 0);

  return {
    outcome,
    ghostActionSuspected,
    falseSuccessSuspected,
    stateDeltaVerified,
  };
}

/** Risk Engine — consolidate firewall + transaction signals into BLOCK | ALLOW | REQUIRE_APPROVAL. */
export function runRiskEngine(
  firewall: ActionEvaluationResult,
  transaction: EngineTransactionVerification,
  policyRequiresApproval?: boolean,
): NexusRiskDecision {
  if (transaction.falseSuccessSuspected || transaction.ghostActionSuspected) {
    return 'BLOCK';
  }
  if (firewall.decision === 'BLOCK') return 'BLOCK';
  if (firewall.decision === 'HUMAN_APPROVAL_REQUIRED' || policyRequiresApproval) {
    return 'REQUIRE_APPROVAL';
  }
  return 'ALLOW';
}

/** Evidence Engine — UAR v2 action proof + Ed25519-style seal (deterministic demo signature). */
export function runEvidenceEngine(
  req: VerifyActionRequest,
  policyDocument: unknown,
  decision: NexusRiskDecision,
): EngineEvidenceSeal {
  const transactionId = req.transactionId ?? req.evidenceBundle?.transactionId ?? `TXN-${req.agentId}-${Date.now()}`;
  const actionProof = computeActionProofBundle({
    intent: req.userIntent,
    policyDocument,
    toolCall: req.toolCall,
    transactionId,
    result: {
      decision,
      tool: req.toolCall.name,
      args: req.toolCall.args,
    },
  });

  const evidenceHash = actionProof.actionProofHash;
  const sigMaterial = createHash('sha256')
    .update(`${evidenceHash}:${req.agentId}:${decision}`)
    .digest('hex');
  const signature = `sig_nexus_ed25519_${sigMaterial.slice(0, 48)}`;

  return {
    actionProof,
    evidenceHash,
    signature,
    receiptId: `aar_${randomBytes(12).toString('hex')}`,
  };
}
