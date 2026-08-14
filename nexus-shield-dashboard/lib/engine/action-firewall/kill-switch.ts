export type AgentRuntimeStatus = 'ACTIVE' | 'FROZEN';

export interface KillSwitchState {
  agentId: string;
  status: AgentRuntimeStatus;
  reason: string;
  triggeredAt: string;
}

const killSwitchRegistry = new Map<string, KillSwitchState>();

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

export function getKillSwitchState(agentId: string): KillSwitchState {
  return (
    killSwitchRegistry.get(agentId) ?? {
      agentId,
      status: 'ACTIVE',
      reason: '',
      triggeredAt: '',
    }
  );
}

export function resetKillSwitchState(agentId?: string): void {
  if (agentId) {
    killSwitchRegistry.delete(agentId);
    return;
  }
  killSwitchRegistry.clear();
}

export function listFrozenAgents(): KillSwitchState[] {
  return [...killSwitchRegistry.values()].filter((state) => state.status === 'FROZEN');
}
