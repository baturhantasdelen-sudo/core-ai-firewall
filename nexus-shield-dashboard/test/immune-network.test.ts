import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { evaluateAgentAction, resetKillSwitchState } from '../lib/engine/action-firewall/index.ts';
import {
  checkImmuneNetworkSignatures,
  generateThreatSignature,
  listThreatSignatures,
  registerThreatSignature,
  resetThreatRegistry,
  shouldGenerateThreatSignature,
} from '../lib/engine/immune/index.ts';

describe('collective behavioral immune network', () => {
  afterEach(() => {
    resetKillSwitchState();
    resetThreatRegistry();
  });

  it('generates anonymized threat signatures without raw PII or agent identifiers', () => {
    const signature = generateThreatSignature({
      toolSequence: ['bulk_export_db'],
      intentAnomalyTags: ['invoice', 'read'],
      violatedCapabilities: ['DB_QUERY'],
      riskScore: 91,
      killSwitchTriggered: true,
    });

    assert.ok(signature);
    const serialized = JSON.stringify(signature);
    assert.doesNotMatch(serialized, /crewai-finance-agent-1/i);
    assert.doesNotMatch(serialized, /customer #4421/i);
    assert.doesNotMatch(serialized, /external_api/i);
    assert.ok(signature!.pattern.includes('tool:bulk_export'));
    assert.ok(signature!.pattern.includes('missing_cap:DB_QUERY'));
    assert.equal(signature!.category, 'DATA_EXFILTRATION');
    assert.equal(signature!.severity, 'CRITICAL');
    assert.match(signature!.id, /^TS-/);
  });

  it('does not generate signatures for low-risk actions', () => {
    const signature = generateThreatSignature({
      toolSequence: ['read_invoice'],
      intentAnomalyTags: ['invoice', 'read'],
      violatedCapabilities: [],
      riskScore: 20,
      killSwitchTriggered: false,
    });

    assert.equal(signature, null);
    assert.equal(shouldGenerateThreatSignature({ toolSequence: [], intentAnomalyTags: [], violatedCapabilities: [], riskScore: 20, killSwitchTriggered: false }), false);
  });

  it('registers and lists immune signatures through the registry', () => {
    const signature = registerThreatSignature({
      id: 'TS-TEST1234',
      signatureHash: 'abc123def456',
      category: 'TOOL_MISUSE',
      pattern: ['tool:execute', 'missing_cap:EXECUTE'],
      severity: 'HIGH',
      createdAt: new Date().toISOString(),
    });

    const listed = listThreatSignatures();
    assert.ok(listed.some((entry) => entry.id === signature.id));
  });

  it('matches collective threat signatures and boosts action firewall risk', () => {
    registerThreatSignature({
      id: 'TS-COLLECTIVE1',
      signatureHash: 'collective-test-hash',
      category: 'DATA_EXFILTRATION',
      pattern: ['intent:invoice', 'intent:read', 'missing_cap:DB_QUERY', 'tool:bulk_export'],
      severity: 'CRITICAL',
      createdAt: new Date().toISOString(),
    });

    const match = checkImmuneNetworkSignatures({
      userIntent: 'Customer invoice summary check',
      toolName: 'bulk_export_db',
      violatedCapabilities: ['DB_QUERY'],
    });

    assert.equal(match.matched, true);
    assert.equal(match.riskBoost, 40);
    assert.match(match.violation ?? '', /MATCHED_GLOBAL_THREAT_SIGNATURE/);
  });

  it('blocks attacks early when a known global signature matches', () => {
    registerThreatSignature({
      id: 'TS-EARLYBLOCK',
      signatureHash: 'early-block-hash',
      category: 'DATA_EXFILTRATION',
      pattern: ['intent:invoice', 'intent:read', 'missing_cap:DB_QUERY', 'tool:bulk_export'],
      severity: 'CRITICAL',
      createdAt: new Date().toISOString(),
    });

    const result = evaluateAgentAction({
      agentId: 'agent-network-test',
      userIntent: 'Customer invoice summary check',
      toolCall: { name: 'bulk_export_db', args: { destination: 'external_api' } },
      agentCapabilities: ['READ', 'API_CALL'],
    });

    assert.equal(result.decision, 'BLOCK');
    assert.ok(result.riskScore > 85);
    assert.ok(result.violations.some((violation) => /MATCHED_GLOBAL_THREAT_SIGNATURE/i.test(violation)));
    assert.equal(result.killSwitchTriggered, true);
  });

  it('auto-registers a new signature after a blocked kill-switch event', () => {
    evaluateAgentAction({
      agentId: 'agent-register-test',
      userIntent: 'Invoice Check for customer #9999',
      toolCall: { name: 'bulk_export_db', args: { table: 'customers' } },
      agentCapabilities: ['READ'],
    });

    const signatures = listThreatSignatures();
    assert.ok(signatures.some((signature) => signature.pattern.includes('tool:bulk_export')));
  });
});
