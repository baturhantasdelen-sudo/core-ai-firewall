import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getAuthContext } from '@/lib/auth/session';
import { enforceScanQuota, scanQuotaExceededResponse } from '@/lib/usage/enforce-scan-quota';
import { recordScanResult } from '@/lib/scans';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const auth = await getAuthContext();

    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const quota = await enforceScanQuota(auth.org);

    if (!quota.allowed) {
      return NextResponse.json(scanQuotaExceededResponse(quota), { status: 402 });
    }

    const commitSha = randomBytes(20).toString('hex');
    const prNumber = Math.floor(Math.random() * 900) + 100;
    const createdAt = new Date().toISOString();

    const { scanId } = await recordScanResult(auth.org.id, {
      repo_name: 'nexus-shield/demo-repo',
      commit_sha: commitSha,
      pr_number: prNumber,
      status: 'failed',
      findings: [
        {
          type: 'OpenAI API Key',
          file: 'src/config.ts',
          line: 12,
          preview: 'sk-proj-****************abcd',
        },
        {
          type: 'TCKN',
          file: 'data/users.json',
          line: 4,
          preview: '1234567****901',
        },
      ],
    });

    return NextResponse.json(
      {
        success: true,
        scan_id: scanId,
        created_at: createdAt,
        message: 'Mock scan recorded — check dashboard for live update',
        scan: {
          id: scanId,
          repoName: 'nexus-shield/demo-repo',
          commitSha,
          prNumber,
          status: 'blocked' as const,
          createdAt,
          findings: [
            {
              type: 'OpenAI API Key' as const,
              filePath: 'src/config.ts',
              line: 12,
              preview: 'sk-proj-****************abcd',
            },
            {
              type: 'TCKN' as const,
              filePath: 'data/users.json',
              line: 4,
              preview: '1234567****901',
            },
          ],
        },
        scans_used_this_month: quota.used + 1,
        monthly_scan_limit: quota.limit,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Mock scan failed';
    console.error('[mock-scan] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
