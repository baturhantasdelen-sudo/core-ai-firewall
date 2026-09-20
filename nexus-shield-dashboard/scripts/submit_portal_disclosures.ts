/**
 * Submit security advisories to vendor portal intake channels.
 *
 * Usage:
 *   npm run disclosure:submit-portals
 *   npm run disclosure:submit-portals -- --target=activepieces
 *   npx tsx scripts/submit_portal_disclosures.ts --target=n8n --dry-run
 */

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { loadLocalEnv } from '../lib/disclosure/load-env';
import {
  findBatchRow,
  getGithubToken,
  loadOutboundBatch,
  PORTAL_TARGETS,
  renderSubmissionTable,
  submitPortalDisclosure,
  type PortalSubmissionResult,
  type PortalTargetId,
} from '../lib/disclosure/portal-submissions';

const DATA_DIR = path.join(process.cwd(), 'data');
const LOG_OUT = path.join(DATA_DIR, 'portal_disclosure_submissions.json');

function parseTargetArg(): PortalTargetId | undefined {
  const arg = process.argv.find((a) => a.startsWith('--target='));
  if (!arg) return undefined;
  const value = arg.split('=')[1]?.trim();
  if (value === 'activepieces' || value === 'n8n') return value;
  throw new Error(`Invalid --target value "${value}". Use activepieces or n8n.`);
}

async function main() {
  loadLocalEnv();

  const targetFilter = parseTargetArg();
  const dryRun = process.argv.includes('--dry-run');
  const token = getGithubToken();
  const portals = targetFilter
    ? PORTAL_TARGETS.filter((p) => p.id === targetFilter)
    : PORTAL_TARGETS;

  console.log('[portal] Vendor portal disclosure submission');
  if (dryRun) console.log('[portal] Mode: DRY RUN (no outbound API calls)');
  if (targetFilter) console.log(`[portal] Target filter: ${targetFilter}`);
  if (token) {
    console.log('[portal] GitHub token: configured');
  } else {
    console.log('[portal] GitHub token: not set (GITHUB_TOKEN / GH_PAT) — manual fallback enabled');
  }

  const batch = await loadOutboundBatch();
  const results: PortalSubmissionResult[] = [];

  for (const portal of portals) {
    const row = findBatchRow(batch, portal);
    if (!row) {
      results.push({
        portalId: portal.id,
        label: portal.label,
        status: 'skipped',
        method: 'manual',
        submissionUrl: portal.manualSubmissionUrl,
        error: `Batch row not found for "${portal.batchOrganizationName}" — run disclosure:run-all first`,
      });
      continue;
    }

    console.log(`[portal] Submitting ${portal.label}…`);
    const result = await submitPortalDisclosure({
      portalId: portal.id,
      row,
      token,
      dryRun,
    });
    results.push(result);

    const icon =
      result.status === 'submitted'
        ? '✓'
        : result.status === 'manual_required'
          ? '○'
          : result.status === 'failed'
            ? '✗'
            : '—';

    console.log(
      `[portal] ${icon} ${portal.label}: ${result.status} via ${result.method}${result.reportId ? ` (id=${result.reportId})` : ''}`,
    );

    if (result.payloadLog) {
      console.log('[portal] Payload log:');
      console.log(JSON.stringify(result.payloadLog, null, 2));
    }

    if (result.status !== 'submitted') {
      console.log(`[portal] Manual URL: ${result.submissionUrl}`);
      if (result.error) console.log(`[portal] Note: ${result.error}`);
    }
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(LOG_OUT, JSON.stringify(results, null, 2), 'utf8');

  console.log('\n[portal] Submission summary');
  console.log(renderSubmissionTable(results));
  console.log(`\n[portal] Wrote ${LOG_OUT}`);
}

main().catch((error) => {
  console.error('[portal] Submission failed:', error);
  process.exit(1);
});
