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

export interface CheckRunAnnotation {
  path: string;
  startLine: number;
  endLine: number;
  annotationLevel: 'notice' | 'warning' | 'failure';
  message: string;
  title?: string;
  rawDetails?: string;
}

interface CompleteCheckRunOptions {
  conclusion: CheckRunConclusion;
  title: string;
  summary: string;
  text?: string;
  annotations?: CheckRunAnnotation[];
}

// The Checks API rejects requests with more than 50 annotations in a single
// call. Callers with more findings than that should batch additional
// `octokit.checks.update` calls themselves — we just cap defensively here so
// a large scan never fails the whole check run update outright.
const MAX_ANNOTATIONS_PER_REQUEST = 50;

export async function completeCheckRun(
  octokit: Octokit,
  owner: string,
  repo: string,
  checkRunId: number,
  options: CompleteCheckRunOptions,
): Promise<void> {
  const annotations = options.annotations?.slice(0, MAX_ANNOTATIONS_PER_REQUEST).map((annotation) => ({
    path: annotation.path,
    start_line: annotation.startLine,
    end_line: annotation.endLine,
    annotation_level: annotation.annotationLevel,
    message: annotation.message,
    title: annotation.title,
    raw_details: annotation.rawDetails,
  }));

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
      annotations,
    },
  });
}
