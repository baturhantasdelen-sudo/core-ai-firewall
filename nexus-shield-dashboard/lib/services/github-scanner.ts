import type { Octokit } from '@octokit/rest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getInstallationOctokit } from '@/lib/github/app-client';
import { startCheckRun, markCheckRunInProgress, completeCheckRun, CheckRunAnnotation } from '@/lib/github/checks';
import { scanContent, ScanIssue } from '@/lib/scanner/patterns';
import { scannableContentFor, ChangedFile } from '@/lib/scanner/diff';
import { scanScaForChangedFiles, ScaFinding, scaFindingType } from '@/lib/scanner/sca';
import { getOrganizationByGithubInstallationId, getOrgUsageSummary, derivePlanId } from '@/lib/org-metrics';
import { getPlanConfig } from '@/config/plans';

const EMPTY_TREE_SHA = '0000000000000000000000000000000000000000';

interface ScanTarget {
  installationId: number;
  owner: string;
  repo: string;
  headSha: string;
  prNumber: number | null;
}

interface UnifiedFinding {
  type: string;
  line: number;
  preview: string;
}

interface FileIssues {
  filename: string;
  issues: UnifiedFinding[];
}

function scanIssueToUnified(issue: ScanIssue): UnifiedFinding {
  return { type: issue.type, line: issue.line, preview: issue.preview };
}

function scaFindingToUnified(finding: ScaFinding): UnifiedFinding {
  return {
    type: scaFindingType(finding.cveId),
    line: finding.line,
    preview: `${finding.packageName}@${finding.version} [${finding.severity}] — ${finding.summary}`,
  };
}

async function getPullRequestChangedFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<ChangedFile[]> {
  const files: ChangedFile[] = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
      page,
    });

    for (const file of data) {
      if (file.status === 'removed') continue;
      files.push({ filename: file.filename, status: file.status, patch: file.patch });
    }

    if (data.length < 100) break;
    page += 1;
  }

  return files;
}

async function getPushChangedFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  before: string,
  after: string,
): Promise<ChangedFile[]> {
  if (before === EMPTY_TREE_SHA) {
    const { data } = await octokit.repos.getCommit({ owner, repo, ref: after });
    return (data.files ?? [])
      .filter((file) => file.status !== 'removed')
      .map((file) => ({ filename: file.filename, status: file.status, patch: file.patch }));
  }

  const { data } = await octokit.repos.compareCommitsWithBasehead({
    owner,
    repo,
    basehead: `${before}...${after}`,
  });

  return (data.files ?? [])
    .filter((file) => file.status !== 'removed')
    .map((file) => ({ filename: file.filename, status: file.status, patch: file.patch }));
}

async function fetchRepositoryFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<string | null> {
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
    if (Array.isArray(data) || data.type !== 'file' || !('content' in data) || !data.content) {
      return null;
    }
    return Buffer.from(data.content, data.encoding as BufferEncoding).toString('utf8');
  } catch {
    return null;
  }
}

function scanSecretsInChangedFiles(files: ChangedFile[]): FileIssues[] {
  return files
    .map((file) => ({
      filename: file.filename,
      issues: scanContent(scannableContentFor(file), file.filename).map(scanIssueToUnified),
    }))
    .filter((result) => result.issues.length > 0);
}

function mergeFileIssues(secretIssues: FileIssues[], scaFindings: ScaFinding[]): FileIssues[] {
  const byFile = new Map<string, UnifiedFinding[]>();

  for (const { filename, issues } of secretIssues) {
    byFile.set(filename, [...(byFile.get(filename) ?? []), ...issues]);
  }

  for (const finding of scaFindings) {
    const unified = scaFindingToUnified(finding);
    byFile.set(finding.filename, [...(byFile.get(finding.filename) ?? []), unified]);
  }

  return Array.from(byFile.entries()).map(([filename, issues]) => ({ filename, issues }));
}

