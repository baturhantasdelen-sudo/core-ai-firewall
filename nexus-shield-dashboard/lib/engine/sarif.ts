import type { DetectionMatch } from '@/lib/engine/types';
import type { SecretValidationResult } from '@/lib/engine/validation/types';
import type { RemediationFix } from '@/lib/engine/remediation';

export interface SarifFinding extends DetectionMatch {
  file?: string;
  validation?: SecretValidationResult;
  fix?: RemediationFix;
}

export interface SarifConversionContext {
  repoName: string;
  commitSha: string;
  scanId?: string;
}

export function findingsToSarif(findings: SarifFinding[], context: SarifConversionContext) {
  const ruleMap = new Map<string, Record<string, unknown>>();

  for (const finding of findings) {
    if (!ruleMap.has(finding.ruleId)) {
      ruleMap.set(finding.ruleId, {
        id: finding.ruleId,
        name: finding.type,
        shortDescription: { text: finding.type },
        fullDescription: { text: `Nexus Shield detection rule: ${finding.type}` },
        defaultConfiguration: { level: sarifLevel(finding.severity) },
        properties: {
          category: finding.category,
          tags: [finding.category, finding.confidence.toLowerCase()],
        },
      });
    }
  }

  return {
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'Nexus Shield',
            informationUri: 'https://nexusshield.ai',
            version: '1.0.0',
            rules: Array.from(ruleMap.values()),
          },
        },
        automationDetails: {
          id: context.scanId,
          description: {
            text: `Scan for ${context.repoName}@${context.commitSha.slice(0, 7)}`,
          },
        },
        results: findings.map((finding) => ({
          ruleId: finding.ruleId,
          level: sarifLevel(finding.severity),
          message: {
            text: `${finding.type} detected (${finding.confidence} confidence)`,
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: finding.file ?? 'unknown',
                },
                region: {
                  startLine: finding.line,
                  startColumn: finding.column,
                  endLine: finding.line,
                  endColumn: finding.column + finding.matched.length,
                },
              },
            },
          ],
          fixes: finding.fix ? [sarifFixObject(finding.fix)] : [],
          properties: {
            confidence: finding.confidence,
            severity: finding.severity,
            category: finding.category,
            preview: finding.preview,
            entropy: finding.entropy,
            secretValidationStatus: finding.validation?.status ?? null,
            secretValidationRiskScore: finding.validation?.risk_score ?? null,
            secretValidationRiskLevel: finding.validation?.risk_level ?? null,
            secretValidationMessage: finding.validation?.message ?? null,
            remediationReplacement: finding.fix?.replacement ?? null,
            remediationEnvVar: finding.fix?.envVarName ?? null,
            remediationEnvExample: finding.fix?.envExampleLine ?? null,
          },
        })),
      },
    ],
  };
}

function sarifFixObject(fix: RemediationFix): Record<string, unknown> {
  const endColumn = fix.column + fix.original.length;
  const description =
    fix.category === 'pii'
      ? `Mask ${fix.type} according to Nexus Shield policy`
      : `Replace leaked ${fix.type} with environment variable reference`;

  return {
    description: { text: description },
    artifactChanges: [
      {
        artifactLocation: {
          uri: fix.file ?? 'unknown',
          uriBaseId: '%SRCROOT%',
        },
        replacements: [
          {
            deletedRegion: {
              startLine: fix.line,
              startColumn: fix.column,
              endLine: fix.line,
              endColumn,
            },
            insertedContent: {
              text: fix.replacement,
            },
          },
        ],
      },
    ],
  };
}

function sarifLevel(severity: DetectionMatch['severity']): 'error' | 'warning' | 'note' {
  if (severity === 'critical' || severity === 'high') return 'error';
  if (severity === 'medium') return 'warning';
  return 'note';
}
