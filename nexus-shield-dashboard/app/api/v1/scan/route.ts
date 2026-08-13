import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey, extractApiKey } from '@/lib/auth/api-key';
import { enforceScanQuota, scanQuotaExceededResponse } from '@/lib/usage/enforce-scan-quota';
import { recordScanResult } from '@/lib/scans';
import { scanContent } from '@/lib/scanner/patterns';

export const runtime = 'nodejs';

const fileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

const scanRequestSchema = z.object({
  repo_name: z.string().min(1),
  commit_sha: z.string().min(1),
  pr_number: z.number().int().nullable().optional(),
  files: z.array(fileSchema).min(1).max(100),
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

    const { repo_name, commit_sha, pr_number, files } = parsed.data;

    const findings = files.flatMap((file) =>
      scanContent(file.content, file.path).map((issue) => ({
        type: issue.type,
        file: file.path,
        line: issue.line,
        preview: issue.preview,
      })),
    );

    const status = findings.length > 0 ? 'failed' : 'passed';

    const { scanId } = await recordScanResult(org.id, {
      repo_name,
      commit_sha,
      pr_number,
      findings,
      status,
    });

    const secretsCount = findings.filter((f) => !['TCKN', 'Credit Card', 'Email'].includes(f.type)).length;
    const piiCount = findings.length - secretsCount;

    return NextResponse.json(
      {
        success: true,
        scan_id: scanId,
        status,
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
    body: {
      repo_name: 'owner/repo',
      commit_sha: 'abc123',
      pr_number: null,
      files: [{ path: 'src/config.ts', content: 'const API_KEY = "sk-proj-..."' }],
    },
  });
}
