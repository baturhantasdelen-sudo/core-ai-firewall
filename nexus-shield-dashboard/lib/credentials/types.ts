/**
 * P1 Sprint 11-12 — Just-In-Time Ephemeral Credentials types.
 */

export type CredentialScope = 'READ' | 'WRITE' | 'EXECUTE';

export type CredentialStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface JitCredential {
  tokenId: string;
  agentId: string;
  targetResource: string;
  scope: CredentialScope;
  issuedAt: string;
  expiresAt: string;
  status: CredentialStatus;
  riskScoreAtIssue: number;
}

export interface CredentialRequest {
  agentId: string;
  targetResource: string;
  scope: CredentialScope;
  actionType?: string;
  riskScore?: number;
  ttlSeconds?: number;
}

export interface CredentialRequestResult {
  granted: boolean;
  credential?: JitCredential;
  reason?: string;
}

export interface CredentialRevokeResult {
  revoked: boolean;
  tokenId: string;
  reason?: string;
}

export const DEFAULT_JIT_TTL_SECONDS = 30;
export const CRITICAL_RISK_REVOKE_THRESHOLD = 80;
export const CRITICAL_RISK_DENY_THRESHOLD = 85;

export function isActiveCredential(credential: JitCredential): boolean {
  if (credential.status !== 'ACTIVE') return false;
  return Date.parse(credential.expiresAt) > Date.now();
}

export function remainingTtlMs(credential: JitCredential): number {
  return Math.max(0, Date.parse(credential.expiresAt) - Date.now());
}

export function ttlPercentRemaining(credential: JitCredential, ttlSeconds: number): number {
  const totalMs = ttlSeconds * 1000;
  const remaining = remainingTtlMs(credential);
  return Math.round((remaining / totalMs) * 100);
}
