export type IndependentDemoProof = {
  demo_id: string;
  preset_id?: string;
  cve_label?: string;
  title?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low' | string;
  generated_at_utc: string;
  positioning: string;
  runtime_benchmark: string;
  report_url: string;
  scenario: {
    target: string;
    agent_id: string;
    user_intent: string;
    proposed_tool: string;
    proposed_params: Record<string, unknown>;
    attack_vector: string;
  };
  mitigation: {
    decision: string;
    rule_id: string;
    risk_score: number;
    violations: string[];
    summary: string;
  };
  universal_action_receipt: Record<string, unknown>;
  evidence_bundle_sha256: string;
  receipt_id: string;
  verification_url: string;
};

export type CvePresetIndexEntry = {
  preset_id: string;
  cve_label: string;
  title: string;
  severity: string;
  decision: string;
  evidence_bundle_sha256: string;
  receipt_id: string;
  verification_url: string;
  proof_bundle_path: string;
};

export type CvePresetsIndex = {
  schema_version: string;
  framework: string;
  default_preset_id: string;
  runtime_benchmark: string;
  report_url: string;
  presets: CvePresetIndexEntry[];
};
