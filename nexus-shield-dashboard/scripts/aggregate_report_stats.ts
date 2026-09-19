/**
 * Aggregates scan_results_2026.json into report_summary.json
 *
 * Usage: npx tsx scripts/aggregate_report_stats.ts
 */

import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { aggregateReportStats } from '../lib/research/aggregate-report-stats';
import type { ResearchScanResultsFile } from '../lib/research/types';

const ROOT = process.cwd();
const INPUT = path.join(ROOT, 'data', 'reports', 'scan_results_2026.json');
const OUTPUT = path.join(ROOT, 'data', 'reports', 'report_summary.json');

async function main() {
  const raw = await readFile(INPUT, 'utf8');
  const data = JSON.parse(raw) as ResearchScanResultsFile;
  const summary = aggregateReportStats(data);
  await writeFile(OUTPUT, JSON.stringify(summary, null, 2), 'utf8');
  console.log('[research] Wrote', OUTPUT);
  console.log('[research] Key metrics:', summary.keyMetricCards.map((c) => `${c.label}: ${c.value}`).join(' · '));
}

main().catch((error) => {
  console.error('[research] Aggregation failed:', error);
  process.exit(1);
});
