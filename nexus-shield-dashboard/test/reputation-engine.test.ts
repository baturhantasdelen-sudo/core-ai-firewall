import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  buildMockAgentReputations,
  calculateAgentReputation,
  getTrustPolicyAction,
  resetReputationEngineStore,
  simulatePositiveActivity,
  simulateSecurityViolation,
} from '../lib/reputation/index.ts';

describe('P2 Agent Reputation & Dynamic Trust Engine', () => {
  afterEach(() => {
    resetReputationEngineStore();
  });

  it('calculateAgentReputation produces score and trust tier', () => {
    const reputation = calculateAgentReputation({
      agentId: 'agent-1',
      agentName: 'Test Agent',
      metrics: {
        totalActions: 500,
        blockedActions: 10,
        evidenceVerificationRate: 92,
        resilienceScore: 88,
        memoryPoisonIncidents: 0,
      },
    });

    assert.ok(reputation.reputationScore >= 85);
    assert.equal(reputation.trustTier, 'VERIFIED');
    assert.ok(reputation.rationale.length > 0);
  });

  it('high violation and poison metrics downgrade to HIGH_RISK or UNTRUSTED', () => {
    const reputation = calculateAgentReputation({
      agentId: 'agent-risky',
      metrics: {
        totalActions: 200,
        blockedActions: 120,
        evidenceVerificationRate: 25,
        resilienceScore: 20,
        memoryPoisonIncidents: 4,
      },
    });

    assert.ok(reputation.reputationScore < 60);
    assert.ok(['HIGH_RISK', 'UNTRUSTED'].includes(reputation.trustTier));
  });

  it('getTrustPolicyAction returns restrictive action for low reputation', () => {
    const reputation = calculateAgentReputation({
      agentId: 'agent-freeze',
      metrics: {
        totalActions: 100,
        blockedActions: 80,
        evidenceVerificationRate: 15,
        resilienceScore: 10,
        memoryPoisonIncidents: 6,
      },
    });

    const policy = getTrustPolicyAction(reputation);
    assert.equal(policy.action, 'FREEZE_AGENT');
    assert.ok(policy.restrictions.includes('AGENT_FROZEN'));
  });

  it('getTrustPolicyAction allows verified agents', () => {
    const reputation = calculateAgentReputation({
      agentId: 'agent-verified',
      metrics: {
        totalActions: 1000,
        blockedActions: 5,
        evidenceVerificationRate: 98,
        resilienceScore: 95,
        memoryPoisonIncidents: 0,
      },
    });

    const policy = getTrustPolicyAction(reputation);
    assert.equal(policy.action, 'ALLOW_ALL');
    assert.equal(policy.restrictions.length, 0);
  });

  it('simulatePositiveActivity improves reputation score', () => {
    calculateAgentReputation({
      agentId: 'agent-sim',
      metrics: {
        totalActions: 100,
        blockedActions: 30,
        evidenceVerificationRate: 55,
        resilienceScore: 50,
        memoryPoisonIncidents: 2,
      },
    });

    const before = calculateAgentReputation({
      agentId: 'agent-sim',
      metrics: {
        totalActions: 100,
        blockedActions: 30,
        evidenceVerificationRate: 55,
        resilienceScore: 50,
        memoryPoisonIncidents: 2,
      },
    }).reputationScore;

    const after = simulatePositiveActivity('agent-sim').reputationScore;
    assert.ok(after >= before);
  });

  it('simulateSecurityViolation degrades reputation and policy', () => {
    buildMockAgentReputations();
    const before = simulatePositiveActivity('crewai-ops-agent-1').reputationScore;
    const afterRep = simulateSecurityViolation('crewai-ops-agent-1');
    const policy = getTrustPolicyAction(afterRep);

    assert.ok(afterRep.reputationScore < before);
    assert.ok(['RESTRICT_SENSITIVE_OPS', 'REQUIRE_HUMAN_APPROVAL', 'FREEZE_AGENT'].includes(policy.action));
  });

  it('buildMockAgentReputations seeds fleet with varied tiers', () => {
    const fleet = buildMockAgentReputations();
    assert.equal(fleet.length, 3);
    assert.ok(fleet.some((agent) => agent.trustTier === 'VERIFIED'));
    assert.ok(fleet.some((agent) => ['HIGH_RISK', 'UNTRUSTED', 'NEUTRAL'].includes(agent.trustTier)));
  });
});
