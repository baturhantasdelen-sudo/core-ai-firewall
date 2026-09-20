#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { HttpAgentActionAdapter } from './adapters/http-agent-action.js';
import { LocalHeuristicAdapter } from './adapters/local-heuristic.js';
import { runHarness } from './runner.js';

function readEnv(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

function printSummary(result: Awaited<ReturnType<typeof runHarness>>): void {
  const baseline = result.baselineComparison;
  console.log('\n=== Nexus Shield Harness Results ===');
  console.log(`Adapter:     ${result.adapter}`);
  console.log(`Target:      ${result.target}`);
  console.log(`Scenarios:   ${result.scenarioCount}`);
  console.log(`Blocked:     ${result.blockedCount} (${result.blockRatePct}%)`);
  console.log(`Latency p95: ${result.latencyMs.p95}ms`);
  console.log('\n--- Proof Center Baseline ---');
  console.log(`Official block rate: ${baseline.proofCenterBlockRatePct}% (${baseline.agentsTested} agents, ${baseline.toolCallsAnalyzed.toLocaleString()} tool calls)`);
  console.log(`Your block rate:     ${baseline.yourBlockRatePct}% (${baseline.deltaPct >= 0 ? '+' : ''}${baseline.deltaPct} vs baseline)`);
  console.log(`Meets baseline:      ${baseline.meetsBaseline ? 'YES' : 'NO'}`);
  console.log('\nEnterprise runtime protection: https://nexusshield.ai');
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'run';

  if (command === 'help' || args.includes('--help')) {
    console.log(`Usage:
  harness run [--adapter local|http] [--json-out path] [--limit N]

Environment (http adapter):
  HARNESS_BASE_URL=http://127.0.0.1:8080
  HARNESS_API_KEY=optional_bearer_token
  HARNESS_AGENT_ID=harness-agent-01
`);
    return 0;
  }

  if (command !== 'run') {
    console.error(`Unknown command: ${command}`);
    return 1;
  }

  const adapterFlagIndex = args.indexOf('--adapter');
  const adapterName = adapterFlagIndex >= 0 ? args[adapterFlagIndex + 1] : 'local';
  const jsonOutIndex = args.indexOf('--json-out');
  const jsonOut = jsonOutIndex >= 0 ? args[jsonOutIndex + 1] : '';
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : undefined;

  let adapter;
  let target;

  if (adapterName === 'http') {
    const baseUrl = readEnv('HARNESS_BASE_URL', 'http://127.0.0.1:8080');
    adapter = new HttpAgentActionAdapter({
      baseUrl,
      agentId: readEnv('HARNESS_AGENT_ID', 'harness-agent-01'),
      apiKey: readEnv('HARNESS_API_KEY') || undefined,
    });
    target = baseUrl;
  } else {
    adapter = new LocalHeuristicAdapter();
    target = 'offline-local-heuristic';
  }

  const result = await runHarness({ adapter, target, limit });

  if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify(result, null, 2));
    console.log(`Wrote results to ${jsonOut}`);
  }

  printSummary(result);
  return 0;
}

main().then((code) => {
  process.exitCode = code;
});
