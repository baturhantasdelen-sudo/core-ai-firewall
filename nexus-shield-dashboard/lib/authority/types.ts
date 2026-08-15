/**
 * P0 Sprint 3-4 — Effective Authority Graph (EAG) types.
 */

export type AuthorityNodeType =
  | 'Agent'
  | 'Tool'
  | 'Database'
  | 'ExternalAPI'
  | 'DataAsset';

export type AuthorityEdgeRelation = 'uses' | 'calls' | 'accesses' | 'reads' | 'writes';

export type EffectiveRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type CombinatorialRiskKind =
  | 'DATA_EXFILTRATION_RISK'
  | 'PRIVILEGE_ESCALATION'
  | 'IMPLICIT_DATA_ACCESS'
  | 'FINANCIAL_ABUSE_RISK'
  | 'CREDENTIAL_CHAIN_RISK';

export interface AuthorityNode {
  id: string;
  label: string;
  type: AuthorityNodeType;
  riskWeight: number;
  metadata?: Record<string, string>;
}

export interface AuthorityEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relation: AuthorityEdgeRelation;
  metadata?: Record<string, string>;
}

export interface CombinatorialRiskFinding {
  kind: CombinatorialRiskKind;
  severity: EffectiveRiskLevel;
  toolsInvolved: string[];
  description: string;
  path: string[];
  revokeTarget?: string;
}

export interface AuthorityGraph {
  agentId: string;
  agentName: string;
  nodes: AuthorityNode[];
  edges: AuthorityEdge[];
  rbacScopes: string[];
  toolCapabilities: string[];
  combinatorialRisks: CombinatorialRiskFinding[];
  effectiveRiskScore: number;
  effectiveRiskLevel: EffectiveRiskLevel;
  privilegeEscalationDetected: boolean;
}

export interface EffectiveAuthorityResult {
  graph: AuthorityGraph;
  declaredScopes: string[];
  effectiveScopes: string[];
  hiddenPermissions: string[];
}

export interface AgentAuthorityInput {
  id: string;
  name: string;
  framework: string;
  capabilities: string[];
  mcpConnections: Array<{
    serverName: string;
    transport?: string;
    tools: string[];
  }>;
  rbacScopes?: string[];
  fileContent?: string;
}

export function resolveEffectiveRiskLevel(score: number): EffectiveRiskLevel {
  if (score >= 80) return 'CRITICAL';
  if (score >= 55) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}
