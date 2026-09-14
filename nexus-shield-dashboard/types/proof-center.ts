export interface ProofCenterLatencyMetrics {
  avg_ms: number;
  p95_ms: number;
  certified_sub_10ms: boolean;
}

export interface ProofCenterAttackBenchmark {
  blocked: number;
  total: number;
  accuracy_pct: number;
}

export interface ProofCenterIntentDivergence {
  accuracy_pct: number;
}

export interface ProofCenterMetrics {
  source: string;
  timestamp_utc?: string | null;
  base_url?: string | null;
  json_path?: string | null;
  latency: ProofCenterLatencyMetrics;
  attack_benchmark: ProofCenterAttackBenchmark;
  intent_divergence: ProofCenterIntentDivergence;
  false_positive_rate: number;
}

export interface ProofCenterRunResult {
  status: string;
  message: string;
  metrics: ProofCenterMetrics;
}
