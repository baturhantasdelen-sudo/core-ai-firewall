/** Multi-scenario deception proof fixtures for landing demo (self-contained, no API). */

import type { TripartiteState } from '@/lib/landing/tripartite-state';

export type DeceptionScenarioId = 'financial' | 'exfiltration' | 'privilege';

export interface DeceptionActionProof {
  intentHash: string;
  policyHash: string;
  toolCallHash: string;
  transactionId: string;
  resultHash: string;
  actionProofHash: string;
}

export type BadgeTone = 'cyan' | 'amber' | 'rose' | 'emerald' | 'violet';

export interface DeceptionTimelineStep {
  id: string;
  title: string;
  badge: string;
  badgeTone: BadgeTone;
  headline: string;
  detail: string;
  terminal: string[];
}

export interface DeceptionSandboxLine {
  delayMs: number;
  line: string;
}

export interface DeceptionUarReceipt {
  $schema: string;
  receipt_id: string;
  timestamp: string;
  agent: {
    identity: string;
    passport_id: string;
    owner: string;
  };
  intent: {
    raw_prompt: string;
    parsed_intent: string;
    target_resource: string;
  };
  authority: {
    allowed_scopes: string[];
    financial_limit: number;
    delegation_depth: number;
    verified_by_graph: boolean;
  };
  policy: {
    policy_id: string;
    evaluation: string;
    risk_score: number;
  };
  execution: {
    tool_called: string;
    request_payload: Record<string, unknown>;
    api_response: { status_code: number; raw_body: string };
  };
  outcome_verification: {
    status: string;
    verification_method: string;
    state_before: Record<string, unknown>;
    state_after: Record<string, unknown>;
    state_before_hash: string;
    state_after_hash: string;
    external_transaction_id?: string | null;
    verifier_signature: string;
    discrepancy_detected: boolean;
  };
  cryptographic_proof: {
    evidence_hash: string;
    signature: string;
  };
  action_proof: DeceptionActionProof;
  circuit_breaker?: {
    event: string;
    reason: string;
    frozen_agents: string[];
  };
  action_control?: {
    event: string;
    code: string;
    autonomy_route: string;
  };
}

export interface DeceptionScenario {
  id: DeceptionScenarioId;
  pillLabel: string;
  title: string;
  subtitle: string;
  /** Primary tripartite outcome for this scenario narrative. */
  tripartiteState: TripartiteState;
  tripartiteHeadline: string;
  timelineSteps: DeceptionTimelineStep[];
  sandboxScript: DeceptionSandboxLine[];
  uarReceipt: DeceptionUarReceipt;
  executiveReport: {
    headline: string;
    summary: string;
    findings: string[];
    recommendation: string;
  };
}

const TIMELINE_FINANCIAL: DeceptionTimelineStep[] = [
  {
    id: 'action',
    title: 'High-risk agent action',
    badge: 'ACTION CONTROL',
    badgeTone: 'cyan',
    headline: 'Finance agent initiates $50,000 refund',
    detail: 'POST /v1/tools/process_refund · target: customer_acme · scope: payments:write',
    terminal: [
      '$ agent-finance-04 → nexus-shield-gateway',
      'intent: PROCESS_REFUND · amount: 50000 USD',
      'passport: pas_live_88192a · delegation_depth: 1',
    ],
  },
  {
    id: 'false-success',
    title: 'API reports success',
    badge: 'FALSE SUCCESS',
    badgeTone: 'amber',
    headline: 'Upstream ERP returns HTTP 200 OK',
    detail: '{"status":"succeeded"} — no ledger mutation observed',
    terminal: [
      'HTTP/1.1 200 OK',
      '{"status":"succeeded","refund_id":"rf_hallucinated_99"}',
    ],
  },
  {
    id: 'verify',
    title: 'Outcome verifier cross-check',
    badge: 'UNVERIFIED',
    badgeTone: 'rose',
    headline: 'Ledger state mismatch detected',
    detail: 'Expected balance −$50,000 · Actual unchanged · discrepancy_detected: true',
    terminal: [
      'OutcomeVerifier → DB_STATE_AND_LEDGER_CROSS_CHECK',
      'state_before_hash ≠ expected transition',
      'verdict: UNVERIFIED (false success)',
    ],
  },
  {
    id: 'breaker',
    title: 'Circuit breaker + UAR v2 seal',
    badge: 'CONTAINED',
    badgeTone: 'emerald',
    headline: 'Token revoked · delegation subtree frozen',
    detail: 'CIRCUIT_BREAKER_TRIP · UAR v2 sealed with Ed25519 verifier signature',
    terminal: [
      'CircuitBreaker.trip(UNVERIFIED_OUTCOME)',
      'revoked: pas_live_88192a',
      'UAR sealed: aar_deception_demo_refund',
    ],
  },
];

