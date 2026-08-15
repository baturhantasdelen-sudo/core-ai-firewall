export type {
  AgentInventory,
  AgentInventoryStatus,
  AgentInventoryType,
  DiscoveryScanResult,
  DiscoverySummary,
  NetworkFlowLog,
} from '@/lib/discovery/types';

export {
  HIGH_RISK_SCORE_THRESHOLD,
  summarizeDiscovery,
} from '@/lib/discovery/types';

export {
  buildMockDiscoveryScan,
  detectAgentsFromCode,
  detectAgentsFromNetworkLogs,
  filterAgentInventory,
  runDiscoveryScan,
} from '@/lib/discovery/discoveryService';

export type { DiscoveryServiceOptions } from '@/lib/discovery/discoveryService';
