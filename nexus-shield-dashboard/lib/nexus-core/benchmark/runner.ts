import { runAssuranceVerification } from '@/lib/nexus-core/assurance/runner';
import { resolveVerticalAdapter } from '@/lib/nexus-core/adapters/vertical';
import { A2B_SCENARIOS, type A2BScenario } from '@/lib/nexus-core/benchmark/a2b-scenarios';
import { computeA2BMetrics, type A2BMetricsReport } from '@/lib/nexus-core/benchmark/metrics';

export interface A2BScenarioResult {
  scenario: A2BScenario;
  pass: boolean;
  status: string;
  false_success_detected: boolean;
  score: number;
}

export function runA2BScenario(scenario: A2BScenario): A2BScenarioResult {
  const adapter = resolveVerticalAdapter(scenario.vertical);
  const read = adapter.read_state({
    action: scenario.action,
    fixture_id: scenario.fixture_id,
    transaction_id: scenario.id,
  });

  const result = runAssuranceVerification({
    observed_state: read.observed_state,
    rules: scenario.rules,
    expected_side_effects: scenario.expected_side_effects,
    tool_response: scenario.tool_response,
  });

  const pass = result.status === scenario.expect_status &&
    (scenario.expect_false_success === undefined ||
      result.false_success_detected === scenario.expect_false_success);

  return {
    scenario,
    pass,
    status: result.status,
    false_success_detected: result.false_success_detected,
    score: result.score,
  };
}

export function runA2BBenchmark(): { results: A2BScenarioResult[]; metrics: A2BMetricsReport } {
  const results = A2B_SCENARIOS.map(runA2BScenario);
  const metrics = computeA2BMetrics(
    results.map((r) => ({
      pass: r.pass,
      expect_false_success: r.scenario.expect_false_success,
      false_success_detected: r.false_success_detected,
    })),
  );
  return { results, metrics };
}
