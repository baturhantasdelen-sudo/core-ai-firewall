import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { findingsToSarif } from '../sarif.ts';
import { validateSecret, validateSecretFindings } from './index.ts';
import {
  validateAwsAccessKey,
  validateGitHubToken,
  validateOpenAiKey,
} from './validators.ts';

describe('secret validation engine', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('marks AWS access keys as UNVERIFIED without live probe', async () => {
    const result = await validateAwsAccessKey('AKIAIOSFODNN7EXAMPLE');
    assert.equal(result.status, 'UNVERIFIED');
    assert.equal(result.risk_level, 'MEDIUM');
    assert.equal(result.risk_score, 5.0);
    assert.match(result.message, /AWS access key/i);
  });

  it('returns ACTIVE with CRITICAL risk score for valid OpenAI response', async () => {
    globalThis.fetch = mock.fn(async () => new Response('{}', { status: 200 })) as typeof fetch;

    const result = await validateOpenAiKey('sk-proj-test-key');
    assert.equal(result.status, 'ACTIVE');
    assert.equal(result.risk_level, 'CRITICAL');
    assert.equal(result.risk_score, 9.8);
    assert.match(result.message, /Active OpenAI API key/i);
  });

  it('returns INACTIVE with LOW risk score for revoked OpenAI key', async () => {
    globalThis.fetch = mock.fn(async () => new Response('Unauthorized', { status: 401 })) as typeof fetch;

    const result = await validateOpenAiKey('sk-proj-revoked-key');
    assert.equal(result.status, 'INACTIVE');
    assert.equal(result.risk_level, 'LOW');
    assert.equal(result.risk_score, 2.0);
  });

  it('returns UNVERIFIED when provider probe times out', async () => {
    globalThis.fetch = mock.fn(async () => {
      throw new Error('Timeout');
    }) as typeof fetch;

    const result = await validateGitHubToken('ghp_testtoken123456789012345678901234');
    assert.equal(result.status, 'UNVERIFIED');
    assert.equal(result.risk_level, 'MEDIUM');
  });

  it('validates only secret findings in batch', async () => {
    globalThis.fetch = mock.fn(async () => new Response('{}', { status: 401 })) as typeof fetch;

    const findings = await validateSecretFindings([
      {
        ruleId: 'tckn',
        type: 'TCKN',
        line: 1,
        column: 1,
        preview: '10000000146',
        matched: '10000000146',
        confidence: 'HIGH',
        severity: 'high',
        category: 'pii',
      },
      {
        ruleId: 'openai-api-key',
        type: 'OpenAI API Key',
        line: 2,
        column: 1,
        preview: 'sk-proj-****',
        matched: 'sk-proj-test-key',
        confidence: 'MEDIUM',
        severity: 'high',
        category: 'secret',
      },
    ]);

    assert.equal(findings[0].validation, undefined);
    assert.equal(findings[1].validation?.status, 'INACTIVE');
  });

  it('routes rule ids to the correct validator', async () => {
    const result = await validateSecret('aws-access-key', 'AKIAIOSFODNN7EXAMPLE');
    assert.equal(result.status, 'UNVERIFIED');
  });

  it('adds secretValidationStatus to SARIF properties', () => {
    const sarif = findingsToSarif(
      [
        {
          ruleId: 'openai-api-key',
          type: 'OpenAI API Key',
          line: 1,
          column: 1,
          preview: 'sk-proj-****',
          matched: 'sk-proj-test',
          confidence: 'HIGH',
          severity: 'critical',
          category: 'secret',
          file: 'src/config.ts',
          validation: {
            status: 'ACTIVE',
            risk_score: 9.8,
            risk_level: 'CRITICAL',
            message: 'Active OpenAI API key detected in source code!',
          },
        },
      ],
      { repoName: 'demo/repo', commitSha: 'abc123', scanId: 'scan-1' },
    );

    const result = sarif.runs[0].results[0];
    assert.equal(result.properties.secretValidationStatus, 'ACTIVE');
    assert.equal(result.properties.secretValidationRiskScore, 9.8);
  });
});
