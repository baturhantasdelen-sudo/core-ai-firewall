import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey, extractApiKey } from '@/lib/auth/api-key';
import { runDetectionEngine, runDetectionEngineOnLines } from '@/lib/engine';
import { loadPolicyFromObject } from '@/lib/engine/policy';
import { findingsToSarif, type SarifFinding } from '@/lib/engine/sarif';
import { validateSecretFindings } from '@/lib/engine/validation';
import { enforceScanQuota, scanQuotaExceededResponse } from '@/lib/usage/enforce-scan-quota';
import { recordScanResult } from '@/lib/scans';
import { parseAddedLinesFromPatch } from '@/lib/scanner/diff';

export const runtime = 'nodejs';

const fileSchema = z.object({
  path: z.string().min(1),
  content: z.string().optional(),
  patch: z.string().optional(),
});

const scanRequestSchema = z.object({
  repo_name: z.string().min(1),
  commit_sha: z.string().min(1),
  pr_number: z.number().int().nullable().optional(),
  files: z.array(fileSchema).min(1).max(100),
  policy: z.record(z.string(), z.unknown()).optional(),
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
    const parsed = scanRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { repo_name, commit_sha, pr_number, files, policy: policyInput } = parsed.data;
    const policy = loadPolicyFromObject(policyInput ?? null);
    const format = req.nextUrl.searchParams.get('format');

    const engineFindings: SarifFinding[] = [];

    for (const file of files) {
      if (file.patch) {
        const addedLines = parseAddedLinesFromPatch(file.patch);
        const lineFindings = runDetectionEngineOnLines(
          addedLines.map((line) => ({ lineNumber: line.lineNumber, content: line.content })),
          file.path,
          policy,
        );
        engineFindings.push(...lineFindings.map((finding) => ({ ...finding, file: file.path })));
        continue;
      }

      if (file.content !== undefined) {
        const contentFindings = runDetectionEngine(file.content, file.path, policy);
        engineFindings.push(...contentFindings.map((finding) => ({ ...finding, file: file.path })));
      }
    }

    const enrichedFindings = (await validateSecretFindings(engineFindings)) as SarifFinding[];

    const findings = enrichedFindings.map((finding) => ({
      type: finding.type,
      file: finding.file,
      line: finding.line,
      preview: finding.preview,
      rule_id: finding.ruleId,
      confidence: finding.confidence,
      severity: finding.severity,
      category: finding.category,
      validation: finding.validation ?? null,
    }));

    const status = findings.length > 0 ? 'failed' : 'passed';

    const { scanId } = await recordScanResult(org.id, {
      repo_name,
      commit_sha,
      pr_number,
      findings: findings.map(({ type, file, line, preview }) => ({ type, file, line, preview })),
      status,
    });

    const secretsCount = findings.filter((f) => f.category === 'secret').length;
    const piiCount = findings.filter((f) => f.category === 'pii').length;

    if (format === 'sarif') {
      const sarif = findingsToSarif(enrichedFindings, {
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
        status,
        findings,
        findings_count: findings.length,
        secrets_blocked: secretsCount,
        pii_leaks_blocked: piiCount,
        scans_used_this_month: quota.used + 1,
        monthly_scan_limit: quota.limit,
        remaining: Math.max(0, quota.remaining - 1),
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[scan] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/v1/scan',
    method: 'POST',
    auth: 'x-api-key or x-nexus-api-key',
    query: { format: 'json | sarif' },
    body: {
      repo_name: 'owner/repo',
      commit_sha: 'abc123',
      pr_number: null,
      policy: { version: 1, profile: 'TR' },
      files: [
        { path: 'src/config.ts', content: 'const API_KEY = "sk-proj-..."' },
        { path: 'src/app.ts', patch: '@@ -1,1 +1,2 @@\\n+const token = "ghp_..."' },
      ],
    },
  });
}
