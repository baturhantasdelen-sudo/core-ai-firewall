import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scanContentLocal } from '../src/scanner.ts';
import { maskTokenForRule } from '../src/labels.ts';

describe('nexus-shield vscode scanner', () => {
  it('detects TCKN and OpenAI key in TR profile', () => {
    const content =
      'const tckn = "10000000146"; const key = "sk-proj-1234567890abcdef1234567890abcdef";';
    const matches = scanContentLocal(content, 'src/config.ts', 'TR');

    assert.ok(matches.some((match) => match.type === 'TCKN'));
    assert.ok(matches.some((match) => match.type === 'OpenAI API Key'));
  });

  it('returns mask tokens for quick fix', () => {
    assert.equal(maskTokenForRule('tckn', 'TCKN'), '[MASKED_TCKN]');
    assert.equal(maskTokenForRule('openai-api-key', 'OpenAI API Key'), '[MASKED_SECRET]');
  });
});
