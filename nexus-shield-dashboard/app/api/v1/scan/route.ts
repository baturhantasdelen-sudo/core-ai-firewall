import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey, extractApiKey } from '@/lib/auth/api-key';
import { runDetectionEngine, runDetectionEngineOnLines, discoverAgents, summarizeAgentDiscovery } from '@/lib/engine';
import { finalizeFindingsContext, partitionFindingsByContext } from '@/lib/engine/context';
import { loadPolicyFromObject } from '@/lib/engine/policy';
import { remediateFiles } from '@/lib/engine/remediation';
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

interface ScannedFile {
  path: string;
  content: string;
}

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
    const includeFixes = req.nextUrl.searchParams.get('include_fixes') === 'true';

    const engineFindings: SarifFinding[] = [];
    const scannedFiles: ScannedFile[] = [];
    const fileContentByPath = new Map<string, string>();

    for (const file of files) {
      if (file.patch) {
        const addedLines = parseAddedLinesFromPatch(file.patch);
        const patchContent = addedLines.map((line) => line.content).join('\n');
        fileContentByPath.set(file.path, patchContent);
        scannedFiles.push({ path: file.path, content: patchContent });

        const lineFindings = runDetectionEngineOnLines(
          addedLines.map((line) => ({ lineNumber: line.lineNumber, content: line.content })),
          file.path,
          policy,
          { includeSuppressed: true },
        );
        engineFindings.push(...lineFindings.map((finding) => ({ ...finding, file: file.path })));
        continue;
      }

      if (file.content !== undefined) {
        fileContentByPath.set(file.path, file.content);
        scannedFiles.push({ path: file.path, content: file.content });

        const contentFindings = runDetectionEngine(file.content, file.path, policy, {
          includeSuppressed: true,
        });
        engineFindings.push(...contentFindings.map((finding) => ({ ...finding, file: file.path })));
      }
    }

    const validatedFindings = (await validateSecretFindings(engineFindings)) as SarifFinding[];

    const validationByKey = new Map<string, NonNullable<SarifFinding['validation']>>();
    for (const finding of validatedFindings) {
      if (!finding.validation) continue;
      validationByKey.set(
        `${finding.ruleId}:${finding.line}:${finding.matched}`,
        finding.validation,
      );
    }

    const contextualizedFindings = finalizeFindingsContext(
      validatedFindings,
      fileContentByPath,
      validationByKey,
    ).map((finding) => {
      const source = validatedFindings.find(
        (candidate) =>
          candidate.ruleId === finding.ruleId &&
          candidate.line === finding.line &&
          candidate.matched === finding.matched &&
          candidate.file === (finding as SarifFinding).file,
      );
      return {
        ...finding,
        file: source?.file,
        validation: source?.validation,
      } satisfies SarifFinding;
    });

    const { active: activeFindings, suppressed: suppressedFindings } =
      partitionFindingsByContext(contextualizedFindings);

    const enrichedFindings = activeFindings;

    let fixedFiles:
      | Array<{
          path: string;
          content: string;
          original_content: string;
          fixes: Array<Record<string, unknown>>;
        }>
      | undefined;
    let envExampleAdditions: string[] | undefined;

    if (includeFixes && enrichedFindings.length > 0) {
      const remediationInput = scannedFiles.map((file) => ({
        path: file.path,
        content: file.content,
        findings: enrichedFindings.filter((finding) => finding.file === file.path),
      }));

      const batch = remediateFiles(remediationInput, policy);
      fixedFiles = batch.files.map((file) => ({
        path: file.path,
        content: file.content,
        original_content: file.originalContent,
        fixes: file.fixes.map((fix) => ({
          rule_id: fix.ruleId,
          type: fix.type,
          category: fix.category,
          line: fix.line,
          column: fix.column,
          original: fix.original,
          replacement: fix.replacement,
          env_var: fix.envVarName ?? null,
          env_example_line: fix.envExampleLine ?? null,
        })),
      }));
      envExampleAdditions = batch.envExampleAdditions;

      const fixByKey = new Map<string, (typeof batch.files)[number]['fixes'][number]>();
      for (const file of batch.files) {
        for (const fix of file.fixes) {
          fixByKey.set(`${fix.file}:${fix.line}:${fix.column}:${fix.original}`, fix);
        }
      }

      for (const finding of enrichedFindings) {
        const key = `${finding.file}:${finding.line}:${finding.column}:${finding.matched}`;
        const fix = fixByKey.get(key);
        if (fix) finding.fix = fix;
      }
    }

    const mapFinding = (finding: SarifFinding) => ({
      type: finding.type,
      file: finding.file,
      line: finding.line,
      preview: finding.preview,
      rule_id: finding.ruleId,
      confidence: finding.confidence,
      severity: finding.severity,
      category: finding.category,
      validation: finding.validation ?? null,
      confidence_score: finding.confidenceScore ?? null,
      suppressed: finding.suppressed ?? false,
      suppression_reason: finding.suppressionReason ?? null,
      fix: finding.fix
        ? {
            original: finding.fix.original,
            replacement: finding.fix.replacement,
            env_var: finding.fix.envVarName ?? null,
            env_example_line: finding.fix.envExampleLine ?? null,
          }
        : null,
    });

    const findings = enrichedFindings.map(mapFinding);
    const suppressed = suppressedFindings.map(mapFinding);

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
    const agentDiscovery = summarizeAgentDiscovery(discoverAgents(scannedFiles));

    if (format === 'sarif') {
      const sarif = findingsToSarif(contextualizedFindings, {
        repoName: repo_name,
        commitSha: commit_sha,
        scanId,
        includeSuppressed: false,
      });
      return NextResponse.json(sarif, { status: 200 });
    }

    return NextResponse.json(
      {
        success: true,
        scan_id: scanId,
        status,
        findings,
        suppressed_findings: suppressed,
        suppressed_count: suppressed.length,
        findings_count: findings.length,
        secrets_blocked: secretsCount,
        pii_leaks_blocked: piiCount,
        scans_used_this_month: quota.used + 1,
        monthly_scan_limit: quota.limit,
        remaining: Math.max(0, quota.remaining - 1),
        agent_discovery: agentDiscovery,
        ...(includeFixes
          ? {
              fixed_files: fixedFiles ?? [],
              env_example_additions: envExampleAdditions ?? [],
            }
          : {}),
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
    query: { format: 'json | sarif', include_fixes: 'true | false' },
    body: {
      repo_name: 'owner/repo',
      commit_sha: 'abc123',
      pr_number: null,
      policy: { version: 1, profile: 'TR', remediation: { pii_mask_style: 'partial' } },
      files: [
        { path: 'src/config.ts', content: 'const API_KEY = "sk-proj-..."' },
        { path: 'src/app.ts', patch: '@@ -1,1 +1,2 @@\\n+const token = "ghp_..."' },
      ],
    },
  });
}
