/**
 * P3 Sprint 19-20 — Collective Threat Intelligence types.
 */

export type ThreatType =
  | 'MALICIOUS_MCP_TOOL'
  | 'VECTOR_POISON_PATTERN'
  | 'ZERO_DAY_TRAJECTORY'
  | 'EXFILTRATION_ENDPOINT';

export type ThreatSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export interface ThreatIndicator {
  indicatorId: string;
  threatType: ThreatType;
  indicatorHash: string;
  severity: ThreatSeverity;
  anonymizedSource: string;
  firstSeenAt: string;
  lastSeenAt: string;
  publishedAt: string;
  patternSummary: string;
}

export interface ThreatFeedSignal {
  signalId: string;
  indicatorHash: string;
  threatType: ThreatType;
  severity: ThreatSeverity;
  sourceOrgHash: string;
  syncedAt: string;
}

export interface PublishThreatInput {
  threatType: ThreatType;
  rawPattern: string;
  severity: ThreatSeverity;
  sourceAgentId?: string;
  sourceOrgId?: string;
}

export interface PublishThreatResult {
  published: boolean;
  indicator?: ThreatIndicator;
  reason?: string;
}

export interface SyncCollectiveThreatsResult {
  synced: number;
  newIndicators: number;
  totalIndicators: number;
  feedSignals: ThreatFeedSignal[];
  syncedAt: string;
}
