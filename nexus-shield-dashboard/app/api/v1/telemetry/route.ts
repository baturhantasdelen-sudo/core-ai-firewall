import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey, extractApiKey } from '@/lib/auth/api-key';
import { findingsToSarif, type SarifFinding } from '@/lib/engine/sarif';
import { enforceScanQuota, scanQuotaExceededResponse } from '@/lib/usage/enforce-scan-quota';
import { recordScanResult } from '@/lib/scans';

export const runtime = 'nodejs';

const findingSchema = z.object({
  type: z.string(),
  file: z.string().optional(),
  line: z.number().int().optional(),
  preview: z.string().optional(),
  rule_id: z.string().optional(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'note']).optional(),
  category: z.enum(['secret', 'pii']).optional(),
});

const telemetrySchema = z.object({
  repo_name: z.string().min(1, 'repo_name is required'),
  commit_sha: z.string().min(1, 'commit_sha is required'),
  pr_number: z.number().int().nullable().optional(),
  findings: z.array(findingSchema).default([]),
  status: z.enum(['passed', 'failed']),
});

export async function POST(req: NextRequest) {
  try {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing x-api-key or x-nexus-api-key header' },
        { status: 401 },
      );
    }

    const org = await authenticateApiKey(apiKey);

    if (!org) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API key' }, { status: 401 });
    }

    const quota = await enforceScanQuota(org);

    if (!quota.allowed) {
      return NextResponse.json(scanQuotaExceededResponse(quota), { status: 402 });
    }

    const body = await req.json();
    const parsed = telemetrySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { repo_name, commit_sha, pr_number, findings, status } = parsed.data;
    const format = req.nextUrl.searchParams.get('format');

    const { scanId } = await recordScanResult(org.id, {
      repo_name,
      commit_sha,
      pr_number,
      findings,
      status,
    });

    if (format === 'sarif') {
      const sarifFindings: SarifFinding[] = findings.map((finding, index) => ({
        ruleId: finding.rule_id ?? finding.type.toLowerCase().replace(/\s+/g, '-'),
        type: finding.type,
        line: finding.line ?? 1,
        column: 1,
        preview: finding.preview ?? '',
        matched: finding.preview ?? finding.type,
        confidence: finding.confidence ?? 'MEDIUM',
        severity: finding.severity ?? 'medium',
        category: finding.category ?? 'secret',
        file: finding.file,
        entropy: undefined,
      }));

      const sarif = findingsToSarif(sarifFindings, {
        repoName: repo_name,
        commitSha: commit_sha,
        scanId,
      });

      return NextResponse.json(sarif, { status: 200 });
    }

    return NextResponse.json(
      {
        success: true,
        scan_id: scanId,
        scans_used_this_month: quota.used + 1,
        monthly_scan_limit: quota.limit,
        remaining: Math.max(0, quota.remaining - 1),
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[telemetry] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
