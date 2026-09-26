export interface ComplianceControlRow {
  framework: string;
  control_id: string;
  control_name: string;
  evidence_key: string;
  evidence_value: unknown;
  status: 'pass' | 'needs_review';
  collected_at_utc: string;
}

import type { UniversalActionReceipt } from '@/types/action-receipt';

export interface ComplianceEvidenceBundle {
  bundle_id: string;
  bundle_version: string;
  generated_at_utc: string;
  producer: string;
  standards_alignment: {
    frameworks: string[];
    references: Array<{ title: string; url: string }>;
    compliance_note: string;
  };
  runtime_privacy: {
    inspection_model: string;
    external_cloud_proxy: boolean;
    data_residency: string;
    suitable_for: string[];
    description: string;
  };
  mcp_benchmark: {
    mcp_sec_score: number;
    grade: string;
    block_rate_pct: number;
    blocked_count: number;
    scenario_count: number;
    timestamp_utc: string;
    meets_proof_center_baseline?: boolean;
    latency_ms?: { avg: number; p50: number; p95: number };
  };
  scorecard: {
    present: boolean;
    frameworks_evaluated: number;
    headline_stats: Record<string, unknown>;
    report_id?: string;
  };
  owasp_coverage: {
    scenario_count: number;
    unique_genai_tags: string[];
    unique_agentic_tags: string[];
    scenarios: Array<{
      scenario_id?: string;
      name?: string;
      blocked?: boolean;
      mcp_sec_score?: number;
      owasp_genai_top_10: string[];
      owasp_agentic: string[];
      evidence_hash?: string;
    }>;
  };
  automated_controls: ComplianceControlRow[];
  universal_action_receipts?: UniversalActionReceipt[];
  integrity: { sha256: string };
  integrations?: Record<string, unknown>;
}
