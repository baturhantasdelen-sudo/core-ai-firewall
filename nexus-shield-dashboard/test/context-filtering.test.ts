import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runDetectionEngine, DEFAULT_POLICY } from '../lib/engine/index.ts';
import { analyzeFindingContext, finalizeFindingsContext } from '../lib/engine/context/index.ts';
import { findingsToSarif } from '../lib/engine/sarif.ts';
import type { DetectionMatch } from '../lib/engine/types.ts';

const LIVE_OPENAI_KEY = 'sk-proj-1234567890abcdef1234567890abcdef';

function secretFinding(overrides: Partial<DetectionMatch> = {}): DetectionMatch {
  return {
    ruleId: 'openai-api-key',
    type: 'OpenAI API Key',
    line: 1,
    column: 22,
    preview: 'sk-proj***************cdef',
    matched: LIVE_OPENAI_KEY,
    confidence: 'HIGH',
    severity: 'critical',
    category: 'secret',
    entropy: 4.8,
    ...overrides,
  };
}

describe('context-aware false positive filtering', () => {
  it('suppresses mock_api_key variable context', () => {
    const content = `const mock_api_key = "${LIVE_OPENAI_KEY}";`;
    const finding = secretFinding({ line: 1, column: 22 });

    const result = analyzeFindingContext({
      finding,
      content,
      filename: 'src/config.ts',
    });

    assert.equal(result.isFalsePositive, true);
    assert.ok(result.confidenceScore < 0.35);
    assert.match(result.suppressionReason ?? '', /mock_api_key/i);
  });

  it('suppresses findings in .env.example files', () => {
    const content = `OPENAI_API_KEY=${LIVE_OPENAI_KEY}`;
    const finding = secretFinding({ line: 1, column: 17, matched: LIVE_OPENAI_KEY });

    const result = analyzeFindingContext({
      finding,
      content,
      filename: '.env.example',
    });

    assert.equal(result.isFalsePositive, true);
    assert.match(result.suppressionReason ?? '', /\.env\.example/i);
  });

  it('suppresses findings in test/fixture paths', () => {
    const content = `export const sample = "${LIVE_OPENAI_KEY}";`;
    const finding = secretFinding({ line: 1, column: 24 });

    const result = analyzeFindingContext({
      finding,
      content,
      filename: 'tests/fixtures/sample-keys.ts',
    });

    assert.equal(result.isFalsePositive, true);
    assert.ok(result.confidenceScore < 0.35);
  });

  it('keeps likely live secrets with high entropy and ACTIVE validation', () => {
    const content = `const api_key = "${LIVE_OPENAI_KEY}";`;
    const finding = secretFinding({ line: 1, column: 18 });

    const result = analyzeFindingContext({
      finding,
      content,
      filename: 'src/production/config.ts',
      validation: {
        status: 'ACTIVE',
        risk_score: 9.8,
        risk_level: 'CRITICAL',
        message: 'Active OpenAI API key',
      },
    });

    assert.equal(result.isFalsePositive, false);
    assert.ok(result.confidenceScore >= 0.35);
  });

  it('filters suppressed findings from default engine output', () => {
    const content = `const dummy_token = "${LIVE_OPENAI_KEY}";`;
    const findings = runDetectionEngine(content, 'src/config.ts', DEFAULT_POLICY);

    assert.equal(findings.length, 0);
  });

  it('includes suppressed findings when includeSuppressed is enabled', () => {
    const content = `const dummy_token = "${LIVE_OPENAI_KEY}";`;
    const findings = runDetectionEngine(content, 'src/config.ts', DEFAULT_POLICY, {
      includeSuppressed: true,
    });

    assert.ok(findings.length >= 1);
    assert.ok(findings.every((finding) => finding.suppressed));
  });

  it('re-evaluates context after secret validation in finalizeFindingsContext', () => {
    const finding = secretFinding({ line: 1, column: 18 });
    const content = `const api_key = "${LIVE_OPENAI_KEY}";`;
    const fileContent = new Map([['src/live.ts', content]]);
    const validationByKey = new Map([
      [
        `${finding.ruleId}:${finding.line}:${finding.matched}`,
        {
          status: 'ACTIVE' as const,
          risk_score: 9.8,
          risk_level: 'CRITICAL' as const,
          message: 'Active OpenAI API key',
        },
      ],
    ]);

    const finalized = finalizeFindingsContext(
      [{ ...finding, file: 'src/live.ts' } as DetectionMatch & { file: string }],
      fileContent,
      validationByKey,
    );

    assert.equal(finalized[0].suppressed, false);
    assert.ok((finalized[0].confidenceScore ?? 0) >= 0.35);
  });

  it('adds SARIF suppression objects for false positives', () => {
    const finding = {
      ...secretFinding(),
      file: 'tests/mock-config.ts',
      suppressed: true,
      isFalsePositive: true,
      confidenceScore: 0.22,
      suppressionReason: "Identified as test mock data due to variable naming 'mock_api_key'",
    };

    const sarif = findingsToSarif([finding], {
      repoName: 'owner/repo',
      commitSha: 'abc1234567890',
      includeSuppressed: true,
    });

    const result = sarif.runs[0].results[0] as {
      suppressions: Array<{ kind: string; justification: string }>;
    };

    assert.equal(result.suppressions.length, 1);
    assert.equal(result.suppressions[0].kind, 'external');
    assert.match(result.suppressions[0].justification, /mock_api_key/i);
  });
});
