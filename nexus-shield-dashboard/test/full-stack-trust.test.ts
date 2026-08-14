import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  enrichAgentAsset,
} from '../lib/engine/agents/inventory.ts';
import {
  calculateIntentDivergence,
  evaluateAgentAction,
  getKillSwitchState,
  getRevokedCapabilities,
  recordToolCall,
  resetActionFirewallRuntime,
  resetTrajectory,
  revokeCapabilities,
} from '../lib/engine/action-firewall/index.ts';
import { verifyActionEvidence } from '../lib/engine/evidence/index.ts';
import {
  registerSafeThreatSignature,
  resetThreatRegistry,
  syncSafeImmuneNetwork,
} from '../lib/engine/threat-intel/immune-network.ts';
import type { AgentAsset } from '../lib/engine/discovery/index.ts';

const AGENT_ID = 'full-stack-trust-agent';

const SAMPLE_AGENT: AgentAsset = {
  id: 'crewai-ops-agent-test',
  name: 'Ops Coordinator',
  framework: 'CrewAI',
  sourceFile: 'src/agents/ops_crew.py',
  line: 42,
  capabilities: ['READ', 'DB_QUERY', 'API_CALL'],
  riskLevel: 'MEDIUM',
  mcpConnections: [
    {
      serverName: 'billing-tools',
      transport: 'stdio',
      tools: ['stripe_payment', 'write_file', 'delete_records'],
    },
  ],
};

describe('full-stack trust runtime (SEE → CONTROL → TRUST)', () => {
  afterEach(() => {
    resetActionFirewallRuntime();
    resetTrajectory();
    resetThreatRegistry();
  });

  it('SEE: detects effective authority from API keys, OAuth scopes, and MCP tools', () => {
    const fileContent = `
      oauth_scopes="write:all delete:records payment:stripe"
      STRIPE_SECRET_KEY=sk_live_test_agent
    `;

    const enriched = enrichAgentAsset(SAMPLE_AGENT, fileContent);
    const report = enriched.authorityReport;

    assert.equal(report.privilegeEscalationDetected, true);
    assert.ok(report.elevatedRisks.includes('FINANCIAL_EXECUTE'));
    assert.ok(report.elevatedRisks.includes('UNRESTRICTED_DELETE'));
    assert.ok(report.riskScore >= 50);
    assert.ok(report.entries.some((entry) => entry.source === 'API_KEY'));
    assert.ok(report.entries.some((entry) => entry.source === 'OAUTH_TOKEN'));
    assert.ok(report.hiddenPermissions.length > 0);
  });

  it('CONTROL: calculates intent divergence and flags INTENT_ACTION_DIVERGENCE above 80%', () => {
    recordToolCall(AGENT_ID, 'read_invoice', 10);
    recordToolCall(AGENT_ID, 'read_db', 12);
    recordToolCall(AGENT_ID, 'bulk_export_db', 15);

    const divergence = calculateIntentDivergence('Deploy application update to production', [
      'read_invoice',
      'read_db',
      'bulk_export_db',
    ]);

    assert.ok(divergence.divergencePercent > 80);
    assert.equal(divergence.shouldBlock, true);
    assert.match(divergence.violation ?? '', /INTENT_ACTION_DIVERGENCE/);
  });

  it('CONTROL: revokes dangerous capabilities instead of full freeze for moderate divergence', () => {
    resetThreatRegistry({ skipSeed: true });
    recordToolCall(AGENT_ID, 'read_db', 10);
    recordToolCall(AGENT_ID, 'execute_shell', 12);

    const result = evaluateAgentAction({
      agentId: AGENT_ID,
      userIntent: 'Pay invoice for customer #4421',
      toolCall: { name: 'sql_query', args: { table: 'customers' } },
      agentCapabilities: ['READ', 'DB_QUERY'],
    });

    assert.ok(result.intentDivergencePercent !== undefined);
    assert.ok(result.intentDivergencePercent > 50);
    assert.equal(result.killSwitchTriggered, false);
    assert.equal(getKillSwitchState(AGENT_ID).status, 'READ_ONLY');
    assert.ok(getRevokedCapabilities(AGENT_ID).includes('DB_QUERY'));
  });

  it('CONTROL: revokeCapabilities puts agent in read-only mode', () => {
    const revocation = revokeCapabilities(AGENT_ID, ['WRITE', 'EXECUTE', 'FINANCIAL'], 'Test revocation');

    assert.deepEqual(revocation.revokedScopes, ['WRITE', 'EXECUTE', 'FINANCIAL']);
    assert.equal(getKillSwitchState(AGENT_ID).status, 'READ_ONLY');

    resetThreatRegistry({ skipSeed: true });

    const blocked = evaluateAgentAction({
      agentId: AGENT_ID,
      userIntent: 'Update customer record',
      toolCall: { name: 'write_file', args: { path: '/data/customers.csv' } },
      agentCapabilities: ['READ', 'WRITE'],
    });

    assert.equal(blocked.decision, 'BLOCK');
    assert.ok(blocked.violations.some((violation) => /Capability revoked/.test(violation)));
  });

  it('TRUST: verifies evidence chain and flags UNVERIFIED_ACTION without audit trail', () => {
    const unverified = verifyActionEvidence({
      actionType: 'FINANCIAL_MUTATION',
      toolName: 'stripe_transfer',
    });

    assert.equal(unverified.verified, false);
    assert.equal(unverified.status, 'UNVERIFIED_ACTION');
    assert.ok(unverified.violations.some((violation) => /UNVERIFIED_ACTION/.test(violation)));
    assert.equal(unverified.evidenceChainStrength, 0);

    const verified = verifyActionEvidence({
      actionType: 'FINANCIAL_MUTATION',
      toolName: 'stripe_transfer',
      evidence: {
        erpTransactionId: 'ERP-TXN-20260815-004421',
        apiLogDiff: 'audit-log diff: payment authorized',
      },
    });

    assert.equal(verified.verified, true);
    assert.equal(verified.status, 'VERIFIED');
    assert.ok(verified.evidenceChainStrength >= 85);
  });

  it('TRUST: syncs SAFE-compliant immune network signatures', () => {
    resetThreatRegistry({ skipSeed: true });

    const signature = registerSafeThreatSignature({
      toolSequence: ['read_invoice', 'bulk_export_db'],
      intentAnomalyTags: ['invoice', 'read'],
      violatedCapabilities: ['DB_QUERY'],
      riskScore: 88,
      killSwitchTriggered: true,
    });

    assert.ok(signature);
    assert.match(signature!.id, /^TS-/);
    assert.match(signature!.signatureHash, /^safe-/);

    const sync = syncSafeImmuneNetwork();
    assert.equal(sync.standard, 'SAFE');
    assert.equal(sync.anonymized, true);
    assert.ok(sync.synced >= 1);
    assert.equal(sync.status, 'ACTIVE & PROTECTED');
  });
});
