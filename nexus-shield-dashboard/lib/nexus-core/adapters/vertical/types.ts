export type FinanceAction = 'create_payment' | 'create_refund' | 'transfer_funds';
export type ErpAction = 'close_invoice' | 'update_invoice' | 'reconcile_balance';
export type CrmAction = 'update_profile' | 'change_segment' | 'bulk_sync';

export interface VerticalAdapterContext {
  fixture_id?: string;
  inline_state?: Record<string, unknown>;
  transaction_id?: string;
  action: string;
}

export interface VerticalReadResult {
  vertical: 'finance' | 'erp' | 'crm';
  action: string;
  observed_state: Record<string, unknown>;
  observed_at: string;
  source_id: string;
  query_fingerprint: string;
}

export interface VerticalAdapter {
  vertical: 'finance' | 'erp' | 'crm';
  supported_actions: string[];
  read_state(ctx: VerticalAdapterContext): VerticalReadResult;
  health_check(): { ok: boolean; message: string };
}
