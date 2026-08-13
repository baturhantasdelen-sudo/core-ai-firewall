import type { DetectionMatch, DetectorContext } from '@/lib/engine/types';
import { detectorsForProfile } from '@/lib/engine/detectors';
import { DEFAULT_POLICY, loadPolicyFromObject, type NexusShieldPolicy } from '@/lib/engine/policy';
import { pathMatchesAny, rangesOverlap } from '@/lib/engine/utils';

function isAllowedMatch(matched: string, ctx: DetectorContext): boolean {
  if (ctx.allowlistExact.has(matched)) return true;
  return ctx.allowlistPatterns.some((pattern) => pattern.test(matched));
}

function shouldIncludeFinding(finding: DetectionMatch, policy: NexusShieldPolicy): boolean {
  if (finding.category === 'secret' && policy.rules.secret_detection === 'off') return false;
  if (finding.category === 'pii' && policy.rules.pii_detection === 'off') return false;
  return true;
}

export function runDetectionEngine(
  content: string,
  filename: string,
  policyInput?: NexusShieldPolicy | Record<string, unknown> | null,
): DetectionMatch[] {
  if (!content.trim()) return [];

  const policy = policyInput && 'version' in policyInput
    ? (policyInput as NexusShieldPolicy)
    : loadPolicyFromObject(policyInput as Record<string, unknown> | null);

  const normalizedPath = filename.replace(/\\/g, '/');
  if (pathMatchesAny(normalizedPath, policy.ignore_paths)) {
    return [];
  }

  const ctx: DetectorContext = {
    filename: normalizedPath,
    profile: policy.profile,
    allowlistExact: new Set(policy.allowlist.exact_matches),
    allowlistPatterns: policy.allowlist.regex_patterns.map((pattern) => new RegExp(pattern)),
    ignorePaths: policy.ignore_paths,
  };

  const detectors = detectorsForProfile(policy.profile);
  const allMatches: Array<DetectionMatch & { range?: [number, number] }> = [];
  const seen = new Set<string>();
  const occupied: Array<[number, number]> = [];

  for (const detector of detectors) {
    const matches = detector.detect(content, ctx);
    for (const match of matches) {
      const range = (match as DetectionMatch & { range?: [number, number] }).range;
      if (range && occupied.some((existing) => rangesOverlap(existing, range))) continue;
      if (isAllowedMatch(match.matched, ctx)) continue;
      if (!shouldIncludeFinding(match, policy)) continue;

      const dedupeKey = `${match.ruleId}:${match.line}:${match.column}:${match.matched}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      if (range) occupied.push(range);

      const { range: _range, ...finding } = match as DetectionMatch & { range?: [number, number] };
      allMatches.push(finding);
    }
  }

  return allMatches.sort((a, b) => a.line - b.line || a.column - b.column);
}

export function runDetectionEngineOnLines(
  lines: Array<{ lineNumber: number; content: string }>,
  filename: string,
  policyInput?: NexusShieldPolicy | Record<string, unknown> | null,
): DetectionMatch[] {
  const findings: DetectionMatch[] = [];

  for (const line of lines) {
    if (!line.content.trim()) continue;
    const lineFindings = runDetectionEngine(line.content, filename, policyInput);
    findings.push(
      ...lineFindings.map((finding) => ({
        ...finding,
        line: line.lineNumber,
      })),
    );
  }

  return findings.sort((a, b) => a.line - b.line || a.column - b.column);
}

export { DEFAULT_POLICY };
