import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { AgentSecurityReport, FindingCategory, FindingSeverity } from '@/lib/scanner';
import {
  CATEGORY_LABELS,
  inputTypeLabel,
  overallSeverityLabel,
} from '@/lib/reports/agent-security-audit-shared';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#18181b',
    backgroundColor: '#ffffff',
  },
  header: {
    backgroundColor: '#064e3b',
    color: '#ffffff',
    padding: 20,
    borderRadius: 8,
    marginBottom: 20,
  },
  brand: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 11, color: '#a7f3d0', marginBottom: 8 },
  headerMeta: { fontSize: 9, color: '#d1fae5', marginBottom: 2 },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
  },
  scoreCircle: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  scoreValue: { fontSize: 22, fontWeight: 'bold', color: '#ffffff' },
  scoreMeta: { fontSize: 10, color: '#ecfdf5' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  badge: {
    fontSize: 8,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#fef2f2',
    color: '#991b1b',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#065f46',
    marginBottom: 8,
    marginTop: 16,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.5,
    color: '#3f3f46',
    marginBottom: 6,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  metaCard: {
    width: '48%',
    backgroundColor: '#f4f4f5',
    padding: 10,
    borderRadius: 6,
  },
  metaLabel: { fontSize: 8, color: '#71717a', marginBottom: 3 },
  metaValue: { fontSize: 9, color: '#18181b' },
  categoryBlock: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 6,
    padding: 10,
  },
  categoryTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#065f46',
    marginBottom: 6,
  },
  findingRow: {
    borderTopWidth: 1,
    borderTopColor: '#f4f4f5',
    paddingTop: 6,
    marginTop: 6,
  },
  findingTitle: { fontSize: 9, fontWeight: 'bold', color: '#18181b' },
  findingMeta: { fontSize: 8, color: '#71717a', marginTop: 2 },
  findingBody: { fontSize: 9, color: '#52525b', marginTop: 4, lineHeight: 1.4 },
  codeBlock: {
    fontFamily: 'Courier',
    fontSize: 8,
    backgroundColor: '#ecfdf5',
    color: '#047857',
    padding: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  remediationStep: { fontSize: 9, color: '#3f3f46', marginBottom: 4, paddingLeft: 8 },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#a1a1aa',
    borderTopWidth: 1,
    borderTopColor: '#e4e4e7',
    paddingTop: 8,
  },
});

const SEVERITY_ORDER: FindingSeverity[] = ['critical', 'high', 'medium', 'low'];

function groupFindingsByCategory(report: AgentSecurityReport): Map<FindingCategory, typeof report.findings> {
  const map = new Map<FindingCategory, typeof report.findings>();
  for (const finding of report.findings) {
    const list = map.get(finding.category) ?? [];
    list.push(finding);
    map.set(finding.category, list);
  }
  return map;
}

