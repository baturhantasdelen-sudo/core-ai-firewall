import type { Octokit } from '@octokit/rest';

export const CHECK_RUN_NAME = 'Nexus Shield Security Gatekeeper';

interface CheckRunTarget {
  owner: string;
  repo: string;
  headSha: string;
}

export async function startCheckRun(octokit: Octokit, target: CheckRunTarget): Promise<number> {
  const { data } = await octokit.checks.create({
    owner: target.owner,
    repo: target.repo,
    name: CHECK_RUN_NAME,
    head_sha: target.headSha,
    status: 'queued',
    started_at: new Date().toISOString(),
  });

  return data.id;
}

export async function markCheckRunInProgress(
  octokit: Octokit,
  owner: string,
  repo: string,
  checkRunId: number,
): Promise<void> {
  await octokit.checks.update({
    owner,
    repo,
    check_run_id: checkRunId,
    status: 'in_progress',
  });
}

type CheckRunConclusion = 'success' | 'failure' | 'action_required' | 'neutral';

interface CompleteCheckRunOptions {
  conclusion: CheckRunConclusion;
  title: string;
  summary: string;
  text?: string;
}

export async function completeCheckRun(
  octokit: Octokit,
  owner: string,
  repo: string,
  checkRunId: number,
  options: CompleteCheckRunOptions,
): Promise<void> {
  await octokit.checks.update({
    owner,
    repo,
    check_run_id: checkRunId,
    status: 'completed',
    conclusion: options.conclusion,
    completed_at: new Date().toISOString(),
    output: {
      title: options.title,
      summary: options.summary,
      text: options.text,
    },
  });
}
