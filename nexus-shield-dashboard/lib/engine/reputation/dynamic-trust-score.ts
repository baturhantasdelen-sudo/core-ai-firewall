export type TrustTier = 'NORMAL' | 'ELEVATED' | 'RESTRICTED' | 'CRITICAL';

export type TrustRestriction =
  | 'BLOCK_PAYMENT'
  | 'BLOCK_EXPORT'
  | 'REQUIRE_APPROVAL_WRITE'
  | 'AGENT_FROZEN';

export interface RecentViolation {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: string;
}

export interface DynamicTrustScoreResult {
  agentId: string;
  score: number;
  tier: TrustTier;
  previousScore?: number;
  restrictions: TrustRestriction[];
  rationale: string[];
  updatedAt: string;
}

export interface TrustScoreHistoryEntry {
  agentId: string;
  score: number;
  tier: TrustTier;
  timestamp: string;
}

const trustScoreStore = new Map<string, DynamicTrustScoreResult>();
const trustHistoryStore = new Map<string, TrustScoreHistoryEntry[]>();

const BASE_TRUST_SCORE = 95;

function resolveTier(score: number): TrustTier {
  if (score >= 90) return 'NORMAL';
  if (score >= 70) return 'ELEVATED';
  if (score >= 40) return 'RESTRICTED';
  return 'CRITICAL';
}

function resolveRestrictions(tier: TrustTier): TrustRestriction[] {
  switch (tier) {
    case 'NORMAL':
      return [];
    case 'ELEVATED':
      return [];
    case 'RESTRICTED':
      return ['BLOCK_PAYMENT', 'BLOCK_EXPORT', 'REQUIRE_APPROVAL_WRITE'];
    case 'CRITICAL':
      return ['BLOCK_PAYMENT', 'BLOCK_EXPORT', 'REQUIRE_APPROVAL_WRITE', 'AGENT_FROZEN'];
  }
}

function violationPenalty(violation: RecentViolation): number {
  const severityWeight =
    violation.severity === 'CRITICAL'
      ? 25
      : violation.severity === 'HIGH'
        ? 15
        : violation.severity === 'MEDIUM'
          ? 8
          : 3;

  const typeBoost =
    /trajectory|exfil|export|payment|unverified/i.test(violation.type) ? 5 : 0;

  return severityWeight + typeBoost;
}

export function recalculateDynamicTrustScore(
  agentId: string,
  recentViolations: RecentViolation[] = [],
  evidenceRatio = 100,
): DynamicTrustScoreResult {
  const previous = trustScoreStore.get(agentId);
  let score = previous?.score ?? BASE_TRUST_SCORE;
  const rationale: string[] = [];

  for (const violation of recentViolations) {
    const penalty = violationPenalty(violation);
    score -= penalty;
    rationale.push(
      `-${penalty} pts: ${violation.type} (${violation.severity})`,
    );
  }

  if (evidenceRatio < 50) {
    score -= 20;
    rationale.push('-20 pts: evidence verification ratio below 50%');
  } else if (evidenceRatio < 75) {
    score -= 10;
    rationale.push('-10 pts: evidence verification ratio below 75%');
  }

  if (recentViolations.some((v) => v.severity === 'CRITICAL')) {
    score -= 15;
    rationale.push('-15 pts: CRITICAL violation detected in recent window');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const tier = resolveTier(score);
  const restrictions = resolveRestrictions(tier);

  if (tier === 'CRITICAL') {
    rationale.push('Agent immediately frozen — trust score below 40');
  } else if (tier === 'RESTRICTED') {
    rationale.push('PAYMENT/EXPORT blocked, WRITE requires human approval');
  } else if (tier === 'ELEVATED') {
    rationale.push('Sensitive operations under enhanced monitoring');
  }

  const result: DynamicTrustScoreResult = {
    agentId,
    score,
    tier,
    previousScore: previous?.score,
    restrictions,
    rationale,
    updatedAt: new Date().toISOString(),
  };

  trustScoreStore.set(agentId, result);

  const history = trustHistoryStore.get(agentId) ?? [];
  history.push({
    agentId,
    score,
    tier,
    timestamp: result.updatedAt,
  });
  trustHistoryStore.set(agentId, history.slice(-20));

  return result;
}

export function getDynamicTrustScore(agentId: string): DynamicTrustScoreResult | undefined {
  return trustScoreStore.get(agentId);
}

export function getTrustScoreHistory(agentId: string): TrustScoreHistoryEntry[] {
  return [...(trustHistoryStore.get(agentId) ?? [])];
}

export function isActionRestricted(
  agentId: string,
  actionType: 'PAYMENT' | 'EXPORT' | 'WRITE',
): { restricted: boolean; reason?: string; requiresApproval?: boolean } {
  const trust = trustScoreStore.get(agentId);
  if (!trust) return { restricted: false };

  if (trust.restrictions.includes('AGENT_FROZEN')) {
    return { restricted: true, reason: 'Agent frozen — trust score CRITICAL (<40)' };
  }
  if (actionType === 'PAYMENT' && trust.restrictions.includes('BLOCK_PAYMENT')) {
    return { restricted: true, reason: 'PAYMENT blocked — trust tier RESTRICTED' };
  }
  if (actionType === 'EXPORT' && trust.restrictions.includes('BLOCK_EXPORT')) {
    return { restricted: true, reason: 'EXPORT blocked — trust tier RESTRICTED' };
  }
  if (actionType === 'WRITE' && trust.restrictions.includes('REQUIRE_APPROVAL_WRITE')) {
    return {
      restricted: false,
      requiresApproval: true,
      reason: 'WRITE requires human approval — trust tier RESTRICTED',
    };
  }
  return { restricted: false };
}

export function resetDynamicTrustScoreStore(): void {
  trustScoreStore.clear();
  trustHistoryStore.clear();
}
