/** In-process Prometheus-compatible counters for outcome verification. */

const counters: Record<string, number> = {
  outcome_verification_total: 0,
  outcome_verified_total: 0,
  outcome_unverified_total: 0,
  outcome_failed_total: 0,
  outcome_blocked_total: 0,
  false_success_detected_total: 0,
  outcome_diff_critical_total: 0,
  evidence_chain_appended_total: 0,
  verification_adapter_errors_total: 0,
  post_block_side_effect_total: 0,
  critical_outcome_mismatch_total: 0,
};

let verificationLatencyMsTotal = 0;
let verificationLatencyCount = 0;

export function incrementOutcomeMetric(name: keyof typeof counters, by = 1): void {
  counters[name] = (counters[name] ?? 0) + by;
}

export function snapshotOutcomeMetrics(): Record<string, number> {
  return { ...counters };
}

export function formatPrometheusMetrics(): string {
  const lines = Object.entries(counters).map(
    ([name, value]) => `# TYPE ${name} counter\n${name} ${value}`,
  );
  lines.push(
    `# TYPE verification_latency_ms_avg gauge\nverification_latency_ms_avg ${snapshotVerificationLatencyAvgMs()}`,
  );
  return lines.join('\n');
}

export function recordVerificationLatencyMs(ms: number): void {
  verificationLatencyMsTotal += ms;
  verificationLatencyCount += 1;
}

export function snapshotVerificationLatencyAvgMs(): number {
  if (verificationLatencyCount === 0) return 0;
  return Math.round(verificationLatencyMsTotal / verificationLatencyCount);
}

export function resetOutcomeMetricsForTests(): void {
  for (const key of Object.keys(counters)) {
    counters[key] = 0;
  }
  verificationLatencyMsTotal = 0;
  verificationLatencyCount = 0;
}
