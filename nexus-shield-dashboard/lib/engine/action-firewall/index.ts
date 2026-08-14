import type { AgentCapability } from '@/lib/engine/discovery';
import {
  checkImmuneNetworkSignatures,
  generateThreatSignature,
  inferIntentTags,
  registerThreatSignature,
} from '@/lib/engine/immune';
import { getKillSwitchState, triggerKillSwitch } from './kill-switch';

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
}

export interface ActionEvaluationResult {
  decision: ActionDecision;
  riskScore: number;
  intentMatchScore: number;
  violations: string[];
  killSwitchTriggered: boolean;
  agentStatus?: 'ACTIVE' | 'FROZEN';
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

const INTENT_KEYWORDS: Record<string, RegExp[]> = {
  invoice: [/invoice/i, /billing/i, /receipt/i, /fatura/i],
  read: [/read/i, /view/i, /check/i, /inspect/i, /lookup/i],
  export: [/export/i, /download/i, /dump/i, /extract/i],
  payment: [/pay/i, /transfer/i, /charge/i, /refund/i],
  search: [/search/i, /find/i, /lookup/i],
  execute: [/run/i, /execute/i, /deploy/i, /restart/i],
  database: [/database/i, /sql/i, /query/i, /db/i, /record/i],
};

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
): string[] {
  const violations: string[] = [];
  for (const capability of required) {
    if (!granted.has(capability)) {
      violations.push(`Agent lacks required capability: ${capability}`);
    }
  }
  return violations;
}

function scoreIntentConsistency(
  userIntent: string,
  toolCall: ToolCallInput,
): { intentMatchScore: number; violations: string[]; riskBoost: number } {
  const intent = userIntent.toLowerCase();
  const tool = toolCall.name.toLowerCase();
  const argsText = JSON.stringify(toolCall.args).toLowerCase();
  const violations: string[] = [];
  let riskBoost = 0;

  const intentTags = Object.entries(INTENT_KEYWORDS)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(intent)))
    .map(([tag]) => tag);

  const toolTags = Object.entries(INTENT_KEYWORDS)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(`${tool} ${argsText}`)))
    .map(([tag]) => tag);

  const overlap = intentTags.filter((tag) => toolTags.includes(tag));
  const intentMatchScore =
    intentTags.length === 0
      ? toolTags.length === 0
        ? 75
        : 45
      : Math.round((overlap.length / intentTags.length) * 100);

  const invoiceLike = /invoice|billing|receipt|fatura/i.test(intent);
  const exportLike = /bulk_export|export_db|dump|download_all|sql_export/i.test(tool);
  const paymentLike = /payment|transfer|stripe|charge|refund/i.test(tool);
  const executeLike = /exec|shell|run_command|subprocess/i.test(tool);
  const readLikeIntent = /check|view|inspect|lookup|read/i.test(intent);

  if (invoiceLike && exportLike) {
    violations.push('Intent-Action mismatch: invoice check intent vs bulk database export tool');
    riskBoost += 35;
  }

  if (readLikeIntent && (exportLike || executeLike)) {
    violations.push('Intent-Action mismatch: read/check intent vs destructive or export tool call');
    riskBoost += 25;
  }

  if (invoiceLike && paymentLike && !/pay|charge|refund/i.test(intent)) {
    violations.push('Intent-Action mismatch: invoice review intent vs financial mutation tool');
    riskBoost += 30;
  }

  if (intentMatchScore < 35) {
    violations.push(`Low intent-tool alignment score (${intentMatchScore}/100)`);
    riskBoost += 20;
  }

  return { intentMatchScore, violations, riskBoost };
}

function computeRiskScore(
  capabilityViolations: string[],
  intentResult: { intentMatchScore: number; violations: string[]; riskBoost: number },
  requiredCapabilities: AgentCapability[],
): number {
  let riskScore = 0;

  riskScore += capabilityViolations.length * 28;
  riskScore += intentResult.riskBoost;

  if (requiredCapabilities.includes('FINANCIAL')) {
    riskScore += 15;
  }
  if (requiredCapabilities.includes('EXECUTE')) {
    riskScore += 12;
  }
  if (requiredCapabilities.includes('DB_QUERY') && intentResult.intentMatchScore < 50) {
    riskScore += 18;
  }

  if (intentResult.intentMatchScore >= 80 && capabilityViolations.length === 0) {
    riskScore = Math.min(riskScore, 25);
  }

  return Math.min(100, Math.max(0, riskScore));
}

function resolveDecision(
  riskScore: number,
  violations: string[],
  frozen: boolean,
): ActionDecision {
  if (frozen) return 'BLOCK';
  if (riskScore > 85) return 'BLOCK';
  if (riskScore > 60 || violations.length >= 2) return 'HUMAN_APPROVAL_REQUIRED';
  if (violations.length > 0) return 'HUMAN_APPROVAL_REQUIRED';
  return 'ALLOW';
}

function shouldRegisterThreatSignature(riskScore: number, killSwitchTriggered: boolean): boolean {
  return riskScore > 75 || killSwitchTriggered;
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

  const capabilityViolations = validateCapabilities(requiredCapabilities, granted);
  const intentResult = scoreIntentConsistency(input.userIntent, input.toolCall);
  const violatedCapabilities = requiredCapabilities.filter(
    (capability) => !granted.has(capability),
  );

  const immuneMatch = checkImmuneNetworkSignatures({
    userIntent: input.userIntent,
    toolName: input.toolCall.name,
    violatedCapabilities,
  });

  const violations = [
    ...capabilityViolations,
    ...intentResult.violations,
    ...(immuneMatch.violation ? [immuneMatch.violation] : []),
  ];

  let riskScore =
    computeRiskScore(capabilityViolations, intentResult, requiredCapabilities) + immuneMatch.riskBoost;
  riskScore = Math.min(100, riskScore);

  const killSwitchTriggered = riskScore > 85;

  if (killSwitchTriggered) {
    triggerKillSwitch(input.agentId, violations.join('; ') || 'Critical action firewall risk score exceeded');
  }

  if (shouldRegisterThreatSignature(riskScore, killSwitchTriggered)) {
    const signature = generateThreatSignature({
      toolSequence: [input.toolCall.name],
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
    decision: resolveDecision(riskScore, violations, false),
    riskScore,
    intentMatchScore: intentResult.intentMatchScore,
    violations,
    killSwitchTriggered,
    agentStatus: killSwitchTriggered ? 'FROZEN' : 'ACTIVE',
    latencyMs: performance.now() - started,
  };
}

export { triggerKillSwitch, getKillSwitchState, resetKillSwitchState } from './kill-switch';
