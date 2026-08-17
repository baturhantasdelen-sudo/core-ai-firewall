import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  __testExpireToken,
  DEFAULT_JIT_TTL_SECONDS,
  listActiveJitCredentials,
  purgeExpiredTokens,
  requestJitCredential,
  resetJitCredentialBrokerStore,
  revokeAgentTokensOnRiskEscalation,
  revokeJitCredential,
} from '../lib/credentials/index.ts';

describe('P1 JIT Credential Broker', () => {
  afterEach(() => {
    resetJitCredentialBrokerStore();
  });

  it('issues ACTIVE token with 30s default TTL', () => {
    const result = requestJitCredential({
      agentId: 'agent-1',
      targetResource: 'invoices/read',
      scope: 'READ',
      riskScore: 10,
    });

    assert.equal(result.granted, true);
    assert.ok(result.credential);
    assert.equal(result.credential!.status, 'ACTIVE');
    assert.equal(result.credential!.scope, 'READ');

    const issuedMs = Date.parse(result.credential!.issuedAt);
    const expiresMs = Date.parse(result.credential!.expiresAt);
    assert.equal(Math.round((expiresMs - issuedMs) / 1000), DEFAULT_JIT_TTL_SECONDS);
  });

  it('denies credential when risk score exceeds policy threshold', () => {
    const result = requestJitCredential({
      agentId: 'agent-risky',
      targetResource: 'customer-database/export',
      scope: 'WRITE',
      riskScore: 90,
    });

    assert.equal(result.granted, false);
    assert.ok(result.reason?.includes('Policy denied'));
    assert.equal(listActiveJitCredentials().length, 0);
  });

  it('revokes token immediately via revokeJitCredential', () => {
    const result = requestJitCredential({
      agentId: 'agent-2',
      targetResource: 'shell/run',
      scope: 'EXECUTE',
      riskScore: 20,
    });

    assert.equal(result.granted, true);
    const revoked = revokeJitCredential(result.credential!.tokenId);
    assert.equal(revoked.revoked, true);
    assert.equal(listActiveJitCredentials().length, 0);
  });

  it('purges expired tokens', () => {
    const result = requestJitCredential({
      agentId: 'agent-3',
      targetResource: 'db/query',
      scope: 'READ',
      riskScore: 5,
    });

    __testExpireToken(result.credential!.tokenId);
    const purged = purgeExpiredTokens();
    assert.equal(purged, 1);
    assert.equal(listActiveJitCredentials().length, 0);
  });

  it('revokes all agent tokens on critical risk escalation', () => {
    requestJitCredential({
      agentId: 'agent-escalate',
      targetResource: 'invoices/read',
      scope: 'READ',
      riskScore: 15,
    });
    requestJitCredential({
      agentId: 'agent-escalate',
      targetResource: 'orders/read',
      scope: 'READ',
      riskScore: 15,
    });

    assert.equal(listActiveJitCredentials('agent-escalate').length, 2);

    const result = revokeAgentTokensOnRiskEscalation('agent-escalate', 92);
    assert.equal(result.revokedCount, 2);
    assert.equal(listActiveJitCredentials('agent-escalate').length, 0);
  });

  it('blocks EXECUTE scope at elevated risk', () => {
    const result = requestJitCredential({
      agentId: 'agent-exec',
      targetResource: 'production/deploy',
      scope: 'EXECUTE',
      riskScore: 75,
    });

    assert.equal(result.granted, false);
    assert.ok(result.reason?.includes('EXECUTE'));
  });
});
