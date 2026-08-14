import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  evaluateAgentAction,
  getKillSwitchState,
  resetActionFirewallRuntime,
} from '../lib/engine/action-firewall/index.ts';
import { resetThreatRegistry } from '../lib/engine/immune/index.ts';

describe('action firewall & intent-action engine', () => {
  afterEach(() => {
    resetActionFirewallRuntime();
    resetThreatRegistry();
  });

  it('allows tool calls that match granted capabilities and intent', () => {
    const result = evaluateAgentAction({
      agentId: 'support-agent-1',
      userIntent: 'Invoice Check for customer #4421',
      toolCall: { name: 'read_invoice', args: { customer_id: '4421' } },
      agentCapabilities: ['READ', 'API_CALL'],
    });

    assert.equal(result.decision, 'ALLOW');
    assert.ok(result.riskScore < 40);
    assert.ok(result.intentMatchScore >= 60);
    assert.equal(result.killSwitchTriggered, false);
    assert.equal(result.violations.length, 0);
  });

  it('blocks intent-action mismatch for invoice check vs bulk DB export', () => {
    const result = evaluateAgentAction({
      agentId: 'ops-agent-1',
      userIntent: 'Invoice Check for customer #4421',
      toolCall: { name: 'bulk_export_db', args: { table: 'customers' } },
      agentCapabilities: ['READ', 'API_CALL'],
    });

    assert.equal(result.decision, 'BLOCK');
    assert.ok(result.riskScore > 85);
    assert.ok(result.intentMatchScore < 50);
    assert.equal(result.killSwitchTriggered, true);
    assert.ok(result.violations.some((violation) => /DB_QUERY|bulk database export/i.test(violation)));
    assert.equal(getKillSwitchState('ops-agent-1').status, 'FROZEN');
  });

  it('requires human approval for unauthorized financial actions', () => {
    resetThreatRegistry({ skipSeed: true });

    const result = evaluateAgentAction({
      agentId: 'assistant-1',
      userIntent: 'Review account balance',
      toolCall: { name: 'stripe_transfer', args: { amount: 5000, currency: 'try' } },
      agentCapabilities: ['READ', 'API_CALL'],
    });

    assert.equal(result.decision, 'HUMAN_APPROVAL_REQUIRED');
    assert.ok(result.riskScore >= 40);
    assert.ok(result.violations.some((violation) => /FINANCIAL/i.test(violation)));
    assert.equal(result.killSwitchTriggered, false);
  });

  it('blocks subsequent calls after kill switch is triggered', () => {
    evaluateAgentAction({
      agentId: 'frozen-agent',
      userIntent: 'Invoice Check',
      toolCall: { name: 'bulk_export_db', args: { table: 'invoices' } },
      agentCapabilities: ['READ'],
    });

    const followUp = evaluateAgentAction({
      agentId: 'frozen-agent',
      userIntent: 'Read invoice summary',
      toolCall: { name: 'read_invoice', args: { id: '1' } },
      agentCapabilities: ['READ'],
    });

    assert.equal(followUp.decision, 'BLOCK');
    assert.equal(followUp.agentStatus, 'FROZEN');
    assert.equal(followUp.riskScore, 100);
    assert.match(followUp.violations[0], /FROZEN by kill switch/i);
  });

  it('evaluates sub-10ms for standard action checks', () => {
    const started = performance.now();
    const result = evaluateAgentAction({
      agentId: 'perf-agent',
      userIntent: 'Find shipping update',
      toolCall: { name: 'web_search', args: { query: 'order 7781' } },
      agentCapabilities: ['WEB_SEARCH', 'READ'],
    });
    const elapsed = performance.now() - started;

    assert.equal(result.decision, 'ALLOW');
    assert.ok((result.latencyMs ?? elapsed) < 10);
  });
});
