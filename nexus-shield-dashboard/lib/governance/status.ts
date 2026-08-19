/** Live governance module status from Nexus Shield Fast API. */

import { getShieldApiUrl } from '@/lib/api-config';

export type VerificationState = 'VERIFIED' | 'UNVERIFIED';

export interface ModuleStatus {
  status: VerificationState;
  active: boolean;
  message?: string | null;
}

export interface GovernanceStatusResponse {
  timestamp: string;
  modules: Record<string, ModuleStatus>;
}

export const GOVERNANCE_MODULE_LABELS: Record<string, string> = {
  mcp_proxy: 'MCP Proxy',
  tool_api_gateway: 'Tool/API Gateway',
  agent_registry: 'Agent Registry',
  agent_identity: 'Agent Identity',
  effective_authority: 'Effective Authority',
  intent_engine: 'Intent Engine',
  trajectory_engine: 'Trajectory Engine',
  adaptive_degradation: 'Adaptive Degradation',
  dynamic_trust_score: 'Dynamic Trust Score',
  evidence_engine: 'Evidence Engine',
  immutable_audit_trail: 'Immutable Audit Trail',
  agent_reputation: 'Agent Reputation',
  agent_trust_network: 'Agent Trust Network',
};

export const GOVERNANCE_MODULE_ORDER = Object.keys(GOVERNANCE_MODULE_LABELS);

export function moduleVerificationLabel(status: VerificationState): string {
  return status === 'VERIFIED' ? '🟢 Doğrulandı' : '🔴 Doğrulanamadı';
}

export async function fetchGovernanceStatus(): Promise<GovernanceStatusResponse> {
  const response = await fetch(getShieldApiUrl('/api/governance/status'), {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Governance status request failed (${response.status})`);
  }
  return response.json() as Promise<GovernanceStatusResponse>;
}

export function countVerifiedModules(modules: Record<string, ModuleStatus>): number {
  return Object.values(modules).filter((module) => module.status === 'VERIFIED').length;
}
