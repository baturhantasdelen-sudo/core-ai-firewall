export const PRO_PLAN_MONTHLY_USD = 89;
export const PRO_PLAN_ANNUAL_MONTHLY_USD = 74;
export const TEAM_PLAN_MONTHLY_USD = 299;
export const TEAM_PLAN_ANNUAL_MONTHLY_USD = 249;
export const FREE_TIER_MONTHLY_SCANS = 50;

export type BillingInterval = 'month' | 'year';

export type PricingTierId = 'developer' | 'pro' | 'team' | 'enterprise';

export interface PricingTier {
  id: PricingTierId;
  name: string;
  target: string;
  description: string;
  monthlyPrice: number | null;
  annualMonthlyPrice: number | null;
  metrics: string;
  features: string[];
  cta: string;
  secondaryCta?: string;
  highlighted?: boolean;
  badge?: string;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'developer',
    name: 'Developer / Sandbox',
    target: 'Individual Engineers & Sandbox Testing',
    description: 'Validate agent runtime security in a free sandbox before production rollout.',
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    metrics: '1 Active Agent | 10k Intercepted Tool Calls',
    features: [
      'Free Scan Module',
      'Basic Action Interception',
      'Sandbox Proof Center',
      'Community Support',
    ],
    cta: 'Start Free',
    secondaryCta: 'Fix with SDK',
  },
  {
    id: 'team',
    name: 'Team / Startup',
    target: 'B2B SaaS & AI Agent Platforms',
    description: 'Production-grade Identity → Intent → Action → Proof for multi-agent fleets.',
    monthlyPrice: TEAM_PLAN_MONTHLY_USD,
    annualMonthlyPrice: TEAM_PLAN_ANNUAL_MONTHLY_USD,
    metrics: 'Up to 25 Protected Agents | 500k Intercepted Tool Calls',
    features: [
      'Full Identity & Intent Engine',
      'Real-time Trajectory Mapping',
      'SHA-256 Evidence Bundles',
      'Dify / CrewAI / LangChain / n8n Native Sidecars',
    ],
    cta: 'Checkout — Team',
    secondaryCta: 'Book Demo',
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    target: 'Enterprise FinTech, Insurance & High-Scale Infra',
    description: 'Dedicated runtime control plane with private edge deployment and SLA guarantees.',
    monthlyPrice: null,
    annualMonthlyPrice: null,
    metrics: 'Unlimited Agents | Custom Edge Sidecar Deployment',
    features: [
      'Custom MCP Boundaries',
      'Sub-10ms On-Prem / Private Cloud Validation',
      'SHA-256 Cryptographic Audit Vault',
      'Dedicated SLA',
    ],
    cta: 'Contact Sales',
    secondaryCta: 'Book Demo',
  },
];

export const ENTERPRISE_DEMO_URL =
  'https://cal.com/baturhantasdelen/nexus-shield-demo';

export const ENTERPRISE_SALES_EMAIL = 'mailto:security@nexusshield.ai?subject=Nexus%20Shield%20Enterprise';

export const SDK_DOCS_URL = '/docs#sdk';

export const BENCHMARK_METHODOLOGY_URL = '/docs/benchmark';

export const BENCHMARK_GITHUB_URL =
  'https://github.com/nexus-shield/agent-security-benchmark';

export function formatPrice(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function displayPrice(tier: PricingTier, interval: BillingInterval): string {
  if (tier.monthlyPrice === null) return 'Custom';
  if (tier.monthlyPrice === 0) return '$0';

  const amount =
    interval === 'year'
      ? (tier.annualMonthlyPrice ?? tier.monthlyPrice)
      : tier.monthlyPrice;

  return formatPrice(amount);
}

export function annualTotal(tier: PricingTier): number | null {
  if (tier.annualMonthlyPrice === null) return null;
  return tier.annualMonthlyPrice * 12;
}
