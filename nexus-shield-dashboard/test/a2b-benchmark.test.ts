import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { a2bScenarioCounts, A2B_SCENARIOS } from '@/lib/nexus-core/benchmark/a2b-scenarios';
import { runA2BBenchmark } from '@/lib/nexus-core/benchmark/runner';

describe('A2B — Agent Action Assurance Benchmark', () => {
  it('defines 20 scenarios weighted finance/erp/crm', () => {
    const counts = a2bScenarioCounts();
    assert.equal(counts.total, 20);
    assert.equal(counts.finance, 8);
    assert.equal(counts.erp, 7);
    assert.equal(counts.crm, 5);
    assert.equal(A2B_SCENARIOS.length, 20);
  });

  it('passes all A2B scenarios with 100% false-success detection on fixtures', () => {
    const { results, metrics } = runA2BBenchmark();
    assert.equal(metrics.total, 20);
    assert.equal(metrics.passed, 20, results.filter((r) => !r.pass).map((r) => r.scenario.id).join(', '));
    assert.equal(metrics.false_success_detection_rate, 100);
    assert.equal(metrics.outcome_verification_accuracy, 100);
  });
});
