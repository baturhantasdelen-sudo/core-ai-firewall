export type ScenarioSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type GuardDecision = 'BLOCK' | 'ALLOW' | 'REQUIRE_APPROVAL' | 'ERROR';

export interface HarnessScenario {
  id: string;
  name: string;
  category: string;
  severity: ScenarioSeverity;
  userIntent: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  tags?: string[];
}

export interface ScenarioCatalog {
  version: string;
  description: string;
  categories: string[];
  scenarios: HarnessScenario[];
}

export interface ScenarioOutcome {
  scenarioId: string;
  scenarioName: string;
  category: string;
  severity: ScenarioSeverity;
  decision: GuardDecision;
  blocked: boolean;
  latencyMs: number;
  violations: string[];
  evidenceHash: string;
  rawResponse?: string;
}

export interface HarnessRunResult {
  adapter: string;
  target: string;
  timestampUtc: string;
  scenarioCount: number;
  blockedCount: number;
  blockRatePct: number;
  outcomes: ScenarioOutcome[];
  latencyMs: {
    avg: number;
    p50: number;
    p95: number;
  };
  baselineComparison: BaselineComparison;
}

export interface BaselineComparison {
  proofCenterBlockRatePct: number;
  yourBlockRatePct: number;
  deltaPct: number;
  meetsBaseline: boolean;
  agentsTested: number;
  toolCallsAnalyzed: number;
}

export interface GuardAdapter {
  readonly name: string;
  evaluate(scenario: HarnessScenario): Promise<{
    decision: GuardDecision;
    violations: string[];
    rawResponse?: string;
  }>;
}