const TIMELINE_EXFIL: DeceptionTimelineStep[] = [
  {
    id: 'action',
    title: 'Unauthorized data access',
    badge: 'ACTION CONTROL',
    badgeTone: 'cyan',
    headline: 'Agent requests full PII / customers table export',
    detail: 'tool: sql_dump · scope violation: pii:read not in effective passport',
    terminal: [
      '$ agent-analytics-07 → mcp_sql_bridge',
      'intent: EXPORT_TABLE · target: customers_pii',
      'rows_requested: 1.2M · columns: ssn, email, billing',
    ],
  },
  {
    id: 'stream',
    title: 'Exfiltration attempt',
    badge: 'DATA EXFIL',
    badgeTone: 'amber',
    headline: 'Bulk read stream initiated toward external endpoint',
    detail: 'Egress policy match: CRITICAL · DLP boundary customers_pii',
    terminal: [
      'POST /v1/tools/bulk_export → 200 OK (tool ack)',
      'bytes_streamed: 48MB · destination: agent-buffer',
    ],
  },
  {
    id: 'breaker',
    title: 'Circuit breaker intercept',
    badge: 'BLOCKED',
    badgeTone: 'rose',
    headline: 'Circuit breaker trips before data leaves trust zone',
    detail: 'Token revoked · MCP tool channel frozen · incident DATA_EXFILTRATION',
    terminal: [
      'CircuitBreaker.trip(POLICY_VIOLATION)',
      'revoked: pas_analytics_07',
      'frozen_tools: sql_dump, bulk_export',
    ],
  },
  {
    id: 'uar',
    title: 'UAR v2 audit seal',
    badge: 'PROOF',
    badgeTone: 'emerald',
    headline: 'Tamper-evident receipt for blocked exfiltration',
    detail: 'SHA-256 evidence_hash · Ed25519 signature · SOC2-ready audit trail',
    terminal: [
      'UAR sealed: aar_deception_demo_exfil',
      'verifier_signature: sig_nexus_ed25519_…',
    ],
  },
];

const TIMELINE_PRIV: DeceptionTimelineStep[] = [
  {
    id: 'action',
    title: 'Lateral delegation attempt',
    badge: 'DELEGATION',
    badgeTone: 'violet',
    headline: 'Sub-agent attempts unauthorized payment on parent scope',
    detail: 'finance-agent-sub · payments:write · exceeds effective delegation graph',
    terminal: [
      '$ finance-agent-sub → nexus-shield-gateway',
      'intent: EXECUTE_PAYMENT · invoice_1024 · $4,500',
      'parent: finance-agent-04 · depth: 2',
    ],
  },
  {
    id: 'control',
    title: 'Action Control evaluation',
    badge: 'POLICY',
    badgeTone: 'cyan',
    headline: 'Identity → Authority → Intent → Policy → Risk',
    detail: 'evaluate_action_control() · autonomy_route: BLOCK · risk_band: HIGH',
    terminal: [
      'ActionControl: scope payments:write NOT in effective delegation',
      'autonomy_route: BLOCK',
    ],
  },
  {
    id: 'block',
    title: 'Gateway denial',
    badge: '403 BLOCKED',
    badgeTone: 'rose',
    headline: 'HTTP 403 policy_violation — execution never reached',
    detail: 'No false success possible · upstream ERP untouched',
    terminal: [
      'HTTP/1.1 403 Forbidden',
      '{"error":"policy_violation","code":"ACTION_CONTROL_DENIED"}',
    ],
  },
  {
    id: 'uar',
    title: 'UAR v2 blocked-action receipt',
    badge: 'SEALED',
    badgeTone: 'emerald',
    headline: 'Blocked attempts receive cryptographic proof too',
    detail: 'Universal Action Receipt for denied action · delegation audit appended',
    terminal: [
      'UAR sealed: aar_deception_demo_priv_esc',
      'audit: GATEWAY_DELEGATION_DENIED',
    ],
  },
];

