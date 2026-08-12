import { getSupabaseAdmin } from '@/lib/supabase';
import { startOfCurrentMonthIso } from '@/lib/date';
import { PlanId } from '@/config/plans';

export type SubscriptionStatus = 'free' | 'active' | 'canceled';

export interface OrgRecord {
  id: string;
  name: string;
  stripe_customer_id: string | null;
  stripe_subscription_status: SubscriptionStatus;
  monthly_scan_limit: number;
  github_installation_id?: number | null;
  api_key?: string | null;
}

export interface OrgUsageSummary {
  scansThisMonth: number;
  connectedRepoCount: number;
}

/**
 * The `organizations` table only tracks Stripe subscription status
 * ('free' | 'active' | 'canceled'), not a dedicated plan tier. Until there's
 * a distinct Enterprise sales/checkout flow (or a `plan` column), an active
 * subscription is treated as Pro. Enterprise stays available in
 * `config/plans.ts` for manual/future assignment.
 */
export function derivePlanId(status: SubscriptionStatus): PlanId {
  return status === 'active' ? 'pro' : 'free';
}

export async function getOrganizationById(orgId: string): Promise<OrgRecord | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('organizations')
    .select(
      'id, name, stripe_customer_id, stripe_subscription_status, monthly_scan_limit, github_installation_id, api_key',
    )
    .eq('id', orgId)
    .maybeSingle<OrgRecord>();

  if (error) {
    throw new Error(`Failed to load organization ${orgId}: ${error.message}`);
  }

  return data;
}

/**
 * Resolves the Nexus organization linked to an installed GitHub App
 * instance, so incoming webhook deliveries (push / pull_request) can be
 * attributed to the right customer for quota enforcement.
 */
export async function getOrganizationByGithubInstallationId(
  installationId: number,
): Promise<OrgRecord | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, stripe_customer_id, stripe_subscription_status, monthly_scan_limit, github_installation_id')
    .eq('github_installation_id', installationId)
    .maybeSingle<OrgRecord>();

  if (error) {
    throw new Error(`Failed to load organization for installation ${installationId}: ${error.message}`);
  }

  return data;
}

export async function getOrgUsageSummary(orgId: string): Promise<OrgUsageSummary> {
  const supabase = getSupabaseAdmin();

  const [scanCountResult, repoRowsResult] = await Promise.all([
    supabase
      .from('scan_results')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', startOfCurrentMonthIso()),
    supabase.from('scan_results').select('repo_name').eq('org_id', orgId),
  ]);

  if (scanCountResult.error) {
    throw new Error(`Failed to count scans: ${scanCountResult.error.message}`);
  }

  if (repoRowsResult.error) {
    throw new Error(`Failed to list repos: ${repoRowsResult.error.message}`);
  }

  const connectedRepoCount = new Set(
    (repoRowsResult.data ?? []).map((row: { repo_name: string }) => row.repo_name),
  ).size;

  return {
    scansThisMonth: scanCountResult.count ?? 0,
    connectedRepoCount,
  };
}
