/** Maps business fields to their authoritative system-of-record vertical. */

export type AuthoritativeVertical =
  | 'payment_provider'
  | 'ledger'
  | 'erp'
  | 'crm'
  | 'iam'
  | 'database'
  | 'generic_http';

export interface AuthoritativeSourceMapping {
  field: string;
  vertical: AuthoritativeVertical;
  description: string;
}

export const AUTHORITATIVE_SOURCE_REGISTRY: AuthoritativeSourceMapping[] = [
  { field: 'payment_status', vertical: 'payment_provider', description: 'Payment gateway / processor state' },
  { field: 'payment_id', vertical: 'payment_provider', description: 'Processor transaction id' },
  { field: 'amount', vertical: 'payment_provider', description: 'Settled amount (minor units or decimal per adapter)' },
  { field: 'currency', vertical: 'payment_provider', description: 'ISO currency on payment rail' },
  { field: 'invoice_balance', vertical: 'erp', description: 'ERP open balance' },
  { field: 'invoice.status', vertical: 'erp', description: 'ERP invoice lifecycle' },
  { field: 'invoice_paid', vertical: 'erp', description: 'ERP paid flag' },
  { field: 'accounting_entry', vertical: 'ledger', description: 'General ledger posting' },
  { field: 'ledger_entry', vertical: 'ledger', description: 'Ledger row existence' },
  { field: 'refund_status', vertical: 'ledger', description: 'Refund posting state' },
  { field: 'customer_record', vertical: 'crm', description: 'CRM account record' },
  { field: 'customer_id', vertical: 'crm', description: 'CRM primary key' },
  { field: 'segment', vertical: 'crm', description: 'CRM marketing / service segment' },
  { field: 'user_permission', vertical: 'iam', description: 'Effective IAM permission' },
  { field: 'role_arn', vertical: 'iam', description: 'AWS IAM role binding' },
];

export function resolveAuthoritativeVertical(field: string): AuthoritativeVertical {
  const exact = AUTHORITATIVE_SOURCE_REGISTRY.find((m) => m.field === field);
  if (exact) return exact.vertical;
  const prefix = field.split('.')[0] ?? field;
  const byPrefix = AUTHORITATIVE_SOURCE_REGISTRY.find((m) => m.field.startsWith(prefix));
  return byPrefix?.vertical ?? 'database';
}

export function claimsByVertical(fields: string[]): Record<AuthoritativeVertical, string[]> {
  const out: Record<string, string[]> = {};
  for (const field of fields) {
    const v = resolveAuthoritativeVertical(field);
    out[v] = out[v] ?? [];
    out[v]!.push(field);
  }
  return out as Record<AuthoritativeVertical, string[]>;
}
