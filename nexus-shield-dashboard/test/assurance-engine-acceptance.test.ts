import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { runAssuranceEngine } from '@/lib/nexus-core/assurance-engine/engine';
import {
  demoBlockedSideEffect,
  demoBlockedUnchanged,
  demoErpPendingFalseSuccess,
  demoFinanceVerified,
  demoFinanceWrongAmount,
} from '@/lib/nexus-core/assurance-engine/demo-scenarios';
import { isHttpUrlAllowed, parseAllowlistFromEnv } from '@/lib/nexus-core/assurance-engine/http-allowlist';
import { assertRegisteredQuery } from '@/lib/nexus-core/assurance-engine/db-query-registry';
import { clearIdempotencyForTests } from '@/lib/nexus-core/assurance-engine/idempotency';
import { defaultVerificationPlan, runOutcomeVerificationSync } from '@/lib/nexus-core/outcome/verifier';
import { clearVerificationStoreForTests } from '@/lib/nexus-core/outcome/store';
import { resetOutcomeMetricsForTests } from '@/lib/nexus-core/outcome/metrics';

describe('Assurance engine — final acceptance (A–E)', () => {
  beforeEach(() => {
    clearVerificationStoreForTests();
    clearIdempotencyForTests();
    resetOutcomeMetricsForTests();
  });

  it('CASE A — VERIFIED refund 50k TRY', () => {
    const r = runAssuranceEngine(demoFinanceVerified());
    assert.equal(r.status, 'VERIFIED');
    assert.equal(r.false_success_detected, false);
    assert.ok(r.evidence.length >= 1);
  });

  it('CASE B — FAILED wrong amount + false success', () => {
    const r = runAssuranceEngine(demoFinanceWrongAmount());
    assert.equal(r.status, 'FAILED');
    assert.equal(r.false_success_detected, true);
    assert.ok(r.diff.some((d) => d.field === 'refund_amount'));
  });

  it('CASE C — UNVERIFIED ERP pending + false success', () => {
    const r = runAssuranceEngine(demoErpPendingFalseSuccess());
    assert.equal(r.status, 'UNVERIFIED');
    assert.equal(r.false_success_detected, true);
  });

  it('CASE D — BLOCKED unchanged', () => {
    const r = runAssuranceEngine(demoBlockedUnchanged());
    assert.equal(r.status, 'BLOCKED');
    assert.equal(r.post_block_side_effect_detected, false);
  });

  it('CASE E — BLOCKED + post-block side effect', () => {
    const r = runAssuranceEngine(demoBlockedSideEffect());
    assert.equal(r.status, 'BLOCKED');
    assert.equal(r.post_block_side_effect_detected, true);
  });
});

describe('Assurance engine — security & idempotency', () => {
  beforeEach(() => {
    clearVerificationStoreForTests();
    clearIdempotencyForTests();
  });

  it('blocks SSRF to localhost by default', () => {
    const r = isHttpUrlAllowed('http://127.0.0.1/state', parseAllowlistFromEnv());
    assert.equal(r.ok, false);
  });

  it('rejects arbitrary SQL', () => {
    assert.throws(() => assertRegisteredQuery('DELETE FROM ledger'));
  });

  it('idempotent verification replay', () => {
    const req = { ...demoFinanceVerified(), idempotency_key: 'idem-1' };
    const a = runOutcomeVerificationSync(req);
    const b = runOutcomeVerificationSync(req);
    assert.equal(a.verification_id, b.verification_id);
  });

  it('HTTP adapter blocks non-allowlisted URL (UNVERIFIED + adapter error)', () => {
    const r = runAssuranceEngine({
      ...demoFinanceVerified(),
      adapter_id: 'generic_http',
      http_url: 'https://evil.example/state',
      mock_fixture: undefined,
    });
    assert.equal(r.status, 'UNVERIFIED');
    assert.match(String(r.divergence_reason), /HTTP verification blocked|Adapter error/i);
  });
});

describe('Assurance engine — regression scenarios', () => {
  beforeEach(() => {
    clearVerificationStoreForTests();
    resetOutcomeMetricsForTests();
  });

  it('Scenario D — wrong resource FAILED', () => {
    const r = runOutcomeVerificationSync({
      agent_id: 'a',
      action_id: 'act-wrong-res',
      expected_outcome: {
        outcome_id: 'o',
        action_id: 'act-wrong-res',
        type: 'refund',
        expected_state: { invoice_id: 'INV-1001', status: 'REFUNDED' },
      },
      verification_plan: defaultVerificationPlan(),
      adapter_id: 'mock',
      mock_fixture: 'wrong_resource',
      resource_id: 'INV-1001',
    });
    assert.equal(r.status, 'FAILED');
  });

  it('legacy outcome scenario amount_mismatch still FAILED', () => {
    const r = runOutcomeVerificationSync({
      agent_id: 'a',
      action_id: 'act',
      expected_outcome: {
        outcome_id: 'o',
        action_id: 'act',
        type: 'pay',
        expected_state: { status: 'POSTED', amount: 50000, ledger_entry: true },
      },
      verification_plan: defaultVerificationPlan(),
      adapter_id: 'mock',
      mock_fixture: 'amount_mismatch',
    });
    assert.equal(r.status, 'FAILED');
  });
});
