import type { DetectionMatch, DetectorContext } from '@/lib/engine/types';
import { applyContextToFindings, type ContextAwareFinding } from '@/lib/engine/context';
import { detectorsForProfile } from '@/lib/engine/detectors';
import { DEFAULT_POLICY, loadPolicyFromObject, type NexusShieldPolicy } from '@/lib/engine/policy';
import { pathMatchesAny, rangesOverlap } from '@/lib/engine/utils';

export type { ContextAwareFinding } from '@/lib/engine/context';

export interface DetectionEngineOptions {
  includeSuppressed?: boolean;
}

function isAllowedMatch(matched: string, ctx: DetectorContext): boolean {
  if (ctx.allowlistExact.has(matched)) return true;
  return ctx.allowlistPatterns.some((pattern) => pattern.test(matched));
}

function shouldIncludeFinding(finding: DetectionMatch, policy: NexusShieldPolicy): boolean {
  if (finding.category === 'secret' && policy.rules.secret_detection === 'off') return false;
  if (finding.category === 'pii' && policy.rules.pii_detection === 'off') return false;
  return true;
}

function collectRawFindings(
  content: string,
  filename: string,
  policy: NexusShieldPolicy,
): DetectionMatch[] {
  const normalizedPath = filename.replace(/\\/g, '/');
  if (pathMatchesAny(normalizedPath, policy.ignore_paths)) {
    return [];
  }

  const ctx: DetectorContext = {
    filename: normalizedPath,
    profile: policy.profile,
    allowlistExact: new Set(policy.allowlist.exact_matches),
    allowlistPatterns: policy.allowlist.regex_patterns.map((pattern) => new RegExp(pattern)),
    ignorePaths: policy.ignore_paths,
  };

  const detectors = detectorsForProfile(policy.profile);
  const allMatches: Array<DetectionMatch & { range?: [number, number] }> = [];
  const seen = new Set<string>();
  const occupied: Array<[number, number]> = [];

  for (const detector of detectors) {
    const matches = detector.detect(content, ctx);
    for (const match of matches) {
      const range = (match as DetectionMatch & { range?: [number, number] }).range;
      if (range && occupied.some((existing) => rangesOverlap(existing, range))) continue;
      if (isAllowedMatch(match.matched, ctx)) continue;
      if (!shouldIncludeFinding(match, policy)) continue;

      const dedupeKey = `${match.ruleId}:${match.line}:${match.column}:${match.matched}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      if (range) occupied.push(range);

      const { range: _range, ...finding } = match as DetectionMatch & { range?: [number, number] };
      allMatches.push(finding);
    }
  }

  return allMatches.sort((a, b) => a.line - b.line || a.column - b.column);
}

export function runDetectionEngine(
  content: string,
  filename: string,
  policyInput?: NexusShieldPolicy | Record<string, unknown> | null,
  options?: DetectionEngineOptions,
): ContextAwareFinding[] {
  if (!content.trim()) return [];

  const policy =
    policyInput && 'version' in policyInput
      ? (policyInput as NexusShieldPolicy)
      : loadPolicyFromObject(policyInput as Record<string, unknown> | null);

  const normalizedPath = filename.replace(/\\/g, '/');
  const rawFindings = collectRawFindings(content, normalizedPath, policy);

  return applyContextToFindings(rawFindings, content, normalizedPath, {
    includeSuppressed: options?.includeSuppressed ?? false,
  });
}

export function runDetectionEngineOnLines(
  lines: Array<{ lineNumber: number; content: string }>,
  filename: string,
  policyInput?: NexusShieldPolicy | Record<string, unknown> | null,
  options?: DetectionEngineOptions,
): ContextAwareFinding[] {
  const findings: ContextAwareFinding[] = [];

  for (const line of lines) {
    if (!line.content.trim()) continue;
    const lineFindings = runDetectionEngine(line.content, filename, policyInput, {
      includeSuppressed: true,
    });
    findings.push(
      ...lineFindings.map((finding) => ({
        ...finding,
        line: line.lineNumber,
      })),
    );
  }

  const sorted = findings.sort((a, b) => a.line - b.line || a.column - b.column);
  if (options?.includeSuppressed) {
    return sorted;
  }
  return sorted.filter((finding) => !finding.suppressed);
}

export { DEFAULT_POLICY };

export { discoverAgents, discoverAgentsInFile, summarizeAgentDiscovery } from '@/lib/engine/discovery';
export type {
  AgentAsset,
  AgentCapability,
  AgentDiscoveryResult,
  AgentFramework,
  AgentRiskLevel,
  McpConnection,
} from '@/lib/engine/discovery';

export {
  evaluateAgentAction,
  triggerKillSwitch,
  getKillSwitchState,
  resetKillSwitchState,
} from '@/lib/engine/action-firewall';
export type {
  ActionDecision,
  ActionEvaluationResult,
  EvaluateAgentActionInput,
  ToolCallInput,
} from '@/lib/engine/action-firewall';

export {
  generateThreatSignature,
  registerThreatSignature,
  listThreatSignatures,
  checkImmuneNetworkSignatures,
  getImmuneNetworkStats,
  resetThreatRegistry,
} from '@/lib/engine/immune';
export type { BehavioralThreatSignature, ThreatCategory, ThreatSeverity } from '@/lib/engine/immune';

export { runRedTeamSimulation, findAgentForSimulation } from '@/lib/engine/simulator';
export type {
  AttackVector,
  SimulationReport,
  SimulationRiskRating,
  SimulationVectorResult,
  SimulationVectorStatus,
} from '@/lib/engine/simulator';

export { verifyActionEvidence } from '@/lib/engine/evidence';
export type { ActionEvidence, EvidenceStatus, EvidenceVerificationResult } from '@/lib/engine/evidence';

export { inspectMCPServer } from '@/lib/engine/mcp/guardrail';
export type { McpGuardrailResult, McpServerInspectionInput } from '@/lib/engine/mcp/guardrail';

export { scanAgentMemory } from '@/lib/engine/memory/poisoning';
export type { AgentMemoryScanInput, MemoryPoisoningResult } from '@/lib/engine/memory/poisoning';

export {
  calculateReputationScore,
  getAgentReputation,
  listAgentReputations,
  verifyInterAgentTrust,
  resetReputationStore,
} from '@/lib/engine/reputation';
export type {
  AgentIncident,
  AgentReputationRecord,
  InterAgentTrustResult,
} from '@/lib/engine/reputation';
