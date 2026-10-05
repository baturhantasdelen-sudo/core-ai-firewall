import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { computeActionProofBundle } from '../lib/accountability/action-proof.ts';
import { parseEnterprisePolicyYaml, evaluatePolicyGate } from '../lib/policy-as-code/parser.ts';
import { runSevenEnginePipeline } from '../lib/nexus-core/pipeline.ts';
import { verifyAction, SecurityException } from '../lib/sdk/verify-action.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureYaml = readFileSync(
  join(__dirname, '../lib/policy-as-code/fixtures/finance-agent.policy.yaml'),
  'utf8',
);

describe('action proof formula', () => {
  it('combines intent, policy, tool, transaction, and result hashes', () => {
    const bundle = computeActionProofBundle({
      intent: 'retrieve_invoice_8291',
      policyDocument: { agent: 'finance-agent' },
      toolCall: { name: 'read_invoice', args: { id: '8291' } },
      transactionId: 'TXN-8291',
      result: { ok: true },
    });
    assert.match(bundle.intentHash, /^sha256:[a-f0-9]{64}$/);
    assert.match(bundle.actionProofHash, /^sha256:[a-f0-9]{64}$/);
    assert.equal(bundle.transactionId, 'TXN-8291');
  });
});

describe('policy-as-code', () => {
  it('parses finance agent YAML fixture', () => {
    const policy = parseEnterprisePolicyYaml(fixtureYaml);
    assert.equal(policy.agent, 'finance-agent');
    assert.ok(policy.allowed_intents.includes('READ_INVOICE'));
    assert.ok(policy.blocked_actions.includes('EXPORT_CUSTOMER_DATABASE'));
  });

  it('blocks export intent via policy gate', () => {
    const policy = parseEnterprisePolicyYaml(fixtureYaml);
    const gate = evaluatePolicyGate(policy, 'EXPORT_CUSTOMER_DATABASE', 'bulk_export_db');
    assert.equal(gate.allowed, false);
  });
});

describe('seven engine pipeline', () => {
  it('allows aligned invoice read', () => {
    const result = runSevenEnginePipeline({
      agentId: 'finance-agent-04',
      userIntent: 'retrieve invoice 8291',
      toolCall: { name: 'read_invoice', args: { invoice_id: '8291' } },
      authority: ['READ', 'API_CALL'],
      policyYaml: fixtureYaml,
    });
    assert.notEqual(result.decision, 'BLOCK');
    assert.ok(result.evidence.actionProof.actionProofHash.startsWith('sha256:'));
  });

  it('detects ghost action when API success but state unchanged', () => {
    const state = { invoice_paid: false };
    const result = runSevenEnginePipeline({
      agentId: 'finance-agent-04',
      userIntent: 'mark invoice paid',
      toolCall: { name: 'create_payment', args: { amount: 500 } },
      authority: ['FINANCIAL', 'API_CALL'],
      stateBefore: state,
      stateAfter: state,
      apiResult: { status_code: 200, body: '{"status":"success"}' },
    });
    assert.equal(result.transactionVerification.ghostActionSuspected, true);
    assert.equal(result.decision, 'BLOCK');
  });
});

describe('verifyAction SDK', () => {
  it('throws SecurityException on blocked export', () => {
    assert.throws(
      () =>
        verifyAction({
          agent: 'finance-agent-04',
          intent: 'EXPORT_CUSTOMER_DATABASE',
          action: { name: 'bulk_export_db', args: {} },
          authority: ['DB_QUERY'],
          policyYaml: fixtureYaml,
        }),
      (err: unknown) => err instanceof SecurityException,
    );
  });
});
