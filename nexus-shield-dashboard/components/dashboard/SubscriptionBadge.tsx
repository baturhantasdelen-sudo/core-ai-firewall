import { PlanId } from '@/config/plans';

const PLAN_BADGE_STYLES: Record<PlanId, string> = {
  free: 'border-zinc-700 bg-zinc-800/80 text-zinc-300',
  pro: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-400',
  enterprise: 'border-purple-500/20 bg-purple-500/10 text-purple-400',
};

interface SubscriptionBadgeProps {
  plan: PlanId;
  status: 'free' | 'active' | 'canceled' | 'past_due' | string;
}

export function SubscriptionBadge({ plan, status }: SubscriptionBadgeProps) {
  const isPastDue = status === 'past_due';
  const isCanceled = status === 'canceled';

  return (
    <div className="flex items-center gap-2">
      <span
        className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${PLAN_BADGE_STYLES[plan]}`}
      >
        {plan} Plan
      </span>
      {isPastDue ? (
        <span className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-400">
          Ödeme Bekleniyor
        </span>
      ) : null}
      {isCanceled ? (
        <span className="rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-xs font-medium text-zinc-400">
          İptal Edildi
        </span>
      ) : null}
    </div>
  );
}
