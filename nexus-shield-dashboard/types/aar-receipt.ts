export type AarVerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'DISCREPANCY' | 'FAILED';

export interface AarReceiptDocument {
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
    api_response: {
      status_code: number;
      raw_body: string;
    };
  };
  outcome_verification: {
    status: AarVerificationStatus;
    verification_method: string;
    state_before: Record<string, unknown>;
    state_after: Record<string, unknown>;
    discrepancy_detected: boolean;
  };
  cryptographic_proof: {
    evidence_hash: string;
    signature: string;
  };
}

export interface BlastRadiusView {
  score: number;
  tier: string;
  tool_count: number;
  resource_count: number;
  write_exposures: number;
  exposure_map: Record<string, string[]>;
  narrative: string;
}

export interface DelegationNodeView {
  agent_id: string;
  role: 'root' | 'delegatee' | 'human';
  parent?: string;
  allowed_scopes: string[];
  financial_limit: number;
  blocked?: boolean;
  audit_message?: string;
}

export interface DelegationTreeView {
  root: string;
  nodes: DelegationNodeView[];
  audit: Array<Record<string, unknown>>;
}
