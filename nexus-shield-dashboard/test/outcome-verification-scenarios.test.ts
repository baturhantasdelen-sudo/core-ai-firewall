import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { DatabaseReadOnlyOutcomeAdapter } from '@/lib/nexus-core/adapters/outcome-adapter-v2';
import { OUTCOME_BENCHMARK_SCENARIOS } from '@/lib/nexus-core/outcome/benchmark';
import { runDefinitionOfDone } from '@/lib/nexus-core/outcome/dod';
import { evaluateOperator, compareExpectedVsActual } from '@/lib/nexus-core/outcome/engine';
import { resetOutcomeMetricsForTests, snapshotOutcomeMetrics } from '@/lib/nexus-core/outcome/metrics';
import { clearVerificationStoreForTests, getVerificationResult } from '@/lib/nexus-core/outcome/store';
import { runOutcomeVerificationSync } from '@/lib/nexus-core/outcome/verifier';

describe('Outcome Verification Engine — 12 scenarios', () => {
  beforeEach(() => {
    resetOutcomeMetricsForTests();
    clearVerificationStoreForTests();
  });

  for (const scenario of OUTCOME_BENCHMARK_SCENARIOS) {
    it(`${scenario.id}: ${scenario.name}`, () => {
      const result = runOutcomeVerificationSync(scenario.request);
      assert.equal(result.status, scenario.expect_status, `${scenario.id} status`);
      if (scenario.expect_false_success !== undefined) {
        assert.equal(result.false_success_detected, scenario.expect_false_success);
      }
      if (scenario.expect_critical_diff) {
        assert.ok(result.diff.some((d) => d.severity === 'CRITICAL'));
      }
      assert.ok(getVerificationResult(result.verification_id));
    });
  }

  it('amount mismatch severity CRITICAL (50k vs 500)', () => {
    const { diffs } = compareExpectedVsActual(
      {
        outcome_id: 'o1',
        action_id: 'a1',
        type: 'pay',
        expected_state: { amount: 50000 },
      },
      {
        transaction_id: 't1',
        status: 'POSTED',
        observed_state: { amount: 500 },
        timestamp: new Date().toISOString(),
        provider: 'mock',
      },
    );
    assert.ok(diffs.some((d) => d.field === 'amount' && d.severity === 'CRITICAL'));
  });

  it('database adapter rejects write SQL', () => {
    const db = new DatabaseReadOnlyOutcomeAdapter();
    assert.throws(() => db.get_state({ sql: 'UPDATE ledger SET x=1' }));
  });

  it('all 11 operators callable', () => {
    const ops = [
      'EQUALS',
      'NOT_EQUALS',
      'GREATER_THAN',
      'LESS_THAN',
      'GREATER_OR_EQUAL',
      'LESS_OR_EQUAL',
      'IN',
      'NOT_IN',
      'CONTAINS',
      'MATCHES',
      'EXISTS',
      'NOT_EXISTS',
    ] as const;
    for (const op of ops) {
      assert.equal(typeof evaluateOperator(op, 'a', 'a'), 'boolean');
    }
  });

  it('Definition of Done — 42/42', () => {
    const sample = runOutcomeVerificationSync(OUTCOME_BENCHMARK_SCENARIOS[0]!.request);
    const dod = runDefinitionOfDone(sample);
    assert.equal(dod.total, 42);
    assert.equal(dod.passed, 42, dod.failed.map((f) => `${f.id}: ${f.description}`).join('; '));
  });

  it('Prometheus metrics increment on verify', () => {
    runOutcomeVerificationSync(OUTCOME_BENCHMARK_SCENARIOS[0]!.request);
    const m = snapshotOutcomeMetrics();
    assert.ok(m.outcome_verification_total >= 1);
    assert.ok(m.outcome_verified_total >= 1);
  });
});
