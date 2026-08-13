import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_POLICY, parsePolicy } from '../policy.ts';
import { findingsToSarif } from '../sarif.ts';
import {
  buildPreviewFromFinding,
  remediateFileContent,
  remediateFiles,
} from './index.ts';
import type { DetectionMatch } from '../types.ts';

function tcknFinding(matched = '10000000146'): DetectionMatch {
  return {
    ruleId: 'tckn',
    type: 'TCKN',
    line: 1,
    column: 21,
    preview: '100****146',
    matched,
    confidence: 'HIGH',
    severity: 'high',
    category: 'pii',
  };
}

function openAiFinding(matched = 'sk-proj-1234567890abcdef1234567890abcdef'): DetectionMatch {
  return {
    ruleId: 'openai-api-key',
    type: 'OpenAI API Key',
    line: 2,
    column: 18,
    preview: 'sk-proj***************cdef',
    matched,
    confidence: 'HIGH',
    severity: 'critical',
    category: 'secret',
  };
}

describe('remediation engine', () => {
  it('masks TCKN with partial policy style', () => {
    const content = 'const customerTckn = "10000000146";';
    const policy = {
      ...DEFAULT_POLICY,
      remediation: { pii_mask_style: 'partial' as const, secret_use_env: true },
    };

    const result = remediateFileContent(content, [tcknFinding()], policy, 'src/user.ts');
    assert.match(result.content, /100\*\*\*\*146/);
    assert.equal(result.fixes.length, 1);
    assert.equal(result.fixes[0].replacement, '100****146');
  });

  it('masks TCKN with token policy style', () => {
    const content = 'const customerTckn = "10000000146";';
    const policy = {
      ...DEFAULT_POLICY,
      remediation: { pii_mask_style: 'token' as const, secret_use_env: true },
    };

    const result = remediateFileContent(content, [tcknFinding()], policy);
    assert.match(result.content, /\[MASKED_TCKN\]/);
  });

  it('replaces secrets with process.env references and env example lines', () => {
    const content = 'const api_key = "sk-proj-1234567890abcdef1234567890abcdef";';
    const policy = {
      ...DEFAULT_POLICY,
      remediation: { pii_mask_style: 'token' as const, secret_use_env: true },
    };

    const result = remediateFileContent(content, [openAiFinding()], policy, 'src/config.ts');
    assert.match(result.content, /process\.env\.OPENAI_API_KEY/);
    assert.ok(result.envExampleAdditions.some((line) => line.startsWith('OPENAI_API_KEY=')));
  });

  it('remediates multiple files in batch', () => {
    const policy = {
      ...DEFAULT_POLICY,
      remediation: { pii_mask_style: 'partial' as const, secret_use_env: true },
    };

    const batch = remediateFiles(
      [
        {
          path: 'a.ts',
          content: 'const tckn = "10000000146";',
          findings: [tcknFinding()],
        },
        {
          path: 'b.ts',
          content: 'const api_key = "sk-proj-1234567890abcdef1234567890abcdef";',
          findings: [openAiFinding()],
        },
      ],
      policy,
    );

    assert.equal(batch.files.length, 2);
    assert.ok(batch.envExampleAdditions.length >= 1);
  });

  it('builds preview diff for dashboard modal', () => {
    const policy = {
      ...DEFAULT_POLICY,
      remediation: { pii_mask_style: 'partial' as const, secret_use_env: true },
    };
    const preview = buildPreviewFromFinding(
      tcknFinding(),
      policy,
      'const customerTckn = "10000000146";',
    );

    assert.match(preview.originalLine, /10000000146/);
    assert.match(preview.fixedLine, /100\*\*\*\*146/);
    assert.match(preview.diff, /^-/m);
    assert.match(preview.diff, /^\+/m);
  });

  it('loads remediation settings from policy object', () => {
    const policy = parsePolicy({
      version: 1,
      profile: 'TR',
      remediation: { pii_mask_style: 'partial', secret_use_env: true },
      rules: { secret_detection: 'block', pii_detection: 'warn' },
    });

    assert.equal(policy.remediation?.pii_mask_style, 'partial');
    assert.equal(policy.remediation?.secret_use_env, true);
  });
});

describe('SARIF fixes', () => {
  it('embeds SARIF 2.1.0 fix objects on results', () => {
    const finding = {
      ...tcknFinding(),
      file: 'src/user.ts',
      fix: {
        ruleId: 'tckn',
        type: 'TCKN',
        category: 'pii' as const,
        file: 'src/user.ts',
        line: 1,
        column: 21,
        original: '10000000146',
        replacement: '100****146',
      },
    };

    const sarif = findingsToSarif([finding], {
      repoName: 'owner/repo',
      commitSha: 'abc1234567890',
    });

    const result = sarif.runs[0].results[0] as {
      fixes: Array<{ artifactChanges: unknown[] }>;
    };
    assert.equal(result.fixes.length, 1);
    assert.equal(result.fixes[0].artifactChanges.length, 1);
  });
});
