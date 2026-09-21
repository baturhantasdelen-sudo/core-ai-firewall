export type McpHarnessGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface McpLeaderboardScenario {
  scenario_id: string;
  scenario_name: string;
  category: string;
  severity: string;
  verdict: string;
  blocked: boolean;
  mcp_sec_score: number;
  grade: McpHarnessGrade;
  latency_ms: number;
  violations: string[];
  evidence_hash: string;
  tool_calls?: Array<{
    method: string;
    tool: string;
    arguments: Record<string, unknown>;
  }>;
}

export interface McpLeaderboardEntry {
  rank: number;
  scenario_id: string;
  name: string;
  category: string;
  severity: string;
  verdict: string;
  blocked: boolean;
  mcp_sec_score: number;
  grade: McpHarnessGrade;
  latency_ms: number;
  evidence_hash: string;
  violations: string[];
}

export interface McpLeaderboardRaw {
  harness: string;
  version: string;
  timestamp_utc: string;
  source: string;
  mcp_sec_score: number;
  grade: McpHarnessGrade;
  scenario_count: number;
  blocked_count: number;
  block_rate_pct: number;
  baseline_comparison: {
    proof_center_block_rate_pct: number;
    your_block_rate_pct: number;
    delta_pct: number;
    meets_baseline: boolean;
  };
  latency_ms: {
    avg: number;
    p50: number;
    p95: number;
  };
  proof_center: {
    source: string;
    timestamp_utc: string;
    latency: {
      avg_ms: number;
      p95_ms: number;
      certified_sub_10ms: boolean;
    };
    attack_benchmark: {
      blocked: number;
      total: number;
      accuracy_pct: number;
    };
    intent_divergence: {
      accuracy_pct: number;
    };
    false_positive_rate: number;
  };
  leaderboard: McpLeaderboardEntry[];
  scenarios: McpLeaderboardScenario[];
}

export interface McpLeaderboardAdapter {
  adapter_name: string;
  target_vectors: string[];
  grade: McpHarnessGrade;
  blocked_count: number;
  total_count: number;
  vulnerabilities_detected: string[];
  protection_status: 'protected' | 'vulnerable';
  mcp_sec_score: number;
  scenarios: McpLeaderboardScenario[];
}

export interface McpLeaderboardView {
  mcp_sec_score: number;
  grade: McpHarnessGrade;
  scenarios_evaluated: number;
  blocked_rate: number;
  blocked_count: number;
  timestamp_utc: string;
  meets_baseline: boolean;
  adapters: McpLeaderboardAdapter[];
  raw: McpLeaderboardRaw;
}
