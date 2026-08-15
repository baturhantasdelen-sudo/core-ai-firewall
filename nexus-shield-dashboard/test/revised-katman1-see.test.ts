import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  buildEffectiveAuthorityGraph,
  calculateEffectiveAuthorityGraph,
  hasIndirectCapabilityEscalation,
  resetDiscoveryGraphCache,
} from '../lib/engine/agents/discovery-graph.ts';
import { detectEffectiveAuthority } from '../lib/engine/agents/inventory.ts';
import {
  __testExpireToken,
  issueTemporaryCapabilityToken,
  resetJitCredentialStore,
  revokeAllStaticCredentials,
  validateCapabilityToken,
} from '../lib/engine/auth/jit-credentials.ts';
import type { AgentAsset } from '../lib/engine/discovery/index.ts';

const READ_ONLY_AGENT: AgentAsset = {
  id: 'graph-readonly-agent',
  name: 'Invoice Reader',
  framework: 'LangChain',
  sourceFile: 'src/agents/invoice_reader.py',
  capabilities: ['READ'],
  riskLevel: 'LOW',
  mcpConnections: [
    {
      serverName: 'postgres-mcp',
      transport: 'sse',
      tools: ['read_invoice', 'bulk_export_db', 'stripe_payment'],
    },
  ],
};

const ESCALATION_CONTENT = `
  scopes="read:invoices"
  STRIPE_SECRET_KEY=sk_live_hidden
  DATABASE_URL=postgres://admin:root@db.prod:5432/main?superuser=true
`;

describe('REVISED Katman 1 — SEE: Discovery Graph & JIT Credentials', () => {
  afterEach(() => {
    resetDiscoveryGraphCache();
    resetJitCredentialStore();
  });

  it('builds Agent -> Tools -> External APIs -> Databases -> User Scope graph chain', () => {
    const graph = buildEffectiveAuthorityGraph(READ_ONLY_AGENT, ESCALATION_CONTENT);

    assert.equal(graph.agentId, READ_ONLY_AGENT.id);
    assert.ok(graph.nodes.some((node) => node.type === 'agent'));
    assert.ok(graph.nodes.some((node) => node.type === 'tool'));
    assert.ok(graph.nodes.some((node) => node.type === 'external_api'));
    assert.ok(graph.nodes.some((node) => node.type === 'database'));
    assert.ok(graph.nodes.some((node) => node.type === 'user_scope'));
    assert.ok(graph.edges.length >= 4);
    assert.ok(graph.directPermissions.some((entry) => entry.capability === 'READ'));
  });

  it('detects indirect capability escalation via tool dependencies', () => {
    const graph = buildEffectiveAuthorityGraph(READ_ONLY_AGENT, ESCALATION_CONTENT);

    assert.ok(graph.indirectCapabilities.some((entry) => entry.capability === 'EXPORT'));
    assert.ok(graph.indirectCapabilities.some((entry) => entry.capability === 'PAYMENT'));
    assert.ok(hasIndirectCapabilityEscalation(graph));
    assert.ok(['HIGH', 'CRITICAL'].includes(graph.effectiveRiskLevel));
    assert.ok(graph.effectiveRiskScore >= 55);
  });

  it('caches graph for calculateEffectiveAuthorityGraph lookup', () => {
    buildEffectiveAuthorityGraph(READ_ONLY_AGENT, ESCALATION_CONTENT);
    const cached = calculateEffectiveAuthorityGraph(READ_ONLY_AGENT.id);

    assert.equal(cached.agentId, READ_ONLY_AGENT.id);
    assert.ok(cached.nodes.length > 0);
  });

  it('aligns graph risk with effective authority report', () => {
    const report = detectEffectiveAuthority(READ_ONLY_AGENT, ESCALATION_CONTENT);
    const graph = buildEffectiveAuthorityGraph(READ_ONLY_AGENT, ESCALATION_CONTENT, report);

    assert.equal(report.privilegeEscalationDetected, true);
    assert.ok(graph.effectiveRiskScore >= report.riskScore);
  });

  it('issues and validates a temporary JIT capability token (default 60s)', () => {
    const issued = issueTemporaryCapabilityToken('graph-readonly-agent', 'READ', 60);

    assert.ok(issued.token.startsWith('jit_'));
    assert.equal(issued.scope, 'READ');
    assert.equal(issued.durationSeconds, 60);

    const validation = validateCapabilityToken(issued.token);
    assert.equal(validation.valid, true);
    assert.equal(validation.expired, false);
    assert.equal(validation.agentId, 'graph-readonly-agent');
    assert.equal(validation.scope, 'READ');
  });

  it('invalidates expired JIT tokens with Capability Expired reason', () => {
    const issued = issueTemporaryCapabilityToken('graph-readonly-agent', 'DB_QUERY', 60);
    __testExpireToken(issued.token);

    const validation = validateCapabilityToken(issued.token);
    assert.equal(validation.valid, false);
    assert.equal(validation.expired, true);
    assert.equal(validation.reason, 'Capability Expired');
  });

  it('revokes all static credentials and invalidates active JIT tokens for agent', () => {
    const issued = issueTemporaryCapabilityToken('graph-readonly-agent', 'WRITE', 120);
    const revoke = revokeAllStaticCredentials('graph-readonly-agent');

    assert.equal(revoke.revoked, true);
    const validation = validateCapabilityToken(issued.token);
    assert.equal(validation.valid, false);
    assert.equal(validation.revoked, true);
  });
});
