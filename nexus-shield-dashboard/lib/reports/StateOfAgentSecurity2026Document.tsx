import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ResearchScanResultsFile, ResearchSummaryMetrics } from '@/lib/research/types';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: 'Helvetica', color: '#18181b' },
  cover: {
    backgroundColor: '#09090b',
    color: '#fafafa',
    padding: 40,
    borderRadius: 8,
    marginBottom: 24,
  },
  coverTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  coverSub: { fontSize: 11, color: '#a1a1aa', lineHeight: 1.5 },
  section: { fontSize: 13, fontWeight: 'bold', color: '#065f46', marginTop: 16, marginBottom: 8 },
  paragraph: { fontSize: 9, lineHeight: 1.45, color: '#3f3f46', marginBottom: 6 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  metricCard: {
    width: '31%',
    backgroundColor: '#f4f4f5',
    padding: 10,
    borderRadius: 6,
  },
  metricValue: { fontSize: 16, fontWeight: 'bold', color: '#18181b' },
  metricLabel: { fontSize: 8, color: '#71717a', marginTop: 4 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#064e3b',
    color: '#ecfdf5',
    padding: 6,
    fontSize: 7,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e4e7',
    padding: 5,
    fontSize: 7,
  },
  colName: { width: '28%' },
  colCat: { width: '10%' },
  colScore: { width: '8%' },
  colParam: { width: '14%' },
  colIntent: { width: '12%' },
  colAudit: { width: '10%' },
  colHash: { width: '18%' },
  seal: {
    marginTop: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 6,
    backgroundColor: '#ecfdf5',
  },
  sealTitle: { fontSize: 10, fontWeight: 'bold', color: '#065f46', marginBottom: 4 },
  sealHash: { fontSize: 8, fontFamily: 'Courier', color: '#047857' },
});

interface Props {
  scan: ResearchScanResultsFile;
  summary: ResearchSummaryMetrics;
}

export function StateOfAgentSecurity2026Document({ scan, summary }: Props) {
  return (
    <Document title="State of AI Agent Security 2026">
      <Page size="A4" style={styles.page}>
        <View style={styles.cover}>
          <Text style={styles.coverTitle}>State of AI Agent Security 2026</Text>
          <Text style={styles.coverSub}>
            Empirical Security Analysis of {summary.targetCount} Leading Open-Source AI Agent
            Frameworks &amp; Model Context Protocol (MCP) Servers — Nexus Shield Research Report
          </Text>
          <Text style={{ ...styles.coverSub, marginTop: 12 }}>
            Generated: {new Date(summary.generatedAt).toUTCString()}
          </Text>
        </View>

        <Text style={styles.section}>Executive Summary</Text>
        <Text style={styles.paragraph}>
          Nexus Shield conducted static and heuristic runtime-security analysis across{' '}
          {summary.frameworksScanned} agent frameworks and {summary.mcpServersScanned} MCP server
          implementations. The study evaluates parameter validation, privilege boundaries, intent
          divergence risk, and cryptographic audit trail readiness using the same sub-10ms Action
          Firewall inspection model deployed in production.
        </Text>
        <Text style={styles.paragraph}>
          Key findings: {summary.lackingParameterValidationPct}% lack robust function-call parameter
          validation; {summary.excessiveMcpPermissionsPct}% of MCP servers expose unconstrained
          write/delete or shell execution paths; {summary.intentDivergenceVulnerablePct}% remain
          vulnerable to intent divergence attacks; average security score is{' '}
          {summary.avgSecurityScoreOverall}/100 overall (
          {summary.avgSecurityScoreFrameworks} frameworks vs {summary.avgSecurityScoreMcp} MCP).
        </Text>

        <Text style={styles.section}>Statistical Infographics</Text>
        <View style={styles.metricGrid}>
          {summary.keyMetricCards.map((card) => (
            <View key={card.label} style={styles.metricCard}>
              <Text style={styles.metricValue}>{card.value}</Text>
              <Text style={styles.metricLabel}>{card.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.section}>Full 50-Target Audit Matrix</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.colName}>Repository</Text>
          <Text style={styles.colCat}>Category</Text>
          <Text style={styles.colScore}>Score</Text>
          <Text style={styles.colParam}>Parameters</Text>
          <Text style={styles.colIntent}>Intent Risk</Text>
          <Text style={styles.colAudit}>Audit</Text>
          <Text style={styles.colHash}>SHA-256</Text>
        </View>
        {scan.results.map((row) => (
          <View key={row.id} style={styles.tableRow} wrap={false}>
            <Text style={styles.colName}>{row.name}</Text>
            <Text style={styles.colCat}>{row.category === 'framework' ? 'FW' : 'MCP'}</Text>
            <Text style={styles.colScore}>{row.securityScore}</Text>
            <Text style={styles.colParam}>{row.parameterValidationStatus}</Text>
            <Text style={styles.colIntent}>{row.intentDivergenceRisk}</Text>
            <Text style={styles.colAudit}>{row.auditTrailCapability}</Text>
            <Text style={styles.colHash}>{row.auditHash.slice(0, 16)}…</Text>
          </View>
        ))}

        <View style={styles.seal}>
          <Text style={styles.sealTitle}>SHA-256 Audit Seal — Nexus Shield Verified</Text>
          <Text style={styles.sealHash}>report_hash={summary.verificationHash}</Text>
          <Text style={{ ...styles.sealHash, marginTop: 4 }}>
            methodology=NexusShield-Edge-Inspection-v2026 · targets={summary.targetCount}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
