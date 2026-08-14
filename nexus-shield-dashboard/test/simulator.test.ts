import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { resetKillSwitchState, resetTrajectory } from '../lib/engine/action-firewall/index.ts';
import { resetThreatRegistry } from '../lib/engine/immune/index.ts';
import { runRedTeamSimulation } from '../lib/engine/simulator/index.ts';
import type { AgentAsset } from '../lib/engine/discovery/index.ts';

const limitedAgent: AgentAsset = {
  id: 'sim-test-limited-agent',
  name: 'Limited Support Agent',
  framework: 'OpenAI Assistants',
  sourceFile: 'src/agents/support.ts',
  capabilities: ['READ', 'API_CALL'],
  riskLevel: 'MEDIUM',
  mcpConnections: [],
};

const privilegedAgent: AgentAsset = {
  id: 'sim-test-privileged-agent',
  name: 'Privileged Ops Agent',
  framework: 'CrewAI',
  sourceFile: 'src/agents/ops.py',
  capabilities: ['EXECUTE', 'DB_QUERY', 'API_CALL', 'FINANCIAL', 'READ'],
  riskLevel: 'CRITICAL',
  mcpConnections: [],
};

describe('AI agent red teaming simulator', () => {
  afterEach(() => {
    resetKillSwitchState();
    resetThreatRegistry();
    resetTrajectory();
  });

  it('returns a simulation report with five attack vectors', () => {
    const report = runRedTeamSimulation(limitedAgent);

    assert.equal(report.agentId, limitedAgent.id);
    assert.equal(report.results.length, 5);
    assert.ok(report.resilienceScore >= 0 && report.resilienceScore <= 100);
    assert.ok(['EXCELLENT', 'MODERATE', 'VULNERABLE', 'CRITICAL'].includes(report.riskRating));
    assert.ok(report.timestamp);
  });

  it('scores limited-capability agents with high resilience', () => {
    const report = runRedTeamSimulation(limitedAgent);

    assert.ok(report.resilienceScore >= 80);
    assert.equal(report.riskRating, 'EXCELLENT');
    assert.ok(report.results.every((result) => result.status === 'PASSED_BLOCKED'));
  });

  it('scores privileged agents with equal or lower resilience than limited agents', () => {
    resetThreatRegistry({ skipSeed: true });

    const limitedReport = runRedTeamSimulation(limitedAgent);
    const privilegedReport = runRedTeamSimulation(privilegedAgent);

    assert.ok(limitedReport.resilienceScore >= privilegedReport.resilienceScore);
    assert.ok(privilegedReport.resilienceScore >= 0);
  });

  it('includes vector metadata and firewall responses for each probe', () => {
    const report = runRedTeamSimulation(limitedAgent);
    const vectors = report.results.map((result) => result.vector);

    assert.deepEqual(vectors, [
      'INDIRECT_PROMPT_INJECTION',
      'GOAL_HIJACKING',
      'PRIVILEGE_ESCALATION',
      'DATA_EXFILTRATION_TOOL_MISUSE',
      'SYSTEM_PROMPT_LEAKAGE',
    ]);

    for (const result of report.results) {
      assert.ok(result.payload.includes('userIntent'));
      assert.ok(result.response.includes('decision='));
      assert.ok(result.riskScore >= 0 && result.riskScore <= 100);
    }
  });

  it('derives risk rating from resilience score thresholds', () => {
    const excellent = runRedTeamSimulation(limitedAgent);
    assert.equal(excellent.riskRating, 'EXCELLENT');

    resetThreatRegistry({ skipSeed: true });
    const privileged = runRedTeamSimulation(privilegedAgent);
    assert.ok(['EXCELLENT', 'MODERATE', 'VULNERABLE', 'CRITICAL'].includes(privileged.riskRating));
  });
});
