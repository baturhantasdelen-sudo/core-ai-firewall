/** Canonical marketing & benchmark copy — single source of truth. */

/** Primary value proposition hook — headers & hero. */
export const NEXUS_VALUE_PROP_HOOK =
  'Your AI agent can call your APIs. Who verifies the action?';

export const NEXUS_CATEGORY_POSITIONING = NEXUS_VALUE_PROP_HOOK;

export const NEXUS_DEFENSIVE_POSITIONING =
  'Nexus combines runtime action governance, trajectory-aware control, and tamper-evident SHA-256 Universal Action Receipts (UAR) in a local-first, air-gapped deployment layer.';

/** Harness-only latency — always pair with {@link NEXUS_HARNESS_LATENCY_FOOTNOTE}. */
export const NEXUS_RUNTIME_LATENCY_METRIC =
  'P99 runtime intercept: 6.1ms (Nexus benchmark harness)';

/** Required footnote for any P99 / intercept latency shown in UI. */
export const NEXUS_HARNESS_LATENCY_FOOTNOTE =
  'measured in Nexus benchmark harness test environment';

export const NEXUS_HARNESS_FALSE_POSITIVE_NOTE =
  'Benchmark test suite evaluated (low false-positive rate under controlled test vectors — not a production SLA)';

export const NEXUS_HARNESS_METRICS_LABEL =
  'Harness test suite (open-source baseline fixture — not live fleet telemetry)';

export const NEXUS_OPEN_EVALUATION_MATRIX_LABEL = 'Nexus Shield Open Evaluation Matrix';

export const NEXUS_REPRODUCIBLE_BASELINE_LABEL = 'Reproducible Agent Security Baseline';

export const NEXUS_GOVERNANCE_TAGLINE =
  'Agent Action Governance & Verification — Action Control Plane with Universal Action Receipts.';

/** SEE → CONTROL → execution → PROVE */
export const NEXUS_RUNTIME_FLOW_LABEL =
  'Interception (SEE) → Authority / Policy (CONTROL) → Execution → State Change → Tamper-evident UAR (VERIFY)';

/** Threat model — intent must not come from a compromised agent alone. */
export const NEXUS_INTENT_THREAT_MODEL_NOTE =
  'Intent for divergence checks must be supplied from the user session or trusted orchestrator boundary — not from a potentially compromised agent self-report alone.';
