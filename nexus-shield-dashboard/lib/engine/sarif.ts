import type { DetectionMatch } from '@/lib/engine/types';

export interface SarifFinding extends DetectionMatch {
  file?: string;
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
                },
              },
            },
          ],
          properties: {
            confidence: finding.confidence,
            severity: finding.severity,
            category: finding.category,
            preview: finding.preview,
            entropy: finding.entropy,
          },
        })),
      },
    ],
  };
}

function sarifLevel(severity: DetectionMatch['severity']): 'error' | 'warning' | 'note' {
  if (severity === 'critical' || severity === 'high') return 'error';
  if (severity === 'medium') return 'warning';
  return 'note';
}
