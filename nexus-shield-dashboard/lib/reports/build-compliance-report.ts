import { isPiiFinding, type FindingType, type ScanRecord } from '@/lib/mock-dashboard-data';
import type {
  ComplianceFindingRow,
  CompliancePiiStats,
  ComplianceReportData,
  ComplianceRiskRow,
} from '@/lib/reports/types';
import type { ScanMetrics as Metrics } from '@/lib/scans';

const EXECUTIVE_SUMMARY =
  'Bu rapor KVKK Madde 12 ve BDDK Veri Güvenliği Rehberi standartlarında otomatik oluşturulmuştur.';

export function scoreToGrade(score: number): string {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 67) return 'D+';
  if (score >= 63) return 'D';
  if (score >= 60) return 'D-';
  return 'F';
}

function isReportPiiType(type: string): boolean {
  if (isPiiFinding(type as FindingType)) return true;
  const normalized = type.toLowerCase();
  return /tckn|iban|vkn|credit|email|phone|ssn|pii/.test(normalized);
}

function normalizePiiType(type: string): keyof Omit<CompliancePiiStats, 'totalMasked' | 'other'> | 'other' {
  const normalized = type.toLowerCase();
  if (normalized.includes('tckn')) return 'tckn';
  if (normalized.includes('iban')) return 'iban';
  if (normalized.includes('vkn')) return 'vkn';
  if (normalized.includes('credit')) return 'creditCard';
  if (normalized.includes('email')) return 'email';
  if (normalized.includes('phone')) return 'phone';
  return 'other';
}

export function aggregatePiiStats(scans: ScanRecord[]): CompliancePiiStats {
  const stats: CompliancePiiStats = {
    tckn: 0,
    iban: 0,
    vkn: 0,
    creditCard: 0,
    email: 0,
    phone: 0,
    other: 0,
    totalMasked: 0,
  };

  for (const scan of scans) {
    for (const finding of scan.findings) {
      if (!isReportPiiType(finding.type)) continue;
      stats.totalMasked += 1;
      const bucket = normalizePiiType(finding.type);
      if (bucket === 'other') {
        stats.other += 1;
      } else {
        stats[bucket] += 1;
      }
    }
  }

  return stats;
}

function buildRiskRows(
  piiStats: CompliancePiiStats,
  metrics: Metrics,
): ComplianceRiskRow[] {
  const rows: ComplianceRiskRow[] = [];

  if (piiStats.tckn > 0) {
    rows.push({
      category: 'TCKN (Turkish National ID)',
      count: piiStats.tckn,
      severity: 'HIGH',
      status: 'Masked & logged',
    });
  }
  if (piiStats.iban > 0) {
    rows.push({
      category: 'IBAN',
      count: piiStats.iban,
      severity: 'HIGH',
      status: 'Masked & logged',
    });
  }
  if (piiStats.vkn > 0) {
    rows.push({
      category: 'VKN (Tax ID)',
      count: piiStats.vkn,
      severity: 'MEDIUM',
      status: 'Masked & logged',
    });
  }
  if (piiStats.creditCard > 0) {
    rows.push({
      category: 'Credit Card',
      count: piiStats.creditCard,
      severity: 'CRITICAL',
      status: 'Masked & blocked',
    });
  }
  if (metrics.secretsBlocked > 0) {
    rows.push({
      category: 'Secrets & API Keys',
      count: metrics.secretsBlocked,
      severity: 'CRITICAL',
      status: 'Blocked before egress',
    });
  }
  if (rows.length === 0) {
    rows.push({
      category: 'No material violations detected',
      count: 0,
      severity: 'LOW',
      status: 'Compliant',
    });
  }

  return rows;
}

function collectFindings(scans: ScanRecord[]): {
  piiFindings: ComplianceFindingRow[];
  secretFindings: ComplianceFindingRow[];
} {
  const piiFindings: ComplianceFindingRow[] = [];
  const secretFindings: ComplianceFindingRow[] = [];

  for (const scan of scans) {
    for (const finding of scan.findings) {
      const row: ComplianceFindingRow = {
        type: finding.type,
        category: isReportPiiType(finding.type) ? 'pii' : 'secret',
        filePath: finding.filePath,
        line: finding.line,
        preview: finding.preview,
        validationStatus: finding.validation?.status ?? null,
      };

      if (row.category === 'pii') {
        piiFindings.push(row);
      } else {
        secretFindings.push(row);
      }
    }
  }

  return {
    piiFindings: piiFindings.slice(0, 50),
    secretFindings: secretFindings.slice(0, 50),
  };
}

export function buildComplianceReportData(params: {
  organizationName: string;
  scans: ScanRecord[];
  metrics: Metrics;
}): ComplianceReportData {
  const { organizationName, scans, metrics } = params;
  const piiStats = aggregatePiiStats(scans);
  const { piiFindings, secretFindings } = collectFindings(scans);
  const primaryRepo = scans[0]?.repoName ?? '—';

  return {
    organizationName,
    primaryRepo,
    generatedAt: new Date().toISOString(),
    securityScore: metrics.complianceScore,
    securityGrade: scoreToGrade(metrics.complianceScore),
    executiveSummary: EXECUTIVE_SUMMARY,
    piiStats,
    riskRows: buildRiskRows(piiStats, metrics),
    piiFindings,
    secretFindings,
    totalScans: metrics.totalScans,
    secretsBlocked: metrics.secretsBlocked,
    piiLeaksBlocked: metrics.piiLeaksBlocked,
  };
}
