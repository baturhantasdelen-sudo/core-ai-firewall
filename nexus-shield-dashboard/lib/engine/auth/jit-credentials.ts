export interface CapabilityToken {
  token: string;
  agentId: string;
  scope: string;
  issuedAt: string;
  expiresAt: string;
  revoked: boolean;
}

export interface IssueTokenResult {
  token: string;
  agentId: string;
  scope: string;
  expiresAt: string;
  durationSeconds: number;
}

export interface ValidateTokenResult {
  valid: boolean;
  expired: boolean;
  revoked: boolean;
  agentId?: string;
  scope?: string;
  reason?: string;
}

const tokenStore = new Map<string, CapabilityToken>();
const revokedStaticCredentials = new Set<string>();

const DEFAULT_DURATION_SECONDS = 60;

function generateToken(): string {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `jit_${hex.slice(0, 16)}_${hex.slice(16, 28)}`;
}

export function issueTemporaryCapabilityToken(
  agentId: string,
  scope: string,
  durationSeconds = DEFAULT_DURATION_SECONDS,
): IssueTokenResult {
  const issuedAtMs = Date.now();
  const effectiveDuration = Math.max(0, durationSeconds);
  const expiresAtMs = issuedAtMs + effectiveDuration * 1000;

  const token = generateToken();
  const record: CapabilityToken = {
    token,
    agentId,
    scope: scope.toUpperCase(),
    issuedAt: new Date(issuedAtMs).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
    revoked: false,
  };

  tokenStore.set(token, record);

  return {
    token,
    agentId,
    scope: record.scope,
    expiresAt: record.expiresAt,
    durationSeconds: effectiveDuration,
  };
}

export function validateCapabilityToken(token: string): ValidateTokenResult {
  const record = tokenStore.get(token);
  if (!record) {
    return { valid: false, expired: false, revoked: false, reason: 'Token not found' };
  }

  if (record.revoked) {
    return {
      valid: false,
      expired: false,
      revoked: true,
      agentId: record.agentId,
      scope: record.scope,
      reason: 'Token revoked',
    };
  }

  const expired = Date.now() > new Date(record.expiresAt).getTime();
  if (expired) {
    record.revoked = true;
    return {
      valid: false,
      expired: true,
      revoked: false,
      agentId: record.agentId,
      scope: record.scope,
      reason: 'Capability Expired',
    };
  }

  return {
    valid: true,
    expired: false,
    revoked: false,
    agentId: record.agentId,
    scope: record.scope,
  };
}

export function revokeCapabilityToken(token: string): boolean {
  const record = tokenStore.get(token);
  if (!record) return false;
  record.revoked = true;
  return true;
}

export function completeActionAndInvalidateToken(token: string): ValidateTokenResult {
  revokeCapabilityToken(token);
  return validateCapabilityToken(token);
}

export function revokeAllStaticCredentials(agentId: string): {
  agentId: string;
  revoked: boolean;
  message: string;
} {
  revokedStaticCredentials.add(agentId);

  for (const record of tokenStore.values()) {
    if (record.agentId === agentId) {
      record.revoked = true;
    }
  }

  return {
    agentId,
    revoked: true,
    message: `All static credentials flagged for revocation on agent ${agentId}`,
  };
}

export function hasRevokedStaticCredentials(agentId: string): boolean {
  return revokedStaticCredentials.has(agentId);
}

export function listActiveTokens(agentId?: string): CapabilityToken[] {
  const tokens = [...tokenStore.values()].filter((record) => !record.revoked);
  if (agentId) return tokens.filter((record) => record.agentId === agentId);
  return tokens;
}

export function resetJitCredentialStore(): void {
  tokenStore.clear();
  revokedStaticCredentials.clear();
}

/** Test helper — force token expiry without waiting */
export function __testExpireToken(token: string): void {
  const record = tokenStore.get(token);
  if (!record) return;
  record.expiresAt = new Date(Date.now() - 1000).toISOString();
}
