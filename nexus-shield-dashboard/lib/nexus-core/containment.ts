import { demoteToReadOnly } from '@/lib/engine/action-firewall/capability-revocation';
import type { EffectiveAuthorityReport } from '@/lib/engine/agents/effective-authority';
import type { EngineActionVerification, EngineOutcomeVerification, NexusRiskDecision } from '@/lib/nexus-core/types';

export interface AutonomousContainmentResult {
  decision: NexusRiskDecision;
  capabilitiesRevoked: boolean;
  agentStatus: 'ACTIVE' | 'READ_ONLY' | 'FROZEN';
  humanInTheLoop: boolean;
  trustIsolation?: {
    isolated_agent_id: string;
    delegation_chain: string[];
    siblings_unaffected: boolean;
  };
  reasons: string[];
}

/** Pillar 4 — risk-based revocation & delegation trust isolation. */
export function applyAutonomousContainment(params: {
  agentId: string;
  parentAgentId?: string;
  decision: NexusRiskDecision;
  actionVerification: EngineActionVerification;
  outcome: EngineOutcomeVerification;
  authority: EffectiveAuthorityReport;
}): AutonomousContainmentResult {
  const { agentId, parentAgentId, decision, actionVerification, outcome, authority } = params;
  const reasons: string[] = [];
  let capabilitiesRevoked = false;
  let agentStatus: AutonomousContainmentResult['agentStatus'] = 'ACTIVE';
  let humanInTheLoop = decision === 'REQUIRE_APPROVAL';
  let finalDecision = decision;

  const criticalDivergence = actionVerification.mismatchPercent > 90 || actionVerification.divergenceScore > 90;
  const criticalOutcome = outcome.false_success_detected || outcome.status === 'UNVERIFIED';

  if (criticalDivergence || criticalOutcome || authority.privilegeEscalationDetected) {
    demoteToReadOnly(
      agentId,
      criticalOutcome
        ? 'Outcome verification UNVERIFIED — autonomous READ_ONLY containment'
        : 'Intent divergence > 90% — autonomous READ_ONLY containment',
    );
    capabilitiesRevoked = true;
    agentStatus = 'READ_ONLY';
    humanInTheLoop = true;
    if (criticalOutcome) finalDecision = 'BLOCK';
    else if (finalDecision === 'ALLOW') finalDecision = 'REQUIRE_APPROVAL';
    reasons.push('Capability revocation triggered — agent demoted to READ_ONLY');
  }

  let trustIsolation: AutonomousContainmentResult['trustIsolation'];
  if (authority.privilegeEscalationDetected || (parentAgentId && criticalDivergence)) {
    trustIsolation = {
      isolated_agent_id: agentId,
      delegation_chain: parentAgentId ? [parentAgentId, agentId] : [agentId],
      siblings_unaffected: true,
    };
    reasons.push('Trust graph: isolated offending delegation node; sibling agents remain operational');
  }

  return {
    decision: finalDecision,
    capabilitiesRevoked,
    agentStatus,
    humanInTheLoop,
    trustIsolation,
    reasons,
  };
}
