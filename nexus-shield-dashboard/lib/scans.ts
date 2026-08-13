import { getSupabaseAdmin } from '@/lib/supabase';
import { FindingType, ScanFinding, ScanRecord, isPiiFinding } from '@/lib/mock-dashboard-data';

interface FindingRow {
  secret_type: string;
  file_path: string;
  line_number: number | null;
  masked_preview: string | null;
}

interface JsonbFindingSummary {
  type: string;
  file?: string;
  line?: number;
  preview?: string;
}

interface ScanResultRow {
  id: string;
  repo_name: string;
  commit_sha: string;
  pr_number: number | null;
  status: 'passed' | 'failed';
  created_at: string;
  findings: FindingRow[] | JsonbFindingSummary[] | null;
}

export interface ScanIngestFinding {
  type: string;
  file?: string;
  line?: number;
  preview?: string;
}

export interface ScanIngestPayload {
  repo_name: string;
  commit_sha: string;
  pr_number?: number | null;
  findings: ScanIngestFinding[];
  status: 'passed' | 'failed';
}

export interface ScanMetrics {
  totalScans: number;
  secretsBlocked: number;
  piiLeaksBlocked: number;
  complianceScore: number;
}

function mapJsonbFinding(finding: JsonbFindingSummary): ScanFinding {
  return {
    type: finding.type as FindingType,
    filePath: finding.file ?? 'unknown',
    line: finding.line ?? 0,
    preview: finding.preview ?? '',
  };
}

function mapFinding(row: FindingRow): ScanFinding {
  return {
    type: row.secret_type as FindingType,
    filePath: row.file_path,
    line: row.line_number ?? 0,
    preview: row.masked_preview ?? '',
  };
}

function normalizeFindings(
  findings: FindingRow[] | JsonbFindingSummary[] | null | undefined,
): ScanFinding[] {
  if (!findings?.length) return [];

  const first = findings[0];
  if ('secret_type' in first) {
    return (findings as FindingRow[]).map(mapFinding);
  }

  return (findings as JsonbFindingSummary[]).map(mapJsonbFinding);
}

function mapScan(row: ScanResultRow): ScanRecord {
  return {
    id: row.id,
    repoName: row.repo_name,
    commitSha: row.commit_sha,
    prNumber: row.pr_number,
    status: row.status === 'failed' ? 'blocked' : 'passed',
    createdAt: row.created_at,
    findings: normalizeFindings(row.findings),
  };
}

export function mapScanFromRealtime(row: Record<string, unknown>): ScanRecord {
  return mapScan({
    id: String(row.id),
    repo_name: String(row.repo_name),
    commit_sha: String(row.commit_sha),
    pr_number: (row.pr_number as number | null) ?? null,
    status: row.status as 'passed' | 'failed',
    created_at: String(row.created_at),
    findings: (row.findings as JsonbFindingSummary[] | null) ?? [],
  });
}

export function applyScanToMetrics(metrics: ScanMetrics, scan: ScanRecord): ScanMetrics {
  let secretsBlocked = metrics.secretsBlocked;
  let piiLeaksBlocked = metrics.piiLeaksBlocked;

  for (const finding of scan.findings) {
    if (isPiiFinding(finding.type)) {
      piiLeaksBlocked += 1;
    } else {
      secretsBlocked += 1;
    }
  }

  const totalScans = metrics.totalScans + 1;
  const previousPassed =
    metrics.totalScans === 0
      ? 0
      : Math.round((metrics.complianceScore / 100) * metrics.totalScans);
  const passedScans = previousPassed + (scan.status === 'passed' ? 1 : 0);

  return {
    totalScans,
    secretsBlocked,
    piiLeaksBlocked,
    complianceScore: totalScans === 0 ? 100 : Math.round((passedScans / totalScans) * 100),
  };
}

export async function recordScanResult(
  orgId: string,
  payload: ScanIngestPayload,
): Promise<{ scanId: string; createdAt: string }> {
  const supabase = getSupabaseAdmin();
  const { repo_name, commit_sha, pr_number, findings, status } = payload;

  const { data: inserted, error: insertError } = await supabase
    .from('scan_results')
    .insert({
      org_id: orgId,
      repo_name,
      commit_sha,
      pr_number: pr_number ?? null,
      findings,
      status,
    })
    .select('id, created_at')
    .single<{ id: string; created_at: string }>();

  if (insertError) {
    throw new Error(`Failed to record scan result: ${insertError.message}`);
  }

  if (findings.length > 0) {
    const findingRows = findings.map((finding) => ({
      scan_result_id: inserted.id,
      secret_type: finding.type,
      file_path: finding.file ?? 'unknown',
      line_number: finding.line ?? null,
      masked_preview: finding.preview ?? null,
    }));

    const { error: findingsError } = await supabase.from('findings').insert(findingRows);

    if (findingsError) {
      console.error('[scans] findings insert error:', findingsError.message);
    }
  }

  return { scanId: inserted.id, createdAt: inserted.created_at };
}

/**
 * Fetches the most recent scans for an organization, with their findings
 * embedded via the `findings.scan_result_id` foreign key (single round trip).
 */
export async function getRecentScans(orgId: string, limit = 20): Promise<ScanRecord[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('scan_results')
    .select(
      'id, repo_name, commit_sha, pr_number, status, created_at, findings(secret_type, file_path, line_number, masked_preview)',
    )
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load scan history: ${error.message}`);
  }

  return ((data ?? []) as unknown as ScanResultRow[]).map(mapScan);
}

/**
 * Aggregate stats for the metric cards at the top of the dashboard.
 */
export async function getScanMetrics(orgId: string): Promise<ScanMetrics> {
  const supabase = getSupabaseAdmin();

  const [totalResult, passedResult, findingsResult] = await Promise.all([
    supabase.from('scan_results').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    supabase
      .from('scan_results')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'passed'),
    // `!inner` turns the embed into a join so we can filter findings by their
    // parent scan's org_id directly in one query.
    supabase
      .from('findings')
      .select('secret_type, scan_results!inner(org_id)')
      .eq('scan_results.org_id', orgId),
  ]);

  if (totalResult.error) {
    throw new Error(`Failed to count scans: ${totalResult.error.message}`);
  }

  if (passedResult.error) {
    throw new Error(`Failed to count passed scans: ${passedResult.error.message}`);
  }

  if (findingsResult.error) {
    throw new Error(`Failed to count findings: ${findingsResult.error.message}`);
  }

  const totalScans = totalResult.count ?? 0;
  const passedScans = passedResult.count ?? 0;
  const findingRows = (findingsResult.data ?? []) as unknown as { secret_type: string }[];

  let secretsBlocked = 0;
  let piiLeaksBlocked = 0;

  for (const row of findingRows) {
    if (isPiiFinding(row.secret_type as FindingType)) {
      piiLeaksBlocked += 1;
    } else {
      secretsBlocked += 1;
    }
  }

  const complianceScore = totalScans === 0 ? 100 : Math.round((passedScans / totalScans) * 100);

  return {
    totalScans,
    secretsBlocked,
    piiLeaksBlocked,
    complianceScore,
  };
}
