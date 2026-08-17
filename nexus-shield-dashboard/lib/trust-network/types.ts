/**
 * P3 Sprint 19-20 — Cross-Enterprise Agent Trust Network types.
 */

export type PassportStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export type B2BTrustLevel = 'FULL_TRUST' | 'LIMITED_TRUST' | 'DENIED';

export interface AgentPassport {
  passportId: string;
  agentId: string;
  agentName: string;
  organizationHash: string;
  reputationScore: number;
  trustTier: string;
  evidenceProofHash: string;
  jitScopes: string[];
  cryptographicSignature: string;
  issuedAt: string;
  expiresAt: string;
  status: PassportStatus;
}

export interface PassportVerification {
  valid: boolean;
  passportId: string;
  agentId: string;
  trustLevel: B2BTrustLevel;
  b2bAllowed: boolean;
  restrictions: string[];
  reason?: string;
  verifiedAt: string;
}

export interface IssuePassportInput {
  agentId: string;
  agentName: string;
  organizationId: string;
  reputationScore: number;
  trustTier: string;
  evidenceProofHash: string;
  jitScopes: string[];
  ttlHours?: number;
}

export interface PassportActionResult {
  success: boolean;
  passportId: string;
  newStatus: PassportStatus;
  reason?: string;
}

export interface B2BTrustMatrixEntry {
  sourceOrgHash: string;
  targetOrgHash: string;
  trustLevel: B2BTrustLevel;
  allowedInteractions: string[];
}