function buildCheckRunAnnotations(fileIssues: FileIssues[]): CheckRunAnnotation[] {
  return fileIssues.flatMap(({ filename, issues }) =>
    issues.map((issue) => ({
      path: filename,
      startLine: issue.line,
      endLine: issue.line,
      annotationLevel: 'failure' as const,
      title: issue.type,
      message: issue.type.startsWith('SCA Vulnerability')
        ? `Bağımlılık zafiyeti: ${issue.preview}`
        : `Potansiyel ${issue.type} sızıntısı tespit edildi: ${issue.preview}`,
      rawDetails: issue.type.startsWith('SCA Vulnerability')
        ? 'Paketi güvenli bir sürüme yükseltin veya alternatif bir bağımlılık kullanın.'
        : 'Bu değeri commit geçmişinden temizleyin ve ilgili kimlik bilgisini derhal döndürün (rotate).',
    })),
  );
}

function buildCheckRunText(fileIssues: FileIssues[]): string {
  const rows = fileIssues
    .flatMap(({ filename, issues }) =>
      issues.map((issue) => `| \`${filename}\` | ${issue.line} | **${issue.type}** | \`${issue.preview}\` |`),
    )
    .join('\n');

  return [
    '| File | Line | Issue Type | Details |',
    '| :--- | ---: | :--- | :--- |',
    rows,
    '',
    '### Recommended actions',
    '- Remove exposed secrets from source control and rotate compromised credentials.',
    '- Upgrade vulnerable dependencies to patched versions.',
    '- Move secrets to environment variables, GitHub Actions secrets, or a vault.',
  ].join('\n');
}

async function persistScanResult(
  orgId: string,
  target: ScanTarget,
  fileIssues: FileIssues[],
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const totalIssues = fileIssues.reduce((sum, f) => sum + f.issues.length, 0);

  const summary = fileIssues.flatMap(({ filename, issues }) =>
    issues.map((issue) => ({ file: filename, line: issue.line, type: issue.type, preview: issue.preview })),
  );

  const { data: scanResult, error: insertError } = await supabase
    .from('scan_results')
    .insert({
      org_id: orgId,
      repo_name: `${target.owner}/${target.repo}`,
      commit_sha: target.headSha,
      pr_number: target.prNumber,
      findings: summary,
      status: totalIssues > 0 ? 'failed' : 'passed',
    })
    .select('id')
    .single<{ id: string }>();

  if (insertError) {
    console.error('[github-scanner] scan_results insert error:', {
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
      orgId,
      repo: `${target.owner}/${target.repo}`,
      commitSha: target.headSha,
    });
    throw new Error(`Failed to insert scan_results row: ${insertError.message}`);
  }

  if (totalIssues === 0) {
    return;
  }

  const findingRows = fileIssues.flatMap(({ filename, issues }) =>
    issues.map((issue) => ({
      scan_result_id: scanResult.id,
      secret_type: issue.type,
      file_path: filename,
      line_number: issue.line,
      masked_preview: issue.preview,
    })),
  );

  const { error: findingsError } = await supabase.from('findings').insert(findingRows);

  if (findingsError) {
    console.error('[github-scanner] findings insert error:', {
      code: findingsError.code,
      message: findingsError.message,
      details: findingsError.details,
      hint: findingsError.hint,
      scanResultId: scanResult.id,
      rowCount: findingRows.length,
      sampleRow: findingRows[0],
    });
    throw new Error(`Failed to insert findings rows: ${findingsError.message}`);
  }
}

