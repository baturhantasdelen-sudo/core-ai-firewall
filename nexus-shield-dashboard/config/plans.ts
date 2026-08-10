export type PlanId = 'free' | 'pro' | 'enterprise';

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
    maxScansPerMonth: 50,
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
    maxScansPerMonth: 1000,
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
    maxScansPerMonth: 999999,
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
