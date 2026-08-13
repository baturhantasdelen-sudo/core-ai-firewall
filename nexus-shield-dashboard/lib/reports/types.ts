export interface CompliancePiiStats {
  tckn: number;
  iban: number;
  vkn: number;
  creditCard: number;
  email: number;
  phone: number;
  other: number;
  totalMasked: number;
}

export interface ComplianceRiskRow {
  category: string;
  count: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: string;
}

export interface ComplianceFindingRow {
  type: string;
  category: 'pii' | 'secret';
  filePath: string;
  line: number;
  preview: string;
  validationStatus?: string | null;
}

export interface ComplianceReportData {
  organizationName: string;
  primaryRepo: string;
  generatedAt: string;
  securityScore: number;
  securityGrade: string;
  executiveSummary: string;
  piiStats: CompliancePiiStats;
  riskRows: ComplianceRiskRow[];
  piiFindings: ComplianceFindingRow[];
  secretFindings: ComplianceFindingRow[];
  totalScans: number;
  secretsBlocked: number;
  piiLeaksBlocked: number;
}
