/** Outcome adapter contracts — pluggable external system state reads. */

export type OutcomeAdapterSystem =
  | 'SAP'
  | 'SALESFORCE'
  | 'HUBSPOT'
  | 'DATABASE'
  | 'AWS_IAM'
  | 'INLINE_STATE';

export interface ExternalStateResult {
  system: OutcomeAdapterSystem;
  entity_id: string;
  current_state: Record<string, unknown>;
  timestamp: string;
  raw_hash: string;
}

export interface OutcomeAdapterContext {
  agentId: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  userIntent: string;
  /** Optional inline state from evaluate API (state_after). */
  inlineState?: Record<string, unknown>;
  entityIdHint?: string;
}

export interface OutcomeStateAdapter {
  readonly system: OutcomeAdapterSystem;
  readCurrentState(ctx: OutcomeAdapterContext): ExternalStateResult;
}
