/** Trust Hub — agent evidence & risk telemetry models. */

import type { AuditTrailEntry } from '@/lib/governance/audit-trail';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AuditLogStatus = 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED';

export interface AuthorityAnalysis {
  agent_id: string;
  evaluated_risk_level: RiskLevel;
  risk_flags: string[];
  requires_strict_monitoring: boolean;
}

export interface AuditLogItem {
  approval_id: string;
  session_id: string;
  agent_id: string;
  tool_name: string;
  status: AuditLogStatus;
  decision: string;
  evaluated_risk_level: RiskLevel;
  risk_flags: string[];
  payload_hash: string;
  timestamp: string;
  raw_payload?: Record<string, unknown>;
}

export function normalizeRiskLevel(value: string): RiskLevel {
  if (value === 'MEDIUM' || value === 'HIGH' || value === 'CRITICAL') {
    return value;
  }
  return 'LOW';
}

export function mapDecisionToStatus(decision: string): AuditLogStatus {
  switch (decision) {
    case 'ALLOW':
      return 'APPROVED';
    case 'BLOCK':
      return 'REJECTED';
    case 'PENDING_APPROVAL':
      return 'PENDING_APPROVAL';
    default:
      return 'PENDING_APPROVAL';
  }
}

export function auditTrailEntryToLogItem(entry: AuditTrailEntry): AuditLogItem {
  const evaluated_risk_level = normalizeRiskLevel(entry.evaluated_risk_level);
  const risk_flags = entry.risk_flags.length > 0 ? entry.risk_flags : (entry.policy?.risk_flags ?? []);

  return {
    approval_id: entry.approval_id ?? entry.evidence_id ?? '—',
    session_id: entry.session_id,
    agent_id: entry.agent_id,
    tool_name: entry.tool_name,
    status: mapDecisionToStatus(entry.decision),
    decision: entry.decision,
    evaluated_risk_level,
    risk_flags,
    payload_hash: entry.payload_hash ?? '',
    timestamp: entry.timestamp,
    raw_payload: entry.policy ? { ...entry.policy } : undefined,
  };
}

export function buildAuthorityAnalysis(entry: AuditTrailEntry): AuthorityAnalysis {
  const item = auditTrailEntryToLogItem(entry);
  return {
    agent_id: item.agent_id,
    evaluated_risk_level: item.evaluated_risk_level,
    risk_flags: item.risk_flags,
    requires_strict_monitoring:
      item.evaluated_risk_level === 'CRITICAL' ||
      item.evaluated_risk_level === 'HIGH' ||
      item.risk_flags.length > 0,
  };
}

/** Demo row when upstream audit trail is unavailable. */
export function demoAuditLogItem(): AuditLogItem {
  return {
    approval_id: 'appr_2e99c4cc',
    session_id: 'demo-traj-001',
    agent_id: 'agent-finance-01',
    tool_name: 'get_account_balance',
    status: 'PENDING_APPROVAL',
    decision: 'PENDING_APPROVAL',
    evaluated_risk_level: 'HIGH',
    risk_flags: ['POTENTIAL_DATA_EXFILTRATION_RISK'],
    payload_hash: 'a8b3c9f2e7112ab4c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5',
    timestamp: new Date().toISOString(),
  };
}
