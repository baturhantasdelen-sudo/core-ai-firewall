import { createHash, createHmac } from 'node:crypto';
import type {
  AgentPassport,
  B2BTrustLevel,
  B2BTrustMatrixEntry,
  IssuePassportInput,
  PassportActionResult,
  PassportStatus,
  PassportVerification,
} from '@/lib/trust-network/types';

const SIGNING_SECRET = process.env.NEXUS_PASSPORT_SIGNING_SECRET ?? 'nexus-shield-passport-p3-dev-key';

const passportStore = new Map<string, AgentPassport>();
const suspendedPassports = new Set<string>();
const revokedPassports = new Set<string>();

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function signPassportPayload(payload: string): string {
  return createHmac('sha256', SIGNING_SECRET).update(payload, 'utf8').digest('hex');
}

function orgHash(organizationId: string): string {
  return `org_${sha256(organizationId).slice(0, 12)}`;
}

function generatePassportId(agentId: string): string {
  return `pass_${sha256(`${agentId}:${Date.now()}`).slice(0, 14)}`;
}

function resolveB2BTrustLevel(reputationScore: number, status: PassportStatus): B2BTrustLevel {
  if (status === 'REVOKED' || status === 'SUSPENDED') return 'DENIED';
  if (reputationScore >= 85) return 'FULL_TRUST';
  if (reputationScore >= 60) return 'LIMITED_TRUST';
  return 'DENIED';
}

function verifySignature(passport: AgentPassport): boolean {
  const payload = [
    passport.passportId,
    passport.agentId,
    passport.organizationHash,
    passport.reputationScore,
    passport.trustTier,
    passport.evidenceProofHash,
    passport.jitScopes.join(','),
    passport.issuedAt,
    passport.expiresAt,
    passport.status,
  ].join('|');

  return signPassportPayload(payload) === passport.cryptographicSignature;
}

/**
 * Issues a verifiable cross-enterprise agent passport.
 */
export function issueAgentPassport(input: IssuePassportInput): AgentPassport {
  const issuedAtMs = Date.now();
  const ttlHours = input.ttlHours ?? 24;
  const issuedAt = new Date(issuedAtMs).toISOString();
  const expiresAt = new Date(issuedAtMs + ttlHours * 3600_000).toISOString();
  const passportId = generatePassportId(input.agentId);
  const organizationHash = orgHash(input.organizationId);
  const status: PassportStatus = 'ACTIVE';

  const payload = [
    passportId,
    input.agentId,
    organizationHash,
    input.reputationScore,
    input.trustTier,
    input.evidenceProofHash,
    input.jitScopes.join(','),
    issuedAt,
    expiresAt,
    status,
  ].join('|');

  const passport: AgentPassport = {
    passportId,
    agentId: input.agentId,
    agentName: input.agentName,
    organizationHash,
    reputationScore: input.reputationScore,
    trustTier: input.trustTier,
    evidenceProofHash: input.evidenceProofHash,
    jitScopes: input.jitScopes,
    cryptographicSignature: signPassportPayload(payload),
    issuedAt,
    expiresAt,
    status,
  };

  passportStore.set(passportId, passport);
  return passport;
}

/**
 * Verifies agent passport for B2B cross-enterprise interactions.
 */
export function verifyAgentPassport(passport: AgentPassport): PassportVerification {
  const now = Date.now();
  const verifiedAt = new Date().toISOString();

  if (revokedPassports.has(passport.passportId) || passport.status === 'REVOKED') {
    return {
      valid: false,
      passportId: passport.passportId,
      agentId: passport.agentId,
      trustLevel: 'DENIED',
      b2bAllowed: false,
      restrictions: ['PASSPORT_REVOKED'],
      reason: 'Passport revoked — B2B interaction denied',
      verifiedAt,
    };
  }

  if (suspendedPassports.has(passport.passportId) || passport.status === 'SUSPENDED') {
    return {
      valid: false,
      passportId: passport.passportId,
      agentId: passport.agentId,
      trustLevel: 'DENIED',
      b2bAllowed: false,
      restrictions: ['PASSPORT_SUSPENDED'],
      reason: 'Passport suspended pending review',
      verifiedAt,
    };
  }

  if (Date.parse(passport.expiresAt) <= now) {
    return {
      valid: false,
      passportId: passport.passportId,
      agentId: passport.agentId,
      trustLevel: 'DENIED',
      b2bAllowed: false,
      restrictions: ['PASSPORT_EXPIRED'],
      reason: 'Passport expired',
      verifiedAt,
    };
  }

  if (!verifySignature(passport)) {
    return {
      valid: false,
      passportId: passport.passportId,
      agentId: passport.agentId,
      trustLevel: 'DENIED',
      b2bAllowed: false,
      restrictions: ['SIGNATURE_INVALID'],
      reason: 'Cryptographic signature verification failed',
      verifiedAt,
    };
  }

  const trustLevel = resolveB2BTrustLevel(passport.reputationScore, passport.status);
  const b2bAllowed = trustLevel !== 'DENIED';
  const restrictions =
    trustLevel === 'FULL_TRUST'
      ? []
      : trustLevel === 'LIMITED_TRUST'
        ? ['READ_ONLY_B2B', 'REQUIRE_COUNTERPARTY_APPROVAL']
        : ['B2B_DENIED'];

  return {
    valid: b2bAllowed,
    passportId: passport.passportId,
    agentId: passport.agentId,
    trustLevel,
    b2bAllowed,
    restrictions,
    reason: b2bAllowed
      ? `B2B trust verified — ${trustLevel}`
      : 'Reputation score too low for cross-enterprise trust',
    verifiedAt,
  };
}

