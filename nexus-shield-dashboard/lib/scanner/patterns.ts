// Backward-compatible facade over the modular detection engine.
// Kept in sync with `nexus-shield-action/src/scanner.ts` surface where possible.

import { runDetectionEngine } from '@/lib/engine';
import type { NexusShieldPolicy } from '@/lib/engine/policy';
import type { DetectionMatch } from '@/lib/engine/types';
import { maskPreview as engineMaskPreview } from '@/lib/engine/utils';

export type IssueType =
  | 'TCKN'
  | 'TR IBAN'
  | 'VKN'
  | 'TR Phone'
  | 'SSN'
  | 'Credit Card'
  | 'Email'
  | 'IBAN'
  | 'OpenAI API Key'
  | 'Anthropic API Key'
  | 'Vercel Token'
  | 'AWS Access Key'
  | 'GCP API Key'
  | 'Stripe Secret Key'
  | 'GitHub Token'
  | 'npm Access Token'
  | 'PyPI API Token'
  | 'Private Key'
  | 'JWT'
  | 'Generic Secret'
  | 'High-Entropy Secret';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'note';

export interface ScanIssue {
  type: IssueType | string;
  line: number;
  column: number;
  preview: string;
  matched: string;
  ruleId?: string;
  confidence?: Confidence;
  severity?: Severity;
  category?: 'secret' | 'pii';
  entropy?: number;
}

function toScanIssue(finding: DetectionMatch): ScanIssue {
  return {
    type: finding.type,
    line: finding.line,
    column: finding.column,
    preview: finding.preview,
    matched: finding.matched,
    ruleId: finding.ruleId,
    confidence: finding.confidence,
    severity: finding.severity,
    category: finding.category,
    entropy: finding.entropy,
  };
}

export function maskPreview(value: string, type: IssueType | string): string {
  return engineMaskPreview(value, type);
}

export function scanContent(
  content: string,
  filename: string,
  policy?: NexusShieldPolicy | Record<string, unknown> | null,
): ScanIssue[] {
  return runDetectionEngine(content, filename, policy).map(toScanIssue);
}

export function scanContentWithMetadata(
  content: string,
  filename: string,
  policy?: NexusShieldPolicy | Record<string, unknown> | null,
): DetectionMatch[] {
  return runDetectionEngine(content, filename, policy);
}
