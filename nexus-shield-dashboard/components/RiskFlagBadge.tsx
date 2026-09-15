interface RiskFlagBadgeProps {
  flag: string;
}

function badgeStyle(flagName: string): string {
  const normalized = flagName.toUpperCase();

  if (normalized.includes('EXFILTRATION') || normalized.includes('POTENTIAL_DATA')) {
    return 'bg-red-500/10 text-red-400 border-red-500/20';
  }
  if (normalized.includes('PROMPT_INJECTION')) {
    return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
  }
  if (normalized.includes('UNAUTHORIZED_TOOL')) {
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  }
  if (normalized.includes('INTENT_MISMATCH')) {
    return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
  }
  return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
}

export function RiskFlagBadge({ flag }: RiskFlagBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeStyle(flag)}`}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      {flag.replace(/_/g, ' ')}
    </span>
  );
}
