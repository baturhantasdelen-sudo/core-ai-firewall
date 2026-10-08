import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveAuthoritativeVertical } from '@/lib/nexus-core/assurance/authoritative-sources';
import { evaluateAssuranceOperator } from '@/lib/nexus-core/assurance/engine';
import { analyzeSideEffects } from '@/lib/nexus-core/assurance/side-effects';
import { runAssuranceVerification } from '@/lib/nexus-core/assurance/runner';
import { assembleTransactionProof } from '@/lib/nexus-core/proof/assemble';
import { buildUar20Receipt, resetUar20ChainForTests } from '@/lib/nexus-core/uar/builder';
import { verifyUar20Receipt } from '@/lib/nexus-core/uar/verify';
import type { VerifyActionRequest } from '@/lib/nexus-core/types';
import type { EngineOutcomeVerification } from '@/lib/nexus-core/outcome-verification';

describe('Assurance core', () => {
  it('maps payment_status to payment_provider vertical', () => {
    assert.equal(resolveAuthoritativeVertical('payment_status'), 'payment_provider');
    assert.equal(resolveAuthoritativeVertical('invoice_balance'), 'erp');
  });

  it('supports GREATER / LESS operator aliases', () => {
    assert.ok(evaluateAssuranceOperator('GREATER', 5, 3));
    assert.ok(evaluateAssuranceOperator('LESS', 2, 9));
  });

  it('detects side-effect violations', () => {
    const violations = analyzeSideEffects(
      {
        allowed_fields: ['segment'],
        expected_mutations: { segment: 'VIP' },
        forbidden_fields: ['shadow_field'],
      },
      { observed_state: { segment: 'VIP', shadow_field: true } },
    );
    assert.ok(violations.some((v) => v.field.includes('shadow')));
  });

  it('builds and verifies UAR 2.0 proof separation (action vs verification)', () => {
    resetUar20ChainForTests();
    const req = {
      agentId: 'agent-x',
      userIntent: 'Pay invoice',
      toolCall: { name: 'execute_payment', args: { amount: 50000 } },
      authority: ['payments:write'],
    } satisfies VerifyActionRequest;
    const outcome = {
      status: 'VERIFIED',
      adapter_system: 'INLINE_STATE',
      expected: { description: 'pay', expected_delta: { amount: 50000 }, consequential: true },
      actual: { current_state: { amount: 50000 }, source: 'inline' },
      api_reports_success: true,
      state_delta_observed: true,
      false_success_detected: false,
    } as EngineOutcomeVerification;
    const evidence = {
      receiptId: 'uar20_test',
      evidenceHash: 'sha256:demo',
      signature: 'sig_demo',
      actionProof: {
        intentHash: 'ih',
        toolCallHash: 'tch',
        transactionId: 'TXN-A2B-1',
        resultHash: 'rh',
        actionProofHash: 'aph',
      },
    };
    const receipt = buildUar20Receipt({
      req,
      decision: 'ALLOW',
      authority: { effectiveScopes: ['payments:write'], violations: [] },
      outcome,
      evidence,
    });
    assert.equal(receipt.action.executed, true);
    assert.ok(receipt.verification.status);
    const verify = verifyUar20Receipt(receipt, null);
    assert.equal(verify.signature_valid, true);
    const proof = assembleTransactionProof(receipt);
    assert.ok(proof.claims.length >= 1);
    assert.equal(proof.integrity.signature_valid, true);
  });

  it('runAssuranceVerification flags false success', () => {
    const r = runAssuranceVerification({
      observed_state: { payment_status: 'PENDING', ledger_entry: false },
      rules: { logic: 'ALL', rules: [{ field: 'payment_status', operator: 'EQUALS', value: 'SETTLED' }] },
      tool_response: { status_code: 200, body: 'success' },
    });
    assert.equal(r.false_success_detected, true);
    assert.equal(r.status, 'UNVERIFIED');
  });
});
