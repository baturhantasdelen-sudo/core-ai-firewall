/** Mirrors enterprise/evidence_chain.py STAGE_ORDER for Proof Center playground UI. */

export const EVIDENCE_CHAIN_STAGES = [
  'intent_captured',
  'action_proposed',
  'policy_evaluated',
  'decision_recorded',
  'tool_execution',
  'state_change',
  'uar_sealed',
] as const;

export function buildEvidenceChainPreview(input: {
  intent: string;
  toolName: string;
  decision: string;
  beforeHash: string;
  afterHash: string;
  evidenceHash: string;
}): Array<{ stage: string; detail: string; linked: boolean }> {
  return [
    { stage: 'intent_captured', detail: input.intent.slice(0, 80), linked: true },
    { stage: 'action_proposed', detail: input.toolName, linked: true },
    { stage: 'policy_evaluated', detail: 'Runtime Action Governance', linked: true },
    { stage: 'decision_recorded', detail: input.decision, linked: true },
    { stage: 'tool_execution', detail: input.decision === 'BLOCK' ? 'blocked_at_boundary' : 'pending_host', linked: true },
    { stage: 'state_change', detail: `${input.beforeHash.slice(0, 18)}… → ${input.afterHash.slice(0, 18)}…`, linked: true },
    { stage: 'uar_sealed', detail: input.evidenceHash, linked: true },
  ];
}
