import { createHash } from 'node:crypto';
import type { OutcomeVerifyRequest } from '@/lib/nexus-core/outcome/models';

export function buildVerificationRequestFingerprint(req: OutcomeVerifyRequest): string {
  const canonical = JSON.stringify({
    action_id: req.action_id,
    agent_id: req.agent_id,
    adapter_id: req.adapter_id,
    expected_outcome: req.expected_outcome,
    mock_fixture: req.mock_fixture ?? null,
    resource_id: req.resource_id ?? null,
    blocked_action: req.blocked_action ?? false,
  });
  return createHash('sha256').update(canonical).digest('hex');
}