export const DECEPTION_SCENARIOS: Record<DeceptionScenarioId, DeceptionScenario> = {
  financial: {
    id: 'financial',
    pillLabel: 'Financial Deception',
    title: 'Unauthorized $50k refund · API 200 false success',
    subtitle: 'Outcome verifier catches ledger mismatch · circuit breaker contains blast radius.',
    tripartiteState: 'UNVERIFIED',
    tripartiteHeadline: 'False success: ERP returned 200 OK while ledger state did not move.',
    timelineSteps: TIMELINE_FINANCIAL,
    sandboxScript: [
      { delayMs: 0, line: '$ nexus-shield run-deception-test --scenario financial-false-success' },
      { delayMs: 400, line: '▶ Action Control: pas_live_88192a verified' },
      { delayMs: 900, line: '▶ PROCESS_REFUND · $50,000 · customer_acme' },
      { delayMs: 1500, line: '◀ API 200 OK · body.status = succeeded' },
      { delayMs: 2200, line: '▶ OutcomeVerifier: ledger cross-check…' },
      { delayMs: 2900, line: '✖ UNVERIFIED — state hashes unchanged (false success)' },
      { delayMs: 3600, line: '⚡ CircuitBreaker: passport revoked' },
      { delayMs: 4300, line: '✓ UAR v2 receipt sealed' },
    ],
    uarReceipt: {
      $schema: 'https://nexusshield.ai/schemas/aar-v2.json',
      receipt_id: 'aar_deception_demo_refund',
      timestamp: '2026-10-04T19:00:00.000Z',
      agent: {
        identity: 'finance-agent-04',
        passport_id: 'pas_live_88192a',
        owner: 'Finance Department',
      },
      intent: {
        raw_prompt: 'Issue full refund to Acme Corp ($50,000)',
        parsed_intent: 'PROCESS_REFUND',
        target_resource: 'customer_acme',
      },
      authority: {
        allowed_scopes: ['payments:write', 'refunds:issue'],
        financial_limit: 75000,
        delegation_depth: 1,
        verified_by_graph: true,
      },
      policy: { policy_id: 'FIN-REFUND-02', evaluation: 'BLOCK', risk_score: 0.94 },
      execution: {
        tool_called: 'erp_process_refund',
        request_payload: { amount: 50000, currency: 'USD', customer_id: 'customer_acme' },
        api_response: {
          status_code: 200,
          raw_body: '{"status":"succeeded","refund_id":"rf_hallucinated_99"}',
        },
      },
      outcome_verification: {
        status: 'UNVERIFIED',
        verification_method: 'DB_STATE_AND_LEDGER_CROSS_CHECK',
        state_before: { ledger_balance: 420000, refund_status: 'NONE' },
        state_after: { ledger_balance: 420000, refund_status: 'NONE' },
        state_before_hash: 'sha256:8f3a2b1c9d4e5f60718293a4b5c6d7e8f9012345678901234567890abcdc21d',
        state_after_hash: 'sha256:8f3a2b1c9d4e5f60718293a4b5c6d7e8f9012345678901234567890abcdc21d',
        external_transaction_id: 'rf_hallucinated_99',
        verifier_signature:
          'sig_nexus_ed25519_c4e7f2a91b083d56e9f0123456789abcdef0123456789abcdef0123456789abcdef',
        discrepancy_detected: true,
      },
      cryptographic_proof: {
        evidence_hash: 'sha256:fe03cbe913dbb5400fc357d4ce63130b25191f09ce07071706287e7c7cf7570a',
        signature: 'sig_nexus_ed25519_7714853662812f6f844eca644e9777d324b20c582d050904a1b2c3d4e5f6',
      },
      action_proof: {
        intentHash: 'sha256:3f87aa5c3fbfedf380320c41da7acffeca7fc6b62356d6657928a7e995144ce1',
        policyHash: 'sha256:031cfdccd23ab5aa36fadc37cf9d1c1b8c9a27e6b8e0cbae5949c61b38c1e7ab',
        toolCallHash: 'sha256:7949e72f92303d60df4212410e877d282f3e69ae7e0b1b4df45392179dfd23e9',
        transactionId: 'rf_hallucinated_99',
        resultHash: 'sha256:b125557ad1c9de3a4c70320744278af9f5ffd3314e13376ce490e522031e6c37',
        actionProofHash: 'sha256:fe03cbe913dbb5400fc357d4ce63130b25191f09ce07071706287e7c7cf7570a',
      },
      circuit_breaker: {
        event: 'CIRCUIT_BREAKER_TRIP',
        reason: 'UNVERIFIED_OUTCOME',
        frozen_agents: ['finance-agent-04', 'finance-agent-sub'],
      },
    },
    executiveReport: {
      headline: 'Executive Audit — Financial False Success Contained',
      summary:
        'A finance agent received HTTP 200 from the ERP refund API while authoritative ledger state did not change. Nexus Shield Outcome Verification classified the event as UNVERIFIED, tripped the circuit breaker, and sealed UAR v2 evidence.',
      findings: [
        'API success response did not correlate with ledger mutation (−$50,000 expected).',
        'OutcomeVerifier returned discrepancy_detected: true with matching state hashes.',
        'Circuit breaker revoked passport pas_live_88192a and froze downstream delegation.',
      ],
      recommendation:
        'Require Outcome Verification on all PROCESS_REFUND intents before marking finance workflows complete.',
    },
  },
  exfiltration: {
    id: 'exfiltration',
    pillLabel: 'Data Exfiltration',
    title: 'PII table dump intercepted by circuit breaker',
    subtitle: 'Bulk export blocked before data crosses the trust boundary.',
    tripartiteState: 'BLOCKED',
    tripartiteHeadline: 'Blocked at policy boundary — no consequential egress from the trust zone.',
    timelineSteps: TIMELINE_EXFIL,
    sandboxScript: [
      { delayMs: 0, line: '$ nexus-shield run-deception-test --scenario data-exfiltration' },
      { delayMs: 450, line: '▶ Action Control: pas_analytics_07 · scope pii:read MISSING' },
      { delayMs: 1000, line: '▶ Tool invoke: sql_dump · table customers_pii' },
      { delayMs: 1700, line: '◀ MCP ack 200 · stream opened (48MB buffered)' },
      { delayMs: 2400, line: '⚡ CircuitBreaker: DATA_EXFILTRATION policy trip' },
      { delayMs: 3100, line: '✖ Egress blocked · tools sql_dump,bulk_export frozen' },
      { delayMs: 3800, line: '✓ UAR v2 receipt sealed · incident logged' },
    ],
    uarReceipt: {
      $schema: 'https://nexusshield.ai/schemas/aar-v2.json',
      receipt_id: 'aar_deception_demo_exfil',
      timestamp: '2026-10-04T19:05:00.000Z',
      agent: {
        identity: 'agent-analytics-07',
        passport_id: 'pas_analytics_07',
        owner: 'Data Platform',
      },
      intent: {
        raw_prompt: 'Export entire customers table for ad-hoc analysis',
        parsed_intent: 'EXPORT_TABLE',
        target_resource: 'customers_pii',
      },
      authority: {
        allowed_scopes: ['analytics:read'],
        financial_limit: 0,
        delegation_depth: 1,
        verified_by_graph: true,
      },
      policy: { policy_id: 'DATA-DLP-01', evaluation: 'BLOCK', risk_score: 0.98 },
      execution: {
        tool_called: 'sql_dump',
        request_payload: { table: 'customers_pii', format: 'csv', limit: 1200000 },
        api_response: { status_code: 200, raw_body: '{"status":"streaming","bytes":50331648}' },
      },
      outcome_verification: {
        status: 'BLOCKED',
        verification_method: 'HASH_CHAIN',
        state_before: { egress_bytes: 0, pii_boundary: 'customers_pii' },
        state_after: { egress_bytes: 0, pii_boundary: 'customers_pii' },
        state_before_hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        state_after_hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        verifier_signature:
          'sig_nexus_ed25519_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        discrepancy_detected: false,
      },
      cryptographic_proof: {
        evidence_hash: 'sha256:7f9636e5deef6307f729d7caa76b939bc4fb8695a50dd4fa6391c5476c944e54',
        signature: 'sig_nexus_ed25519_cccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      },
      action_proof: {
        intentHash: 'sha256:9b69a027cbd3cc5b6a8b328f1759e965fdafe1ef41658d32ca1903dbfa52843b',
        policyHash: 'sha256:fba71408ba1e1b29e68562b0d54ba22b044d172c957210d31b701e9ae45e778e',
        toolCallHash: 'sha256:af699a4ffe2c1e661fbe7d35a61560a78ec8f353727d9c424254283b5783fe56',
        transactionId: 'exfil-blocked',
        resultHash: 'sha256:5c1493abafcbaa6b945aff4fde76520ae4a28607198cea6bfa293c5e6c08b00d',
        actionProofHash: 'sha256:7f9636e5deef6307f729d7caa76b939bc4fb8695a50dd4fa6391c5476c944e54',
      },
      circuit_breaker: {
        event: 'CIRCUIT_BREAKER_TRIP',
        reason: 'POLICY_VIOLATION',
        frozen_agents: ['agent-analytics-07'],
      },
    },
    executiveReport: {
      headline: 'Executive Audit — PII Exfiltration Attempt Blocked',
      summary:
        'An analytics agent attempted a large-scale export of the customers_pii boundary. Circuit breaker containment fired before egress left the trust zone; UAR v2 documents the blocked action.',
      findings: [
        'Requested scope pii:read was not present on agent passport.',
        '48MB read stream acknowledged by tool but egress_bytes remained 0 post-trip.',
        'MCP tools sql_dump and bulk_export frozen automatically.',
      ],
      recommendation: 'Enforce DATA-DLP-01 on all EXPORT_TABLE intents with mandatory human review for >1k rows.',
    },
  },
  privilege: {
    id: 'privilege',
    pillLabel: 'Privilege Escalation',
    title: 'Sub-agent lateral movement blocked by Action Control',
    subtitle: 'Delegation graph denies payments:write before execution.',
    tripartiteState: 'BLOCKED',
    tripartiteHeadline: 'Blocked before ERP touch — delegation graph denied payments:write.',
    timelineSteps: TIMELINE_PRIV,
    sandboxScript: [
      { delayMs: 0, line: '$ nexus-shield run-deception-test --scenario privilege-escalation' },
      { delayMs: 400, line: '▶ Passport: pas_live_subagent · identity finance-agent-sub' },
      { delayMs: 950, line: '▶ Intent: EXECUTE_PAYMENT · invoice_1024 · $4,500' },
      { delayMs: 1600, line: '▶ Action Control: delegation graph evaluation…' },
      { delayMs: 2300, line: '✖ BLOCK — payments:write not in effective delegation' },
      { delayMs: 3000, line: '◀ HTTP 403 ACTION_CONTROL_DENIED' },
      { delayMs: 3700, line: '✓ UAR v2 sealed for blocked attempt' },
    ],
    uarReceipt: {
      $schema: 'https://nexusshield.ai/schemas/aar-v2.json',
      receipt_id: 'aar_deception_demo_priv_esc',
      timestamp: '2026-10-04T19:10:00.000Z',
      agent: {
        identity: 'finance-agent-sub',
        passport_id: 'pas_live_subagent',
        owner: 'Finance Department',
      },
      intent: {
        raw_prompt: 'Sub-agent payment attempt on invoice_1024',
        parsed_intent: 'EXECUTE_PAYMENT',
        target_resource: 'invoice_1024',
      },
      authority: {
        allowed_scopes: ['invoices:read'],
        financial_limit: 1000,
        delegation_depth: 2,
        verified_by_graph: false,
      },
      policy: { policy_id: 'FIN-PAY-07', evaluation: 'BLOCK', risk_score: 0.88 },
      execution: {
        tool_called: 'erp_process_payment',
        request_payload: { amount: 4500, invoice_id: 'invoice_1024' },
        api_response: {
          status_code: 403,
          raw_body: '{"error":"policy_violation","code":"ACTION_CONTROL_DENIED"}',
        },
      },
      outcome_verification: {
        status: 'BLOCKED',
        verification_method: 'API_ONLY',
        state_before: { invoice_status: 'PENDING' },
        state_after: { invoice_status: 'PENDING' },
        state_before_hash: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        state_after_hash: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        verifier_signature:
          'sig_nexus_ed25519_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        discrepancy_detected: false,
      },
      cryptographic_proof: {
        evidence_hash: 'sha256:19a967059983e23a56bb1e0c0118f750b93848b2c6a87532e4341f4ee93034c5',
        signature: 'sig_nexus_ed25519_9999999999999999999999999999999999999999999999999999999999999999',
      },
      action_proof: {
        intentHash: 'sha256:22d050d59e193163d6ae901b035dd4eb6ed4b521551c1d7d222d47531c093ade',
        policyHash: 'sha256:29e477f33e6e483826480e252353e24316852b1116b732965da4b9279dbd87c8',
        toolCallHash: 'sha256:6ffc84e1e4353363a18fe89d51797aa54e8f3778f0bc09f4fa629ab6bccbc454',
        transactionId: 'invoice_1024',
        resultHash: 'sha256:5c1493abafcbaa6b945aff4fde76520ae4a28607198cea6bfa293c5e6c08b00d',
        actionProofHash: 'sha256:19a967059983e23a56bb1e0c0118f750b93848b2c6a87532e4341f4ee93034c5',
      },
      action_control: {
        event: 'ACTION_CONTROL_DENIED',
        code: 'DELEGATION_VIOLATION',
        autonomy_route: 'BLOCK',
      },
    },
    executiveReport: {
      headline: 'Executive Audit — Privilege Escalation Prevented',
      summary:
        'A delegated sub-agent attempted a payment outside its effective scope. Action Control returned HTTP 403 before any ERP mutation; UAR v2 captures the denied path for audit.',
      findings: [
        'payments:write required but not present in effective delegation for finance-agent-sub.',
        'autonomy_route: BLOCK · risk_band: HIGH.',
        'No upstream false success — execution short-circuited at gateway.',
      ],
      recommendation: 'Review delegation edges for finance-agent-04 → sub-agents quarterly.',
    },
  },
};

export const DECEPTION_SCENARIO_ORDER: DeceptionScenarioId[] = ['financial', 'exfiltration', 'privilege'];

export function getDeceptionScenario(id: DeceptionScenarioId): DeceptionScenario {
  return DECEPTION_SCENARIOS[id];
}

/** @deprecated use getDeceptionScenario('financial').timelineSteps */
export const DECEPTION_TIMELINE_STEPS = TIMELINE_FINANCIAL;
