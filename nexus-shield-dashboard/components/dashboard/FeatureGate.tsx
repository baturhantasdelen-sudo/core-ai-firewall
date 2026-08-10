import Link from 'next/link';
import { Lock } from 'lucide-react';

interface FeatureGateProps {
  isAllowed: boolean;
  featureName: string;
  requiredPlan?: string;
  upgradeHref?: string;
  children: React.ReactNode;
}

export function FeatureGate({
  isAllowed,
  featureName,
  requiredPlan = 'Pro',
  upgradeHref = '/pricing',
  children,
}: FeatureGateProps) {
  if (isAllowed) {
    return <>{children}</>;
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-zinc-700 p-6">
      <div className="pointer-events-none select-none opacity-40 blur-sm">{children}</div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/80 p-4 text-center backdrop-blur-[2px]">
        <div className="rounded-full bg-amber-500/10 p-3 text-amber-500">
          <Lock className="h-6 w-6" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-zinc-100">{featureName} Kilitli</h4>
          <p className="mx-auto mt-1 max-w-xs text-xs text-zinc-500">
            Bu özellikten faydalanmak için <strong className="text-zinc-300">{requiredPlan}</strong> planına geçiş
            yapın.
          </p>
        </div>
        <Link
          href={upgradeHref}
          className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition-transform hover:scale-[1.02]"
        >
          Planı Yükselt
        </Link>
      </div>
    </div>
  );
}
