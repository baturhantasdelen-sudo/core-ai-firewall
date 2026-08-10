import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { FindingType, ScanStatus, isPiiFinding } from '@/lib/mock-dashboard-data';

export function StatusBadge({ status }: { status: ScanStatus }) {
  if (status === 'passed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Passed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400">
      <ShieldAlert className="h-3.5 w-3.5" />
      Blocked
    </span>
  );
}

export function FindingBadge({ type }: { type: FindingType }) {
  const pii = isPiiFinding(type);

  return (
    <span
      className={
        pii
          ? 'inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400'
          : 'inline-flex items-center rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-400'
      }
    >
      {type}
    </span>
  );
}
