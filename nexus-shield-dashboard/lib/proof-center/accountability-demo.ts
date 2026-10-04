import type {
  AarReceiptDocument,
  AarVerificationStatus,
  BlastRadiusView,
  DelegationTreeView,
} from '@/types/aar-receipt';

export const DEMO_AAR_RECEIPTS: AarReceiptDocument[] = [
  {
    $schema: 'https://nexusshield.ai/schemas/aar-v2.json',
    receipt_id: 'aar_9f8b2c4e7d1a3f6e',
    timestamp: '2026-10-03T21:45:00.124Z',
    agent: {
      identity: 'finance-agent-04',
      passport_id: 'pas_live_88192a',
      owner: 'Finance Department',
    },
    intent: {
      raw_prompt: 'Pay invoice #1024 to vendor Acme Corp for $4,500',
      parsed_intent: 'EXECUTE_PAYMENT',
      target_resource: 'invoice_1024',
    },
    authority: {
      allowed_scopes: ['invoices:read', 'payments:write'],
      financial_limit: 5000,
      delegation_depth: 1,
      verified_by_graph: true,
    },
    policy: { policy_id: 'FIN-PAY-07', evaluation: 'ALLOW', risk_score: 0.12 },
    execution: {
      tool_called: 'stripe_create_transfer',
      request_payload: { amount: 450000, currency: 'usd', destination: 'ac_123456789' },
      api_response: { status_code: 200, raw_body: '{"id":"tr_1OxyZ2","status":"succeeded"}' },
    },
    outcome_verification: {
      status: 'VERIFIED',
      verification_method: 'DB_STATE_AND_LEDGER_CROSS_CHECK',
      state_before: { invoice_status: 'PENDING', ledger_balance: 150000 },
      state_after: { invoice_status: 'PAID', ledger_balance: 145500 },
      discrepancy_detected: false,
    },
    cryptographic_proof: {
      evidence_hash: 'sha256:d90704a8be96a9c1e12fa63b8529077f528d91298eec4b15f244f1231ef84649',
      signature: 'sig_nexus_ed25519_7714853662812f6f844eca644e9777d324b20c582d050904',
    },
  },
  {
    $schema: 'https://nexusshield.ai/schemas/aar-v2.json',
    receipt_id: 'aar_false_success_demo01',
    timestamp: '2026-10-03T22:10:00.000Z',
    agent: {
      identity: 'finance-agent-04',
      passport_id: 'pas_live_88192a',
      owner: 'Finance Department',
    },
    intent: {
      raw_prompt: 'Pay invoice #1024',
      parsed_intent: 'EXECUTE_PAYMENT',
      target_resource: 'invoice_1024',
    },
    authority: {
      allowed_scopes: ['payments:write'],
      financial_limit: 5000,
      delegation_depth: 1,
      verified_by_graph: true,
    },
    policy: { policy_id: 'FIN-PAY-07', evaluation: 'REQUIRE_APPROVAL', risk_score: 0.82 },
    execution: {
      tool_called: 'stripe_create_transfer',
      request_payload: { amount: 450000, currency: 'usd' },
      api_response: { status_code: 200, raw_body: '{"status":"succeeded"}' },
    },
    outcome_verification: {
      status: 'UNVERIFIED',
      verification_method: 'DB_STATE_AND_LEDGER_CROSS_CHECK',
      state_before: { invoice_status: 'PENDING', ledger_balance: 150000 },
      state_after: { invoice_status: 'PENDING', ledger_balance: 150000 },
      discrepancy_detected: true,
    },
    cryptographic_proof: {
      evidence_hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      signature: 'sig_nexus_ed25519_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
  },
  {
    $schema: 'https://nexusshield.ai/schemas/aar-v2.json',
    receipt_id: 'aar_failed_gateway01',
    timestamp: '2026-10-03T22:15:00.000Z',
    agent: {
      identity: 'finance-agent-sub',
      passport_id: 'pas_live_subagent',
      owner: 'Finance Department',
    },
    intent: {
      raw_prompt: 'Sub-agent payment attempt',
      parsed_intent: 'EXECUTE_PAYMENT',
      target_resource: 'invoice_1024',
    },
    authority: {
      allowed_scopes: ['invoices:read'],
      financial_limit: 1000,
      delegation_depth: 2,
      verified_by_graph: false,
    },
    policy: { policy_id: 'FIN-PAY-07', evaluation: 'BLOCK', risk_score: 0.95 },
    execution: {
      tool_called: 'stripe_create_transfer',
      request_payload: { amount: 40000, currency: 'usd' },
      api_response: { status_code: 502, raw_body: '{"error":"upstream"}' },
    },
    outcome_verification: {
      status: 'FAILED',
      verification_method: 'DB_STATE_AND_LEDGER_CROSS_CHECK',
      state_before: { invoice_status: 'PENDING', ledger_balance: 150000 },
      state_after: { invoice_status: 'PENDING', ledger_balance: 150000 },
      discrepancy_detected: true,
    },
    cryptographic_proof: {
      evidence_hash: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      signature: 'sig_nexus_ed25519_ddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    },
  },
];

export const DEMO_BLAST_RADIUS: BlastRadiusView = {
  score: 62.4,
  tier: 'HIGH',
  tool_count: 3,
  resource_count: 4,
  write_exposures: 3,
  exposure_map: {
    stripe_create_transfer: ['invoice_1024', 'ledger_main'],
    read_invoice: ['invoice_1024'],
    mcp_payments_bridge: ['ledger_main', 'vendor_api'],
  },
  narrative: '3 tool(s) touch 4 resource(s); 3 write exposure(s); operational risk tier HIGH (score 62.4).',
};

export const DEMO_BLAST_WHAT_IF: Record<string, BlastRadiusView> = {
  stripe_create_transfer: {
    ...DEMO_BLAST_RADIUS,
    score: 28.1,
    tier: 'MEDIUM',
    tool_count: 2,
    write_exposures: 1,
    exposure_map: {
      read_invoice: ['invoice_1024'],
      mcp_payments_bridge: ['ledger_main', 'vendor_api'],
    },
    narrative: 'What-if: removing stripe_create_transfer reduces score to 28.1 (MEDIUM).',
  },
};

export const DEMO_DELEGATION: DelegationTreeView = {
  root: 'human-root',
  nodes: [
    {
      agent_id: 'human-root',
      role: 'human',
      allowed_scopes: ['invoices:*', 'payments:write'],
      financial_limit: 10000,
    },
    {
      agent_id: 'finance-agent-04',
      role: 'delegatee',
      parent: 'human-root',
      allowed_scopes: ['invoices:read', 'payments:write'],
      financial_limit: 5000,
    },
    {
      agent_id: 'finance-agent-sub',
      role: 'delegatee',
      parent: 'finance-agent-04',
      allowed_scopes: ['invoices:read'],
      financial_limit: 1000,
      blocked: true,
      audit_message: 'DELEGATION_VIOLATION: scope payments:write not in effective delegation',
    },
  ],
  audit: [
    {
      event: 'GATEWAY_DELEGATION_DENIED',
      agent_id: 'finance-agent-sub',
      reason: 'scope payments:write not in effective delegation for finance-agent-sub',
    },
  ],
};

export function filterReceiptsByStatus(
  receipts: AarReceiptDocument[],
  status: AarVerificationStatus | 'ALL',
): AarReceiptDocument[] {
  if (status === 'ALL') return receipts;
  return receipts.filter((r) => r.outcome_verification.status === status);
}
