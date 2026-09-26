import { createHash } from 'crypto';
import type {
  DisclosureScanResult,
  DisclosureVertical,
  OutboundDisclosureBatch,
  OutboundDisclosureRow,
  OutreachDrafts,
} from '@/lib/disclosure/types';

const VERTICAL_LABELS: Record<DisclosureVertical, string> = {
  'yc-ai-saas': 'YC AI SaaS',
  'fintech-mcp': 'FinTech & Open Banking MCP',
  'enterprise-tr': 'Enterprise TR Tech',
};

export function buildOutreachDrafts(result: DisclosureScanResult): OutreachDrafts {
  const org = result.target.organizationName;
  const hash = result.metrics.evidenceSha256Hash.slice(0, 16);
  const score = result.securityScore;
  const topFinding = result.vulnerabilities[0] ?? 'unvalidated parameter execution';

  return {
    emailEn: [
      `Subject: Confidential — AI Agent Security Advisory for ${org} (SHA-256: ${hash}…)`,
      '',
      `Dear CISO / CTO,`,
      '',
      `Nexus Shield completed a passive security assessment of ${org}'s agent/MCP surface.`,
      `Score: ${score}/100. Key finding: ${topFinding}.`,
      '',
      `We have prepared a confidential advisory PDF with verifiable SHA-256 evidence`,
      `and Runtime Action Governance mitigation steps (Universal Action Receipts, Policy Enforcement, and GRC Evidence Bundles). Happy to share under responsible disclosure.`,
      '',
      `Best regards,`,
      `Nexus Shield Security Research`,
      `https://nexusshield.ai/reports/state-of-agent-security-2026`,
    ].join('\n'),
    emailTr: [
      `Konu: Gizli — ${org} AI Agent Güvenlik Danışmanlığı (SHA-256: ${hash}…)`,
      '',
      `Sayın CISO / CTO,`,
      '',
      `Nexus Shield, ${org} agent/MCP yüzeyinde pasif güvenlik değerlendirmesi tamamladı.`,
      `Skor: ${score}/100. Temel bulgu: ${topFinding}.`,
      '',
      `Doğrulanabilir SHA-256 kanıt zinciri ile Runtime Action Governance, Universal Action Receipt,`,
      `Policy Enforcement ve GRC Evidence Bundle adımlarını`,
      `içeren gizli bir danışmanlık PDF'i hazırladık. Sorumlu açıklama kapsamında paylaşmaya hazırız.`,
      '',
      `Saygılarımızla,`,
      `Nexus Shield Güvenlik Araştırması`,
      `https://nexusshield.ai/reports/state-of-agent-security-2026`,
    ].join('\n'),
    linkedinEn: [
      `Hi — we ran a passive AI agent security scan on ${org} (${score}/100).`,
      `Found ${topFinding}. We have a SHA-256 sealed advisory with Runtime Action Governance and Cryptographic Verification steps.`,
      `Open to responsible disclosure — can I send the PDF?`,
    ].join(' '),
    linkedinTr: [
      `Merhaba — ${org} için pasif AI agent güvenlik taraması yaptık (${score}/100).`,
      `${topFinding} tespit edildi. SHA-256 mühürlü danışmanlık PDF'imiz (Runtime Action Governance, Cryptographic Verification) hazır.`,
      `Sorumlu açıklama kapsamında paylaşabilir miyim?`,
    ].join(' '),
  };
}

export function toOutboundRow(result: DisclosureScanResult): OutboundDisclosureRow {
  return {
    organizationName: result.target.organizationName,
    vertical: result.target.vertical,
    verticalLabel: VERTICAL_LABELS[result.target.vertical],
    securityScore: result.securityScore,
    grade: result.grade,
    pdfPath: result.pdfRelativePath,
    evidenceHash: result.metrics.evidenceSha256Hash,
    parameterHijackingRisk: result.metrics.parameterHijackingRisk,
    intentDivergenceScore: result.metrics.intentDivergenceScore,
    outreachEmail: result.target.outreachEmail,
    cisoEmail: result.target.cisoEmail,
    outreach: buildOutreachDrafts(result),
  };
}

export function buildOutboundBatch(results: DisclosureScanResult[]): OutboundDisclosureBatch {
  const rows = results.map(toOutboundRow);
  const verticals: Record<DisclosureVertical, number> = {
    'yc-ai-saas': rows.filter((r) => r.vertical === 'yc-ai-saas').length,
    'fintech-mcp': rows.filter((r) => r.vertical === 'fintech-mcp').length,
    'enterprise-tr': rows.filter((r) => r.vertical === 'enterprise-tr').length,
  };

  const summary = {
    batchId: 'unified-responsible-disclosure-2026',
    generatedAt: new Date().toISOString(),
    targetCount: rows.length,
    verticals,
  };

  return {
    ...summary,
    results: rows,
    verificationHash: createHash('sha256').update(JSON.stringify(summary)).digest('hex'),
  };
}

export function renderOutboundMarkdown(batch: OutboundDisclosureBatch): string {
  const lines = [
    '# Unified Responsible Disclosure — Outbound Matrix',
    '',
    `Generated: ${batch.generatedAt}`,
    `Targets: ${batch.targetCount} · Verification hash: \`${batch.verificationHash.slice(0, 24)}…\``,
    '',
    '| Organization | Vertical | Score | Grade | PDF | Evidence Hash |',
    '|---|---|---:|---|---|---|',
  ];

  for (const row of batch.results) {
    lines.push(
      `| ${row.organizationName} | ${row.verticalLabel} | ${row.securityScore} | ${row.grade} | [PDF](${row.pdfPath}) | \`${row.evidenceHash.slice(0, 12)}…\` |`,
    );
  }

  lines.push('', '## Outreach Drafts', '');

  for (const row of batch.results) {
    lines.push(`### ${row.organizationName}`, '');
    lines.push('**Email (EN)**', '', '```', row.outreach.emailEn, '```', '');
    lines.push('**Email (TR)**', '', '```', row.outreach.emailTr, '```', '');
    lines.push('**LinkedIn (EN)**', '', row.outreach.linkedinEn, '');
    lines.push('**LinkedIn (TR)**', '', row.outreach.linkedinTr, '', '---', '');
  }

  return lines.join('\n');
}
