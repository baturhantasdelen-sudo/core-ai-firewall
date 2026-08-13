import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { PII_FINDING_TYPES, ScanStatus } from '@/lib/mock-dashboard-data';
import type { SecretValidationResult } from '@/lib/engine/validation/types';

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

export function FindingBadge({ type }: { type: string }) {
  const pii = (PII_FINDING_TYPES as readonly string[]).includes(type);
  const isSca = type.startsWith('SCA Vulnerability');

  return (
    <span
      className={
        isSca
          ? 'inline-flex items-center rounded-md border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[11px] font-medium text-orange-400'
          : pii
            ? 'inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400'
            : 'inline-flex items-center rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-400'
      }
    >
      {type}
    </span>
  );
}

export function SecretValidationBadge({
  validation,
}: {
  validation?: SecretValidationResult | null;
}) {
  if (!validation) return null;

  if (validation.status === 'ACTIVE') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold text-rose-300 animate-pulse">
        🔴 ACTIVE SECRET (CRITICAL)
      </span>
    );
  }

  if (validation.status === 'INACTIVE') {
    return (
      <span className="inline-flex items-center rounded-md border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
        ⚪ INACTIVE
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
      ⚪ UNVERIFIED
    </span>
  );
}

export function SuppressedFindingBadge({
  suppressionReason,
}: {
  suppressionReason?: string | null;
}) {
  return (
    <span
      className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300"
      title={suppressionReason ?? undefined}
    >
      🟢 LOW RISK / TEST MOCK (SUPPRESSED)
    </span>
  );
}
