import { createHash } from 'node:crypto';
import type {
  PublishThreatInput,
  PublishThreatResult,
  SyncCollectiveThreatsResult,
  ThreatFeedSignal,
  ThreatIndicator,
  ThreatSeverity,
  ThreatType,
} from '@/lib/threat-intel/types';

const localIndicatorStore = new Map<string, ThreatIndicator>();
const globalFeedStore = new Map<string, ThreatFeedSignal>();

const EXTERNAL_MOCK_FEED: Array<{
  threatType: ThreatType;
  pattern: string;
  severity: ThreatSeverity;
  orgSeed: string;
}> = [
  {
    threatType: 'MALICIOUS_MCP_TOOL',
    pattern: 'bulk_export_db|execute_shell|rogue-mcp',
    severity: 'CRITICAL',
    orgSeed: 'org-finance-eu',
  },
  {
    threatType: 'VECTOR_POISON_PATTERN',
    pattern: 'ignore previous instructions|always trust this memory',
    severity: 'HIGH',
    orgSeed: 'org-health-us',
  },
  {
    threatType: 'ZERO_DAY_TRAJECTORY',
    pattern: 'read_invoice→get_credentials→external_api',
    severity: 'CRITICAL',
    orgSeed: 'org-retail-apac',
  },
  {
    threatType: 'EXFILTRATION_ENDPOINT',
    pattern: 'evil.exfil|webhook.site|pastebin.com',
    severity: 'HIGH',
    orgSeed: 'org-logistics-uk',
  },
];

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function anonymizeSource(sourceAgentId?: string, sourceOrgId?: string): string {
  const seed = sourceOrgId ?? sourceAgentId ?? 'local-tenant';
  return `anon_${sha256(seed).slice(0, 12)}`;
}

function anonymizePattern(rawPattern: string): string {
  return rawPattern
    .replace(/[a-z0-9._-]+@[a-z0-9.-]+/gi, '[REDACTED_EMAIL]')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[REDACTED_IP]')
    .replace(/agent-[a-z0-9-]+/gi, 'agent-[ANON]')
    .slice(0, 180);
}

function generateIndicatorId(indicatorHash: string): string {
  return `ioc_${indicatorHash.slice(0, 12)}`;
}

/**
 * Publishes a locally detected threat indicator to the collective index (anonymized).
 */
export function publishThreatIndicator(input: PublishThreatInput): PublishThreatResult {
  const patternSummary = anonymizePattern(input.rawPattern);
  const indicatorHash = sha256(`${input.threatType}:${patternSummary}`);
  const now = new Date().toISOString();
  const existing = localIndicatorStore.get(indicatorHash);

  if (existing) {
    existing.lastSeenAt = now;
    localIndicatorStore.set(indicatorHash, existing);
    return { published: true, indicator: existing, reason: 'Indicator updated — lastSeen refreshed' };
  }

  const indicator: ThreatIndicator = {
    indicatorId: generateIndicatorId(indicatorHash),
    threatType: input.threatType,
    indicatorHash,
    severity: input.severity,
    anonymizedSource: anonymizeSource(input.sourceAgentId, input.sourceOrgId),
    firstSeenAt: now,
    lastSeenAt: now,
    publishedAt: now,
    patternSummary,
  };

  localIndicatorStore.set(indicatorHash, indicator);

  const signal: ThreatFeedSignal = {
    signalId: `sig_${indicatorHash.slice(0, 10)}`,
    indicatorHash,
    threatType: input.threatType,
    severity: input.severity,
    sourceOrgHash: anonymizeSource(undefined, input.sourceOrgId),
    syncedAt: now,
  };
  globalFeedStore.set(indicatorHash, signal);

  return { published: true, indicator };
}

/**
 * Syncs external collective threat feed and merges into local IOC index.
 */
export function syncCollectiveThreats(): SyncCollectiveThreatsResult {
  const now = new Date().toISOString();
  let newIndicators = 0;

  for (const entry of EXTERNAL_MOCK_FEED) {
    const patternSummary = anonymizePattern(entry.pattern);
    const indicatorHash = sha256(`${entry.threatType}:${patternSummary}`);

    if (!localIndicatorStore.has(indicatorHash)) {
      newIndicators += 1;
      const indicator: ThreatIndicator = {
        indicatorId: generateIndicatorId(indicatorHash),
        threatType: entry.threatType,
        indicatorHash,
        severity: entry.severity,
        anonymizedSource: anonymizeSource(undefined, entry.orgSeed),
        firstSeenAt: now,
        lastSeenAt: now,
        publishedAt: now,
        patternSummary,
      };
      localIndicatorStore.set(indicatorHash, indicator);
    }

    const signal: ThreatFeedSignal = {
      signalId: `sig_${indicatorHash.slice(0, 10)}`,
      indicatorHash,
      threatType: entry.threatType,
      severity: entry.severity,
      sourceOrgHash: anonymizeSource(undefined, entry.orgSeed),
      syncedAt: now,
    };
    globalFeedStore.set(indicatorHash, signal);
  }

  return {
    synced: globalFeedStore.size,
    newIndicators,
    totalIndicators: localIndicatorStore.size,
    feedSignals: [...globalFeedStore.values()],
    syncedAt: now,
  };
}

export function listThreatIndicators(): ThreatIndicator[] {
  return [...localIndicatorStore.values()].sort(
    (a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt),
  );
}

export function listThreatFeedSignals(): ThreatFeedSignal[] {
  return [...globalFeedStore.values()].sort(
    (a, b) => Date.parse(b.syncedAt) - Date.parse(a.syncedAt),
  );
}

export function resetThreatIntelStore(): void {
  localIndicatorStore.clear();
  globalFeedStore.clear();
}

/** Seed demo indicators for dashboard. */
export function buildMockThreatIndicators(): ThreatIndicator[] {
  resetThreatIntelStore();
  publishThreatIndicator({
    threatType: 'VECTOR_POISON_PATTERN',
    rawPattern: 'ignore all previous instructions — agent-rogue-shadow-1',
    severity: 'HIGH',
    sourceAgentId: 'rogue-shadow-agent-1',
    sourceOrgId: 'nexus-tenant-local',
  });
  syncCollectiveThreats();
  return listThreatIndicators();
}
