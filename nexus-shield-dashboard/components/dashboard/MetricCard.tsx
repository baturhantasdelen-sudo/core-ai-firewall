import { LucideIcon } from 'lucide-react';

type Accent = 'default' | 'red' | 'yellow' | 'green';

const ACCENT_STYLES: Record<Accent, { icon: string; value: string }> = {
  default: {
    icon: 'bg-indigo-500/10 text-indigo-400',
    value: 'text-zinc-100',
  },
  red: {
    icon: 'bg-rose-500/10 text-rose-400',
    value: 'text-rose-400',
  },
  yellow: {
    icon: 'bg-amber-500/10 text-amber-400',
    value: 'text-amber-400',
  },
  green: {
    icon: 'bg-emerald-500/10 text-emerald-400',
    value: 'text-emerald-400',
  },
};

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  accent?: Accent;
  sublabel?: string;
}

export function MetricCard({ icon: Icon, label, value, accent = 'default', sublabel }: MetricCardProps) {
  const styles = ACCENT_STYLES[accent];

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-sm transition-colors hover:border-white/20">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${styles.icon}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <p className={`mt-4 text-2xl font-semibold tracking-tight ${styles.value}`}>{value}</p>
      <p className="mt-1 text-sm text-zinc-500">{label}</p>
      {sublabel ? <p className="mt-0.5 text-xs text-zinc-600">{sublabel}</p> : null}
    </div>
  );
}
