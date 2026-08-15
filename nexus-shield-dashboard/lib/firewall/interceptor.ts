import {
  demoteToReadOnly,
  freezeAgent,
  getActivePermissions,
} from '@/lib/engine/action-firewall/capability-revocation';
import { revokeAllStaticCredentials } from '@/lib/engine/auth/jit-credentials';
import type {
  ActionFirewallInput,
  ActionFirewallResult,
  AdaptiveDegradationState,
  DegradationLevel,
  FirewallDecisionLabel,
} from '@/lib/firewall/types';
import { DEGRADATION_LEVEL_META } from '@/lib/firewall/types';
import { TRAJECTORY_HIGH_RISK_THRESHOLD } from '@/lib/trajectory/types';

const ALL_PERMISSIONS = [
  'READ',
  'WRITE',
  'DELETE',
  'EXECUTE',
  'FINANCIAL',
  'DB_QUERY',
  'API_CALL',
  'WEB_SEARCH',
  'EXPORT',
] as const;

const LEVEL_1_REVOKED = ['WRITE', 'DELETE', 'EXECUTE', 'FINANCIAL', 'EXPORT', 'DB_QUERY'];
const LEVEL_2_REVOKED = [...LEVEL_1_REVOKED, 'API_CALL'];

const degradationStore = new Map<string, AdaptiveDegradationState>();

function isWriteOrExportTool(toolName: string): boolean {
  return /write|export|delete|exec|shell|payment|stripe|bulk_export|upload/i.test(toolName);
}

function isExternalTool(toolName: string): boolean {
  return /external_api|http|webhook|call_api|fetch_url|upload_external/i.test(toolName);
}

function resolveDegradationLevel(input: ActionFirewallInput): DegradationLevel {
  const { trajectoryRiskScore, trajectoryViolation, intentDivergenceScore = 0 } = input;

  if (trajectoryRiskScore >= 0.95 || (trajectoryViolation && trajectoryRiskScore >= TRAJECTORY_HIGH_RISK_THRESHOLD)) {
    return 3;
  }

  if (trajectoryRiskScore >= TRAJECTORY_HIGH_RISK_THRESHOLD || intentDivergenceScore >= 80) {
    return 2;
  }

  if (
    trajectoryRiskScore >= 0.65 ||
    intentDivergenceScore >= 55 ||
    (trajectoryViolation && isWriteOrExportTool(input.toolName))
  ) {
    return 1;
  }

  if (isWriteOrExportTool(input.toolName) && trajectoryRiskScore >= 0.45) {
    return 1;
  }

  return 0;
}

function buildDegradationState(
  agentId: string,
  level: DegradationLevel,
  reason: string,
): AdaptiveDegradationState {
  const meta = DEGRADATION_LEVEL_META[level];
  const now = new Date().toISOString();

  if (level === 3) {
    freezeAgent(agentId, reason);
    return {
      level: 3,
      label: 'BLOCK',
      activePermissions: [],
      revokedPermissions: [...ALL_PERMISSIONS],
      jitTokensRevoked: true,
      externalApiBlocked: true,
      humanApprovalRequired: false,
      quarantined: true,
      reason,
      appliedAt: now,
    };
  }

  if (level === 2) {
    demoteToReadOnly(agentId, reason);
    try {
      revokeAllStaticCredentials(agentId);
    } catch {
      // JIT store may be empty in demo mode
    }
    return {
      level: 2,
      label: 'RESTRICTED',
      activePermissions: ['READ', 'WEB_SEARCH'],
      revokedPermissions: [...LEVEL_2_REVOKED],
      jitTokensRevoked: true,
      externalApiBlocked: true,
      humanApprovalRequired: false,
      quarantined: false,
      reason,
      appliedAt: now,
    };
  }

  if (level === 1) {
    return {
      level: 1,
      label: 'DEGRADE',
      activePermissions: ALL_PERMISSIONS.filter((p) => !LEVEL_1_REVOKED.includes(p)),
      revokedPermissions: [...LEVEL_1_REVOKED],
      jitTokensRevoked: false,
      externalApiBlocked: false,
      humanApprovalRequired: true,
      quarantined: false,
      reason,
      appliedAt: now,
    };
  }

  const current = getActivePermissions(agentId);
  return {
    level: 0,
    label: 'ALLOW',
    activePermissions: current.activePermissions.length > 0 ? current.activePermissions : [...ALL_PERMISSIONS],
    revokedPermissions: [],
    jitTokensRevoked: false,
    externalApiBlocked: false,
    humanApprovalRequired: false,
    quarantined: false,
    reason: meta.description,
    appliedAt: now,
  };
}

