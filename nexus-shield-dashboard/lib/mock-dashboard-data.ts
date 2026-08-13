export type FindingType =
  | 'OpenAI API Key'
  | 'Anthropic API Key'
  | 'Vercel Token'
  | 'AWS Access Key'
  | 'Private Key'
  | 'JWT'
  | 'TCKN'
  | 'Credit Card'
  | 'Email'
  | 'Generic Secret'
  | 'High-Entropy Secret';

export interface ScanFindingValidation {
  status: 'ACTIVE' | 'INACTIVE' | 'UNVERIFIED';
  risk_score: number;
  risk_level: 'CRITICAL' | 'LOW' | 'MEDIUM';
  message: string;
}

export interface ScanFinding {
  type: FindingType;
  filePath: string;
  line: number;
  preview: string;
  validation?: ScanFindingValidation | null;
  ruleId?: string;
  category?: 'secret' | 'pii';
  column?: number;
  matched?: string;
}

export type ScanStatus = 'passed' | 'blocked';

export interface ScanRecord {
  id: string;
  repoName: string;
  commitSha: string;
  prNumber: number | null;
  findings: ScanFinding[];
  status: ScanStatus;
  createdAt: string;
}

export const PII_FINDING_TYPES: readonly FindingType[] = ['TCKN', 'Credit Card', 'Email'];

export function isPiiFinding(type: FindingType): boolean {
  return (PII_FINDING_TYPES as readonly string[]).includes(type);
}

export const mockApiKey = 'nex_live_51PXk29fjaKzT4qC9mR7wA3f9a';

export const mockUsage = {
  used: 34,
  limit: 50,
  plan: 'free' as const,
};

export const mockMetrics = {
  totalScans: 142,
  secretsBlocked: 3,
  piiLeaksBlocked: 12,
  complianceScore: 98,
};

export const mockScans: ScanRecord[] = [
  {
    id: 'scan_1',
    repoName: 'nexus-shield-action',
    commitSha: '78cb976dc3608d4539ad58270361b04e2328f450',
    prNumber: 1,
    status: 'blocked',
    createdAt: '2026-08-08T07:12:00.000Z',
    findings: [
      {
        type: 'OpenAI API Key',
        filePath: 'test-leak.txt',
        line: 2,
        preview: 'sk-proj-*****************cdef',
      },
      {
        type: 'TCKN',
        filePath: 'test-leak.txt',
        line: 3,
        preview: '1000000****0146',
      },
    ],
  },
  {
    id: 'scan_2',
    repoName: 'core-ai-firewall',
    commitSha: 'b91fd4c0e9a5d3f8213c4e7a90b6f1d2c8a4e5f0',
    prNumber: 42,
    status: 'passed',
    createdAt: '2026-08-07T21:45:00.000Z',
    findings: [],
  },
  {
    id: 'scan_3',
    repoName: 'nextjs-vercel-ai-nexus-shield',
    commitSha: '2ae0d90b2545cf222f89c1fb11bc05f3d748393c',
    prNumber: null,
    status: 'blocked',
    createdAt: '2026-08-06T14:03:00.000Z',
    findings: [
      {
        type: 'AWS Access Key',
        filePath: 'infra/deploy.tf',
        line: 18,
        preview: 'AKIA****************WXYZ',
      },
    ],
  },
  {
    id: 'scan_4',
    repoName: 'ollama-nexus-shield',
    commitSha: 'f6f0b3298e1c4a7d0b3e5f9a2c1d4e6f7a8b9c0d',
    prNumber: 7,
    status: 'passed',
    createdAt: '2026-08-05T09:27:00.000Z',
    findings: [],
  },
  {
    id: 'scan_5',
    repoName: 'vercel-integration',
    commitSha: '5db7b43a1f2c8e9d0b4a6c7e8f9a0b1c2d3e4f5a',
    prNumber: 15,
    status: 'blocked',
    createdAt: '2026-08-04T18:52:00.000Z',
    findings: [
      {
        type: 'Credit Card',
        filePath: 'fixtures/checkout-sample.json',
        line: 41,
        preview: '4242 42** **** 4242',
      },
      {
        type: 'Email',
        filePath: 'fixtures/checkout-sample.json',
        line: 44,
        preview: 'j***@example.com',
      },
      {
        type: 'Generic Secret',
        filePath: '.env',
        line: 6,
        preview: 'api_key****91a2',
      },
    ],
  },
];
