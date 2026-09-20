export function percentile(values: number[], pct: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.min(
    ordered.length - 1,
    Math.max(0, Math.round((pct / 100) * (ordered.length - 1))),
  );
  return ordered[index];
}

export function summarizeLatency(values: number[]): { avg: number; p50: number; p95: number } {
  if (values.length === 0) return { avg: 0, p50: 0, p95: 0 };
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    avg: round(avg),
    p50: round(percentile(values, 50)),
    p95: round(percentile(values, 95)),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
