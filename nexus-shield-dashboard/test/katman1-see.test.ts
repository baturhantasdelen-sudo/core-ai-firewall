import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  detectEffectiveAuthority,
  scanEnvironment,
  buildAgentInventoryRecord,
} from '../lib/engine/agents/inventory.ts';
import { buildMockAgentDiscovery } from '../lib/mock-agent-data.ts';
import type { AgentAsset } from '../lib/engine/discovery/index.ts';

const READ_ONLY_AGENT: AgentAsset = {
  id: 'support-readonly-1',
  name: 'Invoice Reader',
  framework: 'LangChain',
  sourceFile: 'src/agents/invoice_reader.py',
  capabilities: ['READ'],
  riskLevel: 'LOW',
  mcpConnections: [
    { serverName: 'filesystem', transport: 'stdio', tools: ['read_invoice'] },
  ],
};

const PRIVILEGE_ESCALATION_CONTENT = `
  declared_role="Read invoices only"
  scopes="read:invoices"
  STRIPE_SECRET_KEY=sk_live_hidden_financial
  DATABASE_URL=postgres://admin:root@db.prod:5432/main?superuser=true&tenant_id=*
  AWS_SECRET_ACCESS_KEY=DELETE_ALL
`;

const OPS_CREW_CONTENT = `
  scopes="delete:records payment:stripe export:database cross_tenant:all"
  SWIFT_API_KEY=swift_live
  DATABASE_URL=postgres://root:pass@db/export?pg_dump=true
`;

describe('Katman 1 — SEE: Effective Authority & Inventory Map', () => {
  it('detects privilege escalation between declared and effective scopes', () => {
    const report = detectEffectiveAuthority(READ_ONLY_AGENT, PRIVILEGE_ESCALATION_CONTENT);

    assert.deepEqual(report.declaredScopes, ['Read Data']);
    assert.equal(report.privilegeEscalationDetected, true);
    assert.ok(report.hiddenPermissions.length > 0);
    assert.ok(report.riskScore > 0);
    assert.ok(report.effectiveScopes.length > report.declaredScopes.length);
  });

  it('triggers UNRESTRICTED_DELETE elevated risk from API keys and DB connection strings', () => {
    const report = detectEffectiveAuthority(READ_ONLY_AGENT, PRIVILEGE_ESCALATION_CONTENT);

    assert.ok(report.elevatedRisks.includes('UNRESTRICTED_DELETE'));
    assert.ok(
      report.entries.some(
        (entry) => entry.scope === 'UNRESTRICTED_DELETE' && entry.source === 'API_KEY',
      ),
    );
  });

  it('triggers FINANCIAL_EXECUTE elevated risk from payment API credentials', () => {
    const agent: AgentAsset = {
      ...READ_ONLY_AGENT,
      id: 'finance-runner',
      mcpConnections: [
        { serverName: 'billing', transport: 'stdio', tools: ['stripe_payment', 'erp_pay'] },
      ],
    };

    const report = detectEffectiveAuthority(agent, OPS_CREW_CONTENT);

    assert.ok(report.elevatedRisks.includes('FINANCIAL_EXECUTE'));
    assert.ok(
      report.entries.some(
        (entry) => entry.scope === 'FINANCIAL_EXECUTE' && entry.source === 'OAUTH_TOKEN',
      ),
    );
  });

  it('triggers DATABASE_EXPORT and CROSS_TENANT_ACCESS elevated risks', () => {
    const agent: AgentAsset = {
      ...READ_ONLY_AGENT,
      id: 'export-agent',
      mcpConnections: [
        { serverName: 'postgres', transport: 'sse', tools: ['bulk_export_db', 'cross_tenant_lookup'] },
      ],
    };

    const report = detectEffectiveAuthority(agent, OPS_CREW_CONTENT);

    assert.ok(report.elevatedRisks.includes('DATABASE_EXPORT'));
    assert.ok(report.elevatedRisks.includes('CROSS_TENANT_ACCESS'));
  });

  it('buildAgentInventoryRecord attaches NHI metadata and connectivity map', () => {
    const record = buildAgentInventoryRecord(READ_ONLY_AGENT, PRIVILEGE_ESCALATION_CONTENT);

    assert.ok(record.nhi.ownerDepartment.length > 0);
    assert.ok(['VERIFIED', 'UNVERIFIED', 'ROGUE'].includes(record.nhi.verifiedStatus));
    assert.ok(record.nhi.creationTimestamp.length > 0);
    assert.ok(record.nhi.lastActive.length > 0);
    assert.equal(record.connectivity.connectedToolsCount, 1);
    assert.equal(record.connectivity.mcpServersCount, 1);
    assert.ok(record.connectivity.externalApisCount >= 0);
    assert.ok(record.authorityReport.riskScore > 0);
  });

  it('scanEnvironment produces accurate overview statistics from fleet', () => {
    const scan = buildMockAgentDiscovery();

    assert.equal(scan.overview.totalAiAgents, scan.agents.length);
    assert.ok(scan.overview.connectedTools > 0);
    assert.ok(scan.overview.mcpServers > 0);
    assert.ok(scan.overview.unknownRogueAgents >= 2);
    assert.ok(scan.scannedAt.length > 0);

    const rogueAgents = scan.agents.filter((agent) => agent.nhi.verifiedStatus === 'ROGUE');
    assert.ok(rogueAgents.length >= 1);
  });

  it('scanEnvironment detects ops agent privilege escalation in integrated fleet', () => {
    const scan = buildMockAgentDiscovery();
    const opsAgent = scan.agents.find((agent) => agent.id === 'crewai-ops-agent-1');

    assert.ok(opsAgent);
    assert.equal(opsAgent.authorityReport.privilegeEscalationDetected, true);
    assert.ok(opsAgent.authorityReport.elevatedRisks.includes('FINANCIAL_EXECUTE'));
    assert.ok(opsAgent.authorityReport.elevatedRisks.includes('UNRESTRICTED_DELETE'));
    assert.ok(opsAgent.authorityReport.elevatedRisks.includes('DATABASE_EXPORT'));
  });

  it('scanEnvironment from discovery files integrates file content scanning', () => {
    const scan = scanEnvironment({
      files: [
        {
          path: 'src/agents/rogue.py',
          content: `
            from crewai import Agent
            agent = Agent(name="Rogue", role="Data Export")
            tools = ["bulk_export_db", "s3_delete"]
            STRIPE_SECRET_KEY=sk_live_rogue
            DATABASE_URL=postgres://admin:pass@db/cross?tenant_id=*
          `,
        },
      ],
    });

    assert.equal(scan.overview.totalAiAgents, 1);
    assert.ok(scan.agents[0].authorityReport.privilegeEscalationDetected);
    assert.ok(scan.agents[0].authorityReport.elevatedRisks.length >= 2);
  });

  it('aggregates connected tools and MCP servers across multi-agent environment', () => {
    const agents: AgentAsset[] = [
      READ_ONLY_AGENT,
      {
        ...READ_ONLY_AGENT,
        id: 'agent-2',
        mcpConnections: [
          { serverName: 'postgres', transport: 'sse', tools: ['sql_query', 'delete_records'] },
          { serverName: 's3', transport: 'http', tools: ['s3_delete'] },
        ],
      },
    ];

    const scan = scanEnvironment({ agents });

    assert.equal(scan.overview.totalAiAgents, 2);
    assert.equal(scan.overview.connectedTools, 4);
    assert.equal(scan.overview.mcpServers, 3);
  });
});
