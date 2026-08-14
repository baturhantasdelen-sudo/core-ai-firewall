import type { AgentCapability } from '@/lib/engine/discovery';
import {
  checkImmuneNetworkSignatures,
  generateThreatSignature,
  registerThreatSignature,
} from '@/lib/engine/threat-intel/immune-network';
import type { ActionEvidence } from '@/lib/engine/evidence';
import { verifyActionEvidence } from '@/lib/engine/evidence';
import {
  evaluateToolChain,
  getAgentTrajectory,
  recordToolCall,
  resetTrajectory,
} from './trajectory';
import {
  getKillSwitchState,
  getRevokedCapabilities,
  isCapabilityRevoked,
  revokeCapabilities,
  triggerKillSwitch,
} from './kill-switch';
import {
  calculateIntentDivergence,
  inferIntentTags,
  scoreIntentConsistency,
} from './intent-engine';

export type ActionDecision = 'ALLOW' | 'BLOCK' | 'HUMAN_APPROVAL_REQUIRED';

export interface ToolCallInput {
  name: string;
  args: Record<string, unknown>;
}

export interface EvaluateAgentActionInput {
  agentId: string;
  userIntent: string;
  toolCall: ToolCallInput;
  agentCapabilities: string[];
  evidence?: ActionEvidence;
}

export interface ActionEvaluationResult {
  decision: ActionDecision;
  riskScore: number;
  intentMatchScore: number;
  intentDivergencePercent?: number;
  violations: string[];
  killSwitchTriggered: boolean;
  capabilitiesRevoked?: boolean;
  agentStatus?: 'ACTIVE' | 'FROZEN' | 'READ_ONLY';
  latencyMs?: number;
}

const TOOL_CAPABILITY_MAP: Array<{ pattern: RegExp; capability: AgentCapability }> = [
  { pattern: /(?:read|load|fetch|get)_?(?:file|document|content)/i, capability: 'READ' },
  { pattern: /(?:write|save|store|upload)_?(?:file|document|content)/i, capability: 'WRITE' },
  { pattern: /(?:exec|execute|shell|bash|subprocess|run_command|terminal)/i, capability: 'EXECUTE' },
  { pattern: /(?:sql|database|db_query|postgres|mysql|sqlite|bulk_export_db|export_db)/i, capability: 'DB_QUERY' },
  { pattern: /(?:web_search|internet_search|google_search|search_web|browse)/i, capability: 'WEB_SEARCH' },
  { pattern: /(?:payment|stripe|billing|financial|transfer|bank|invoice_pay)/i, capability: 'FINANCIAL' },
  { pattern: /(?:api_call|http_request|fetch_url|rest_api|graphql)/i, capability: 'API_CALL' },
];

const REVOCABLE_SCOPES: AgentCapability[] = ['WRITE', 'EXECUTE', 'FINANCIAL', 'DB_QUERY'];

function normalizeCapabilities(capabilities: string[]): Set<string> {
  return new Set(capabilities.map((capability) => capability.toUpperCase()));
}

function inferToolCapabilities(toolName: string, args: Record<string, unknown>): AgentCapability[] {
  const haystack = `${toolName} ${JSON.stringify(args)}`.toLowerCase();
  const matched = TOOL_CAPABILITY_MAP.filter(({ pattern }) => pattern.test(haystack)).map(
    ({ capability }) => capability,
  );
  return matched.length > 0 ? matched : ['API_CALL'];
}

function validateCapabilities(
  required: AgentCapability[],
  granted: Set<string>,
  agentId: string,
): string[] {
  const violations: string[] = [];
  for (const capability of required) {
    if (isCapabilityRevoked(agentId, capability)) {
      violations.push(`Capability revoked (read-only mode): ${capability}`);
      continue;
    }
    if (!granted.has(capability)) {
      violations.push(`Agent lacks required capability: ${capability}`);
    }
  }
  return violations;
}

function computeRiskScore(
  capabilityViolations: string[],
  intentResult: { intentMatchScore: number; violations: string[]; riskBoost: number },
  divergenceResult: { divergencePercent: number; shouldBlock: boolean },
  requiredCapabilities: AgentCapability[],
): number {
  let riskScore = 0;

  riskScore += capabilityViolations.length * 28;
  riskScore += intentResult.riskBoost;

  if (divergenceResult.shouldBlock) {
    riskScore += 30;
  } else if (divergenceResult.divergencePercent > 50) {
    riskScore += 15;
  }

  if (requiredCapabilities.includes('FINANCIAL')) {
    riskScore += 15;
  }
  if (requiredCapabilities.includes('EXECUTE')) {
    riskScore += 12;
  }
  if (requiredCapabilities.includes('DB_QUERY') && intentResult.intentMatchScore < 50) {
    riskScore += 18;
  }

  if (intentResult.intentMatchScore >= 80 && capabilityViolations.length === 0 && !divergenceResult.shouldBlock) {
    riskScore = Math.min(riskScore, 25);
  }

  return Math.min(100, Math.max(0, riskScore));
}

function resolveDecision(
  riskScore: number,
  violations: string[],
  agentStatus: 'ACTIVE' | 'FROZEN' | 'READ_ONLY',
): ActionDecision {
  if (agentStatus === 'FROZEN') return 'BLOCK';
  if (violations.some((violation) => /Capability revoked/.test(violation))) {
    return 'BLOCK';
  }
  if (riskScore > 85) return 'BLOCK';
  if (riskScore > 60 || violations.length >= 2) return 'HUMAN_APPROVAL_REQUIRED';
  if (violations.length > 0) return 'HUMAN_APPROVAL_REQUIRED';
  return 'ALLOW';
}

