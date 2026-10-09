/** Public marketing information architecture — single source for nav & footer. */

export type NavLink = { href: string; label: string; description?: string };

export const NEXUS_PRIMARY_CTA = {
  href: '/assessment',
  label: 'Get an Agent Assurance Assessment',
} as const;

export const PLATFORM_LINKS: NavLink[] = [
  { href: '/platform/agent-discovery', label: 'Agent Discovery', description: 'SEE — inventory, MCP, authority' },
  { href: '/platform/action-control', label: 'Action Control', description: 'CONTROL — policy, firewall, trust' },
  { href: '/platform/outcome-verification', label: 'Outcome Verification', description: 'VERIFY — authoritative world state' },
  { href: '/platform/proof-center', label: 'Proof Center', description: 'PROVE — UAR 2.0 & export' },
];

export const SOLUTIONS_LINKS: NavLink[] = [
  { href: '/solutions/finance', label: 'Finance' },
  { href: '/solutions/erp', label: 'ERP' },
  { href: '/solutions/crm', label: 'CRM' },
  { href: '/solutions/iam', label: 'IAM' },
  { href: '/solutions/cloud', label: 'Cloud' },
];

export const DEVELOPERS_LINKS: NavLink[] = [
  { href: '/developers/quickstart', label: 'Quickstart SDK' },
  { href: '/developers/api', label: 'API Reference' },
  { href: '/developers/integrations', label: 'Integrations' },
  { href: '/docs', label: 'Docs' },
];

export const ASSURANCE_LINKS: NavLink[] = [
  { href: '/assurance/benchmark', label: 'Independent Benchmark (A2B)' },
  { href: '/assurance/uar-receipts', label: 'UAR 2.0 Receipts' },
  { href: '/assurance/methodology', label: 'Methodology' },
];

export const RESOURCES_LINKS: NavLink[] = [
  { href: '/resources/security', label: 'Security' },
  { href: '/resources/case-studies', label: 'Case Studies' },
  { href: '/resources/blog', label: 'Blog' },
  { href: '/resources/reports', label: 'Reports' },
];

export const MARKETING_DROPDOWNS = [
  { id: 'platform', label: 'Platform', links: PLATFORM_LINKS },
  { id: 'solutions', label: 'Solutions', links: SOLUTIONS_LINKS },
  { id: 'developers', label: 'Developers', links: DEVELOPERS_LINKS },
  { id: 'assurance', label: 'Assurance', links: ASSURANCE_LINKS },
  { id: 'resources', label: 'Resources', links: RESOURCES_LINKS },
] as const;

/** Legacy routes preserved for funnels — secondary nav. */
export const SECONDARY_LINKS: NavLink[] = [
  { href: '/scan', label: 'Free Scan' },
  { href: '/proof-center', label: 'Live Proof Center' },
  { href: '/demo', label: 'Demo' },
];
