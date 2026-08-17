import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  autoRemediateVulnerabilities,
  resetRedTeamStore,
  runRedTeamSimulation,
} from '../lib/redteam/index.ts';
import {
  resetCapabilityRevocation,
  resetKillSwitchState,
} from '../lib/engine/action-firewall/index.ts';
import { resetTrajectory } from '../lib/engine/action-firewall/trajectory.ts';

const limitedAgent = {
  agentId: 'rt-test-limited',
  agentName: 'Limited Agent',
  capabilities: ['READ', 'API_CALL'],
};

const privilegedAgent = {
  agentId: 'rt-test-privileged',
  agentName: 'Privileged Agent',
  capabilities: ['READ', 'EXECUTE', 'DB_QUERY', 'FINANCIAL', 'API_CALL'],
};

describe('P2 Continuous Agent Red Teaming Engine', () => {
  afterEach(() => {
    resetRedTeamStore();
    resetKillSwitchState();
    resetCapabilityRevocation();
    resetTrajectory();
  });

  it('runRedTeamSimulation returns resilience score and attack outcomes', () => {
    const result = runRedTeamSimulation(limitedAgent);

    assert.ok(result.simulationId.startsWith('sim_'));
    assert.equal(result.agentId, limitedAgent.agentId);
    assert.ok(result.outcomes.length >= 5);
    assert.ok(result.resilienceScore >= 0 && result.resilienceScore <= 100);
    assert.ok(['EXCELLENT', 'MODERATE', 'VULNERABLE', 'CRITICAL'].includes(result.riskRating));
  });

  it('limited-capability agent blocks attack vectors with high resilience', () => {
    const result = runRedTeamSimulation(limitedAgent);

    assert.ok(result.resilienceScore >= 80);
    assert.equal(result.exposedCount, 0);
    assert.equal(result.vulnerabilities.length, 0);
  });

  it('privileged agent simulation includes escalation vector and comparable scoring', () => {
    const limited = runRedTeamSimulation(limitedAgent);
    const result = runRedTeamSimulation(privilegedAgent);

    assert.ok(result.outcomes.some((outcome) => outcome.attackVector === 'PRIVILEGE_ESCALATION'));
    assert.ok(result.resilienceScore >= 0 && result.resilienceScore <= 100);
    assert.ok(limited.resilienceScore >= result.resilienceScore);
  });

  it('autoRemediateVulnerabilities patches exposed vectors', () => {
    const privileged = runRedTeamSimulation({
      ...privilegedAgent,
      capabilities: ['READ', 'EXECUTE', 'DB_QUERY', 'FINANCIAL', 'API_CALL'],
    });

    if (privileged.vulnerabilities.length === 0) {
      assert.ok(privileged.resilienceScore >= 80);
      return;
    }

    const before = privileged.resilienceScore;
    const remediated = autoRemediateVulnerabilities(privileged.simulationId);

    assert.ok(remediated.remediated.length > 0);
    assert.ok(remediated.resilienceScoreAfter >= before);
    assert.equal(remediated.remainingVulnerabilities.length, 0);
  });

  it('covers all required attack vector types', () => {
    const result = runRedTeamSimulation(limitedAgent);
    const vectors = new Set(result.outcomes.map((outcome) => outcome.attackVector));

    assert.ok(vectors.has('PROMPT_INJECTION'));
    assert.ok(vectors.has('JAILBREAK'));
    assert.ok(vectors.has('TOOL_ABUSE'));
    assert.ok(vectors.has('PRIVILEGE_ESCALATION'));
    assert.ok(vectors.has('INDIRECT_INJECTION'));
  });
});
