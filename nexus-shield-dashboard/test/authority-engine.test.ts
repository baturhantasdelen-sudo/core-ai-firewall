import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateEffectiveAuthority,
  detectCombinatorialRisks,
  classifyAgentTools,
} from '../lib/authority/index.ts';
import type { AgentAsset } from '../lib/engine/discovery/index.ts';

const EXFIL_AGENT: AgentAsset = {
  id: 'eag-exfil-agent',
  name: 'Invoice Assistant',
  framework: 'LangChain',
  sourceFile: 'src/agents/invoice_bot.py',
  capabilities: ['READ'],
  riskLevel: 'MEDIUM',
  mcpConnections: [
    {
      serverName: 'workspace-tools',
      transport: 'stdio',
      tools: ['read_invoice', 'send_http'],
    },
  ],
};

describe('P0 EAG — Effective Authority Graph engine', () => {
  it('builds AuthorityGraph with Agent, Tool, Database, ExternalAPI, DataAsset nodes', () => {
    const result = calculateEffectiveAuthority(EXFIL_AGENT);
    const types = new Set(result.graph.nodes.map((n) => n.type));

    assert.ok(types.has('Agent'));
    assert.ok(types.has('Tool'));
    assert.ok(result.graph.edges.length >= 2);
    assert.ok(result.graph.toolCapabilities.includes('read_invoice'));
  });

  it('detects DATA_EXFILTRATION_RISK for Read-Invoice + Send-HTTP combination', () => {
    const input = {
      id: EXFIL_AGENT.id,
      name: EXFIL_AGENT.name,
      framework: EXFIL_AGENT.framework,
      capabilities: EXFIL_AGENT.capabilities,
      mcpConnections: EXFIL_AGENT.mcpConnections,
    };

    const tools = classifyAgentTools(input);
    const risks = detectCombinatorialRisks(input, tools);

    assert.ok(risks.some((r) => r.kind === 'DATA_EXFILTRATION_RISK'));
    assert.ok(risks.some((r) => r.toolsInvolved.includes('read_invoice')));
    assert.ok(risks.some((r) => r.toolsInvolved.includes('send_http')));
  });

  it('calculateEffectiveAuthority scores combinatorial privilege escalation', () => {
    const result = calculateEffectiveAuthority(EXFIL_AGENT);
    assert.ok(result.graph.combinatorialRisks.length >= 1);
    assert.ok(result.graph.effectiveRiskScore >= 30);
    assert.ok(['MEDIUM', 'HIGH', 'CRITICAL'].includes(result.graph.effectiveRiskLevel));
  });
});
