/**
 * Unified Responsible Disclosure batch — scan 15 vertical targets,
 * generate PDF advisories, and produce outbound outreach matrix.
 *
 * Usage:
 *   npm run disclosure:run-all
 *   npm run disclosure:run-all -- --send-email
 */

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { loadLocalEnv } from '../lib/disclosure/load-env';
import { dispatchDisclosureBatchEmails } from '../lib/disclosure/resend-dispatcher';
import { DISCLOSURE_TARGETS } from '../lib/disclosure/targets';
import {
  advisoryPdfFilename,
  advisoryPdfRelativePath,
  scanDisclosureTarget,
} from '../lib/disclosure/disclosure-engine';
import {
  buildOutboundBatch,
  renderOutboundMarkdown,
} from '../lib/disclosure/outbound-matrix';
import { generateSecurityAdvisoryPdfBuffer } from '../lib/reports/security-advisory-pdf';
import type { DisclosureScanResult } from '../lib/disclosure/types';

const ROOT = process.cwd();
const TEMP_DIR = path.join(ROOT, 'temp_targets', 'disclosure');
const PDF_DIR = path.join(ROOT, 'public', 'reports', 'advisories');
const DATA_DIR = path.join(ROOT, 'data');
const JSON_OUT = path.join(DATA_DIR, 'outbound_disclosure_batch.json');
const MD_OUT = path.join(DATA_DIR, 'outbound_disclosure_batch.md');
const CONCURRENCY = 5;

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
  loadLocalEnv();
  const sendEmail = process.argv.includes('--send-email');

  console.log('[disclosure] Unified Responsible Disclosure batch — 2026');
  console.log(`[disclosure] Targets: ${DISCLOSURE_TARGETS.length} verticals`);
  if (sendEmail) {
    console.log('[disclosure] Email dispatch: ENABLED (Resend)');
  }

  await mkdir(TEMP_DIR, { recursive: true });
  await mkdir(PDF_DIR, { recursive: true });
  await mkdir(DATA_DIR, { recursive: true });

  const started = Date.now();

  const results = await runPool(DISCLOSURE_TARGETS, CONCURRENCY, async (target, index) => {
    console.log(
      `[disclosure] [${index + 1}/${DISCLOSURE_TARGETS.length}] Scanning ${target.organizationName} (${target.vertical})…`,
    );

    const scanned = await scanDisclosureTarget(target, TEMP_DIR);
    const pdfRelativePath = advisoryPdfRelativePath(target.slug);
    const pdfDiskPath = path.join(PDF_DIR, advisoryPdfFilename(target.slug));

    const fullResult: DisclosureScanResult = {
      ...scanned,
      pdfRelativePath,
    };

    const pdfBuffer = await generateSecurityAdvisoryPdfBuffer(fullResult);
    await writeFile(pdfDiskPath, pdfBuffer);

    console.log(
      `[disclosure]   → score=${fullResult.securityScore} hijack=${fullResult.metrics.parameterHijackingRisk} pdf=${pdfRelativePath}`,
    );

    return fullResult;
  });

  const batch = buildOutboundBatch(results);
  await writeFile(JSON_OUT, JSON.stringify(batch, null, 2), 'utf8');
  await writeFile(MD_OUT, renderOutboundMarkdown(batch), 'utf8');

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[disclosure] Wrote ${JSON_OUT}`);
  console.log(`[disclosure] Wrote ${MD_OUT}`);
  console.log(`[disclosure] Generated ${results.length} PDF advisories in ${elapsed}s`);
  console.log(
    `[disclosure] Verticals: YC=${batch.verticals['yc-ai-saas']} FinTech=${batch.verticals['fintech-mcp']} TR=${batch.verticals['enterprise-tr']}`,
  );

  if (sendEmail) {
    console.log('[disclosure] Dispatching advisory emails via Resend…');
    const emailResults = await dispatchDisclosureBatchEmails({
      batch,
      scanResults: results,
      pdfDir: PDF_DIR,
    });
    const sent = emailResults.filter((r) => r.status === 'sent').length;
    const failed = emailResults.filter((r) => r.status === 'failed').length;
    console.log(`[disclosure] Email summary: ${sent} sent, ${failed} failed`);
    await writeFile(
      path.join(DATA_DIR, 'outbound_disclosure_email_log.json'),
      JSON.stringify(emailResults, null, 2),
      'utf8',
    );
  }
}

main().catch((error) => {
  console.error('[disclosure] Batch failed:', error);
  process.exit(1);
});
