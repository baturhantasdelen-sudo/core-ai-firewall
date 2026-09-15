/** Live immutable audit trail from Nexus Shield governance API. */

import { getShieldApiUrl } from '@/lib/api-config';

export type AuditDecision = 'ALLOW' | 'BLOCK' | 'PENDING_APPROVAL' | 'DEGRADED' | 'UNKNOWN';

export interface AuditPolicySnapshot {
  decision?: string;
  reason?: string | null;
  evaluated_risk_level?: string;
  risk_flags?: string[];
}

export interface AuthorityAnalysis {
  evaluated_risk_level: string;
  risk_flags: string[];
  requires_strict_monitoring: boolean;
  policy_decision: string;
  policy_reason: string | null;
}

export interface AuditTrailEntry {
  timestamp: string;
  session_id: string;
  agent_id: string;
  tool_name: string;
  decision: AuditDecision | string;
  evaluated_risk_level: string;
  risk_flags: string[];
  evidence_id: string | null;
  payload_hash: string | null;
  evidence_status: string | null;
  entry_hash: string | null;
  reason: string | null;
  approval_id?: string | null;
  policy?: AuditPolicySnapshot | null;
}

export interface AuditTrailResponse {
  timestamp: string;
  entries: AuditTrailEntry[];
  total: number;
  redis_connected?: boolean;
}

export async function fetchAuditTrail(limit = 50): Promise<AuditTrailResponse> {
  const url = getShieldApiUrl(`/api/governance/audit-trail?limit=${limit}`);
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Audit trail request failed (${response.status})`);
  }
  return response.json() as Promise<AuditTrailResponse>;
}

export function buildAuthorityAnalysis(entry: AuditTrailEntry): AuthorityAnalysis {
  const policy = entry.policy ?? {};
  const flags = entry.risk_flags.length > 0 ? entry.risk_flags : (policy.risk_flags ?? []);
  const level = entry.evaluated_risk_level || policy.evaluated_risk_level || 'LOW';
  return {
    evaluated_risk_level: level,
    risk_flags: flags,
    requires_strict_monitoring: level === 'CRITICAL' || level === 'HIGH' || flags.length > 0,
    policy_decision: policy.decision ?? entry.decision,
    policy_reason: policy.reason ?? entry.reason,
  };
}

export function isCryptographicallyVerified(entry: AuditTrailEntry): boolean {
  const hash = entry.payload_hash ?? '';
  const validHash = /^[a-f0-9]{64}$/i.test(hash);
  const verifiedStatus =
    entry.evidence_status === 'VERIFIED_ACTION' ||
    entry.evidence_status === 'POLICY_DECISION' ||
    Boolean(entry.entry_hash);
  return validHash && verifiedStatus;
}

export function formatUtcTimestamp(value: string): string {
  try {
    return `${new Date(value).toISOString().replace('T', ' ').slice(0, 19)} UTC`;
  } catch {
    return value;
  }
}

export function truncateHash(value: string | null, visible = 12): string {
  if (!value) return '—';
  if (value.length <= visible + 3) return value;
  return `${value.slice(0, visible)}…`;
}

export function decisionBadgeLabel(decision: string): string {
  switch (decision) {
    case 'ALLOW':
      return 'ALLOW';
    case 'PENDING_APPROVAL':
      return 'PENDING_APPROVAL';
    case 'BLOCK':
      return 'BLOCK';
    default:
      return decision;
  }
}

export function decisionBadgeTone(decision: string): string {
  switch (decision) {
    case 'ALLOW':
      return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200';
    case 'PENDING_APPROVAL':
      return 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200 animate-pulse';
    case 'BLOCK':
      return 'border-rose-500/40 bg-rose-500/15 text-rose-200';
    default:
      return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300';
  }
}

export function riskLevelTone(level: string): string {
  switch (level) {
    case 'CRITICAL':
      return 'border-rose-600/50 bg-rose-600/20 text-rose-100';
    case 'HIGH':
      return 'border-orange-500/40 bg-orange-500/15 text-orange-100';
    case 'MEDIUM':
      return 'border-yellow-500/40 bg-yellow-500/15 text-yellow-100';
    case 'LOW':
      return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100';
    default:
      return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300';
  }
}

export function riskFlagTone(flag: string): string {
  if (flag.includes('INTENT_MISMATCH')) {
    return 'border-violet-500/40 bg-violet-500/15 text-violet-200';
  }
  if (flag.includes('EXFILTRATION') || flag.includes('CRITICAL')) {
    return 'border-rose-500/40 bg-rose-500/15 text-rose-200';
  }
  if (flag.includes('POTENTIAL_DATA')) {
    return 'border-orange-500/40 bg-orange-500/15 text-orange-200';
  }
  if (flag.includes('HIGH') || flag.includes('UNSAFE')) {
    return 'border-amber-500/40 bg-amber-500/15 text-amber-200';
  }
  return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200';
}
