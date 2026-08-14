export type AgentRuntimeStatus = 'ACTIVE' | 'FROZEN' | 'READ_ONLY';

export interface KillSwitchState {
  agentId: string;
  status: AgentRuntimeStatus;
  reason: string;
  triggeredAt: string;
  revokedScopes?: string[];
}

export interface CapabilityRevocationState {
  agentId: string;
  revokedScopes: string[];
  revokedAt: string;
  reason: string;
}

const killSwitchRegistry = new Map<string, KillSwitchState>();
const revocationRegistry = new Map<string, CapabilityRevocationState>();

export function triggerKillSwitch(agentId: string, reason: string): KillSwitchState {
  const state: KillSwitchState = {
    agentId,
    status: 'FROZEN',
    reason,
    triggeredAt: new Date().toISOString(),
  };
  killSwitchRegistry.set(agentId, state);
  return state;
}

export function revokeCapabilities(
  agentId: string,
  scopes: string[],
  reason = 'Suspicious activity — dangerous capabilities revoked (read-only mode)',
): CapabilityRevocationState {
  const normalizedScopes = scopes.map((scope) => scope.toUpperCase());
  const revocation: CapabilityRevocationState = {
    agentId,
    revokedScopes: normalizedScopes,
    revokedAt: new Date().toISOString(),
    reason,
  };
  revocationRegistry.set(agentId, revocation);

  const existing = killSwitchRegistry.get(agentId);
  if (!existing || existing.status !== 'FROZEN') {
    killSwitchRegistry.set(agentId, {
      agentId,
      status: 'READ_ONLY',
      reason,
      triggeredAt: revocation.revokedAt,
      revokedScopes: normalizedScopes,
    });
  }

  return revocation;
}

export function getRevokedCapabilities(agentId: string): string[] {
  return revocationRegistry.get(agentId)?.revokedScopes ?? [];
}

export function getKillSwitchState(agentId: string): KillSwitchState {
  return (
    killSwitchRegistry.get(agentId) ?? {
      agentId,
      status: 'ACTIVE',
      reason: '',
      triggeredAt: '',
      revokedScopes: [],
    }
  );
}

export function isCapabilityRevoked(agentId: string, capability: string): boolean {
  const revoked = getRevokedCapabilities(agentId);
  return revoked.includes(capability.toUpperCase());
}

export function resetKillSwitchState(agentId?: string): void {
  if (agentId) {
    killSwitchRegistry.delete(agentId);
    revocationRegistry.delete(agentId);
    return;
  }
  killSwitchRegistry.clear();
  revocationRegistry.clear();
}

export function resetRevocationState(agentId?: string): void {
  if (agentId) {
    revocationRegistry.delete(agentId);
    const state = killSwitchRegistry.get(agentId);
    if (state?.status === 'READ_ONLY') {
      killSwitchRegistry.delete(agentId);
    }
    return;
  }
  revocationRegistry.clear();
  for (const [id, state] of killSwitchRegistry.entries()) {
    if (state.status === 'READ_ONLY') {
      killSwitchRegistry.delete(id);
    }
  }
}

export function listFrozenAgents(): KillSwitchState[] {
  return [...killSwitchRegistry.values()].filter((state) => state.status === 'FROZEN');
}

export function listReadOnlyAgents(): KillSwitchState[] {
  return [...killSwitchRegistry.values()].filter((state) => state.status === 'READ_ONLY');
}
