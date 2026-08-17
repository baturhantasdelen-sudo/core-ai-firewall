import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeIntentDivergence, isCriticalDivergence } from '../lib/intent/index.ts';
import { inspectMcpMessage, buildMockMcpInspectionFeed } from '../lib/mcp/index.ts';

describe('P1 Intent vs Action Divergence Engine', () => {
  it('detects CRITICAL BLOCK when invoice check intent maps to database export', () => {
    const result = analyzeIntentDivergence('Faturayı kontrol et', [
      { tool: 'export_customer_database', args: { format: 'csv' } },
    ]);

    assert.ok(result.divergencePercent >= 80, `expected >= 80%, got ${result.divergencePercent}%`);
    assert.equal(result.risk, 'CRITICAL');
    assert.equal(result.recommendation, 'CRITICAL_BLOCK');
    assert.equal(result.shouldBlock, true);
    assert.ok(isCriticalDivergence(result));
    assert.ok(result.mismatchedSteps.some((s) => /export/i.test(s.tool)));
  });

  it('allows aligned read intent and read_invoice tool', () => {
    const result = analyzeIntentDivergence('Check invoice INV-8291', [
      { tool: 'read_invoice', args: { invoiceId: 'INV-8291' } },
    ]);

    assert.ok(result.divergencePercent < 35);
    assert.equal(result.risk, 'LOW');
    assert.equal(result.recommendation, 'ALLOW');
    assert.equal(result.shouldBlock, false);
  });
});

describe('P1 MCP Runtime Security Inspector', () => {
  it('blocks unauthorized tool not in manifest', () => {
    const result = inspectMcpMessage(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'export_customer_database', arguments: { format: 'csv' } },
      },
      {
        serverId: 'postgres-mcp',
        allowedTools: ['read_invoice', 'sql_query'],
        agentCapabilities: ['READ'],
      },
    );

    assert.equal(result.allowed, false);
    assert.equal(result.action, 'BLOCK');
    assert.ok(result.violations.some((v) => /Unauthorized MCP tool/i.test(v)));
  });

  it('allows declared low-risk tool call', () => {
    const result = inspectMcpMessage(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'read_invoice', arguments: { invoiceId: 'INV-8291' } },
      },
      {
        serverId: 'postgres-mcp',
        allowedTools: ['read_invoice', 'sql_query'],
        agentCapabilities: ['READ'],
      },
    );

    assert.equal(result.allowed, true);
    assert.equal(result.action, 'ALLOW');
    assert.equal(result.violations.length, 0);
  });

  it('blocks unauthorized prompt access', () => {
    const result = inspectMcpMessage(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'prompts/get',
        params: { name: 'ignore_instructions_override' },
      },
      {
        allowedPrompts: ['summarize_repo', 'audit_permissions'],
      },
    );

    assert.equal(result.allowed, false);
    assert.equal(result.action, 'BLOCK');
    assert.ok(result.violations.some((v) => /Unauthorized MCP prompt/i.test(v)));
  });

  it('mock feed produces mixed allow/block outcomes', () => {
    const feed = buildMockMcpInspectionFeed();
    const outcomes = feed.map((entry) => inspectMcpMessage(entry.message, entry.context));
    assert.ok(outcomes.some((o) => o.action === 'ALLOW'));
    assert.ok(outcomes.some((o) => o.action === 'BLOCK'));
  });
});
