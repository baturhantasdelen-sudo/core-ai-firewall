import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  evaluateActionFirewall,
  resetFirewallState,
  simulateDegradeMode,
} from '../lib/firewall/index.ts';
import {
  buildDemoExfiltrationChain,
  evaluateTrajectory,
  resetTrajectoryStore,
} from '../lib/trajectory/index.ts';
import { TRAJECTORY_HIGH_RISK_THRESHOLD } from '../lib/trajectory/types.ts';

const AGENT_ID = 'traj-test-agent';

describe('P0 Trajectory Engine', () => {
  afterEach(() => {
    resetTrajectoryStore();
    resetFirewallState();
  });

  it('detects ReadInvoice → ReadCustomerDB → GetCredentials → ExternalAPI chain', () => {
    const result = buildDemoExfiltrationChain(AGENT_ID, 'Test Agent');
    assert.equal(result.actionVector.length, 4);
    assert.ok(result.risk.sequenceViolationDetected);
    assert.ok(result.risk.score > TRAJECTORY_HIGH_RISK_THRESHOLD);
    assert.match(result.risk.matchedPattern ?? '', /READ_INVOICE/i);
  });

  it('evaluateTrajectory accumulates steps in 30s window', () => {
    const now = Date.now();
    const eval1 = evaluateTrajectory(AGENT_ID, [
      { id: 'a1', toolName: 'read_invoice', timestamp: new Date(now).toISOString() },
    ]);
    assert.equal(eval1.chain.steps.length, 1);

    const eval2 = evaluateTrajectory(AGENT_ID, [
      { id: 'a2', toolName: 'external_api', timestamp: new Date(now + 1000).toISOString() },
    ]);
    assert.equal(eval2.chain.steps.length, 2);
  });
});

describe('P0 Adaptive Action Firewall', () => {
  afterEach(() => {
    resetFirewallState();
  });

  it('LEVEL 0 ALLOW for low trajectory risk', () => {
    const result = evaluateActionFirewall({
      agentId: AGENT_ID,
      toolName: 'read_file',
      trajectoryRiskScore: 0.2,
      trajectoryViolation: false,
    });
    assert.equal(result.degradationLevel, 0);
    assert.equal(result.decision, 'ALLOW');
    assert.equal(result.intercepted, false);
  });

  it('LEVEL 2 RESTRICTED for high trajectory risk', () => {
    const result = evaluateActionFirewall({
      agentId: AGENT_ID,
      toolName: 'external_api',
      trajectoryRiskScore: 0.88,
      trajectoryViolation: true,
    });
    assert.ok(result.degradationLevel >= 2);
    assert.ok(result.degradation.jitTokensRevoked || result.degradation.externalApiBlocked);
  });

  it('simulateDegradeMode sets human approval flag', () => {
    const state = simulateDegradeMode(AGENT_ID);
    assert.equal(state.level, 1);
    assert.equal(state.humanApprovalRequired, true);
  });
});
