import type { Octokit } from '@octokit/rest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getInstallationOctokit } from '@/lib/github/app-client';
import { startCheckRun, markCheckRunInProgress, completeCheckRun } from '@/lib/github/checks';
import { scanContent, ScanIssue } from '@/lib/scanner/patterns';
import { scannableContentFor, ChangedFile } from '@/lib/scanner/diff';
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

interface FileIssues {
  filename: string;
  issues: ScanIssue[];
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
  // A brand-new branch push has an all-zero `before` SHA — there is no base
  // to diff against, so just inspect the tip commit instead.
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

function scanChangedFiles(files: ChangedFile[]): FileIssues[] {
  return files
    .map((file) => ({ filename: file.filename, issues: scanContent(scannableContentFor(file), file.filename) }))
    .filter((result) => result.issues.length > 0);
}

function buildCheckRunText(fileIssues: FileIssues[]): string {
  const rows = fileIssues
    .flatMap(({ filename, issues }) =>
      issues.map((issue) => `| \`${filename}\` | ${issue.line} | **${issue.type}** | \`${issue.preview}\` |`),
    )
    .join('\n');

  return [
    '| File | Line | Issue Type | Masked Preview |',
    '| :--- | ---: | :--- | :--- |',
    rows,
    '',
    '### Recommended actions',
    '- Remove the exposed value from source control immediately.',
    '- Rotate any compromised credentials.',
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

  const fileIssues = scanChangedFiles(changedFiles);
  const totalIssues = fileIssues.reduce((sum, f) => sum + f.issues.length, 0);

  await persistScanResult(org.id, target, fileIssues);

  if (totalIssues === 0) {
    await completeCheckRun(octokit, owner, repo, checkRunId, {
      conclusion: 'success',
      title: 'Sızıntı tespit edilmedi',
      summary: 'Nexus Shield, bu değişiklikte PII veya secret sızıntısı bulmadı.',
    });
    return;
  }

  await completeCheckRun(octokit, owner, repo, checkRunId, {
    conclusion: 'failure',
    title: `${totalIssues} potansiyel sızıntı tespit edildi`,
    summary: `${fileIssues.length} dosyada toplam ${totalIssues} potansiyel PII/secret sızıntısı bulundu.`,
    text: buildCheckRunText(fileIssues),
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
