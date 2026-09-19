/**
 * State of AI Agent Security 2026 — research scan pipeline.
 * Fetches 50 GitHub targets, runs Nexus Shield scanner, writes JSON results.
 *
 * Usage: npx tsx scripts/run_agent_security_scan.ts
 * Optional: GITHUB_TOKEN for higher API rate limits
 */

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { RESEARCH_TARGETS_2026 } from '../lib/research/targets-2026';
import { scanResearchTarget } from '../lib/research/research-scanner';
import type { ResearchScanResultsFile } from '../lib/research/types';

const CONCURRENCY = 4;
const ROOT = process.cwd();
const TEMP_DIR = path.join(ROOT, 'temp_targets');
const DATA_DIR = path.join(ROOT, 'data', 'reports');
const OUTPUT_FILE = path.join(DATA_DIR, 'scan_results_2026.json');

async function runPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function next(): Promise<void> {
    const index = cursor;
    cursor += 1;
    if (index >= items.length) return;
    results[index] = await worker(items[index], index);
    await next();
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
  return results;
}

async function main() {
  console.log('[research] State of AI Agent Security 2026 — scan pipeline');
  console.log(`[research] Targets: ${RESEARCH_TARGETS_2026.length}`);

  await mkdir(TEMP_DIR, { recursive: true });
  await mkdir(DATA_DIR, { recursive: true });

  const started = Date.now();
  const results = await runPool(RESEARCH_TARGETS_2026, CONCURRENCY, async (target, index) => {
    console.log(`[research] [${index + 1}/${RESEARCH_TARGETS_2026.length}] Scanning ${target.slug}…`);
    try {
      const row = await scanResearchTarget(target, TEMP_DIR);
      console.log(
        `[research]   → score=${row.securityScore} grade=${row.grade} validation=${row.parameterValidationStatus}`,
      );
      return row;
    } catch (error) {
      console.error(`[research]   ✗ ${target.slug}:`, error instanceof Error ? error.message : error);
      throw error;
    }
  });

  const payload: ResearchScanResultsFile = {
    reportId: 'state-of-agent-security-2026',
    title: 'State of AI Agent Security 2026',
    generatedAt: new Date().toISOString(),
    targetCount: results.length,
    results,
  };

  await writeFile(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf8');
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[research] Wrote ${OUTPUT_FILE} (${results.length} rows) in ${elapsed}s`);
}

main().catch((error) => {
  console.error('[research] Pipeline failed:', error);
  process.exit(1);
});