export function AgentSecurityAuditDocument({
  report,
  auditHash,
}: {
  report: AgentSecurityReport;
  auditHash: string;
}) {
  const grouped = groupFindingsByCategory(report);
  const categories = Array.from(grouped.keys());

  return (
    <Document title="Nexus Shield AI Agent & MCP Security Audit Report">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Nexus Shield</Text>
          <Text style={styles.subtitle}>AI Agent & MCP Security Audit Report</Text>
          <Text style={styles.headerMeta}>Attack → Prove → Install → Protect</Text>

          <View style={styles.scoreRow}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreValue}>{report.score}/100</Text>
            </View>
            <View>
              <Text style={styles.scoreMeta}>Overall Risk Score</Text>
              <Text style={styles.scoreMeta}>Grade {report.grade}</Text>
              <Text style={styles.scoreMeta}>Severity: {overallSeverityLabel(report)}</Text>
            </View>
          </View>

          <View style={styles.badgeRow}>
            {SEVERITY_ORDER.map((sev) =>
              report.summary[sev] > 0 ? (
                <Text key={sev} style={styles.badge}>
                  {sev.toUpperCase()}: {report.summary[sev]}
                </Text>
              ) : null,
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Executive Summary</Text>
        <Text style={styles.paragraph}>
          Static and heuristic analysis identified {report.findings.length} finding(s) across the
          scanned agent surface. Risk score {report.score}/100 (Grade {report.grade}) indicates{' '}
          {report.score >= 75
            ? 'moderate hardening opportunities before production deployment.'
            : report.score >= 50
              ? 'material governance gaps requiring runtime interception.'
              : 'critical exposure requiring immediate Nexus Shield SDK mitigation.'}
        </Text>

        <Text style={styles.sectionTitle}>Target Metadata</Text>
        <View style={styles.metaGrid}>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Scan Type</Text>
            <Text style={styles.metaValue}>{inputTypeLabel(report.inputType)}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Target</Text>
            <Text style={styles.metaValue}>{report.target}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Timestamp (ISO 8601)</Text>
            <Text style={styles.metaValue}>{report.scannedAt}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Analysis Latency</Text>
            <Text style={styles.metaValue}>{report.latencyMs} ms</Text>
          </View>
          <View style={[styles.metaCard, { width: '100%' }]}>
            <Text style={styles.metaLabel}>SHA-256 Audit Verification Hash</Text>
            <Text style={styles.metaValue}>sha256:{auditHash}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Attack Surface</Text>
        <View style={styles.metaGrid}>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Tools Detected</Text>
            <Text style={styles.metaValue}>{String(report.attackSurface.toolsDetected)}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Unsigned Actions</Text>
            <Text style={styles.metaValue}>{String(report.attackSurface.unsignedActions)}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Intent Verification</Text>
            <Text style={styles.metaValue}>
              {report.attackSurface.intentVerificationPresent ? 'Present' : 'Missing'}
            </Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Evidence Chain</Text>
            <Text style={styles.metaValue}>
              {report.attackSurface.evidenceChainPresent ? 'Present' : 'Missing'}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Categorized Findings</Text>
        {categories.length === 0 ? (
          <Text style={styles.paragraph}>No findings recorded.</Text>
        ) : (
          categories.map((category) => (
            <View key={category} style={styles.categoryBlock}>
              <Text style={styles.categoryTitle}>{CATEGORY_LABELS[category]}</Text>
              {(grouped.get(category) ?? []).map((finding) => (
                <View key={finding.id} style={styles.findingRow}>
                  <Text style={styles.findingTitle}>
                    {finding.id} — {finding.title}
                  </Text>
                  <Text style={styles.findingMeta}>Severity: {finding.severity.toUpperCase()}</Text>
                  <Text style={styles.findingBody}>{finding.description}</Text>
                  <Text style={styles.findingBody}>Recommendation: {finding.recommendation}</Text>
                  {finding.sdkFix ? <Text style={styles.codeBlock}>{finding.sdkFix}</Text> : null}
                </View>
              ))}
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Remediation Plan — Fix with Nexus Shield SDK</Text>
        <Text style={styles.codeBlock}>
          {`import { NexusShield } from '@nexus-shield/sdk';

const shield = new NexusShield({ apiKey: process.env.NEXUS_API_KEY });
const verdict = await shield.evaluateAction({
  userIntent,
  toolCall,
  agentCapabilities,
});
// Blocked actions attach SHA-256 evidence automatically.`}
        </Text>
        <Text style={styles.remediationStep}>1. Install SDK: npm install @nexus-shield/sdk</Text>
        <Text style={styles.remediationStep}>
          2. Wrap every tool invocation with evaluateAction() before execution.
        </Text>
        <Text style={styles.remediationStep}>
          3. Enable intent verification and cryptographic evidence chains in production.
        </Text>
        <Text style={styles.remediationStep}>
          4. Re-scan at /scan after deployment to validate score improvement.
        </Text>

        <Text style={styles.footer}>
          Nexus Shield · nexusshield.ai · Confidential Security Audit · Generated{' '}
          {new Date().toISOString()}
        </Text>
      </Page>
    </Document>
  );
}
