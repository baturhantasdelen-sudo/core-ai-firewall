import { APP_DOC_ROUTES, BENCHMARK_GITHUB_URL } from '@/lib/site';

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
    name: 'Agent Runtime',
    target: 'Individual Engineers & Sandbox',
    description: 'Discover agents, run hijack simulations, and inspect evidence bundles — no credit card.',
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    metrics: '1 Protected Agent | 10k Intercepted Actions',
    features: [
      'Agent & MCP Discovery',
      'Action Firewall (basic)',
      'Sandbox Proof Center',
      'Community Support',
    ],
    cta: 'Start Free',
    secondaryCta: 'Simulate Hijack',
  },
  {
    id: 'team',
    name: 'Action Governance',
    target: 'B2B SaaS & AI Agent Platforms',
    description: 'Production intent/action divergence checks, capability revocation, and SHA-256 evidence chains.',
    monthlyPrice: TEAM_PLAN_MONTHLY_USD,
    annualMonthlyPrice: TEAM_PLAN_ANNUAL_MONTHLY_USD,
    metrics: 'Up to 25 Protected Agents | 500k Intercepted Actions',
    features: [
      'Intent / Action Divergence Engine',
      'Kill Switch & READ_ONLY Fallback',
      'Cryptographic Evidence Bundles',
      'LangChain / CrewAI / MCP Sidecars',
    ],
    cta: 'Checkout — Team',
    secondaryCta: 'Book Demo',
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    id: 'enterprise',
    name: 'Enterprise Control Plane',
    target: 'FinTech, Insurance & Regulated Infra',
    description: 'Inter-agent delegation governance, private edge deployment, and audit-grade evidence verification.',
    monthlyPrice: null,
    annualMonthlyPrice: null,
    metrics: 'Unlimited Agents | Custom Edge Sidecar',
    features: [
      'Inter-Agent Delegation Controls',
      'Evidence Verification Vault',
      'Sub-10ms On-Prem Validation',
      'Dedicated SLA & MCP Boundaries',
    ],
    cta: 'Contact Sales',
    secondaryCta: 'Book Demo',
  },
];

export const ENTERPRISE_DEMO_URL =
  'https://cal.com/baturhantasdelen/nexus-shield-demo';

export const ENTERPRISE_SALES_EMAIL = 'mailto:security@nexusshield.ai?subject=Nexus%20Shield%20Enterprise';

/** @deprecated Prefer APP_DOC_ROUTES.sdk from lib/site */
export const SDK_DOCS_URL = APP_DOC_ROUTES.sdk;

/** @deprecated Prefer APP_DOC_ROUTES.benchmark from lib/site */
export const BENCHMARK_METHODOLOGY_URL = APP_DOC_ROUTES.benchmark;

export { BENCHMARK_GITHUB_URL };

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
