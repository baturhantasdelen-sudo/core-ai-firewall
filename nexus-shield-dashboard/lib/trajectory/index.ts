export type {
  TrajectoryChain,
  TrajectoryEvaluation,
  TrajectoryRiskScore,
  TrajectoryStep,
  TrajectoryStepCategory,
} from '@/lib/trajectory/types';

export {
  TRAJECTORY_HIGH_RISK_THRESHOLD,
  resolveTrajectoryLevel,
} from '@/lib/trajectory/types';

export {
  TRAJECTORY_WINDOW_MS,
  buildDemoExfiltrationChain,
  buildTrajectoryChain,
  classifyTrajectoryStep,
  evaluateTrajectory,
  getTrajectorySteps,
  recordTrajectoryStep,
  resetTrajectoryStore,
} from '@/lib/trajectory/engine';