function shouldIntercept(input: ActionFirewallInput, level: DegradationLevel): boolean {
  if (level === 3) return true;
  if (level === 2 && isExternalTool(input.toolName)) return true;
  if (level === 1 && isWriteOrExportTool(input.toolName)) return true;
  return false;
}

function buildViolations(input: ActionFirewallInput, level: DegradationLevel): string[] {
  const violations: string[] = [];
  if (input.trajectoryViolation) {
    violations.push(`Trajectory sequence violation (risk=${input.trajectoryRiskScore.toFixed(2)})`);
  }
  if (input.trajectoryRiskScore >= TRAJECTORY_HIGH_RISK_THRESHOLD) {
    violations.push(`Trajectory risk exceeds threshold (${TRAJECTORY_HIGH_RISK_THRESHOLD})`);
  }
  if ((input.intentDivergenceScore ?? 0) >= 55) {
    violations.push(`Intent divergence score ${input.intentDivergenceScore}%`);
  }
  if (level >= 1 && isWriteOrExportTool(input.toolName)) {
    violations.push(`Write/Export action "${input.toolName}" blocked under degradation LEVEL ${level}`);
  }
  if (level >= 2 && isExternalTool(input.toolName)) {
    violations.push(`External API action "${input.toolName}" blocked — JIT tokens revoked`);
  }
  if (level === 3) {
    violations.push(`Agent quarantined — all actions blocked`);
  }
  return violations;
}

/**
 * In-line interceptor / proxy rule engine with 4-level adaptive capability revocation.
 */
export function evaluateActionFirewall(input: ActionFirewallInput): ActionFirewallResult {
  const started = Date.now();
  const level = resolveDegradationLevel(input);
  const reason =
    level === 0
      ? 'Action permitted — trajectory within acceptable bounds'
      : level === 1
        ? 'Adaptive degradation: write/export restricted pending human approval'
        : level === 2
          ? 'Restricted mode: external API and JIT credentials revoked'
          : 'Critical trajectory risk — agent quarantined';

  const degradation = buildDegradationState(input.agentId, level, reason);
  degradationStore.set(input.agentId, degradation);

  const intercepted = shouldIntercept(input, level);
  const violations = buildViolations(input, level);

  const decision: FirewallDecisionLabel = degradation.label;

  return {
    decision,
    degradationLevel: level,
    degradation,
    intercepted,
    violations,
    latencyMs: Date.now() - started,
  };
}

export function getDegradationState(agentId: string): AdaptiveDegradationState | undefined {
  return degradationStore.get(agentId);
}

export function forceRevokeCapabilities(
  agentId: string,
  reason = 'Operator forced capability revocation',
): AdaptiveDegradationState {
  const state = buildDegradationState(agentId, 2, reason);
  degradationStore.set(agentId, state);
  return state;
}

export function simulateDegradeMode(agentId: string): AdaptiveDegradationState {
  const state = buildDegradationState(
    agentId,
    1,
    'Degrade mode simulation — write/export requires human approval',
  );
  degradationStore.set(agentId, state);
  return state;
}

export function resetFirewallState(agentId?: string): void {
  if (agentId) {
    degradationStore.delete(agentId);
    return;
  }
  degradationStore.clear();
}
