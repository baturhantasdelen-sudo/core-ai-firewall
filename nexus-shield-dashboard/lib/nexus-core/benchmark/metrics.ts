export interface A2BMetricsReport {
  total: number;
  passed: number;
  failed: number;
  false_success_cases: number;
  false_success_detected: number;
  false_success_detection_rate: number;
  outcome_verification_accuracy: number;
}

export function computeA2BMetrics(
  results: Array<{ expect_false_success?: boolean; false_success_detected: boolean; pass: boolean }>,
): A2BMetricsReport {
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const false_success_cases = results.filter((r) => r.expect_false_success).length;
  const false_success_detected = results.filter(
    (r) => r.expect_false_success && r.false_success_detected,
  ).length;
  const rate = false_success_cases === 0 ? 1 : false_success_detected / false_success_cases;
  return {
    total,
    passed,
    failed: total - passed,
    false_success_cases,
    false_success_detected,
    false_success_detection_rate: Math.round(rate * 10000) / 100,
    outcome_verification_accuracy: Math.round((passed / total) * 10000) / 100,
  };
}
