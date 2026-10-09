const counters: Record<string, number> = {
  persistence_commit_total: 0,
  persistence_rollback_total: 0,
  persistence_error_total: 0,
  idempotency_conflict_total: 0,
};

export function incrementAssurancePersistenceMetric(name: keyof typeof counters, by = 1): void {
  counters[name] = (counters[name] ?? 0) + by;
}

export function snapshotAssurancePersistenceMetrics(): Record<string, number> {
  return { ...counters };
}

export function resetAssurancePersistenceMetricsForTests(): void {
  for (const k of Object.keys(counters)) counters[k] = 0;
}
