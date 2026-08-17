import { resetRedTeamStore, runRedTeamSimulation } from '@/lib/redteam/engine';

export type {
  AttackVector,
  AutoRemediateResult,
  RedTeamScenario,
  RedTeamSimulationInput,
  SimulationResult,
  SimulationRiskRating,
  VectorSimulationOutcome,
} from '@/lib/redteam/types';

export {
  isBlockedOutcome,
  isExposedOutcome,
} from '@/lib/redteam/types';

export {
  autoRemediateVulnerabilities,
  getRedTeamSimulation,
  listPredefinedScenarios,
  resetRedTeamStore,
  runRedTeamSimulation,
} from '@/lib/redteam/engine';

const DEMO_AGENT = {
  agentId: 'crewai-ops-agent-1',
  agentName: 'Ops Coordinator',
  capabilities: ['READ', 'API_CALL'],
};

/** Run demo simulation for dashboard with limited-capability agent. */
export function buildMockRedTeamSimulation(): ReturnType<typeof runRedTeamSimulation> {
  resetRedTeamStore();
  return runRedTeamSimulation(DEMO_AGENT);
}

export { DEMO_AGENT as RED_TEAM_DEMO_AGENT };
