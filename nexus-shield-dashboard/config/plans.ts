export type PlanId = 'free' | 'pro' | 'enterprise';

export const PLAN_SCAN_LIMITS = {
  free: 1_000,
  pro: 500_000,
  enterprise: 999_999_999,
} as const;

export interface PlanConfig {
  id: PlanId;
  name: string;
  maxRepositories: number;
  maxScansPerMonth: number;
  features: {
    customRegexRules: boolean;
    aiFalsePositiveFilter: boolean;
    slackTelegramAlerts: boolean;
    autoSecretRevocation: boolean; // Otomatik API anahtarı pasife alma
  };
}

export const PLAN_LIMITS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    maxRepositories: 3,
    maxScansPerMonth: PLAN_SCAN_LIMITS.free,
    features: {
      customRegexRules: false,
      aiFalsePositiveFilter: false,
      slackTelegramAlerts: false,
      autoSecretRevocation: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    maxRepositories: 25,
    maxScansPerMonth: PLAN_SCAN_LIMITS.pro,
    features: {
      customRegexRules: true,
      aiFalsePositiveFilter: true,
      slackTelegramAlerts: true,
      autoSecretRevocation: false,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    maxRepositories: 9999,
    maxScansPerMonth: PLAN_SCAN_LIMITS.enterprise,
    features: {
      customRegexRules: true,
      aiFalsePositiveFilter: true,
      slackTelegramAlerts: true,
      autoSecretRevocation: true,
    },
  },
};

export function getPlanConfig(planId: PlanId): PlanConfig {
  return PLAN_LIMITS[planId] ?? PLAN_LIMITS.free;
}
