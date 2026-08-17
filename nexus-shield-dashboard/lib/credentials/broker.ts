import {
  CRITICAL_RISK_DENY_THRESHOLD,
  CRITICAL_RISK_REVOKE_THRESHOLD,
  DEFAULT_JIT_TTL_SECONDS,
  isActiveCredential,
  type CredentialRequest,
  type CredentialRequestResult,
  type CredentialRevokeResult,
  type CredentialScope,
  type CredentialStatus,
  type JitCredential,
} from '@/lib/credentials/types';

const tokenStore = new Map<string, JitCredential>();
const agentRiskScores = new Map<string, number>();

const SENSITIVE_RESOURCES = /customer|payment|financial|database|credential|secret|production/i;

function generateTokenId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `jit_${hex.slice(0, 8)}_${hex.slice(8, 16)}`;
}

function evaluatePolicy(request: CredentialRequest): { allowed: boolean; reason?: string } {
  const riskScore = request.riskScore ?? agentRiskScores.get(request.agentId) ?? 0;

  if (riskScore >= CRITICAL_RISK_DENY_THRESHOLD) {
    return {
      allowed: false,
      reason: `Policy denied: agent risk score ${riskScore} exceeds deny threshold (${CRITICAL_RISK_DENY_THRESHOLD})`,
    };
  }

  if (request.scope === 'EXECUTE' && riskScore >= 70) {
    return {
      allowed: false,
      reason: `Policy denied: EXECUTE scope blocked at risk score ${riskScore} (threshold 70)`,
    };
  }

  if (request.scope === 'WRITE' && SENSITIVE_RESOURCES.test(request.targetResource) && riskScore >= 55) {
    return {
      allowed: false,
      reason: `Policy denied: WRITE on sensitive resource blocked at risk score ${riskScore}`,
    };
  }

  if (request.scope === 'EXECUTE' && /production|shell|deploy/i.test(request.targetResource) && riskScore >= 45) {
    return {
      allowed: false,
      reason: `Policy denied: production EXECUTE requires risk score below 45 (current ${riskScore})`,
    };
  }

  return { allowed: true };
}

function syncCredentialStatus(credential: JitCredential): CredentialStatus {
  if (credential.status === 'REVOKED') return 'REVOKED';
  if (Date.parse(credential.expiresAt) <= Date.now()) {
    credential.status = 'EXPIRED';
    return 'EXPIRED';
  }
  return 'ACTIVE';
}

/**
 * Issues a short-lived ephemeral credential after policy and risk evaluation.
 */
export function requestJitCredential(request: CredentialRequest): CredentialRequestResult {
  purgeExpiredTokens();

  const policy = evaluatePolicy(request);
  if (!policy.allowed) {
    return { granted: false, reason: policy.reason };
  }

  const ttlSeconds = request.ttlSeconds ?? DEFAULT_JIT_TTL_SECONDS;
  const issuedAtMs = Date.now();
  const expiresAtMs = issuedAtMs + ttlSeconds * 1000;
  const riskScore = request.riskScore ?? agentRiskScores.get(request.agentId) ?? 0;

  const credential: JitCredential = {
    tokenId: generateTokenId(),
    agentId: request.agentId,
    targetResource: request.targetResource,
    scope: request.scope,
    issuedAt: new Date(issuedAtMs).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
    status: 'ACTIVE',
    riskScoreAtIssue: riskScore,
  };

  tokenStore.set(credential.tokenId, credential);

  return { granted: true, credential };
}

/**
 * Immediately revokes an active ephemeral token.
 */
export function revokeJitCredential(tokenId: string, reason = 'Manual revocation'): CredentialRevokeResult {
  const credential = tokenStore.get(tokenId);
  if (!credential) {
    return { revoked: false, tokenId, reason: 'Token not found' };
  }

  if (credential.status === 'REVOKED') {
    return { revoked: true, tokenId, reason: 'Already revoked' };
  }

  credential.status = 'REVOKED';
  return { revoked: true, tokenId, reason };
}

/**
 * Marks expired tokens and removes stale entries from the active set.
 */
export function purgeExpiredTokens(): number {
  let purged = 0;

  for (const credential of tokenStore.values()) {
    if (credential.status === 'ACTIVE' && Date.parse(credential.expiresAt) <= Date.now()) {
      credential.status = 'EXPIRED';
      purged += 1;
    }
  }

  return purged;
}

/**
 * Revokes all active tokens for an agent when risk escalates to critical.
 */
export function revokeAgentTokensOnRiskEscalation(
  agentId: string,
  riskScore: number,
): { revokedCount: number; reason?: string } {
  agentRiskScores.set(agentId, riskScore);

  if (riskScore < CRITICAL_RISK_REVOKE_THRESHOLD) {
    return { revokedCount: 0, reason: `Risk ${riskScore} below auto-revoke threshold (${CRITICAL_RISK_REVOKE_THRESHOLD})` };
  }

  let revokedCount = 0;
  for (const credential of tokenStore.values()) {
    if (credential.agentId === agentId && isActiveCredential(credential)) {
      credential.status = 'REVOKED';
      revokedCount += 1;
    }
  }

  return {
    revokedCount,
    reason: `Risk escalation to ${riskScore} — ${revokedCount} token(s) revoked`,
  };
}

export function listActiveJitCredentials(agentId?: string): JitCredential[] {
  purgeExpiredTokens();
  const active = [...tokenStore.values()].filter((credential) => isActiveCredential(credential));
  if (agentId) return active.filter((credential) => credential.agentId === agentId);
  return active;
}

export function listAllJitCredentials(): JitCredential[] {
  purgeExpiredTokens();
  return [...tokenStore.values()].map((credential) => {
    syncCredentialStatus(credential);
    return { ...credential };
  });
}

export function getJitCredential(tokenId: string): JitCredential | undefined {
  const credential = tokenStore.get(tokenId);
  if (!credential) return undefined;
  syncCredentialStatus(credential);
  return { ...credential };
}

export function setAgentRiskScore(agentId: string, riskScore: number): void {
  agentRiskScores.set(agentId, riskScore);
  if (riskScore >= CRITICAL_RISK_REVOKE_THRESHOLD) {
    revokeAgentTokensOnRiskEscalation(agentId, riskScore);
  }
}

/** Test helper — force token expiry without waiting */
export function __testExpireToken(tokenId: string): void {
  const credential = tokenStore.get(tokenId);
  if (!credential) return;
  credential.expiresAt = new Date(Date.now() - 1000).toISOString();
}

export function resetJitCredentialBrokerStore(): void {
  tokenStore.clear();
  agentRiskScores.clear();
}
