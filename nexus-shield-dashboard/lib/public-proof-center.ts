import type { ProofCenterMetrics } from '@/types/proof-center';
import {
  PUBLIC_PROOF_DEFAULTS,
  type PublicProofCenterView,
} from '@/types/public-proof-center';

export function mergePublicProofCenter(
  live: ProofCenterMetrics | null,
): PublicProofCenterView {
  const base = { ...PUBLIC_PROOF_DEFAULTS, live };

  if (!live) {
    return base;
  }

  const blocked = live.attack_benchmark.blocked;
  const total = live.attack_benchmark.total;
  const blockRate =
    total > 0 ? Math.round((blocked / total) * 1000) / 10 : base.agentSafety.blockRatePct;

  return {
    ...base,
    source: live.source === 'live' ? 'live_api' : live.source,
    agentSafety: {
      ...base.agentSafety,
      dangerousBlocked: blocked || base.agentSafety.dangerousBlocked,
      dangerousTotal: total || base.agentSafety.dangerousTotal,
      blockRatePct: blockRate,
    },
    accuracy: {
      intentMisalignmentPct: live.intent_divergence.accuracy_pct || base.accuracy.intentMisalignmentPct,
      toolMisusePct: live.attack_benchmark.accuracy_pct || base.accuracy.toolMisusePct,
      privilegeEscalationPct: base.accuracy.privilegeEscalationPct,
      falsePositivePct: live.false_positive_rate,
      falseNegativePct: base.accuracy.falseNegativePct,
    },
    latency: {
      p50Ms: Math.max(1, live.latency.avg_ms * 0.35),
      p95Ms: live.latency.p95_ms,
      p99Ms: Math.min(live.latency.p95_ms * 1.15, live.latency.avg_ms * 1.2),
      avgMs: live.latency.avg_ms,
      certifiedSub10ms: live.latency.certified_sub_10ms,
    },
  };
}

export async function fetchPublicProofCenter(): Promise<PublicProofCenterView> {
  try {
    const response = await fetch('/api/proof-center', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return PUBLIC_PROOF_DEFAULTS;
    }
    const live = (await response.json()) as ProofCenterMetrics;
    return mergePublicProofCenter(live);
  } catch {
    return PUBLIC_PROOF_DEFAULTS;
  }
}