export function suspendAgentPassport(passportId: string, reason?: string): PassportActionResult {
  const passport = passportStore.get(passportId);
  if (!passport) {
    return { success: false, passportId, newStatus: 'REVOKED', reason: 'Passport not found' };
  }

  passport.status = 'SUSPENDED';
  suspendedPassports.add(passportId);
  passportStore.set(passportId, passport);

  return {
    success: true,
    passportId,
    newStatus: 'SUSPENDED',
    reason: reason ?? 'Passport suspended by trust network operator',
  };
}

export function revokeAgentPassport(passportId: string, reason?: string): PassportActionResult {
  const passport = passportStore.get(passportId);
  if (!passport) {
    return { success: false, passportId, newStatus: 'REVOKED', reason: 'Passport not found' };
  }

  passport.status = 'REVOKED';
  revokedPassports.add(passportId);
  passportStore.set(passportId, passport);

  return {
    success: true,
    passportId,
    newStatus: 'REVOKED',
    reason: reason ?? 'Passport revoked — agent removed from trust network',
  };
}

export function listAgentPassports(): AgentPassport[] {
  return [...passportStore.values()].sort(
    (a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt),
  );
}

export function getAgentPassport(passportId: string): AgentPassport | undefined {
  return passportStore.get(passportId);
}

export function buildB2BTrustMatrix(): B2BTrustMatrixEntry[] {
  const passports = listAgentPassports();
  const orgs = [...new Set(passports.map((passport) => passport.organizationHash))];

  const matrix: B2BTrustMatrixEntry[] = [];
  for (const source of orgs) {
    for (const target of orgs) {
      if (source === target) continue;
      const sourcePassport = passports.find((passport) => passport.organizationHash === source);
      const score = sourcePassport?.reputationScore ?? 70;
      const trustLevel: B2BTrustLevel =
        score >= 85 ? 'FULL_TRUST' : score >= 60 ? 'LIMITED_TRUST' : 'DENIED';

      matrix.push({
        sourceOrgHash: source,
        targetOrgHash: target,
        trustLevel,
        allowedInteractions:
          trustLevel === 'FULL_TRUST'
            ? ['DATA_EXCHANGE', 'TOOL_DELEGATION', 'EVIDENCE_SHARING']
            : trustLevel === 'LIMITED_TRUST'
              ? ['READ_ONLY_QUERY']
              : [],
      });
    }
  }

  return matrix.slice(0, 6);
}

export function resetTrustNetworkStore(): void {
  passportStore.clear();
  suspendedPassports.clear();
  revokedPassports.clear();
}

export function buildMockAgentPassports(): AgentPassport[] {
  resetTrustNetworkStore();

  return [
    issueAgentPassport({
      agentId: 'langchain-support-agent-1',
      agentName: 'Support Agent',
      organizationId: 'nexus-tenant-acme',
      reputationScore: 92,
      trustTier: 'VERIFIED',
      evidenceProofHash: sha256('evidence-support-bundle'),
      jitScopes: ['READ'],
    }),
    issueAgentPassport({
      agentId: 'crewai-ops-agent-1',
      agentName: 'Ops Coordinator',
      organizationId: 'nexus-tenant-acme',
      reputationScore: 68,
      trustTier: 'NEUTRAL',
      evidenceProofHash: sha256('evidence-ops-bundle'),
      jitScopes: ['READ', 'WRITE'],
    }),
  ];
}
