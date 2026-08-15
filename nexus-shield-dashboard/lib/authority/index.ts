export type {
  AgentAuthorityInput,
  AuthorityEdge,
  AuthorityGraph,
  AuthorityNode,
  AuthorityNodeType,
  CombinatorialRiskFinding,
  CombinatorialRiskKind,
  EffectiveAuthorityResult,
  EffectiveRiskLevel,
} from '@/lib/authority/types';

export { resolveEffectiveRiskLevel } from '@/lib/authority/types';

export {
  calculateEffectiveAuthority,
  calculateEffectiveAuthorityFromInput,
  getCachedAuthorityGraph,
  listCachedAuthorityGraphs,
  registerAuthorityGraph,
  resetAuthorityGraphCache,
} from '@/lib/authority/engine';

export {
  COMBINATORIAL_RULES,
  annotateGraphWithRisks,
  classifyAgentTools,
  classifyTool,
  detectCombinatorialRisks,
  hasPrivilegeEscalation,
  scoreCombinatorialRisks,
} from '@/lib/authority/detector';

export type { ClassifiedTool, CombinatorialRule, ToolCapabilityClass } from '@/lib/authority/detector';
