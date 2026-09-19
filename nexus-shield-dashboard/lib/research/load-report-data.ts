import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import {
  FALLBACK_REPORT_BUNDLE,
  FALLBACK_REPORT_SUMMARY,
  FALLBACK_SCAN_RESULTS,
} from '@/lib/research/fallback-report-data';
import type { ResearchScanResultsFile, ResearchSummaryMetrics } from '@/lib/research/types';

const DATA_DIR = path.join(process.cwd(), 'data', 'reports');

export type ReportDataSource = 'file' | 'fallback';

export interface ReportBundle2026 {
  scan: ResearchScanResultsFile;
  summary: ResearchSummaryMetrics;
  source: ReportDataSource;
}

function scanResultsPath(): string {
  return path.join(DATA_DIR, 'scan_results_2026.json');
}

function summaryPath(): string {
  return path.join(DATA_DIR, 'report_summary.json');
}

export async function loadScanResults2026(): Promise<ResearchScanResultsFile | null> {
  try {
    if (!existsSync(scanResultsPath())) return null;
    const raw = await readFile(scanResultsPath(), 'utf8');
    return JSON.parse(raw) as ResearchScanResultsFile;
  } catch {
    return null;
  }
}

export async function loadReportSummary2026(): Promise<ResearchSummaryMetrics | null> {
  try {
    if (!existsSync(summaryPath())) return null;
    const raw = await readFile(summaryPath(), 'utf8');
    return JSON.parse(raw) as ResearchSummaryMetrics;
  } catch {
    return null;
  }
}

export async function loadReportBundle2026(): Promise<ReportBundle2026> {
  const scan = await loadScanResults2026();
  const summary = await loadReportSummary2026();

  if (scan && summary) {
    return { scan, summary, source: 'file' };
  }

  return {
    scan: scan ?? FALLBACK_SCAN_RESULTS,
    summary: summary ?? FALLBACK_REPORT_SUMMARY,
    source: 'fallback',
  };
}
