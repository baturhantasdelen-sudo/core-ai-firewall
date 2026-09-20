import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { runAgentSecurityScan, type AgentSecurityReport } from '@/lib/scanner';
import { computeAuditVerificationHash } from '@/lib/reports/audit-verification-hash';
import {
  deriveAuditTrail,
  deriveIntentDivergenceRisk,
  deriveParameterValidation,
  derivePrivilegeLevel,
  fetchTargetSurface,
} from '@/lib/research/research-scanner';
import type { ResearchTarget } from '@/lib/research/types';
import type {
  DisclosureScanResult,
  DisclosureTarget,
  DisclosureVulnerabilityMetrics,
} from '@/lib/disclosure/types';

function intentScore(risk: ReturnType<typeof deriveIntentDivergenceRisk>): number {
  if (risk === 'High') return 85;
  if (risk === 'Medium') return 55;
  return 25;
}

function parameterHijackingRisk(
  validation: ReturnType<typeof deriveParameterValidation>,
  report: AgentSecurityReport,
): DisclosureVulnerabilityMetrics['parameterHijackingRisk'] {
  const hijackFinding = report.findings.some((f) => f.category === 'parameter_hijack');
  if (validation === 'Missing' || hijackFinding) return 'High';
  if (validation === 'Weak') return 'Medium';
  return 'Low';
}

function buildVulnerabilities(
  report: AgentSecurityReport,
  metrics: DisclosureVulnerabilityMetrics,
): string[] {
  const items = report.findings.map((f) => `${f.title} (${f.severity})`);
  if (metrics.parameterValidationStatus === 'Missing') {
    items.unshift('Unvalidated parameter execution — function-call schema not enforced');
  }
  if (metrics.mcpScopePermissions.includes('DB Write')) {
    items.push('MCP scope permits unconstrained database write/delete operations');
  }
  if (metrics.intentDivergenceRisk === 'High') {
    items.push('Intent divergence — user intent vs agent action alignment not verified');
  }
  if (metrics.parameterHijackingRisk === 'High') {
    items.push('Parameter hijacking surface — adversarial tool argument injection possible');
  }
  return [...new Set(items)].slice(0, 8);
}

const MITIGATION_STEPS = [
  'Deploy Nexus Shield edge gateway in front of agent tool-call endpoints (sub-10ms intercept).',
  'Enforce JSON Schema / Zod validation on every MCP tool parameter before execution.',
  'Enable Action Firewall intent verification: NexusShield.evaluateAction({ userIntent, toolCall }).',
  'Attach SHA-256 evidence chain to all blocked and approved actions for audit readiness.',
  'Scope MCP servers with least-privilege manifests — deny shell exec and bulk export by default.',
  'Route production traffic through HITL approval for financial and destructive tool chains.',
];

function toResearchTarget(target: DisclosureTarget): ResearchTarget {
  return {
    id: target.id,
    slug: target.slug,
    name: target.organizationName,
    category: target.vertical === 'fintech-mcp' ? 'mcp' : 'framework',
    github: target.github ?? target.organizationName,
    githubUrl: target.referenceUrl,
    contentPath: target.contentPath,
  };
}

export async function scanDisclosureTarget(
  target: DisclosureTarget,
  tempRoot: string,
): Promise<Omit<DisclosureScanResult, 'pdfRelativePath'>> {
  let surfaceText = target.scanSurface;
  let fetchStatus: 'ok' | 'partial' | 'error' = 'partial';
  let fetchError: string | undefined;

  if (target.scanKind === 'github' && target.github) {
    const fetchResult = await fetchTargetSurface(toResearchTarget(target));
    surfaceText = fetchResult.surfaceText;
    fetchStatus = fetchResult.status;
    fetchError = fetchResult.error;
    const targetDir = path.join(tempRoot, target.slug);
    await mkdir(targetDir, { recursive: true });
    await writeFile(path.join(targetDir, 'surface.txt'), surfaceText, 'utf8');
  }

  let report: AgentSecurityReport;
  if (target.scanKind === 'endpoint') {
    report = await runAgentSecurityScan({
      inputType: 'endpoint',
      target: target.scanSurface,
    });
    surfaceText = target.scanSurface;
  } else if (target.scanKind === 'mcp') {
    report = await runAgentSecurityScan({
      inputType: 'mcp',
      target: target.slug,
      mcpConfig: target.scanSurface,
    });
  } else if (surfaceText.length > 200) {
    report = await runAgentSecurityScan({
      inputType: 'mcp',
      target: target.slug,
      mcpConfig: JSON.stringify({
        source: target.slug,
        content: surfaceText.slice(0, 80_000),
      }),
    });
  } else {
    report = await runAgentSecurityScan({
      inputType: 'github',
      target: target.referenceUrl,
    });
  }

  const parameterValidationStatus = deriveParameterValidation(report, surfaceText);
  const intentDivergenceRisk = deriveIntentDivergenceRisk(report);
  const metrics: DisclosureVulnerabilityMetrics = {
    parameterHijackingRisk: parameterHijackingRisk(parameterValidationStatus, report),
    mcpScopePermissions: derivePrivilegeLevel(surfaceText),
    intentDivergenceScore: intentScore(intentDivergenceRisk),
    intentDivergenceRisk,
    parameterValidationStatus,
    evidenceSha256Hash: computeAuditVerificationHash(report),
  };

  return {
    target,
    securityScore: report.score,
    grade: report.grade,
    metrics,
    vulnerabilities: buildVulnerabilities(report, metrics),
    mitigationSteps: MITIGATION_STEPS,
    scannedAt: report.scannedAt,
    latencyMs: report.latencyMs,
    fetchStatus,
    fetchError,
    report,
  };
}

export function advisoryPdfFilename(slug: string): string {
  return `${slug}-security-advisory-2026.pdf`;
}

export function advisoryPdfRelativePath(slug: string): string {
  return `/reports/advisories/${advisoryPdfFilename(slug)}`;
}
