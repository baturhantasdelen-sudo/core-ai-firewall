import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  buildMockThreatIndicators,
  listThreatIndicators,
  publishThreatIndicator,
  resetThreatIntelStore,
  syncCollectiveThreats,
} from '../lib/threat-intel/index.ts';
import {
  buildMockAgentPassports,
  issueAgentPassport,
  resetTrustNetworkStore,
  revokeAgentPassport,
  suspendAgentPassport,
  verifyAgentPassport,
} from '../lib/trust-network/index.ts';

describe('P3 Collective Threat Intelligence Engine', () => {
  afterEach(() => {
    resetThreatIntelStore();
  });

  it('publishThreatIndicator anonymizes and stores IOC', () => {
    const result = publishThreatIndicator({
      threatType: 'MALICIOUS_MCP_TOOL',
      rawPattern: 'execute_shell on rogue-mcp — agent-secret-007',
      severity: 'CRITICAL',
      sourceAgentId: 'agent-secret-007',
      sourceOrgId: 'tenant-acme',
    });

    assert.equal(result.published, true);
    assert.ok(result.indicator?.indicatorHash.length >= 64);
    assert.ok(result.indicator?.anonymizedSource.startsWith('anon_'));
    assert.ok(!result.indicator?.patternSummary.includes('agent-secret-007'));
  });

  it('syncCollectiveThreats merges external feed indicators', () => {
    const result = syncCollectiveThreats();
    assert.ok(result.synced >= 4);
    assert.ok(result.totalIndicators >= 4);
    assert.ok(result.feedSignals.length >= 4);
  });

  it('buildMockThreatIndicators seeds local and global feed', () => {
    const indicators = buildMockThreatIndicators();
    assert.ok(indicators.length >= 4);
    assert.ok(indicators.some((indicator) => indicator.threatType === 'VECTOR_POISON_PATTERN'));
  });
});

describe('P3 Cross-Enterprise Agent Trust Network', () => {
  afterEach(() => {
    resetTrustNetworkStore();
  });

  it('issueAgentPassport and verifyAgentPassport for B2B trust', () => {
    const passport = issueAgentPassport({
      agentId: 'agent-b2b-1',
      agentName: 'Partner Agent',
      organizationId: 'partner-org',
      reputationScore: 90,
      trustTier: 'VERIFIED',
      evidenceProofHash: 'proof-hash-abc',
      jitScopes: ['READ'],
    });

    const verification = verifyAgentPassport(passport);
    assert.equal(verification.valid, true);
    assert.equal(verification.trustLevel, 'FULL_TRUST');
    assert.equal(verification.b2bAllowed, true);
  });

  it('revokeAgentPassport denies B2B verification', () => {
    const passport = issueAgentPassport({
      agentId: 'agent-revoke',
      agentName: 'Revoked Agent',
      organizationId: 'partner-org',
      reputationScore: 80,
      trustTier: 'NEUTRAL',
      evidenceProofHash: 'proof-hash-revoke',
      jitScopes: ['READ'],
    });

    revokeAgentPassport(passport.passportId);
    const verification = verifyAgentPassport({ ...passport, status: 'REVOKED' });
    assert.equal(verification.valid, false);
    assert.equal(verification.trustLevel, 'DENIED');
    assert.ok(verification.restrictions.includes('PASSPORT_REVOKED'));
  });

  it('suspendAgentPassport blocks verification', () => {
    const passport = issueAgentPassport({
      agentId: 'agent-suspend',
      agentName: 'Suspended Agent',
      organizationId: 'partner-org',
      reputationScore: 75,
      trustTier: 'NEUTRAL',
      evidenceProofHash: 'proof-hash-suspend',
      jitScopes: ['READ'],
    });

    suspendAgentPassport(passport.passportId);
    const verification = verifyAgentPassport({ ...passport, status: 'SUSPENDED' });
    assert.equal(verification.valid, false);
    assert.ok(verification.restrictions.includes('PASSPORT_SUSPENDED'));
  });

  it('buildMockAgentPassports seeds verifiable fleet', () => {
    const passports = buildMockAgentPassports();
    assert.equal(passports.length, 2);
    assert.ok(passports.every((passport) => verifyAgentPassport(passport).valid || passport.reputationScore < 60));
  });
});

describe('P3 Threat intel + trust network integration', () => {
  afterEach(() => {
    resetThreatIntelStore();
    resetTrustNetworkStore();
  });

  it('listThreatIndicators available after sync for mesh dashboard', () => {
    syncCollectiveThreats();
    buildMockAgentPassports();
    assert.ok(listThreatIndicators().length >= 4);
  });
});
