/** Static scenarios for the landing Action → Outcome → Proof simulator. */

export type SimulatorScenarioId = 'verified' | 'policy-block' | 'outcome-mismatch';

export type FlowStepStatus = 'pass' | 'fail' | 'neutral' | 'warn';

export interface SimulatorFlowStep {
  id: string;
  label: string;
  detail: string;
  status: FlowStepStatus;
  mono?: string;
}

export interface SimulatorScenario {
  id: SimulatorScenarioId;
  tabLabel: string;
  headline: string;
  summary: string;
  outcomeBadge: {
    label: string;
    tone: 'verified' | 'blocked' | 'discrepancy';
  };
  steps: SimulatorFlowStep[];
  receiptPreview?: string;
}

export const ACTION_CONTROL_SIMULATOR_SCENARIOS: SimulatorScenario[] = [
  {
    id: 'verified',
    tabLabel: 'Safe & verified',
    headline: 'Intent aligned · passport OK · outcome matches',
    summary:
      'Finance agent reconciles an invoice within delegated limits. Nexus Shield seals a UAR 2.0 receipt with before/after state.',
    outcomeBadge: { label: 'VERIFIED', tone: 'verified' },
    steps: [
      {
        id: 'intent',
        label: 'Declared intent',
        detail: 'Reconcile invoice #8842 and mark paid in mock-ERP.',
        status: 'neutral',
        mono: 'intent: "Reconcile invoice #8842"',
      },
      {
        id: 'passport',
        label: 'Agent passport check',
        detail: 'Tool read_invoice + post_payment within $5,000 ceiling · system mock-erp.',
        status: 'pass',
        mono: 'passport: ALLOW · scope OK',
      },
      {
        id: 'action',
        label: 'Action executed',
        detail: 'POST post_payment · amount $1,240.00 · latency 6.1ms',
        status: 'neutral',
        mono: 'action: { tool: "post_payment", amount: 1240 }',
      },
      {
        id: 'outcome',
        label: 'Outcome verification',
        detail: 'System state PAID matches agent-reported success.',
        status: 'pass',
        mono: 'expected: PAID · actual: PAID',
      },
    ],
    receiptPreview: `{
  "uar_version": "2.0",
  "decision": "ALLOW",
  "outcome_verification": { "status": "VERIFIED" },
  "sha256_hash": "a50455955e7f…"
}`,
  },
  {
    id: 'policy-block',
    tabLabel: 'Intent drift & block',
    headline: 'Unauthorized tool · circuit breaker engaged',
    summary:
      'Agent diverges from user intent and attempts a destructive tool. Policy and circuit breaker stop execution before API damage.',
    outcomeBadge: { label: 'BLOCKED', tone: 'blocked' },
    steps: [
      {
        id: 'intent',
        label: 'Declared intent',
        detail: 'User asked for weather in Istanbul — no database or shell tools in scope.',
        status: 'neutral',
        mono: 'intent: "Weather in Istanbul?"',
      },
      {
        id: 'drift',
        label: 'Intent drift detected',
        detail: 'Model selected run_command / drop_database — mismatch score elevated.',
        status: 'warn',
        mono: 'divergence: HIGH · tool ∉ allowlist',
      },
      {
        id: 'passport',
        label: 'Passport & policy',
        detail: 'Tool not in agent passport · trajectory violation.',
        status: 'fail',
        mono: 'passport: DENY · UNSIGNED_ACTION',
      },
      {
        id: 'breaker',
        label: 'Circuit breaker',
        detail: 'Execution mode → READ_ONLY · action prevented at intercept.',
        status: 'fail',
        mono: 'circuit_breaker: TRIGGERED · BLOCK',
      },
    ],
  },
  {
    id: 'outcome-mismatch',
    tabLabel: 'Outcome mismatch',
    headline: 'Agent claims success · system still pending',
    summary:
      'Payment API returned 202 Accepted while the agent reported completion. Outcome verifier flags discrepancy — no verified receipt.',
    outcomeBadge: { label: 'DISCREPANCY', tone: 'discrepancy' },
    steps: [
      {
        id: 'intent',
        label: 'Declared intent',
        detail: 'Transfer vendor payout for invoice #8842.',
        status: 'neutral',
        mono: 'intent: "Pay vendor for #8842"',
      },
      {
        id: 'passport',
        label: 'Agent passport check',
        detail: 'post_payment allowed · within financial ceiling.',
        status: 'pass',
        mono: 'passport: ALLOW',
      },
      {
        id: 'claim',
        label: 'Agent outcome claim',
        detail: 'Agent reports: "Payment completed successfully."',
        status: 'warn',
        mono: 'claimed: SUCCESS',
      },
      {
        id: 'system',
        label: 'System state (source of truth)',
        detail: 'ERP ledger: PENDING · webhook not settled.',
        status: 'fail',
        mono: 'actual: PENDING · status: UNVERIFIED',
      },
    ],
    receiptPreview: `{
  "uar_version": "2.0",
  "decision": "ALLOW",
  "outcome_verification": { "status": "DISCREPANCY" },
  "sha256_hash": "— sealed with mismatch flag"
}`,
  },
];

export const ACTION_CONTROL_SIMULATOR_SCENARIO_IDS = ACTION_CONTROL_SIMULATOR_SCENARIOS.map(
  (s) => s.id,
);
