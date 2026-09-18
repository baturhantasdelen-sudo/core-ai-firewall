import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildMockDiscoveryScan,
  detectAgentsFromNetworkLogs,
  filterAgentInventory,
  runDiscoveryScan,
  summarizeDiscovery,
} from '../lib/discovery/index.ts';
import { mockScanMcpServer, scanMcpServer } from '../lib/mcp/scanner.ts';

describe('P0 discovery service', () => {
  it('summarizes agent inventory stats', () => {
    const scan = buildMockDiscoveryScan();
    assert.ok(scan.summary.totalAgents >= 5);
    assert.ok(scan.summary.mcpServers >= 2);
    assert.ok(scan.summary.shadowAgents >= 1);
  });

  it('detects MCP servers from eBPF-style JSON network logs', () => {
    const logs = [
      JSON.stringify({
        timestamp: '2026-08-15T20:00:00.000Z',
        srcIp: '10.0.1.5',
        dstIp: '127.0.0.1',
        dstPort: 3100,
        processName: 'postgres-mcp',
        payloadHint: 'json-rpc tools/list',
      }),
    ];

    const agents = detectAgentsFromNetworkLogs(logs);
    assert.equal(agents.length, 1);
    assert.equal(agents[0]?.type, 'MCP_SERVER');
    assert.equal(agents[0]?.endpoint, '127.0.0.1:3100');
  });

  it('filters inventory by type and search query', () => {
    const scan = buildMockDiscoveryScan();
    const shadowOnly = filterAgentInventory(scan.agents, { type: 'SHADOW_AGENT' });
    assert.ok(shadowOnly.every((a) => a.type === 'SHADOW_AGENT'));

    const byName = filterAgentInventory(scan.agents, { search: 'postgres' });
    assert.ok(byName.some((a) => a.name.toLowerCase().includes('postgres')));
  });

  it('merges mock baseline with network observations', () => {
    const result = runDiscoveryScan({
      includeMockBaseline: false,
      networkLogs: [
        '2026-08-15T20:01:00.000Z|10.0.2.1|192.168.1.50|11434|TCP|ollama-proxy|shadow inference',
      ],
    });
    assert.equal(result.source, 'network');
    assert.ok(result.agents.some((a) => a.type === 'SHADOW_AGENT'));
    assert.equal(summarizeDiscovery(result.agents).totalAgents, result.agents.length);
  });
});

describe('MCP discovery scanner', () => {
  it('returns mock tools/list and prompts/list for known ports', () => {
    const result = mockScanMcpServer({ host: '127.0.0.1', port: 3100 });
    assert.equal(result.reachable, true);
    assert.ok(result.tools.some((t) => t.name === 'sql_query'));
    assert.ok(result.prompts.length >= 1);
  });

  it('falls back to mock scan when live host is unreachable', async () => {
    const result = await scanMcpServer(
      { host: '127.0.0.1', port: 59999, timeoutMs: 200 },
      { fallbackToMock: true },
    );
    assert.ok(result.tools.length >= 1);
    assert.ok(result.errors.length >= 1 || !result.reachable);
  });
});
