export const PRO_PLAN_MONTHLY_USD = 89;
export const PRO_PLAN_ANNUAL_MONTHLY_USD = 74;
export const TEAM_PLAN_MONTHLY_USD = 399;
export const TEAM_PLAN_ANNUAL_MONTHLY_USD = 329;
export const FREE_TIER_MONTHLY_SCANS = 50;

export type BillingInterval = 'month' | 'year';

export type PricingTierId = 'developer' | 'pro' | 'team' | 'enterprise';

export interface PricingTier {
  id: PricingTierId;
  name: string;
  description: string;
  monthlyPrice: number | null;
  annualMonthlyPrice: number | null;
  features: string[];
  cta: string;
  secondaryCta?: string;
  highlighted?: boolean;
  badge?: string;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'developer',
    name: 'Developer',
    description: 'Start securing a single agent with community support.',
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    features: [
      '1 Agent',
      '5,000 Tool Calls / mo',
      'Basic Intent Detection',
      'Community Support',
    ],
    cta: 'Start Free',
    secondaryCta: 'Fix with SDK',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Production intercepts with verifiable SHA-256 evidence chains.',
    monthlyPrice: 89,
    annualMonthlyPrice: 74,
    features: [
      '5 Agents',
      '100,000 Tool Calls / mo',
      'Sub-10ms Intercept',
      'SHA-256 Evidence Chain',
      'Public Proof Badge',
    ],
    cta: 'Checkout — Pro',
    secondaryCta: 'Fix with SDK',
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    id: 'team',
    name: 'Team',
    description: 'Human-in-the-loop governance for multi-agent fleets.',
    monthlyPrice: 399,
    annualMonthlyPrice: 329,
    features: [
      '25 Agents',
      '1,000,000 Tool Calls / mo',
      'Human-in-the-Loop (HITL) approval',
      'Custom MCP Proxy',
      'Slack / Teams alerts',
    ],
    cta: 'Checkout — Team',
    secondaryCta: 'Book Demo',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Dedicated SOC deployment with private cloud and SLA guarantees.',
    monthlyPrice: null,
    annualMonthlyPrice: null,
    features: [
      'Unlimited Agents',
      'On-Prem / Private Cloud Deployment',
      'Dedicated SOC Dashboard',
      '99.99% SLA',
    ],
    cta: 'Contact Sales',
    secondaryCta: 'Book Demo',
  },
];

export const ENTERPRISE_DEMO_URL =
  'https://cal.com/baturhantasdelen/nexus-shield-demo';

export const ENTERPRISE_SALES_EMAIL = 'mailto:security@nexusshield.ai?subject=Nexus%20Shield%20Enterprise';

export const SDK_DOCS_URL = '/docs#sdk';

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
