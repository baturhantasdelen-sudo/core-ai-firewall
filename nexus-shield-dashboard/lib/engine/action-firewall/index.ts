import type { AgentCapability } from '@/lib/engine/discovery';
import {
  checkImmuneNetworkSignatures,
  generateThreatSignature,
  registerThreatSignature,
} from '@/lib/engine/threat-intel/immune-network';
import type { ActionEvidence } from '@/lib/engine/evidence';
import { verifyActionEvidence, recordEvidenceChainLog } from '@/lib/engine/evidence';
import {
  evaluateToolChain,
  getAgentTrajectory,
  recordToolCall,
  resetTrajectory,
} from './trajectory';
import {
  getKillSwitchState,
  resetKillSwitchState,
  triggerKillSwitch,
} from './kill-switch';
import {
  demoteToReadOnly,
  freezeAgent,
  getActivePermissions,
  isPermissionActive,
  resetCapabilityRevocation,
} from './capability-revocation';
import {
  analyzeIntentDivergence,
  inferIntentTags,
  scoreIntentConsistency,
} from './intent-engine';
import type { IntentDivergenceReport, ToolCallStep } from './intent-divergence';

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
  intentDivergenceReport?: IntentDivergenceReport;
  violations: string[];
  killSwitchTriggered: boolean;
  capabilitiesRevoked?: boolean;
  agentStatus?: 'ACTIVE' | 'FROZEN' | 'READ_ONLY';
  latencyMs?: number;
}