async function runScan(octokit: Octokit, target: ScanTarget, changedFiles: ChangedFile[]): Promise<void> {
  const { owner, repo, headSha } = target;

  const checkRunId = await startCheckRun(octokit, { owner, repo, headSha });

  const org = await getOrganizationByGithubInstallationId(target.installationId);

  if (!org) {
    await completeCheckRun(octokit, owner, repo, checkRunId, {
      conclusion: 'neutral',
      title: 'Hesap bağlı değil',
      summary:
        'Bu depo, kurulu GitHub App üzerinden hiçbir Nexus Shield organizasyonuna bağlanmamış. ' +
        'Taramanın çalışması için organizasyon ayarlarınızdan bu kurulumu (installation) bağlayın.',
    });
    return;
  }

  await markCheckRunInProgress(octokit, owner, repo, checkRunId);

  const usage = await getOrgUsageSummary(org.id);
  const plan = getPlanConfig(derivePlanId(org.stripe_subscription_status));

  if (usage.scansThisMonth >= plan.maxScansPerMonth) {
    await completeCheckRun(octokit, owner, repo, checkRunId, {
      conclusion: 'action_required',
      title: 'Kota Aşıldı (Quota Exceeded)',
      summary:
        `Bu ayki tarama kotanız (${usage.scansThisMonth}/${plan.maxScansPerMonth}) doldu. ` +
        'Sınırsız tarama için Pro plana yükseltin: /pricing',
    });
    return;
  }

  const secretIssues = scanSecretsInChangedFiles(changedFiles);
  const scaFindings = await scanScaForChangedFiles(changedFiles, (filename) =>
    fetchRepositoryFile(octokit, owner, repo, filename, headSha),
  );
  const fileIssues = mergeFileIssues(secretIssues, scaFindings);
  const totalIssues = fileIssues.reduce((sum, f) => sum + f.issues.length, 0);

  await persistScanResult(org.id, target, fileIssues);

  if (totalIssues === 0) {
    await completeCheckRun(octokit, owner, repo, checkRunId, {
      conclusion: 'success',
      title: 'Güvenlik sorunu tespit edilmedi',
      summary: 'Nexus Shield, bu değişiklikte secret sızıntısı veya bilinen CVE bulmadı.',
    });
    return;
  }

  const scaCount = scaFindings.length;
  const secretCount = totalIssues - scaCount;

  await completeCheckRun(octokit, owner, repo, checkRunId, {
    conclusion: 'failure',
    title: `${totalIssues} güvenlik bulgusu tespit edildi`,
    summary: [
      secretCount > 0 ? `${secretCount} secret/PII bulgusu` : null,
      scaCount > 0 ? `${scaCount} SCA (CVE) bulgusu` : null,
    ]
      .filter(Boolean)
      .join(', ') + ` — ${fileIssues.length} dosyada.`,
    text: buildCheckRunText(fileIssues),
    annotations: buildCheckRunAnnotations(fileIssues),
  });
}

export interface GithubPushPayload {
  ref: string;
  before: string;
  after: string;
  deleted?: boolean;
  repository: { name: string; owner: { login: string } };
  installation?: { id: number };
}

export async function handleGithubPushEvent(payload: GithubPushPayload): Promise<void> {
  const installationId = payload.installation?.id;

  if (!installationId || payload.deleted) {
    return;
  }

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;

  const octokit = getInstallationOctokit(installationId);
  const changedFiles = await getPushChangedFiles(octokit, owner, repo, payload.before, payload.after);

  await runScan(
    octokit,
    { installationId, owner, repo, headSha: payload.after, prNumber: null },
    changedFiles,
  );
}

export interface GithubPullRequestPayload {
  action: string;
  number: number;
  pull_request: { head: { sha: string } };
  repository: { name: string; owner: { login: string } };
  installation?: { id: number };
}

export async function handleGithubPullRequestEvent(payload: GithubPullRequestPayload): Promise<void> {
  const installationId = payload.installation?.id;

  if (!installationId) {
    return;
  }

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;

  const octokit = getInstallationOctokit(installationId);
  const changedFiles = await getPullRequestChangedFiles(octokit, owner, repo, payload.number);

  await runScan(
    octokit,
    {
      installationId,
      owner,
      repo,
      headSha: payload.pull_request.head.sha,
      prNumber: payload.number,
    },
    changedFiles,
  );
}
