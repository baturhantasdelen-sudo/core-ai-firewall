import {
  getKillSwitchState,
  getRevokedCapabilities,
  resetRevocationState,
  revokeCapabilities,
  triggerKillSwitch,
} from './kill-switch';

export type PermissionMode = 'FULL' | 'READ_ONLY' | 'FROZEN';

export interface AgentPermissionState {
  agentId: string;
  mode: PermissionMode;
  activePermissions: string[];
  revokedPermissions: string[];
  demotedAt?: string;
  restoredAt?: string;
  reason?: string;
}

const ALL_PERMISSIONS = [
  'READ',
  'WRITE',
  'DELETE',
  'EXECUTE',
  'FINANCIAL',
  'DB_QUERY',
  'API_CALL',
  'WEB_SEARCH',
] as const;

const READ_ONLY_PERMISSIONS = ['READ', 'WEB_SEARCH'] as const;

const DEMOTE_REVOKED = ['WRITE', 'DELETE', 'EXECUTE', 'FINANCIAL', 'DB_QUERY', 'API_CALL'];

const permissionStore = new Map<string, AgentPermissionState>();

function buildFullState(agentId: string): AgentPermissionState {
  return {
    agentId,
    mode: 'FULL',
    activePermissions: [...ALL_PERMISSIONS],
    revokedPermissions: [],
  };
}

function syncFromKillSwitch(agentId: string): AgentPermissionState | null {
  const killState = getKillSwitchState(agentId);
  const revoked = getRevokedCapabilities(agentId);

  if (killState.status === 'FROZEN') {
    return {
      agentId,
      mode: 'FROZEN',
      activePermissions: [],
      revokedPermissions: [...ALL_PERMISSIONS],
      demotedAt: killState.triggeredAt,
      reason: killState.reason,
    };
  }

  if (killState.status === 'READ_ONLY' || revoked.length > 0) {
    const revokedSet = new Set(revoked.length > 0 ? revoked : DEMOTE_REVOKED);
    return {
      agentId,
      mode: 'READ_ONLY',
      activePermissions: ALL_PERMISSIONS.filter((perm) => !revokedSet.has(perm)),
      revokedPermissions: [...revokedSet],
      demotedAt: killState.triggeredAt,
      reason: killState.reason,
    };
  }

  return null;
}

export function demoteToReadOnly(
  agentId: string,
  reason = 'Intent divergence — demoted to READ_ONLY (WRITE/DELETE/EXECUTE/FINANCIAL suspended)',
): AgentPermissionState {
  revokeCapabilities(agentId, DEMOTE_REVOKED, reason);

  const state: AgentPermissionState = {
    agentId,
    mode: 'READ_ONLY',
    activePermissions: [...READ_ONLY_PERMISSIONS],
    revokedPermissions: [...DEMOTE_REVOKED],
    demotedAt: new Date().toISOString(),
    reason,
  };

  permissionStore.set(agentId, state);
  return state;
}

export function restoreCapabilities(agentId: string): AgentPermissionState {
  const killState = getKillSwitchState(agentId);
  if (killState.status === 'FROZEN') {
    throw new Error(`Cannot restore capabilities — agent ${agentId} is FROZEN. Unfreeze first.`);
  }

  resetRevocationState(agentId);
  permissionStore.delete(agentId);

  const restored: AgentPermissionState = {
    agentId,
    mode: 'FULL',
    activePermissions: [...ALL_PERMISSIONS],
    revokedPermissions: [],
    restoredAt: new Date().toISOString(),
    reason: 'Capabilities restored after security approval',
  };

  permissionStore.set(agentId, restored);
  return restored;
}

export function freezeAgent(agentId: string, reason: string): AgentPermissionState {
  triggerKillSwitch(agentId, reason);
  const state: AgentPermissionState = {
    agentId,
    mode: 'FROZEN',
    activePermissions: [],
    revokedPermissions: [...ALL_PERMISSIONS],
    demotedAt: new Date().toISOString(),
    reason,
  };
  permissionStore.set(agentId, state);
  return state;
}

export function getActivePermissions(agentId: string): AgentPermissionState {
  const synced = syncFromKillSwitch(agentId);
  if (synced) {
    permissionStore.set(agentId, synced);
    return synced;
  }

  return permissionStore.get(agentId) ?? buildFullState(agentId);
}

export function isPermissionActive(agentId: string, permission: string): boolean {
  const state = getActivePermissions(agentId);
  if (state.mode === 'FROZEN') return false;
  if (state.mode === 'READ_ONLY') {
    return state.activePermissions.includes(permission.toUpperCase());
  }
  const revoked = getRevokedCapabilities(agentId);
  if (revoked.includes(permission.toUpperCase())) return false;
  return true;
}

export function resetCapabilityRevocation(agentId?: string): void {
  if (agentId) {
    permissionStore.delete(agentId);
    return;
  }
  permissionStore.clear();
}
