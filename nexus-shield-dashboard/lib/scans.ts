import { getSupabaseAdmin } from '@/lib/supabase';
import { FindingType, ScanFinding, ScanRecord, isPiiFinding } from '@/lib/mock-dashboard-data';

interface FindingRow {
  secret_type: string;
  file_path: string;
  line_number: number | null;
  masked_preview: string | null;
}

interface ScanResultRow {
  id: string;
  repo_name: string;
  commit_sha: string;
  pr_number: number | null;
  status: 'passed' | 'failed';
  created_at: string;
  findings: FindingRow[] | null;
}

export interface ScanMetrics {
  totalScans: number;
  secretsBlocked: number;
  piiLeaksBlocked: number;
  complianceScore: number;
}

function mapFinding(row: FindingRow): ScanFinding {
  return {
    type: row.secret_type as FindingType,
    filePath: row.file_path,
    line: row.line_number ?? 0,
    preview: row.masked_preview ?? '',
  };
}

function mapScan(row: ScanResultRow): ScanRecord {
  return {
    id: row.id,
    repoName: row.repo_name,
    commitSha: row.commit_sha,
    prNumber: row.pr_number,
    // The DB uses 'passed' | 'failed'; the dashboard UI's badges/copy use
    // 'passed' | 'blocked' (a check run that failed effectively blocked the
    // merge/push from being "clean").
    status: row.status === 'failed' ? 'blocked' : 'passed',
    createdAt: row.created_at,
    findings: (row.findings ?? []).map(mapFinding),
  };
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
