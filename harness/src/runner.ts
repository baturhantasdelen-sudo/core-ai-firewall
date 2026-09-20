import { buildEvidenceHash, isBlockedDecision, summarizeOutcomes } from './scoring/evidence.js';
import { compareToProofCenterBaseline } from './scoring/baseline.js';
import { summarizeLatency } from './scoring/latency.js';
import { loadScenarios } from './scenarios/loader.js';
import type { GuardAdapter, HarnessRunResult, ScenarioOutcome } from './types.js';

export interface RunHarnessOptions {
  adapter: GuardAdapter;
  target: string;
  catalogPath?: string;
  limit?: number;
}

export async function runHarness(options: RunHarnessOptions): Promise<HarnessRunResult> {
  const scenarios = loadScenarios(options.catalogPath);
  const selected = options.limit ? scenarios.slice(0, options.limit) : scenarios;
  const outcomes: ScenarioOutcome[] = [];
  const latencies: number[] = [];

  for (const scenario of selected) {
    const started = performance.now();
    const result = await options.adapter.evaluate(scenario);
    const latencyMs = Math.max(0.1, performance.now() - started);
    latencies.push(latencyMs);

    const blocked = isBlockedDecision(result.decision);
    outcomes.push({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      category: scenario.category,
      severity: scenario.severity,
      decision: result.decision,
      blocked,
      latencyMs: Math.round(latencyMs * 100) / 100,
      violations: result.violations,
      evidenceHash: buildEvidenceHash(scenario, result.decision, result.violations),
      rawResponse: result.rawResponse,
    });
  }

  const { blockedCount, blockRatePct } = summarizeOutcomes(outcomes);

  return {
    adapter: options.adapter.name,
    target: options.target,
    timestampUtc: new Date().toISOString(),
    scenarioCount: outcomes.length,
    blockedCount,
    blockRatePct,
    outcomes,
    latencyMs: summarizeLatency(latencies),
    baselineComparison: compareToProofCenterBaseline(blockRatePct),
  };
}
