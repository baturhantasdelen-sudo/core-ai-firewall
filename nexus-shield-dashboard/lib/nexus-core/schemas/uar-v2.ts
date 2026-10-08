/** UAR v2 canonical schema types (API + landing alignment). */

import type { ActionProofBundle } from '@/lib/accountability/action-proof';
import type { OutcomeVerificationStatus } from '@/lib/nexus-core/outcome-verification';

export interface UarV2FiveDimensionalTrace {
  who: { agent_id: string; passport_id?: string };
  can: { effective_scopes: string[]; authority_hash: string };
  why: { user_intent: string; intent_hash: string };
  did: { tool_name: string; tool_call_hash: string; transaction_id: string };
  outcome: {
    status: OutcomeVerificationStatus | string;
    result_hash: string;
    adapter_system: string;
    divergence_reason?: string;
    verification_status?: OutcomeVerificationStatus | string;
    verification_id?: string;
    evidence_ids?: string[];
    outcome_diff?: Array<{
      field: string;
      expected: unknown;
      actual: unknown;
      difference: string;
      severity: string;
    }>;
    verification_score?: number;
    false_success_detected?: boolean;
  };
}

export interface UarV2CryptographicAnchor {
  evidence_hash: string;
  signature: string;
  action_proof: ActionProofBundle;
  binding_valid: boolean;
}

export interface UarV2Receipt {
  $schema: 'https://nexusshield.ai/schemas/aar-v2.json';
  receipt_id: string;
  timestamp: string;
  trace: UarV2FiveDimensionalTrace;
  cryptographic_anchor: UarV2CryptographicAnchor;
  decision: string;
  agent_status: string;
  capabilities_revoked: boolean;
  containment?: {
    human_in_the_loop: boolean;
    trust_isolation?: {
      isolated_agent_id: string;
      delegation_chain: string[];
      siblings_unaffected: boolean;
    };
  };
}
