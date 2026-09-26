export type UniversalActionDecision = 'ALLOW' | 'BLOCK' | 'READ_ONLY' | 'REQUIRE_APPROVAL';

export interface UniversalActionReceipt {
  receipt_id: string;
  timestamp: string;
  agent: {
    id: string;
    identity_verified: boolean;
  };
  intent: string;
  proposed_action: {
    tool: string;
    params: Record<string, unknown>;
  };
  policy_evaluated: {
    rule_id: string;
    action: string;
  };
  decision: UniversalActionDecision;
  execution_state: {
    before_hash: string;
    after_hash: string;
  };
  evidence_bundle_hash: string;
}
