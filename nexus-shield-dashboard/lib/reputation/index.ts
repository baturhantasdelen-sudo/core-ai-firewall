export type {
  AgentReputation,
  ReputationCalculationInput,
  ReputationMetrics,
  TrustPolicyAction,
  TrustPolicyResult,
  TrustTier,
} from '@/lib/reputation/types';

export { resolveTrustTier } from '@/lib/reputation/types';

export {
  buildMockAgentReputations,
  calculateAgentReputation,
  getAgentReputation,
  getTrustPolicyAction,
  listAgentReputations,
  resetReputationEngineStore,
  simulatePositiveActivity,
  simulateSecurityViolation,
  upsertAgentMetrics,
} from '@/lib/reputation/engine';
