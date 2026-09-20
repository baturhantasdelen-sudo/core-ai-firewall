import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { DisclosureScanResult } from '@/lib/disclosure/types';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#18181b' },
  confidential: {
    backgroundColor: '#450a0a',
    color: '#fecaca',
    padding: 8,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 16,
  },
  header: {
    backgroundColor: '#09090b',
    color: '#fafafa',
    padding: 24,
    borderRadius: 6,
    marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  subtitle: { fontSize: 10, color: '#a1a1aa', lineHeight: 1.4 },
  section: { fontSize: 12, fontWeight: 'bold', color: '#065f46', marginTop: 14, marginBottom: 6 },
  paragraph: { fontSize: 9, lineHeight: 1.5, color: '#3f3f46', marginBottom: 5 },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  metric: {
    width: '47%',
    backgroundColor: '#f4f4f5',
    padding: 8,
    borderRadius: 4,
  },
  metricLabel: { fontSize: 7, color: '#71717a' },
  metricValue: { fontSize: 11, fontWeight: 'bold', marginTop: 2 },
  bullet: { fontSize: 9, marginBottom: 4, paddingLeft: 8, color: '#3f3f46' },
  seal: {
    marginTop: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#10b981',
    backgroundColor: '#ecfdf5',
    borderRadius: 4,
  },
  sealHash: { fontSize: 8, fontFamily: 'Courier', color: '#047857', marginTop: 4 },
});

const VERTICAL_LABELS: Record<string, string> = {
  'yc-ai-saas': 'YC AI SaaS',
  'fintech-mcp': 'FinTech & Open Banking MCP',
  'enterprise-tr': 'Enterprise TR Technology',
};

interface Props {
  result: DisclosureScanResult;
}

export function SecurityAdvisoryDocument({ result }: Props) {
  const { target, metrics, vulnerabilities, mitigationSteps } = result;

  return (
    <Document title={`${target.organizationName} — Confidential Security Advisory 2026`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.confidential}>CONFIDENTIAL — RESPONSIBLE DISCLOSURE ADVISORY</Text>

        <View style={styles.header}>
          <Text style={styles.title}>{target.organizationName}</Text>
          <Text style={styles.subtitle}>
            Nexus Shield Passive Agent Security Advisory · {VERTICAL_LABELS[target.vertical]} ·{' '}
            {new Date(result.scannedAt).toUTCString()}
          </Text>
        </View>

        <Text style={styles.section}>Executive Summary</Text>
        <Text style={styles.paragraph}>
          Passive schema and boundary analysis identified agent/MCP security gaps in{' '}
          {target.organizationName}&apos;s exposed surface ({target.referenceUrl}). Overall security
          score: {result.securityScore}/100 (Grade {result.grade}).
        </Text>

        <Text style={styles.section}>Vulnerability Metrics</Text>
        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Parameter Hijacking Risk</Text>
            <Text style={styles.metricValue}>{metrics.parameterHijackingRisk}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Intent Divergence Score</Text>
            <Text style={styles.metricValue}>{metrics.intentDivergenceScore}/100</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>MCP Scope Permissions</Text>
            <Text style={styles.metricValue}>{metrics.mcpScopePermissions.join(', ')}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Parameter Validation</Text>
            <Text style={styles.metricValue}>{metrics.parameterValidationStatus}</Text>
          </View>
        </View>

        <Text style={styles.section}>Identified Zafiyetler (Findings)</Text>
        {vulnerabilities.map((v) => (
          <Text key={v} style={styles.bullet}>
            • {v}
          </Text>
        ))}

        <Text style={styles.section}>Edge Gateway Mitigation Steps</Text>
        {mitigationSteps.map((step) => (
          <Text key={step} style={styles.bullet}>
            • {step}
          </Text>
        ))}

        <View style={styles.seal}>
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#065f46' }}>
            SHA-256 Evidence Seal — Nexus Shield Verified
          </Text>
          <Text style={styles.sealHash}>evidence_hash={metrics.evidenceSha256Hash}</Text>
          <Text style={styles.sealHash}>
            target={target.slug} · vertical={target.vertical} · score={result.securityScore}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
