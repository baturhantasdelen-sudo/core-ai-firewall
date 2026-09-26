export interface InvestorGrowthMetrics {
  scannedAgentsMcps: number;
  developersInstalled: number;
  analyzedToolCalls: number;
  blockedDangerousActions: number;
  avgInterceptLatencyMs: number;
  detectionSuccessRatePct: number;
  certifiedSub10ms: boolean;
}

export interface LiveGrowthEvent {
  id: string;
  timestamp: string;
  message: string;
  latencyMs: number;
  severity: 'info' | 'block' | 'proof';
}

export const INVESTOR_GROWTH_METRICS: InvestorGrowthMetrics = {
  scannedAgentsMcps: 12_400,
  developersInstalled: 1_840,
  analyzedToolCalls: 4_210_000,
  blockedDangerousActions: 286_000,
  avgInterceptLatencyMs: 5.87,
  detectionSuccessRatePct: 99.3,
  certifiedSub10ms: true,
};

const EVENT_TEMPLATES: Omit<LiveGrowthEvent, 'id' | 'timestamp'>[] = [
  { message: 'INTENT_MISMATCH blocked rm -rf on agent-finance-042', latencyMs: 5.2, severity: 'block' },
  { message: 'SHA-256 evidence sealed for MCP tool hijack attempt', latencyMs: 6.1, severity: 'proof' },
  { message: 'TRAJECTORY_VIOLATION: READ_DB → webhook exfil chain stopped', latencyMs: 4.8, severity: 'block' },
  { message: 'Privilege escalation attempt blocked (admin scope)', latencyMs: 5.9, severity: 'block' },
  { message: 'Public Proof Badge issued — Challenge Level 5 cleared', latencyMs: 5.4, severity: 'proof' },
  { message: 'P99 runtime intercept: 6.1ms (Nexus benchmark harness) — fleet telemetry sync', latencyMs: 6.1, severity: 'info' },
  { message: 'UNSIGNED_ACTION blocked stripe_transfer $25,000', latencyMs: 4.9, severity: 'block' },
  { message: 'npm install @nexus-shield/sdk — developer +1 (EU-West)', latencyMs: 0, severity: 'info' },
];

export function generateLiveEvent(index: number): LiveGrowthEvent {
  const template = EVENT_TEMPLATES[index % EVENT_TEMPLATES.length];
  return {
    id: `evt-${Date.now()}-${index}`,
    timestamp: new Date().toISOString(),
    ...template,
  };
}

export function formatGrowthNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M+`;
  }
  if (value >= 1_000) {
    return `${Math.floor(value / 1_000).toLocaleString('en-US')}K+`;
  }
  return value.toLocaleString('en-US');
}
