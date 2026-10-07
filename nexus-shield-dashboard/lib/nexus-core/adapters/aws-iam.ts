import { createHash } from 'node:crypto';
import type { ExternalStateResult, OutcomeAdapterContext, OutcomeStateAdapter } from '@/lib/nexus-core/adapters/types';

function hashState(state: Record<string, unknown>): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(state)).digest('hex')}`;
}

/** Mock AWS IAM / role-state introspection. */
export const awsIamOutcomeAdapter: OutcomeStateAdapter = {
  system: 'AWS_IAM',
  readCurrentState(ctx: OutcomeAdapterContext): ExternalStateResult {
    const roleArn = String(ctx.toolArgs.role_arn ?? ctx.toolArgs.role ?? 'arn:aws:iam::123456789012:role/agent-runtime');
    const inline = ctx.inlineState ?? {};
    const current_state = {
      role_arn: roleArn,
      attached_policies: inline.attached_policies ?? ['ReadOnlyAccess'],
      privilege_escalation_detected: inline.privilege_escalation_detected ?? false,
      last_assume_role_event: inline.last_assume_role_event ?? null,
      ...inline,
    };
    return {
      system: 'AWS_IAM',
      entity_id: roleArn,
      current_state,
      timestamp: new Date().toISOString(),
      raw_hash: hashState(current_state),
    };
  },
};