const TOOL_CAPABILITY_MAP: Array<{ pattern: RegExp; capability: AgentCapability }> = [
  { pattern: /(?:read|load|fetch|get)_?(?:file|document|content|invoice)/i, capability: 'READ' },
  { pattern: /(?:write|save|store|upload)_?(?:file|document|content)/i, capability: 'WRITE' },
  { pattern: /(?:delete|remove|purge|drop)/i, capability: 'WRITE' },
  { pattern: /(?:exec|execute|shell|bash|subprocess|run_command|terminal)/i, capability: 'EXECUTE' },
  { pattern: /(?:sql|database|db_query|postgres|mysql|sqlite|bulk_export_db|export_db|export_customer)/i, capability: 'DB_QUERY' },
  { pattern: /(?:web_search|internet_search|google_search|search_web|browse)/i, capability: 'WEB_SEARCH' },
  { pattern: /(?:payment|stripe|billing|financial|transfer|bank|invoice_pay)/i, capability: 'FINANCIAL' },
  { pattern: /(?:api_call|http_request|fetch_url|rest_api|graphql|external_upload|upload_external)/i, capability: 'API_CALL' },
];

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
    if (!isPermissionActive(agentId, capability)) {
      const permState = getActivePermissions(agentId);
      if (permState.mode === 'READ_ONLY') {
        violations.push(`Capability revoked (read-only mode): ${capability}`);
        continue;
      }
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
  divergenceReport: IntentDivergenceReport,
  requiredCapabilities: AgentCapability[],
): number {
  let riskScore = 0;

  riskScore += capabilityViolations.length * 28;
  riskScore += intentResult.riskBoost;

  if (divergenceReport.shouldBlock) {
    riskScore += 30;
  } else if (divergenceReport.divergenceScore > 50) {
    riskScore += 15;
  }

  if (divergenceReport.severity === 'CRITICAL') {
    riskScore += 20;
  } else if (divergenceReport.severity === 'HIGH') {
    riskScore += 10;
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

  if (
    intentResult.intentMatchScore >= 80 &&
    capabilityViolations.length === 0 &&
    !divergenceReport.shouldBlock
  ) {
    riskScore = Math.min(riskScore, 25);
  }

  return Math.min(100, Math.max(0, riskScore));
}

function isCriticalExportDivergence(report: IntentDivergenceReport): boolean {
  if (report.recommendation === 'BLOCK_ACTION') return true;
  return report.mismatchedSteps.some((step) =>
    /export|delete|external upload|bulk export|export_customer/i.test(step.reason),
  );
}

function resolveDecision(
  riskScore: number,
  violations: string[],
  agentStatus: 'ACTIVE' | 'FROZEN' | 'READ_ONLY',
  divergenceReport: IntentDivergenceReport,
): ActionDecision {
  if (agentStatus === 'FROZEN') return 'BLOCK';
  if (violations.some((violation) => /Capability revoked/.test(violation))) {
    return 'BLOCK';
  }
  if (riskScore > 85) return 'BLOCK';
  if (divergenceReport.recommendation === 'BLOCK_ACTION' && divergenceReport.divergenceScore >= 90) {
    return 'BLOCK';
  }
  if (riskScore > 60 || violations.length >= 2) return 'HUMAN_APPROVAL_REQUIRED';
  if (violations.length > 0) return 'HUMAN_APPROVAL_REQUIRED';
  return 'ALLOW';
}

function shouldRegisterThreatSignature(riskScore: number, killSwitchTriggered: boolean): boolean {
  return riskScore > 75 || killSwitchTriggered;
}

function buildTrajectorySteps(
  agentId: string,
  currentTool: ToolCallInput,
): ToolCallStep[] {
  const prior = getAgentTrajectory(agentId);
  return [
    ...prior.map((entry) => ({ tool: entry.toolName, timestamp: entry.timestamp })),
    { tool: currentTool.name, args: currentTool.args },
  ];
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
  const trajectorySteps = buildTrajectorySteps(input.agentId, input.toolCall);
  const divergenceReport = analyzeIntentDivergence(input.userIntent, trajectorySteps);

  const violatedCapabilities = requiredCapabilities.filter(
    (capability) => !granted.has(capability) || !isPermissionActive(input.agentId, capability),
  );

  const immuneMatch = checkImmuneNetworkSignatures({
    userIntent: input.userIntent,
    toolName: input.toolCall.name,
    violatedCapabilities,
  });

  const violations = [
    ...capabilityViolations,
    ...intentResult.violations,
    ...(divergenceReport.shouldBlock && divergenceReport.violation ? [divergenceReport.violation] : []),
    ...(divergenceReport.divergenceScore >= 35
      ? divergenceReport.mismatchedSteps.map((step) => step.reason)
      : []),
    ...(immuneMatch.violation ? [immuneMatch.violation] : []),
  ];

  let riskScore = computeRiskScore(
    capabilityViolations,
    intentResult,
    divergenceReport,
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

  recordEvidenceChainLog(
    input.agentId,
    { toolName: input.toolCall.name, args: input.toolCall.args },
    evidenceCheck,
  );

  if (!evidenceCheck.verified) {
    violations.push(...evidenceCheck.violations);
    riskScore = Math.min(100, riskScore + 18);
  }

  riskScore = Math.min(100, riskScore);

  recordToolCall(input.agentId, input.toolCall.name, riskScore);

  let killSwitchTriggered = false;
  let capabilitiesRevoked = false;
  let agentStatus: 'ACTIVE' | 'FROZEN' | 'READ_ONLY' = killSwitchState.status;

  const lacksRequiredCapabilityOnly =
    capabilityViolations.length > 0 &&
    capabilityViolations.every((violation) => /Agent lacks required capability/.test(violation)) &&
    !divergenceReport.shouldBlock &&
    divergenceReport.recommendation !== 'BLOCK_ACTION' &&
    !chainEvaluation.shouldBlock;

  const preferCapabilityRevocation =
    divergenceReport.recommendation === 'REVOKE_CAPABILITIES' ||
    (divergenceReport.shouldBlock && !isCriticalExportDivergence(divergenceReport));

  const shouldFullFreeze =
    !lacksRequiredCapabilityOnly &&
    !preferCapabilityRevocation &&
    (riskScore > 85 || chainEvaluation.shouldBlock) &&
    getActivePermissions(input.agentId).mode !== 'READ_ONLY';

  if (
    shouldFullFreeze ||
    (isCriticalExportDivergence(divergenceReport) && divergenceReport.divergenceScore >= 90)
  ) {
    if (getActivePermissions(input.agentId).mode === 'READ_ONLY' && !chainEvaluation.shouldBlock) {
      agentStatus = 'READ_ONLY';
    } else {
      freezeAgent(input.agentId, violations.join('; ') || 'Critical action firewall risk score exceeded');
      killSwitchTriggered = true;
      agentStatus = 'FROZEN';
    }
  } else if (
    !lacksRequiredCapabilityOnly &&
    (divergenceReport.recommendation === 'REVOKE_CAPABILITIES' ||
    divergenceReport.shouldBlock ||
    (riskScore > 70 && riskScore <= 85))
  ) {
    demoteToReadOnly(
      input.agentId,
      divergenceReport.violation ?? 'Intent-action divergence — read-only mode enforced',
    );
    capabilitiesRevoked = true;
    agentStatus = 'READ_ONLY';
  }

  if (shouldRegisterThreatSignature(riskScore, killSwitchTriggered)) {
    const signature = generateThreatSignature({
      toolSequence: trajectorySteps.map((step) => step.tool),
      intentAnomalyTags: inferIntentTags(input.userIntent),
      violatedCapabilities,
      riskScore,
      killSwitchTriggered,
    });
    if (signature) {
      registerThreatSignature(signature);
    }
  }

  const uniqueViolations = [...new Set(violations)];
  const decisionRiskScore = lacksRequiredCapabilityOnly ? Math.min(riskScore, 85) : riskScore;

  return {
    decision: resolveDecision(decisionRiskScore, uniqueViolations, agentStatus, divergenceReport),
    riskScore,
    intentMatchScore: intentResult.intentMatchScore,
    intentDivergencePercent: divergenceReport.divergenceScore,
    intentDivergenceReport: divergenceReport,
    violations: uniqueViolations,
    killSwitchTriggered,
    capabilitiesRevoked,
    agentStatus,
    latencyMs: performance.now() - started,
  };
}

export function resetActionFirewallRuntime(agentId?: string): void {
  resetKillSwitchState(agentId);
  resetCapabilityRevocation(agentId);
  resetTrajectory(agentId);
}

export {
  triggerKillSwitch,
  getKillSwitchState,
  resetKillSwitchState,
  listReadOnlyAgents,
  revokeCapabilities,
  getRevokedCapabilities,
} from './kill-switch';
export {
  demoteToReadOnly,
  restoreCapabilities,
  getActivePermissions,
  freezeAgent,
  isPermissionActive,
  resetCapabilityRevocation,
} from './capability-revocation';
export {
  analyzeIntentDivergence,
  calculateIntentDivergenceFromSteps,
  INTENT_DIVERGENCE_THRESHOLD,
} from './intent-divergence';
export type { IntentDivergenceReport, ToolCallStep, DivergenceSeverity, DivergenceRecommendation } from './intent-divergence';
export {
  calculateIntentDivergence,
  inferIntentTags,
  scoreIntentConsistency,
} from './intent-engine';
export {
  evaluateToolChain,
  recordToolCall,
  getAgentTrajectory,
  resetTrajectory,
} from './trajectory';
export type { TrajectoryEntry, ToolChainEvaluation } from './trajectory';
