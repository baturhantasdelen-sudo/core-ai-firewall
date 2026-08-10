import Link from 'next/link';
import { Zap } from 'lucide-react';

interface UsageLimitCardProps {
  used: number;
  limit: number;
  plan: 'free' | 'pro';
}

function getBarColor(percentage: number): string {
  if (percentage >= 90) return 'bg-rose-500';
  if (percentage >= 70) return 'bg-amber-400';
  return 'bg-indigo-500';
}

function getTextColor(percentage: number): string {
  if (percentage >= 90) return 'text-rose-400';
  if (percentage >= 70) return 'text-amber-400';
  return 'text-zinc-300';
}

export function UsageLimitCard({ used, limit, plan }: UsageLimitCardProps) {
  const percentage = Math.min(100, Math.round((used / limit) * 100));
  const barColor = getBarColor(percentage);
  const textColor = getTextColor(percentage);

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium text-zinc-300">
              Monthly Usage:{' '}
              <span className={`font-semibold ${textColor}`}>
                {used} / {limit}
              </span>{' '}
              Scans Used
            </p>
            <span className="rounded-full border border-white/10 bg-zinc-800/80 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              {plan} tier
            </span>
          </div>

          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {plan === 'free' ? (
          <Link
            href="/pricing"
            className="group inline-flex shrink-0 items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition-transform hover:scale-[1.02] hover:shadow-fuchsia-500/30 active:scale-[0.98]"
          >
            <Zap className="h-4 w-4 transition-transform group-hover:scale-110" />
            Upgrade to Pro ($79/mo) — Unlimited Scans
          </Link>
        ) : null}
      </div>
    </div>
  );
}
