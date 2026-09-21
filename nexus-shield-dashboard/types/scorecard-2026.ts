export type ScorecardVectorId =
  | 'indirect_injection'
  | 'tool_abuse'
  | 'unsanitized_tool_args'
  | 'inter_agent_delegation';

export type OotbStatus = 'FAIL' | 'PARTIAL';

export interface ScorecardVectorMeta {
  id: ScorecardVectorId;
  name: string;
  example: string;
}

export interface ScorecardCell {
  vector_id: ScorecardVectorId;
  vector_name: string;
  ootb_defense_rate_pct: number;
  ootb_status: OotbStatus;
  nexus_shield_mitigation_pct: number;
  nexus_shield_status: 'PASS';
  intercept_latency_ms: number;
  intent_divergence_ootb: number;
  intent_divergence_with_shield: number;
  capability_revocation: 'READ_ONLY';
  evidence_id: string;
}

export interface ScorecardFrameworkRow {
  framework: string;
  slug: string;
  ootb_defense_avg_pct: number;
  nexus_shield_mitigation_avg_pct: number;
  nexus_shield_latency_p50_ms: number;
  cells: ScorecardCell[];
}

export interface ScorecardHeadlineStats {
  enterprises_shadow_ai_default_pct: number;
  agents_vulnerable_indirect_hijack_pct: number;
  ootb_defense_rate_avg_pct: number;
  ootb_defense_rate_range_pct: [number, number];
  nexus_shield_mitigation_avg_pct: number;
  nexus_shield_mitigation_range_pct: [number, number];
  nexus_shield_latency_p50_ms: number;
}

export interface ScorecardReport2026 {
  report_id: string;
  title: string;
  vectors: ScorecardVectorMeta[];
  headline_stats: ScorecardHeadlineStats;
  frameworks: ScorecardFrameworkRow[];
}
