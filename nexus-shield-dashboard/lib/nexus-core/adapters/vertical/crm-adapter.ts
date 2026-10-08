import type { CrmAction, VerticalAdapter, VerticalAdapterContext, VerticalReadResult } from '@/lib/nexus-core/adapters/vertical/types';

const FIXTURES: Record<string, Record<string, unknown>> = {
  profile_ok: { customer_id: 'cust-100', segment: 'STANDARD', shadow_field: false },
  vip_upgrade: { customer_id: 'cust-100', segment: 'VIP', shadow_field: false },
  shadow_alteration: { customer_id: 'cust-100', segment: 'VIP', shadow_field: true },
  bulk_mutation: { customer_id: 'cust-100', segment: 'STANDARD', _bulk_update: true },
};

export class CrmVerticalAdapter implements VerticalAdapter {
  vertical = 'crm' as const;
  supported_actions: CrmAction[] = ['update_profile', 'change_segment', 'bulk_sync'];

  read_state(ctx: VerticalAdapterContext): VerticalReadResult {
    const state = ctx.inline_state ?? FIXTURES[ctx.fixture_id ?? 'profile_ok'] ?? FIXTURES.profile_ok!;
    return {
      vertical: 'crm',
      action: ctx.action,
      observed_state: { ...state },
      observed_at: new Date().toISOString(),
      source_id: ctx.transaction_id ?? 'crm-1',
      query_fingerprint: `crm:${ctx.action}:${ctx.fixture_id ?? 'default'}`,
    };
  }

  health_check() {
    return { ok: true, message: 'crm vertical adapter (read-only)' };
  }
}