function shouldRegisterThreatSignature(riskScore: number, killSwitchTriggered: boolean): boolean {
  return riskScore > 75 || killSwitchTriggered;
}

function selectRevocableScopes(requiredCapabilities: AgentCapability[]): string[] {
  return REVOCABLE_SCOPES.filter((scope) => requiredCapabilities.includes(scope));
}

export function evaluateAgentAction(input: EvaluateAgentActionInput): ActionEvaluationResult {
  const started = performance.now();
  const granted = normalizeCapabilities(input.agentCapabilities);
  const requiredCapabilities = inferToolCapabilities(input.toolCall.name, input.toolCall.args);

  const killSwitchState = getKillSwitchState(input.agentId);
  if (killSwitchState.status === 'FROZEN') {
    return {
      decision: 'BLOCK',
      riskScore: 100,
      intentMatchScore: 0,
      violations: [`Agent is FROZEN by kill switch: ${killSwitchState.reason}`],
      killSwitchTriggered: true,
      agentStatus: 'FROZEN',
      latencyMs: performance.now() - started,
    };
  }

  const capabilityViolations = validateCapabilities(requiredCapabilities, granted, input.agentId);
  const intentResult = scoreIntentConsistency(input.userIntent, input.toolCall);
  const trajectory = getAgentTrajectory(input.agentId);
  const divergenceResult = calculateIntentDivergence(input.userIntent, [
    ...trajectory.map((entry) => entry.toolName),
    input.toolCall.name,
  ]);

  const violatedCapabilities = requiredCapabilities.filter(
    (capability) => !granted.has(capability) || isCapabilityRevoked(input.agentId, capability),
  );

  const immuneMatch = checkImmuneNetworkSignatures({
    userIntent: input.userIntent,
    toolName: input.toolCall.name,
    violatedCapabilities,
  });

  const violations = [
    ...capabilityViolations,
    ...intentResult.violations,
    ...(divergenceResult.shouldBlock && divergenceResult.violation ? [divergenceResult.violation] : []),
    ...(immuneMatch.violation ? [immuneMatch.violation] : []),
  ];

  let riskScore = computeRiskScore(
    capabilityViolations,
    intentResult,
    divergenceResult,
    requiredCapabilities,
  );
  riskScore += immuneMatch.riskBoost;

  const chainEvaluation = evaluateToolChain({
    agentId: input.agentId,
    toolName: input.toolCall.name,
    baseRiskScore: riskScore,
  });

  if (chainEvaluation.matched) {
    riskScore = chainEvaluation.compoundedRiskScore;
    if (chainEvaluation.violation) {
      violations.push(chainEvaluation.violation);
    }
  }

  const evidenceCheck = verifyActionEvidence({
    actionType: 'GENERAL',
    toolName: input.toolCall.name,
    evidence: input.evidence,
  });

  if (!evidenceCheck.verified) {
    violations.push(...evidenceCheck.violations);
    riskScore = Math.min(100, riskScore + 18);
  }

  riskScore = Math.min(100, riskScore);

  recordToolCall(input.agentId, input.toolCall.name, riskScore);

  let killSwitchTriggered = false;
  let capabilitiesRevoked = false;
  let agentStatus: 'ACTIVE' | 'FROZEN' | 'READ_ONLY' = killSwitchState.status;

  const shouldFullFreeze = riskScore > 85 || chainEvaluation.shouldBlock;

  if (shouldFullFreeze) {
    triggerKillSwitch(input.agentId, violations.join('; ') || 'Critical action firewall risk score exceeded');
    killSwitchTriggered = true;
    agentStatus = 'FROZEN';
  } else if (divergenceResult.shouldBlock || (riskScore > 70 && riskScore <= 85)) {
    const scopesToRevoke = selectRevocableScopes(requiredCapabilities);
    if (scopesToRevoke.length > 0) {
      revokeCapabilities(
        input.agentId,
        scopesToRevoke,
        divergenceResult.violation ?? 'Intent-action divergence — read-only mode enforced',
      );
      capabilitiesRevoked = true;
      agentStatus = 'READ_ONLY';
    }
  }

  if (shouldRegisterThreatSignature(riskScore, killSwitchTriggered)) {
    const signature = generateThreatSignature({
      toolSequence: [...trajectory.map((entry) => entry.toolName), input.toolCall.name],
      intentAnomalyTags: inferIntentTags(input.userIntent),
      violatedCapabilities,
      riskScore,
      killSwitchTriggered,
    });
    if (signature) {
      registerThreatSignature(signature);
    }
  }

  return {
    decision: resolveDecision(riskScore, violations, agentStatus),
    riskScore,
    intentMatchScore: intentResult.intentMatchScore,
    intentDivergencePercent: divergenceResult.divergencePercent,
    violations,
    killSwitchTriggered,
    capabilitiesRevoked,
    agentStatus,
    latencyMs: performance.now() - started,
  };
}

export {
  triggerKillSwitch,
  getKillSwitchState,
  resetKillSwitchState,
  revokeCapabilities,
  getRevokedCapabilities,
  listReadOnlyAgents,
} from './kill-switch';
export {
  calculateIntentDivergence,
  inferIntentTags,
  scoreIntentConsistency,
  INTENT_DIVERGENCE_THRESHOLD,
} from './intent-engine';
export {
  evaluateToolChain,
  recordToolCall,
  getAgentTrajectory,
  resetTrajectory,
} from './trajectory';
export type { TrajectoryEntry, ToolChainEvaluation } from './trajectory';
