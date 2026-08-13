import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { ComplianceReportData } from '@/lib/reports/types';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#18181b',
    backgroundColor: '#ffffff',
  },
  header: {
    backgroundColor: '#312e81',
    color: '#ffffff',
    padding: 20,
    borderRadius: 8,
    marginBottom: 20,
  },
  brand: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerMeta: {
    fontSize: 9,
    color: '#c7d2fe',
    marginBottom: 2,
  },
  gradeBox: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  gradeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#312e81',
    marginBottom: 8,
    marginTop: 16,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.5,
    color: '#3f3f46',
    marginBottom: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  statCard: {
    width: '30%',
    backgroundColor: '#f4f4f5',
    padding: 10,
    borderRadius: 6,
  },
  statLabel: {
    fontSize: 8,
    color: '#71717a',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#18181b',
  },
  table: {
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e4e7',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeader: {
    backgroundColor: '#eef2ff',
    fontWeight: 'bold',
  },
  colCategory: { width: '40%' },
  colCount: { width: '15%' },
  colSeverity: { width: '20%' },
  colStatus: { width: '25%' },
  findingRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#f4f4f5',
    paddingVertical: 6,
  },
  findingTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#18181b',
  },
  findingMeta: {
    fontSize: 8,
    color: '#71717a',
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#a1a1aa',
    textAlign: 'center',
  },
});

interface ComplianceReportDocumentProps {
  data: ComplianceReportData;
}

export function ComplianceReportDocument({ data }: ComplianceReportDocumentProps) {
  const generatedDate = new Date(data.generatedAt).toLocaleString('tr-TR');

  return (
    <Document title={`Nexus Shield KVKK Compliance — ${data.organizationName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Nexus Shield</Text>
          <Text style={styles.headerMeta}>KVKK / GDPR Compliance Audit Report</Text>
          <Text style={styles.headerMeta}>Organization: {data.organizationName}</Text>
          <Text style={styles.headerMeta}>Primary Repository: {data.primaryRepo}</Text>
          <Text style={styles.headerMeta}>Generated: {generatedDate}</Text>
          <View style={styles.gradeBox}>
            <Text style={styles.gradeText}>
              Security Grade: {data.securityGrade} ({data.securityScore}%)
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Executive Summary</Text>
        <Text style={styles.paragraph}>{data.executiveSummary}</Text>
        <Text style={styles.paragraph}>
          Total scans: {data.totalScans} · PII events masked: {data.piiLeaksBlocked} · Secrets
          blocked: {data.secretsBlocked}
        </Text>

        <Text style={styles.sectionTitle}>KVKK &amp; GDPR Compliance Summary</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TCKN Detected</Text>
            <Text style={styles.statValue}>{data.piiStats.tckn}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>IBAN Detected</Text>
            <Text style={styles.statValue}>{data.piiStats.iban}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>VKN Detected</Text>
            <Text style={styles.statValue}>{data.piiStats.vkn}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Credit Cards</Text>
            <Text style={styles.statValue}>{data.piiStats.creditCard}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Email / Phone</Text>
            <Text style={styles.statValue}>{data.piiStats.email + data.piiStats.phone}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total PII Masked</Text>
            <Text style={styles.statValue}>{data.piiStats.totalMasked}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Violation Risk Table</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.colCategory}>Category</Text>
            <Text style={styles.colCount}>Count</Text>
            <Text style={styles.colSeverity}>Severity</Text>
            <Text style={styles.colStatus}>Status</Text>
          </View>
          {data.riskRows.map((row) => (
            <View key={`${row.category}-${row.count}`} style={styles.tableRow}>
              <Text style={styles.colCategory}>{row.category}</Text>
              <Text style={styles.colCount}>{row.count}</Text>
              <Text style={styles.colSeverity}>{row.severity}</Text>
              <Text style={styles.colStatus}>{row.status}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>PII Findings (Masked)</Text>
        {data.piiFindings.length === 0 ? (
          <Text style={styles.paragraph}>No PII findings in the selected audit window.</Text>
        ) : (
          data.piiFindings.map((finding, index) => (
            <View key={`pii-${index}`} style={styles.findingRow}>
              <Text style={styles.findingTitle}>
                {finding.type} — {finding.filePath}:{finding.line}
              </Text>
              <Text style={styles.findingMeta}>{finding.preview}</Text>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Secret Findings (Masked)</Text>
        {data.secretFindings.length === 0 ? (
          <Text style={styles.paragraph}>No secret findings in the selected audit window.</Text>
        ) : (
          data.secretFindings.map((finding, index) => (
            <View key={`secret-${index}`} style={styles.findingRow}>
              <Text style={styles.findingTitle}>
                {finding.type} — {finding.filePath}:{finding.line}
                {finding.validationStatus ? ` [${finding.validationStatus}]` : ''}
              </Text>
              <Text style={styles.findingMeta}>{finding.preview}</Text>
            </View>
          ))
        )}

        <Text style={styles.footer} fixed>
          Nexus Shield · Confidential Compliance Report · nexusshield.ai
        </Text>
      </Page>
    </Document>
  );
}
