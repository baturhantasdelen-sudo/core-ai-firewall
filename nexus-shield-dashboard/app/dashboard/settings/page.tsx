import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, FolderGit2, ScanSearch } from 'lucide-react';
import { SubscriptionBadge } from '@/components/dashboard/SubscriptionBadge';
import { FeatureGate } from '@/components/dashboard/FeatureGate';
import { ManageSubscriptionButton } from '@/components/dashboard/ManageSubscriptionButton';
import { GithubIntegrationCard, GithubIntegrationNotice } from '@/components/dashboard/GithubIntegrationCard';
import { getOrgUsageSummary, derivePlanId, type OrgRecord } from '@/lib/org-metrics';
import { getPlanConfig } from '@/config/plans';
import { getAuthContext } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

interface DashboardSettingsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function resolveGithubNotice(params: Record<string, string | string[] | undefined>): GithubIntegrationNotice {
  if (params.github === 'connected') {
    return { type: 'success', message: 'GitHub App başarıyla bağlandı.' };
  }

  if (params.error === 'github_callback_failed') {
    return { type: 'error', message: 'GitHub App bağlantısı başarısız oldu. Lütfen tekrar deneyin.' };
  }

  return null;
}

export default async function DashboardSettingsPage({ searchParams }: DashboardSettingsPageProps) {
  const auth = await getAuthContext();
  if (!auth) redirect('/login?next=/dashboard/settings');

  const org = auth.org;
  const resolvedSearchParams = await searchParams;
  const githubNotice = resolveGithubNotice(resolvedSearchParams);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl space-y-8 px-6 py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard&apos;a dön
        </Link>

        <SettingsContent org={org} githubNotice={githubNotice} />
      </div>
    </div>
  );
}

async function SettingsContent({
  org,
  githubNotice,
}: {
  org: OrgRecord;
  githubNotice: GithubIntegrationNotice;
}) {
  const usage = await getOrgUsageSummary(org.id);
  const planId = derivePlanId(org.stripe_subscription_status);
  const plan = getPlanConfig(planId);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100 sm:text-2xl">
            Abonelik & Plan Durumu
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Mevcut plan limitlerinizi görüntüleyin ve ödemelerinizi yönetin.
          </p>
        </div>
        <SubscriptionBadge plan={planId} status={org.stripe_subscription_status} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-zinc-900/60 p-4">
          <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400">
            <FolderGit2 className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs text-zinc-500">Bağlı Depo (Repo)</span>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">
              {usage.connectedRepoCount}
              <span className="text-sm font-normal text-zinc-500"> / {plan.maxRepositories}</span>
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-zinc-900/60 p-4">
          <div className="rounded-lg bg-fuchsia-500/10 p-2 text-fuchsia-400">
            <ScanSearch className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs text-zinc-500">Bu Ayki Taramalar</span>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">
              {usage.scansThisMonth}
              <span className="text-sm font-normal text-zinc-500"> / {plan.maxScansPerMonth}</span>
            </p>
          </div>
        </div>
      </div>

      <GithubIntegrationCard
        orgId={org.id}
        installationId={org.github_installation_id ?? null}
        initialNotice={githubNotice}
      />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-zinc-300">Özel Regex Kuralları</h3>
        <FeatureGate
          isAllowed={plan.features.customRegexRules}
          featureName="Özel Regex Kuralları"
          requiredPlan="Pro"
        >
          <div className="space-y-2">
            <p className="text-sm text-zinc-400">
              Nexus Shield&apos;in kendi kural setinize göre PII/secret taraması yapmasını sağlayan özel regex
              desenleri tanımlayın.
            </p>
            <div className="rounded-lg border border-white/10 bg-zinc-950/60 p-3 font-mono text-xs text-zinc-500">
              INTERNAL_TOKEN_[A-Z0-9]{'{'}32{'}'}
            </div>
          </div>
        </FeatureGate>
      </div>

      <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-white/10 bg-zinc-900/60 p-5 sm:flex-row sm:items-center">
        <div>
          <h4 className="text-sm font-medium text-zinc-200">Fatura ve Abonelik Yönetimi</h4>
          <p className="mt-1 max-w-sm text-xs text-zinc-500">
            Kredi kartınızı güncelleyin, faturaları indirin veya planınızı değiştirin.
          </p>
        </div>
        <ManageSubscriptionButton orgId={org.id} />
      </div>
    </div>
  );
}
