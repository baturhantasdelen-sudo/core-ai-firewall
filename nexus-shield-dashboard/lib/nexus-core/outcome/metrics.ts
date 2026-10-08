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
};

export function incrementOutcomeMetric(name: keyof typeof counters, by = 1): void {
  counters[name] = (counters[name] ?? 0) + by;
}

export function snapshotOutcomeMetrics(): Record<string, number> {
  return { ...counters };
}

export function formatPrometheusMetrics(): string {
  return Object.entries(counters)
    .map(([name, value]) => `# TYPE ${name} counter\n${name} ${value}`)
    .join('\n');
}

export function resetOutcomeMetricsForTests(): void {
  for (const key of Object.keys(counters)) {
    counters[key] = 0;
  }
}
