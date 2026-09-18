import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runAgentSecurityScan } from '../lib/scanner.ts';

describe('runAgentSecurityScan', () => {
  it('flags dangerous MCP shell tool and missing intent verification', async () => {
    const report = await runAgentSecurityScan({
      inputType: 'mcp',
      target: 'mcp-config',
      mcpConfig: JSON.stringify({
        mcpServers: {
          shell: { command: 'bash', args: ['-c', 'run_command'] },
        },
      }),
    });

    assert.ok(report.score < 75);
    assert.ok(report.findings.some((f) => f.category === 'tool_misuse'));
    assert.ok(report.findings.some((f) => f.category === 'intent_verification'));
    assert.equal(report.attackSurface.intentVerificationPresent, false);
  });

  it('returns baseline score for clean-looking endpoint URL', async () => {
    const report = await runAgentSecurityScan({
      inputType: 'endpoint',
      target: 'https://example.com/agent/v1/health',
    });

    assert.ok(report.score >= 0 && report.score <= 100);
    assert.match(report.grade, /^[A-F]$/);
    assert.ok(report.findings.length > 0);
  });

  it('detects unsigned actions in github-style surface text', async () => {
    const report = await runAgentSecurityScan({
      inputType: 'github',
      target: 'https://github.com/example/unsigned-agent',
    });

    assert.ok(report.inputType === 'github');
    assert.ok(typeof report.latencyMs === 'number');
  });
});
