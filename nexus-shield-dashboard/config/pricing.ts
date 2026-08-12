export type BillingInterval = 'month' | 'year';

export interface PricingTier {
  id: 'developer' | 'pro' | 'enterprise';
  name: string;
  description: string;
  monthlyPrice: number | null;
  annualMonthlyPrice: number | null;
  features: string[];
  cta: string;
  highlighted?: boolean;
  badge?: string;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'developer',
    name: 'Developer',
    description: 'Free trial & test limit for indie devs and side projects.',
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    features: [
      '1,000 API requests / month',
      'Basic PII redaction & masking',
      'GitHub App & repo integration',
      'Community support',
    ],
    cta: 'Get Started Free',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Production-grade guardrails and DevSecOps for growing teams.',
    monthlyPrice: 59,
    annualMonthlyPrice: 49,
    features: [
      '500,000 API requests / month',
      'Advanced prompt injection & jailbreak firewall',
      'SCA & secret scanning on every PR',
      'Real-time GitHub Checks & webhooks',
      'Standard SLA & email support',
    ],
    cta: 'Upgrade to Pro',
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom deployment, compliance, and white-glove support.',
    monthlyPrice: null,
    annualMonthlyPrice: null,
    features: [
      'Unlimited API requests & priority rate limits',
      'On-premise / private cloud deployment',
      'Custom agent identity & behavior rules',
      'SOC 2 / ISO 27001 alignment (ZDR — zero data retention)',
      'Dedicated account manager & 24/7 SLA',
    ],
    cta: 'Contact Sales',
  },
];

export const ENTERPRISE_DEMO_URL =
  'https://cal.com/baturhantasdelen/nexus-shield-demo';

export const ENTERPRISE_SALES_EMAIL = 'mailto:security@nexusshield.ai?subject=Nexus%20Shield%20Enterprise';

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
